// Fetch the existing lockfile's exact artifacts. This never refreshes model versions.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
const registry = JSON.parse(
  await readFile("resources/models.lock.json", "utf8"),
);
const directory = "resources/registry-downloads";
await mkdir(directory, { recursive: true });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const spec of registry.modules)
  for (const file of spec.files) {
    const path = join(directory, `${spec.id}-${file.file}`);
    try {
      const local = await readFile(path);
      if (local.length === file.bytes && hash(local) === file.sha256) continue;
    } catch {
      /* absent */
    }
    const response = await fetch(file.url, {
      signal: AbortSignal.timeout(180000),
    });
    if (!response.ok)
      throw new Error(`Fixture ${file.file}: HTTP ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length !== file.bytes || hash(data) !== file.sha256)
      throw new Error(`Fixture ${file.file}: integrity check failed`);
    await writeFile(path, data);
    console.log(`${spec.id}/${file.file} verified`);
  }
console.log("Modèles de test disponibles, registre inchangé.");
