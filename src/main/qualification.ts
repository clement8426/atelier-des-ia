import type { Measurement } from "../shared/types";
export type QualificationContext = Pick<
  Measurement,
  "appVersion" | "modelRevision" | "runtime" | "platform" | "machineFingerprint"
>;
export function measurementMatches(
  value: unknown,
  expected: QualificationContext,
): value is Measurement {
  if (!value || typeof value !== "object") return false;
  const measurement = value as Partial<Measurement>;
  for (const key of Object.keys(expected) as (keyof QualificationContext)[])
    if (measurement[key] !== expected[key]) return false;
  for (const key of [
    "loadMs",
    "inferenceMs",
    "totalMs",
    "peakAppMb",
  ] as const) {
    const number = measurement[key];
    if (typeof number !== "number" || !Number.isFinite(number) || number < 0)
      return false;
  }
  return (
    typeof measurement.passed === "boolean" &&
    typeof measurement.at === "string" &&
    Number.isFinite(Date.parse(measurement.at))
  );
}
