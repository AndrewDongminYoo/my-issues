import { useCallback, useEffect, useState } from "react";
import { closedScope, formatKstDateTime } from "./board/select";
import { Board } from "./components/Board";
import { Layout } from "./components/Layout";
import { TokenForm } from "./components/TokenForm";
import { AuthError } from "./github/client";
import { fetchIssueBody } from "./github/issue";
import { fetchSnapshot } from "./github/snapshot";
import {
  clearToken,
  fetchViewer,
  loadToken,
  saveToken,
  type Viewer,
} from "./github/token";
import type { Snapshot } from "./types";

type State =
  | { kind: "signedOut"; error: string | null }
  | { kind: "loading"; viewer: Viewer | null }
  | {
      kind: "ready";
      viewer: Viewer | null;
      snapshot: Snapshot;
      source: "github" | "fixture";
    }
  | { kind: "failed"; viewer: Viewer | null; error: string };

// Dev only: `?fixture` renders local/snapshot.json, which the dev server serves (see vite.config.ts).
const useFixture =
  import.meta.env.DEV && new URLSearchParams(location.search).has("fixture");

export function App() {
  const [token, setToken] = useState(loadToken);
  const [state, setState] = useState<State>(() =>
    useFixture || token
      ? { kind: "loading", viewer: null }
      : { kind: "signedOut", error: null },
  );

  const load = useCallback(async (value: string) => {
    setState({ kind: "loading", viewer: null });
    let viewer: Viewer | null = null;
    try {
      viewer = await fetchViewer(value);
      setState({ kind: "loading", viewer });
      const snapshot = await fetchSnapshot(value, viewer.login);
      setState({ kind: "ready", snapshot, source: "github", viewer });
    } catch (error) {
      if (error instanceof AuthError) {
        clearToken();
        setToken(null);
        setState({
          kind: "signedOut",
          error: `토큰을 사용할 수 없습니다: ${error.message}`,
        });
        return;
      }
      setState({
        kind: "failed",
        error: String(error instanceof Error ? error.message : error),
        viewer,
      });
    }
  }, []);

  useEffect(() => {
    if (useFixture) {
      fetch(`${import.meta.env.BASE_URL}__fixture/snapshot.json`)
        .then((r) =>
          r.ok
            ? (r.json() as Promise<Snapshot>)
            : Promise.reject(new Error(`HTTP ${r.status}`)),
        )
        .then((snapshot) =>
          setState({
            kind: "ready",
            snapshot,
            source: "fixture",
            viewer: null,
          }),
        )
        .catch((e: unknown) =>
          setState({
            kind: "failed",
            error: `fixture: ${String(e)}`,
            viewer: null,
          }),
        );
    } else if (token) {
      void load(token);
    }
    // Runs once on mount; sign-in calls load() directly.
  }, []);

  const signIn = (value: string) => {
    saveToken(value);
    setToken(value);
    void load(value);
  };

  const signOut = () => {
    clearToken();
    setToken(null);
    setState({ kind: "signedOut", error: null });
  };

  const viewer = state.kind === "signedOut" ? null : state.viewer;

  return (
    <Layout
      viewer={viewer}
      subtitle={subtitle(state)}
      onSignOut={token ? signOut : undefined}
    >
      {state.kind === "signedOut" && (
        <TokenForm error={state.error} onSubmit={signIn} />
      )}
      {state.kind === "loading" && (
        <p className="empty">GitHub에서 이슈를 불러오는 중입니다…</p>
      )}
      {state.kind === "failed" && (
        <div className="panel tokenform">
          <p className="error" role="alert">
            이슈를 불러오지 못했습니다: {state.error}
          </p>
          {token && (
            <button
              type="button"
              className="filterbtn"
              onClick={() => void load(token)}
            >
              다시 시도
            </button>
          )}
        </div>
      )}
      {state.kind === "ready" && (
        <>
          <Board
            snapshot={state.snapshot}
            loadBody={
              token && state.source === "github"
                ? (url) => fetchIssueBody(token, url)
                : undefined
            }
          />
          <footer className="foot">
            {state.source === "fixture"
              ? "로컬 fixture 데이터"
              : "GitHub API에서 불러온 데이터"}{" "}
            · PR 제외 · {closedScope(state.snapshot)} 최신 상태는 다시 불러와야
            반영됩니다.{" "}
            {token && state.source === "github" && (
              <button
                type="button"
                className="linkbtn"
                onClick={() => void load(token)}
              >
                다시 불러오기
              </button>
            )}
          </footer>
        </>
      )}
    </Layout>
  );
}

function subtitle(state: State): string {
  switch (state.kind) {
    case "ready":
      return `불러온 시각  ${formatKstDateTime(state.snapshot.at)}`;
    case "loading":
      return "불러오는 중";
    case "signedOut":
      return "GitHub 연결 필요";
    case "failed":
      return "불러오기 실패";
  }
}
