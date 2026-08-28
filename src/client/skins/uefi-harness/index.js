/**
 * Dummy UEFI Harness skin.
 * It is intentionally self-contained and can be deleted without touching any
 * other skin. Replace its assets/styles in this directory when the real design
 * is ready.
 */
export function createUefiHarness({ jsx }) {
  function UefiMark({ size = 24, className }) {
    return jsx("svg", {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      className,
      xmlns: "http://www.w3.org/2000/svg",
      "aria-hidden": "true",
      children: [
        jsx("rect", { x: "5", y: "5", width: "14", height: "14", rx: "3", fill: "currentColor", opacity: ".14" }),
        jsx("rect", { x: "6.5", y: "6.5", width: "11", height: "11", rx: "2", stroke: "currentColor", strokeWidth: "1.5" }),
        jsx("path", { d: "M9 9v3.5a3 3 0 0 0 6 0V9", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round" }),
        jsx("path", { d: "M8 2v3M12 2v3M16 2v3M8 19v3M12 19v3M16 19v3M2 8h3M2 12h3M2 16h3M19 8h3M19 12h3M19 16h3", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" }),
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

  const faviconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#241b52"/><rect x="14" y="14" width="36" height="36" rx="8" fill="#8b7cff"/><path d="M23 23v11a9 9 0 0 0 18 0V23" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/></svg>';
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
    description: "Dummy：固件芯片标识 · 紫蓝双主题 · 无背景图",
    bodyAttr: "dshUefiHarness",
    Mark: UefiMark,
    Name: UefiName,
    favicon,
    faviconMime: "image/svg+xml",
    css,
    art: "",
    scrimLight: "",
    scrimDark: "",
    placeholderLight,
    placeholderDark,
    slogans: { zh: "启于固件，行于万象", en: "Boot before everything" },
  };
}
