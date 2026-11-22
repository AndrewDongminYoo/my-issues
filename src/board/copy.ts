import type { Issue } from "../types";

/**
 * Formats an issue as Markdown for the clipboard:
 * a heading with the repository, number and title, a line with the URL, state and labels,
 * then the body as GitHub stores it.
 */
export function issueMarkdown(issue: Issue, body: string): string {
  const meta = [
    issue.u,
    issue.t,
    ...(issue.l.length ? [issue.l.join(", ")] : []),
  ];
  const parts = [`## ${issue.r}#${issue.n} ${issue.title}`, meta.join(" · ")];
  const text = body.trim();
  if (text) parts.push(text);
  return `${parts.join("\n\n")}\n`;
}
