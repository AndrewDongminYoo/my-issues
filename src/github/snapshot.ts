import type { Issue, IssueRef, IssueState, Repo, Snapshot } from "../types";
import {
  GitHubError,
  graphql,
  type GraphQLError,
  type GraphQLResult,
} from "./client";

// The rules follow the earlier snapshot generator (github-issue-snapshot.py):
// - repositories: the viewer's own repositories (owner affiliation), public and private;
// - issues: every open issue, plus the issues closed in the last CLOSED_DAYS days,
//   from the `user:<login> is:issue` search, newest update first;
// - `blocked`: GitHub's count of open blockers, else the open issues in `b`;
// - `err`: a relation list could not be read in full.
// The script made one REST call per relation; here one GraphQL search page carries them all.
// The script took the 150 most recently updated closed issues. A date window replaced that
// count, so the board can say which period "recently closed" covers.

export const CLOSED_DAYS = 14;
/** The search API returns at most 1,000 results. A larger set would give a partial board. */
const SEARCH_CAP = 1000;
const PAGE_SIZE = 50;
const RELATION_LIMIT = 50;

const REPOS_QUERY = `
query ($after: String) {
  viewer {
    login
    repositories(ownerAffiliations: [OWNER], first: 100, after: $after, orderBy: { field: NAME, direction: ASC }) {
      pageInfo { hasNextPage endCursor }
      nodes { name visibility isArchived }
    }
  }
}`;

const REF = "url title state";
const ISSUES_QUERY = `
query ($q: String!, $first: Int!, $after: String) {
  search(type: ISSUE, query: $q, first: $first, after: $after) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on Issue {
        url number title state updatedAt
        repository { name }
        labels(first: 30) { totalCount nodes { name } }
        parent { ${REF} }
        issueDependenciesSummary { blockedBy totalBlockedBy totalBlocking }
        subIssuesSummary { total }
        blockedBy(first: ${RELATION_LIMIT}) { totalCount nodes { ${REF} } }
        blocking(first: ${RELATION_LIMIT}) { totalCount nodes { ${REF} } }
        subIssues(first: ${RELATION_LIMIT}) { totalCount nodes { ${REF} } }
      }
    }
  }
}`;

type GqlState = "OPEN" | "CLOSED";

export interface GqlRef {
  url: string;
  title: string;
  state: GqlState;
}

interface Connection<T> {
  totalCount: number;
  nodes: (T | null)[] | null;
}

export interface GqlIssue {
  url: string;
  number: number;
  title: string;
  state: GqlState;
  updatedAt: string;
  repository: { name: string };
  labels: Connection<{ name: string }> | null;
  parent: GqlRef | null;
  issueDependenciesSummary: {
    blockedBy: number;
    totalBlockedBy: number;
    totalBlocking: number;
  } | null;
  subIssuesSummary: { total: number } | null;
  blockedBy: Connection<GqlRef> | null;
  blocking: Connection<GqlRef> | null;
  subIssues: Connection<GqlRef> | null;
}

interface SearchPage {
  search: {
    issueCount: number;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: (Partial<GqlIssue> | null)[];
  };
}

interface ReposPage {
  viewer: {
    login: string;
    repositories: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: ({
        name: string;
        visibility: string;
        isArchived: boolean;
      } | null)[];
    };
  };
}

const state = (s: GqlState): IssueState => (s === "OPEN" ? "open" : "closed");

/**
 * Maps one search result to the snapshot shape. `partial` is true when GitHub reported an
 * error inside this issue, for example a related issue in a repository the token cannot read.
 */
export function toIssue(
  node: GqlIssue,
  partial = false,
): { issue: Issue; refs: Record<string, IssueRef> } {
  const refs: Record<string, IssueRef> = {
    [node.url]: [node.title, state(node.state)],
  };
  let err = partial;
  const record = (ref: GqlRef) => {
    refs[ref.url] = [ref.title, state(ref.state)];
    return ref.url;
  };
  const list = (
    connection: Connection<GqlRef> | null,
    expected: number | undefined,
  ) => {
    const nodes = connection?.nodes ?? [];
    const urls = [...new Set(nodes.flatMap((n) => (n ? [record(n)] : [])))];
    if (
      !connection ||
      nodes.length !== urls.length ||
      urls.length < connection.totalCount
    )
      err = true;
    if (expected !== undefined && urls.length !== expected) err = true;
    return urls;
  };
  const deps = node.issueDependenciesSummary;
  const b = list(node.blockedBy, deps?.totalBlockedBy);
  const g = list(node.blocking, deps?.totalBlocking);
  const s = list(node.subIssues, node.subIssuesSummary?.total);
  const issue: Issue = {
    b,
    blocked: deps?.blockedBy || b.filter((u) => refs[u]?.[1] === "open").length,
    d: node.updatedAt,
    err,
    g,
    l: (node.labels?.nodes ?? []).flatMap((x) => (x ? [x.name] : [])),
    n: node.number,
    p: node.parent ? record(node.parent) : null,
    r: node.repository.name,
    s,
    t: state(node.state),
    title: node.title,
    u: node.url,
  };
  return { issue, refs };
}

