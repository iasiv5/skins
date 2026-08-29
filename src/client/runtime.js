const SKIN_STORAGE_KEY = "dsh-skins:active";
const SKIN_URL_PARAM = "skin";
const OFFICIAL_SKIN_ID = "official";
const LEGACY_OFFICIAL_ALIAS = "default";
const HERO_NS = "conversation";
const HERO_KEY = "hero.headline";
const BACKDROP_PROPERTIES = [
  "background-image",
  "background-position",
  "background-size",
  "background-attachment",
  "background-repeat",
];

/** Create the registry and single-mounted-skin runtime. */
export function createSkinRuntime() {
  const skins = new Map();
  const order = [];
  let ctx = null;
  let mounted = null;
  let selectedId = null;

  function register(skin) {
    if (!skin || typeof skin.id !== "string" || skin.id.length === 0) {
      throw new Error("[dsh-skins] every skin needs a non-empty id");
    }
    if (skin.id === OFFICIAL_SKIN_ID || skin.id === LEGACY_OFFICIAL_ALIAS) {
      throw new Error(`[dsh-skins] skin id "${skin.id}" is reserved for the official appearance`);
    }
    if (skins.has(skin.id)) throw new Error(`[dsh-skins] duplicate skin id "${skin.id}"`);
    skins.set(skin.id, skin);
    order.push(skin.id);
  }

  /** Active UI locale ("zh"|"en"); falls back to zh before apply(). */
  function activeLocale() {
    try {
      return ctx?.locale?.getLocale?.().active ?? "zh";
    } catch {
      return "zh";
    }
  }

  /**
   * Resolve a skin's localized text. Skins may declare `label`/`description`
   * either as a locale-neutral string (brand names) or as `{ zh, en }` maps;
   * resolution order is the active locale, then en, then zh — matching the
   * official locale runtime's fallback chain.
   */
  function localizedText(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") return value[activeLocale()] ?? value.en ?? value.zh ?? "";
    return String(value);
  }

  function list() {
    return order.map((id) => {
      const skin = skins.get(id);
      return { id, label: localizedText(skin.label), description: localizedText(skin.description) };
    });
  }

  function normalizeChoiceId(id) {
    return id === LEGACY_OFFICIAL_ALIAS ? OFFICIAL_SKIN_ID : id;
  }

  function isKnownChoice(id) {
    return id === OFFICIAL_SKIN_ID || skins.has(id);
  }

  function resolveSelectedId() {
    try {
      const query = window.location?.search;
      const fromUrl = query ? new URLSearchParams(query).get(SKIN_URL_PARAM) : null;
      const normalizedUrl = normalizeChoiceId(fromUrl);
      if (normalizedUrl && isKnownChoice(normalizedUrl)) {
        localStorage.setItem(SKIN_STORAGE_KEY, normalizedUrl);
        return normalizedUrl;
      }
      const stored = normalizeChoiceId(localStorage.getItem(SKIN_STORAGE_KEY));
      if (stored && isKnownChoice(stored)) {
        localStorage.setItem(SKIN_STORAGE_KEY, stored);
        return stored;
      }
    } catch {}
    // Preserve the existing first-install behavior: OpenBMC remains the
    // fallback until the user explicitly chooses the official appearance.
    return order[0];
  }

  function announce(id) {
    if (typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent("dsh-skins:changed", { detail: id }));
    }
  }

  function mount(skin) {
    if (!ctx) throw new Error("[dsh-skins] mount before apply");
    const body = document.body;
    const stops = [];

    // Slot contributions must be declaration-aware. A direct register() races
    // the owning UI plugins during startup and fails when their child tables
    // have not declared these slots yet. Nest inject() exactly like the
    // official brand plugin so registration waits for all three declarations
    // and is re-established if an owner fiber reloads.
    stops.push(ctx.slots.inject("sidebar.brand.mark", () =>
      ctx.slots.inject("sidebar.brand.name", () =>
        ctx.slots.inject("conversation.hero.brand.mark", () => {
          const registrations = [
            ctx.slots.register({ name: "sidebar.brand.mark", priority: -10 }, skin.Mark),
            ctx.slots.register({ name: "sidebar.brand.name", priority: -10 }, skin.Name),
            ctx.slots.register({ name: "conversation.hero.brand.mark", priority: -10 }, skin.Mark),
          ];
          return () => {
            for (let index = registrations.length - 1; index >= 0; index -= 1) {
              registrations[index]();
            }
          };
        })
      )
    ));

    const table = ctx.locale?.dicts?.get(HERO_NS);
    const originals = [];
    if (table) {
      for (const [locale, entries] of table) {
        if (entries && entries[HERO_KEY] !== undefined) {
          originals.push([entries, entries[HERO_KEY]]);
          entries[HERO_KEY] = skin.slogans[locale] ?? skin.slogans.zh;
        }
      }
    }
    stops.push(() => {
      for (const [entries, value] of originals) entries[HERO_KEY] = value;
    });

    const tagId = `dsh-skins/${skin.id}.css`;
    let tag = document.querySelector(`style[data-plugin-css=${JSON.stringify(tagId)}]`);
    if (tag === null) {
      tag = document.createElement("style");
      tag.dataset.plugin = "dsh-skins";
      tag.dataset.pluginCss = tagId;
      tag.textContent = skin.css;
      document.head.appendChild(tag);
    }
    stops.push(() => tag.remove());

    const previous = new Map();
    for (const property of BACKDROP_PROPERTIES) {
      previous.set(property, body.style.getPropertyValue(property));
    }
    body.dataset[skin.bodyAttr] = "";

    const setBackdrop = () => {
      const dark = body.dataset.dsDarkTheme !== undefined;
      const image = skin.art === ""
        ? dark ? skin.placeholderDark : skin.placeholderLight
        : dark ? skin.scrimDark : skin.scrimLight;
      body.style.setProperty("background-image", image);
      body.style.setProperty("background-position", "center");
      body.style.setProperty("background-size", "cover");
      body.style.setProperty("background-attachment", "fixed");
      body.style.setProperty("background-repeat", "no-repeat");
    };
    setBackdrop();
    const observer = new MutationObserver(setBackdrop);
    observer.observe(body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });

    const removedIcons = [...document.head.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')];
    removedIcons.forEach((element) => element.remove());
    const favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = skin.faviconMime;
    favicon.href = skin.favicon;
    document.head.append(favicon);

    // Browser chrome identity, cooperatively. The official DocumentTitle
    // projector (dsh-client-ui-renderer) owns the tab title and re-asserts
    // "<session> — DeepSeek Harness" after mount and on every session change,
    // so a plain mount-time write loses the race (verified in-browser: the
    // renderer rewrites it ~75ms later). Instead of fighting the projector,
    // rebrand only the product segment and keep the session segment intact;
    // unmount swaps the official brand back in place.
    const officialBrand = "DeepSeek Harness";
    const brand = skin.title === undefined || skin.title === null || skin.title === ""
      ? null
      : localizedText(skin.title);
    let titleObserver = null;
    if (brand !== null) {
      const withBrand = (text) => {
        if (text === officialBrand) return brand;
        if (text.endsWith(" — " + officialBrand)) return text.slice(0, text.length - officialBrand.length) + brand;
        return null; // foreign writer or already rebranded: leave untouched
      };
      const rebrand = () => {
        const next = withBrand(document.title);
        if (next !== null && next !== document.title) document.title = next;
      };
      rebrand();
      titleObserver = new MutationObserver(rebrand);
      titleObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
    }

    stops.push(() => {
      delete body.dataset[skin.bodyAttr];
      observer.disconnect();
      for (const [property, value] of previous) body.style.setProperty(property, value);
      favicon.remove();
      for (const element of removedIcons) document.head.append(element);
      if (titleObserver !== null) {
        titleObserver.disconnect();
        if (document.title === brand) document.title = officialBrand;
        else if (document.title.endsWith(" — " + brand)) {
          document.title = document.title.slice(0, document.title.length - brand.length) + officialBrand;
        }
      }
    });

    mounted = {
      skin,
      stop() {
        for (const stop of stops) stop();
      },
    };
    selectedId = skin.id;
    announce(skin.id);
  }

  function unmount() {
    if (!mounted) return;
    mounted.stop();
    mounted = null;
  }

  function select(id) {
    const normalizedId = normalizeChoiceId(id);
    const skin = skins.get(normalizedId);
    if (normalizedId !== OFFICIAL_SKIN_ID && !skin) {
      throw new Error(`[dsh-skins] unknown skin "${id}" — available: ${[OFFICIAL_SKIN_ID, ...order].join(", ")}`);
    }
    try { localStorage.setItem(SKIN_STORAGE_KEY, normalizedId); } catch {}
    if (selectedId === normalizedId) return normalizedId;

    unmount();
    if (normalizedId === OFFICIAL_SKIN_ID) {
      selectedId = OFFICIAL_SKIN_ID;
      announce(OFFICIAL_SKIN_ID);
    } else {
      mount(skin);
    }
    return normalizedId;
  }

  function apply(nextCtx) {
    ctx = nextCtx;
    const id = resolveSelectedId();
    if (id === OFFICIAL_SKIN_ID) {
      selectedId = OFFICIAL_SKIN_ID;
    } else {
      const skin = skins.get(id) ?? skins.get(order[0]);
      if (!skin) throw new Error("[dsh-skins] no skins registered");
      mount(skin);
    }
    return () => {
      unmount();
      selectedId = null;
    };
  }

  return {
    officialId: OFFICIAL_SKIN_ID,
    register,
    list,
    select,
    apply,
    unmount,
    active: () => selectedId,
  };
}
