// Where the source lives, and links that open a GitHub issue form with the
// fields a report needs already filled in (.github/ISSUE_TEMPLATE/*.yml: each
// query parameter names a form field id).
export const REPO_URL = "https://github.com/AjitShetti/Go_Forge";
export const SITE_URL = "https://go-forge.vercel.app";

type Template = "bug_report.yml" | "lesson_problem.yml";

export function issueUrl(template: Template, fields: Record<string, string> = {}): string {
  const q = new URLSearchParams({ template, ...fields });
  return `${REPO_URL}/issues/new?${q}`;
}
