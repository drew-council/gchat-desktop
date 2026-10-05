{
  lib,
  stdenvNoCC,
  bun,
  electron,
  lessc,
  librsvg,
  makeWrapper,
  copyDesktopItems,
  makeDesktopItem,
  libicns,
  python3,
}:
let
  packageJson = lib.importJSON ../package.json;
  appName = "Google Chat";
  # Sizes png2icns accepts for an .icns.
  macIconSizes = [
    16
    32
    48
    128
    256
    512
    1024
  ];
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
      ../vendor
      ../assets
    ];
  };

  nativeBuildInputs = [
    bun
    lessc
    librsvg
    makeWrapper
  ]
  ++ lib.optionals stdenvNoCC.hostPlatform.isLinux [
    copyDesktopItems
  ]
  ++ lib.optionals stdenvNoCC.hostPlatform.isDarwin [
    libicns
    python3
  ];

  # The app has no runtime npm dependencies, so building is just compiling the
  # theme and bundling the sources; no `bun install` needed.
  buildPhase = ''
    runHook preBuild
    export HOME=$TMPDIR
    bun run build
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
  ''
  + lib.optionalString stdenvNoCC.hostPlatform.isLinux ''
    mkdir -p $out/share/gchat-desktop
    cp -r package.json dist $out/share/gchat-desktop/
    makeWrapper ${lib.getExe electron} $out/bin/gchat-desktop \
      --add-flags $out/share/gchat-desktop
  ''
  # macOS only treats an app as its own (Dock icon, menu bar name, Spotlight,
  # notifications) when it runs from its own bundle, so rebrand a copy of
  # Electron.app; Electron loads the app from Contents/Resources/app. The
  # bundle's ad-hoc signature doesn't cover Info.plist, so editing it doesn't
  # need a re-sign.
  + lib.optionalString stdenvNoCC.hostPlatform.isDarwin ''
    app="$out/Applications/${appName}.app"
    mkdir -p $out/Applications
    cp -r ${electron.dist}/Electron.app "$app"
    chmod -R u+w "$app"

    resources="$app/Contents/Resources"
    rm "$resources/default_app.asar" "$resources/electron.icns"
    mkdir "$resources/app"
    cp -r package.json dist "$resources/app/"

    for size in ${toString macIconSizes}; do
      rsvg-convert -w $size -h $size assets/icon.svg -o icon_$size.png
    done
    png2icns "$resources/gchat-desktop.icns" icon_*.png

    python3 - "$app/Contents/Info.plist" <<'EOF'
    import plistlib, sys
    with open(sys.argv[1], "rb") as f:
        info = plistlib.load(f)
    info.update(
        CFBundleName="${appName}",
        CFBundleDisplayName="${appName}",
        CFBundleIdentifier="io.github.drew-council.gchat-desktop",
        CFBundleIconFile="gchat-desktop.icns",
        CFBundleShortVersionString="${packageJson.version}",
        CFBundleVersion="${packageJson.version}",
        LSApplicationCategoryType="public.app-category.social-networking",
    )
    # Hashes default_app.asar, which was removed above.
    info.pop("ElectronAsarIntegrity", None)
    with open(sys.argv[1], "wb") as f:
        plistlib.dump(info, f)
    EOF

    makeWrapper "$app/Contents/MacOS/Electron" $out/bin/gchat-desktop
  ''
  + ''
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
