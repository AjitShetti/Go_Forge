import { REPO_URL, issueUrl } from "@/lib/site";

const LINKS = [
  { href: issueUrl("bug_report.yml"), label: "Report a bug", testId: "footer-report-bug" },
  { href: REPO_URL, label: "Source on GitHub", testId: "footer-github" },
  { href: `${REPO_URL}/blob/main/CONTRIBUTING.md`, label: "Contribute", testId: "footer-contribute" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-rule bg-paper/95" data-testid="site-footer">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-6 sm:px-8">
        <p className="prose-serif text-[0.98rem] text-ink-2">Found something wrong, or want to add a lesson? The whole project is open on GitHub.</p>
        <nav aria-label="Project" className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {LINKS.map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer" data-testid={l.testId} className="font-mono text-[0.76rem] tracking-[0.12em] uppercase hover:text-blue">
              {l.label} ↗
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
