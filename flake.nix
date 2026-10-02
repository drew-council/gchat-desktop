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
    flake-utils.lib.eachDefaultSystem (
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
        packageJson = lib.importJSON ./package.json;
      in
      {
        packages.default = pkgs.stdenvNoCC.mkDerivation {
          pname = packageJson.name;
          inherit (packageJson) version;

          src = lib.fileset.toSource {
            root = ./.;
            fileset = lib.fileset.unions [
              ./package.json
              ./src
            ];
          };

          nativeBuildInputs = [
            pkgs.bun
            pkgs.makeWrapper
          ]
          ++ lib.optionals pkgs.stdenv.hostPlatform.isLinux [ pkgs.copyDesktopItems ];

          # The app has no runtime npm dependencies, so building is just
          # bundling the sources; no `bun install` needed.
          buildPhase = ''
            runHook preBuild
            export HOME=$TMPDIR
            bun run build
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall
            mkdir -p $out/share/gchat-desktop
            cp -r package.json dist $out/share/gchat-desktop/
            makeWrapper ${lib.getExe pkgs.electron} $out/bin/gchat-desktop \
              --add-flags $out/share/gchat-desktop
            runHook postInstall
          '';

          desktopItems = [
            (pkgs.makeDesktopItem {
              name = "gchat-desktop";
              desktopName = "Google Chat";
              exec = "gchat-desktop %U";
              icon = "internet-chat";
              categories = [
                "Network"
                "InstantMessaging"
                "Chat"
              ];
              startupWMClass = "gchat-desktop";
            })
          ];

          meta = {
            inherit (packageJson) description;
            mainProgram = "gchat-desktop";
          };
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
        checks.formatting = treefmtEval.config.build.check self;
      }
    );
}
