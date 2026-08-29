/**
 * Capture README preview shots from the live DSH Web GUI.
 *
 * Privacy protocol (see README contribution docs):
 *   1. UI forced to zh-CN; every workspace row in the sidebar is collapsed
 *      into its folder (aria-expanded=false) before shooting;
 *   2. "New Session" is clicked so the conversation area is an empty session —
 *      no conversation content ever enters the frame;
 *   3. foreign banners (e.g. the dsh-auth "internal testing" notice) are
 *      hidden — they belong to other plugins, not to this skin;
 *   4. the switcher close-up frames the popover AND its trigger button
 *      together (the update row stays visible; its text depends on the
 *      install source — acceptable per maintainer decision).
 *
 * Side-effect care: switching the appearance card writes the host-scoped
 * theme preference, so the originally selected card is restored at the end.
 *
 * Usage:
 *   node scripts/capture-previews.mjs --probe                 # inspect only
 *   node scripts/capture-previews.mjs                         # full capture
 *   node scripts/capture-previews.mjs --skin tgcf --gate      # release gate assertions
 * Options:
 *   --url <base>   default http://127.0.0.1:3080
 *   --out <dir>    default docs/assets
 *   --skin <id>    default openbmc (output names follow the skin id)
 *   --gate         run the semi-automated release-gate assertions and exit
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};

const baseUrl = option("--url", "http://127.0.0.1:3080");
const outDir = option("--out", "docs/assets");
const skin = option("--skin", "openbmc");
const probe = flag("--probe");
const gate = flag("--gate");

const VIEWPORT = { width: 1600, height: 1000 };
const WEBP_QUALITY = 0.82;

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
mkdirSync(outDir, { recursive: true });

/** Convert a PNG buffer to WebP through an in-page canvas (no extra deps). */
async function toWebp(page, pngBuffer, quality = WEBP_QUALITY) {
  const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
  const out = await page.evaluate(async ({ dataUrl, quality }) => {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = dataUrl; });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);
    return canvas.toDataURL("image/webp", quality);
  }, { dataUrl, quality });
  return Buffer.from(out.split(",", 2)[1], "base64");
}

/** Dismiss the official first-visit "internal testing" notice dialog. */
async function dismissNotices(page) {
  const modal = page.locator('div[role="presentation"]:has(button:has-text("继续"))').first();
  if (await modal.count() === 0) return false;
  await modal.locator("button").last().click();
  try {
    await page.waitForSelector('div[class*="_mask_"]', { state: "detached", timeout: 5_000 });
  } catch {}
  await page.waitForTimeout(600);
  return true;
}

async function newPage(colorScheme) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme,
    locale: "zh-CN", // screenshots use the Chinese UI (primary audience)
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/?skin=${skin}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".dsh-skins-switcher-btn", { timeout: 30_000 });
  await page.waitForTimeout(2_500); // let React settle and the backdrop paint
  await dismissNotices(page);
  return { context, page };
}

/** Click "New Session" so the conversation area is a fresh empty session. */
async function startEmptySession(page) {
  for (const selector of ['button[class*="newSession"]', '[aria-label="新建会话"]', 'button:has-text("新会话")']) {
    const button = page.locator(selector).first();
    if (await button.count() >= 1 && await button.isVisible()) {
      await button.click();
      await page.waitForTimeout(1_500);
      return true;
    }
  }
  return false;
}

/** Collapse every expanded workspace row; returns still-expanded count. */
async function collapseWorkspaces(page) {
  for (let round = 0; round < 5; round += 1) {
    const expanded = await page.locator('[class*="projectRow"][aria-expanded="true"]').all();
    if (expanded.length === 0) return 0;
    for (const row of expanded) {
      // click the row's own text (not the action buttons) to toggle the folder
      await row.locator('[class*="projectText"]').first().click();
      await page.waitForTimeout(350);
    }
  }
  return await page.locator('[class*="projectRow"][aria-expanded="true"]').count();
}

