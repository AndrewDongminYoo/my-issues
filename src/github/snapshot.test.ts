import { describe, expect, it } from "vitest";
import { toIssue, type GqlIssue, type GqlRef } from "./snapshot";

const url = (n: number) => `https://github.com/o/repo/issues/${n}`;
const ref = (n: number, state: GqlRef["state"] = "OPEN"): GqlRef => ({ state, title: `t${n}`, url: url(n) });
const conn = (...nodes: (GqlRef | null)[]) => ({ nodes, totalCount: nodes.length });

const node = (patch: Partial<GqlIssue> = {}): GqlIssue => ({
  blockedBy: conn(),
  blocking: conn(),
  issueDependenciesSummary: { blockedBy: 0, totalBlockedBy: 0, totalBlocking: 0 },
  labels: { nodes: [{ name: "linux" }], totalCount: 1 },
  number: 1,
  parent: null,
  repository: { name: "repo" },
  state: "OPEN",
  subIssues: conn(),
  subIssuesSummary: { total: 0 },
  title: "Issue one",
  updatedAt: "2026-11-22T01:20:15Z",
  url: url(1),
  ...patch,
});

describe("toIssue", () => {
  it("maps the fields and records every related issue in refs", () => {
    const { issue, refs } = toIssue(
      node({
        blockedBy: conn(ref(2), ref(3, "CLOSED")),
        issueDependenciesSummary: { blockedBy: 1, totalBlockedBy: 2, totalBlocking: 0 },
        parent: ref(9),
        subIssues: conn(ref(4)),
        subIssuesSummary: { total: 1 },
      }),
    );
    expect(issue).toEqual({
      b: [url(2), url(3)],
      blocked: 1,
      d: "2026-11-22T01:20:15Z",
      err: false,
      g: [],
      l: ["linux"],
      n: 1,
      p: url(9),
      r: "repo",
      s: [url(4)],
      t: "open",
      title: "Issue one",
      u: url(1),
    });
    expect(refs).toEqual({
      [url(1)]: ["Issue one", "open"],
      [url(2)]: ["t2", "open"],
      [url(3)]: ["t3", "closed"],
      [url(4)]: ["t4", "open"],
      [url(9)]: ["t9", "open"],
    });
  });

  it("counts the open blockers when GitHub gives no open count", () => {
    const { issue } = toIssue(
      node({
        blockedBy: conn(ref(2), ref(3, "CLOSED")),
        issueDependenciesSummary: { blockedBy: 0, totalBlockedBy: 2, totalBlocking: 0 },
      }),
    );
    expect(issue.blocked).toBe(1);
    expect(issue.err).toBe(false);
  });

  it("marks an issue whose relation list is truncated", () => {
    const { issue } = toIssue(node({ blocking: { nodes: [ref(2)], totalCount: 60 } }));
    expect(issue.err).toBe(true);
  });

  it("marks an issue whose relation list disagrees with the summary", () => {
    const { issue } = toIssue(node({ subIssues: conn(ref(2)), subIssuesSummary: { total: 2 } }));
    expect(issue.err).toBe(true);
  });

  it("marks an issue with an unreadable related issue and keeps the readable ones", () => {
    const { issue } = toIssue(
      node({
        blockedBy: conn(ref(2), null),
        issueDependenciesSummary: { blockedBy: 2, totalBlockedBy: 2, totalBlocking: 0 },
      }),
    );
    expect(issue.b).toEqual([url(2)]);
    expect(issue.err).toBe(true);
  });

  it("marks an issue that GitHub reported a partial error for", () => {
    expect(toIssue(node(), true).issue.err).toBe(true);
    expect(toIssue(node()).issue.err).toBe(false);
  });
});
