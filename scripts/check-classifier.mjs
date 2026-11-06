import * as ort from "onnxruntime-web/wasm";
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
ort.env.wasm.numThreads = 1;
const labels = JSON.parse(
  await readFile("src/shared/data/labels.json", "utf8"),
);
const { data, info } = await sharp("public/samples/dog.jpg")
  .resize(256, 256, { fit: "outside" })
  .resize(224, 224, { fit: "cover" })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const input = new Float32Array(3 * 224 * 224);
const means = [0.485, 0.456, 0.406],
  stds = [0.229, 0.224, 0.225];
for (let c = 0; c < 3; c++)
  for (let i = 0; i < 224 * 224; i++)
    input[c * 224 * 224 + i] = (data[i * 3 + c] / 255 - means[c]) / stds[c];
for (const name of ["model_quantized.onnx", "model.onnx"]) {
  const response = await fetch(
    `https://huggingface.co/onnx-community/mobilenetv3_small_100.lamb_in1k/resolve/b1a19675d33130739e56503b5bfd6534a0f9e01d/onnx/${name}`,
  );
  const session = await ort.InferenceSession.create(
    await response.arrayBuffer(),
    { executionProviders: ["wasm"] },
  );
  console.log(name, session.inputNames, session.outputNames);
  const results = await session.run({
    [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, 224, 224]),
  });
  for (const [key, value] of Object.entries(results))
    console.log(
      key,
      value.dims,
      Array.from(value.data)
        .map((score, index) => ({ score, label: labels[index] }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5),
    );
  await session.release();
}
