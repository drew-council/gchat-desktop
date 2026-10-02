{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
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
      topiary-nushell,
      treefmt-nix,
      ...
    }:
    {
      # Builds against the consumer's nixpkgs, including their Electron.
      overlays.default = final: _prev: {
        gchat-desktop = final.callPackage ./nix/package.nix { };
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
          gchat-desktop = pkgs.callPackage ./nix/package.nix { };
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
