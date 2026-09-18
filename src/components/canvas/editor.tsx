"use client";

import "@xyflow/react/dist/style.css";
import { utcStamp } from "@/lib/format";
import {
  Background,
  BackgroundVariant,
  type Connection,
  ConnectionMode,
  Controls,
  type EdgeTypes,
  type NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveDesignVersion } from "@/app/canvas/actions";
import { recordReview } from "@/app/canvas/grade-actions";
import { EDGE_KINDS, EDGE_SPECS, type EdgeKind, NODE_KINDS, type NodeKind, defaultConfig } from "@/lib/canvas/catalog";
import { type DesignGraph, LIMITS, canonicalGraph, connectionProblem, exportDesign, importDesign, sameGraph } from "@/lib/canvas/graph";
import { DesignEdge, EdgeMarkers, EdgeSample } from "./design-edge";
import { grade } from "@/lib/grader/grade";
import { SCENARIOS, scenarioBySlug } from "@/lib/grader/scenarios";
import type { Finding } from "@/lib/grader/types";
import { DesignNode } from "./design-node";
import { GradeReportPanel, type RecordState } from "./grade-report";
import { type DesignFlowEdge, type DesignFlowNode, newId, toFlowEdges, toFlowNodes, toGraph } from "./flow";
import { EdgeInspector, NodeInspector } from "./inspector";
import { DRAG_MIME, Palette } from "./palette";

const nodeTypes: NodeTypes = { design: DesignNode };
const edgeTypes: EdgeTypes = { design: DesignEdge };

export type SaveMode = "ok" | "signed-out" | "not-configured";
export type VersionInfo = { version: number; name: string; createdAt: string };
export type StoredReviewInfo = { score: number; violations: number; warnings: number; createdAt: string };
export type EditorDesign = { designKey: string; name: string; latestVersion: number; openedVersion: number; graph: DesignGraph; scenario: string | null; lastReview: StoredReviewInfo | null };

type Status =
  | { kind: "not-saved"; reason: string }
  | { kind: "new" }
  | { kind: "dirty" }
  | { kind: "saved" }
  | { kind: "saving" }
  | { kind: "error"; message: string; conflict?: number };

declare global {
  interface Window {
    __designState?: { designKey: string | null; baseVersion: number | null; name: string; dirty: boolean; status: Status["kind"]; graph: DesignGraph; scenario: string | null };
  }
}

type EditorProps = { mode: SaveMode; design: EditorDesign | null; versions: VersionInfo[]; startScenario?: string | null; startGraph?: DesignGraph | null };

export function DesignEditor(props: EditorProps) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  );
}

