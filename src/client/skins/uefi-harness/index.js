/**
 * UEFI Harness skin.
 * It is intentionally self-contained and can be deleted without touching any
 * other skin. The mark and favicon carry the UEFI Forum's official red cube
 * logo (source and trademark note in README known limits); the rest of the
 * design remains a placeholder until the final design lands.
 */
// Official UEFI Forum logo — the red cube with white "uefi" letters, embedded
// as two vector paths traced from uefi.org's published uefi_logo_red.gif
// (retrieved via Wikimedia Commons "Logo of the UEFI Forum.svg"; trademark of
// the UEFI Forum, used here solely to identify the UEFI Harness skin).
const LOGO_VIEWBOX = "0 0 367.92 424.8";
const LOGO_WHITE =
  "M183.505 7.5l12.515.016 59.87 34.233.632 13.683 23.938.38L339.524 89.6l16.386 30.31 5.136 192.808L349.92 329.3l-56.88 32.657-19.564-1.81-13.315 20.69-56.41 32.404-89.687-32.764L4.375 312.71 7.5 109.59z";
const LOGO_RED =
  "M182.88 0l13.14 7.516-86.427 50.52S83.443 71.21 74.16 81.362c-11.362 12.428-7.917 30.125 2.16 42.48 24.693 30.28 88.66 54.367 141.12 34.56C239.666 150.01 339.524 89.6 339.524 89.6l28.397 16.243v213.12l-18 10.337V207.36l-56.88 32.66v121.937l-32.88 18.88V311.04l20.28-12.24v-51.543l-20.28 11.646s-2.37-32.09 1.92-42.902c4.1-10.31 15.74-21.72 25.2-18.72 6.95 2.21 5.76 24.95 5.76 24.95s42.95-24.85 56.88-32.86c2.25-36.34-9.13-59-43.92-55.44-15.87 1.63-28.37 10.02-38.88 17.28-11.14 7.7-20.4 16.555-28.8 26.64-15.89 19.1-33.02 45.26-35.28 76.32-1.77 24.357.71 159.07.71 159.07L183.6 424.8 0 318.96V105.84L182.88 0zM115.2 167.04c-13.318-10.95-29.718-21.208-47.52-25.2-11.942-2.678-23.93-1.128-32.4 3.6-22.328 12.466-28.844 45.437-26.64 77.76 3.508 51.445 22.065 86.146 48.96 113.04 17.977 17.977 47.576 39.66 74.16 41.76 27.702 2.187 36.335-16.023 42.48-36.72-20.956-14.324-44.265-26.296-65.52-40.32-3.91 2.99-3.572 6.328-9.36 6.48-5.15.135-10.955-4.727-14.4-9.36-6.09-8.19-8.026-21.054-8.64-30.96 33.78 18.062 66.363 37.317 100.08 55.44 3.688-67.27-23.104-124.2-61.2-155.52zM280.46 55.813l-85.795 52.732s-22.85 14.813-38.136 13.134c-4.99-.55-13.31-4.77-13.68-8.64-.7-7.16 25.2-21.02 25.2-21.02l87.84-50.27L280.46 55.8zM109.44 241.2c-11.23-5.81-21.966-12.114-32.4-18.72 1.032-7.922 2.438-15.645 12.24-13.68 11.49 2.303 19.817 20.686 20.16 32.4z";

