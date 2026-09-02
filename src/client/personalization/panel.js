/**
 * Personalization panel — schema-driven field controls rendered as the right
 * column of the combined switcher shell (design §7.2, simplification Q44/Q46).
 * The panel is generic: it reads field definitions from the shared catalog
 * and never knows a specific skin's business mapping.
 *
 * Interaction model (ADR-0003, v2.5 auto-save):
 *   - edits call configClient.preview/previewReset → local live projection
 *     plus a debounced auto-flush; the user never saves anything;
 *   - lastFlushError (from the client) renders the 保存失败 warning strip;
 *     the next edit clears it;
 *   - 恢复默认 resets every field to factory defaults and flushes at once;
 *   - the wallpaper section merges built-in choices and the user library in
 *     one grid; library add/remove is immediate (asset path, like all writes);
 *   - the header row hosts the reset control (only while the skin has
 *     overrides) and the collapse control (v1.0.0 rulings) at its right end;
 *     the reset folds fields back to factory defaults with a confirm, the
 *     collapse folds the panel back into the skin list — it never closes the
 *     shell itself, and focus returns to the gear that opened it (the
 *     switcher owns that move);
 *   - the footer strip is transient status only (recovery / loading /
 *     offline / readonly / save-failure), rendered just while non-empty, so
 *     the panel's resting height never depends on transient state;
 *   - the panel hosts no shell-close button and no save/dirty confirms.
 */

import {
  getSkinSchema,
  mergeValues,
} from "../../shared/personalization/catalog.js";
import { resolveHostErrorText } from "../update-panel.js";

// Library grid folds after three full rows (3 × 6 per row, user ruling #18):
// the first 18 assets render inline, the rest hide behind "还有 N 张未显示".
const PAGE_SIZE = 18;

