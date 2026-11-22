import { graphql, GitHubError } from "./client";

const BODY_QUERY = `
query ($url: URI!) {
  resource(url: $url) {
    ... on Issue { body }
  }
}`;

/** Reads one issue's body (Markdown) on demand, so the board does not load every body up front. */
export async function fetchIssueBody(
  token: string,
  url: string,
): Promise<string> {
  const { data } = await graphql<{ resource: { body?: string } | null }>(
    token,
    BODY_QUERY,
    { url },
  );
  if (typeof data.resource?.body !== "string") {
    throw new GitHubError("이슈 본문을 읽을 수 없습니다.");
  }
  return data.resource.body;
}
