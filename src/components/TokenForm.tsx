import { useState, type FormEvent } from "react";

const CREATE_TOKEN_URL =
  "https://github.com/settings/personal-access-tokens/new?name=my-issues&description=Read-only+access+for+the+Issue+Atlas+board&issues=read";

interface Props {
  error: string | null;
  onSubmit: (token: string) => void;
}

export function TokenForm({ error, onSubmit }: Props) {
  const [token, setToken] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = token.trim();
    if (value) onSubmit(value);
  };

  return (
    <form className="panel tokenform" onSubmit={submit}>
      <h2>GitHub 토큰으로 연결</h2>
      <p>
        이 페이지는 서버 없이 브라우저에서 GitHub API를 직접 호출합니다. 토큰은 이 브라우저의
        localStorage에만 저장되며, 이 페이지는 토큰을 GitHub API 외의 곳으로 전송하지 않습니다.
      </p>
      <ol>
        <li>
          <a href={CREATE_TOKEN_URL} target="_blank" rel="noopener noreferrer">
            fine-grained personal access token 생성 화면 ↗
          </a>
          을 엽니다.
        </li>
        <li>Repository access는 All repositories로 선택합니다.</li>
        <li>Repository permissions에서 Issues를 Read-only로 지정합니다. Metadata는 자동으로 Read-only가 됩니다.</li>
        <li>생성된 토큰을 아래에 붙여 넣습니다.</li>
      </ol>
      <label className="search">
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          aria-label="GitHub 토큰"
          placeholder="github_pat_…"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="filterbtn primary" disabled={!token.trim()}>
        연결
      </button>
    </form>
  );
}
