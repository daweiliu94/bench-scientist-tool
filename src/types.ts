export type ToolId =
  | "dilution"
  | "mastermix"
  | "samples"
  | "buffers"
  | "qpcr"
  | "cells"
  | "logs"
  | "inventory"
  | "gels"
  | "units"
  | "safety";

export type ToolGroup = "calc" | "samples" | "notes" | "safety";

export interface ToolDefinition {
  id: ToolId;
  group: ToolGroup;
  title: string;
  shortTitle: string;
}

export interface SampleRecord {
  id: string;
  name: string;
  type: string;
  location: string;
  box: string;
  position: string;
  date: string;
  freezeThaw: number;
  notes: string;
}

export interface ReagentRecord {
  id: string;
  name: string;
  vendor: string;
  catalog: string;
  lot: string;
  location: string;
  expiration: string;
  quantity: number;
  lowAt: number;
  unit: string;
  notes: string;
}

export interface BufferRecipe {
  id: string;
  name: string;
  targetVolumeMl: number;
  components: BufferComponent[];
  notes: string;
}

export interface BufferComponent {
  id: string;
  name: string;
  amountPerLiter: number;
  unit: string;
}

export interface ExperimentLog {
  id: string;
  title: string;
  project: string;
  startedAt: string;
  notes: string;
  photos: PhotoAttachment[];
}

export interface GelRecord {
  id: string;
  title: string;
  date: string;
  ladder: string;
  notes: string;
  image: string;
  lanes: LaneAnnotation[];
}

export interface PhotoAttachment {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: string;
}

export interface LaneAnnotation {
  id: string;
  label: string;
  xPercent: number;
}

export interface SafetyRecord {
  id: string;
  name: string;
  hazard: string;
  ppe: string;
  waste: string;
  sdsUrl: string;
  notes: string;
}
