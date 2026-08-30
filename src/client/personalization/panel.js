/**
 * Personalization panel — schema-driven field controls rendered inside the
 * skin switcher popover (design §7.2). The panel is generic: it reads field
 * definitions from the shared catalog and never knows a specific skin's
 * business mapping. Writes flow through the config client's state machine
 * (preview → debounced flush); the gallery manages the global image library.
 */

import {
  getSkinSchema,
  mergeValues,
} from "../../shared/personalization/catalog.js";

const PAGE_SIZE = 24;

export function createPersonalizationPanel({ jsx, react, configClient, tr, builtinAssetsFor, labelFor }) {
  const { useState, useEffect, useRef } = react;

  function useConfigState() {
    const [state, setState] = useState(() => configClient.getState());
    useEffect(() => configClient.onStateChange(() => setState(configClient.getState())), []);
    return state;
  }

  function statusText(state) {
    switch (state.status) {
      case "loading": return tr("personalization.status.loading");
      case "offline-failed": return tr("personalization.status.offline");
      case "unsupported-readonly": return tr("personalization.status.unsupported");
      default: return null;
    }
  }

  function StatusStrip({ state }) {
    const children = [];
    if (state.mode === "recovery") {
      children.push(jsx("div", { key: "recovery", className: "dsh-skins-pz-status dsh-skins-pz-warn", children: [
        jsx("div", { children: tr("personalization.status.recovery") }),
        jsx("div", { className: "dsh-skins-pz-muted", children: tr("personalization.status.recoveryHint") }),
        jsx("button", {
          type: "button", className: "dsh-skins-pz-btn",
          onClick: () => configClient.confirmRecovery(),
          children: tr("personalization.recovery.confirm"),
        }),
      ] }));
    }
    const text = statusText(state);
    if (text !== null) {
      children.push(jsx("div", { key: "status", className: "dsh-skins-pz-status", children: [
        jsx("span", { children: text }),
        state.status === "offline-failed" ? jsx("button", {
          type: "button", className: "dsh-skins-pz-btn",
          onClick: () => configClient.retry(),
          children: tr("personalization.status.retry"),
        }) : null,
      ] }));
    }
    if (state.dirtyCount > 0) {
      children.push(jsx("div", {
        key: "dirty", className: "dsh-skins-pz-status dsh-skins-pz-muted",
        children: tr("personalization.dirty", { count: state.dirtyCount }),
      }));
    }
    return children.length === 0 ? null : jsx("div", { className: "dsh-skins-pz-strip", children: children });
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
          onChange: (event) => onValue(event.target.value),
        })];
    return jsx("label", { className: "dsh-skins-pz-row", children: [
      jsx("span", { className: "dsh-skins-pz-label", children: tr(field.labelKey) }),
      jsx("div", { className: "dsh-skins-pz-fields", children: inputs }),
    ] });
  }

  function ColorField({ field, value, onValue, disabled }) {
    const pair = value ?? field.default;
    const swatch = (mode) => jsx("div", { key: mode, className: "dsh-skins-pz-color", children: [
      jsx("span", { className: "dsh-skins-pz-muted", children: tr(mode === "light" ? "personalization.light" : "personalization.dark") }),
      jsx("input", {
        type: "color", value: pair[mode], disabled,
        "aria-label": `${tr(field.labelKey)} (${mode})`,
        onChange: (event) => onValue({ ...pair, [mode]: event.target.value }),
      }),
    ] });
    return jsx("label", { className: "dsh-skins-pz-row", children: [
      jsx("span", { className: "dsh-skins-pz-label", children: tr(field.labelKey) }),
      jsx("div", { className: "dsh-skins-pz-fields dsh-skins-pz-colors", children: [swatch("light"), swatch("dark")] }),
    ] });
  }

  function RangeField({ field, value, onValue, disabled }) {
    const slider = (mode, current, commit) => jsx("div", { key: mode ?? "single", className: "dsh-skins-pz-range", children: [
      mode === null ? null : jsx("span", { className: "dsh-skins-pz-muted", children: tr(mode === "light" ? "personalization.light" : "personalization.dark") }),
      jsx("input", {
        type: "range", min: field.min, max: field.max, step: field.step,
        value: current, disabled,
        "aria-label": mode === null ? tr(field.labelKey) : `${tr(field.labelKey)} (${mode})`,
        onChange: (event) => commit(Number(event.target.value)),
      }),
      jsx("output", { children: `${current}${field.unit ?? ""}` }),
    ] });
    if (field.scope === "single") {
      return jsx("label", { className: "dsh-skins-pz-row", children: [
        jsx("span", { className: "dsh-skins-pz-label", children: tr(field.labelKey) }),
        jsx("div", { className: "dsh-skins-pz-fields", children: slider(null, value ?? field.default, (next) => onValue(next)) }),
      ] });
    }
    const pair = value ?? field.default;
    return jsx("label", { className: "dsh-skins-pz-row", children: [
      jsx("span", { className: "dsh-skins-pz-label", children: tr(field.labelKey) }),
      jsx("div", { className: "dsh-skins-pz-fields", children: [
        slider("light", pair.light, (next) => onValue({ ...pair, light: next })),
        slider("dark", pair.dark, (next) => onValue({ ...pair, dark: next })),
      ] }),
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

  function ImageField({ skinId, field, value, onValue, state, disabled }) {
    const uploadRef = useRef(null);
    const [uploadMessage, setUploadMessage] = useState(null);
    const [visible, setVisible] = useState(PAGE_SIZE);
    const schema = getSkinSchema(skinId);
    const builtins = schema?.builtinAssets ?? {};
    // Catalog metadata carries mime/labelKey only; the renderable URLs live
    // on the registered skin instance (builtinAssetsFor).
    const liveAssets = builtinAssetsFor(skinId);
    const choices = field.builtinChoices ?? [];
    const library = state.library;

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
              children: jsx("img", { src: liveAssets[key]?.url ?? asset?.url ?? "", alt: tr(asset?.labelKey ?? key), loading: "lazy" }),
            }, key);
          }) }),
        ] }) : null,
        jsx("div", { className: "dsh-skins-pz-group", children: [
          jsx("div", { className: "dsh-skins-pz-muted", children: tr("personalization.library") }),
          jsx("div", { className: "dsh-skins-pz-thumbs", children: [
            ...library.slice(0, visible).map((asset) => jsx("button", {
              type: "button", className: `dsh-skins-pz-thumb${value === asset.id ? " on" : ""}`,
              disabled, title: asset.displayName,
              "aria-pressed": value === asset.id,
              onClick: () => onValue(asset.id),
              children: jsx("img", { src: configClient.assetUrl(asset), alt: asset.displayName, loading: "lazy" }),
            }, asset.id)),
            library.length > visible ? jsx("button", {
              type: "button", className: "dsh-skins-pz-btn",
              onClick: () => setVisible(visible + PAGE_SIZE),
              children: tr("personalization.library.more", { count: library.length - visible }),
            }) : null,
            library.length === 0 ? jsx("span", {
              className: "dsh-skins-pz-muted", children: tr("personalization.library.empty"),
            }) : null,
          ] }),
          uploadMessage === null ? null : jsx("div", { className: "dsh-skins-pz-status dsh-skins-pz-muted", children: uploadMessage }),
          jsx("button", {
            type: "button", className: "dsh-skins-pz-btn", disabled,
            onClick: () => uploadRef.current?.click(),
            children: tr("personalization.library.upload"),
          }),
          jsx("input", {
            ref: uploadRef, type: "file", accept: "image/png,image/jpeg,image/webp,image/gif",
            style: { display: "none" },
            onChange: async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setUploadMessage(tr("personalization.theme.working"));
              const result = await configClient.uploadImage(file);
              if (result.asset) {
                setUploadMessage(null);
                onValue(result.asset.id);
              } else {
                setUploadMessage(tr("personalization.library.deleteFailed"));
              }
              event.target.value = "";
            },
          }),
        ] }),
      ] }),
    ] });
  }

  // ---- gallery management ---------------------------------------------------

  function Gallery({ state, disabled }) {
    const [message, setMessage] = useState(null);
    const [visible, setVisible] = useState(PAGE_SIZE);
    return jsx("div", { className: "dsh-skins-pz-gallery", children: [
      jsx("div", { className: "dsh-skins-pop-divider", "aria-hidden": "true" }),
      jsx("div", { className: "dsh-skins-pz-muted", children: tr("personalization.library.manage") }),
      message === null ? null : jsx("div", { className: "dsh-skins-pz-status", children: message }),
      ...state.library.slice(0, visible).map((asset) => {
        const references = state.references[asset.id] ?? [];
        return jsx("div", { key: asset.id, className: "dsh-skins-pz-asset", children: [
          jsx("img", { src: configClient.assetUrl(asset), alt: asset.displayName, loading: "lazy" }),
          jsx("div", { className: "dsh-skins-pz-asset-copy", children: [
            jsx("div", { children: asset.displayName }),
            references.length > 0 ? jsx("div", {
              className: "dsh-skins-pz-muted",
              children: tr("personalization.library.usedBy", { count: references.length }),
            }) : null,
          ] }),
          jsx("button", {
            type: "button", className: "dsh-skins-pz-btn", disabled,
            onClick: async () => {
              const names = references.map((entry) => `${labelFor(entry.skinId)} · ${entry.key}`).join("\n");
              const confirmed = references.length === 0
                || window.confirm(`${tr("personalization.library.deleteConfirm")}\n${names}`);
              if (!confirmed) return;
              const result = await configClient.deleteImage(asset.id);
              if (result.error) setMessage(tr("personalization.library.deleteFailed"));
            },
            children: tr("personalization.library.delete"),
          }),
        ] });
      }),
      state.library.length === 0 ? jsx("div", {
        className: "dsh-skins-pz-muted", children: tr("personalization.library.empty"),
      }) : null,
      state.library.length > visible ? jsx("button", {
        type: "button", className: "dsh-skins-pz-btn",
        onClick: () => setVisible(visible + PAGE_SIZE),
        children: tr("personalization.library.more", { count: state.library.length - visible }),
      }) : null,
    ] });
  }

  // ---- the panel ------------------------------------------------------------

  return function PersonalizationPanel({ skinId, onBack }) {
    const state = useConfigState();
    const schema = getSkinSchema(skinId);
    const headerRef = useRef(null);
    const importRef = useRef(null);
    const [pendingImport, setPendingImport] = useState(null);
    const [themeMessage, setThemeMessage] = useState(null);
    useEffect(() => { headerRef.current?.focus?.(); }, []);

    const startExport = async () => {
      setThemeMessage(tr("personalization.theme.working"));
      const result = await configClient.exportTheme(skinId);
      if (result.error) { setThemeMessage(tr("personalization.theme.failed")); return; }
      setThemeMessage(null);
      try {
        const url = URL.createObjectURL(result.blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = result.filename;
        anchor.click();
        URL.revokeObjectURL(url);
      } catch { setThemeMessage(tr("personalization.theme.failed")); }
    };

    const startImport = async (file) => {
      setThemeMessage(tr("personalization.theme.working"));
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await configClient.prepareThemeImport(bytes);
      if (result.error) {
        setThemeMessage(result.error === "offline" ? tr("personalization.status.offline") : tr("personalization.theme.failed"));
        return;
      }
      setThemeMessage(null);
      setPendingImport({ ...result.prepare, purge: false });
    };

    const backToList = () => {
      setPersonalizeId(null);
      try {
        document.getElementById(`${skinId}-gear`)?.focus?.();
      } catch {}
    };

    const confirmImport = async () => {
      const { importToken, baseRevision, purge } = pendingImport;
      setThemeMessage(tr("personalization.theme.working"));
      const result = await configClient.commitThemeImport({
        importToken, baseRevision, confirm: true, purgeUnknown: purge === true,
      });
      if (result.error === "IMPORT_CONFLICT" || result.error === "IMPORT_EXPIRED") {
        setPendingImport(null); // a fresh preview is required
        setThemeMessage(tr("personalization.theme.conflict"));
        return;
      }
      if (result.error) {
        // Keep the preview: the backend commit is idempotent per token, so a
        // plain retry after a transient failure is safe.
        setThemeMessage(tr("personalization.theme.failed"));
        return;
      }
      setPendingImport(null);
      setThemeMessage(tr("personalization.theme.done"));
    };

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
        case "color": return jsx(ColorField, { ...common, key: field.key });
        case "range": return jsx(RangeField, { ...common, key: field.key });
        case "select": return jsx(SelectField, { ...common, key: field.key });
        case "image": return jsx(ImageField, {
          ...common, key: field.key, skinId, state,
        });
        default: return null;
      }
    });

    return jsx("div", { className: "dsh-skins-pz", children: [
      jsx("div", { className: "dsh-skins-pz-head", children: [
        jsx("button", {
          type: "button", className: "dsh-skins-pz-btn", onClick: backToList,
          children: tr("personalization.back"),
        }),
        jsx("div", {
          ref: headerRef, className: "dsh-skins-pop-title",
          tabIndex: -1, role: "heading", "aria-level": 2,
          children: `${tr("personalization.title")} · ${labelFor(skinId)}`,
        }),
        jsx("button", {
          type: "button", className: "dsh-skins-pz-btn", disabled: writesBlocked,
          onClick: startExport,
          children: tr("personalization.theme.export"),
        }),
        jsx("button", {
          type: "button", className: "dsh-skins-pz-btn", disabled: writesBlocked,
          onClick: () => importRef.current?.click(),
          children: tr("personalization.theme.import"),
        }),
        jsx("input", {
          ref: importRef, type: "file", accept: ".zip,application/zip",
          style: { display: "none" },
          onChange: (event) => {
            const file = event.target.files?.[0];
            if (file) startImport(file);
            event.target.value = "";
          },
        }),
      ] }),
      jsx(StatusStrip, { state }),
      themeMessage === null ? null : jsx("div", { className: "dsh-skins-pz-status dsh-skins-pz-muted", children: themeMessage }),
      pendingImport === null ? null : jsx("div", { className: "dsh-skins-pz-strip", role: "alertdialog", "aria-label": tr("personalization.theme.importTitle"), children: [
        jsx("div", { children: tr("personalization.theme.importTitle") }),
        jsx("div", { className: "dsh-skins-pz-muted", children: `${tr("personalization.theme.setFields")}: ${pendingImport.diff.setFields.join(", ") || "—"}` }),
        jsx("div", { className: "dsh-skins-pz-muted", children: `${tr("personalization.theme.removeFields")}: ${pendingImport.diff.removeFields.join(", ") || "—"}` }),
        pendingImport.diff.keepUnknown.length > 0 ? jsx("label", { className: "dsh-skins-pz-muted", children: [
          jsx("input", {
            type: "checkbox",
            checked: pendingImport.purge === true,
            onChange: (event) => setPendingImport({ ...pendingImport, purge: event.target.checked }),
          }),
          ` ${tr("personalization.theme.keepUnknown")} (${pendingImport.diff.keepUnknown.join(", ")}) — ${tr("personalization.theme.purge")}`,
        ] }) : null,
        jsx("div", { className: "dsh-skins-pz-status", children: [
          jsx("button", {
            type: "button", className: "dsh-skins-pz-btn",
            onClick: () => setPendingImport(null),
            children: tr("personalization.theme.cancel"),
          }),
          jsx("button", {
            type: "button", className: "dsh-skins-pz-btn",
            onClick: confirmImport,
            children: tr("personalization.theme.confirm"),
          }),
        ] }),
      ] }),
      ...fieldRows,
      hasAnyOverride ? jsx("button", {
        type: "button", className: "dsh-skins-pz-btn", disabled: writesBlocked,
        onClick: () => {
          for (const field of schema.fields) configClient.previewReset(skinId, field.key);
        },
        children: tr("personalization.reset"),
      }) : null,
      jsx(Gallery, { state, disabled: writesBlocked }),
    ] });
  };
}
