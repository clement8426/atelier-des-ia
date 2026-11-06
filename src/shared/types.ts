export const workshopIds = ["classification", "ocr", "speech"] as const;
export type WorkshopId = (typeof workshopIds)[number];
export type View = "explore" | "prepare" | "computer" | "help";
export interface ModelFile {
  file: string;
  url: string;
  bytes: number;
  sha256: string;
  repository: string;
  revision: string;
  license: string;
}
export interface ModelSpec {
  id: WorkshopId;
  name: string;
  files: ModelFile[];
}
export interface Measurement {
  appVersion: string;
  modelRevision: string;
  runtime: string;
  platform: string;
  machineFingerprint: string;
  at: string;
  loadMs: number;
  inferenceMs: number;
  totalMs: number;
  peakAppMb: number;
  passed: boolean;
}
export interface ModelState {
  id: WorkshopId;
  name: string;
  bytes: number;
  storedBytes: number;
  installed: boolean;
  measurement?: Measurement;
}
export interface Diagnostic {
  platform: string;
  arch: string;
  cpu: string;
  cores: number;
  totalMb: number;
  availableMb: number;
  freeDiskMb: number;
  runtime: string;
  appVersion: string;
}
export interface Progress {
  phase: "download" | "verify" | "load" | "compute" | "pack";
  message: string;
  loaded?: number;
  total?: number;
  id?: WorkshopId;
}
export interface Prediction {
  index: number;
  label: string;
  score: number;
}
export interface Output {
  predictions?: Prediction[];
  text?: string;
  audio?: number[];
  lines?: number;
}
export interface RunInput {
  id: WorkshopId;
  sample?: string;
  text?: string;
  reference?: boolean;
}
export interface RunResult {
  output: Output;
  measurement: Measurement;
}
export type Reply<T> = { ok: true; value: T } | { ok: false; error: string };
export interface API {
  status(): Promise<Reply<ModelState[]>>;
  diagnostic(): Promise<Reply<Diagnostic>>;
  prepare(id: WorkshopId): Promise<Reply<RunResult>>;
  run(input: RunInput): Promise<Reply<RunResult>>;
  cancel(): Promise<Reply<void>>;
  remove(id: WorkshopId): Promise<Reply<void>>;
  exportPack(): Promise<Reply<string | null>>;
  importPack(): Promise<Reply<number | null>>;
  onProgress(callback: (progress: Progress) => void): () => void;
}
export interface EngineAPI {
  ready(): void;
  onRun(callback: (input: RunInput) => void): () => void;
  progress(progress: Progress): void;
  finish(
    result:
      | { output: Output; loadMs: number; inferenceMs: number; passed: boolean }
      | { error: string },
  ): void;
}
declare global {
  interface Window {
    atelier: API;
    engine: EngineAPI;
    createPiperPhonemize: (
      options: Record<string, unknown>,
    ) => Promise<{ callMain(args: string[]): void }>;
  }
}
