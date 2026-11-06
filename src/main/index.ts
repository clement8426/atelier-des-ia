import {
  app,
  BrowserWindow,
  ipcMain,
  protocol,
  net,
  session,
  dialog,
  Menu,
} from "electron";
import {
  cpus,
  freemem,
  totalmem,
  platform,
  arch,
  hostname,
  release,
} from "node:os";
import { createHash } from "node:crypto";
import { join, resolve, sep } from "node:path";
import { statfs, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { ModelStorage } from "./storage";
import { measurementMatches } from "./qualification";
import { isWorkshop, referenceInput } from "../shared/catalog";
import type {
  ModelSpec,
  Progress,
  RunInput,
  RunResult,
  Output,
  Reply,
  WorkshopId,
} from "../shared/types";
import registry from "../../resources/models.lock.json";
import project from "../../package.json";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "atelier",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);
// Dedicated browser profile for automated/development runs; never honored by installed builds.
if (!app.isPackaged && process.env.ATELIER_TEST_PROFILE)
  app.setPath("userData", resolve(process.env.ATELIER_TEST_PROFILE));
const dev = !app.isPackaged && process.env.ELECTRON_RENDERER_URL;
const dataRoot =
  !app.isPackaged && process.env.ATELIER_DATA_DIR
    ? resolve(process.env.ATELIER_DATA_DIR)
    : join(app.getPath("userData"), "atelier-resources");
let window: BrowserWindow | null = null;
let engine: BrowserWindow | null = null;
let controller: AbortController | null = null;
let currentInput: RunInput | null = null;
let finishEngine:
  | ((
      value:
        | {
            output: Output;
            loadMs: number;
            inferenceMs: number;
            passed: boolean;
          }
        | { error: string },
    ) => void)
  | null = null;
let lastProgress = 0;
const storage = new ModelStorage(
  dataRoot,
  registry.modules as ModelSpec[],
  (progress) => {
    const now = Date.now();
    if (
      progress.phase !== "download" ||
      now - lastProgress > 100 ||
      progress.loaded === progress.total
    ) {
      lastProgress = now;
      window?.webContents.send("atelier:progress", progress);
    }
  },
);
const appRoot = resolve(import.meta.dirname, "../..");
const renderRoot = join(appRoot, "out/renderer");
const preload = join(import.meta.dirname, "../preload/index.cjs");
const mib = (bytes: number) => Math.round(bytes / 1024 ** 2);
const runtime = `ONNX Runtime Web ${project.devDependencies["onnxruntime-web"]} / WASM CPU · Electron ${process.versions.electron}`;
const machineFingerprint = createHash("sha256")
  .update(
    JSON.stringify({
      host: hostname(),
      cpu: cpus()[0]?.model,
      cores: cpus().length,
      memory: totalmem(),
      platform: platform(),
      arch: arch(),
      os: release(),
    }),
  )
  .digest("hex");
function validateInput(input: unknown): RunInput {
  if (
    !input ||
    typeof input !== "object" ||
    !("id" in input) ||
    !isWorkshop(input.id)
  )
    throw new Error("Atelier inconnu.");
  const value = input as RunInput;
  if (value.id === "speech") {
    if (
      typeof value.text !== "string" ||
      !value.text.trim() ||
      value.text.length > 200
    )
      throw new Error("Écrivez une phrase de 1 à 200 caractères.");
    return { id: value.id, text: value.text.trim() };
  }
  const allowed =
    value.id === "classification"
      ? ["dog", "cat", "abstract"]
      : ["note", "ticket", "tiny"];
  if (!value.sample || !allowed.includes(value.sample))
    throw new Error("Choisissez un exemple proposé.");
  return { id: value.id, sample: value.sample };
}
function ensureMemory(id: WorkshopId) {
  const needed = { classification: 384, ocr: 640, speech: 896 }[id];
  if (mib(freemem()) < needed)
    throw new Error(
      "La mémoire disponible est trop faible pour cet atelier. Fermez quelques applications puis réessayez.",
    );
}
async function ensureDisk(bytes: number) {
  await mkdir(dataRoot, { recursive: true });
  const disk = await statfs(dataRoot);
  if (disk.bavail * disk.bsize < bytes + 128 * 1024 ** 2)
    throw new Error(
      "Il manque de la place sur le disque. Libérez de l’espace puis réessayez.",
    );
}
async function exclusive<T>(
  task: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (controller)
    throw new Error("Une opération est déjà en cours. Attendez ou annulez-la.");
  const active = new AbortController();
  controller = active;
  try {
    return await task(active.signal);
  } catch (error) {
    if (active.signal.aborted)
      throw new Error(
        "Opération annulée. Vous pouvez reprendre quand vous voulez.",
      );
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOSPC")
      throw new Error(
        "Le disque est plein. Libérez de la place puis réessayez.",
      );
    if (code === "EACCES" || code === "EPERM")
      throw new Error(
        "L’application ne peut pas accéder à ce dossier. Fermez les fichiers ouverts ou choisissez un autre emplacement.",
      );
    throw error;
  } finally {
    if (controller === active) controller = null;
  }
}
function stop() {
  controller?.abort();
  if (engine && !engine.isDestroyed()) engine.destroy();
}
const pageUrl = (page: string) =>
  dev
    ? `${dev}/${page}`
    : `atelier://${page === "engine.html" ? "engine" : "ui"}/${page}`;
