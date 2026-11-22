// The snapshot contract. The board renders this shape, and the snapshot generator
// produces it. Keys stay short because the legacy snapshot used them.

export type IssueState = "open" | "closed";

export interface Repo {
  /** Repository name, without the owner. */
  n: string;
  v: "public" | "private";
  /** Archived. */
  a: boolean;
}

export interface Issue {
  /** Issue URL on github.com. */
  u: string;
  /** Repository name. */
  r: string;
  /** Issue number. */
  n: number;
  title: string;
  t: IssueState;
  /** ISO 8601 timestamp of the last update. */
  d: string;
  /** Label names. */
  l: string[];
  /** Number of open issues in `b`. */
  blocked: number;
  /** Parent issue URL. */
  p: string | null;
  /** URLs of the issues that block this issue. */
  b: string[];
  /** URLs of the issues that this issue blocks. */
  g: string[];
  /** URLs of the sub-issues. */
  s: string[];
  /** The generator could not read all relation fields of this issue. */
  err: boolean;
}

/** Title and state of a related issue, keyed by URL. */
export type IssueRef = [title: string, state: IssueState];

export interface Snapshot {
  /** ISO 8601 time of the snapshot. */
  at: string;
  /**
   * ISO 8601 start of the closed-issue window: the snapshot holds the issues closed since then.
   * Absent in snapshots from the old generator, which took the 150 latest closed issues instead.
   */
  closedSince?: string;
  openTotal: number;
  repos: Repo[];
  issues: Issue[];
  refs: Record<string, IssueRef>;
  errors: number;
}
