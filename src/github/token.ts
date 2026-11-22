import { AuthError, graphql } from "./client";

const STORAGE_KEY = "my-issues.github-token";

export function loadToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function saveToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export interface Viewer {
  login: string;
  avatarUrl: string;
}

/** Confirms that the token works and returns its owner. Throws AuthError if GitHub rejects it. */
export async function fetchViewer(token: string): Promise<Viewer> {
  const { data } = await graphql<{ viewer: Viewer | null }>(token, "query { viewer { login avatarUrl } }");
  if (!data.viewer) throw new AuthError("토큰으로 GitHub 사용자를 확인할 수 없습니다.");
  return data.viewer;
}
