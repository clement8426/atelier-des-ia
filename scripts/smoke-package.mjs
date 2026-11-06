import { _electron as electron } from "playwright";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { listPackage } from "@electron/asar";
const root = resolve("release/0.1.0/win-unpacked");
const files = listPackage(join(root, "resources/app.asar"));
if (
  files.some(
    (file) =>
      file.includes("registry-downloads") ||
      file.includes(".test-data") ||
      file.includes("node_modules"),
  )
)
  throw new Error("Development assets leaked into package");
const registry = JSON.parse(
  await readFile("resources/models.lock.json", "utf8"),
);
const pack = resolve(".test-data/package-smoke-pack");
for (const spec of registry.modules) {
  await mkdir(join(pack, spec.id), { recursive: true });
  for (const file of spec.files)
    await copyFile(
      join("resources/registry-downloads", `${spec.id}-${file.file}`),
      join(pack, spec.id, file.file),
    );
}
await writeFile(
  join(pack, "atelier-pack.json"),
  JSON.stringify({
    schema: 1,
    modules: registry.modules.map((spec) => spec.id),
  }),
);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  executablePath: join(root, "Atelier des IA.exe"),
  env,
  timeout: 60000,
});
try {
  const page = await app.firstWindow();
  await page.getByRole("heading", { name: "Ouvrez la boîte noire." }).waitFor();
  const application = await app.evaluate(({ app }) => ({
    packaged: app.isPackaged,
    version: app.getVersion(),
    platform: process.platform,
    data: app.getPath("userData"),
  }));
  if (!application.packaged)
    throw new Error("Not testing the packaged application");
  await app.evaluate(({ dialog }, directory) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [directory],
    });
  }, pack);
  const imported = await page.evaluate(() => window.atelier.importPack());
  if (!imported.ok) throw new Error(imported.error);
  await app.evaluate(({ session }) => {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*"] },
      (_details, callback) => callback({ cancel: true }),
    );
    globalThis.fetch = async () => {
      throw new Error("Network disabled for packaged smoke test");
    };
  });
  const measurements = [];
  for (const id of ["classification", "ocr", "speech"]) {
    const result = await page.evaluate((id) => window.atelier.prepare(id), id);
    if (!result.ok) throw new Error(`${id}: ${result.error}`);
    measurements.push({ id, ...result.value.measurement });
    console.log(`${id}: real packaged offline reference passed`);
  }
  await page
    .getByRole("button", { name: "Mon ordinateur", exact: true })
    .click();
  await page.getByRole("button", { name: "Actualiser", exact: true }).click();
  await page.screenshot({
    path: "docs/evidence/packaged-windows.png",
    fullPage: true,
  });
  await writeFile(
    "docs/evidence/package-smoke.json",
    JSON.stringify(
      {
        application,
        bundledFiles: files.length,
        devAssetsExcluded: true,
        measurements,
        installerTested: false,
        cleanWindowsMachineTested: false,
      },
      null,
      2,
    ),
  );
} finally {
  await app.close();
}
