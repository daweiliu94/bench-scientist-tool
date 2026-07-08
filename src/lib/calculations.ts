export function safeNumber(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseChamberCounts(value: string) {
  return value
    .split(/[,\s]+/)
    .map(Number)
    .filter(Number.isFinite);
}

export function formatNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return "0";
  if (value === 0) return "0";
  if (Math.abs(value) >= 1000 || Math.abs(value) < 0.01) {
    return value.toExponential(2);
  }
  return Number(value.toFixed(digits)).toString();
}

export function dilutionVolume(stockConcentration: number, finalConcentration: number, finalVolume: number) {
  if (stockConcentration <= 0 || finalConcentration <= 0 || finalVolume <= 0) {
    return { stockVolume: 0, diluentVolume: 0, possible: false };
  }
  const stockVolume = (finalConcentration * finalVolume) / stockConcentration;
  return {
    stockVolume,
    diluentVolume: Math.max(finalVolume - stockVolume, 0),
    possible: stockVolume <= finalVolume
  };
}

export function molarityFromMass(massMg: number, molecularWeightGPerMol: number, volumeMl: number) {
  if (massMg <= 0 || molecularWeightGPerMol <= 0 || volumeMl <= 0) return 0;
  const grams = massMg / 1000;
  const liters = volumeMl / 1000;
  return grams / molecularWeightGPerMol / liters;
}

export function massForMolarity(molarityM: number, molecularWeightGPerMol: number, volumeMl: number) {
  if (molarityM <= 0 || molecularWeightGPerMol <= 0 || volumeMl <= 0) return 0;
  const liters = volumeMl / 1000;
  return molarityM * liters * molecularWeightGPerMol * 1000;
}

export function serialDilution(startConcentration: number, factor: number, steps: number) {
  if (startConcentration <= 0 || factor <= 0 || steps <= 0) return [];
  return Array.from({ length: steps }, (_, index) => ({
    step: index + 1,
    concentration: startConcentration / Math.pow(factor, index + 1)
  }));
}

export function masterMixTotal(perReactionVolume: number, reactions: number, overagePercent: number) {
  if (perReactionVolume <= 0 || reactions <= 0) return 0;
  return perReactionVolume * reactions * (1 + Math.max(overagePercent, 0) / 100);
}

export function bufferAmountForVolume(amountPerLiter: number, targetVolume: number, targetVolumeUnit: string) {
  if (amountPerLiter <= 0 || targetVolume <= 0) return 0;
  return amountPerLiter * convertUnit(targetVolume, targetVolumeUnit, "L");
}

export function deltaDeltaCt(targetSampleCt: number, refSampleCt: number, targetControlCt: number, refControlCt: number, efficiencyPercent = 100) {
  const sampleDelta = targetSampleCt - refSampleCt;
  const controlDelta = targetControlCt - refControlCt;
  const ddCt = sampleDelta - controlDelta;
  const amplification = Math.max(1 + efficiencyPercent / 100, 0.01);
  return {
    sampleDelta,
    controlDelta,
    ddCt,
    foldChange: Math.pow(amplification, -ddCt)
  };
}

export function cellsPerMl(liveCounts: number[], dilutionFactor: number) {
  const usable = liveCounts.filter((value) => value >= 0);
  if (usable.length === 0) return 0;
  const average = usable.reduce((sum, value) => sum + value, 0) / usable.length;
  return average * Math.max(dilutionFactor, 1) * 10000;
}

export function viabilityPercent(live: number, dead: number) {
  if (live < 0 || dead < 0 || live + dead === 0) return 0;
  return (live / (live + dead)) * 100;
}

export function seedingVolumeMl(desiredCells: number, sourceCellsPerMl: number) {
  if (desiredCells <= 0 || sourceCellsPerMl <= 0) return 0;
  return desiredCells / sourceCellsPerMl;
}

export function rcfFromRpm(rpm: number, radiusCm: number) {
  if (rpm <= 0 || radiusCm <= 0) return 0;
  return 1.118e-5 * radiusCm * rpm * rpm;
}

export function rpmFromRcf(rcf: number, radiusCm: number) {
  if (rcf <= 0 || radiusCm <= 0) return 0;
  return Math.sqrt(rcf / (1.118e-5 * radiusCm));
}

export function convertUnit(value: number, from: string, to: string) {
  const factors: Record<string, number> = {
    g: 1,
    mg: 1e-3,
    ug: 1e-6,
    ng: 1e-9,
    L: 1,
    mL: 1e-3,
    uL: 1e-6,
    nL: 1e-9,
    M: 1,
    mM: 1e-3,
    uM: 1e-6,
    nM: 1e-9,
    pM: 1e-12
  };
  if (!(from in factors) || !(to in factors)) return value;
  return (value * factors[from]) / factors[to];
}

export function celsiusToFahrenheit(celsius: number) {
  return (celsius * 9) / 5 + 32;
}

export function fahrenheitToCelsius(fahrenheit: number) {
  return ((fahrenheit - 32) * 5) / 9;
}
