An Electron wrapper around Google Chat. The app is the main process in
`src/main.ts`; `src/links.ts` holds the pure URL-routing rules (unit tested in
`src/links.test.ts`), `src/preload.ts` runs in Chat's pages and installs the
behavior patches that each live in their own module (like
`src/copy-button.ts`), and `src/patches.css` is injected into them.

`src/switcher/` is the Cmd+K quick switcher: a `cmdk` palette rendered with
React into a shadow root. It learns conversations and threads from Chat's DOM
(`harvest.ts`) into a `Directory` persisted in `localStorage`, and switches by
pushing Chat's own routes (`routes.ts`). The main process catches the shortcut
in `before-input-event` and tells the page over IPC.

## Tooling

Bun is the package manager, bundler, and test runner; Electron (Node) is the
runtime, so app code uses Node and Electron APIs, not `Bun.*`.

- `bun run build` bundles `src/main.ts` (ESM) and `src/preload.ts` (CJS, as
  sandboxed preloads require) into `dist/`.
- `bun run start` builds and launches; `bun test` runs tests; `bun run typecheck`
  runs `tsc`.
- On Linux, the Nix dev shell sets `ELECTRON_OVERRIDE_DIST_PATH` so the npm
  `electron` package launches nixpkgs' Electron; the npm package's own binary
  is never downloaded. Keep its version matched to nixpkgs' `electron`.
- `bun run dev` serves the Chrome DevTools Protocol on port **52922**, not
  CDP's default 9222 (kept off-default so generic tooling doesn't connect by
  accident). Connect agents/debuggers to `http://localhost:52922`.
- `nix build` bundles with Bun and wraps nixpkgs' Electron. npm dependencies
  are bundled into `dist/`, and Nix installs them for the build from `bun.nix`,
  which `bun install`'s postinstall regenerates with bun2nix. Commit it with
  `bun.lock`.
- `bun.lock` is kept at `lockfileVersion` 1, which Bun preserves on re-save,
  because bun2nix can't read Bun 1.4's version 2 yet
  (nix-community/bun2nix#110). Don't regenerate it from scratch until it can.

## Gotchas

- Don't top-level `await app.whenReady()` in `src/main.ts`: Electron holds the
  `ready` event until the ESM entry module finishes evaluating, so it deadlocks.
- Never drive the running dev app (CDP, synthetic input, navigation) to test
  changes; it's the user's real Chat session. Opening conversations marks them
  read.
- The user agent drops Electron's tokens because Google blocks sign-in from
  browsers that look embedded.
