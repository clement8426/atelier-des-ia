import * as ort from "onnxruntime-web/wasm";
import type { RunInput, Prediction } from "../../shared/types";
import { sampleFiles } from "../../shared/catalog";
import labels from "../../shared/data/labels.json";

const local = (path: string) => new URL(path, window.location.href).href;
const model = (id: string, file: string) => `atelier://models/${id}/${file}`;
ort.env.wasm.wasmPaths = local("/runtime/");
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
const progress = (message: string, phase: "load" | "compute" = "load") =>
  window.engine.progress({ message, phase });
async function bytes(url: string) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(
      "Ressource locale manquante. Préparez cet atelier à nouveau.",
    );
  return response.arrayBuffer();
}
const now = () => performance.now();

// Ustar archive required by PaddleOCR.js. No extraction on the filesystem.
function tar(files: { name: string; bytes: Uint8Array }[]) {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const set = (header: Uint8Array, offset: number, value: string) =>
    header.set(encoder.encode(value), offset);
  for (const file of files) {
    const header = new Uint8Array(512);
    set(header, 0, file.name);
    set(header, 100, "0000644\0");
    set(header, 108, "0000000\0");
    set(header, 116, "0000000\0");
    set(header, 124, file.bytes.length.toString(8).padStart(11, "0") + "\0");
    set(header, 136, "00000000000\0");
    header.fill(32, 148, 156);
    header[156] = 48;
    set(header, 257, "ustar\0");
    set(header, 263, "00");
    set(
      header,
      148,
      header
        .reduce((sum, value) => sum + value, 0)
        .toString(8)
        .padStart(6, "0") + "\0 ",
    );
    parts.push(
      header,
      file.bytes,
      new Uint8Array((512 - (file.bytes.length % 512)) % 512),
    );
  }
  parts.push(new Uint8Array(1024));
  return new Blob(parts as BlobPart[], { type: "application/x-tar" });
}
async function classify(input: RunInput) {
  progress("Le modèle de vision se réveille…");
  const start = now();
  const session = await ort.InferenceSession.create(
    await bytes(model("classification", "model.onnx")),
    { executionProviders: ["wasm"] },
  );
  const bitmap = await createImageBitmap(
    new Blob([await bytes(local(`/samples/${sampleFiles[input.sample!]}`))]),
  );
  const canvas = new OffscreenCanvas(224, 224);
  const context = canvas.getContext("2d")!;
  const scale = 256 / Math.min(bitmap.width, bitmap.height);
  const sourceSize = 224 / scale;
  context.drawImage(
    bitmap,
    (bitmap.width - sourceSize) / 2,
    (bitmap.height - sourceSize) / 2,
    sourceSize,
    sourceSize,
    0,
    0,
    224,
    224,
  );
  bitmap.close();
  const rgba = context.getImageData(0, 0, 224, 224).data;
  const data = new Float32Array(3 * 224 * 224);
  const mean = [0.485, 0.456, 0.406],
    std = [0.229, 0.224, 0.225];
  for (let c = 0; c < 3; c++)
    for (let i = 0; i < 224 * 224; i++)
      data[c * 224 * 224 + i] = (rgba[i * 4 + c] / 255 - mean[c]) / std[c];
  const loaded = now();
  progress("L’IA compare les catégories…", "compute");
  const result = await session.run({
    [session.inputNames[0]]: new ort.Tensor("float32", data, [1, 3, 224, 224]),
  });
  const scores = Array.from(
    result[session.outputNames[0]].data as Float32Array,
  );
  const max = Math.max(...scores);
  const denominator = scores.reduce(
    (sum, score) => sum + Math.exp(score - max),
    0,
  );
  const predictions: Prediction[] = scores
    .map((score, index) => ({
      index,
      label: (labels as Record<string, string>)[index] ?? `Catégorie ${index}`,
      score: Math.exp(score - max) / denominator,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const finished = now();
  await session.release();
  return {
    output: { predictions },
    loadMs: loaded - start,
    inferenceMs: finished - loaded,
    passed:
      !input.reference ||
      predictions.slice(0, 3).some((item) => /labrador/i.test(item.label)),
  };
}
async function ocr(input: RunInput) {
  const start = now();
  progress("Les deux modèles de lecture se préparent…");
  const { PaddleOCR } = await import("@paddleocr/paddleocr-js");
  const urls: string[] = [];
  async function archive(prefix: string) {
    const files = await Promise.all(
      ["onnx", "yml"].map(async (extension) => ({
        name: `inference.${extension}`,
        bytes: new Uint8Array(
          await bytes(model("ocr", `${prefix}.${extension}`)),
        ),
      })),
    );
    const url = URL.createObjectURL(tar(files));
    urls.push(url);
    return url;
  }
  const runner = await PaddleOCR.create({
    textDetectionModelName: "PP-OCRv6_tiny_det",
    textRecognitionModelName: "PP-OCRv6_tiny_rec",
    textDetectionModelAsset: { url: await archive("det") },
    textRecognitionModelAsset: { url: await archive("rec") },
    ortOptions: {
      backend: "wasm",
      wasmPaths: local("/runtime/"),
      numThreads: 1,
      proxy: false,
    },
    textDetectionBatchSize: 1,
    textRecognitionBatchSize: 1,
  });
  const loaded = now();
  progress("L’IA repère et lit les lignes…", "compute");
  try {
    const image = new Blob(
      [await bytes(local(`/samples/${sampleFiles[input.sample!]}`))],
      { type: "image/png" },
    );
    const [result] = await runner.predict(image, {
      textDetLimitSideLen: 960,
      textDetLimitType: "max",
    });
    const text = result.items.map((item) => item.text).join("\n");
    return {
      output: { text, lines: result.items.length },
      loadMs: loaded - start,
      inferenceMs: now() - loaded,
      passed:
        !input.reference || (/bonjour/i.test(text) && /atelier/i.test(text)),
    };
  } finally {
    await runner.dispose();
    urls.forEach((url) => URL.revokeObjectURL(url));
  }
}
function wav(pcm: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + pcm.length * 2),
    view = new DataView(buffer);
  const string = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  };
  string(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  string(8, "WAVE");
  string(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  string(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++)
    view.setInt16(
      44 + i * 2,
      Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767),
      true,
    );
  return Array.from(new Uint8Array(buffer));
}
async function speech(input: RunInput) {
  const start = now();
  progress("La voix française se prépare…");
  const config = JSON.parse(
    new TextDecoder().decode(await bytes(model("speech", "voice.json"))),
  );
  const ids = await new Promise<number[]>((resolve, reject) => {
    window
      .createPiperPhonemize({
        print: (data: string) => {
          try {
            resolve(JSON.parse(data).phoneme_ids);
          } catch {
            reject(
              new Error(
                "La phrase n’a pas pu être prononcée. Essayez une phrase plus simple.",
              ),
            );
          }
        },
        printErr: () => {
          /* Emscripten diagnostic noise; fatal initialization errors reject below. */
        },
        locateFile: (name: string) => local(`/runtime/${name}`),
      })
      .then((module) =>
        module.callMain([
          "-l",
          config.espeak.voice,
          "--input",
          JSON.stringify([{ text: input.text!.trim() }]),
          "--espeak_data",
          "/espeak-ng-data",
        ]),
      )
      .catch(reject);
  });
  const session = await ort.InferenceSession.create(
    await bytes(model("speech", "voice.onnx")),
    { executionProviders: ["wasm"] },
  );
  const loaded = now();
  progress("L’IA transforme votre phrase en voix…", "compute");
  try {
    const feeds: Record<string, ort.Tensor> = {
      input: new ort.Tensor("int64", BigInt64Array.from(ids.map(BigInt)), [
        1,
        ids.length,
      ]),
      input_lengths: new ort.Tensor(
        "int64",
        BigInt64Array.from([BigInt(ids.length)]),
        [1],
      ),
      scales: new ort.Tensor(
        "float32",
        Float32Array.from([
          config.inference.noise_scale,
          config.inference.length_scale,
          config.inference.noise_w,
        ]),
        [3],
      ),
    };
    if (session.inputNames.includes("sid"))
      feeds.sid = new ort.Tensor("int64", BigInt64Array.from([0n]), [1]);
    const result = await session.run(feeds);
    const pcm = result[session.outputNames[0]].data as Float32Array;
    const inferenceMs = now() - loaded;
    const valid =
      pcm.length > config.audio.sample_rate / 2 &&
      pcm.every(Number.isFinite) &&
      pcm.some((v) => Math.abs(v) > 0.001);
    return {
      output: { audio: wav(pcm, config.audio.sample_rate) },
      loadMs: loaded - start,
      inferenceMs,
      passed: valid,
    };
  } finally {
    await session.release();
  }
}
window.engine.onRun(async (input) => {
  try {
    window.engine.finish(
      await { classification: classify, ocr, speech }[input.id](input),
    );
  } catch (error) {
    console.error("Moteur local :", error);
    window.engine.finish({
      error: `Le calcul local a échoué. ${error instanceof Error ? error.message.slice(0, 300) : "Réessayez ou préparez à nouveau cet atelier."}`,
    });
  }
});
window.engine.ready();