function EditorInner({ mode, design, versions: initialVersions, startScenario = null, startGraph = null }: EditorProps) {
  const flow = useReactFlow<DesignFlowNode, DesignFlowEdge>();
  const initialGraph = design?.graph ?? startGraph ?? { schema: "go-forge/design-graph@1" as const, nodes: [], edges: [] };

  const [nodes, setNodes, onNodesChange] = useNodesState<DesignFlowNode>(toFlowNodes(initialGraph));
  const [edges, setEdges, onEdgesChange] = useEdgesState<DesignFlowEdge>(toFlowEdges(initialGraph));
  const [name, setName] = useState(design?.name ?? "Untitled design");
  const [designKey, setDesignKey] = useState<string | null>(design?.designKey ?? null);
  // The version a save builds on: the latest one, even when an older version was opened.
  const [baseVersion, setBaseVersion] = useState<number | null>(design?.latestVersion ?? null);
  const [saved, setSaved] = useState<{ name: string; graph: DesignGraph; scenario: string | null; version: number } | null>(
    design ? { name: design.name, graph: design.graph, scenario: design.scenario, version: design.openedVersion } : null,
  );
  const [scenarioSlug, setScenarioSlug] = useState<string | null>(design ? design.scenario : startScenario);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [record, setRecord] = useState<RecordState>({ kind: "not-recorded", reason: "not graded yet" });
  const [versions, setVersions] = useState<VersionInfo[]>(initialVersions);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<{ message: string; conflict?: number } | null>(null);
  const [connectKind, setConnectKind] = useState<EdgeKind>("sync");
  const [notice, setNotice] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const addCount = useRef(0);

  const graph = useMemo(() => toGraph(nodes, edges), [nodes, edges]);
  const dirty =
    saved === null
      ? graph.nodes.length > 0 || graph.edges.length > 0 || name !== "Untitled design" || scenarioSlug !== null
      : !(saved.name === name.trim() && saved.scenario === scenarioSlug && sameGraph(saved.graph, graph));
  const scenario = scenarioBySlug(scenarioSlug);
  // Grading is pure and fast, so an open report follows every edit.
  const report = useMemo(() => (gradeOpen && scenario ? grade(graph, scenario) : null), [gradeOpen, scenario, graph]);
  const nameProblem = name.trim() === "" ? "Give the design a name" : name.trim().length > LIMITS.name ? `At most ${LIMITS.name} characters` : null;

  const status: Status =
    mode !== "ok"
      ? { kind: "not-saved", reason: mode === "signed-out" ? "Signed out: sign in to save. Export keeps a copy." : "Supabase is not configured: nothing is saved. Export keeps a copy." }
      : saving
        ? { kind: "saving" }
        : saveError
          ? { kind: "error", ...saveError }
          : saved === null
            ? { kind: "new" }
            : dirty
              ? { kind: "dirty" }
              : { kind: "saved" };

  useEffect(() => {
    window.__designState = { designKey, baseVersion, name, dirty, status: status.kind, graph, scenario: scenarioSlug };
  });

  // Leaving with unsaved work asks first (browser-level navigation only).
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // Any real edit clears a stale save error. Keyed on content, not identity:
  // React Flow hands back new arrays for selection and measurement too.
  const graphKey = useMemo(() => JSON.stringify(canonicalGraph(graph)), [graph]);
  useEffect(() => setSaveError(null), [graphKey, name, scenarioSlug]);
  useEffect(() => setRecord((r) => (r.kind === "recorded" || r.kind === "error" ? { kind: "not-recorded", reason: "changed since the recorded grade" } : r)), [graphKey, name, scenarioSlug]);

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((m) => (m === msg ? null : m)), 3500);
  }, []);

  const addNode = useCallback(
    (kind: NodeKind, position?: { x: number; y: number }) => {
      if (nodes.length >= LIMITS.nodes) return flash(`A design can have at most ${LIMITS.nodes} components.`);
      let pos = position;
      if (!pos) {
        const r = wrapper.current?.getBoundingClientRect();
        const center = r ? flow.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) : { x: 0, y: 0 };
        const step = addCount.current++ % 6;
        pos = { x: center.x - 94 + step * 24, y: center.y - 30 + step * 24 };
      }
      const node: DesignFlowNode = { id: newId(kind.replace("_", "")), type: "design", position: pos, data: { kind, config: defaultConfig(kind) }, selected: true };
      setNodes((ns) => [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), node]);
      setEdges((es) => es.map((e) => (e.selected ? { ...e, selected: false } : e)));
    },
    [flash, flow, nodes.length, setEdges, setNodes],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      const problem = connectionProblem(graph, c.source, c.target, connectKind);
      if (problem) return flash(problem);
      const edge: DesignFlowEdge = { id: newId("e"), type: "design", source: c.source, target: c.target, data: { kind: connectKind } };
      setEdges((es) => [...es, edge]);
    },
    [connectKind, flash, graph, setEdges],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const kind = e.dataTransfer.getData(DRAG_MIME);
      if (!(NODE_KINDS as readonly string[]).includes(kind)) return;
      e.preventDefault();
      const p = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(kind as NodeKind, { x: p.x - 94, y: p.y - 30 });
    },
    [addNode, flow],
  );

  const save = useCallback(
    async (force = false) => {
      if (mode !== "ok" || saving || nameProblem) return;
      setSaving(true);
      setSaveError(null);
      try {
        const res = await saveDesignVersion({ designKey, baseVersion, name: name.trim(), graph, scenario: scenarioSlug, force });
        if (!res.ok) {
          setSaveError({ message: res.error, conflict: res.conflict?.latestVersion });
          return;
        }
        setSaved({ name: res.name, graph, scenario: scenarioSlug, version: res.version });
        setBaseVersion(res.version);
        setVersions((vs) => [{ version: res.version, name: res.name, createdAt: res.createdAt }, ...vs.filter((v) => v.version !== res.version)]);
        flash(`Saved version ${res.version}`);
        // replaceState, not router.replace: the URL follows the saved design
        // without remounting the editor (selection, viewport, panels stay).
        setDesignKey(res.designKey);
        if (window.location.pathname !== `/canvas/${res.designKey}` || window.location.search) window.history.replaceState(null, "", `/canvas/${res.designKey}`);
      } catch (e) {
        setSaveError({ message: `Could not reach the server: ${(e as Error).message}` });
      } finally {
        setSaving(false);
      }
    },
    [baseVersion, designKey, flash, graph, mode, name, nameProblem, saving, scenarioSlug],
  );

  const runGrade = useCallback(async () => {
    if (!scenario) return;
    setGradeOpen(true);
    if (mode !== "ok") return setRecord({ kind: "not-recorded", reason: mode === "signed-out" ? "signed out" : "database not configured" });
    if (!designKey || !saved || dirty) return setRecord({ kind: "not-recorded", reason: "unsaved changes: save, then grade to record" });
    setRecord({ kind: "recording" });
    try {
      const res = await recordReview({ designKey, version: saved.version });
      setRecord(res.ok ? { kind: "recorded", createdAt: res.createdAt } : { kind: "error", message: res.error });
    } catch (e) {
      setRecord({ kind: "error", message: `Could not reach the server: ${(e as Error).message}` });
    }
  }, [designKey, dirty, mode, saved, scenario]);

  const focusFinding = useCallback(
    (f: Finding) => {
      const ns = new Set(f.nodeIds);
      const es = new Set(f.edgeIds);
      setNodes((xs) => xs.map((n) => ({ ...n, selected: ns.has(n.id) })));
      setEdges((xs) => xs.map((e) => ({ ...e, selected: es.has(e.id) })));
      window.setTimeout(() => void flow.fitView({ nodes: f.nodeIds.map((id) => ({ id })), padding: 0.4, maxZoom: 1.2, duration: 300 }), 30);
      wrapper.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [flow, setEdges, setNodes],
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) void save();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [dirty, save]);

  const doExport = () => {
    const text = exportDesign(name.trim() || "Untitled design", saved && !dirty ? baseVersion : null, graph, { scenario: scenarioSlug });
    const slug = (name.trim() || "design").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "design";
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}${saved && !dirty && baseVersion ? `-v${baseVersion}` : ""}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const doImport = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) return setImportErrors([`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 2 MB.`]);
    const res = importDesign(await file.text());
    if (!res.ok) return setImportErrors(res.errors);
    if (dirty && !window.confirm("Replace what's on the canvas with the imported design? Unsaved changes will be lost.")) return;
    setImportErrors(null);
    setNodes(toFlowNodes(res.value.graph));
    setEdges(toFlowEdges(res.value.graph));
    if (res.value.name) setName(res.value.name);
    // Only an export file carries a scenario; a bare graph leaves the current choice alone.
    const unknownScenario = res.value.scenario !== null && !scenarioBySlug(res.value.scenario);
    if (res.value.scenario !== null && !unknownScenario) setScenarioSlug(res.value.scenario);
    flash(
      `Imported ${res.value.graph.nodes.length} components and ${res.value.graph.edges.length} connections` +
        (unknownScenario ? ` · unknown scenario "${res.value.scenario}" ignored` : "") +
        (designKey ? " · save to make it a new version" : ""),
    );
    window.setTimeout(() => flow.fitView({ padding: 0.2 }), 50);
  };

  // ------------------------------------------------------------ selection ---
  const selNodes = nodes.filter((n) => n.selected);
  const selEdges = edges.filter((e) => e.selected);
  const selectedNode = selNodes.length === 1 && selEdges.length === 0 ? selNodes[0] : null;
  const selectedEdge = selEdges.length === 1 && selNodes.length === 0 ? selEdges[0] : null;
  const labelOf = (id: string) => nodes.find((n) => n.id === id)?.data.config.label ?? id;
  const [edgeProblem, setEdgeProblem] = useState<string | null>(null);
  useEffect(() => setEdgeProblem(null), [selectedEdge?.id]);

  const openedOld = design && design.openedVersion < design.latestVersion && baseVersion === design.latestVersion;

  return (
    <div className="grid gap-4">
      <EdgeMarkers />
      {/* ------------------------------------------------------- toolbar --- */}
      <div className="panel flex flex-wrap items-center gap-x-4 gap-y-3 px-3 py-2.5" data-testid="canvas-toolbar">
        <label className="flex min-w-0 flex-1 basis-60 items-center gap-2">
          <span className="label shrink-0 text-[0.64rem]">Design</span>
          <input
            data-testid="design-name"
            value={name}
            maxLength={LIMITS.name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={nameProblem !== null}
            className={`field min-w-0 py-1.5 ${nameProblem ? "border-bad" : ""}`}
          />
        </label>
        <StatusChip status={status} version={baseVersion} />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" data-testid="save-design" className="btn btn-solid px-3 py-1.5 text-[0.78rem]" disabled={mode !== "ok" || saving || !dirty || nameProblem !== null} onClick={() => void save()}>
            {saving ? "Saving…" : baseVersion ? `Save as v${baseVersion + 1}` : "Save v1"}
          </button>
          {designKey && versions.length > 0 && (
            <button type="button" data-testid="toggle-history" aria-expanded={historyOpen} className="btn px-3 py-1.5 text-[0.78rem]" onClick={() => setHistoryOpen((o) => !o)}>
              History ({versions.length})
            </button>
          )}
          <button type="button" data-testid="export-design" className="btn px-3 py-1.5 text-[0.78rem]" onClick={doExport}>
            Export JSON
          </button>
          <button type="button" data-testid="import-design" className="btn px-3 py-1.5 text-[0.78rem]" onClick={() => fileInput.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileInput}
            data-testid="import-file"
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void doImport(f);
            }}
          />
          <label className="flex items-center gap-2">
            <span className="label shrink-0 text-[0.64rem]">Scenario</span>
            <select data-testid="design-scenario" value={scenarioSlug ?? ""} onChange={(e) => setScenarioSlug(e.target.value || null)} className="field py-1.5 text-[0.78rem]">
              <option value="">None</option>
              {SCENARIOS.map((sc) => (
                <option key={sc.slug} value={sc.slug}>
                  {sc.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            data-testid="grade-design"
            className="btn btn-solid px-3 py-1.5 text-[0.78rem]"
            disabled={!scenario || record.kind === "recording"}
            title={scenario ? "Run the deterministic grader against the scenario" : "Pick a scenario to grade against"}
            onClick={() => void runGrade()}
          >
            Grade
          </button>
          {design?.lastReview && saved?.version === design.openedVersion && !gradeOpen && (
            <span data-testid="last-review" className="font-mono text-[0.7rem] text-ink-3">
              last grade of v{design.openedVersion}: {design.lastReview.score} · {design.lastReview.violations} violation{design.lastReview.violations === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {nameProblem && <p className="-mt-2 font-mono text-[0.72rem] text-bad">{nameProblem}</p>}

      {status.kind === "error" && (
        <div data-testid="save-error" data-conflict={status.conflict ?? ""} className="border border-bad bg-paper px-4 py-3 font-mono text-[0.78rem] text-bad">
          <p>{status.message}</p>
          {status.conflict !== undefined && designKey && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" data-testid="force-save" className="btn border-bad px-3 py-1 text-[0.74rem] text-bad" onClick={() => void save(true)}>
                Save mine anyway as v{status.conflict + 1}
              </button>
              <a href={`/canvas/${designKey}`} target="_blank" rel="noreferrer" className="btn px-3 py-1 text-[0.74rem]">
                Open v{status.conflict} in a new tab
              </a>
            </div>
          )}
        </div>
      )}

      {openedOld && (
        <p data-testid="old-version-banner" className="border border-warn bg-paper px-4 py-2 font-mono text-[0.76rem] text-warn">
          You opened version {design.openedVersion}; the latest is {design.latestVersion}. Saving creates version {design.latestVersion + 1} from what is on the canvas. Nothing older is overwritten.
        </p>
      )}

      {importErrors && (
        <div data-testid="import-errors" className="border border-bad bg-paper px-4 py-3 font-mono text-[0.76rem] text-bad">
          <div className="flex items-start justify-between gap-4">
            <p>Import refused. Nothing on the canvas changed.</p>
            <button type="button" className="underline" onClick={() => setImportErrors(null)}>
              dismiss
            </button>
          </div>
          <ul className="mt-2 list-disc pl-5">
            {importErrors.slice(0, 10).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          {importErrors.length > 10 && <p className="mt-1">…and {importErrors.length - 10} more</p>}
        </div>
      )}

      {report && scenario && <GradeReportPanel report={report} scenario={scenario} record={record} onFocus={focusFinding} onClose={() => setGradeOpen(false)} />}

      {historyOpen && designKey && (
        <HistoryPanel designKey={designKey} versions={versions} current={saved && !dirty ? baseVersion : null} dirty={dirty} />
      )}

      {/* ------------------------------------------------------ workspace --- */}
      <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)_290px]">
        <div className="order-2 lg:order-1">
          <Palette onAdd={(k) => addNode(k)} />
        </div>

        <div className="order-1 lg:order-2">
          <div
            ref={wrapper}
            data-testid="canvas"
            className="gf-canvas relative h-[62vh] min-h-[420px] border border-line bg-paper lg:h-[72vh]"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes(DRAG_MIME)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }
            }}
            onDrop={onDrop}
          >
            <ReactFlow<DesignFlowNode, DesignFlowEdge>
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              // Every handle is a "source" handle; loose mode lets edges end on one.
              // Without it React Flow silently drops every edge (it finds no target handle).
              connectionMode={ConnectionMode.Loose}
              isValidConnection={(c) => c.source !== c.target}
              connectionLineStyle={{ stroke: "#00add8", strokeWidth: 1.5, strokeDasharray: "4 3" }}
              deleteKeyCode={["Backspace", "Delete"]}
              snapToGrid
              snapGrid={[10, 10]}
              fitView={initialGraph.nodes.length > 0}
              fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
              minZoom={0.2}
              maxZoom={2}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2e302a" />
              <Controls showInteractive={false} position="bottom-left" />
            </ReactFlow>
            {nodes.length === 0 && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center">
                <p className="prose-serif max-w-sm text-ink-3 italic">Drag a component from the palette, or click one to drop it here. Connect components by dragging from the small square on any side.</p>
              </div>
            )}
            {notice && (
              <p data-testid="canvas-notice" role="status" className="absolute top-3 left-1/2 z-10 -translate-x-1/2 border border-line bg-paper px-3 py-1 font-mono text-[0.74rem]">
                {notice}
              </p>
            )}
          </div>
        </div>

        <aside className="order-3 panel p-4" data-testid="inspector">
          {selectedNode ? (
            <NodeInspector
              key={selectedNode.id}
              node={selectedNode}
              onChange={(config) => setNodes((ns) => ns.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, config } } : n)))}
              onDelete={() => void flow.deleteElements({ nodes: [{ id: selectedNode.id }] })}
            />
          ) : selectedEdge ? (
            <EdgeInspector
              key={selectedEdge.id}
              edge={selectedEdge}
              sourceLabel={labelOf(selectedEdge.source)}
              targetLabel={labelOf(selectedEdge.target)}
              problem={edgeProblem}
              onChange={(kind, label) => {
                const others = { edges: graph.edges.filter((e) => e.id !== selectedEdge.id) };
                const problem = kind !== selectedEdge.data?.kind ? connectionProblem(others, selectedEdge.source, selectedEdge.target, kind) : null;
                setEdgeProblem(problem);
                if (problem) return;
                setEdges((es) => es.map((e) => (e.id === selectedEdge.id ? { ...e, data: label.trim() ? { kind, label: label.slice(0, LIMITS.label) } : { kind } } : e)));
              }}
              onReverse={() => {
                const kind = selectedEdge.data?.kind ?? "sync";
                const others = { edges: graph.edges.filter((e) => e.id !== selectedEdge.id) };
                const problem = connectionProblem(others, selectedEdge.target, selectedEdge.source, kind);
                setEdgeProblem(problem);
                if (problem) return;
                setEdges((es) => es.map((e) => (e.id === selectedEdge.id ? { ...e, source: e.target, target: e.source } : e)));
              }}
              onDelete={() => void flow.deleteElements({ edges: [{ id: selectedEdge.id }] })}
            />
          ) : selNodes.length + selEdges.length > 1 ? (
            <div data-testid="multi-inspector">
              <p className="label text-accent">{selNodes.length + selEdges.length} selected</p>
              <button type="button" className="btn mt-4 w-full border-bad py-1.5 text-[0.78rem] text-bad" onClick={() => void flow.deleteElements({ nodes: selNodes.map((n) => ({ id: n.id })), edges: selEdges.map((e) => ({ id: e.id })) })}>
                Delete selection
              </button>
            </div>
          ) : (
            <div data-testid="design-inspector">
              <p className="label text-accent">New connections</p>
              <p className="mt-1 font-serif text-[0.95rem] text-ink-2 italic">Kind used when you drag a connection. Change any existing one by selecting it.</p>
              <div className="mt-2 grid gap-px border border-line bg-rule" role="radiogroup" aria-label="Kind for new connections">
                {EDGE_KINDS.map((k) => (
                  <label key={k} className={`flex cursor-pointer items-center gap-2 px-2 py-1.5 font-mono text-[0.74rem] ${k === connectKind ? "bg-accent-soft" : "bg-paper hover:bg-paper-2"}`}>
                    <input type="radio" name="connect-kind" data-testid={`connect-kind-${k}`} checked={k === connectKind} onChange={() => setConnectKind(k)} className="accent-accent" />
                    <EdgeSample kind={k} />
                    {EDGE_SPECS[k].title}
                  </label>
                ))}
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-px border border-rule bg-rule font-mono text-[0.72rem]">
                <div className="bg-paper px-3 py-2">
                  <dt className="text-ink-3">Components</dt>
                  <dd data-testid="count-nodes" className="text-base">
                    {nodes.length}
                  </dd>
                </div>
                <div className="bg-paper px-3 py-2">
                  <dt className="text-ink-3">Connections</dt>
                  <dd data-testid="count-edges" className="text-base">
                    {edges.length}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 font-mono text-[0.68rem] leading-relaxed text-ink-3">Select to edit · Delete/Backspace removes · Shift-drag to box-select · Ctrl+S saves</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function StatusChip({ status, version }: { status: Status; version: number | null }) {
  const base = "border px-2 py-1 font-mono text-[0.7rem]";
  const map: Record<Status["kind"], [string, string]> = {
    "not-saved": ["Not saved", "border-bad text-bad"],
    new: ["Never saved", "border-warn text-warn"],
    dirty: [`Unsaved changes${version ? ` · since v${version}` : ""}`, "border-warn text-warn"],
    saved: [`Saved · v${version}`, "border-ok text-ok"],
    saving: ["Saving…", "border-ink-3 text-ink-3"],
    error: ["Save failed", "border-bad text-bad"],
  };
  const [text, cls] = map[status.kind];
  return (
    <span data-testid="design-status" data-kind={status.kind} title={status.kind === "not-saved" ? status.reason : undefined} className={`${base} ${cls}`}>
      {text}
    </span>
  );
}