/** Index of the search node that a GraphQL error points into, if any. */
function nodeIndex(error: GraphQLError): number | null {
  const [root, field, index] = error.path ?? [];
  return root === "search" && field === "nodes" && typeof index === "number"
    ? index
    : null;
}

/** `filter` holds the state qualifiers, for example `is:closed closed:>=2026-11-08T00:00:00Z`. */
async function searchIssues(
  token: string,
  login: string,
  filter: string,
  label: IssueState,
) {
  const q = `user:${login} is:issue ${filter} sort:updated-desc`;
  const rows: { node: GqlIssue; partial: boolean }[] = [];
  let after: string | null = null;
  let target = 0;
  do {
    const result: GraphQLResult<SearchPage> = await graphql<SearchPage>(
      token,
      ISSUES_QUERY,
      {
        after,
        first: PAGE_SIZE,
        q,
      },
    );
    const { data, errors } = result;
    const { issueCount, nodes, pageInfo } = data.search;
    target = issueCount;
    if (target > SEARCH_CAP) {
      throw new GitHubError(
        `${label} 이슈가 ${issueCount}건으로 검색 한도(1,000건)를 넘어 일부만 표시하게 됩니다.`,
      );
    }
    const broken = new Set(errors.map(nodeIndex).filter((i) => i !== null));
    nodes.forEach((node, i) => {
      if (node?.url)
        rows.push({ node: node as GqlIssue, partial: broken.has(i) });
    });
    after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (after && rows.length < target);
  if (rows.length < target) {
    throw new GitHubError(
      `${label} 이슈를 ${target}건 중 ${rows.length}건만 받았습니다. 다시 불러와 주세요.`,
    );
  }
  return rows;
}

async function fetchRepos(
  token: string,
): Promise<{ login: string; repos: Repo[] }> {
  const repos: Repo[] = [];
  let login = "";
  let after: string | null = null;
  do {
    const result: GraphQLResult<ReposPage> = await graphql<ReposPage>(
      token,
      REPOS_QUERY,
      { after },
    );
    const { data } = result;
    login = data.viewer.login;
    for (const r of data.viewer.repositories.nodes) {
      if (r)
        repos.push({
          a: r.isArchived,
          n: r.name,
          v: r.visibility === "PUBLIC" ? "public" : "private",
        });
    }
    const { hasNextPage, endCursor } = data.viewer.repositories.pageInfo;
    after = hasNextPage ? endCursor : null;
  } while (after);
  return { login, repos };
}

/** Reads the viewer's repositories and issues and returns them in the snapshot shape. */
export async function fetchSnapshot(
  token: string,
  login: string,
  now = new Date(),
): Promise<Snapshot> {
  // Search accepts ISO 8601 date-times without milliseconds.
  const closedSince = new Date(now.getTime() - CLOSED_DAYS * 86_400_000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
  const [{ repos }, open, closed] = await Promise.all([
    fetchRepos(token),
    searchIssues(token, login, "is:open", "open"),
    searchIssues(token, login, `is:closed closed:>=${closedSince}`, "closed"),
  ]);
  const rows = [...open, ...closed];
  if (new Set(rows.map((r) => r.node.url)).size !== rows.length) {
    throw new GitHubError(
      "불러오는 동안 이슈 상태가 바뀌었습니다. 다시 불러와 주세요.",
    );
  }
  const names = new Set(repos.map((r) => r.n.toLowerCase()));
  if (rows.some((r) => !names.has(r.node.repository.name.toLowerCase()))) {
    throw new GitHubError(
      "검색 결과와 저장소 목록이 맞지 않습니다. 다시 불러와 주세요.",
    );
  }
  const snapshot: Snapshot = {
    at: now.toISOString(),
    closedSince,
    errors: 0,
    issues: [],
    openTotal: open.length,
    refs: {},
    repos,
  };
  for (const { node, partial } of rows) {
    const { issue, refs } = toIssue(node, partial);
    snapshot.issues.push(issue);
    Object.assign(snapshot.refs, refs);
    snapshot.errors += Number(issue.err);
  }
  return snapshot;
}
