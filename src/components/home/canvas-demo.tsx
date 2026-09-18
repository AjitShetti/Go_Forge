"use client";

import "@xyflow/react/dist/style.css";
import { Background, BackgroundVariant, ConnectionMode, Controls, type EdgeTypes, type NodeTypes, ReactFlow, ReactFlowProvider, useReactFlow } from "@xyflow/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { DesignEdge, EdgeMarkers } from "@/components/canvas/design-edge";
import { DesignNode } from "@/components/canvas/design-node";
import type { DesignFlowEdge, DesignFlowNode } from "@/components/canvas/flow";
import { NodeIcon } from "@/components/canvas/icons";
import { DEMO_SCENARIO as S, DEMO_STEPS } from "@/lib/canvas/demo";
import { type DesignGraph, diffGraphs } from "@/lib/canvas/graph";
import { grade } from "@/lib/grader/grade";
import type { Finding } from "@/lib/grader/types";

const nodeTypes: NodeTypes = { design: DesignNode };
const edgeTypes: EdgeTypes = { design: DesignEdge };
const STEP_MS = 7000;

/** A step's graph as React Flow state: boxes added or changed since the previous step get badges, boxes behind violations get outlined. */
function flowState(graph: DesignGraph, prev: DesignGraph | null, flagged: Set<string>) {
  const diff = prev ? diffGraphs(prev, graph) : null;
  const added = new Set(diff?.addedNodes.map((n) => n.id));
  const changed = new Set(diff?.changedNodes.map((c) => c.after.id));
  const nodes: DesignFlowNode[] = graph.nodes.map((n) => ({
    id: n.id,
    type: "design",
    position: n.position,
    selected: flagged.has(n.id),
    data: { kind: n.kind, config: n.config, diff: added.has(n.id) ? "added" : changed.has(n.id) ? "changed" : undefined },
  }));
  const edges: DesignFlowEdge[] = graph.edges.map((e) => ({ id: e.id, type: "design", source: e.source, target: e.target, data: { kind: e.kind } }));
  return { nodes, edges };
}

export function CanvasDemo() {
  return (
    <ReactFlowProvider>
      <DemoInner />
    </ReactFlowProvider>
  );
}