/** Hide banners owned by other plugins (dsh-auth internal-testing notice). */
async function hideForeignBanners(page) {
  return page.evaluate(() => {
    const hidden = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while ((node = walker.nextNode())) {
      const textOnly = node.childNodes.length > 0 && [...node.childNodes].every((n) => n.nodeType === Node.TEXT_NODE);
      const text = textOnly ? node.textContent.trim() : "";
      if (text !== "" && /内测|Internal Testing/i.test(text)) {
        let target = node;
        for (let i = 0; i < 3 && target.parentElement; i += 1) {
          const rect = target.getBoundingClientRect();
          if (rect.width > 600 && rect.height < 90) break;
          target = target.parentElement;
        }
        target.style.display = "none";
        hidden.push(text.slice(0, 30));
      }
    }
    return hidden;
  });
}

/** Selected appearance card index: 0 light, 1 dark, 2 system. */
async function selectedThemeIndex(page) {
  return page.locator('.dsh-skins-pop .dsh-skins-theme-card[aria-pressed="true"]').evaluateAll(
    (nodes) => nodes.map((node, i) => node.getAttribute("aria-pressed") === "true" ? i : -1).filter((i) => i >= 0)[0] ?? null,
  );
}

async function openSwitcher(page) {
  await page.click(".dsh-skins-switcher-btn");
  await page.waitForSelector(".dsh-skins-pop", { timeout: 10_000 });
  await page.waitForTimeout(600);
}

async function closeSwitcher(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

async function clickThemeCard(page, index) {
  await openSwitcher(page);
  await page.locator(".dsh-skins-pop .dsh-skins-theme-card").nth(index).click();
  await page.waitForTimeout(700);
  await closeSwitcher(page);
}

/** Privacy gate: assert no session title can leak into the frame. */
async function privacyCheck(page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('[class*="projectRow"]')].map((row) => ({
      name: row.textContent.trim().slice(0, 24),
      expanded: row.getAttribute("aria-expanded"),
    }));
    return { workspaces: rows, expandedCount: rows.filter((r) => r.expanded === "true").length };
  });
}

async function writeShot(name, buffer) {
  const file = join(outDir, name);
  writeFileSync(file, buffer);
  console.log(`${name}: ${(buffer.length / 1024).toFixed(0)} KiB`);
}

if (probe) {
  const { context, page } = await newPage("dark");
  const started = await startEmptySession(page);
  const remaining = await collapseWorkspaces(page);
  await hideForeignBanners(page);
  const privacy = await privacyCheck(page);
  console.log(`new-session clicked: ${started}; expanded workspace rows: ${privacy.expandedCount}`);
  console.log("workspace rows:", JSON.stringify(privacy.workspaces));
  const webp = await toWebp(page, await page.screenshot(), 0.9);
  writeFileSync("/tmp/dsh-skins-probe.webp", webp);
  console.log(`probe shot -> /tmp/dsh-skins-probe.webp (${(webp.length / 1024).toFixed(0)} KiB)`);
  await context.close();
  await browser.close();
  process.exit(0);
}

