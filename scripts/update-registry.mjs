// Maintenance only: refresh deliberately, review the diff, then rerun real inference tests.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const directory = new URL("../resources/registry-downloads/", import.meta.url);
await mkdir(directory, { recursive: true });
const specs = [
  [
    "classification",
    "MobileNetV3 Small",
    "onnx-community/mobilenetv3_small_100.lamb_in1k",
    "Apache-2.0 (timm)",
    [
      ["onnx/model.onnx", "model.onnx"],
      ["config.json", "config.json"],
      ["preprocessor_config.json", "preprocessor_config.json"],
    ],
  ],
  [
    "ocr",
    "PP-OCRv6 Tiny",
    "PaddlePaddle/PP-OCRv6_tiny_det_onnx",
    "Apache-2.0",
    [
      ["inference.onnx", "det.onnx"],
      ["inference.yml", "det.yml"],
    ],
  ],
  [
    "ocr",
    "PP-OCRv6 Tiny",
    "PaddlePaddle/PP-OCRv6_tiny_rec_onnx",
    "Apache-2.0",
    [
      ["inference.onnx", "rec.onnx"],
      ["inference.yml", "rec.yml"],
    ],
  ],
  [
    "speech",
    "Piper · Siwis",
    "rhasspy/piper-voices",
    "Voix Siwis : voir MODEL_CARD, données CC-BY-4.0",
    [
      ["fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx", "voice.onnx"],
      ["fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx.json", "voice.json"],
      ["fr/fr_FR/siwis/medium/MODEL_CARD", "MODEL_CARD"],
    ],
  ],
];
const modules = {};
for (const [id, name, repository, license, files] of specs) {
  const metaResponse = await fetch(
    `https://huggingface.co/api/models/${repository}`,
  );
  if (!metaResponse.ok)
    throw new Error(`Metadata ${repository}: ${metaResponse.status}`);
  const { sha } = await metaResponse.json();
  const entry = (modules[id] ??= { id, name, files: [] });
  for (const [sourcePath, file] of files) {
    const url = `https://huggingface.co/${repository}/resolve/${sha}/${sourcePath}`;
    const cache = new URL(`${id}-${file}`, directory);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${file}: ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    await writeFile(cache, data);
    entry.files.push({
      file,
      url,
      bytes: data.length,
      sha256: createHash("sha256").update(data).digest("hex"),
      repository,
      revision: sha,
      license,
    });
    console.log(`${id}/${file}: ${data.length} bytes`);
  }
}
await writeFile(
  new URL("../resources/models.lock.json", import.meta.url),
  JSON.stringify({ schema: 1, modules: Object.values(modules) }, null, 2) +
    "\n",
);
// Store small metadata with the app so it can explain labels before a model is downloaded.
await mkdir(new URL("../src/shared/data/", import.meta.url), {
  recursive: true,
});
const config = JSON.parse(
  await readFile(new URL("classification-config.json", directory), "utf8"),
);
await writeFile(
  new URL("../src/shared/data/labels.json", import.meta.url),
  JSON.stringify(config.id2label ?? config.label_names, null, 2),
);