function DemoInner() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const touched = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const flow = useReactFlow<DesignFlowNode, DesignFlowEdge>();

  const step = DEMO_STEPS[index];
  const report = useMemo(() => (step.graded ? grade(step.graph, S) : null), [step]);
  const { nodes, edges } = useMemo(() => {
    const prev = step.markChanges && index > 0 ? DEMO_STEPS[index - 1].graph : null;
    const flagged = new Set(step.key === "grade" && report ? report.violations.flatMap((f) => f.nodeIds) : []);
    return flowState(step.graph, prev, flagged);
  }, [index, report, step]);

  // Start playing the first time the walkthrough scrolls into view, unless the
  // visitor prefers reduced motion or has already clicked a control.
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !touched.current) {
          setPlaying(true);
          io.disconnect();
        }
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (index >= DEMO_STEPS.length - 1) return setPlaying(false);
    const t = window.setTimeout(() => setIndex((i) => i + 1), STEP_MS);
    return () => window.clearTimeout(t);
  }, [index, playing]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => void flow.fitView({ padding: 0.18, maxZoom: 1, duration: reduced ? 0 : 450 }), 40);
    return () => window.clearTimeout(t);
  }, [flow, index, nodes.length]);

  const go = (i: number) => {
    touched.current = true;
    setPlaying(false);
    setIndex(Math.max(0, Math.min(DEMO_STEPS.length - 1, i)));
  };
  const last = index === DEMO_STEPS.length - 1;

  return (
    <div ref={root} className="panel" data-testid="canvas-demo" data-step={step.key}>
      <EdgeMarkers />
      <div className="panel-head flex-wrap">
        <span className="label">Walkthrough · {S.title}</span>
        <div className="flex items-center gap-2">
          <button type="button" className="btn px-2.5 py-1 text-[0.72rem]" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous step">
            ←
          </button>
          <button
            type="button"
            data-testid="demo-play"
            className="btn px-2.5 py-1 text-[0.72rem]"
            onClick={() => {
              touched.current = true;
              if (last) setIndex(0);
              setPlaying((p) => !p || last);
            }}
          >
            {playing ? "Pause" : last ? "Replay" : "Play"}
          </button>
          <button type="button" data-testid="demo-next" className="btn btn-solid px-2.5 py-1 text-[0.72rem]" onClick={() => go(index + 1)} disabled={last} aria-label="Next step">
            →
          </button>
        </div>
      </div>

      <ol className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        {DEMO_STEPS.map((s, i) => (
          <li key={s.key} className="relative">
            <button
              type="button"
              data-testid={`demo-step-${s.key}`}
              aria-current={i === index ? "step" : undefined}
              onClick={() => go(i)}
              className={`h-full w-full px-3 py-2 text-left font-mono text-[0.68rem] ${i === index ? "bg-accent text-paper" : i < index ? "bg-paper text-ink hover:bg-paper-2" : "bg-paper-2 text-ink-3 hover:text-ink"}`}
            >
              <span className={i === index ? "text-paper/70" : "text-ink-3"}>0{i + 1}</span> {s.title}
            </button>
            {i === index && playing && <span key={index} className="gf-demo-progress absolute bottom-0 left-0 h-0.5 bg-paper" style={{ animationDuration: `${STEP_MS}ms` }} />}
          </li>
        ))}
      </ol>

      <div className="grid lg:h-[500px] lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="gf-canvas relative h-[340px] border-b border-line sm:h-[420px] lg:h-full lg:border-r lg:border-b-0">
          <ReactFlow<DesignFlowNode, DesignFlowEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            // Wheel scrolls the page; drag, pinch and the buttons move the view.
            zoomOnScroll={false}
            zoomOnDoubleClick={false}
            preventScrolling={false}
            fitView
            fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
            minZoom={0.2}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2e302a" />
            {nodes.length > 0 && <Controls showInteractive={false} position="bottom-left" />}
          </ReactFlow>
          {nodes.length === 0 && <ScenarioCard />}
        </div>

        <div className="grid content-start gap-4 p-4 lg:overflow-y-auto">
          <div>
            <p className="label text-accent">You do</p>
            <ol className="mt-2 grid gap-1.5 font-mono text-[0.76rem] leading-snug">
              {step.actions.map((a, i) => (
                <li key={a} className="flex gap-2">
                  <span className="text-ink-3">{String.fromCharCode(97 + i)}.</span>
                  <span>{a}</span>
                </li>
              ))}
            </ol>
            {step.math && (
              <pre className="mt-3 border-l-2 border-accent bg-paper-2 px-3 py-2 font-mono text-[0.74rem] leading-relaxed" data-testid="demo-math">
                {step.math.join("\n")}
              </pre>
            )}
            <p className="prose-serif mt-3 text-[1rem] leading-snug text-ink-2">{step.note}</p>
          </div>
          {report ? (
            <div className="border-t border-rule pt-3" data-testid="demo-grade" data-score={report.score}>
              <div className="flex items-baseline gap-3">
                <span className={`font-display text-4xl font-bold ${report.passed ? "text-ok" : "text-bad"}`}>{report.score}</span>
                <span className={`font-mono text-[0.7rem] ${report.passed ? "text-ok" : "text-bad"}`}>
                  {report.passed ? "Passed · no violations" : `Failed · ${report.violations.length} violation${report.violations.length === 1 ? "" : "s"}`}
                </span>
              </div>
              <ul className="mt-2 grid gap-1.5">
                {[...report.violations, ...report.warnings].map((f, i) => (
                  <FindingLine key={`${f.rule}-${i}`} f={f} />
                ))}
                {report.violations.length + report.warnings.length === 0 && <li className="font-serif text-[0.95rem] text-ink-3 italic">Every hard constraint holds under the model.</li>}
              </ul>
            </div>
          ) : (
            <p className="border-t border-rule pt-3 font-mono text-[0.7rem] text-ink-3">Not graded yet.</p>
          )}
          {last && (
            <Link href={`/canvas/new?scenario=${S.slug}&start=naive`} className="btn btn-primary text-[0.8rem]" data-testid="demo-try">
              Try it: start from the naive sketch
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function FindingLine({ f }: { f: Finding }) {
  const tone = f.severity === "violation" ? "border-bad text-bad" : "border-warn text-warn";
  return (
    <li className={`border-l-2 pl-2 ${tone.split(" ")[0]}`}>
      <p className={`font-mono text-[0.72rem] font-bold ${tone.split(" ")[1]}`}>{f.title}</p>
      <p className="font-serif text-[0.9rem] leading-snug text-ink-2">{f.detail}</p>
    </li>
  );
}

function ScenarioCard() {
  return (
    <div className="absolute inset-0 flex overflow-y-auto p-4">
      <div className="m-auto w-full max-w-md border border-line bg-paper p-4">
        <div className="flex items-center gap-2 text-accent">
          <NodeIcon kind="client" className="h-4 w-4" />
          <span className="label text-accent">Scenario · {S.title}</span>
        </div>
        <p className="prose-serif mt-2 text-[0.95rem] leading-snug text-ink-2">{S.summary}</p>
        <dl className="mt-3 grid grid-cols-1 gap-px border border-rule bg-rule font-mono text-[0.7rem] sm:grid-cols-2">
          {[
            ["Peak", `${S.scale.peakQps.toLocaleString("en-US")} rps`],
            ["Reads per write", `${S.scale.readWriteRatio} : 1`],
            ["p99 budget", `${S.params.p99BudgetMs} ms`],
            ["Hard constraints", String(S.constraints.length)],
          ].map(([k, v]) => (
            <div key={k} className="bg-paper px-2.5 py-1.5">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
