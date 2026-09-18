import { REPO_URL, issueUrl } from "@/lib/site";

const LINKS = [
  { href: issueUrl("bug_report.yml"), label: "Report a bug", testId: "footer-report-bug" },
  { href: REPO_URL, label: "Source on GitHub", testId: "footer-github" },
  { href: `${REPO_URL}/blob/main/CONTRIBUTING.md`, label: "Contribute", testId: "footer-contribute" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-rule" data-testid="site-footer">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="font-display text-[1.6rem] font-extrabold tracking-[-0.01em]">
            <span className="text-accent">Go</span>Forge
          </p>
          <p className="mt-2 max-w-md text-[0.92rem] text-ink-3">Found something wrong, or want to add a lesson? The whole project is open on GitHub.</p>
        </div>
        <nav aria-label="Project" className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {LINKS.map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer" data-testid={l.testId} className="text-[0.88rem] font-medium text-ink-2 transition-colors hover:text-accent">
              {l.label} ↗
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
