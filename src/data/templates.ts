import type { BufferRecipe, SafetyRecord, ToolDefinition } from "../types";

export const TOOLS: ToolDefinition[] = [
  { id: "dilution", group: "calc", title: "Dilution and Molarity", shortTitle: "Dilution" },
  { id: "mastermix", group: "calc", title: "Master Mix Builder", shortTitle: "Mix" },
  { id: "buffers", group: "calc", title: "Buffer and Media", shortTitle: "Buffers" },
  { id: "qpcr", group: "calc", title: "qPCR Helper", shortTitle: "qPCR" },
  { id: "cells", group: "calc", title: "Cell Culture", shortTitle: "Cells" },
  { id: "units", group: "calc", title: "Unit Converter", shortTitle: "Units" },
  { id: "samples", group: "samples", title: "Sample Tracker", shortTitle: "Samples" },
  { id: "inventory", group: "samples", title: "Reagent Inventory", shortTitle: "Inventory" },
  { id: "logs", group: "notes", title: "Experiment Run Log", shortTitle: "Log" },
  { id: "gels", group: "notes", title: "Gel and Blot Capture", shortTitle: "Gels" },
  { id: "safety", group: "safety", title: "Safety Quick Reference", shortTitle: "Safety" }
];

export const DEFAULT_BUFFERS: BufferRecipe[] = [
  {
    id: "buffer-pbs",
    name: "1x PBS",
    targetVolumeMl: 500,
    notes: "Adjust pH to lab standard before final volume.",
    components: [
      { id: "c1", name: "NaCl", amountPerLiter: 8, unit: "g" },
      { id: "c2", name: "KCl", amountPerLiter: 0.2, unit: "g" },
      { id: "c3", name: "Na2HPO4", amountPerLiter: 1.44, unit: "g" },
      { id: "c4", name: "KH2PO4", amountPerLiter: 0.24, unit: "g" }
    ]
  },
  {
    id: "buffer-tae",
    name: "50x TAE",
    targetVolumeMl: 1000,
    notes: "Dilute to 1x for gels and running buffer.",
    components: [
      { id: "c1", name: "Tris base", amountPerLiter: 242, unit: "g" },
      { id: "c2", name: "Glacial acetic acid", amountPerLiter: 57.1, unit: "mL" },
      { id: "c3", name: "0.5 M EDTA pH 8.0", amountPerLiter: 100, unit: "mL" }
    ]
  },
  {
    id: "buffer-lb",
    name: "LB broth",
    targetVolumeMl: 1000,
    notes: "Autoclave before use.",
    components: [
      { id: "c1", name: "Tryptone", amountPerLiter: 10, unit: "g" },
      { id: "c2", name: "Yeast extract", amountPerLiter: 5, unit: "g" },
      { id: "c3", name: "NaCl", amountPerLiter: 10, unit: "g" }
    ]
  }
];

export const DEFAULT_SAFETY: SafetyRecord[] = [
  {
    id: "safe-etbr",
    name: "Ethidium bromide",
    hazard: "Mutagen; avoid skin contact and aerosol generation.",
    ppe: "Lab coat, nitrile gloves, eye protection.",
    waste: "Use designated EtBr solid/liquid waste.",
    sdsUrl: "",
    notes: "Check local policy for gels, buffers, and contaminated tips."
  },
  {
    id: "safe-pfa",
    name: "Paraformaldehyde",
    hazard: "Toxic fixative; irritant vapors.",
    ppe: "Work in hood, lab coat, gloves, eye protection.",
    waste: "Collect as hazardous chemical waste.",
    sdsUrl: "",
    notes: "Label fresh fixative with concentration and prep date."
  },
  {
    id: "safe-ln2",
    name: "Liquid nitrogen",
    hazard: "Cryogenic burn and asphyxiation risk.",
    ppe: "Cryo gloves, face shield, lab coat.",
    waste: "Vent only in approved areas.",
    sdsUrl: "",
    notes: "Never seal liquid nitrogen in a closed container."
  }
];
