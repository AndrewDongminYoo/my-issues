# Issue Atlas

A read-only board for the GitHub issues across my repositories, published with GitHub Pages.

The site is public, so the build contains no issue data.
The page reads issues at runtime from the GitHub GraphQL API with a token that the viewer pastes in.
The token stays in the browser's `localStorage`, and this page sends it only to `api.github.com`.
`localStorage` is shared by every page on the same origin, so the board is served from its own domain, `gh.donminzzi.kr`.
On `<user>.github.io`, the scripts of any other project site of the same account could read the token.

## Token

Create a fine-grained personal access token with these settings:

- Repository access: All repositories
- Repository permissions: Issues read-only (Metadata read-only is added automatically)

The sign-in screen links to a pre-filled token form.

## Development

```sh
pnpm install
pnpm dev        # http://localhost:5173/
pnpm test
pnpm build      # type check, then build into dist/
```

To render the board without a token, put a snapshot JSON at `local/snapshot.json` and open `/?fixture`.
Only the dev server serves that file, and `local/` is gitignored because a snapshot holds private repository data.

## Deployment

`.github/workflows/pages.yml` tests, builds and deploys `dist/` on every push to `main`.
The custom domain is set in the repository's Pages settings, and DNS has a `CNAME` record from `gh.donminzzi.kr` to `andrewdongminyoo.github.io`.
The Vite `base` is `/`; set `BASE_PATH` to build for another path.
