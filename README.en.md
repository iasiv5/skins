# skins (dsh-skins) — modular DSH Web skins

Every custom skin is an independent first-level directory under
`src/client/skins/`: add or remove it as a unit. `default` is a built-in virtual
choice that retracts every custom override and restores the official DeepSeek
Harness interface. There is no family/shared visual
layer and skins do not import one another. esbuild bundles the modular source into
the single `lib/client.js` expected by DSH. The generated bundle is committed and
there is no `prepare` script, so GitHub installers do not build anything.

## Current skins

| id | directory | status | description |
|---|---|---|---|
| `default` | — | built-in | Official DeepSeek Harness interface; keeps the switcher and appearance controls |
| `openbmc` | `src/client/skins/openbmc-harness/` | production | OpenBMC identity, ice-blue palettes and storm-wing artwork |
| `uefi-harness` | `src/client/skins/uefi-harness/` | **dummy** | self-contained UEFI chip mark, violet palettes and gradient background |

`openbmc-lite` has been removed.

The sidebar **Skin Switcher** above Plugin Plaza has two sections:

1. **Appearance** — Light, Dark, System; uses the official theme service and
   stays synchronized with Settings → General → Appearance.
2. **Choose Skin** — **DeepSeek Harness (Default)** comes first and restores the
   official interface; OpenBMC Harness and UEFI Harness follow. Selection applies
   immediately, persists, and keeps the popover open. First load still uses OpenBMC.

Debug API:

```js
__DSH_SKINS__.list();
__DSH_SKINS__.select("default");      // restore the official interface
__DSH_SKINS__.select("uefi-harness");
__DSH_SKINS__.active();               // includes the virtual default id
```

## Layout

```text
src/client/
├── index.js
├── runtime.js
├── sidebar-switcher.js
├── theme-persistence.js
└── skins/
    ├── openbmc-harness/index.js
    └── uefi-harness/index.js
scripts/build-client.mjs
lib/client.js                 # generated; do not hand-edit
smoke-test.cjs
```

Rules:

1. Runtime/UI modules contain technical infrastructure only.
2. Every skin directory owns its mark, favicon, CSS, backdrop and slogans.
3. Skins never import other skins; prefer duplication over cross-skin coupling.
4. Adding/removing a skin changes its directory and one import/register pair in
   `src/client/index.js`.
5. Never edit generated `lib/client.js` directly.

## Build and test

```sh
pnpm install
pnpm run build
pnpm run test
# or
pnpm run check
```

`pnpm run watch` rebuilds `lib/client.js` whenever `src/` changes. Metadata and
bundle-patch changes still require a `dsh web` restart.

## Remote appearance persistence

For non-loopback browsers the plugin stores official `light / dark / system`
changes in `localStorage["dsh-skins:theme-preference"]` and restores through
`theme.setTheme()`. Loopback browsers keep the official Host persistence.

## Install from GitHub (from scratch)

Prerequisite: DSH is installed and its web profile can run. Do not clone this
repository and do not run `pnpm install` in a plugin directory. The command below
initializes the web profile when needed and installs the plugin directly:

```sh
dsh plugin --profile web add github:iasiv5/skins#main
```

Restart the running `dsh web` process, refresh the page, and look for **Skin
Switcher** at the bottom of the sidebar. Verify in the browser console:

```js
__DSH_SKINS__.list();
// contains openbmc and uefi-harness
```

### Update

```sh
dsh plugin --profile web update dsh-skins
```

Restart `dsh web` after updating. Once release tags exist, install a fixed,
reproducible version with:

```sh
dsh plugin --profile web add github:iasiv5/skins#v0.3.1
# or a reviewed 40-character commit SHA
dsh plugin --profile web add github:iasiv5/skins#<commit-sha>
```

### Uninstall

```sh
dsh plugin --profile web remove dsh-skins
```

There is no `prepare` script. GitHub installers consume committed
`lib/client.js` directly and do not install build tools or compile source.
