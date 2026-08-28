// Smoke test: simulate the DSH client module loader + DOM, run apply()/dispose,
// and exercise the multi-skin engine (registry, default mount, live switch,
// sidebar registration, remote theme persistence and independent skin switching).
const fs = require("fs");
const path = require("path");

const pluginSrc = fs.readFileSync(path.join(__dirname, "lib/client.js"), "utf8");

// ---- minimal DOM stubs ----
function makeEl(tag) {
	return {
		tagName: tag, rel: "", type: "", href: "", textContent: "",
		dataset: {}, style: { props: {}, setProperty(k, v) { this.props[k] = v; }, getPropertyValue(k) { return this.props[k] ?? ""; } },
		children: [], removed: false,
		append(c) { this.children.push(c); },
		appendChild(c) { this.children.push(c); return c; },
		remove() { this.removed = true; },
		get className() { return ""; },
	};
}
const head = { ...makeEl("head"), querySelector() { return null; }, querySelectorAll() { return [makeEl("link")]; } };
const body = { ...makeEl("body"), dataset: {}, style: makeEl("b").style };

global.document = {
	body, head,
	createElement: (t) => makeEl(t),
	querySelector: () => null,
};

class MutationObserver {
	constructor(cb) { this.cb = cb; }
	observe() {}
	disconnect() { this.disconnected = true; }
}
global.MutationObserver = MutationObserver;

const storage = new Map([["dsh-skins:theme-preference", "dark"]]);
global.localStorage = {
	getItem(key) { return storage.has(key) ? storage.get(key) : null; },
	setItem(key, value) { storage.set(key, String(value)); }
};

// ---- module loader stub ----
const registrations = {};
let stateOverrides = null;
global.window = {
	__ModuleLoader__: {
		load(reg) { registrations[reg.id] = reg.factory((spec) => {
			if (spec === "react/jsx-runtime") {
				const h = (type, props) => {
					if (props === undefined) throw new Error("jsx props must not be undefined");
					return { $$el: true, type, props };
				};
				return { jsx: h, jsxs: (t, p) => h(t, p), Fragment: "Fragment" };
			}
			if (spec === "react") {
				return {
					useState: (init) => {
						const value = stateOverrides?.length ? stateOverrides.shift() : typeof init === "function" ? init() : init;
						return [value, () => {}];
					},
					useEffect: () => {},
					useRef: (v) => ({ current: v })
				};
			}
			if (spec === "react-dom") {
				return { createPortal: (children) => ({ $$portal: true, children }) };
			}
			throw new Error("unexpected require: " + spec);
		}) },
	},
};

// ---- load the plugin ----
eval(pluginSrc);
const mod = registrations["dsh-skins"];
if (!mod) throw new Error("plugin did not register under id dsh-skins");
console.log("✓ module registered; inject =", JSON.stringify(mod.inject));

// ---- skin registry ----
const skins = mod.listSkins();
console.log("✓ skins:", skins.map((s) => s.id + " (" + s.label + ")").join(", "));
if (!skins.some((s) => s.id === "openbmc")) throw new Error("registry missing openbmc");
if (!skins.some((s) => s.id === "uefi-harness")) throw new Error("registry missing uefi-harness");
if (skins.some((s) => s.id === "openbmc-lite")) throw new Error("openbmc-lite must be removed");