export function createPersonalizationPanel({ jsx, react, configClient, tr, builtinAssetsFor, labelFor }) {
  const { useState, useEffect, useRef } = react;

  function useConfigState() {
    const [state, setState] = useState(() => configClient.getState());
    useEffect(() => configClient.onStateChange(() => setState(configClient.getState())), []);
    return state;
  }

  // ---- field controls -------------------------------------------------------

  function TextField({ field, value, onValue, disabled }) {
    const inputs = field.scope === "locale"
      ? ["zh", "en"].map((locale) => jsx("input", {
          key: locale, type: "text", className: "dsh-skins-pz-input",
          value: value?.[locale] ?? "", maxLength: field.maxLength,
          disabled, "aria-label": `${tr(field.labelKey)} (${locale.toUpperCase()})`,
          placeholder: field.default?.[locale] ?? "",
          onChange: (event) => onValue({ ...value, [locale]: event.target.value }),
        }, locale))
      : [jsx("input", {
          key: "single", type: "text", className: "dsh-skins-pz-input",
          value: value ?? "", maxLength: field.maxLength, disabled,
          "aria-label": tr(field.labelKey),
          placeholder: field.default ?? "",
          onChange: (event) => onValue(event.target.value),
        })];
    // Locale inputs sit side by side (v2.4.1 #3): the wide panel makes the
    // stacked zh/en pair both ugly and needlessly tall.
    return jsx("label", { className: "dsh-skins-pz-row", children: [
      jsx("span", { className: "dsh-skins-pz-label", children: tr(field.labelKey) }),
      jsx("div", {
        className: `dsh-skins-pz-fields${field.scope === "locale" ? " dsh-skins-pz-fields-locale" : ""}`,
        children: inputs,
      }),
    ] });
  }

  function RangeField({ field, value, onValue, disabled }) {
    const current = value ?? field.default;
    return jsx("label", { className: "dsh-skins-pz-row", children: [
      jsx("span", { className: "dsh-skins-pz-label", children: tr(field.labelKey) }),
      jsx("div", { className: "dsh-skins-pz-fields", children: jsx("div", { className: "dsh-skins-pz-range", children: [
        jsx("input", {
          type: "range", min: field.min, max: field.max, step: field.step,
          value: current, disabled,
          "aria-label": tr(field.labelKey),
          onChange: (event) => onValue(Number(event.target.value)),
        }),
        jsx("output", { children: `${current}${field.unit ?? ""}` }),
      ] }) }),
    ] });
  }

  function SelectField({ field, value, onValue, disabled }) {
    return jsx("label", { className: "dsh-skins-pz-row", children: [
      jsx("span", { className: "dsh-skins-pz-label", children: tr(field.labelKey) }),
      jsx("div", { className: "dsh-skins-pz-fields", children: jsx("select", {
        className: "dsh-skins-pz-input", value: value ?? field.default, disabled,
        "aria-label": tr(field.labelKey),
        onChange: (event) => onValue(event.target.value),
        children: field.options.map((option) => jsx("option", {
          value: option.value, children: tr(option.labelKey),
        }, option.value)),
      }) }),
    ] });
  }

  // ---- wallpaper: built-in choices + user library in ONE section -----------

  function WallpaperSection({ skinId, field, value, onValue, state, disabled }) {
    const uploadRef = useRef(null);
    const [message, setMessage] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [visible, setVisible] = useState(PAGE_SIZE);
    const schema = getSkinSchema(skinId);
    const builtins = schema?.builtinAssets ?? {};
    const liveAssets = builtinAssetsFor(skinId);
    const choices = field.builtinChoices ?? [];
    const library = state.library;

    const removeAsset = async (asset) => {
      if (deletingId !== null) return; // one delete in flight — no double DELETEs
      const references = state.references[asset.id] ?? [];
      const names = references.map((entry) => `${labelFor(entry.skinId)} · ${entry.key}`).join("\n");
      const confirmed = references.length === 0
        || window.confirm(`${tr("personalization.library.deleteConfirm")}\n${names}`);
      if (!confirmed) return;
      setMessage(null); // a stale note must not outlive its action
      setDeletingId(asset.id);
      const result = await configClient.deleteImage(asset.id);
      setDeletingId(null);
      // Success is announced too: the refetch inside deleteImage removes the
      // cell, but the outcome must never read as "did it actually delete?"
      // (field report — silent success left the user unsure).
      setMessage(result.error
        ? tr("personalization.library.deleteFailed")
        : tr("personalization.library.deleted", { name: asset.displayName }));
    };

    const clearLibrary = async () => {
      const pairs = new Map();
      for (const asset of library) {
        for (const entry of state.references[asset.id] ?? []) {
          pairs.set(`${labelFor(entry.skinId)} · ${entry.key}`, true);
        }
      }
      const names = [...pairs.keys()].join("、");
      const confirmed = window.confirm(tr("personalization.library.clearConfirm", {
        count: library.length,
        names: names === "" ? "—" : names,
      }));
      if (!confirmed) return;
      for (const asset of [...library]) {
        const result = await configClient.deleteImage(asset.id);
        if (result.error) {
          // Stop at the first failure and surface what is left (L8).
          setMessage(tr("personalization.library.clearFailed"));
          configClient.refetch();
          return;
        }
      }
    };

    return jsx("div", { className: "dsh-skins-pz-row", children: [
      jsx("span", { className: "dsh-skins-pz-label", children: tr(field.labelKey) }),
      jsx("div", { className: "dsh-skins-pz-fields", children: [
        choices.length > 0 ? jsx("div", { className: "dsh-skins-pz-group", children: [
          jsx("div", { className: "dsh-skins-pz-muted", children: tr("personalization.builtin") }),
          jsx("div", { className: "dsh-skins-pz-thumbs", children: choices.map((key) => {
            const asset = builtins[key];
            const ref = `builtin:${skinId}:${key}`;
            return jsx("button", {
              type: "button", className: `dsh-skins-pz-thumb${value === ref ? " on" : ""}`,
              disabled, title: tr(asset?.labelKey ?? "personalization.builtin.default"),
              "aria-pressed": value === ref,
              onClick: () => onValue(ref),
              children: jsx("img", { src: liveAssets[key]?.url ?? asset?.url ?? "", alt: tr(asset?.labelKey ?? key), loading: "lazy", decoding: "async" }),
            }, key);
          }) }),
        ] }) : null,
        jsx("div", { className: "dsh-skins-pz-group", children: [
          jsx("div", { className: "dsh-skins-pz-muted", children: tr("personalization.library") }),
          jsx("div", { className: "dsh-skins-pz-thumbs", children: [
            ...library.slice(0, visible).map((asset) => jsx("div", {
              key: asset.id, className: `dsh-skins-pz-cell${value === asset.id ? " on" : ""}`,
              children: [
                jsx("button", {
                  type: "button", className: `dsh-skins-pz-thumb${value === asset.id ? " on" : ""}`,
                  disabled, title: asset.displayName,
                  "aria-pressed": value === asset.id,
                  onClick: () => onValue(asset.id),
                  children: jsx("img", { src: configClient.assetUrl(asset), alt: asset.displayName, loading: "lazy", decoding: "async" }),
                }, asset.id),
                jsx("button", {
                  type: "button",
                  className: `dsh-skins-pz-del${deletingId === asset.id ? " dsh-skins-pz-del-busy" : ""}`,
                  disabled: disabled || deletingId !== null,
                  "aria-label": `${tr("personalization.library.delete")}: ${asset.displayName}`,
                  onClick: () => removeAsset(asset),
                  children: deletingId === asset.id
                    ? jsx("span", { className: "dsh-skins-update-spinner", "aria-hidden": "true" })
                    : "×",
                }, `${asset.id}-del`),
              ],
            })),
            library.length > visible ? jsx("button", {
              type: "button", className: "dsh-skins-pz-btn",
              onClick: () => setVisible(visible + PAGE_SIZE),
              children: tr("personalization.library.more", { count: library.length - visible }),
            }) : null,
            library.length === 0 ? jsx("span", {
              className: "dsh-skins-pz-muted", children: tr("personalization.library.empty"),
            }) : null,
          ] }),
          message === null ? null : jsx("div", { className: "dsh-skins-pz-status dsh-skins-pz-muted", children: message }),
          jsx("div", { className: "dsh-skins-pz-rowbtns", children: [
            jsx("button", {
              type: "button", className: "dsh-skins-pz-btn",
              disabled: disabled || deletingId !== null,
              onClick: () => uploadRef.current?.click(),
              children: tr("personalization.library.upload"),
            }),
            library.length > 0 ? jsx("button", {
              type: "button", className: "dsh-skins-pz-btn dsh-skins-pz-danger",
              disabled: disabled || deletingId !== null,
              onClick: clearLibrary,
              children: tr("personalization.library.clear"),
            }) : null,
          ] }),
          jsx("input", {
            ref: uploadRef, type: "file", accept: "image/png,image/jpeg,image/webp,image/gif",
            multiple: true,
            style: { display: "none" },
            onChange: async (event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = ""; // re-selecting the same files must re-fire
              if (files.length === 0) return;

              // Q43 reversal (v2.6): the picker is the batch entry — multi-select
              // uploads sequentially (the store serializes writes anyway) with
              // progress and a failure summary. Drag-drop stays out.
              if (files.length > 1) {
                let ok = 0;
                let lastAssetId = null;
                let firstError = null;
                for (let index = 0; index < files.length; index += 1) {
                  setMessage(tr("personalization.library.uploadingBatch", {
                    done: index + 1, total: files.length,
                  }));
                  const result = await configClient.uploadImage(files[index]);
                  if (result.asset) {
                    ok += 1;
                    lastAssetId = result.asset.id;
                  } else if (firstError === null) {
                    firstError = resolveHostErrorText(
                      { code: result.error, message: tr("personalization.library.uploadFailed") },
                      tr,
                    );
                  }
                }
                if (lastAssetId !== null) onValue(lastAssetId); // land on the newest upload
                setMessage(firstError === null
                  ? null
                  : ok === 0
                    ? firstError
                    : tr("personalization.library.uploadSomeFailed", {
                        ok, failed: files.length - ok, reason: firstError,
                      }));
                return;
              }

              const result = await configClient.uploadImage(files[0]);
              if (result.asset) {
                setMessage(null);
                onValue(result.asset.id);
              } else {
                // Surface WHY the upload was rejected (server code → localized
                // reason; unmapped codes fall back to the generic copy). The
                // delete-failed text must never render for an upload — field
                // report: a failed upload showed 删除失败 and misdirected the
                // bug hunt.
                setMessage(resolveHostErrorText(
                  { code: result.error, message: tr("personalization.library.uploadFailed") },
                  tr,
                ));
              }
            },
          }),
        ] }),
      ] }),
    ] });
  }

  // ---- the panel ------------------------------------------------------------

  // Panel-collapse glyph: a double chevron pointing LEFT — the direction the
  // panel's edge actually travels when it folds back into the skin list
  // (motion-consistent; a right-pointing arrow read as "expand", field
  // report). Explicit `L` commands with spaces are REQUIRED here: the
  // compact `M11 6-6 6…` form (implicit lineto after moveto, sign-separated)
  // mis-tokenizes in Chromium — the pair's y is swallowed and the chevron
  // collapses into a horizontal bar (field report: "乱码"). The affordance
  // collapses the PANEL, not the shell — click-outside/Esc remain the shell
  // dismissers.
  function CollapseIcon() {
    return jsx("svg", {
      viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true",
      children: jsx("path", {
        d: "M17 6 L11 12 L17 18 M11 6 L5 12 L11 18",
        stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round",
      }),
    });
  }

  return function PersonalizationPanel({ skinId, onCollapse }) {
    const state = useConfigState();
    const schema = getSkinSchema(skinId);
    const headerRef = useRef(null);
    // In wide mode the panel mounts to the shell's right while the shell is
    // still narrow. Focus the heading without asking the shell to
    // horizontally scroll it into view; that transient scrollLeft used to
    // shove the list column left and make expansion look like a bounce
    // (field issue #12). In stacked mode, retain normal focus scrolling so
    // keyboard users are brought down to the newly mounted panel.
    const wideLayout = typeof window !== "undefined" && window.innerWidth >= 905;
    useEffect(() => {
      headerRef.current?.focus?.(wideLayout ? { preventScroll: true } : undefined);
    }, []);

    if (schema === null) return null;
    const writesBlocked = state.status !== "synced" || state.mode === "recovery";
    const overrides = configClient.effectiveOverrides(skinId);
    const { values } = mergeValues(skinId, overrides);
    const hasAnyOverride = Object.keys(overrides).length > 0;

    const fieldRows = schema.fields.map((field) => {
      const value = values[field.key];
      const setValue = (next) => configClient.preview(skinId, field.key, next);
      const common = { field, value, onValue: setValue, disabled: writesBlocked };
      switch (field.type) {
        case "text": return jsx(TextField, { ...common, key: field.key });
        case "range": return jsx(RangeField, { ...common, key: field.key });
        case "select": return jsx(SelectField, { ...common, key: field.key });
        case "image": return jsx(WallpaperSection, {
          ...common, key: field.key, skinId, state,
        });
        default: return null;
      }
    });

    // Footer STATUS bar (Q50, v1.0.0 height-consistency ruling): transient
    // status strips only, rendered just while there is something to say. The
    // reset control used to live here and grew the panel by one button the
    // moment a skin had any override — panel heights then differed between
    // modified and pristine skins (and when re-targeting between them). It
    // now lives in the header row, whose height is fixed.
    const statusCluster = [];
    if (state.mode === "recovery") {
      statusCluster.push(jsx("div", { key: "recovery", className: "dsh-skins-pz-status dsh-skins-pz-warn", children: [
        jsx("div", { children: tr("personalization.status.recovery") }),
        jsx("div", { className: "dsh-skins-pz-muted", children: tr("personalization.status.recoveryHint") }),
        jsx("button", {
          type: "button", className: "dsh-skins-pz-btn",
          onClick: () => configClient.confirmRecovery(),
          children: tr("personalization.recovery.confirm"),
        }),
      ] }));
    }
    if (state.status === "loading") {
      statusCluster.push(jsx("div", { key: "loading", className: "dsh-skins-pz-status", children: [
        jsx("span", { children: tr("personalization.status.loading") }),
      ] }));
    }
    if (state.status === "offline-failed") {
      statusCluster.push(jsx("div", { key: "offline", className: "dsh-skins-pz-status", children: [
        jsx("span", { children: tr("personalization.status.offline") }),
        jsx("button", {
          type: "button", className: "dsh-skins-pz-btn",
          onClick: () => configClient.retry(),
          children: tr("personalization.status.retry"),
        }),
      ] }));
    }
    if (state.status === "unsupported-readonly") {
      statusCluster.push(jsx("div", { key: "ro", className: "dsh-skins-pz-status", children: [
        jsx("span", { children: tr("personalization.status.unsupported") }),
      ] }));
    }
    // Auto-save failure strips (ADR-0003): exhausted revision conflicts use
    // lastFlushCode; ordinary server failures use lastFlushError. The next
    // edit clears both fields.
    if (state.lastFlushCode === "REVISION_CONFLICT") {
      statusCluster.push(jsx("div", { key: "save-conflict", className: "dsh-skins-pz-status dsh-skins-pz-warn", children: [
        jsx("span", { children: tr("personalization.saveConflict") }),
      ] }));
    } else if (state.lastFlushError) {
      statusCluster.push(jsx("div", { key: "save-error", className: "dsh-skins-pz-status dsh-skins-pz-warn", children: [
        jsx("span", { children: tr("personalization.saveFailed") }),
        jsx("div", { className: "dsh-skins-pz-muted", children: state.lastFlushError }),
      ] }));
    }

    return jsx("div", { className: "dsh-skins-pz", children: [
      // Header row (`.dsh-skins-pz-head`): the heading stays the focus
      // target (issue #12); the reset and collapse controls pack at its
      // right end so both are discoverable where the user is looking —
      // the gear that opened it is a full column away (user ruling). The
      // reset appears only while the skin has overrides, and its appearing
      // can no longer change the panel's height (v1.0.0 ruling).
      jsx("div", { className: "dsh-skins-pz-head", children: [
        jsx("div", {
          ref: headerRef, className: "dsh-skins-pop-title",
          tabIndex: -1, role: "heading", "aria-level": 2,
          children: `${tr("personalization.title")} · ${labelFor(skinId)}`,
        }),
        hasAnyOverride ? jsx("button", {
          type: "button", className: "dsh-skins-pz-btn dsh-skins-pz-danger",
          disabled: writesBlocked,
          onClick: () => {
            // Destructive + immediate (auto-save, ADR-0003) → confirm first,
            // listing the NON-default fields the reset will visibly change.
            const affected = schema.fields
              .filter((field) => overrides[field.key] !== undefined)
              .map((field) => tr(field.labelKey));
            const confirmed = window.confirm(tr("personalization.resetConfirm", {
              fields: affected.length > 0 ? affected.join(tr("personalization.resetJoin")) : "—",
            }));
            if (!confirmed) return;
            for (const field of schema.fields) configClient.previewReset(skinId, field.key);
            void configClient.flushNow();
          },
          children: tr("personalization.reset"),
        }) : null,
        onCollapse ? jsx("button", {
          type: "button",
          className: "dsh-skins-pz-collapse",
          "aria-label": tr("personalization.collapse"),
          title: tr("personalization.collapse"),
          onClick: onCollapse,
          children: jsx(CollapseIcon, {}),
        }) : null,
      ] }),
      ...fieldRows,
      statusCluster.length > 0 ? jsx("div", { className: "dsh-skins-pz-actions", children:
        jsx("div", { className: "dsh-skins-pz-cluster dsh-skins-pz-cluster-status", children: statusCluster }),
      }) : null,
    ] });
  };
}
