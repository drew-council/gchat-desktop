{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    bun2nix = {
      url = "github:nix-community/bun2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    topiary-nushell = {
      url = "github:drew-council/topiary-nushell-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    treefmt-nix.url = "github:numtide/treefmt-nix";
  };
  outputs =
    inputs@{
      self,
      nixpkgs,
      flake-utils,
      bun2nix,
      topiary-nushell,
      treefmt-nix,
      ...
    }:
    let
      callPackage =
        pkgs:
        pkgs.callPackage ./nix/package.nix {
          bun2nix = bun2nix.packages.${pkgs.stdenv.hostPlatform.system}.default;
        };
    in
    {
      # Builds against the consumer's nixpkgs, including their Electron.
      overlays.default = final: _prev: {
        gchat-desktop = callPackage final;
      };
    }
    // flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };
        inherit (pkgs) lib;
        treefmtEval = treefmt-nix.lib.evalModule pkgs {
          imports = [
            topiary-nushell.treefmtModules.default
            ./treefmt.nix
          ];
        };
      in
      {
        packages = {
          default = self.packages.${system}.gchat-desktop;
          gchat-desktop = callPackage pkgs;
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            (aspellWithDicts (ps: with ps; [ en ]))
            nushell
            bun
            biome
          ];

          # The npm `electron` package's prebuilt binary can't run on NixOS, so
          # it's only installed for its types and launches nixpkgs' Electron.
          env = lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
            ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
            ELECTRON_OVERRIDE_DIST_PATH = "${pkgs.electron}/bin";
          };
        };

        formatter = treefmtEval.config.build.wrapper;
        checks = {
          formatting = treefmtEval.config.build.check self;
          package = self.packages.${system}.gchat-desktop;
        };
      }
    );
}
