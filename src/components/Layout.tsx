import type { ReactNode } from "react";
import heroArt from "../assets/hero-art.svg";
import type { Viewer } from "../github/token";

interface Props {
  viewer: Viewer | null;
  /** The line under the page title. */
  subtitle: ReactNode;
  onSignOut?: () => void;
  children: ReactNode;
}

export function Layout({ viewer, subtitle, onSignOut, children }: Props) {
  return (
    <>
      <header>
        <div className="brand">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="m2 10 14-8 14 8-14 8z" fill="#8b65ce" />
            <path
              d="m2 15 14 8 14-8M2 21l14 8 14-8"
              stroke="#6744a5"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </svg>
          Issue Atlas<small>GitHub 워크스페이스</small>
        </div>
        {viewer && (
          <div className="account">
            <a href={`https://github.com/${viewer.login}`} target="_blank" rel="noopener noreferrer">
              <span className="avatar">{viewer.login.slice(0, 1).toUpperCase()}</span>
              {viewer.login} ↗
            </a>
            {onSignOut && (
              <button type="button" className="signout" onClick={onSignOut}>
                로그아웃
              </button>
            )}
          </div>
        )}
      </header>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-info">
            <div className="kicker">WORKSPACE OVERVIEW</div>
            <h1>이슈 보드</h1>
            <div className="sub">
              <span className="dot"> </span>
              {subtitle}
            </div>
          </div>
          <div className="art" aria-hidden="true">
            <img src={heroArt} alt="" />
          </div>
        </div>
      </section>
      <main>{children}</main>
    </>
  );
}