// ---- run apply() with a stub ctx (default skin = openbmc) ----
const slotRegistrations = [];
const injectedSlotKeys = [];
const registeredDicts = [];
const registeredDictObjects = {};
const effects = [];
const eventListeners = new Map();
let themeSnapshot = { preference: "system", active: { id: "light" }, themes: [], revision: 0 };
const ctx = {
	slots: {
		register(opts, comp) { slotRegistrations.push({ opts, comp }); return () => {}; },
		inject(key, callback) {
			injectedSlotKeys.push(key);
			if (key === "sidebar.footer.action") callback();
			return () => {};
		},
	},
	locale: {
		register: (ns, dicts) => {
			registeredDicts.push(ns);
			registeredDictObjects[ns] = dicts;
			return () => {};
		}
	},
	connection: { isLoopback: false },
	theme: {
		getTheme: () => themeSnapshot,
		setTheme(id) {
			themeSnapshot = { ...themeSnapshot, preference: id, active: { id: id === "system" ? "light" : id }, revision: themeSnapshot.revision + 1 };
			for (const fn of eventListeners.get("theme/change") ?? []) fn(themeSnapshot);
		}
	},
	on(event, fn) {
		const list = eventListeners.get(event) ?? [];
		list.push(fn);
		eventListeners.set(event, list);
		return () => eventListeners.set(event, list.filter((item) => item !== fn));
	},
	effect(setup, label) { const d = setup(); effects.push({ label, d }); },
};
mod.apply(ctx);
if (themeSnapshot.preference !== "dark") throw new Error("remote fallback should restore dark, got " + themeSnapshot.preference);
if (window.__DSH_SKINS__.themePreference() !== "dark") throw new Error("diagnostic preference should report dark");
ctx.theme.setTheme("light");
if (storage.get("dsh-skins:theme-preference") !== "light") throw new Error("theme/change should persist light");
console.log("✓ remote theme fallback restored dark and persisted later light selection");

const styleTag = (id) => head.children.find((c) => c.tagName === "style" && c.dataset.pluginCss === "dsh-skins/" + id + ".css");

// default mount: skin slots + per-skin style tag + backdrop + favicon
const skinSlots = slotRegistrations.filter((r) => r.opts.priority !== undefined);
if (skinSlots.length !== 3) throw new Error("expected 3 brand slot registrations, got " + skinSlots.length);
console.log("✓ slots registered:", skinSlots.map((r) => r.opts.name).join(", "));
const tagOpenbmc = styleTag("openbmc");
if (!tagOpenbmc) throw new Error("openbmc style tag missing");
console.log("✓ per-skin style tag:", tagOpenbmc.dataset.pluginCss);
console.log("✓ body scope attr:", body.dataset.dshOpenbmcSkin === "");
const bgFull = body.style.props["background-image"] || "";
if (!bgFull.includes("url(")) throw new Error("openbmc backdrop should contain the wallpaper url");
console.log("✓ background-image set:", bgFull.slice(0, 60) + "...");
console.log("✓ favicon link appended:", head.children.some((c) => c.rel === "icon" && !c.removed));

// ---- sidebar switcher: registration + dictionary + component render ----
if (!injectedSlotKeys.includes("sidebar.footer.action")) throw new Error("sidebar switcher slot not injected");
const switcher = slotRegistrations.find((r) => r.opts.id === "skins-switcher");
if (!switcher) throw new Error("sidebar switcher not registered");
if (switcher.opts.name !== "sidebar.footer.action") throw new Error("switcher slot name wrong: " + switcher.opts.name);
if (registeredDictObjects["dsh-skins.ui"].zh["skins.switch"] !== "皮肤切换") throw new Error("zh dict missing skins.switch");
if (registeredDictObjects["dsh-skins.ui"].en["skins.switch"] !== "Skin Switcher") throw new Error("en dict missing skins.switch");
if (registeredDictObjects["dsh-skins.ui"].zh["appearance.title"] !== "外观配色") throw new Error("zh dict missing appearance.title");
if (registeredDictObjects["dsh-skins.ui"].zh["appearance.system"] !== "跟随系统") throw new Error("zh dict missing appearance.system");
const swTree = switcher.comp({ wide: true }); // t 传空 → 引擎内置词条兜底
const swBtn = swTree.props.children[0];
if (swBtn.type !== "button" || swBtn.props["aria-label"] !== "皮肤切换") throw new Error("switcher button wrong");
if (swBtn.props.children[1] === null || swBtn.props.children[1].props.children !== "皮肤切换") throw new Error("switcher label missing in wide mode");
const railTree = switcher.comp({ wide: false });
if (!String(railTree.props.className).includes("rail")) throw new Error("collapsed sidebar should get rail class");
if (railTree.props.children[0].props.children[1] !== null) throw new Error("rail mode should hide the label");
console.log("✓ sidebar switcher registered (order " + switcher.opts.order + "); button 皮肤切换; rail mode hides label");

