import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, copyFile, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import type { ModelSpec } from "../../src/shared/types";
const registry = JSON.parse(
  await readFile(
    new URL("../../resources/models.lock.json", import.meta.url),
    "utf8",
  ),
) as { modules: ModelSpec[] };

test("real local models, offline operation, cancellation and cleanup", async () => {
  test.setTimeout(300_000);
  const data = resolve(".test-data", `desktop-${Date.now()}`);
  await mkdir(data, { recursive: true });
  await mkdir("docs/evidence", { recursive: true });
  // OCR and voice fixtures were fetched from the same pinned registry by the maintenance script.
  // Classification is deliberately absent: exercise the real first-download path in the app.
  for (const spec of registry.modules.filter(
    (item) => item.id !== "classification",
  )) {
    await mkdir(join(data, spec.id), { recursive: true });
    for (const file of spec.files)
      await copyFile(
        resolve("resources/registry-downloads", `${spec.id}-${file.file}`),
        join(data, spec.id, file.file),
      );
  }
  let app: ElectronApplication | undefined;
  const logs: string[] = [];
  try {
    const env = {
      ...process.env,
      ATELIER_DATA_DIR: data,
      ATELIER_TEST_PROFILE: join(data, "profile"),
    } as Record<string, string>;
    delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({ args: ["."], env, timeout: 60_000 });
    app.on("window", (page) => {
      page.on("console", (message) => {
        if (message.type() === "error") logs.push(message.text());
      });
      page.on("pageerror", (error) => logs.push(error.message));
    });
    const page = await app.firstWindow();
    page.on("pageerror", (error) => logs.push(error.message));
    const awaitIdle = async () => {
      await expect(page.locator(".task-banner")).toHaveCount(0, {
        timeout: 100_000,
      });
      const alert = page.getByRole("alert");
      if (await alert.count())
        throw new Error(`Application: ${await alert.first().innerText()}`);
    };
    await expect(
      page.getByRole("heading", { name: "Ouvrez la boîte noire." }),
    ).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: "docs/evidence/home-1440.png",
      fullPage: true,
    });
    const isolation = await page.evaluate(() => ({
      require: typeof (globalThis as Record<string, unknown>).require,
      process: typeof (globalThis as Record<string, unknown>).process,
      keys: Object.keys(window.atelier),
    }));
    expect(isolation.require).toBe("undefined");
    expect(isolation.process).toBe("undefined");
    expect(isolation.keys).not.toContain("send");
    const invalid = await page.evaluate(() =>
      window.atelier.run({ id: "classification", sample: "../../secret" }),
    );
    expect(invalid.ok).toBe(false);
    await page
      .getByRole("button", { name: "Essayer : Que voit l’IA ?" })
      .click();
    await page
      .getByRole("button", { name: "Télécharger et tester", exact: true })
      .click();
    await expect(page.locator(".task-banner")).toBeVisible();
    await page.screenshot({
      path: "docs/evidence/loading-1440.png",
      fullPage: true,
    });
    await awaitIdle();
    await expect(
      page.getByRole("button", { name: "Analyser l’image", exact: true }),
    ).toBeEnabled({ timeout: 90_000 });
    await page
      .getByRole("button", { name: "Analyser l’image", exact: true })
      .click();
    await expect(page.locator(".prediction.first")).toContainText(/Labrador/i, {
      timeout: 60_000,
    });
    await page.screenshot({
      path: "docs/evidence/classification-1440.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Un chat", exact: true }).click();
    await expect(page.locator(".predictions")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Analyser l’image", exact: true })
      .click();
    await expect(page.locator(".prediction.first")).toContainText(/Chat|cat/i, {
      timeout: 60_000,
    });
    // Simulate unavailable Internet for the actual inference/download processes.
    await app.evaluate(({ session }) =>
      session.defaultSession.webRequest.onBeforeRequest(
        { urls: ["http://*/*", "https://*/*"] },
        (_details, callback) => callback({ cancel: true }),
      ),
    );
    await app.evaluate(() => {
      globalThis.fetch = async () => {
        throw new Error(
          "Network intentionally unavailable during offline inference test",
        );
      };
    });
    await page.getByRole("button", { name: "Un coup de main ?" }).click();
    await expect(
      page.getByRole("heading", { name: "Un petit coup de main." }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Explorer les IA", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Essayer : Lire dans une image" })
      .click();
    await page
      .getByRole("button", { name: "Tester cet atelier", exact: true })
      .click();
    await awaitIdle();
    await expect(
      page.getByRole("button", { name: "Extraire le texte", exact: true }),
    ).toBeEnabled({ timeout: 90_000 });
    await page
      .getByRole("button", { name: "Extraire le texte", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", {
        name: "Texte extrait, sélectionnable et copiable",
      }),
    ).toHaveValue(/Bonjour/i, { timeout: 90_000 });
    await page.screenshot({
      path: "docs/evidence/ocr-1440.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Un ticket", exact: true }).click();
    await page
      .getByRole("button", { name: "Extraire le texte", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", {
        name: "Texte extrait, sélectionnable et copiable",
      }),
    ).toHaveValue(/9[.,]70/, { timeout: 60_000 });
    await page.getByRole("button", { name: "Atelier suivant" }).click();
    await page
      .getByRole("button", { name: "Tester cet atelier", exact: true })
      .click();
    await awaitIdle();
    await expect(
      page.getByRole("button", { name: "Créer la voix", exact: true }),
    ).toBeEnabled({ timeout: 90_000 });
    await page
      .getByRole("button", { name: "Créer la voix", exact: true })
      .click();
    await expect(page.locator("audio")).toBeVisible({ timeout: 90_000 });
    const audio = await page
      .locator("audio")
      .evaluate(async (element: HTMLAudioElement) => {
        const blob = await fetch(element.src).then((response) =>
          response.arrayBuffer(),
        );
        return {
          size: blob.byteLength,
          signature: new TextDecoder().decode(blob.slice(0, 4)),
        };
      });
    expect(audio.size).toBeGreaterThan(10_000);
    expect(audio.signature).toBe("RIFF");
    await page.screenshot({
      path: "docs/evidence/speech-1440.png",
      fullPage: true,
    });
    // Forcefully close the isolated engine during a real operation, then immediately recover.
    const operation = page.evaluate(() =>
      window.atelier.run({ id: "speech", text: "Un test de voix à annuler." }),
    );
    await page.waitForTimeout(350);
    await page.evaluate(() => window.atelier.cancel());
    expect((await operation).ok).toBe(false);
    const processCounts: number[] = [];
    for (let i = 0; i < 10; i++) {
      const repetition = await page.evaluate(() =>
        window.atelier.run({ id: "classification", sample: "dog" }),
      );
      expect(repetition.ok).toBe(true);
      processCounts.push(
        await app.evaluate(
          ({ app }) =>
            app.getAppMetrics().filter((metric) => metric.type === "Tab")
              .length,
        ),
      );
    }
    await expect
      .poll(() =>
        app!.evaluate(
          ({ app }) =>
            app.getAppMetrics().filter((metric) => metric.type === "Tab")
              .length,
        ),
      )
      .toBe(1);
    await writeFile(
      "docs/evidence/process-lifecycle.json",
      JSON.stringify(
        { repetitions: 10, processCounts, finalRendererCount: 1 },
        null,
        2,
      ),
    );
    const measurement = await page.evaluate(async () => {
      const response = await window.atelier.status();
      return response.ok
        ? response.value.map((item) => ({ id: item.id, ...item.measurement }))
        : [];
    });
    await writeFile(
      "docs/evidence/measurements.json",
      JSON.stringify(measurement, null, 2),
    );
    await page
      .getByRole("button", { name: "Explorer les IA", exact: true })
      .click();
    await page.setViewportSize({ width: 900, height: 720 });
    await page.screenshot({
      path: "docs/evidence/home-900.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => document.activeElement?.tagName !== "BODY"),
    ).toBe(true);
    const axe = await new AxeBuilder({ page })
      .setLegacyMode()
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    await writeFile(
      "docs/evidence/accessibility.json",
      JSON.stringify(axe.violations, null, 2),
    );
    expect(axe.violations).toEqual([]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page
        .locator(".workshop-card")
        .first()
        .evaluate((element) => getComputedStyle(element).transitionDuration),
    ).toBe("0s");
    await page.setViewportSize({ width: 600, height: 800 });
    await page.screenshot({
      path: "docs/evidence/home-600.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Préparer ma séance", exact: true })
      .click();
    await page.setViewportSize({ width: 1440, height: 900 });
    // Only native folder selection is stubbed; pack creation/import use the real IPC and real files.
    const packParent = join(data, "export");
    await mkdir(packParent);
    await app.evaluate(({ dialog }, directory) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [directory],
      });
    }, packParent);
    await page
      .getByRole("button", { name: "Créer un pack", exact: true })
      .click();
    await expect(page.getByText(/^Pack créé/)).toBeVisible({ timeout: 30_000 });
    await page.screenshot({
      path: "docs/evidence/prepare-1440.png",
      fullPage: true,
    });
    await page
      .getByRole("button", {
        name: "Supprimer les ressources : Que voit l’IA ?",
      })
      .click();
    await page.getByRole("button", { name: "Supprimer", exact: true }).click();
    await expect(
      page.getByText("Les ressources de cet atelier ont été supprimées."),
    ).toBeVisible();
    const states = await page.evaluate(() => window.atelier.status());
    expect(
      states.ok &&
        states.value.find((item) => item.id === "classification")?.installed,
    ).toBe(false);
    expect(
      states.ok && states.value.find((item) => item.id === "ocr")?.installed,
    ).toBe(true);
    await page.screenshot({
      path: "docs/evidence/partial-1440.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Explorer les IA", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Essayer : Que voit l’IA ?" })
      .click();
    await page
      .getByRole("button", { name: "Télécharger et tester", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Vérifiez votre connexion",
      { timeout: 15_000 },
    );
    await page.screenshot({
      path: "docs/evidence/error-1440.png",
      fullPage: true,
    });
    const { readdir } = await import("node:fs/promises");
    const pack = join(packParent, (await readdir(packParent))[0]);
    await app.evaluate(({ dialog }, directory) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [directory],
      });
    }, pack);
    await page
      .getByRole("button", { name: "Préparer ma séance", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Importer un pack", exact: true })
      .click();
    await expect(page.getByText(/^3 atelier\(s\) importé/)).toBeVisible({
      timeout: 30_000,
    });
    const imported = await page.evaluate(() => window.atelier.status());
    expect(
      imported.ok &&
        imported.value.find((item) => item.id === "classification")?.installed,
    ).toBe(true);
    expect(
      imported.ok &&
        imported.value.find((item) => item.id === "classification")
          ?.measurement,
    ).toBeUndefined();
    const a11yPages = [
      "Préparer ma séance",
      "Mon ordinateur",
      "Un coup de main ?",
    ];
    const findings = [];
    for (const name of a11yPages) {
      await page.getByRole("button", { name, exact: true }).click();
      const scan = await new AxeBuilder({ page })
        .setLegacyMode()
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      findings.push({ page: name, violations: scan.violations });
    }
    for (const name of [
      "Que voit l’IA ?",
      "Lire dans une image",
      "Donner de la voix",
    ]) {
      await page
        .getByRole("button", { name: "Explorer les IA", exact: true })
        .click();
      await page
        .getByRole("button", { name: `Essayer : ${name}`, exact: true })
        .click();
      const scan = await new AxeBuilder({ page })
        .setLegacyMode()
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      findings.push({ page: name, violations: scan.violations });
    }
    await writeFile(
      "docs/evidence/accessibility-pages.json",
      JSON.stringify(findings, null, 2),
    );
    expect(
      findings
        .flatMap((result) => result.violations)
        .map((item) => ({
          id: item.id,
          nodes: item.nodes.map((node) => node.target),
        })),
    ).toEqual([]);
    await writeFile(
      "docs/evidence/console.json",
      JSON.stringify(logs, null, 2),
    );
    expect(logs).toEqual([]);
  } finally {
    await writeFile(
      "docs/evidence/console.json",
      JSON.stringify(logs, null, 2),
    );
    if (app) {
      const pages = app.windows();
      if (pages[0] && !pages[0].isClosed())
        await pages[0]
          .screenshot({ path: "docs/evidence/last-state.png", fullPage: true })
          .catch(() => {});
      await app.close();
    }
  }
});
