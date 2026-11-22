import { describe, expect, it } from "vitest";
import type { Issue, Snapshot } from "../types";
import {
  closedScope,
  closedTitle,
  countByState,
  filterIssues,
  formatKstDate,
  formatKstDateTime,
  groupByRepo,
  relations,
  safeUrl,
} from "./select";

const url = (repo: string, n: number) =>
  `https://github.com/o/${repo}/issues/${n}`;

const issue = (repo: string, n: number, patch: Partial<Issue> = {}): Issue => ({
  b: [],
  blocked: 0,
  d: "2026-11-20T00:00:00Z",
  err: false,
  g: [],
  l: [],
  n,
  p: null,
  r: repo,
  s: [],
  t: "open",
  title: `issue ${n}`,
  u: url(repo, n),
  ...patch,
});

const snapshot: Snapshot = {
  at: "2026-11-22T01:30:24Z",
  errors: 0,
  issues: [
    issue("alpha", 1, { b: [url("alpha", 9)], blocked: 1, l: ["linux"] }),
    issue("alpha", 2, { d: "2026-11-21T00:00:00Z", t: "closed" }),
    issue("beta", 3, { d: "2026-11-22T00:00:00Z", p: url("beta", 8) }),
    issue("secret", 4),
  ],
  openTotal: 3,
  refs: {
    [url("alpha", 9)]: ["Ship the parser", "open"],
    [url("beta", 8)]: ["Epic", "open"],
  },
  repos: [
    { a: false, n: "alpha", v: "public" },
    { a: true, n: "beta", v: "public" },
    { a: false, n: "secret", v: "private" },
  ],
};

const base = {
  onlyBlocked: false,
  onlyRelated: false,
  query: "",
  visibility: "all" as const,
};

describe("relations", () => {
  it("returns only the non-empty groups, parent first", () => {
    expect(relations(snapshot.issues[2]!)).toEqual([
      ["상위 이슈", [url("beta", 8)]],
    ]);
    expect(relations(snapshot.issues[3]!)).toEqual([]);
  });
});

describe("filterIssues", () => {
  it("filters by repository visibility", () => {
    expect(
      filterIssues(snapshot, { ...base, visibility: "private" }).map(
        (i) => i.n,
      ),
    ).toEqual([4]);
    expect(
      filterIssues(snapshot, { ...base, visibility: "public" }),
    ).toHaveLength(3);
  });

  it("keeps only open blocked issues", () => {
    expect(
      filterIssues(snapshot, { ...base, onlyBlocked: true }).map((i) => i.n),
    ).toEqual([1]);
  });

  it("keeps only issues with relations", () => {
    expect(
      filterIssues(snapshot, { ...base, onlyRelated: true }).map((i) => i.n),
    ).toEqual([1, 3]);
  });

  it("searches the titles of related issues, case-insensitively", () => {
    expect(
      filterIssues(snapshot, { ...base, query: "  PARSER " }).map((i) => i.n),
    ).toEqual([1]);
    expect(
      filterIssues(snapshot, { ...base, query: "#3" }).map((i) => i.n),
    ).toEqual([3]);
    expect(
      filterIssues(snapshot, { ...base, query: "linux" }).map((i) => i.n),
    ).toEqual([1]);
  });
});

describe("groupByRepo", () => {
  const rows = filterIssues(snapshot, base);

  it("applies the state tab", () => {
    expect(groupByRepo(rows, "closed", "count")).toEqual([
      ["alpha", [snapshot.issues[1]]],
    ]);
  });

  it("sorts by count, then by name", () => {
    expect(groupByRepo(rows, "all", "count").map(([r]) => r)).toEqual([
      "alpha",
      "beta",
      "secret",
    ]);
  });

  it("sorts by the latest update in each repository", () => {
    expect(groupByRepo(rows, "all", "date").map(([r]) => r)).toEqual([
      "beta",
      "alpha",
      "secret",
    ]);
  });

  it("counts a repository's issues per tab", () => {
    expect(countByState(rows, "alpha", "open")).toBe(1);
    expect(countByState(rows, "alpha", "all")).toBe(2);
  });
});

describe("formatting", () => {
  it("shows dates in KST", () => {
    expect(formatKstDate("2026-11-21T15:30:00Z")).toBe("2026.11.22");
    expect(formatKstDateTime("2026-11-22T01:30:24Z")).toBe(
      "2026. 11. 22. 10:30 KST",
    );
  });

  it("names the closed-issue window in KST", () => {
    const windowed = {
      ...snapshot,
      at: "2026-11-22T05:00:00Z",
      closedSince: "2026-11-08T05:00:00Z",
    };
    expect(closedTitle(windowed)).toBe("2026.11.08 이후 닫힌 이슈");
    expect(closedScope(windowed)).toBe(
      "닫힌 이슈는 2026. 11. 08. 14:00 KST 이후(최근 14일)에 닫힌 것만 포함합니다.",
    );
    expect(closedTitle(snapshot)).toBe("최근 닫힌 이슈");
  });

  it("allows only github.com links", () => {
    expect(safeUrl("https://github.com/o/r/issues/1")).toBe(
      "https://github.com/o/r/issues/1",
    );
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl("https://github.com.evil.example/x")).toBe("#");
  });
});
