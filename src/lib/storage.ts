import { useEffect, useState } from "react";

const PREFIX = "bench-tool:";

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

export function exportBenchData() {
  const data: Record<string, unknown> = {};
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(PREFIX)) continue;
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    data[key.replace(PREFIX, "")] = JSON.parse(raw);
  }
  return {
    app: "bench-scientist-tool",
    exportedAt: new Date().toISOString(),
    data
  };
}

export function importBenchData(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("data" in payload)) {
    throw new Error("Backup file is not a Bench Scientist Tool export.");
  }
  const data = (payload as { data: Record<string, unknown> }).data;
  Object.entries(data).forEach(([key, value]) => {
    window.localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
  });
}

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
