import { useEffect, useState } from "react";

const PREFIX = "bench-tool:";
export const BENCH_DATA_KEYS = ["samples", "reagents", "buffers", "logs", "gels", "safety"] as const;

export type BenchDataKey = (typeof BENCH_DATA_KEYS)[number];
export type BenchData = Partial<Record<BenchDataKey, unknown>>;
export type BackupSaveResult = "shared" | "downloaded";

export function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function usePersistentState<T>(key: string, initialValue: T) {
  const storageKey = `${PREFIX}${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      return stored ? (JSON.parse(stored) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (error) {
      console.warn("Could not save local bench data", error);
    }
  }, [storageKey, value]);

  return [value, setValue] as const;
}

function storageKey(key: BenchDataKey) {
  return `${PREFIX}${key}`;
}

function isBenchDataKey(key: string): key is BenchDataKey {
  return BENCH_DATA_KEYS.includes(key as BenchDataKey);
}

function readBenchDataFromStorage() {
  const data: BenchData = {};
  BENCH_DATA_KEYS.forEach((key) => {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return;
    data[key] = JSON.parse(raw);
  });
  return data;
}

export function exportBenchData(visibleData?: BenchData) {
  const data = visibleData ?? readBenchDataFromStorage();
  return {
    app: "bench-scientist-tool",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data
  };
}

export function importBenchData(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("data" in payload)) {
    throw new Error("Backup file is not a Bench Scientist Tool export.");
  }
  const data = (payload as { data: unknown }).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Backup file does not contain Bench Scientist Tool data.");
  }

  const entries = Object.entries(data).filter(([key]) => isBenchDataKey(key));
  if (entries.length === 0) {
    throw new Error("Backup file does not contain any restorable Bench Tool records.");
  }

  BENCH_DATA_KEYS.forEach((key) => {
    window.localStorage.removeItem(storageKey(key));
  });
  entries.forEach(([key, value]) => {
    window.localStorage.setItem(storageKey(key as BenchDataKey), JSON.stringify(value));
  });
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, value: unknown) {
  downloadBlob(filename, new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
}

export async function saveJsonBackup(filename: string, value: unknown): Promise<BackupSaveResult> {
  const file = new File([JSON.stringify(value, null, 2)], filename, { type: "application/json" });
  const shareData = {
    title: "Bench Tool backup",
    text: "Save this JSON backup to iCloud Drive or Files.",
    files: [file]
  };

  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share(shareData);
    return "shared";
  }

  downloadBlob(filename, file);
  return "downloaded";
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
