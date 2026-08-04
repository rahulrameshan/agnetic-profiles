# CLAUDE.md

Context for Claude Code when working on this repository.

## Project overview

`portfolio-ui` is a multi-tenant portfolio app. **No account is special** — every user, including whoever runs the site, is served identically.

- **`/`** is a generic landing page (`Landing.js`) explaining the product, linking to signup/login when logged out and to the user's own page/dashboard when logged in.
- **`/u/:username`** is the portfolio for any registered user (`PublicProfile.js`) — a fixed two-panel layout (left sidebar, right content panel, `100vh`, no page scroll). Every section is rendered from profile JSON the backend produced by running that user's uploaded CV through an LLM.
- **`/signup`, `/login`, `/dashboard`, `/settings`** are the account flows.

The app used to serve Rahul Rameshan's hardcoded portfolio at `/`. That was removed deliberately so all users are equal. `OwnerPortfolio.js` and the hardcoded section components (`About.js`, `Impact.js`, `Skills.js`, `Experience.js`, `Projects.js`, `Hero.js`) still exist but are **no longer routed** — they are dead code kept only because the hand-written copy in them isn't committed anywhere else. Don't wire them back up without a reason.

## Tech stack

- React 19 (functional components + hooks only — no class components)
- Create React App (`react-scripts` 5.0.1) — not ejected
- `react-router-dom` v6 — **pinned to v6 deliberately**: v7 uses subpath exports (`react-router/dom`) that CRA 5's Jest resolver cannot resolve, which breaks the test suite
- Plain CSS in `src/styles/` (one stylesheet per component, imported from the component file)
- `axios` for HTTP calls, via the shared instance in `src/api/client.js`
- Testing: `@testing-library/react` + Jest (via `react-scripts test`)
- No TypeScript, no Tailwind, no CSS-in-JS, no state management library beyond `AuthContext`

## Commands

```
npm start         # dev server on http://localhost:3000
npm test          # interactive test watcher
npm run build     # production build into ./build
```

The app expects the agent backend (the sibling `portfolio-agent` repo) at `REACT_APP_AGENT_URL`, defaulting to `http://localhost:8000`. Start it with `docker compose up -d` + `uvicorn api:app` in that repo, or the auth and profile calls will fail.

## Directory layout

```
src/
  App.js                 # router only: / , /login, /signup, /dashboard, /u/:username
  index.js               # React entry
  index.css              # root-level resets
  api/
    client.js            # shared axios instance + JWT interceptor + errorMessage()
  context/
    AuthContext.js       # signed-in user, login/signup/logout, token in localStorage
  components/
    Landing.js           # "/" — generic product landing page
    PublicProfile.js     # "/u/:username" — the portfolio, for every user
    Dashboard.js         # CV upload, extraction status, CV history/rollback
    Settings.js          # account details, replace CV, logout
    Login.js / Signup.js # account flows
    Chat.js              # chat UI; posts to /u/:username/chat (username required)
    generic/             # the prop-driven sections PublicProfile renders
      GenericAbout.js, GenericImpact.js, GenericSkills.js,
      GenericExperience.js, GenericProjects.js
    OwnerPortfolio.js, Hero.js, About.js, Impact.js,
    Skills.js, Experience.js, Projects.js
                         # DEAD CODE — the old hardcoded single-owner page. Not routed.
  styles/                # one stylesheet per component; generic/ twins reuse the same files
public/                  # CRA static assets (favicon, index.html, manifest)
```

Nav items are declared in `PublicProfile.js`: `About`, `Impact`, `Skills`, `Experience`, `Projects`. All five are wired, and a section renders `null` when the CV yielded no data for it.

Note the stylesheets are shared between the live `generic/` components and the dead hardcoded ones, so editing `styles/` only needs checking against `generic/`.

## Theming

Users pick **one** colour (their text/accent); everything else is derived in `src/theme.js`
and written onto `:root` as CSS custom properties by the `useTheme` hook. Three colours matter:

| Token | Role | Guarantee |
| --- | --- | --- |
| `--theme-accent` | the user's chosen text/accent colour | — |
| `--theme-bg` | derived background | ≥ 4.5:1 against the accent (WCAG AA) |
| `--theme-control` | **buttons and input fields** | ≥ 3:1 against the background (WCAG 1.4.11) |

`--theme-control` is the accent's hue rotated 180°, lightness-adjusted until it clears the
threshold. A greyscale accent has no hue to rotate, so it falls back to a mid neutral.
Controls get their own colour because a border tinted toward the background disappears, and
a border in the accent blends into the accent text beside it.

Only the accent is persisted (`users.theme_color`). Never store a background alongside it —
deriving is what makes an unreadable pair impossible.

`src/theme.test.js` asserts these guarantees across 20 colours including black, white and
mid-luminance greys. **If you touch the derivation, that suite is the thing to keep green.**

Stylesheets should reference the tokens, never a literal colour. `styles/global.css` still
defines the default green palette in `:root` — those are fallbacks, not values to edit for
theming.

## Conventions

- **Components**: functional + hooks, default export, one component per file, PascalCase filenames under `src/components/`.
- **Styles**: one matching `.css` file per component in `src/styles/`, imported at the top of the component. Class names use kebab-case with BEM-ish modifiers (e.g. `nav-item`, `nav-item--active`).
- **Navigation**: a section is shown by adding it to `NAV_ITEMS` in `App.js` and adding a matching `case` in the `renderSection` switch. Keep the two in sync.
- **Layout rule**: the app is intentionally fixed to `100vh` — avoid introducing page-level scroll. Section components should handle their own internal overflow.
- **Comments**: block comments at the top of files describe purpose; keep that style when adding new components.
- **Headers / banners**: the sidebar uses a terminal-prompt aesthetic (`>` glyphs). Preserve it when adding nav or status elements.

## Testing

- Tests live next to the code they cover (e.g. `App.test.js`) using `@testing-library/react`.
- `setupTests.js` wires in `@testing-library/jest-dom` matchers.
- Before claiming a change is done, run `npm test -- --watchAll=false` and make sure the suite is green.

## Things to know before editing

- `Hero.js` exists but is not routed — don't assume it's live.
- All backend calls go through `src/api/client.js`. Don't import `axios` directly in a component; you'd lose the auth header and the base URL.
- Generated profile data is untrusted-shaped: any array can be empty and any optional string can be missing. The `generic/` components guard for this — keep that up when adding fields.
- `package-lock.json` is committed — keep it in sync when you touch `package.json`.
- Do not run `npm run eject`.
- Do not upgrade `react-router-dom` to v7 without also solving the Jest resolution problem (see Tech stack).

## Useful workflows

- Adding a new section to the owner page (`/`):
  1. Create `src/components/Skills.js` (functional component, default export).
  2. Create `src/styles/Skills.css` and import it from the component.
  3. Import it in `OwnerPortfolio.js` and add `case "Skills": return <Skills />;` to `renderSection`.
  4. `Skills` is already in `NAV_ITEMS`, so it will light up automatically.

- Adding a new field to generated pages: the shape is decided by `PROFILE_SCHEMA` in the backend's `extractor.py`. Add it there first, then consume it in the matching `generic/` component — the frontend cannot surface a field the extractor never produces.

- Pointing the app at a different backend: set `REACT_APP_AGENT_URL` in `.env`. Note the repo's `.gitignore` covers `.env.local` but **not** plain `.env`; that's tolerable because every `REACT_APP_*` value is baked into the public bundle anyway, so never put a secret there.
