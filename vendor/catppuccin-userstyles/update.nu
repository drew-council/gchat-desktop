#!/usr/bin/env nu

# Re-vendors the Catppuccin userstyle libraries that src/catppuccin.less builds
# on. The Material 3 library hasn't landed on main yet, so it comes from its
# integration branch; pass a commit to pin something else.
def main [rev: string = "refactor(lib/m3)/integrate-versioning"] {
  let dir = $env.FILE_PWD
  let sha = (
    http get $"https://api.github.com/repos/catppuccin/userstyles/commits/($rev | url encode)"
    | get sha
  )
  for file in [LICENSE lib/std/v1.less lib/m3/v1.less] {
    http get --raw $"https://raw.githubusercontent.com/catppuccin/userstyles/($sha)/($file)"
    | save --force ($dir | path join $file)
  }
  $sha | save --force ($dir | path join REVISION)
  print $"vendored catppuccin/userstyles@($sha)"
}