// ---- gate: semi-automated release assertions (design §13) ----
// Run against a GUI with the 1.0.0 plugin installed:
//   node scripts/capture-previews.mjs --skin tgcf --gate
if (gate) {
  const failures = [];
  const check = (ok, label) => {
    console.log(`${ok ? "✓" : "✗"} ${label}`);
    if (!ok) failures.push(label);
  };
  const { context: gctx, page: gpage } = await newPage("dark");
  await startEmptySession(gpage);

  // 1. Every catalog skin card exposes a keyboard-focusable gear.
  await openSwitcher(gpage);
  const gears = gpage.locator(".dsh-skins-pz-gear");
  check(await gears.count() === 3, `personalization gear on all 3 catalog skins (got ${await gears.count()})`);
  await gears.first().focus();
  check(await gears.first().evaluate((node) => node === document.activeElement), "gear is keyboard focusable");

  // 2. Gear opens the personalization panel; Escape returns to the list.
  await gpage.keyboard.press("Enter");
  await gpage.waitForSelector(".dsh-skins-pz", { timeout: 5_000 });
  check(true, "personalization panel opens from the gear");
  await gpage.keyboard.press("Escape");
  await gpage.waitForTimeout(300);
  check(await gpage.locator(".dsh-skins-pz").count() === 0, "Escape closes back to the skin list");
  await closeSwitcher(gpage);

  // 3. tgcf branding: favicon swap + rebranded tab title.
  const title = await gpage.title();
  check(title.includes(skin === "tgcf" ? "天官赐福" : skin), `tab title rebranded (${title})`);
  const favicon = await gpage.locator('link[rel="icon"]').first().getAttribute("href");
  check(typeof favicon === "string" && favicon.length > 0, "custom favicon link present");

  // 4. Personalization panel shot for records (docs/assets/<skin>-personalize).
  await openSwitcher(gpage);
  await gpage.locator(".dsh-skins-pz-gear").last().click();
  await gpage.waitForSelector(".dsh-skins-pz", { timeout: 5_000 });
  await writeShot(`${skin}-personalize.webp`, await toWebp(gpage, await gpage.screenshot()));
  await closeSwitcher(gpage);

  await gctx.close();
  await browser.close();
  if (failures.length > 0) {
    console.error(`GATE FAILED: ${failures.length} assertion(s)`);
    process.exit(1);
  }
  console.log("GATE PASSED");
  process.exit(0);
}

// ---- full capture: <skin> dark / light + switcher close-up ----
const { context, page } = await newPage("dark");

const startedEmpty = await startEmptySession(page);
if (!startedEmpty) console.warn("WARN: New Session button not found — conversation area may show existing content.");
const expandedLeft = await collapseWorkspaces(page);
if (expandedLeft > 0) throw new Error(`privacy gate failed: ${expandedLeft} workspace row(s) still expanded`);
const banners = await hideForeignBanners(page);
if (banners.length > 0) console.log("hidden foreign banner(s):", banners);
const privacy = await privacyCheck(page);
console.log("workspace rows:", JSON.stringify(privacy.workspaces));

await openSwitcher(page);
const originalTheme = await selectedThemeIndex(page);
console.log(`original appearance card index: ${originalTheme}`);
await closeSwitcher(page);

// 1. <skin>, dark
await clickThemeCard(page, 1);
await writeShot(`${skin}-dark.webp`, await toWebp(page, await page.screenshot()));

// 2. <skin>, light
await clickThemeCard(page, 0);
await writeShot(`${skin}-light.webp`, await toWebp(page, await page.screenshot()));

// 3. Switcher close-up (dark): popover AND its 皮肤切换 trigger button in one frame
await clickThemeCard(page, 1);
await openSwitcher(page);
const pop = await page.locator(".dsh-skins-pop").boundingBox();
const btn = await page.locator(".dsh-skins-switcher-btn").boundingBox();
const pad = 24;
const clip = {
  x: Math.max(0, Math.floor(Math.min(pop.x, btn.x) - pad)),
  y: Math.max(0, Math.floor(Math.min(pop.y, btn.y) - pad)),
};
clip.width = Math.min(VIEWPORT.width, Math.ceil(Math.max(pop.x + pop.width, btn.x + btn.width) + pad)) - clip.x;
clip.height = Math.min(VIEWPORT.height, Math.ceil(Math.max(pop.y + pop.height, btn.y + btn.height) + pad)) - clip.y;
const inside = (box) => box.x >= clip.x && box.y >= clip.y && box.x + box.width <= clip.x + clip.width && box.y + box.height <= clip.y + clip.height;
console.log(`close-up clip ${JSON.stringify(clip)}; pop in frame: ${inside(pop)}, button in frame: ${inside(btn)}`);
if (!inside(pop) || !inside(btn)) throw new Error("close-up framing failed: popover or trigger button outside the clip");
await writeShot(`${skin}-switcher-dark.webp`, await toWebp(page, await page.screenshot({ clip })));
await closeSwitcher(page);

// restore the appearance the user had before we touched it
if (originalTheme !== null && originalTheme !== 1) await clickThemeCard(page, originalTheme);

await context.close();
await browser.close();
console.log("done.");