export function createUefiHarness({ jsx }) {
  function UefiMark({ size = 24, className }) {
    return jsx("svg", {
      width: size,
      height: size,
      viewBox: LOGO_VIEWBOX,
      fill: "none",
      className,
      xmlns: "http://www.w3.org/2000/svg",
      "aria-hidden": "true",
      children: [
        jsx("path", { fill: "#FFFFFF", d: LOGO_WHITE }),
        jsx("path", { fill: "#DC0000", d: LOGO_RED }),
      ],
    });
  }

  function UefiName() {
    return jsx("span", {
      style: { display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 650, letterSpacing: ".02em", whiteSpace: "nowrap" },
      children: [
        jsx("span", { children: "UEFI" }),
        jsx("span", {
          style: { border: "1px solid currentColor", borderRadius: "4px", padding: "0 5px", fontSize: "10px", lineHeight: "16px", letterSpacing: ".08em" },
          children: "HARNESS",
        }),
      ],
    });
  }

  const faviconSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + LOGO_VIEWBOX + '">' +
    '<path fill="#FFFFFF" d="' + LOGO_WHITE + '"/>' +
    '<path fill="#DC0000" d="' + LOGO_RED + '"/></svg>';
  const favicon = "data:image/svg+xml," + encodeURIComponent(faviconSvg);

  const css = `
body[data-dsh-uefi-harness] {
  --dsw-alias-brand-primary: #6553d8;
  --dsw-alias-brand-primary-invert: #ffffff;
  --dsw-alias-brand-text: #5846c2;
  --dsw-alias-bg-base: rgba(248, 247, 255, 0.78);
  --dsw-alias-bg-overlay: rgba(252, 251, 255, 0.94);
  --dsw-alias-bg-module-platform: rgba(241, 238, 255, 0.82);
  --dsw-alias-bg-layer-1: rgba(255, 255, 255, 0.72);
  --dsw-alias-bg-layer-2: rgba(247, 245, 255, 0.82);
  --dsw-alias-bg-layer-3: rgba(241, 238, 255, 0.88);
  --dsw-specific-sidebar-fill: rgba(238, 235, 255, 0.84);
  --dsw-specific-sidebar-nav-item-hover: rgba(101, 83, 216, 0.09);
  --dsw-specific-sidebar-nav-item-active: rgba(101, 83, 216, 0.15);
  --dsw-specific-sidebar-nav-item-active-accent: #8b7cff;
  --dsw-specific-input-major: rgba(255, 255, 255, 0.78);
  --dsw-specific-menu: rgba(248, 247, 255, 0.96);
  --dsw-specific-selector: rgba(232, 228, 255, 0.88);
  --dsw-specific-tip: rgba(244, 242, 255, 0.94);
  --dsw-alias-label-primary: #211c36;
  --dsw-alias-label-secondary: #554d74;
  --dsw-alias-label-dimmed: #81799e;
  --dsw-alias-interactive-bg-hover: rgba(101, 83, 216, 0.09);
  --dsw-alias-interactive-bg-active: rgba(101, 83, 216, 0.15);
  --dsw-specific-bubble: rgba(101, 83, 216, 0.11);
  --dsw-specific-bubble-highlight: rgba(101, 83, 216, 0.18);
  --dsw-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
}
body[data-dsh-uefi-harness][data-ds-dark-theme] {
  --dsw-alias-brand-primary: #a99cff;
  --dsw-alias-brand-primary-invert: #1b143a;
  --dsw-alias-brand-text: #b7acff;
  --dsw-alias-bg-base: rgba(23, 18, 45, 0.80);
  --dsw-alias-bg-overlay: rgba(27, 21, 54, 0.96);
  --dsw-alias-bg-module-platform: rgba(39, 31, 73, 0.86);
  --dsw-alias-bg-layer-1: rgba(31, 25, 59, 0.82);
  --dsw-alias-bg-layer-2: rgba(39, 31, 73, 0.86);
  --dsw-alias-bg-layer-3: rgba(48, 38, 88, 0.90);
  --dsw-specific-sidebar-fill: rgba(25, 20, 48, 0.90);
  --dsw-specific-sidebar-nav-item-hover: rgba(169, 156, 255, 0.10);
  --dsw-specific-sidebar-nav-item-active: rgba(169, 156, 255, 0.17);
  --dsw-specific-sidebar-nav-item-active-accent: #6657a8;
  --dsw-specific-input-major: rgba(42, 34, 78, 0.82);
  --dsw-specific-menu: rgba(28, 22, 55, 0.97);
  --dsw-specific-selector: rgba(51, 40, 96, 0.90);
  --dsw-specific-tip: rgba(34, 27, 65, 0.96);
  --dsw-alias-label-primary: #f0edff;
  --dsw-alias-label-secondary: #b9b1d6;
  --dsw-alias-label-dimmed: #827a9f;
  --dsw-alias-interactive-bg-hover: rgba(169, 156, 255, 0.11);
  --dsw-alias-interactive-bg-active: rgba(169, 156, 255, 0.18);
  --dsw-specific-bubble: rgba(60, 48, 108, 0.90);
  --dsw-specific-bubble-highlight: rgba(78, 63, 138, 0.92);
}
body[data-dsh-uefi-harness] [id="root"] { background: transparent; }
body[data-dsh-uefi-harness] [data-streaming] {
  border-radius: 4px;
  box-shadow: inset 3px 0 0 var(--dsw-alias-brand-primary);
}`;

  const placeholderLight =
    "radial-gradient(900px 680px at 12% 0%, rgba(139,124,255,.18), transparent 62%)," +
    "radial-gradient(850px 620px at 92% 100%, rgba(64,190,205,.12), transparent 58%)," +
    "linear-gradient(145deg, #f9f8ff, #eeeaff)";
  const placeholderDark =
    "radial-gradient(900px 680px at 12% 0%, rgba(139,124,255,.18), transparent 62%)," +
    "radial-gradient(850px 620px at 92% 100%, rgba(42,143,165,.12), transparent 58%)," +
    "linear-gradient(145deg, #151027, #211945)";

  return {
    id: "uefi-harness",
    label: "UEFI Harness",
    description: {
      zh: "赤玺凝方 · 流霞渐染 · 绀青成韵",
      en: "Cube mark · gradient backdrop · violet-blue palette",
    },
    bodyAttr: "dshUefiHarness",
    Mark: UefiMark,
    Name: UefiName,
    favicon,
    faviconMime: "image/svg+xml",
    title: "UEFI Harness",
    css,
    art: "",
    scrimLight: "",
    scrimDark: "",
    placeholderLight,
    placeholderDark,
    slogans: { zh: "启于固件 · 行于万象", en: "Boot before everything" },
  };
}
