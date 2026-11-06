import { contextBridge, ipcRenderer } from "electron";
import type { API, EngineAPI, Progress, RunInput } from "../shared/types";
if (process.argv.includes("--atelier-engine")) {
  const api: EngineAPI = {
    ready: () => ipcRenderer.send("engine:ready"),
    onRun: (callback) => {
      const listener = (_event: unknown, input: RunInput) => callback(input);
      ipcRenderer.on("engine:run", listener);
      return () => ipcRenderer.removeListener("engine:run", listener);
    },
    progress: (value) => ipcRenderer.send("engine:progress", value),
    finish: (value) => ipcRenderer.send("engine:finish", value),
  };
  contextBridge.exposeInMainWorld("engine", api);
} else {
  const api: API = {
    status: () => ipcRenderer.invoke("atelier:status"),
    diagnostic: () => ipcRenderer.invoke("atelier:diagnostic"),
    prepare: (id) => ipcRenderer.invoke("atelier:prepare", id),
    run: (input) => ipcRenderer.invoke("atelier:run", input),
    cancel: () => ipcRenderer.invoke("atelier:cancel"),
    remove: (id) => ipcRenderer.invoke("atelier:remove", id),
    exportPack: () => ipcRenderer.invoke("atelier:export"),
    importPack: () => ipcRenderer.invoke("atelier:import"),
    onProgress: (callback) => {
      const listener = (_event: unknown, p: Progress) => callback(p);
      ipcRenderer.on("atelier:progress", listener);
      return () => ipcRenderer.removeListener("atelier:progress", listener);
    },
  };
  contextBridge.exposeInMainWorld("atelier", api);
}
