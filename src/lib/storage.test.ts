import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BENCH_DATA_KEYS, exportBenchData, importBenchData } from "./storage";

function createStorage() {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    }
  } as Storage;
}

describe("bench backup storage", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: createStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports the visible app data passed by React state", () => {
    const backup = exportBenchData({
      samples: [{ id: "sample-1", name: "Cell pellet" }],
      reagents: [],
      buffers: [{ id: "buffer-1", name: "PBS" }],
      logs: [],
      gels: [],
      safety: []
    });

    expect(backup.app).toBe("bench-scientist-tool");
    expect(backup.schemaVersion).toBe(1);
    expect(backup.data.samples).toEqual([{ id: "sample-1", name: "Cell pellet" }]);
    expect(backup.data.buffers).toEqual([{ id: "buffer-1", name: "PBS" }]);
  });

  it("round trips every visible storage bucket", () => {
    const data = Object.fromEntries(BENCH_DATA_KEYS.map((key) => [key, [{ id: `${key}-record` }]]));
    importBenchData(exportBenchData(data));

    BENCH_DATA_KEYS.forEach((key) => {
      expect(JSON.parse(window.localStorage.getItem(`bench-tool:${key}`) ?? "null")).toEqual([{ id: `${key}-record` }]);
    });
  });

  it("replaces existing visible data instead of blending it with a backup", () => {
    window.localStorage.setItem("bench-tool:samples", JSON.stringify([{ id: "old-sample" }]));
    window.localStorage.setItem("bench-tool:gels", JSON.stringify([{ id: "stale-gel" }]));
    window.localStorage.setItem("bench-tool:legacy-plan", JSON.stringify([{ id: "unused" }]));

    importBenchData({
      app: "bench-scientist-tool",
      schemaVersion: 1,
      data: {
        samples: [{ id: "restored-sample" }],
        logs: []
      }
    });

    expect(JSON.parse(window.localStorage.getItem("bench-tool:samples") ?? "null")).toEqual([{ id: "restored-sample" }]);
    expect(JSON.parse(window.localStorage.getItem("bench-tool:logs") ?? "null")).toEqual([]);
    expect(window.localStorage.getItem("bench-tool:gels")).toBeNull();
    expect(window.localStorage.getItem("bench-tool:legacy-plan")).toBe(JSON.stringify([{ id: "unused" }]));
  });
});
