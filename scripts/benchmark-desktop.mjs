import { _electron as electron } from "playwright";
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const registry = JSON.parse(
  await readFile("resources/models.lock.json", "utf8"),
);
const root = resolve(".test-data", `benchmark-${Date.now()}`);
for (const spec of registry.modules) {
  await mkdir(join(root, spec.id), { recursive: true });
  for (const file of spec.files)
    await copyFile(
      join("resources/registry-downloads", `${spec.id}-${file.file}`),
      join(root, spec.id, file.file),
    );
}
const env = { ...process.env, ATELIER_DATA_DIR: root };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ["."], env, timeout: 60000 });
const page = await app.firstWindow();
const observations = [];
page.on("console", (message) => {
  if (message.text().startsWith("BENCH")) console.log(message.text());
});
app.on("window", (engine) =>
  engine.on("console", (message) => {
    if (message.type() === "error")
      console.log("ENGINE", message.text().slice(0, 250));
  }),
);
try {
  await page.waitForFunction(() => !!window.atelier);
  await page.evaluate(() =>
    window.atelier.onProgress((progress) =>
      console.log("BENCH", Date.now(), progress.message),
    ),
  );
  for (const id of ["classification", "ocr", "speech", "ocr"]) {
    const start = Date.now();
    const prepared = await page.evaluate(
      (id) => window.atelier.prepare(id),
      id,
    );
    const status = await page.evaluate(() => window.atelier.status());
    const state = status.ok
      ? status.value.find((state) => state.id === id)
      : null;
    observations.push({
      id,
      elapsedMs: Date.now() - start,
      ok: prepared.ok,
      error: prepared.error,
      measurement: state?.measurement,
    });
    console.log(JSON.stringify(observations.at(-1), null, 2));
  }
  await writeFile(
    "docs/evidence/benchmark.json",
    JSON.stringify(observations, null, 2),
  );
} finally {
  await app.close();
}
