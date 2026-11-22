import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  closedTitle,
  countByState,
  filterIssues,
  formatKstDate,
  groupByRepo,
  isOpenAndBlocked,
  relations,
  safeUrl,
  type Filters,
  type SortKey,
  type StateTab,
  type Visibility,
} from "../board/select";
import { issueMarkdown } from "../board/copy";
import type { Issue, Snapshot } from "../types";
import { Icon, type IconName } from "./Icon";

const TABS: [StateTab, string][] = [
  ["open", "열린 이슈"],
  ["closed", "닫힌 이슈"],
  ["all", "전체"],
];

/** Reads an issue body by URL. Absent when there is no token, as with the dev fixture. */
type LoadBody = (url: string) => Promise<string>;

export function Board({
  snapshot,
  loadBody,
}: {
  snapshot: Snapshot;
  loadBody?: LoadBody;
}) {
  const [filters, setFilters] = useState<Filters>({
    onlyBlocked: false,
    onlyRelated: false,
    query: "",
    visibility: "public",
  });
  const [sort, setSort] = useState<SortKey>("count");
  const [tab, setTab] = useState<StateTab>("open");
  const [selected, setSelected] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const repos = useMemo(
    () => new Map(snapshot.repos.map((r) => [r.n, r])),
    [snapshot],
  );
  const rows = useMemo(
    () => filterIssues(snapshot, filters),
    [snapshot, filters],
  );
  const groups = useMemo(() => groupByRepo(rows, tab, sort), [rows, tab, sort]);
  const current = groups.some(([r]) => r === selected)
    ? selected
    : (groups[0]?.[0] ?? "");
  const issues = groups.find(([r]) => r === current)?.[1] ?? [];
  const repo = repos.get(current);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName ?? "";
      if (
        e.key === "/" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !["INPUT", "SELECT", "TEXTAREA"].includes(tag)
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const update = (patch: Partial<Filters>) =>
    setFilters((f) => ({ ...f, ...patch }));
  const total = groups.reduce((n, [, a]) => n + a.length, 0);

  return (
    <>
      <Stats snapshot={snapshot} />
      <div className="browse">
        <h2>이슈 탐색기</h2>
        <span aria-live="polite">
          이슈 {total}건 · 저장소 {groups.length}개
        </span>
      </div>
      <div className="filters">
        <label className="search">
          <Icon name="search" />
          <input
            ref={searchRef}
            type="search"
            aria-label="이슈 검색"
            placeholder="제목, 번호, 라벨, 연결 이슈 검색"
            value={filters.query}
            onChange={(e) => update({ query: e.target.value })}
          />
          <kbd>/</kbd>
        </label>
        <select
          aria-label="저장소 공개 범위"
          value={filters.visibility}
          onChange={(e) => update({ visibility: e.target.value as Visibility })}
        >
          <option value="public">공개 저장소</option>
          <option value="private">비공개 저장소</option>
          <option value="all">모든 저장소</option>
        </select>
        <select
          aria-label="저장소 정렬"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          <option value="count">이슈 많은 순</option>
          <option value="date">최근 업데이트순</option>
          <option value="name">저장소 이름순</option>
        </select>
        <button
          type="button"
          className="filterbtn"
          aria-expanded={showExtra}
          aria-controls="extra"
          onClick={() => setShowExtra((x) => !x)}
        >
          <Icon name="filter" />
          상세 필터
        </button>
      </div>
      <div className="extra" id="extra" hidden={!showExtra}>
        <label>
          <input
            type="checkbox"
            checked={filters.onlyBlocked}
            onChange={(e) => update({ onlyBlocked: e.target.checked })}
          />{" "}
          열린 차단 요인이 있는 이슈만
        </label>
        <label>
          <input
            type="checkbox"
            checked={filters.onlyRelated}
            onChange={(e) => update({ onlyRelated: e.target.checked })}
          />{" "}
          연결된 이슈가 있는 항목만
        </label>
      </div>
      <select
        className="mobileRepo"
        aria-label="저장소 선택"
        value={current}
        onChange={(e) => setSelected(e.target.value)}
      >
        {groups.map(([r, a]) => (
          <option key={r} value={r}>
            {r} ({a.length})
          </option>
        ))}
      </select>
      <div className="workspace">
        <aside className="panel">
          <div className="panelhead">
            저장소 목록 <span>{groups.length}개</span>
          </div>
          <nav className="repos" aria-label="저장소 목록">
            {groups.map(([r, a]) => (
              <button
                key={r}
                type="button"
                className={`repo ${r === current ? "active" : ""}`}
                aria-pressed={r === current}
                onClick={() => setSelected(r)}
              >
                <Icon name="repo" />
                <span>{r}</span>
                <em>{a.length}</em>
              </button>
            ))}
          </nav>
        </aside>
        <section className="panel">
          <div className="contenthead">
            <div className="row">
              <span className="repoico">
                <Icon name="repo" />
              </span>
              <h2>{current || "검색 결과"}</h2>
              {repo && (
                <span className="chip">
                  {repo.v === "public" ? "공개" : "비공개"}
                  {repo.a ? " · 보관됨" : ""}
                </span>
              )}
            </div>
          </div>
          <div className="tabs" aria-label="이슈 상태">
            {TABS.map(([s, label]) => (
              <button
                key={s}
                type="button"
                aria-pressed={s === tab}
                className={s === tab ? "sel" : ""}
                onClick={() => setTab(s)}
              >
                {label} <span>{countByState(rows, current, s)}</span>
              </button>
            ))}
          </div>
          <div>
            {issues.length ? (
              issues.map((issue) => (
                <IssueRow
                  key={issue.u}
                  issue={issue}
                  refs={snapshot.refs}
                  loadBody={loadBody}
                />
              ))
            ) : (
              <p className="empty">
                조건에 맞는 이슈가 없습니다. 검색어나 필터를 변경해 보세요.
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function Stats({ snapshot }: { snapshot: Snapshot }) {
  const all = snapshot.issues;
  const open = all.filter((i) => i.t === "open").length;
  const closed = all.length - open;
  const blocked = all.filter(isOpenAndBlocked).length;
  const items: [IconName, string, number, string, string, number][] = [
    ["open", "열린 이슈", open, "건", "#32976e", open / all.length],
    [
      "closed",
      closedTitle(snapshot),
      closed,
      "건",
      "#8960c9",
      closed / all.length,
    ],
    ["block", "차단된 열린 이슈", blocked, "건", "#c98939", blocked / open],
    ["repo", "전체 저장소", snapshot.repos.length, "개", "#757795", 1],
  ];
  return (
    <section className="stats" aria-label="전체 통계">
      {items.map(([icon, label, n, unit, color, ratio]) => (
        <div
          key={label}
          className="stat"
          style={{ "--c": color } as CSSProperties}
        >
          <div className="flex">
            <Icon name={icon} />
            {label}
          </div>
          <strong>
            {n}
            <small>{unit}</small>
          </strong>
          <div className="segments" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <i
                key={i}
                className={i < Math.round((ratio || 0) * 12) ? "on" : ""}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

type CopyState = "idle" | "busy" | "done" | "failed";

const COPY_LABELS: Record<CopyState, string> = {
  busy: "복사 중…",
  done: "복사됨",
  failed: "복사 실패",
  idle: "Markdown 복사",
};

function CopyButton({
  issue,
  loadBody,
}: {
  issue: Issue;
  loadBody?: LoadBody;
}) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state !== "done" && state !== "failed") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    setState("busy");
    try {
      const body = loadBody ? await loadBody(issue.u) : "";
      await navigator.clipboard.writeText(issueMarkdown(issue, body));
      setState("done");
    } catch {
      setState("failed");
    }
  };

  return (
    <button
      type="button"
      className="copybtn"
      disabled={state === "busy"}
      aria-live="polite"
      title="이슈 번호, 제목, 본문을 Markdown으로 복사합니다."
      onClick={() => void copy()}
    >
      {COPY_LABELS[state]}
    </button>
  );
}

function IssueRow({
  issue,
  refs,
  loadBody,
}: {
  issue: Issue;
  refs: Snapshot["refs"];
  loadBody?: LoadBody;
}) {
  const links = relations(issue);
  const linkCount = links.reduce((n, [, a]) => n + a.length, 0);
  return (
    <article className={`issue ${issue.t}`}>
      <Icon name={issue.t} />
      <div>
        <a
          className="title"
          target="_blank"
          rel="noopener noreferrer"
          href={safeUrl(issue.u)}
        >
          {issue.title}
        </a>
        <div className="meta">
          <span className="num">#{issue.n}</span>
          {issue.l.map((label, j) => (
            <span key={label} className={`tag t${j % 3}`}>
              {label}
            </span>
          ))}
          {issue.blocked > 0 && (
            <span className="tag t1">차단 요인 {issue.blocked}</span>
          )}
          <CopyButton issue={issue} loadBody={loadBody} />
        </div>
        {linkCount > 0 && (
          <details className="rels">
            <summary>연결된 이슈 {linkCount}개</summary>
            {links.map(([kind, urls]) =>
              urls.map((u) => (
                <a
                  key={`${kind}:${u}`}
                  href={safeUrl(u)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {kind} · {u.split("/").at(-3)} #{u.split("/").pop()}{" "}
                  {refs[u]?.[0] ?? ""} ↗
                </a>
              )),
            )}
          </details>
        )}
      </div>
      <time dateTime={issue.d}>{formatKstDate(issue.d)}</time>
    </article>
  );
}
