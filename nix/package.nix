{
  lib,
  stdenvNoCC,
  bun,
  electron,
  librsvg,
  makeWrapper,
  copyDesktopItems,
  makeDesktopItem,
}:
let
  packageJson = lib.importJSON ../package.json;
  iconSizes = [
    16
    24
    32
    48
    64
    128
    256
    512
  ];
in
stdenvNoCC.mkDerivation {
  pname = packageJson.name;
  inherit (packageJson) version;

  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../package.json
      ../src
      ../assets
    ];
  };

  nativeBuildInputs = [
    bun
    makeWrapper
  ]
  ++ lib.optionals stdenvNoCC.hostPlatform.isLinux [
    librsvg
    copyDesktopItems
  ];

  # The app has no runtime npm dependencies, so building is just bundling the
  # sources; no `bun install` needed.
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
    makeWrapper ${lib.getExe electron} $out/bin/gchat-desktop \
      --add-flags $out/share/gchat-desktop

    runHook postInstall
  '';

  postInstall = lib.optionalString stdenvNoCC.hostPlatform.isLinux ''
    install -Dm644 assets/icon.svg $out/share/icons/hicolor/scalable/apps/gchat-desktop.svg
    for size in ${toString iconSizes}; do
      dir=$out/share/icons/hicolor/''${size}x''${size}/apps
      mkdir -p $dir
      rsvg-convert -w $size -h $size assets/icon.svg -o $dir/gchat-desktop.png
    done
  '';

  desktopItems = [
    (makeDesktopItem {
      name = "gchat-desktop";
      desktopName = "Google Chat";
      genericName = "Chat";
      comment = packageJson.description;
      exec = "gchat-desktop";
      icon = "gchat-desktop";
      categories = [
        "Network"
        "InstantMessaging"
        "Chat"
      ];
      keywords = [
        "google"
        "workspace"
        "messaging"
      ];
      # Electron names its window after the app's package.json name, which is
      # how desktops match the window back to this entry and its icon.
      startupWMClass = "gchat-desktop";
    })
  ];

  meta = {
    inherit (packageJson) description;
    homepage = "https://github.com/drew-council/gchat-desktop";
    license = with lib.licenses; [
      asl20
      mit
    ];
    mainProgram = "gchat-desktop";
    inherit (electron.meta) platforms;
  };
}
