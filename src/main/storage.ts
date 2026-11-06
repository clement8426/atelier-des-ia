import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import {
  mkdir,
  stat,
  readFile,
  writeFile,
  rename,
  rm,
  open,
  copyFile,
  lstat,
} from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import type {
  ModelSpec,
  ModelFile,
  ModelState,
  Measurement,
  Progress,
  WorkshopId,
} from "../shared/types";

export function safeChild(root: string, ...parts: string[]) {
  if (
    parts.some(
      (part) =>
        !part ||
        part.includes("\0") ||
        part.includes("..") ||
        /[\\/]/.test(part),
    )
  )
    throw new Error("Chemin de ressource refusé.");
  const child = resolve(root, ...parts);
  if (!child.startsWith(resolve(root) + sep))
    throw new Error("Chemin hors du dossier de l’application.");
  return child;
}
export async function digest(path: string) {
  const hash = createHash("sha256");
  const handle = await open(path, "r");
  const buffer = Buffer.alloc(64 * 1024);
  try {
    for (;;) {
      const { bytesRead } = await handle.read(buffer);
      if (!bytesRead) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    await handle.close();
  }
  return hash.digest("hex");
}
async function activateFile(source: string, destination: string) {
  // Windows antivirus/indexers may briefly hold a freshly written model open.
  // Retry the atomic rename; never delete the existing usable destination first.
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(source, destination);
      return;
    } catch (error) {
      if (
        attempt >= 3 ||
        !["EPERM", "EACCES", "EBUSY"].includes(
          (error as NodeJS.ErrnoException).code ?? "",
        )
      )
        throw error;
      await delay([75, 200, 500][attempt]);
    }
  }
}
export async function validFile(path: string, spec: ModelFile) {
  try {
    const info = await lstat(path);
    return (
      !info.isSymbolicLink() &&
      info.isFile() &&
      info.size === spec.bytes &&
      (await digest(path)) === spec.sha256
    );
  } catch {
    return false;
  }
}
export class ModelStorage {
  constructor(
    readonly root: string,
    readonly registry: ModelSpec[],
    readonly notify: (p: Progress) => void,
  ) {}
  spec(id: WorkshopId) {
    const spec = this.registry.find((item) => item.id === id);
    if (!spec) throw new Error("Atelier inconnu.");
    return spec;
  }
  dir(id: WorkshopId) {
    this.spec(id);
    return safeChild(this.root, id);
  }
  path(id: WorkshopId, file: string) {
    if (!this.spec(id).files.some((item) => item.file === file))
      throw new Error("Ressource inconnue.");
    return safeChild(this.dir(id), file);
  }
  async ensureDirectory(id: WorkshopId) {
    await mkdir(this.root, { recursive: true });
    await mkdir(this.dir(id), { recursive: true });
    if (
      (await lstat(this.root)).isSymbolicLink() ||
      (await lstat(this.dir(id))).isSymbolicLink()
    )
      throw new Error(
        "Un lien symbolique empêche cette opération. Choisissez un dossier de données normal.",
      );
  }
  async installed(id: WorkshopId) {
    for (const file of this.spec(id).files)
      if (!(await validFile(this.path(id, file.file), file))) return false;
    return true;
  }
  async states(): Promise<ModelState[]> {
    return Promise.all(
      this.registry.map(async (spec) => {
        let storedBytes = 0;
        for (const file of spec.files) {
          for (const suffix of ["", ".part"]) {
            try {
              storedBytes += (
                await stat(this.path(spec.id, file.file) + suffix)
              ).size;
            } catch {
              /* absent */
            }
          }
        }
        let measurement: Measurement | undefined;
        try {
          measurement = JSON.parse(
            await readFile(safeChild(this.dir(spec.id), "test.json"), "utf8"),
          );
        } catch {
          /* not tested */
        }
        return {
          id: spec.id,
          name: spec.name,
          bytes: spec.files.reduce((n, file) => n + file.bytes, 0),
          storedBytes,
          installed: await this.installed(spec.id),
          measurement,
        };
      }),
    );
  }
  async saveMeasurement(id: WorkshopId, value: Measurement) {
    await this.ensureDirectory(id);
    const destination = safeChild(this.dir(id), "test.json");
    await writeFile(destination + ".new", JSON.stringify(value, null, 2));
    await rename(destination + ".new", destination);
  }
  async prepare(id: WorkshopId, signal: AbortSignal) {
    await this.ensureDirectory(id);
    const spec = this.spec(id);
    let completed = 0;
    const total = spec.files.reduce((n, f) => n + f.bytes, 0);
    for (const file of spec.files) {
      signal.throwIfAborted();
      const destination = this.path(id, file.file);
      this.notify({
        phase: "verify",
        id,
        message: "Vérification des ressources…",
        loaded: completed,
        total,
      });
      if (!(await validFile(destination, file))) {
        const partial = destination + ".part";
        let offset = 0;
        try {
          const info = await lstat(partial);
          if (info.isSymbolicLink()) throw new Error("Lien symbolique refusé.");
          offset = info.size;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        if (offset > file.bytes) {
          await rm(partial);
          offset = 0;
        }
        if (offset < file.bytes) {
          let response: Response;
          try {
            response = await fetch(file.url, {
              headers: offset ? { Range: `bytes=${offset}-` } : {},
              signal: AbortSignal.any([signal, AbortSignal.timeout(180_000)]),
            });
          } catch (error) {
            if (signal.aborted) throw error;
            throw new Error(
              "Téléchargement interrompu. Vérifiez votre connexion puis réessayez.",
            );
          }
          if (!response.ok || !response.body)
            throw new Error(
              "Téléchargement interrompu. Vérifiez votre connexion puis réessayez.",
            );
          if (
            response.status === 206 &&
            !response.headers
              .get("content-range")
              ?.startsWith(`bytes ${offset}-`)
          )
            throw new Error(
              "Reprise de téléchargement incohérente. Supprimez cette ressource puis réessayez.",
            );
          if (response.status !== 206) offset = 0;
          const handle = await open(partial, offset ? "a" : "w");
          try {
            for await (const chunk of response.body) {
              signal.throwIfAborted();
              offset += chunk.length;
              if (offset > file.bytes)
                throw new Error(
                  "La ressource reçue ne correspond pas à la version attendue.",
                );
              await handle.write(chunk);
              this.notify({
                phase: "download",
                id,
                message: `Téléchargement de ${spec.name}…`,
                loaded: completed + offset,
                total,
              });
            }
          } finally {
            await handle.close();
          }
        }
        signal.throwIfAborted();
        if (!(await validFile(partial, file))) {
          await rm(partial, { force: true });
          throw new Error(
            "La vérification du fichier a échoué. Réessayez le téléchargement.",
          );
        }
        await activateFile(partial, destination);
      }
      completed += file.bytes;
    }
  }
  async remove(id: WorkshopId) {
    await this.ensureDirectory(id);
    // Delete only known app-owned files, never a directory tree or arbitrary manifest path.
    for (const file of [
      ...this.spec(id).files.map((f) => f.file),
      "test.json",
    ]) {
      for (const suffix of ["", ".part", ".new"])
        await rm(safeChild(this.dir(id), file + suffix), { force: true });
    }
  }
  async exportPack(parent: string, signal: AbortSignal) {
    const root = join(parent, `Atelier-IA-pack-${Date.now()}`);
    await mkdir(root);
    const ids: WorkshopId[] = [];
    for (const spec of this.registry) {
      signal.throwIfAborted();
      if (!(await this.installed(spec.id))) continue;
      const dir = safeChild(root, spec.id);
      await mkdir(dir);
      for (const file of spec.files) {
        signal.throwIfAborted();
        await copyFile(
          this.path(spec.id, file.file),
          safeChild(dir, file.file),
        );
      }
      ids.push(spec.id);
      this.notify({ phase: "pack", message: `Copie de ${spec.name}…` });
    }
    await writeFile(
      join(root, "atelier-pack.json"),
      JSON.stringify({ schema: 1, modules: ids }),
    );
    return root;
  }
  async importPack(root: string, signal: AbortSignal) {
    // The pack cannot supply filenames, URLs or hashes: only the registry bundled with this app is trusted.
    const marker = JSON.parse(
      await readFile(join(root, "atelier-pack.json"), "utf8"),
    );
    if (marker.schema !== 1 || !Array.isArray(marker.modules))
      throw new Error("Ce dossier n’est pas un pack de séance compatible.");
    const selected = this.registry.filter((spec) =>
      marker.modules.includes(spec.id),
    );
    if (!selected.length)
      throw new Error("Ce pack ne contient aucun atelier compatible.");
    for (const spec of selected) {
      if ((await lstat(safeChild(root, spec.id))).isSymbolicLink())
        throw new Error(
          "Les liens symboliques ne sont pas acceptés dans les packs.",
        );
      for (const file of spec.files) {
        signal.throwIfAborted();
        if (
          !(await validFile(
            safeChild(safeChild(root, spec.id), file.file),
            file,
          ))
        )
          throw new Error(
            `Le pack contient une ressource absente ou altérée : ${spec.name}.`,
          );
      }
    }
    for (const spec of selected) {
      await this.ensureDirectory(spec.id);
      for (const file of spec.files) {
        signal.throwIfAborted();
        if (await validFile(this.path(spec.id, file.file), file)) continue;
        const partial = this.path(spec.id, file.file) + ".part";
        await copyFile(safeChild(safeChild(root, spec.id), file.file), partial);
        if (!(await validFile(partial, file)))
          throw new Error("La copie du pack a échoué.");
        await activateFile(partial, this.path(spec.id, file.file));
      }
      this.notify({
        phase: "pack",
        message: `${spec.name} importé. Le test reste à lancer.`,
      });
    }
    return selected.length;
  }
}
