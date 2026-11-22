import { describe, expect, it } from "vitest";
import type { Issue } from "../types";
import { issueMarkdown } from "./copy";

const issue: Issue = {
  b: [],
  blocked: 0,
  d: "2026-11-22T01:20:15Z",
  err: false,
  g: [],
  l: ["linux", "external"],
  n: 173,
  p: null,
  r: "prep_book",
  s: [],
  t: "open",
  title: "Show a status as a status",
  u: "https://github.com/o/prep_book/issues/173",
};

describe("issueMarkdown", () => {
  it("puts the number and title in a heading, then the link line, then the body", () => {
    expect(issueMarkdown(issue, "## Outcome\n\nDone.\n")).toBe(
      [
        "## prep_book#173 Show a status as a status",
        "",
        "https://github.com/o/prep_book/issues/173 · open · linux, external",
        "",
        "## Outcome",
        "",
        "Done.",
        "",
      ].join("\n"),
    );
  });

  it("leaves out empty labels and an empty body", () => {
    expect(issueMarkdown({ ...issue, l: [], t: "closed" }, "  \n")).toBe(
      "## prep_book#173 Show a status as a status\n\nhttps://github.com/o/prep_book/issues/173 · closed\n",
    );
  });
});
