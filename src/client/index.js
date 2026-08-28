import { createSkinRuntime } from "./runtime.js";
import { installSidebarSwitcher } from "./sidebar-switcher.js";
import { installRemoteThemePersistence, readLocalThemePreference } from "./theme-persistence.js";
import { createOpenBmcHarness } from "./skins/openbmc-harness/index.js";
import { createUefiHarness } from "./skins/uefi-harness/index.js";

window.__ModuleLoader__.load({
  id: "dsh-skins",
  factory: (require) => {
    const jsxRuntime = require("react/jsx-runtime");
    const react = require("react");
    const reactDom = require("react-dom");

    const runtime = createSkinRuntime();
    runtime.register(createOpenBmcHarness(jsxRuntime));
    runtime.register(createUefiHarness(jsxRuntime));

    const inject = ["slots", "locale", "theme", "connection"];

    function apply(ctx) {
      installRemoteThemePersistence(ctx);
      ctx.effect(() => runtime.apply(ctx), "dsh-skins: active skin");
      try {
        installSidebarSwitcher(ctx, {
          runtime,
          jsx: jsxRuntime.jsx,
          react,
          reactDom,
        });
      } catch (error) {
        console.warn("[dsh-skins] sidebar switcher registration failed:", error);
      }
    }

    window.__DSH_SKINS__ = {
      list: runtime.list,
      select: runtime.select,
      active: runtime.active,
      themePreference: readLocalThemePreference,
    };

    return {
      apply,
      inject,
      selectSkin: runtime.select,
      listSkins: runtime.list,
    };
  },
});
