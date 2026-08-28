# dsh-skins — skins for DSH Web

`dsh-skins` adds hot-switchable branded skins to DeepSeek Harness Web. It also keeps a
**DeepSeek Harness (Official)** choice that retracts the plugin's visual overrides and
restores the official interface.

This is a dual Host/client DSH bundle. The client owns skins and update UI; the Host owns
stable-Release checks, verified installation, and restart. esbuild generates both
`lib/client.js` and `lib/index.js`, and both are committed. GitHub installs do not run
`prepare` or build on the target machine.

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

## Stable Release updates

When the Skin Switcher opens, the Host checks the latest stable GitHub Release for
`iasiv5/skins`. Results are cached for one hour in
`$DSH_HOME/dsh-skins/update-cache.json` and survive DSH restarts. The update row stays
hidden when current; a failed network check shows a compact Retry action.

One-click update is available only when the current dependency points to the official
GitHub repository. A `link:` install shows local development mode with update disabled;
`file:`/tar installs and other repositories are never overwritten. When a newer Release
exists, the row shows current/latest versions, a Release-notes link, and Update.

The Host requires an exact `vX.Y.Z` tag, resolves it to a full commit SHA, and verifies the
remote package name, repository, `package.json.version`, and DSH Web metadata. Installation
uses the immutable SHA and is validated again afterward. A failure restores the previous
GitHub installation. On success, users choose Restart now or Later; running Agents block
restart. When DSH itself runs under a service manager (detected via
`INVOCATION_ID`/`NOTIFY_SOCKET`), Restart now exits non-zero and hands the restart back to
the manager's `Restart` policy; the detached relaunch helper is only used outside one.

Every stable publication must keep `package.json.version` exactly aligned with the GitHub
Release tag. Because the updater starts in `v0.4.0`, installations older than `v0.4.0`
need one manual upgrade before the in-product Update action becomes available.

## Color-mode persistence

For non-loopback browsers, the plugin observes the official `theme/change` event and
stores `light`, `dark`, or `system` in
`localStorage["dsh-skins:theme-preference"]`. It restores that value through the official
`theme.setTheme()` API. Loopback browsers skip this fallback and keep using DSH Host
persistence.

## Repository layout

```text
src/
├── index.js                         # Host entry; assembles updater and routes
├── host/
│   ├── self-update.js               # Release/cache/SHA validation, transaction, rollback
│   ├── runner.js                    # DSH profile command adapter
│   ├── routes.js                    # update/restart HTTP interface behind DSH browser trust
│   └── restart.js                   # Agent safety and DSH relaunch
└── client/
    ├── index.js                     # DSH ModuleLoader client entry
    ├── runtime.js                   # skin registry, mount/unmount, selection, persistence
    ├── sidebar-switcher.js          # sidebar entry, popover, locale strings
    ├── update-panel.js              # update row, progress, errors, restart interaction
    ├── theme-persistence.js         # non-loopback color-mode fallback
    └── skins/
        ├── openbmc-harness/index.js # independent OpenBMC skin
        └── uefi-harness/index.js    # independent UEFI placeholder
scripts/build-client.mjs             # esbuild: generates Host and client bundles
lib/index.js                         # generated Host bundle
lib/client.js                        # generated client bundle
cordis.patch.yml                     # registers row id `skins`
smoke-test.cjs                       # client ModuleLoader/DOM smoke test
tests/*.test.mjs                     # Host updater, cache, rollback, restart-safety tests
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

`check` builds both bundles, runs JavaScript syntax checks, and executes the client smoke
test plus Host updater tests. `watch` observes `src/client/` and `src/host/`, rebuilding
`lib/client.js` and `lib/index.js`. DSH client HMR can load rebuilt client bundles; Host
source, `package.json`, `cordis.patch.yml`, and dependency changes still require a DSH Web
restart.

Commit source changes together with both regenerated `lib` bundles. CI reruns the checks,
verifies that generated output has no uncommitted diff, and validates the install artifact.

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