const secureOptions = {
  preload,
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true,
};
function lockNavigation(win: BrowserWindow) {
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.on("will-attach-webview", (event) => event.preventDefault());
}
async function runEngine(
  input: RunInput,
  signal: AbortSignal,
): Promise<RunResult> {
  ensureMemory(input.id);
  if (!(await storage.installed(input.id)))
    throw new Error("Préparez cet atelier avant de lancer le calcul.");
  signal.throwIfAborted();
  const start = Date.now();
  let peakAppMb = 0;
  currentInput = input;
  const workerWindow = new BrowserWindow({
    show: false,
    width: 400,
    height: 300,
    webPreferences: {
      ...secureOptions,
      backgroundThrottling: false,
      additionalArguments: ["--atelier-engine"],
    },
  });
  engine = workerWindow;
  lockNavigation(workerWindow);
  const onAbort = () => {
    if (!workerWindow.isDestroyed()) workerWindow.destroy();
  };
  signal.addEventListener("abort", onAbort, { once: true });
  let interval: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await new Promise<{
      output: Output;
      loadMs: number;
      inferenceMs: number;
      passed: boolean;
    }>((resolveResult, reject) => {
      const fail = (message: string) => reject(new Error(message));
      finishEngine = (result) =>
        "error" in result ? fail(result.error) : resolveResult(result);
      workerWindow.once("closed", () =>
        fail(
          signal.aborted
            ? "Opération annulée. Vous pouvez reprendre quand vous voulez."
            : "Le moteur s’est arrêté. Réessayez cet atelier.",
        ),
      );
      workerWindow.webContents.once("render-process-gone", () =>
        fail(
          "Le moteur a rencontré une difficulté. Fermez des applications puis réessayez.",
        ),
      );
      workerWindow.webContents.once("did-fail-load", () =>
        fail(
          "Le moteur local n’a pas pu démarrer. Réessayez ou réinstallez l’application.",
        ),
      );
      // Only local diagnostics; include all Electron processes rather than the model file size.
      interval = setInterval(() => {
        peakAppMb = Math.max(
          peakAppMb,
          Math.round(
            app
              .getAppMetrics()
              .reduce((sum, metric) => sum + metric.memory.workingSetSize, 0) /
              1024,
          ),
        );
        if (mib(freemem()) < 192) {
          fail(
            "Le calcul a été arrêté pour préserver la mémoire de votre ordinateur.",
          );
          onAbort();
        }
      }, 200);
      timeout = setTimeout(() => {
        fail(
          "Ce calcul est trop long pour une démonstration confortable. Essayez un autre atelier.",
        );
        onAbort();
      }, 90_000);
      workerWindow
        .loadURL(pageUrl("engine.html"))
        .catch(() => fail("Impossible de charger le moteur local."));
    });
    signal.throwIfAborted();
    return {
      output: value.output,
      measurement: {
        appVersion: app.getVersion(),
        modelRevision: storage
          .spec(input.id)
          .files.map((f) => f.sha256)
          .join(":"),
        runtime,
        platform: `${platform()} ${arch()}`,
        machineFingerprint,
        at: new Date().toISOString(),
        loadMs: value.loadMs,
        inferenceMs: value.inferenceMs,
        totalMs: Date.now() - start,
        peakAppMb,
        passed:
          value.passed && value.loadMs <= 30_000 && value.inferenceMs <= 10_000,
      },
    };
  } finally {
    clearInterval(interval);
    clearTimeout(timeout);
    signal.removeEventListener("abort", onAbort);
    finishEngine = null;
    currentInput = null;
    if (!workerWindow.isDestroyed()) workerWindow.destroy();
    if (engine === workerWindow) engine = null;
  }
}
function registerIPC() {
  const handler = <T>(channel: string, fn: (arg: unknown) => Promise<T>) =>
    ipcMain.handle(channel, async (event, arg): Promise<Reply<T>> => {
      if (
        !window ||
        event.sender !== window.webContents ||
        event.senderFrame !== event.sender.mainFrame
      )
        return { ok: false, error: "Cette action n’est pas autorisée." };
      try {
        return { ok: true, value: await fn(arg) };
      } catch (error) {
        return {
          ok: false,
          error: controller?.signal.aborted
            ? "Opération annulée. Vous pouvez reprendre quand vous voulez."
            : error instanceof Error
              ? error.message
              : "L’opération a échoué. Réessayez.",
        };
      }
    });
  handler("atelier:status", async () => {
    const states = await storage.states();
    return states.map((state) => ({
      ...state,
      measurement: measurementMatches(state.measurement, {
        appVersion: app.getVersion(),
        runtime,
        platform: `${platform()} ${arch()}`,
        machineFingerprint,
        modelRevision: storage
          .spec(state.id)
          .files.map((f) => f.sha256)
          .join(":"),
      })
        ? state.measurement
        : undefined,
    }));
  });
  handler("atelier:diagnostic", async () => {
    await mkdir(dataRoot, { recursive: true });
    const disk = await statfs(dataRoot);
    return {
      platform: platform(),
      arch: arch(),
      cpu: cpus()[0]?.model ?? "Processeur non identifié",
      cores: cpus().length,
      totalMb: mib(totalmem()),
      availableMb: mib(freemem()),
      freeDiskMb: mib(disk.bavail * disk.bsize),
      runtime: `Electron ${process.versions.electron}`,
      appVersion: app.getVersion(),
    };
  });
  handler("atelier:prepare", async (value) => {
    if (!isWorkshop(value)) throw new Error("Atelier inconnu.");
    return exclusive(async (signal) => {
      ensureMemory(value);
      await ensureDisk(
        storage.spec(value).files.reduce((n, f) => n + f.bytes * 2, 0),
      );
      await storage.prepare(value, signal);
      const result = await runEngine(referenceInput(value), signal);
      await storage.saveMeasurement(value, result.measurement);
      if (
        result.measurement.loadMs > 30_000 ||
        result.measurement.inferenceMs > 10_000
      )
        throw new Error(
          "Cet atelier fonctionne mais son essai est trop lent pour le parcours conseillé sur ce poste. Fermez quelques applications ou choisissez un autre atelier.",
        );
      if (!result.measurement.passed)
        throw new Error(
          "Le modèle démarre mais le résultat de référence est inattendu. Cet atelier reste non validé sur ce poste.",
        );
      return result;
    });
  });
  handler("atelier:run", async (value) => {
    const input = validateInput(value);
    return exclusive((signal) => runEngine(input, signal));
  });
  handler("atelier:cancel", async () => {
    stop();
  });
  handler("atelier:remove", async (value) => {
    if (!isWorkshop(value)) throw new Error("Atelier inconnu.");
    return exclusive(async () => storage.remove(value));
  });
  handler("atelier:export", async () =>
    exclusive(async (signal) => {
      const selected = await dialog.showOpenDialog(window!, {
        title: "Choisir où enregistrer le pack de séance",
        properties: ["openDirectory", "createDirectory"],
      });
      if (selected.canceled) return null;
      const available = (await storage.states()).filter((s) => s.installed);
      if (!available.length)
        throw new Error(
          "Téléchargez au moins un atelier avant de créer un pack.",
        );
      const disk = await statfs(selected.filePaths[0]);
      if (
        disk.bavail * disk.bsize <
        available.reduce((n, s) => n + s.bytes, 0) + 128 * 1024 ** 2
      )
        throw new Error(
          "Il manque de la place pour créer le pack à cet endroit.",
        );
      return storage.exportPack(selected.filePaths[0], signal);
    }),
  );
  handler("atelier:import", async () =>
    exclusive(async (signal) => {
      const selected = await dialog.showOpenDialog(window!, {
        title: "Choisir le dossier du pack de séance",
        properties: ["openDirectory"],
      });
      if (selected.canceled) return null;
      await ensureDisk(
        storage.registry.reduce(
          (n, s) => n + s.files.reduce((sum, f) => sum + f.bytes * 2, 0),
          0,
        ),
      );
      return storage.importPack(selected.filePaths[0], signal);
    }),
  );
  ipcMain.on("engine:ready", (event) => {
    if (
      engine &&
      event.sender === engine.webContents &&
      event.senderFrame === event.sender.mainFrame
    )
      event.sender.send("engine:run", currentInput);
  });
  ipcMain.on("engine:progress", (event, progress: Progress) => {
    if (
      engine &&
      event.sender === engine.webContents &&
      event.senderFrame === event.sender.mainFrame
    )
      window?.webContents.send("atelier:progress", progress);
  });
  ipcMain.on("engine:finish", (event, value) => {
    if (
      engine &&
      event.sender === engine.webContents &&
      event.senderFrame === event.sender.mainFrame
    )
      finishEngine?.(value);
  });
}
async function registerProtocol() {
  protocol.handle("atelier", async (request) => {
    try {
      const url = new URL(request.url);
      const pieces = decodeURIComponent(url.pathname)
        .split("/")
        .filter(Boolean);
      let destination: string;
      if (
        url.hostname === "models" &&
        pieces.length === 2 &&
        isWorkshop(pieces[0])
      )
        destination = storage.path(pieces[0], pieces[1]);
      else if (url.hostname === "ui" || url.hostname === "engine") {
        destination = resolve(renderRoot, ...pieces);
        if (!destination.startsWith(renderRoot + sep))
          return new Response("", { status: 403 });
      } else return new Response("", { status: 404 });
      const response = await net.fetch(pathToFileURL(destination).toString());
      const headers = new Headers(response.headers);
      const origin = request.headers.get("Origin");
      if (
        origin &&
        [
          "atelier://ui",
          "atelier://engine",
          ...(dev ? [new URL(dev).origin] : []),
        ].includes(origin)
      )
        headers.set("Access-Control-Allow-Origin", origin);
      // OpenCV's Emscripten bindings use Function(). Allow this only in the isolated, local compute origin.
      const evaluation =
        url.hostname === "engine" ? "'unsafe-eval'" : "'wasm-unsafe-eval'";
      headers.set(
        "Content-Security-Policy",
        `default-src 'self'; script-src 'self' ${evaluation}; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self' atelier: blob: ${url.hostname === "engine" ? "data:" : ""}; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-src 'none'`,
      );
      headers.set("Cross-Origin-Opener-Policy", "same-origin");
      headers.set("Cross-Origin-Embedder-Policy", "require-corp");
      headers.set("Cross-Origin-Resource-Policy", "cross-origin");
      return new Response(response.body, { status: response.status, headers });
    } catch {
      return new Response("Ressource locale indisponible.", { status: 404 });
    }
  });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    window?.show();
    window?.focus();
  });
  app
    .whenReady()
    .then(async () => {
      if (process.argv.includes("--clean-data")) {
        const result = await dialog.showMessageBox({
          type: "question",
          title: "Nettoyer l’Atelier des IA",
          message: "Supprimer les modèles et les tests de l’Atelier des IA ?",
          detail:
            "Vos documents et les packs exportés seront conservés. Les modèles pourront être téléchargés à nouveau.",
          buttons: ["Conserver", "Supprimer les données"],
          defaultId: 0,
          cancelId: 0,
        });
        if (result.response === 1) {
          for (const spec of storage.registry) await storage.remove(spec.id);
          await session.defaultSession.clearCache();
          await session.defaultSession.clearStorageData();
        }
        app.quit();
        return;
      }
      await registerProtocol();
      app.setAppUserModelId("ch.labonumerique.atelierdesia");
      session.defaultSession.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      session.defaultSession.webRequest.onBeforeRequest(
        { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
        (details, callback) => {
          callback({
            cancel: !dev || new URL(details.url).host !== new URL(dev).host,
          });
        },
      );
      registerIPC();
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          {
            label: "Atelier des IA",
            submenu: [
              { role: "about", label: "À propos" },
              { type: "separator" },
              { role: "quit", label: "Quitter" },
            ],
          },
          {
            label: "Affichage",
            submenu: [
              { role: "zoomIn", label: "Agrandir le texte" },
              { role: "zoomOut", label: "Réduire le texte" },
              { role: "resetZoom", label: "Taille normale" },
              { role: "togglefullscreen", label: "Plein écran" },
            ],
          },
          {
            label: "Édition",
            submenu: [
              { role: "copy", label: "Copier" },
              { role: "paste", label: "Coller" },
              { role: "selectAll", label: "Tout sélectionner" },
            ],
          },
        ]),
      );
      window = new BrowserWindow({
        width: 1400,
        height: 930,
        minWidth: 600,
        minHeight: 620,
        show: false,
        title: "Atelier des IA",
        icon: join(appRoot, "resources/icon.png"),
        backgroundColor: "#f8f7f3",
        webPreferences: secureOptions,
      });
      lockNavigation(window);
      window.once("ready-to-show", () => window?.show());
      window.on("closed", () => {
        stop();
        window = null;
      });
      await window.loadURL(pageUrl("index.html"));
    })
    .catch((error) => {
      dialog.showErrorBox(
        "L’Atelier ne peut pas démarrer",
        `${error instanceof Error ? error.message : "Erreur de démarrage"}\nRéinstallez l’application ou utilisez le nettoyage des données.`,
      );
      app.quit();
    });
  app.on("window-all-closed", () => {
    stop();
    app.quit();
  });
  app.on("before-quit", stop);
}