function HistoryPanel({ designKey, versions, current, dirty }: { designKey: string; versions: VersionInfo[]; current: number | null; dirty: boolean }) {
  const latest = versions[0]?.version;
  return (
    <div className="panel" data-testid="history-panel">
      <div className="panel-head">
        <span className="label">Version history</span>
        {dirty && <span className="font-mono text-[0.68rem] text-warn">Opening another version discards unsaved changes (the browser will ask)</span>}
      </div>
      <ol className="max-h-64 divide-y divide-rule overflow-y-auto">
        {versions.map((v) => (
          <li key={v.version} data-testid={`version-${v.version}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 font-mono text-[0.76rem]">
            <span className="w-10 text-accent">v{v.version}</span>
            <span className="min-w-0 flex-1 truncate">{v.name}</span>
            <time className="text-ink-3" dateTime={v.createdAt}>
              {utcStamp(v.createdAt)}
            </time>
            {v.version === current ? (
              <span className="text-ok">on canvas</span>
            ) : (
              <a className="text-accent underline underline-offset-2" href={`/canvas/${designKey}?v=${v.version}`}>
                open
              </a>
            )}
            {v.version !== latest && (
              <a className="text-accent underline underline-offset-2" data-testid={`diff-${v.version}`} href={`/canvas/${designKey}/diff?from=${v.version}&to=${latest}`}>
                diff → v{latest}
              </a>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
