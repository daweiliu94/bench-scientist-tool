import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  AlertTriangle,
  Archive,
  Beaker,
  Calculator,
  Camera,
  ChevronDown,
  ClipboardList,
  Download,
  FlaskConical,
  FolderOpen,
  Home,
  ImagePlus,
  Layers,
  NotebookPen,
  PackageSearch,
  Plus,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sigma,
  TestTube,
  Trash2,
  Upload
} from "lucide-react";
import { DEFAULT_BUFFERS, DEFAULT_SAFETY, TOOLS } from "./data/templates";
import {
  bufferAmountForVolume,
  celsiusToFahrenheit,
  cellsPerMl,
  convertUnit,
  deltaDeltaCt,
  dilutionVolume,
  fahrenheitToCelsius,
  formatNumber,
  massForMolarity,
  masterMixTotal,
  molarityFromMass,
  parseChamberCounts,
  rcfFromRpm,
  rpmFromRcf,
  safeNumber,
  seedingVolumeMl,
  serialDilution,
  viabilityPercent
} from "./lib/calculations";
import { exportBenchData, importBenchData, readFileAsDataUrl, saveJsonBackup, uid, usePersistentState } from "./lib/storage";
import type { BenchData } from "./lib/storage";
import type {
  BufferRecipe,
  ExperimentLog,
  GelRecord,
  LaneAnnotation,
  PhotoAttachment,
  ReagentRecord,
  SafetyRecord,
  SampleRecord,
  ToolGroup,
  ToolId
} from "./types";

const CONCENTRATION_UNITS = ["M", "mM", "uM", "nM", "pM"];
const VOLUME_UNITS = ["L", "mL", "uL", "nL"];
const MIX_VOLUME_UNITS = ["nL", "uL", "mL"];
const MASS_UNITS = ["g", "mg", "ug", "ng"];
const BUFFER_COMPONENT_UNITS = ["g", "mg", "ug", "mL", "uL"];
const CELL_VOLUME_UNITS = ["mL", "uL"];

const GROUPS: Array<{ id: ToolGroup; title: string; icon: typeof Home }> = [
  { id: "calc", title: "Calc", icon: Beaker },
  { id: "samples", title: "Track", icon: Archive },
  { id: "notes", title: "Notes", icon: Camera },
  { id: "safety", title: "Safety", icon: ShieldAlert }
];

const TOOL_ICONS: Record<ToolId, typeof Home> = {
  dilution: FlaskConical,
  mastermix: Layers,
  buffers: Beaker,
  qpcr: Sigma,
  cells: TestTube,
  units: Calculator,
  samples: ClipboardList,
  inventory: PackageSearch,
  logs: NotebookPen,
  gels: ImagePlus,
  safety: ShieldCheck
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function csvEscape(value: string | number) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadText(filename: string, content: string, type = "text/csv") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function NumberField(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        inputMode="decimal"
        type="number"
        min={props.min}
        step={props.step ?? "any"}
        value={Number.isFinite(props.value) ? props.value : 0}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(safeNumber(event.target.value))}
      />
    </label>
  );
}

