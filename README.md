# gchat-desktop

A thin Electron wrapper around [Google Chat](https://chat.google.com). It behaves
like a single-site browser, with a few differences from the Chrome PWA:

- Links that leave Chat open in your default browser (via `xdg-open` on Linux),
  unwrapped from Google's `google.com/url?q=` redirector.
- Sign-in, Chat pop-outs, and SSO flows stay in the app.
- `src/patches.css` is injected into Chat, and `src/preload.ts` runs before
  Chat's scripts, for UI and keybind tweaks.
- Chat is themed with [Catppuccin](https://catppuccin.com), using the
  [userstyle](https://github.com/catppuccin/userstyles) libraries. Chat's
  Appearance settings choose the theme: Light mode is Latte, Dark mode is
  Mocha (both set at the top of `src/catppuccin.less`), and each color maps to
  the nearest Catppuccin accent.

## Development

This project uses Nix and direnv. Run `direnv allow` (or `nix develop`), then:

```sh
bun install       # electron is installed for its types; Nix provides the binary
bun run start     # build and launch
bun run typecheck
bun test
```

On NixOS, the dev shell points the `electron` npm package at nixpkgs' Electron,
so keep the version in `package.json` in step with nixpkgs' `electron`.

Run `nix fmt` to format the repository.

## Installing

Add the flake as an input:

```nix
inputs.gchat-desktop = {
  url = "github:drew-council/gchat-desktop";
  inputs.nixpkgs.follows = "nixpkgs";
};
```

Then either install the package directly:

```nix
environment.systemPackages = [ inputs.gchat-desktop.packages.${pkgs.system}.default ];
# or, in Home Manager: home.packages = [ ... ];
```

or apply `inputs.gchat-desktop.overlays.default` and use `pkgs.gchat-desktop`,
which builds against your nixpkgs (including its Electron).

On Linux, the package installs a `gchat-desktop` binary, a "Google Chat"
desktop entry, and icons in the hicolor theme. Sessions are stored in
`~/.config/gchat-desktop`.

On macOS, it installs `Applications/Google Chat.app` (a rebranded copy of
nixpkgs' `Electron.app`) and a `gchat-desktop` binary that launches it.
Sessions are stored in `~/Library/Application Support/gchat-desktop`.

To try it without installing, run `nix run github:drew-council/gchat-desktop`.

## License

Licensed under either of Apache License, Version 2.0 or MIT license at your option.
