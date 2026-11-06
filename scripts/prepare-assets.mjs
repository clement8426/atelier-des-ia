import {
  mkdir,
  copyFile,
  readdir,
  readFile,
  writeFile,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
await mkdir("public/runtime", { recursive: true });
const ortFiles = [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
];
for (const name of await readdir("public/runtime"))
  if (name.startsWith("ort") && !ortFiles.includes(name))
    await rm(join("public/runtime", name));
for (const name of ortFiles)
  await copyFile(
    join("node_modules/onnxruntime-web/dist", name),
    join("public/runtime", name),
  );
for (const name of await readdir(
  "node_modules/@diffusionstudio/piper-wasm/build",
))
  await copyFile(
    join("node_modules/@diffusionstudio/piper-wasm/build", name),
    join("public/runtime", name),
  );
// Runtime assets are built from lockfile-pinned packages, never loaded from a CDN at runtime.
console.log("Moteurs locaux copiés depuis les dépendances verrouillées.");
await mkdir("resources/licenses", { recursive: true });
const packages = [
  "react",
  "react-dom",
  "scheduler",
  "lucide-react",
  "onnxruntime-web",
  "onnxruntime-common",
  "@paddleocr/paddleocr-js",
  "@techstark/opencv-js",
  "clipper-lib",
  "js-yaml",
  "@diffusionstudio/piper-wasm",
  "electron",
];
for (const name of packages) {
  const directory = join("node_modules", name);
  const files = await readdir(directory);
  for (const file of files.filter((file) =>
    /^(licen[cs]e|copying|notice)/i.test(file),
  )) {
    const target = join(
      "resources/licenses",
      name.replaceAll("/", "--") + "--" + file,
    );
    try {
      await copyFile(join(directory, file), target);
    } catch (error) {
      if (error.code !== "EISDIR") throw error;
    }
  }
  await writeFile(
    join("resources/licenses", name.replaceAll("/", "--") + "--metadata.json"),
    await readFile(join(directory, "package.json")),
  );
}