// Force the popover open: useState order = open, active skin, box, theme preference.
stateOverrides = [true, "openbmc", { left: 20, bottom: 50 }, "dark"];
const openTree = switcher.comp({ wide: true });
const portal = openTree.props.children[1];
if (!portal?.$$portal) throw new Error("open switcher should render a portal");
const panel = portal.children;
const panelChildren = panel.props.children;
if (panelChildren[0].props.children !== "外观配色") throw new Error("appearance section must be first");
const themeCards = panelChildren[1].props.children;
if (!Array.isArray(themeCards) || themeCards.length !== 3) throw new Error("appearance section needs 3 buttons");
if (!String(themeCards[1].props.className).includes("dsh-skins-theme-card-on")) throw new Error("dark appearance button should be selected");
if (panelChildren[3].props.children !== "选择皮肤") throw new Error("skin section must follow appearance section");
const skinCards = panelChildren.slice(4);
if (skinCards.length !== 2) throw new Error("skin section needs 2 independent skins");
themeCards[2].props.onClick();
if (themeSnapshot.preference !== "system") throw new Error("system button must call official theme.setTheme");
if (storage.get("dsh-skins:theme-preference") !== "system") throw new Error("system selection must persist remotely");
console.log("✓ popover has appearance(3) + skins(2); official system theme switch persisted");

// ---- runtime switch via the public selector (live remount) ----
mod.selectSkin("uefi-harness");
if (!tagOpenbmc.removed) throw new Error("old skin style tag should be removed after switch");
const tagUefi = styleTag("uefi-harness");
if (!tagUefi || tagUefi.removed) throw new Error("UEFI skin style tag missing after switch");
const bgUefi = body.style.props["background-image"] || "";
if (bgUefi.includes("url(")) throw new Error("dummy UEFI backdrop must not contain a wallpaper url");
if (!bgUefi.includes("radial-gradient")) throw new Error("dummy UEFI backdrop should be gradients");
if (body.dataset.dshOpenbmcSkin !== undefined || body.dataset.dshUefiHarness !== "") throw new Error("UEFI body scope not active");
const skinSlotsAfterSwitch = slotRegistrations.filter((r) => r.opts.priority !== undefined);
if (skinSlotsAfterSwitch.length !== 6) throw new Error("brand slots should re-register after switch (3+3), got " + skinSlotsAfterSwitch.length);
console.log("✓ switched to independent UEFI Harness via public selector; backdrop = gradients");
console.log("✓ UEFI body scope attr after switch:", body.dataset.dshUefiHarness === "");

// unknown id must throw
let threw = false;
try { mod.selectSkin("nope"); } catch { threw = true; }
if (!threw) throw new Error("selectSkin should reject unknown ids");
console.log("✓ unknown skin id rejected");

// theme switch (dark) repaint signal, then full dispose
body.dataset.dsDarkTheme = "";
const uiTag = styleTag("sidebar");
for (const e of effects) if (typeof e.d === "function") e.d();
if (body.dataset.dshUefiHarness !== undefined) throw new Error("dispose must remove the UEFI scope attr");
if (!tagUefi.removed) throw new Error("dispose must remove the skin style tag");
if (!uiTag.removed) throw new Error("dispose must remove the sidebar UI style tag");
console.log("✓ dispose ran; scope attr + skin/sidebar UI style tags removed");
console.log("\nALL SMOKE CHECKS PASSED");
