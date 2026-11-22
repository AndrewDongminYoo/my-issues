const ENDPOINT = "https://api.github.com/graphql";

/** GitHub rejected the token itself (HTTP 401). The caller should sign the user out. */
export class AuthError extends Error {
  override name = "AuthError";
}

export class GitHubError extends Error {
  override name = "GitHubError";
}

export interface GraphQLError {
  message: string;
  path?: (string | number)[];
  type?: string;
}

export interface GraphQLResult<T> {
  data: T;
  /** Errors for single nodes, for example a FORBIDDEN repository. The rest of `data` is still valid. */
  errors: GraphQLError[];
}

/**
 * Runs one GraphQL request. Partial errors come back with the data, because across many
 * repositories one inaccessible node must not discard the rest. Throws only when there is no data.
 */
export async function graphql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<GraphQLResult<T>> {
  const response = await fetch(ENDPOINT, {
    body: JSON.stringify({ query, variables }),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    method: "POST",
  });
  if (response.status === 401) throw new AuthError("GitHub가 토큰을 거부했습니다. 만료되었거나 폐기된 토큰인지 확인해 주세요.");
  if (!response.ok) throw new GitHubError(`GitHub API가 HTTP ${response.status} 오류를 반환했습니다.`);
  const body = (await response.json()) as { data?: T | null; errors?: GraphQLError[] };
  const errors = body.errors ?? [];
  if (!body.data) {
    const detail = errors.map((e) => e.message).join("; ");
    throw new GitHubError(detail || "GitHub API 응답에 데이터가 없습니다.");
  }
  return { data: body.data, errors };
}
