import { describe, expect, it } from "vitest";
import {
  bufferAmountForVolume,
  cellsPerMl,
  convertUnit,
  deltaDeltaCt,
  dilutionVolume,
  massForMolarity,
  molarityFromMass,
  masterMixTotal,
  parseChamberCounts,
  rcfFromRpm,
  rpmFromRcf,
  serialDilution,
  viabilityPercent
} from "./calculations";

describe("bench calculations", () => {
  it("calculates C1V1 dilution volumes", () => {
    expect(dilutionVolume(100, 1, 100)).toEqual({
      stockVolume: 1,
      diluentVolume: 99,
      possible: true
    });
    expect(dilutionVolume(convertUnit(100, "uM", "M"), convertUnit(1, "uM", "M"), 100).stockVolume).toBeCloseTo(1);
  });

  it("flags impossible dilutions", () => {
    const result = dilutionVolume(1, 10, 100);
    expect(result.stockVolume).toBe(1000);
    expect(result.possible).toBe(false);
  });

  it("converts mass and molarity", () => {
    expect(molarityFromMass(10, 500, 1)).toBeCloseTo(0.02);
    expect(massForMolarity(0.02, 500, 1)).toBeCloseTo(10);
    expect(convertUnit(molarityFromMass(convertUnit(10000, "ug", "mg"), 500, convertUnit(1000, "uL", "mL")), "M", "mM")).toBeCloseTo(20);
  });

  it("builds serial dilution concentrations", () => {
    expect(serialDilution(100, 10, 3)).toEqual([
      { step: 1, concentration: 10 },
      { step: 2, concentration: 1 },
      { step: 3, concentration: 0.1 }
    ]);
  });

  it("calculates delta delta Ct fold change", () => {
    const result = deltaDeltaCt(22, 18, 24, 18);
    expect(result.ddCt).toBe(-2);
    expect(result.foldChange).toBe(4);
    expect(deltaDeltaCt(22, 18, 24, 18, 90).foldChange).toBeCloseTo(3.61);
  });

  it("calculates cell concentration and viability", () => {
    expect(parseChamberCounts("84, 78 91,87")).toEqual([84, 78, 91, 87]);
    expect(cellsPerMl([84, 78, 91, 87], 2)).toBeCloseTo(1700000);
    expect(viabilityPercent(340, 10)).toBeCloseTo(97.1428);
  });

  it("converts units and centrifuge values", () => {
    expect(convertUnit(1, "mg", "ug")).toBeCloseTo(1000);
    const rcf = rcfFromRpm(12000, 7);
    expect(rcf).toBeCloseTo(11269.44);
    expect(rpmFromRcf(rcf, 7)).toBeCloseTo(12000);
  });

  it("normalizes master mix and buffer units", () => {
    expect(masterMixTotal(convertUnit(500, "nL", "uL"), 10, 10)).toBeCloseTo(5.5);
    expect(bufferAmountForVolume(8, 500, "mL")).toBeCloseTo(4);
    expect(bufferAmountForVolume(8, 0.5, "L")).toBeCloseTo(4);
  });
});
