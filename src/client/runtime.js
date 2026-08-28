const SKIN_STORAGE_KEY = "dsh-skins:active";
const SKIN_URL_PARAM = "skin";
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

  function register(skin) {
    if (!skin || typeof skin.id !== "string" || skin.id.length === 0) {
      throw new Error("[dsh-skins] every skin needs a non-empty id");
    }
    if (skins.has(skin.id)) throw new Error(`[dsh-skins] duplicate skin id "${skin.id}"`);
    skins.set(skin.id, skin);
    order.push(skin.id);
  }

  function list() {
    return order.map((id) => {
      const skin = skins.get(id);
      return { id, label: skin.label, description: skin.description };
    });
  }

  function resolveSelectedId() {
    try {
      const query = window.location?.search;
      const fromUrl = query ? new URLSearchParams(query).get(SKIN_URL_PARAM) : null;
      if (fromUrl && skins.has(fromUrl)) {
        localStorage.setItem(SKIN_STORAGE_KEY, fromUrl);
        return fromUrl;
      }
      const stored = localStorage.getItem(SKIN_STORAGE_KEY);
      if (stored && skins.has(stored)) return stored;
    } catch {}
    return order[0];
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

    stops.push(() => {
      delete body.dataset[skin.bodyAttr];
      observer.disconnect();
      for (const [property, value] of previous) body.style.setProperty(property, value);
      favicon.remove();
      for (const element of removedIcons) document.head.append(element);
    });

    mounted = {
      skin,
      stop() {
        for (const stop of stops) stop();
      },
    };
    if (typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent("dsh-skins:changed", { detail: skin.id }));
    }
  }

  function unmount() {
    if (!mounted) return;
    mounted.stop();
    mounted = null;
  }

  function select(id) {
    const skin = skins.get(id);
    if (!skin) throw new Error(`[dsh-skins] unknown skin "${id}" — available: ${order.join(", ")}`);
    try { localStorage.setItem(SKIN_STORAGE_KEY, id); } catch {}
    if (mounted?.skin.id !== id) {
      unmount();
      mount(skin);
    }
    return id;
  }

  function apply(nextCtx) {
    ctx = nextCtx;
    const id = resolveSelectedId();
    const skin = skins.get(id) ?? skins.get(order[0]);
    if (!skin) throw new Error("[dsh-skins] no skins registered");
    mount(skin);
    return unmount;
  }

  return {
    register,
    list,
    select,
    apply,
    unmount,
    active: () => mounted?.skin.id ?? null,
  };
}
