# dsh-skins — skins for DSH Web

`dsh-skins` adds hot-switchable branded skins to DeepSeek Harness Web. It also keeps a
**DeepSeek Harness (Official)** choice that retracts the plugin's visual overrides and
restores the official interface.

This is a client-only DSH bundle. esbuild produces the single `lib/client.js` loaded by
DSH, and that generated file is committed. GitHub installs do not run `prepare` or build
on the target machine.

> Verified with DSH Web `0.1.1-rc.2`.
>
> 中文：[README.md](README.md)

## Available appearances

| Selection ID | Type | Description |
|---|---|---|
| `official` | built-in choice | Restores the official DeepSeek Harness brand, background, and favicon while keeping the switcher and official color-mode controls |
| `openbmc` | production skin | OpenBMC ribbon mark and favicon, light/dark ice-blue palettes, storm-wing artwork, and branded headline |
| `uefi-harness` | placeholder skin | Independent UEFI chip identity, light/dark violet palettes, and a gradient backdrop for a future production design |

With no saved selection, the first load uses `openbmc`. “Official” therefore means
“restore the official DSH interface”; it is not this plugin's initial selection.

## Skin Switcher

The **Skin Switcher** at the bottom of the sidebar has two sections:

1. **Appearance** — Light, Dark, or System. These controls call the official DSH theme
   service and stay synchronized with Settings → General → Appearance.
2. **Choose Skin** — **DeepSeek Harness (Official)** appears first, followed by the
   custom skins in this repository. A click applies immediately, persists the selection,
   and leaves the popover open for quick comparison.

Choosing “Official” removes custom skin overrides without changing the Light, Dark, or
System preference. When the sidebar is collapsed, the entry becomes a circular palette
button. Multiple `sidebar.footer.action` entries are arranged vertically to avoid overlap.

### URL and debug API

```js
__DSH_SKINS__.list();                  // custom skins only; excludes official
__DSH_SKINS__.select("official");      // restore the official DSH interface
__DSH_SKINS__.select("uefi-harness");  // switch to the UEFI placeholder
__DSH_SKINS__.active();                // current selection ID
__DSH_SKINS__.themePreference();       // remote-browser color preference; may be null
```

The URL selector accepts `/?skin=official`, `/?skin=openbmc`, and
`/?skin=uefi-harness`. The skin selection is stored in
`localStorage["dsh-skins:active"]`.

## Color-mode persistence

For non-loopback browsers, the plugin observes the official `theme/change` event and
stores `light`, `dark`, or `system` in
`localStorage["dsh-skins:theme-preference"]`. It restores that value through the official
`theme.setTheme()` API. Loopback browsers skip this fallback and keep using DSH Host
persistence.

## Repository layout

```text
src/client/
├── index.js                         # DSH ModuleLoader entry and assembly
├── runtime.js                       # registry, mount/unmount, selection, persistence
├── sidebar-switcher.js              # sidebar entry, popover, locale strings
├── theme-persistence.js             # non-loopback color-mode fallback
└── skins/
    ├── openbmc-harness/index.js     # independent OpenBMC skin
    └── uefi-harness/index.js        # independent UEFI placeholder
scripts/build-client.mjs             # esbuild: src/client/index.js → lib/client.js
lib/index.js                         # host entry with no host-side behavior
lib/client.js                        # generated and committed; do not hand-edit
cordis.patch.yml                     # registers row id `skins`
smoke-test.cjs                       # ModuleLoader, DOM, switching, cleanup tests
```

Each custom skin directory owns its mark, favicon, CSS, backdrop, and slogans. Skin
directories must not import visual assets from one another. `runtime.js` and
`sidebar-switcher.js` contain shared mechanics only.

## Add a custom skin

Create `src/client/skins/<id>/index.js` and export a factory with this shape:

```js
export function createMySkin({ jsx }) {
  function Mark({ size = 24 }) { /* return the mark */ }
  function Name() { /* return the wordmark */ }

  return {
    id: "my-skin",
    label: "My Skin",
    description: "Short description",
    bodyAttr: "dshMySkin",
    Mark,
    Name,
    favicon: "data:image/svg+xml,...",
    faviconMime: "image/svg+xml",
    css: `body[data-dsh-my-skin] { /* DSH tokens */ }`,
    art: "",
    scrimLight: "",
    scrimDark: "",
    placeholderLight: "linear-gradient(...) light",
    placeholderDark: "linear-gradient(...) dark",
    slogans: { zh: "中文标语", en: "English slogan" },
  };
}
```

Add the matching import and `runtime.register(...)` call to `src/client/index.js`; reverse
those changes when removing a skin. Keep `official` and the compatibility alias `default`
reserved.

## Local development and verification

```sh
pnpm install
pnpm run check
pnpm run watch
```

`check` builds the client bundle, runs a JavaScript syntax check, and executes the smoke
test. `watch` observes `src/client/` and rebuilds `lib/client.js`. With a local `link:`
installation, DSH Web client HMR can load each rebuilt bundle. Changes to
`package.json`'s `dsh.client`, `cordis.patch.yml`, or plugin dependencies still require a
DSH Web restart.

Commit source changes together with the regenerated `lib/client.js`. CI reruns the checks,
verifies that the generated bundle has no uncommitted diff, and validates the install
artifact.

## Install from GitHub

Install the development branch:

```sh
dsh plugin --profile web add github:iasiv5/skins#main
```

Restart DSH Web and refresh after installation. For reproducible installs, use a tag from
[Releases](https://github.com/iasiv5/skins/releases) or pin a reviewed 40-character commit
SHA:

```sh
dsh plugin --profile web add github:iasiv5/skins#<commit-sha>
```

Update an installation that tracks `main`:

```sh
dsh plugin --profile web update dsh-skins
```

Uninstall:

```sh
dsh plugin --profile web remove dsh-skins
```

## Known limitations

- The OpenBMC user-bubble border uses the version-specific `.gdEzaW_bubble` class. If that
  class changes, only the decorative border is lost; token-based colors still apply.
- Branded headlines replace entries through the current DSH locale dictionary interface
  and are restored on skin unload; review this integration after a DSH locale upgrade.
- Other skin plugins may also change the body background, brand slots, or favicon. Avoid
  enabling multiple visual skin plugins at the same time.
- `uefi-harness` is an architecture and interaction placeholder, not an official UEFI
  brand design.
