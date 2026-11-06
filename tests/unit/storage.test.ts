import { beforeEach, afterEach, describe, expect, it } from "vitest";
import {
  mkdtemp,
  rm,
  readFile,
  writeFile,
  stat,
  utimes,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { ModelStorage, safeChild } from "../../src/main/storage";
import type { ModelSpec, Progress } from "../../src/shared/types";

describe("resources, downloads and offline packs", () => {
  let root: string,
    server: Server,
    storage: ModelStorage,
    range: string | undefined;
  const content = Buffer.from(
    "a reference model that must never be silently modified",
  );
  const hash = createHash("sha256").update(content).digest("hex");
  let corrupt = false;
  const progress: Progress[] = [];
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "atelier-test-"));
    corrupt = false;
    range = undefined;
    progress.length = 0;
    server = createServer((request, response) => {
      range = request.headers.range;
      const offset = range ? Number(range.replace(/\D/g, "")) : 0;
      if (range)
        response.writeHead(206, {
          "Content-Range": `bytes ${offset}-${content.length - 1}/${content.length}`,
        });
      response.end(
        corrupt ? Buffer.alloc(content.length, "x") : content.subarray(offset),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address() as { port: number };
    const registry: ModelSpec[] = [
      {
        id: "classification",
        name: "Reference",
        files: [
          {
            file: "model.onnx",
            url: `http://127.0.0.1:${address.port}/model`,
            bytes: content.length,
            sha256: hash,
            repository: "test",
            revision: "fixed",
            license: "test",
          },
        ],
      },
    ];
    storage = new ModelStorage(join(root, "owned"), registry, (value) =>
      progress.push(value),
    );
  });
  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  });
  it("rejects untrusted paths and unknown registry files", () => {
    for (const path of ["..", "../outside", "sub/file", "C:\\windows", "\0"])
      expect(() => safeChild(root, path)).toThrow();
    expect(() => storage.path("classification", "unregistered.onnx")).toThrow();
  });
  it("resumes a pinned file and verifies its complete hash", async () => {
    await storage.ensureDirectory("classification");
    await writeFile(
      storage.path("classification", "model.onnx") + ".part",
      content.subarray(0, 8),
    );
    await storage.prepare("classification", new AbortController().signal);
    expect(range).toBe("bytes=8-");
    expect(await storage.installed("classification")).toBe(true);
    expect(progress.some((item) => item.phase === "download")).toBe(true);
    expect((await storage.states())[0].storedBytes).toBe(content.length);
  });
  it("never activates corrupt data", async () => {
    corrupt = true;
    await expect(
      storage.prepare("classification", new AbortController().signal),
    ).rejects.toThrow("vérification");
    expect(await storage.installed("classification")).toBe(false);
  });
  it("rejects an already cancelled operation before downloading", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      storage.prepare("classification", controller.signal),
    ).rejects.toThrow();
    expect(range).toBeUndefined();
  });
  it("preserves unrelated data and exported packs when cleaning", async () => {
    await storage.prepare("classification", new AbortController().signal);
    await writeFile(
      join(storage.dir("classification"), "user-export.wav"),
      "keep me",
    );
    const pack = await storage.exportPack(root, new AbortController().signal);
    await storage.remove("classification");
    expect(await storage.installed("classification")).toBe(false);
    expect(
      await readFile(
        join(storage.dir("classification"), "user-export.wav"),
        "utf8",
      ),
    ).toBe("keep me");
    expect(await stat(join(pack, "classification", "model.onnx"))).toBeTruthy();
    expect(await storage.importPack(pack, new AbortController().signal)).toBe(
      1,
    );
    expect(await storage.installed("classification")).toBe(true);
  });
  it("rejects a tampered pack without replacing an installed model", async () => {
    await storage.prepare("classification", new AbortController().signal);
    const pack = await storage.exportPack(root, new AbortController().signal);
    await writeFile(join(pack, "classification", "model.onnx"), "wrong");
    await expect(
      storage.importPack(pack, new AbortController().signal),
    ).rejects.toThrow("altérée");
    expect(await storage.installed("classification")).toBe(true);
  });
  it("keeps already valid files unchanged when importing the same pack again", async () => {
    await storage.prepare("classification", new AbortController().signal);
    const pack = await storage.exportPack(root, new AbortController().signal);
    const file = storage.path("classification", "model.onnx");
    const old = new Date("2000-01-01T00:00:00Z");
    await utimes(file, old, old);
    await storage.importPack(pack, new AbortController().signal);
    expect((await stat(file)).mtime.getTime()).toBe(old.getTime());
  });
});