function NumberWithUnitField(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit: string;
  onUnitChange: (unit: string) => void;
  units: string[];
  min?: number;
  step?: number;
}) {
  return (
    <label className="field unit-field">
      <span>{props.label}</span>
      <div>
        <input
          inputMode="decimal"
          type="number"
          min={props.min}
          step={props.step ?? "any"}
          value={Number.isFinite(props.value) ? props.value : 0}
          onChange={(event) => props.onChange(safeNumber(event.target.value))}
        />
        <select value={props.unit} onChange={(event) => props.onUnitChange(event.target.value)} aria-label={`${props.label} unit`}>
          {props.units.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function TextArea(props: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="field field-wide">
      <span>{props.label}</span>
      <textarea value={props.value} placeholder={props.placeholder} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}

function SelectField(props: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="field select-field">
      <span>{props.label}</span>
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {props.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown size={16} aria-hidden="true" />
    </label>
  );
}

function IconButton(props: {
  label: string;
  icon: typeof Plus;
  onClick: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
}) {
  const Icon = props.icon;
  return (
    <button className={`icon-button ${props.variant ?? "ghost"}`} onClick={props.onClick} disabled={props.disabled} title={props.label}>
      <Icon size={18} aria-hidden="true" />
      <span className="sr-only">{props.label}</span>
    </button>
  );
}

function ActionButton(props: {
  children: string;
  icon: typeof Plus;
  onClick: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
}) {
  const Icon = props.icon;
  return (
    <button className={`action ${props.variant ?? "ghost"}`} onClick={props.onClick} disabled={props.disabled}>
      <Icon size={17} aria-hidden="true" />
      <span>{props.children}</span>
    </button>
  );
}

function Stat(props: { label: string; value: string; tone?: "warn" | "ok" }) {
  return (
    <div className={`stat ${props.tone ?? ""}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function Panel(props: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{props.title}</h2>
        {props.actions ? <div className="panel-actions">{props.actions}</div> : null}
      </div>
      {props.children}
    </section>
  );
}

function EmptyState(props: { text: string }) {
  return <p className="empty">{props.text}</p>;
}

function App() {
  const urlTool = new URLSearchParams(window.location.search).get("tool") as ToolId | null;
  const firstTool = TOOLS.some((tool) => tool.id === urlTool) ? urlTool : "dilution";
  const [activeTool, setActiveTool] = useState<ToolId>(firstTool ?? "dilution");
  const [samples, setSamples] = usePersistentState<SampleRecord[]>("samples", []);
  const [reagents, setReagents] = usePersistentState<ReagentRecord[]>("reagents", []);
  const [buffers, setBuffers] = usePersistentState<BufferRecipe[]>("buffers", DEFAULT_BUFFERS);
  const [logs, setLogs] = usePersistentState<ExperimentLog[]>("logs", []);
  const [gels, setGels] = usePersistentState<GelRecord[]>("gels", []);
  const [safety, setSafety] = usePersistentState<SafetyRecord[]>("safety", DEFAULT_SAFETY);
  const visibleBenchData = useMemo(
    () => ({ samples, reagents, buffers, logs, gels, safety }),
    [samples, reagents, buffers, logs, gels, safety]
  );
  const activeDefinition = TOOLS.find((tool) => tool.id === activeTool) ?? TOOLS[0];
  const activeGroup = activeDefinition.group;

  function chooseTool(toolId: ToolId) {
    setActiveTool(toolId);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("tool", toolId);
    window.history.replaceState(null, "", nextUrl);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Local bench companion</p>
          <h1>Bench Tool</h1>
        </div>
      </header>

      <DataBackupPanel data={visibleBenchData} />

      <nav className="group-tabs" aria-label="Tool groups">
        {GROUPS.map((group) => {
          const Icon = group.icon;
          const firstInGroup = TOOLS.find((tool) => tool.group === group.id)?.id ?? "dilution";
          return (
            <button key={group.id} className={group.id === activeGroup ? "active" : ""} onClick={() => chooseTool(firstInGroup)}>
              <Icon aria-hidden="true" />
              <span>{group.title}</span>
            </button>
          );
        })}
      </nav>

      <div className="tool-strip" role="list" aria-label="Tools">
        {TOOLS.filter((tool) => tool.group === activeGroup).map((tool) => {
          const Icon = TOOL_ICONS[tool.id];
          return (
            <button key={tool.id} className={tool.id === activeTool ? "active" : ""} onClick={() => chooseTool(tool.id)}>
              <Icon aria-hidden="true" />
              <span>{tool.shortTitle}</span>
            </button>
          );
        })}
      </div>

      <ToolHost
        activeTool={activeTool}
        samples={samples}
        setSamples={setSamples}
        reagents={reagents}
        setReagents={setReagents}
        buffers={buffers}
        setBuffers={setBuffers}
        logs={logs}
        setLogs={setLogs}
        gels={gels}
        setGels={setGels}
        safety={safety}
        setSafety={setSafety}
      />
    </main>
  );
}

function DataBackupPanel(props: { data: BenchData }) {
  const importRef = useRef<HTMLInputElement | null>(null);
  const [backupStatus, setBackupStatus] = useState("Offline data stays on this iPhone. Back up a JSON copy to the iCloud Drive or Files folder you choose.");

  async function handleBackup(mode: "backup" | "folder") {
    const filename = `bench-tool-${today()}.json`;
    const prompt =
      mode === "folder"
        ? "Choose the new iCloud Drive or Files folder in the save sheet."
        : "Choose the iCloud Drive or Files folder for this backup.";
    setBackupStatus(prompt);

    try {
      const result = await saveJsonBackup(filename, exportBenchData(props.data));
      setBackupStatus(
        result === "shared"
          ? `Backup ready: ${filename}. Restore from that JSON to bring back the same visible records.`
          : `Downloaded ${filename}. Move it into iCloud Drive or your preferred Files folder.`
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setBackupStatus("Backup canceled. Your offline data is still unchanged on this iPhone.");
        return;
      }
      console.warn("Could not save Bench Tool backup", error);
      setBackupStatus("Could not start the backup. Try again, or use Restore only when you already have a JSON backup.");
    }
  }

  async function handleImport(file?: File) {
    if (!file) return;
    setBackupStatus(`Restoring ${file.name}...`);
    try {
      const text = await file.text();
      importBenchData(JSON.parse(text));
      setBackupStatus("Restore complete. Reloading the app with the backup data...");
      window.location.reload();
    } catch (error) {
      console.warn("Could not restore Bench Tool backup", error);
      setBackupStatus(error instanceof Error ? error.message : "Could not restore that backup file.");
    }
  }

  return (
    <details className="backup-details">
      <summary>
        <Save aria-hidden="true" />
        <span>Backup & restore</span>
        <small>offline-first</small>
      </summary>
      <div className="backup-panel">
        <p>{backupStatus}</p>
        <div className="backup-actions">
          <ActionButton icon={Download} variant="primary" onClick={() => handleBackup("backup")}>
            Back up to iCloud
          </ActionButton>
          <ActionButton icon={FolderOpen} onClick={() => handleBackup("folder")}>
            Change folder
          </ActionButton>
          <ActionButton icon={Upload} onClick={() => importRef.current?.click()}>
            Restore from iCloud
          </ActionButton>
        </div>
        <input
          ref={importRef}
          className="hidden-input"
          type="file"
          accept=".json,application/json"
          onChange={(event) => {
            handleImport(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </div>
    </details>
  );
}

function ToolHost(props: {
  activeTool: ToolId;
  samples: SampleRecord[];
  setSamples: Dispatch<SetStateAction<SampleRecord[]>>;
  reagents: ReagentRecord[];
  setReagents: Dispatch<SetStateAction<ReagentRecord[]>>;
  buffers: BufferRecipe[];
  setBuffers: Dispatch<SetStateAction<BufferRecipe[]>>;
  logs: ExperimentLog[];
  setLogs: Dispatch<SetStateAction<ExperimentLog[]>>;
  gels: GelRecord[];
  setGels: Dispatch<SetStateAction<GelRecord[]>>;
  safety: SafetyRecord[];
  setSafety: Dispatch<SetStateAction<SafetyRecord[]>>;
}) {
  switch (props.activeTool) {
    case "dilution":
      return <DilutionTool />;
    case "mastermix":
      return <MasterMixTool />;
    case "samples":
      return <SamplesTool samples={props.samples} setSamples={props.setSamples} />;
    case "buffers":
      return <BufferTool buffers={props.buffers} setBuffers={props.setBuffers} />;
    case "qpcr":
      return <QpcrTool />;
    case "cells":
      return <CellCultureTool />;
    case "logs":
      return <ExperimentLogsTool logs={props.logs} setLogs={props.setLogs} />;
    case "inventory":
      return <InventoryTool reagents={props.reagents} setReagents={props.setReagents} />;
    case "gels":
      return <GelTool gels={props.gels} setGels={props.setGels} />;
    case "units":
      return <UnitTool />;
    case "safety":
      return <SafetyTool safety={props.safety} setSafety={props.setSafety} />;
    default:
      return <DilutionTool />;
  }
}

type DilutionMode = "c1v1" | "molarity" | "serial";

const DILUTION_MODES: Array<{ id: DilutionMode; title: string; icon: typeof Home }> = [
  { id: "c1v1", title: "C1V1", icon: FlaskConical },
  { id: "molarity", title: "Molarity", icon: Calculator },
  { id: "serial", title: "Serial", icon: Layers }
];

function DilutionTool() {
  const [mode, setMode] = useState<DilutionMode>("c1v1");
  const [stock, setStock] = useState(100);
  const [stockUnit, setStockUnit] = useState("uM");
  const [target, setTarget] = useState(1);
  const [targetUnit, setTargetUnit] = useState("uM");
  const [finalVolume, setFinalVolume] = useState(100);
  const [finalVolumeUnit, setFinalVolumeUnit] = useState("uL");
  const [mass, setMass] = useState(10);
  const [massUnit, setMassUnit] = useState("mg");
  const [mw, setMw] = useState(500);
  const [volume, setVolume] = useState(1);
  const [volumeUnit, setVolumeUnit] = useState("mL");
  const [molarityUnit, setMolarityUnit] = useState("mM");
  const [desiredConcentration, setDesiredConcentration] = useState(10);
  const [desiredConcentrationUnit, setDesiredConcentrationUnit] = useState("mM");
  const [factor, setFactor] = useState(10);
  const [steps, setSteps] = useState(6);
  const stockM = convertUnit(stock, stockUnit, "M");
  const targetM = convertUnit(target, targetUnit, "M");
  const dilution = dilutionVolume(stockM, targetM, finalVolume);
  const massMg = convertUnit(mass, massUnit, "mg");
  const volumeMl = convertUnit(volume, volumeUnit, "mL");
  const molarityM = molarityFromMass(massMg, mw, volumeMl);
  const requiredMassMg = massForMolarity(convertUnit(desiredConcentration, desiredConcentrationUnit, "M"), mw, volumeMl);
  const serial = serialDilution(stockM, factor, steps);

  return (
    <div className="subtool-shell">
      <nav className="subtool-tabs" aria-label="Dilution calculators">
        {DILUTION_MODES.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} className={item.id === mode ? "active" : ""} onClick={() => setMode(item.id)}>
              <Icon aria-hidden="true" />
              <span>{item.title}</span>
            </button>
          );
        })}
      </nav>
      <div className="focused-tool">
        {mode === "c1v1" ? (
          <Panel title="C1V1">
            <div className="fields">
              <NumberWithUnitField label="Stock concentration" value={stock} onChange={setStock} unit={stockUnit} onUnitChange={setStockUnit} units={CONCENTRATION_UNITS} min={0} />
              <NumberWithUnitField label="Target concentration" value={target} onChange={setTarget} unit={targetUnit} onUnitChange={setTargetUnit} units={CONCENTRATION_UNITS} min={0} />
              <NumberWithUnitField label="Final volume" value={finalVolume} onChange={setFinalVolume} unit={finalVolumeUnit} onUnitChange={setFinalVolumeUnit} units={VOLUME_UNITS} min={0} />
            </div>
            <div className="stats">
              <Stat label="Stock volume" value={`${formatNumber(dilution.stockVolume)} ${finalVolumeUnit}`} tone={dilution.possible ? "ok" : "warn"} />
              <Stat label="Diluent" value={`${formatNumber(dilution.diluentVolume)} ${finalVolumeUnit}`} />
            </div>
          </Panel>
        ) : null}
        {mode === "molarity" ? (
          <Panel title="Mass and Molarity">
            <div className="fields">
              <NumberWithUnitField label="Mass" value={mass} onChange={setMass} unit={massUnit} onUnitChange={setMassUnit} units={MASS_UNITS} min={0} />
              <NumberField label="MW (g/mol)" value={mw} onChange={setMw} min={0} />
              <NumberWithUnitField label="Volume" value={volume} onChange={setVolume} unit={volumeUnit} onUnitChange={setVolumeUnit} units={VOLUME_UNITS} min={0} />
              <NumberWithUnitField
                label="Desired concentration"
                value={desiredConcentration}
                onChange={setDesiredConcentration}
                unit={desiredConcentrationUnit}
                onUnitChange={setDesiredConcentrationUnit}
                units={CONCENTRATION_UNITS}
                min={0}
              />
              <SelectField label="Molarity output" value={molarityUnit} options={CONCENTRATION_UNITS} onChange={setMolarityUnit} />
            </div>
            <div className="stats">
              <Stat label="Molarity" value={`${formatNumber(convertUnit(molarityM, "M", molarityUnit))} ${molarityUnit}`} />
              <Stat label="Mass needed" value={`${formatNumber(convertUnit(requiredMassMg, "mg", massUnit))} ${massUnit}`} />
            </div>
          </Panel>
        ) : null}
        {mode === "serial" ? (
          <Panel title="Serial Dilution">
            <div className="fields">
              <NumberWithUnitField label="Start concentration" value={stock} onChange={setStock} unit={stockUnit} onUnitChange={setStockUnit} units={CONCENTRATION_UNITS} min={0} />
              <NumberField label="Factor" value={factor} onChange={setFactor} min={0} />
              <NumberField label="Steps" value={steps} onChange={setSteps} min={1} step={1} />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Concentration ({stockUnit})</th>
                  </tr>
                </thead>
                <tbody>
                  {serial.map((row) => (
                    <tr key={row.step}>
                      <td>{row.step}</td>
                      <td>{formatNumber(convertUnit(row.concentration, "M", stockUnit))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function MasterMixTool() {
  const [reactions, setReactions] = useState(24);
  const [overage, setOverage] = useState(10);
  const [mixOutputUnit, setMixOutputUnit] = useState("uL");
  const [components, setComponents] = useState([
    { id: uid("mix"), name: "2x master mix", volume: 10, unit: "uL" },
    { id: uid("mix"), name: "Forward primer", volume: 0.5, unit: "uL" },
    { id: uid("mix"), name: "Reverse primer", volume: 0.5, unit: "uL" },
    { id: uid("mix"), name: "Template", volume: 1, unit: "uL" },
    { id: uid("mix"), name: "Water", volume: 8, unit: "uL" }
  ]);
  const totalPerReactionUl = components.reduce((sum, component) => sum + convertUnit(component.volume, component.unit, "uL"), 0);
  const hasTinyVolume = components.some((component) => {
    const volumeUl = convertUnit(component.volume, component.unit, "uL");
    return volumeUl > 0 && volumeUl < 1;
  });
  const formatMixVolume = (volumeUl: number) => `${formatNumber(convertUnit(volumeUl, "uL", mixOutputUnit))} ${mixOutputUnit}`;

  return (
    <Panel
      title="Master Mix"
      actions={<ActionButton icon={Plus} onClick={() => setComponents((items) => [...items, { id: uid("mix"), name: "", volume: 0, unit: "uL" }])}>Component</ActionButton>}
    >
      <div className="fields">
        <NumberField label="Reactions" value={reactions} onChange={setReactions} min={1} step={1} />
        <NumberField label="Overage %" value={overage} onChange={setOverage} min={0} />
        <SelectField label="Total unit" value={mixOutputUnit} options={MIX_VOLUME_UNITS} onChange={setMixOutputUnit} />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Component</th>
              <th>Each</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {components.map((component) => (
              <tr key={component.id}>
                <td>
                  <input
                    value={component.name}
                    aria-label="Component name"
                    onChange={(event) =>
                      setComponents((items) => items.map((item) => (item.id === component.id ? { ...item, name: event.target.value } : item)))
                    }
                  />
                </td>
                <td>
                  <div className="inline-inputs">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={component.volume}
                      aria-label="Per reaction volume"
                      onChange={(event) =>
                        setComponents((items) => items.map((item) => (item.id === component.id ? { ...item, volume: safeNumber(event.target.value) } : item)))
                      }
                    />
                    <select
                      value={component.unit}
                      aria-label="Per reaction unit"
                      onChange={(event) => setComponents((items) => items.map((item) => (item.id === component.id ? { ...item, unit: event.target.value } : item)))}
                    >
                      {MIX_VOLUME_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td>{formatMixVolume(masterMixTotal(convertUnit(component.volume, component.unit, "uL"), reactions, overage))}</td>
                <td>
                  <IconButton label="Delete component" icon={Trash2} variant="danger" onClick={() => setComponents((items) => items.filter((item) => item.id !== component.id))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasTinyVolume ? (
        <p className="notice">
          <AlertTriangle size={16} aria-hidden="true" />
          One or more per-reaction volumes are below 1 uL.
        </p>
      ) : null}
      <div className="stats">
        <Stat label="Per reaction" value={formatMixVolume(totalPerReactionUl)} />
        <Stat label="Total mix" value={formatMixVolume(masterMixTotal(totalPerReactionUl, reactions, overage))} />
      </div>
    </Panel>
  );
}

function BufferTool(props: { buffers: BufferRecipe[]; setBuffers: Dispatch<SetStateAction<BufferRecipe[]>> }) {
  const [selectedId, setSelectedId] = useState(props.buffers[0]?.id ?? "");
  const [targetVolumeUnit, setTargetVolumeUnit] = useState("mL");
  const [draft, setDraft] = useState<BufferRecipe>(() => cloneBuffer(props.buffers[0] ?? createBlankBuffer()));
  const [bufferStatus, setBufferStatus] = useState("");
  const savedDraft = props.buffers.find((item) => item.id === draft.id);
  const draftIsSaved = Boolean(savedDraft);
  const isDirty = !savedDraft || JSON.stringify(savedDraft) !== JSON.stringify(draft);

  useEffect(() => {
    const selected = props.buffers.find((item) => item.id === selectedId);
    if (selected) {
      setDraft(cloneBuffer(selected));
      setBufferStatus("");
      return;
    }
    if (!selectedId && props.buffers[0]) {
      setSelectedId(props.buffers[0].id);
      setDraft(cloneBuffer(props.buffers[0]));
      setBufferStatus("");
    }
  }, [props.buffers, selectedId]);

  function createBlankBuffer(): BufferRecipe {
    return { id: uid("buffer"), name: "New buffer", targetVolumeMl: 100, components: [], notes: "" };
  }

  function cloneBuffer(buffer: BufferRecipe): BufferRecipe {
    return {
      ...buffer,
      components: buffer.components.map((component) => ({ ...component }))
    };
  }

  function editDraft(update: Partial<BufferRecipe>) {
    setDraft((item) => ({ ...item, ...update }));
    setBufferStatus("Unsaved changes");
  }

  function selectBuffer(id: string) {
    const selected = props.buffers.find((item) => item.id === id);
    if (!selected) return;
    setSelectedId(selected.id);
    setDraft(cloneBuffer(selected));
    setBufferStatus("");
  }

  function addBufferDraft() {
    const next = createBlankBuffer();
    setSelectedId(next.id);
    setDraft(next);
    setBufferStatus("New buffer draft. Tap Save to keep it.");
  }

  function saveBuffer() {
    const saved = cloneBuffer({ ...draft, name: draft.name.trim() || "Untitled buffer" });
    props.setBuffers((items) => {
      const existing = items.some((item) => item.id === saved.id);
      return existing ? items.map((item) => (item.id === saved.id ? saved : item)) : [...items, saved];
    });
    setSelectedId(saved.id);
    setDraft(saved);
    setBufferStatus(`Saved ${saved.name}.`);
  }

  function deleteCurrentBuffer() {
    if (!draftIsSaved) {
      const fallback = props.buffers[0] ? cloneBuffer(props.buffers[0]) : createBlankBuffer();
      setSelectedId(fallback.id);
      setDraft(fallback);
      setBufferStatus(props.buffers[0] ? "Discarded unsaved buffer." : "New buffer draft. Tap Save to keep it.");
      return;
    }

    const remaining = props.buffers.filter((item) => item.id !== draft.id);
    if (remaining.length > 0) {
      props.setBuffers(remaining);
      setSelectedId(remaining[0].id);
      setDraft(cloneBuffer(remaining[0]));
      setBufferStatus("Deleted buffer.");
      return;
    }

    const next = createBlankBuffer();
    props.setBuffers([]);
    setSelectedId(next.id);
    setDraft(next);
    setBufferStatus("Deleted buffer. New buffer draft ready.");
  }

  return (
    <Panel
      title="Buffer and Media"
      actions={
        <>
          <ActionButton
            icon={Plus}
            onClick={addBufferDraft}
          >
            Buffer
          </ActionButton>
          <ActionButton icon={Save} variant="primary" onClick={saveBuffer} disabled={!isDirty}>
            Save
          </ActionButton>
          <IconButton label="Delete buffer" icon={Trash2} variant="danger" onClick={deleteCurrentBuffer} />
          <IconButton label="Export CSV" icon={Download} onClick={() => downloadBufferCsv(draft)} />
        </>
      }
    >
      <div className="fields">
        <label className="field select-field">
          <span>Select buffer</span>
          <select value={selectedId} onChange={(event) => selectBuffer(event.target.value)} aria-label="Select buffer">
            {!draftIsSaved ? <option value={draft.id}>{draft.name || "New buffer"} (unsaved)</option> : null}
            {props.buffers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </label>
        <TextField label="Rename selected buffer" value={draft.name} onChange={(name) => editDraft({ name })} />
        <NumberWithUnitField
          label="Target volume"
          value={convertUnit(draft.targetVolumeMl, "mL", targetVolumeUnit)}
          onChange={(value) => editDraft({ targetVolumeMl: convertUnit(value, targetVolumeUnit, "mL") })}
          unit={targetVolumeUnit}
          onUnitChange={setTargetVolumeUnit}
          units={["mL", "L"]}
          min={0}
        />
      </div>
      {bufferStatus || isDirty ? <p className="status-line">{bufferStatus || "Unsaved changes"}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Component</th>
              <th>Per L</th>
              <th>Need</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {draft.components.map((component) => (
              <tr key={component.id}>
                <td>
                  <input
                    value={component.name}
                    aria-label="Component"
                    onChange={(event) =>
                      editDraft({
                        components: draft.components.map((item) => (item.id === component.id ? { ...item, name: event.target.value } : item))
                      })
                    }
                  />
                </td>
                <td>
                  <div className="inline-inputs">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={component.amountPerLiter}
                      aria-label="Amount per liter"
                      onChange={(event) =>
                        editDraft({
                          components: draft.components.map((item) =>
                            item.id === component.id ? { ...item, amountPerLiter: safeNumber(event.target.value) } : item
                          )
                        })
                      }
                    />
                    <select
                      value={component.unit}
                      aria-label="Unit"
                      onChange={(event) =>
                        editDraft({
                          components: draft.components.map((item) => (item.id === component.id ? { ...item, unit: event.target.value } : item))
                        })
                      }
                    >
                      {BUFFER_COMPONENT_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td>
                  {formatNumber(bufferAmountForVolume(component.amountPerLiter, draft.targetVolumeMl, "mL"))} {component.unit}
                </td>
                <td>
                  <IconButton
                    label="Delete component"
                    icon={Trash2}
                    variant="danger"
                    onClick={() => editDraft({ components: draft.components.filter((item) => item.id !== component.id) })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row-actions">
        <ActionButton icon={Plus} onClick={() => editDraft({ components: [...draft.components, { id: uid("component"), name: "", amountPerLiter: 0, unit: "g" }] })}>
          Component
        </ActionButton>
      </div>
      <TextArea label="Notes" value={draft.notes} onChange={(notes) => editDraft({ notes })} />
    </Panel>
  );
}

function downloadBufferCsv(buffer: BufferRecipe) {
  const rows = [["Component", "Amount per L", "Unit", `Need for ${buffer.targetVolumeMl} mL`]];
  buffer.components.forEach((component) => {
    rows.push([
      component.name,
      String(component.amountPerLiter),
      component.unit,
      `${formatNumber(bufferAmountForVolume(component.amountPerLiter, buffer.targetVolumeMl, "mL"))} ${component.unit}`
    ]);
  });
  downloadText(`${buffer.name.replace(/\W+/g, "-").toLowerCase()}-${today()}.csv`, rows.map((row) => row.map(csvEscape).join(",")).join("\n"));
}

function QpcrTool() {
  const [targetSample, setTargetSample] = useState(22);
  const [refSample, setRefSample] = useState(18);
  const [targetControl, setTargetControl] = useState(24);
  const [refControl, setRefControl] = useState(18);
  const [efficiency, setEfficiency] = useState(100);
  const result = deltaDeltaCt(targetSample, refSample, targetControl, refControl, efficiency);

  return (
    <Panel title="qPCR Delta Delta Ct">
      <div className="fields">
        <NumberField label="Target sample Ct" value={targetSample} onChange={setTargetSample} min={0} />
        <NumberField label="Reference sample Ct" value={refSample} onChange={setRefSample} min={0} />
        <NumberField label="Target control Ct" value={targetControl} onChange={setTargetControl} min={0} />
        <NumberField label="Reference control Ct" value={refControl} onChange={setRefControl} min={0} />
        <NumberField label="Efficiency (%)" value={efficiency} onChange={setEfficiency} min={0} />
      </div>
      <div className="stats">
        <Stat label="Sample delta Ct" value={formatNumber(result.sampleDelta)} />
        <Stat label="Control delta Ct" value={formatNumber(result.controlDelta)} />
        <Stat label="Delta delta Ct" value={formatNumber(result.ddCt)} />
        <Stat label="Fold change" value={`${formatNumber(result.foldChange)}x`} />
      </div>
      <div className="qpcr-chart" aria-label="Fold-change chart">
        <span>Control</span>
        <b style={{ width: "28%" }}>1x</b>
        <span>Sample</span>
        <b style={{ width: `${Math.min(100, Math.max(8, result.foldChange * 28))}%` }}>{formatNumber(result.foldChange)}x</b>
      </div>
    </Panel>
  );
}

function CellCultureTool() {
  const [counts, setCounts] = useState("84, 78, 91, 87");
  const [deadCounts, setDeadCounts] = useState("8, 10, 7, 9");
  const [dilution, setDilution] = useState(2);
  const [desiredCells, setDesiredCells] = useState(300000);
  const [targetVolume, setTargetVolume] = useState(2);
  const [cellVolumeUnit, setCellVolumeUnit] = useState("mL");
  const liveCounts = parseChamberCounts(counts);
  const deadCountValues = parseChamberCounts(deadCounts);
  const concentration = cellsPerMl(liveCounts, dilution);
  const liveTotal = liveCounts.reduce((sum, value) => sum + value, 0);
  const deadTotal = deadCountValues.reduce((sum, value) => sum + value, 0);
  const volume = seedingVolumeMl(desiredCells, concentration);
  const targetVolumeMl = convertUnit(targetVolume, cellVolumeUnit, "mL");
  const outputCellVolume = (valueMl: number) => `${formatNumber(convertUnit(valueMl, "mL", cellVolumeUnit))} ${cellVolumeUnit}`;

  return (
    <Panel title="Cell Culture">
      <div className="fields">
        <TextField label="Live chamber counts" value={counts} onChange={setCounts} placeholder="84, 78, 91, 87" />
        <TextField label="Dead chamber counts" value={deadCounts} onChange={setDeadCounts} placeholder="8, 10, 7, 9" />
        <NumberField label="Dilution factor" value={dilution} onChange={setDilution} min={1} />
        <NumberField label="Desired cells (count)" value={desiredCells} onChange={setDesiredCells} min={0} />
        <NumberWithUnitField
          label="Final well volume"
          value={targetVolume}
          onChange={setTargetVolume}
          unit={cellVolumeUnit}
          onUnitChange={setCellVolumeUnit}
          units={CELL_VOLUME_UNITS}
          min={0}
        />
      </div>
      <div className="stats">
        <Stat label="Cells/mL" value={formatNumber(concentration)} />
        <Stat label="Viability" value={`${formatNumber(viabilityPercent(liveTotal, deadTotal))}%`} />
        <Stat label="Cell suspension" value={outputCellVolume(volume)} />
        <Stat label="Media" value={outputCellVolume(Math.max(targetVolumeMl - volume, 0))} />
      </div>
    </Panel>
  );
}

function UnitTool() {
  const [category, setCategory] = useState("Mass");
  const [value, setValue] = useState(1);
  const [from, setFrom] = useState("mg");
  const [to, setTo] = useState("ug");
  const [rpm, setRpm] = useState(12000);
  const [rcf, setRcf] = useState(16000);
  const [radius, setRadius] = useState(7);
  const [temp, setTemp] = useState(37);
  const units = category === "Mass" ? ["g", "mg", "ug", "ng"] : category === "Volume" ? ["L", "mL", "uL", "nL"] : ["M", "mM", "uM", "nM", "pM"];

  useEffect(() => {
    setFrom(units[1] ?? units[0]);
    setTo(units[2] ?? units[0]);
  }, [category]);

  return (
    <div className="tool-grid">
      <Panel title="Units">
        <div className="fields">
          <SelectField label="Category" value={category} options={["Mass", "Volume", "Concentration"]} onChange={setCategory} />
          <NumberField label="Value" value={value} onChange={setValue} />
          <SelectField label="From" value={from} options={units} onChange={setFrom} />
          <SelectField label="To" value={to} options={units} onChange={setTo} />
        </div>
        <div className="stats">
          <Stat label="Converted" value={`${formatNumber(convertUnit(value, from, to))} ${to}`} />
        </div>
      </Panel>
      <Panel title="RPM and RCF">
        <div className="fields">
          <NumberField label="Rotor radius cm" value={radius} onChange={setRadius} min={0} />
          <NumberField label="RPM" value={rpm} onChange={setRpm} min={0} />
          <NumberField label="RCF" value={rcf} onChange={setRcf} min={0} />
        </div>
        <div className="stats">
          <Stat label="RCF from RPM" value={`${formatNumber(rcfFromRpm(rpm, radius))} x g`} />
          <Stat label="RPM from RCF" value={formatNumber(rpmFromRcf(rcf, radius))} />
        </div>
      </Panel>
      <Panel title="Temperature">
        <div className="fields">
          <NumberField label="Celsius" value={temp} onChange={setTemp} />
        </div>
        <div className="stats">
          <Stat label="Fahrenheit" value={`${formatNumber(celsiusToFahrenheit(temp))} F`} />
          <Stat label="Back to C" value={`${formatNumber(fahrenheitToCelsius(celsiusToFahrenheit(temp)))} C`} />
        </div>
      </Panel>
    </div>
  );
}

function SamplesTool(props: { samples: SampleRecord[]; setSamples: Dispatch<SetStateAction<SampleRecord[]>> }) {
  const [query, setQuery] = useState("");
  const [scanStatus, setScanStatus] = useState("");
  const emptySample = { id: uid("sample"), name: "", type: "", location: "", box: "", position: "", date: today(), freezeThaw: 0, notes: "" };
  const [draft, setDraft] = useState<SampleRecord>(emptySample);
  const filtered = props.samples.filter((sample) => JSON.stringify(sample).toLowerCase().includes(query.toLowerCase()));

  function save() {
    if (!draft.name.trim()) return;
    props.setSamples((items) => [{ ...draft, id: uid("sample") }, ...items]);
    setDraft({ ...emptySample, id: uid("sample") });
  }

  async function decodeCodePhoto(file?: File) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setScanStatus("Reading code photo...");
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(url);
      const text = result.getText();
      setDraft((item) => ({
        ...item,
        name: item.name || text,
        notes: `${item.notes}\nScanned: ${text}`.trim()
      }));
      setScanStatus(`Scanned ${text}`);
    } catch {
      setScanStatus("No code found. Try a sharper photo or enter the code manually.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <Panel
      title="Sample Tracker"
      actions={
        <IconButton label="Export CSV" icon={Download} onClick={() => exportSamples(props.samples)} />
      }
    >
      <div className="fields">
        <TextField label="Sample" value={draft.name} onChange={(name) => setDraft((item) => ({ ...item, name }))} />
        <TextField label="Type" value={draft.type} onChange={(type) => setDraft((item) => ({ ...item, type }))} />
        <TextField label="Freezer/location" value={draft.location} onChange={(location) => setDraft((item) => ({ ...item, location }))} />
        <TextField label="Box" value={draft.box} onChange={(box) => setDraft((item) => ({ ...item, box }))} />
        <TextField label="Position" value={draft.position} onChange={(position) => setDraft((item) => ({ ...item, position }))} />
        <NumberField label="Freeze/thaw" value={draft.freezeThaw} onChange={(freezeThaw) => setDraft((item) => ({ ...item, freezeThaw }))} min={0} step={1} />
      </div>
      <div className="row-actions">
        <label className="action file-action">
          <Upload size={17} aria-hidden="true" />
          <span>Upload code photo</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              decodeCodePhoto(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <label className="action file-action">
          <Camera size={17} aria-hidden="true" />
          <span>Take code photo</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => {
              decodeCodePhoto(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <ActionButton icon={Save} variant="primary" onClick={save}>
          Save
        </ActionButton>
      </div>
      {scanStatus ? <p className="status-line">{scanStatus}</p> : null}
      <TextArea label="Notes" value={draft.notes} onChange={(notes) => setDraft((item) => ({ ...item, notes }))} />
      <label className="search">
        <Search size={18} aria-hidden="true" />
        <input value={query} placeholder="Search samples" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <RecordList
        records={filtered}
        render={(sample) => (
          <article className="record-card" key={sample.id}>
            <div>
              <strong>{sample.name}</strong>
              <span>{[sample.type, sample.location, sample.box, sample.position].filter(Boolean).join(" / ")}</span>
              <small>Freeze/thaw: {sample.freezeThaw}</small>
            </div>
            <div className="row-actions compact">
              <IconButton
                label="Increment freeze thaw"
                icon={Plus}
                onClick={() => props.setSamples((items) => items.map((item) => (item.id === sample.id ? { ...item, freezeThaw: item.freezeThaw + 1 } : item)))}
              />
              <IconButton label="Delete sample" icon={Trash2} variant="danger" onClick={() => props.setSamples((items) => items.filter((item) => item.id !== sample.id))} />
            </div>
          </article>
        )}
      />
    </Panel>
  );
}

function exportSamples(samples: SampleRecord[]) {
  const rows = [["Name", "Type", "Location", "Box", "Position", "Date", "Freeze/thaw", "Notes"]];
  samples.forEach((sample) => rows.push([sample.name, sample.type, sample.location, sample.box, sample.position, sample.date, String(sample.freezeThaw), sample.notes]));
  downloadText(`samples-${today()}.csv`, rows.map((row) => row.map(csvEscape).join(",")).join("\n"));
}

function InventoryTool(props: { reagents: ReagentRecord[]; setReagents: Dispatch<SetStateAction<ReagentRecord[]>> }) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<ReagentRecord>({
    id: uid("reagent"),
    name: "",
    vendor: "",
    catalog: "",
    lot: "",
    location: "",
    expiration: today(),
    quantity: 1,
    lowAt: 1,
    unit: "each",
    notes: ""
  });
  const filtered = props.reagents.filter((reagent) => JSON.stringify(reagent).toLowerCase().includes(query.toLowerCase()));
  const expiredCount = props.reagents.filter((reagent) => reagent.expiration && reagent.expiration < today()).length;
  const lowCount = props.reagents.filter((reagent) => reagent.quantity <= reagent.lowAt).length;

  function save() {
    if (!draft.name.trim()) return;
    props.setReagents((items) => [{ ...draft, id: uid("reagent") }, ...items]);
    setDraft({ ...draft, id: uid("reagent"), name: "", catalog: "", lot: "", notes: "" });
  }

  return (
    <Panel title="Reagent Inventory" actions={<IconButton label="Export CSV" icon={Download} onClick={() => exportReagents(props.reagents)} />}>
      <div className="stats">
        <Stat label="Low stock" value={String(lowCount)} tone={lowCount ? "warn" : "ok"} />
        <Stat label="Expired" value={String(expiredCount)} tone={expiredCount ? "warn" : "ok"} />
      </div>
      <div className="fields">
        <TextField label="Name" value={draft.name} onChange={(name) => setDraft((item) => ({ ...item, name }))} />
        <TextField label="Vendor" value={draft.vendor} onChange={(vendor) => setDraft((item) => ({ ...item, vendor }))} />
        <TextField label="Catalog" value={draft.catalog} onChange={(catalog) => setDraft((item) => ({ ...item, catalog }))} />
        <TextField label="Lot" value={draft.lot} onChange={(lot) => setDraft((item) => ({ ...item, lot }))} />
        <TextField label="Location" value={draft.location} onChange={(location) => setDraft((item) => ({ ...item, location }))} />
        <TextField label="Expiration" type="date" value={draft.expiration} onChange={(expiration) => setDraft((item) => ({ ...item, expiration }))} />
        <NumberField label="Quantity" value={draft.quantity} onChange={(quantity) => setDraft((item) => ({ ...item, quantity }))} min={0} />
        <NumberField label="Low at" value={draft.lowAt} onChange={(lowAt) => setDraft((item) => ({ ...item, lowAt }))} min={0} />
      </div>
      <TextArea label="Notes" value={draft.notes} onChange={(notes) => setDraft((item) => ({ ...item, notes }))} />
      <div className="row-actions">
        <ActionButton icon={Save} variant="primary" onClick={save}>
          Save
        </ActionButton>
      </div>
      <label className="search">
        <Search size={18} aria-hidden="true" />
        <input value={query} placeholder="Search inventory" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <RecordList
        records={filtered}
        render={(reagent) => (
          <article className="record-card" key={reagent.id}>
            <div>
              <strong>{reagent.name}</strong>
              <span>{[reagent.vendor, reagent.catalog, reagent.lot].filter(Boolean).join(" / ")}</span>
              <small>
                {reagent.location} - {reagent.quantity} {reagent.unit} - exp {reagent.expiration}
              </small>
            </div>
            <IconButton label="Delete reagent" icon={Trash2} variant="danger" onClick={() => props.setReagents((items) => items.filter((item) => item.id !== reagent.id))} />
          </article>
        )}
      />
    </Panel>
  );
}

function exportReagents(reagents: ReagentRecord[]) {
  const rows = [["Name", "Vendor", "Catalog", "Lot", "Location", "Expiration", "Quantity", "Low at", "Unit", "Notes"]];
  reagents.forEach((item) =>
    rows.push([item.name, item.vendor, item.catalog, item.lot, item.location, item.expiration, String(item.quantity), String(item.lowAt), item.unit, item.notes])
  );
  downloadText(`reagents-${today()}.csv`, rows.map((row) => row.map(csvEscape).join(",")).join("\n"));
}

function ExperimentLogsTool(props: { logs: ExperimentLog[]; setLogs: Dispatch<SetStateAction<ExperimentLog[]>> }) {
  const [draft, setDraft] = useState<ExperimentLog>({ id: uid("log"), title: "", project: "", startedAt: new Date().toISOString(), notes: "", photos: [] });

  async function addPhotos(files?: FileList | null) {
    if (!files) return;
    const photos: PhotoAttachment[] = [];
    for (const file of Array.from(files)) {
      photos.push({ id: uid("photo"), name: file.name, dataUrl: await readFileAsDataUrl(file), createdAt: new Date().toISOString() });
    }
    setDraft((item) => ({ ...item, photos: [...item.photos, ...photos] }));
  }

  function save() {
    if (!draft.title.trim()) return;
    props.setLogs((logs) => [{ ...draft, id: uid("log"), startedAt: new Date().toISOString() }, ...logs]);
    setDraft({ id: uid("log"), title: "", project: "", startedAt: new Date().toISOString(), notes: "", photos: [] });
  }

  return (
    <Panel title="Experiment Run Log">
      <div className="fields">
        <TextField label="Title" value={draft.title} onChange={(title) => setDraft((item) => ({ ...item, title }))} />
        <TextField label="Project" value={draft.project} onChange={(project) => setDraft((item) => ({ ...item, project }))} />
      </div>
      <TextArea label="Notes" value={draft.notes} onChange={(notes) => setDraft((item) => ({ ...item, notes }))} />
      <div className="row-actions">
        <label className="action file-action">
          <Upload size={17} aria-hidden="true" />
          <span>Upload photos</span>
          <input type="file" accept="image/*" multiple onChange={(event) => addPhotos(event.target.files)} />
        </label>
        <label className="action file-action">
          <Camera size={17} aria-hidden="true" />
          <span>Take photo</span>
          <input type="file" accept="image/*" capture="environment" onChange={(event) => addPhotos(event.target.files)} />
        </label>
        <ActionButton icon={Save} variant="primary" onClick={save}>
          Save
        </ActionButton>
      </div>
      <PhotoStrip photos={draft.photos} />
      <RecordList
        records={props.logs}
        render={(log) => (
          <article className="record-card stacked" key={log.id}>
            <div>
              <strong>{log.title}</strong>
              <span>{log.project}</span>
              <small>{new Date(log.startedAt).toLocaleString()}</small>
              <p>{log.notes}</p>
            </div>
            <PhotoStrip photos={log.photos} />
            <IconButton label="Delete log" icon={Trash2} variant="danger" onClick={() => props.setLogs((items) => items.filter((item) => item.id !== log.id))} />
          </article>
        )}
      />
    </Panel>
  );
}

function GelTool(props: { gels: GelRecord[]; setGels: Dispatch<SetStateAction<GelRecord[]>> }) {
  const [draft, setDraft] = useState<GelRecord>({ id: uid("gel"), title: "", date: today(), ladder: "", notes: "", image: "", lanes: [] });
  const [laneLabel, setLaneLabel] = useState("L1");

  async function setImage(file?: File) {
    if (!file) return;
    const image = await readFileAsDataUrl(file);
    setDraft((item) => ({ ...item, image }));
  }

  function addLane(event: React.MouseEvent<HTMLDivElement>) {
    if (!draft.image) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const xPercent = ((event.clientX - bounds.left) / bounds.width) * 100;
    const lane: LaneAnnotation = { id: uid("lane"), label: laneLabel, xPercent: Math.min(100, Math.max(0, xPercent)) };
    setDraft((item) => ({ ...item, lanes: [...item.lanes, lane] }));
    setLaneLabel(`L${draft.lanes.length + 2}`);
  }

  function save() {
    if (!draft.title.trim() || !draft.image) return;
    props.setGels((items) => [{ ...draft, id: uid("gel") }, ...items]);
    setDraft({ id: uid("gel"), title: "", date: today(), ladder: "", notes: "", image: "", lanes: [] });
  }

  return (
    <Panel title="Gel and Blot Capture">
      <div className="fields">
        <TextField label="Title" value={draft.title} onChange={(title) => setDraft((item) => ({ ...item, title }))} />
        <TextField label="Date" type="date" value={draft.date} onChange={(date) => setDraft((item) => ({ ...item, date }))} />
        <TextField label="Ladder" value={draft.ladder} onChange={(ladder) => setDraft((item) => ({ ...item, ladder }))} />
        <TextField label="Next lane" value={laneLabel} onChange={setLaneLabel} />
      </div>
      <div className="row-actions">
        <label className="action file-action">
          <Upload size={17} aria-hidden="true" />
          <span>Upload image</span>
          <input type="file" accept="image/*" onChange={(event) => setImage(event.target.files?.[0])} />
        </label>
        <label className="action file-action">
          <Camera size={17} aria-hidden="true" />
          <span>Take photo</span>
          <input type="file" accept="image/*" capture="environment" onChange={(event) => setImage(event.target.files?.[0])} />
        </label>
        <ActionButton icon={Save} variant="primary" onClick={save} disabled={!draft.image}>
          Save
        </ActionButton>
      </div>
      <GelPreview gel={draft} onClick={addLane} />
      <TextArea label="Notes" value={draft.notes} onChange={(notes) => setDraft((item) => ({ ...item, notes }))} />
      <RecordList
        records={props.gels}
        render={(gel) => (
          <article className="record-card stacked" key={gel.id}>
            <div>
              <strong>{gel.title}</strong>
              <span>{gel.ladder}</span>
              <small>{gel.date}</small>
            </div>
            <GelPreview gel={gel} />
            <IconButton label="Delete gel" icon={Trash2} variant="danger" onClick={() => props.setGels((items) => items.filter((item) => item.id !== gel.id))} />
          </article>
        )}
      />
    </Panel>
  );
}

function GelPreview(props: { gel: GelRecord; onClick?: (event: React.MouseEvent<HTMLDivElement>) => void }) {
  if (!props.gel.image) return <EmptyState text="Capture or upload an image." />;
  return (
    <div className="gel-preview" onClick={props.onClick}>
      <img src={props.gel.image} alt={props.gel.title || "Gel"} />
      {props.gel.lanes.map((lane) => (
        <span className="lane" key={lane.id} style={{ left: `${lane.xPercent}%` }}>
          {lane.label}
        </span>
      ))}
    </div>
  );
}

function SafetyTool(props: { safety: SafetyRecord[]; setSafety: Dispatch<SetStateAction<SafetyRecord[]>> }) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<SafetyRecord>({ id: uid("safety"), name: "", hazard: "", ppe: "", waste: "", sdsUrl: "", notes: "" });
  const filtered = props.safety.filter((record) => JSON.stringify(record).toLowerCase().includes(query.toLowerCase()));

  function save() {
    if (!draft.name.trim()) return;
    props.setSafety((items) => [{ ...draft, id: uid("safety") }, ...items]);
    setDraft({ id: uid("safety"), name: "", hazard: "", ppe: "", waste: "", sdsUrl: "", notes: "" });
  }

  return (
    <Panel title="Safety Quick Reference">
      <div className="fields">
        <TextField label="Name" value={draft.name} onChange={(name) => setDraft((item) => ({ ...item, name }))} />
        <TextField label="Hazard" value={draft.hazard} onChange={(hazard) => setDraft((item) => ({ ...item, hazard }))} />
        <TextField label="PPE" value={draft.ppe} onChange={(ppe) => setDraft((item) => ({ ...item, ppe }))} />
        <TextField label="Waste" value={draft.waste} onChange={(waste) => setDraft((item) => ({ ...item, waste }))} />
        <TextField label="SDS URL" value={draft.sdsUrl} onChange={(sdsUrl) => setDraft((item) => ({ ...item, sdsUrl }))} />
      </div>
      <TextArea label="Notes" value={draft.notes} onChange={(notes) => setDraft((item) => ({ ...item, notes }))} />
      <div className="row-actions">
        <ActionButton icon={Save} variant="primary" onClick={save}>
          Save
        </ActionButton>
      </div>
      <label className="search">
        <Search size={18} aria-hidden="true" />
        <input value={query} placeholder="Search safety notes" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <RecordList
        records={filtered}
        render={(record) => (
          <article className="record-card stacked" key={record.id}>
            <div>
              <strong>{record.name}</strong>
              <span>{record.hazard}</span>
              <small>{record.ppe}</small>
              <p>{record.waste}</p>
              {record.sdsUrl ? (
                <a href={record.sdsUrl} target="_blank" rel="noreferrer">
                  SDS
                </a>
              ) : null}
            </div>
            <IconButton label="Delete safety record" icon={Trash2} variant="danger" onClick={() => props.setSafety((items) => items.filter((item) => item.id !== record.id))} />
          </article>
        )}
      />
    </Panel>
  );
}

function PhotoStrip(props: { photos: PhotoAttachment[] }) {
  if (props.photos.length === 0) return null;
  return (
    <div className="photo-strip">
      {props.photos.map((photo) => (
        <img key={photo.id} src={photo.dataUrl} alt={photo.name} />
      ))}
    </div>
  );
}

function RecordList<T>(props: { records: T[]; render: (record: T) => React.ReactNode }) {
  if (props.records.length === 0) return <EmptyState text="No records yet." />;
  return <div className="record-list">{props.records.map(props.render)}</div>;
}

export default App;
