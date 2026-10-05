An Electron wrapper around Google Chat. The app is the main process in
`src/main.ts`; `src/links.ts` holds the pure URL-routing rules (unit tested in
`src/links.test.ts`), `src/preload.ts` runs in Chat's pages, and
`src/patches.css` is injected into them.

`src/catppuccin.less` themes Chat with Catppuccin, built on the userstyle
libraries in `vendor/catppuccin-userstyles` (re-vendor with its `update.nu`).
It compiles every accent into one stylesheet keyed on
`<html data-catppuccin-accent>`, which the preload sets from the color picked
in Chat's Appearance settings; `src/theme.ts` holds that mapping (unit tested
in `src/theme.test.ts`). Chat's Light and Dark modes pick the flavors.

## Tooling

Bun is the package manager, bundler, and test runner; Electron (Node) is the
runtime, so app code uses Node and Electron APIs, not `Bun.*`.

- `bun run build` compiles `src/catppuccin.less` with `lessc` and bundles
  `src/main.ts` (ESM) and `src/preload.ts` (CJS, as sandboxed preloads
  require) into `dist/`. Keep the `less` dev dependency matched to nixpkgs'
  `lessc`, which `nix build` uses instead.
- `bun run start` builds and launches; `bun test` runs tests; `bun run typecheck`
  runs `tsc`.
- On Linux, the Nix dev shell sets `ELECTRON_OVERRIDE_DIST_PATH` so the npm
  `electron` package launches nixpkgs' Electron; the npm package's own binary
  is never downloaded. Keep its version matched to nixpkgs' `electron`.
- `nix build` bundles with Bun and wraps nixpkgs' Electron; there are no
  runtime npm dependencies, so it doesn't need `bun install`.
- Chat's markup is obfuscated, so the theme overrides its CSS variables
  (`--gm3-sys-color-*`, `--chat-extended-color-*`, and older hardcoded ones)
  rather than styling classes.

## Gotchas

- Don't top-level `await app.whenReady()` in `src/main.ts`: Electron holds the
  `ready` event until the ESM entry module finishes evaluating, so it deadlocks.
- The user agent drops Electron's tokens because Google blocks sign-in from
  browsers that look embedded.
