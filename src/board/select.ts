import type { Issue, IssueState, Repo, Snapshot } from "../types";

export type Visibility = Repo["v"] | "all";
export type SortKey = "count" | "date" | "name";
export type StateTab = IssueState | "all";

export interface Filters {
  query: string;
  visibility: Visibility;
  onlyBlocked: boolean;
  onlyRelated: boolean;
}

export type Relation = [label: string, urls: string[]];

/** The non-empty relation groups of an issue, in display order. */
export function relations(issue: Issue): Relation[] {
  const all: Relation[] = [
    ["상위 이슈", issue.p ? [issue.p] : []],
    ["선행 이슈", issue.b],
    ["이 이슈가 막음", issue.g],
    ["하위 이슈", issue.s],
  ];
  return all.filter(([, urls]) => urls.length > 0);
}

export function isOpenAndBlocked(issue: Issue): boolean {
  return issue.t === "open" && issue.blocked > 0;
}

/** Applies the search box and the filter controls. The state tab is applied later. */
export function filterIssues(snapshot: Snapshot, filters: Filters): Issue[] {
  const repos = new Map(snapshot.repos.map((r) => [r.n, r]));
  const query = filters.query.trim().toLowerCase();
  return snapshot.issues.filter((issue) => {
    if (
      filters.visibility !== "all" &&
      repos.get(issue.r)?.v !== filters.visibility
    )
      return false;
    if (filters.onlyBlocked && !isOpenAndBlocked(issue)) return false;
    const rels = relations(issue);
    if (filters.onlyRelated && rels.length === 0) return false;
    if (!query) return true;
    const haystack = [
      issue.r,
      `#${issue.n}`,
      issue.title,
      ...issue.l,
      ...rels.flatMap(([, urls]) =>
        urls.map((u) => `${u} ${snapshot.refs[u]?.[0] ?? ""}`),
      ),
    ];
    return haystack.join(" ").toLowerCase().includes(query);
  });
}

export type RepoGroup = [repo: string, issues: Issue[]];

/** Groups the issues in the given state tab by repository and sorts the groups. */
export function groupByRepo(
  issues: Issue[],
  tab: StateTab,
  sort: SortKey,
): RepoGroup[] {
  const groups = new Map<string, Issue[]>();
  for (const issue of issues) {
    if (tab !== "all" && issue.t !== tab) continue;
    const list = groups.get(issue.r) ?? [];
    list.push(issue);
    groups.set(issue.r, list);
  }
  return [...groups].sort((a, b) => {
    if (sort === "name") return a[0].localeCompare(b[0]);
    if (sort === "date") return latest(b[1]).localeCompare(latest(a[1]));
    return b[1].length - a[1].length || a[0].localeCompare(b[0]);
  });
}

function latest(issues: Issue[]): string {
  return issues.reduce((max, i) => (i.d > max ? i.d : max), "");
}

export function countByState(
  issues: Issue[],
  repo: string,
  tab: StateTab,
): number {
  return issues.filter((i) => i.r === repo && (tab === "all" || i.t === tab))
    .length;
}

/** Formats an ISO timestamp as a KST date, for example 2026.11.22. */
export function formatKstDate(iso: string): string {
  const kst = new Date(new Date(iso).getTime() + 9 * 3_600_000);
  return kst.toISOString().slice(0, 10).replaceAll("-", ".");
}

/** Formats an ISO timestamp as a KST date and time, for example 2026. 11. 22. 10:30 KST. */
export function formatKstDateTime(iso: string): string {
  const kst = new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString();
  const [y, m, d] = kst.slice(0, 10).split("-");
  return `${y}. ${m}. ${d}. ${kst.slice(11, 16)} KST`;
}

/** The title of the closed-issue count, with the start of the window when the snapshot has one. */
export function closedTitle(snapshot: Snapshot): string {
  return snapshot.closedSince
    ? `${formatKstDate(snapshot.closedSince)} 이후 닫힌 이슈`
    : "최근 닫힌 이슈";
}

/** One sentence that says which closed issues the board holds. */
export function closedScope(snapshot: Snapshot): string {
  if (!snapshot.closedSince)
    return "닫힌 이슈는 최근에 수정된 150건까지만 포함합니다.";
  const days = Math.round(
    (Date.parse(snapshot.at) - Date.parse(snapshot.closedSince)) / 86_400_000,
  );
  return `닫힌 이슈는 ${formatKstDateTime(snapshot.closedSince)} 이후(최근 ${days}일)에 닫힌 것만 포함합니다.`;
}

/** Only github.com links may be rendered as hrefs. */
export function safeUrl(url: string): string {
  return /^https:\/\/github\.com\//.test(url) ? url : "#";
}
