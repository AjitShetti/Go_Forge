import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Caption, Page, DisplayHeading } from "@/components/ui";
import { scenarioBySlug } from "@/lib/grader/scenarios";
import type { RuleId } from "@/lib/grader/types";

export const metadata: Metadata = { title: "Scenario" };

const RULE_TEXT: Record<RuleId, string> = {
  "has-entry": "There is a Client with at least one request connection.",
  "client-direct-data": "No Client connects straight to a DB, cache or search index.",
  spof: "Every node on the request path that has a replica setting has at least 2, or is a SQL primary replicating to a replica.",
  capacity: "Load arriving at each node ≤ replicas × QPS in.",
  "strong-inventory": "A strongly consistent, persistent store (SQL primary or strong NoSQL) is on the request path.",
  "admission-queue": "Every client path to that store passes through a Message Queue.",
  "latency-budget": "Sum of p99 along the slowest sync / cache-read path ≤ the budget.",
  "read-heavy-cache": "When reads dominate, a Cache or CDN is on the request path.",
  "queue-dlq": "Every queue connects (itself or via its consumers) to a queue labelled “dead letter” or “DLQ”.",
  unreachable: "Every component is reachable from a Client or Cron.",
  "load-shedding": "Where a node sends less than it receives, the grader names the assumption.",
  "queue-backlog": "Where a queue takes in more than it drains, the backlog growth is shown.",
  "replica-reads": "Reads served by a replica are called out as stale.",
  "cross-region-sync": "Synchronous calls between regions are called out.",
  "async-fanout": "A Pub/Sub topic or Message Queue on the request path is fed by an async connection, and no Worker is on a path the caller waits on.",
  "rate-limit-entry": "Every client path passes a Rate Limiter before its first App Service, Worker or data store.",
  "limiter-shared-state": "A Rate Limiter with 2+ replicas connects to a Cache or NoSQL store for shared counters.",
  "blob-through-app": "No App Service, API Gateway or Worker sits on a waited-on path from a Client to an Object Store.",
  "cdn-for-blobs": "A CDN on the request path connects to the Object Store.",
  "storage-capacity": "Storage of the persistent stores that count ≥ what the scenario needs.",
  "presence-store": "A store labelled “presence” is on the request path, and it is not persistent.",
  "durable-store": "A persistent SQL primary or NoSQL store is on the request path.",
};

export default async function ScenarioPage({ params }: { params: Promise<{ slug: string }> }) {
  const s = scenarioBySlug((await params).slug);
  if (!s) notFound();
  return (
    <Page>
      <div className="flex flex-wrap items-center gap-4 pt-10">
        <Link href="/scenarios" className="label hover:text-accent">
          ← Scenarios
        </Link>
        <Caption>Design scenario</Caption>
      </div>
      <DisplayHeading className="mt-6 text-[clamp(1.8rem,5vw,3.4rem)]">{s.title}</DisplayHeading>
      <p className="prose-serif mt-6 max-w-3xl text-ink-2" data-testid="scenario-summary">
        {s.summary}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/canvas/new?scenario=${s.slug}`} className="btn btn-primary" data-testid="start-blank">
          Design from scratch
        </Link>
        <Link href={`/canvas/new?scenario=${s.slug}&start=naive`} className="btn" data-testid="start-naive">
          Start from a naive design
        </Link>
        <Link href={`/canvas/new?scenario=${s.slug}&start=reference`} className="btn" data-testid="start-reference">
          Open a passing reference
        </Link>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="panel p-5">
          <p className="label">Functional requirements</p>
          <ul className="prose-serif mt-3 list-disc pl-5 text-ink-2">
            {s.functional.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
        <section className="panel p-5">
          <p className="label">Scale</p>
          <dl className="mt-3 grid gap-px border border-rule bg-rule font-mono text-[0.76rem]">
            {s.scale.notes.map((n) => (
              <div key={n.label} className="flex flex-wrap justify-between gap-2 bg-paper px-3 py-2">
                <dt className="text-ink-3">{n.label}</dt>
                <dd>{n.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className="panel mt-6 p-5" data-testid="scenario-constraints">
        <p className="label">Hard constraints and the rules that check them</p>
        <ol className="mt-3 grid gap-4">
          {s.constraints.map((c, i) => (
            <li key={c.id}>
              <p className="prose-serif text-ink">
                {i + 1}. {c.text}
              </p>
              <ul className="mt-1 grid gap-0.5 pl-5 font-mono text-[0.72rem] text-ink-2">
                {c.rules.map((r) => (
                  <li key={r}>
                    <span className="text-accent">{r}</span> · {RULE_TEXT[r]}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <p className="mt-4 font-mono text-[0.7rem] text-ink-3">
          Scoring: 100 − 15 per violation − 5 per warning, floor 0. Tradeoffs cost nothing. Pass = zero violations. p99 budget {s.params.p99BudgetMs} ms · read-heavy at ≥ {s.params.readHeavyRatio}:1. Load model: peak QPS leaves the clients split over their connections; load balancers and gateways pass it through; every other node sends its QPS out down each connection. Capacity = replicas × QPS in.
        </p>
      </section>
    </Page>
  );
}
