import { describe, it, expect } from "vitest";
import { measurementMatches } from "../../src/main/qualification";
const context = {
  appVersion: "0.1",
  modelRevision: "model-A",
  runtime: "wasm-A",
  platform: "win32 x64",
  machineFingerprint: "computer-A",
};
const measurement = {
  ...context,
  at: "2026-11-06T12:00:00Z",
  loadMs: 800,
  inferenceMs: 100,
  totalMs: 1000,
  peakAppMb: 800,
  passed: true,
};
describe("local qualification records", () => {
  it("keeps a valid record for the exact tested configuration", () =>
    expect(measurementMatches(measurement, context)).toBe(true));
  it("invalidates a copied record on another computer even with the same OS", () =>
    expect(
      measurementMatches(measurement, {
        ...context,
        machineFingerprint: "computer-B",
      }),
    ).toBe(false));
  it("invalidates older records without a machine fingerprint", () =>
    expect(
      measurementMatches(
        { ...measurement, machineFingerprint: undefined },
        context,
      ),
    ).toBe(false));
  it("rejects corrupt metrics and different model/runtime versions", () => {
    expect(
      measurementMatches({ ...measurement, inferenceMs: Infinity }, context),
    ).toBe(false);
    expect(
      measurementMatches({ ...measurement, modelRevision: "model-B" }, context),
    ).toBe(false);
    expect(
      measurementMatches({ ...measurement, runtime: "wasm-B" }, context),
    ).toBe(false);
  });
});
