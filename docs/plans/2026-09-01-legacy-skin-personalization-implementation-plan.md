# Legacy 皮肤全面个性化（openbmc / uefi-harness 标语 + 通透度）实施计划

## 目标

- 给 `openbmc` 与 `uefi-harness` 补齐与 `tgcf` 相同的两个个性化字段：`slogan`（text×locale，maxLength 40）与 `panelOpacity`（range×single，0–100，默认 55），实现三皮肤字段功能一致。
- 正式推翻 design §9a「旧皮肤仅开放 wallpaper + 默认投影与 0.6.0 逐字节等价」裁决（ADR-0004）；新不变量：**默认投影复刻当前烘焙视觉（可断言为派生字符串与工厂烘焙串逐字节相等），覆写后由每皮肤曲线驱动**。
- 文档收口：ADR-0004、design v2.7 注记、CONTEXT.md「官方皮肤」词条（已落）、catalog §9a 注释改写、双语 README 字段描述、release checklist 演练修订。

## 架构快照

- 管线零改动：catalog 声明字段后，面板渲染（schema 驱动）、存储分桶、校验、存量规范化自动生效。缺的只是消费代码——两皮肤各补一个 `project(values, assets)`（tgcf 模式，`tgcf/index.js:143` 为模板），产出通用 SkinEffects 由 runtime 执行。
- `makeLegacyProjector`（`projector.js:137-173`）在两皮肤都有 `project()` 后零调用者，按 ADR-0002「死设施全删」传统删除。
- 通透度曲线（每皮肤内联，整数「点」算术避免浮点漂移；`P = values.panelOpacity`）：
  - 随动 token：`pt(baked) = Math.min(100, Math.max(0, P + baked − 55))`，输出 `rgba(R, G, B, ${(pt/100).toFixed(2)})`——RGB、「逗号后空格」与**两位小数**格式逐字取自烘焙串。`toFixed(2)` 是字节等价的格式前提：`String(60/100)` 产出 `"0.6"`，与烘焙的 `"0.60"` 不等（两皮肤全部烘焙 alpha 恰为两位小数，`toFixed(2)` 全量吻合）。P=55 时 `pt = baked`，派生串与烘焙串**逐字节相等**（默认视觉不变量的机制保证）。
  - scrim 渐变两 stop 的 alpha 点用同一公式；默认 P 时整个 `imageLight/imageDark` 串与工厂 `scrimLight/scrimDark` 逐字节相等。
  - blur：`Math.round(24 * Math.pow(Math.max(0, (P − 55) / 45), 2))`——默认 P 处 0（今天无毛玻璃），P=100 处 24（`normalizeEffects` 上限含 24）。玻璃规则与变量仅在 `blur > 0` 时输出，默认投影的 `staticCss` 与 `cssVariables` 同今天逐字节相同/null。blur 的执行面与 tgcf 同机制：`backdrop.blur > 0` 时 runtime 给壁纸 `::before` 层加 `filter:blur(Npx);transform:scale(1.02)`（`runtime.js:132-134`），面板霜层由玻璃规则承担——即 P>55 起「壁纸模糊与面板霜同步增强」，不存在「只霜面板不糊壁纸」的分离语义。
  - 语义端点与 tgcf 一致：P=0 面板底色全透（侧栏保留可读性增量，同 tgcf P=0 行为），P=100 随动族 alpha 全部钳到 100 点（串 `1.00`）。
  - 壁纸语义沿用 legacy：builtin 默认 → scrim+art 串；用户图 → 裸 `url("...")`（纱不上用户图，`projector.js:146-147` 既有语义）；blur 双层语义见上条。
- 字段默认值与皮肤静态字典同源：`slogan` catalog 默认 = 工厂返回的 `slogans`（openbmc「察于未萌 · 治于未乱」/「Govern before the storm」，uefi「启于固件 · 行于万象」/「Boot before everything」）；两皮肤 `bg-base` 亮暗均 0.55 → 默认 P 均为 55。不变量由测试钉死（tgcf 裁决 #4 同款约束）。

## 全局约束

- `catalog.js` 保持纯数据纯函数：无 React、DOM、fs、host API。
- `panel.js` 保持通用渲染：不得引入任何皮肤业务映射。
- 皮肤模块不碰 DOM：效果一律经 SkinEffects 由通用 runtime 执行（`runtime.js:219-245`）。
- `normalizeEffects` 既有形状约束不得放宽（blur ∈ [0,24] 闭区间，`projector.js:81`）。
- 烘焙字符串格式逐字保留（`rgba(247, 250, 252, 0.55)` 的空格与两位小数）——默认投影字节等价的前提。
- labelKey 复用现有通用键 `personalization.slogan` / `personalization.panelTranslucency`；**不改 `dicts.js`**。
- LWW 粒度 = 整个 scope 对象（locale 字段提交完整 `{zh, en}`）；`CONFIG_VERSION` 保持 1，不 bump。
- 本批改动落在未发布的 1.0.0：升级故事保持单段「0.6.0 → 1.0.0」，不开新版本线。
- 每任务完成即运行该任务验证命令；全部任务后跑 `pnpm check`（build + 语法 + smoke + 单测 + README 配对）。
- 无新增依赖；测试用 Node 内置 test runner（仓库既有惯例）。

## 输入工件

- grill-with-docs 共识（本会话，13 项决策全数落定；升级 side-effect 考古结论：新字段对 0.6.0→1.0.0 首升路径存储/路由/状态机增量为零）。
- `docs/plans/design-1.0.0-personalization.md` §9a（终态句）、§12（兼容测试清单）、修订史（v2.6 增补段式样）。
- `CONTEXT.md` 词条（通透度 / 标语 / 官方皮肤）。
- `docs/adr/0002-theme-package-removal.md`（死设施全删先例）、`docs/adr/0003-auto-save-on-change.md`（格式式样）。

## 文件结构与职责

- Modify: `src/shared/personalization/catalog.js`（`SKINS.openbmc` / `SKINS["uefi-harness"]` 增两字段；§9a 注释改写）
- Modify: `src/client/skins/openbmc-harness/index.js`（返回对象增 `project`；新增随动点表与曲线）
- Modify: `src/client/skins/uefi-harness/index.js`（同上）
- Modify: `src/client/personalization/projector.js`（删 `makeLegacyProjector`；`:186` 兜底分支简化；头注释更新）
- Test: `tests/personalization-catalog.test.mjs`（同源不变量）
- Test: `tests/personalization-projector.test.mjs`（openbmc/uefi 契约测试；桩 legacy 测试迁移删除）
- Test: `tests/personalization-store.test.mjs`（新字段写读往返）
- Test: `smoke-test.cjs`（openbmc 默认 token 层 + backdrop 断言）
- Create: `docs/adr/0004-legacy-skin-personalization.md`
- Modify: `docs/plans/design-1.0.0-personalization.md`（v2.7 注记）
- Modify: `README.md` / `README.en.md`（:83 字段范围描述）
- Modify: `README.i18n.yaml`（双语配对的 blob-hash 记录，`verify-readme-pairing.mjs --write` 刷新）
- Modify: `docs/plans/release-checklist-1.0.0.md`（演练前提修正 + 新字段往返证据）

## 任务清单

### Task 1: catalog 声明两皮肤字段 + 同源不变量测试

- 目标：openbmc / uefi-harness 在 catalog 获得 `slogan` 与 `panelOpacity` 字段声明，§9a 注释改写为新裁决；测试钉死「catalog slogan 默认 ≡ 工厂静态 slogans」。
- 涉及文件：`src/shared/personalization/catalog.js`、`tests/personalization-catalog.test.mjs`
- 接口契约
  - Consumes：工厂 `createOpenBmcHarness({ jsx: () => null })` / `createUefiHarness({ jsx: () => null })`（stub jsx 即可，参考 `personalization-projector.test.mjs` 真实工厂测试的导入写法）；现有 labelKey `personalization.slogan` / `personalization.panelTranslucency`。
  - Produces：`getField("openbmc", "slogan" | "panelOpacity")` 与 uefi 同名字段；默认值 `panelOpacity: 55`；`validateCatalogInvariants()` 全绿。后续 Task 2/3 的 `project()` 消费 `values.slogan` / `values.panelOpacity`。
- 验证范围：`node --test tests/personalization-catalog.test.mjs`

- [ ] Step 1: 在 `tests/personalization-catalog.test.mjs` 追加测试：动态导入两工厂（stub jsx），断言 `getField(skinId, "slogan").default` 与 `factory(stubJsx).slogans` deepEqual（两皮肤各自），并断言两皮肤 `getField(skinId, "panelOpacity")` 的 `default === 55`、`min === 0`、`max === 100`、`step === 1`。
- Run: `node --test tests/personalization-catalog.test.mjs`
- Expected: 新测试失败——`getField("openbmc", "slogan")` 返回 `null`。
- [ ] Step 2: 运行并确认失败。
- Run: `node --test tests/personalization-catalog.test.mjs`
- Expected: AssertionError（slogan default 为 null）。
- [ ] Step 3: 在 `catalog.js` 的 `SKINS.openbmc.fields` 与 `SKINS["uefi-harness"].fields` 各追加（slogan 默认值取各自工厂 `slogans` 原文）：

```js
{
  key: "slogan",
  type: "text",
  scope: "locale",
  labelKey: "personalization.slogan",
  maxLength: 40,
  default: { zh: "察于未萌 · 治于未乱", en: "Govern before the storm" }, // uefi: { zh: "启于固件 · 行于万象", en: "Boot before everything" }
},
{
  key: "panelOpacity",
  type: "range",
  scope: "single",
  labelKey: "personalization.panelTranslucency",
  min: 0,
  max: 100,
  step: 1,
  unit: "%",
  default: 55,
},
```

  同时把 `catalog.js:105-107` 的「Legacy skins keep behaviour byte-equivalent … expose `wallpaper` only」注释改写为：legacy 皮肤已全量开放标准字段集，默认 P=55 锚定烘焙视觉，见 `docs/adr/0004-legacy-skin-personalization.md`；并保留一句考古指针——legacy 壁纸语义（纱不上用户图、占位分支）由各皮肤 `project()` 内部分支承载。
- [ ] Step 4: 运行确认通过（含既有 `validateCatalogInvariants` 用例）。
- Run: `node --test tests/personalization-catalog.test.mjs`
- Expected: 全部 pass（含新增同源不变量）。
- [ ] Step 5: checkpoint commit：`git commit -m "feat: declare slogan+panelOpacity for openbmc/uefi (ADR-0004)"`。

### Task 2: openbmc `project()` + 契约测试

- 目标：openbmc 皮肤获得 `project(values, assets)`；默认投影复刻烘焙视觉（字节相等），覆写由曲线驱动。
- 涉及文件：`src/client/skins/openbmc-harness/index.js`、`tests/personalization-projector.test.mjs`
- 接口契约
  - Consumes：Task 1 的 catalog 字段（`values.slogan` / `values.panelOpacity` 必有值）；`resolveImageRef`（`../../../shared/personalization/catalog.js`）；管道已解析的 `assets.wallpaper.url`。
  - Produces：皮肤返回对象新增 `project`；测试用 layer key `dsh-skins/openbmc`、玻璃变量 `--dsh-openbmc-glass-blur`。
- 验证范围：`node --test tests/personalization-projector.test.mjs`

openbmc 随动点表（token → 亮 rgb+点 / 暗 rgb+点；逐字取自 `openbmc-harness/index.js:140-158` 与 `:177-195` 的烘焙串）：

| token | 亮 | 暗 |
|---|---|---|
| `--dsw-alias-bg-base` | (247,250,252) 55 | (12,26,38) 55 |
| `--dsw-alias-bg-module-platform` | (240,246,250) 55 | (22,48,67) 60 |
| `--dsw-alias-bg-layer-1` | (255,255,255) 48 | (18,38,53) 55 |
| `--dsw-alias-bg-layer-2` | (255,255,255) 56 | (22,48,67) 60 |
| `--dsw-alias-bg-layer-3` | (255,255,255) 62 | (26,58,80) 64 |
| `--dsw-specific-sidebar-fill` | (238,246,251) 60 | (13,30,44) 72 |
| `--dsw-specific-input-major` | (255,255,255) 60 | (18,42,60) 65 |
| `--dsw-specific-login-input` | (255,255,255) 60 | (18,42,60) 65 |

scrim stop 点：亮 `(247,250,252) 15 → (240,246,250) 28`；暗 `(7,14,22) 10 → (4,9,14) 24`（格式 `linear-gradient(rgba(R, G, B, a) 0%, rgba(R2, G2, B2, a2) 100%)` + `artLayer`，同 `:1668-1672`）。固定族（不入 tokenOverrides）：`bg-overlay 82/88`、`menu 94/94`、`selector 85/85`、`tip 90/92`、`sidebar-nav-item-hover/active 90/90`、气泡/文字/交互态/品牌色。

- [ ] Step 1: 在 `tests/personalization-projector.test.mjs` 真实工厂测试之后新增「openbmc projects baked defaults through its own curve」测试块（动态导入 `createOpenBmcHarness`，stub jsx；测试块内 resolver 需对 user id 也返回沙盒 url——仓库既有两种范式任选：按 kind 分派的 `resolver`（`:47-50`）或真实工厂测试的 `resolverFor`（`:240-243`））：断言默认投影（P=55）下 `effects.tokenOverrides["--dsw-alias-bg-base"]` deepEqual `{ light: "rgba(247, 250, 252, 0.55)", dark: "rgba(12, 26, 38, 0.55)" }`；`["--dsw-specific-sidebar-fill"]` deepEqual `{ light: "rgba(238, 246, 251, 0.60)", dark: "rgba(13, 30, 44, 0.72)" }`；`effects.backdrop.blur === 0`；`effects.cssVariables === null`；`effects.staticCss === skin.css`（字节相等，无玻璃规则）；P=0 时 bg-base 亮串 `"rgba(247, 250, 252, 0.00)"` 且 scrim 串为 `"linear-gradient(rgba(247, 250, 252, 0.00) 0%, rgba(240, 246, 250, 0.00) 100%)" + artLayer`；P=77 时 `blur === 6`；P=100 时 `blur === 24`、`staticCss === skin.css + "\n" + 玻璃规则`、`cssVariables["--dsh-openbmc-glass-blur"]` 为 `{ light: "24px", dark: "24px" }`；slogan 覆写 `{ zh: "甲", en: "Z" }` 直达 `effects.slogans`；`panelOpacity: 101` 时回退默认（bg-base 回烘焙值，`issues` 含 `panelOpacity`）；wallpaper 覆写为 user id（resolver 提供沙盒 url）时 `imageLight/imageDark` 为裸 `url("…")`（无 `linear-gradient`，blur 仍按 P 计）——该断言由本测试承载（原桩测试将随 Task 4 删除）。
- Run: `node --test tests/personalization-projector.test.mjs`
- Expected: 新测试失败——当前走 `makeLegacyProjector`，`tokenOverrides` 为 `null`。
- [ ] Step 2: 运行并确认失败。
- Run: `node --test tests/personalization-projector.test.mjs`
- Expected: AssertionError（tokenOverrides deepEqual null ≠ 目标）。
- [ ] Step 3: 在 `openbmc-harness/index.js` 返回对象前实现 `project`（模块内闭包，读上表字面量；变量绑定 `const P = values.panelOpacity;`、`const wallpaper = values.wallpaper;`、`const url = assets.wallpaper?.url ?? null;`；`const pt = (baked) => Math.min(100, Math.max(0, P + baked - 55));`、`const pct = (points) => (points / 100).toFixed(2);`），返回：

```js
{
  bodyAttribute: "dshOpenbmcSkin",
  slogans: values.slogan ?? slogans,
  titleBrand: "OpenBMC Harness",
  favicon: { href: FAVICON_DATA_URL, mime: FAVICON_MIME },
  backdrop: { imageLight, imageDark, overlayLight: null, overlayDark: null, blur: blurPx },
  tokenOverrides: /* 上表 8 token 的 { light, dark } 串 */,
  cssVariables: blurPx > 0 ? { "--dsh-openbmc-glass-blur": { light: `${blurPx}px`, dark: `${blurPx}px` } } : null,
  staticCss: blurPx > 0 ? CSS + "\n" + GLASS_RULE : CSS,
  decorations: null,
}
```

  `imageLight/Dark` 分支：`const custom = typeof wallpaper === "string" && wallpaper !== "builtin:openbmc:art" && resolveImageRef(wallpaper)?.kind === "user" && url !== null;` custom → `url("${url}")`；否则 `BACKGROUND_ART === "" ? PLACEHOLDER_LIGHT : 现算 scrim 串`（暗色同构）。玻璃规则常量：`body[data-dsh-openbmc-skin] [id="root"]{backdrop-filter:blur(var(--dsh-openbmc-glass-blur,0px))}`。返回对象挂 `project`。
- [ ] Step 4: 运行确认通过（既有「REAL factories … baked defaults verbatim」测试对 openbmc 的字节等价断言必须原样通过——它们就是新不变量的载体）。
- Run: `node --test tests/personalization-projector.test.mjs`
- Expected: 全部 pass。
- [ ] Step 5: checkpoint commit：`git commit -m "feat: openbmc project() — slogan + translucency curve anchored at P=55"`。

### Task 3: uefi `project()` + 契约测试

- 目标：uefi-harness 同构落地。
- 涉及文件：`src/client/skins/uefi-harness/index.js`、`tests/personalization-projector.test.mjs`
- 接口契约
  - Consumes：Task 1 catalog 字段；Task 2 确立的曲线公式与测试式样。
  - Produces：layer key `dsh-skins/uefi-harness`；玻璃变量 `--dsh-uefi-glass-blur`。
- 验证范围：`node --test tests/personalization-projector.test.mjs`

uefi 随动点表（取自 `uefi-harness/index.js:59-72` 与 `:86-99`）：

| token | 亮 | 暗 |
|---|---|---|
| `--dsw-alias-bg-base` | (248,247,255) 55 | (23,18,45) 55 |
| `--dsw-alias-bg-module-platform` | (241,238,255) 55 | (39,31,73) 60 |
| `--dsw-alias-bg-layer-1` | (255,255,255) 48 | (31,25,59) 55 |
| `--dsw-alias-bg-layer-2` | (247,245,255) 56 | (39,31,73) 60 |
| `--dsw-alias-bg-layer-3` | (241,238,255) 62 | (48,38,88) 64 |
| `--dsw-specific-sidebar-fill` | (238,235,255) 60 | (25,20,48) 72 |
| `--dsw-specific-input-major` | (255,255,255) 62 | (42,34,78) 55 |

scrim stop 点：亮 `(248,247,255) 10 → (238,234,255) 22`；暗 `(23,18,45) 8 → (16,12,34) 20`（格式同 `:1056-1060`）。固定族：`bg-overlay 82/88`、`menu 94/94`、`selector 78/78`、`tip 88/90`、`sidebar-nav-item-hover 9/10`、`sidebar-nav-item-active 15/17`、气泡/文字/交互态/品牌色。builtin 默认 ref 判定为 `"builtin:uefi-harness:art"`。

- [ ] Step 1: 新增「uefi projects baked defaults through its own curve」测试块（式样同 Task 2 Step 1，含 user-wallpaper 裸 url 断言；金值换 uefi 表：默认 bg-base `{ light: "rgba(248, 247, 255, 0.55)", dark: "rgba(23, 18, 45, 0.55)" }`、sidebar-fill `{ light: "rgba(238, 235, 255, 0.60)", dark: "rgba(25, 20, 48, 0.72)" }`、P=0 bg-base 亮串 `"rgba(248, 247, 255, 0.00)"`；玻璃规则 `body[data-dsh-uefi-harness] [id="root"]{backdrop-filter:blur(var(--dsh-uefi-glass-blur,0px))}`）。
- Run: `node --test tests/personalization-projector.test.mjs`
- Expected: 新测试失败（uefi 仍走 legacy 投影）。
- [ ] Step 2: 运行并确认失败。
- Run: `node --test tests/personalization-projector.test.mjs`
- Expected: AssertionError。
- [ ] Step 3: `uefi-harness/index.js` 按 Task 2 Step 3 同构实现 `project`（点表换 uefi 值；`titleBrand: "UEFI Harness"`；favicon `{ href: favicon, mime: "image/svg+xml" }`；`bodyAttribute: "dshUefiHarness"`）。注意 uefi 无 `login-input` token，随动族为 7 个。
- [ ] Step 4: 运行确认通过。
- Run: `node --test tests/personalization-projector.test.mjs`
- Expected: 全部 pass。
- [ ] Step 5: checkpoint commit：`git commit -m "feat: uefi-harness project() — slogan + translucency curve anchored at P=55"`。

### Task 4: 删除 `makeLegacyProjector` 并迁移桩测试

- 目标：移除零调用者的 legacy 投影机（ADR-0002 死设施全删传统），其测试意图迁移到真实工厂契约上。
- 涉及文件：`src/client/personalization/projector.js`、`tests/personalization-projector.test.mjs`
- 接口契约
  - Consumes：Task 2/3 已让两真实皮肤自带 `project`。
  - Produces：`projector.js` 仅剩「skin.project 必有」的管线；`projectSkin` 对缺 `project` 的 catalog 皮肤经 `safeAttempt` 自然 fail closed（TypeError 被捕获 → degraded defaults → failed）。
- 验证范围：`node --test tests/personalization-projector.test.mjs`

- [ ] Step 1: 删除三个桩 legacy 测试（「legacy skins project byte-equivalent defaults without a project function」「legacy skins swap the backdrop only for user wallpapers」「placeholder path applies when a legacy skin has no art」）及 `legacySkin()` fixture——其意图已由 Task 2/3 的真实工厂契约测试覆盖（含 user wallpaper → 裸 url；占位分支保留于两皮肤 `project()` 内的 `BACKGROUND_ART === ""` 三元）。
- Run: `grep -n "makeLegacyProjector\|legacySkin" tests/personalization-projector.test.mjs`
- Expected: 无残留引用。
- [ ] Step 2: 删除 `projector.js:137-173` 的 `makeLegacyProjector`，`:186` 改为 `const project = skin.project;`，文件头注释（`:16-18`）改为「所有 catalog 皮肤自带 project；缺 project 的投影经 fail-closed 三层回退」。
- Run: `grep -n "makeLegacyProjector" src/client/personalization/projector.js`
- Expected: 无残留（定义、兜底分支、头注释三处全清）。
- [ ] Step 3: 运行确认通过。
- Run: `node --test tests/personalization-projector.test.mjs`
- Expected: 全部 pass（含「skins outside the catalog fail closed」——它自带 project，不受影响）。
- [ ] Step 4: checkpoint commit：`git commit -m "refactor: drop makeLegacyProjector — every catalog skin owns its projector"`。

### Task 5: store 新字段写读往返测试

- 目标：验证 openbmc/uefi 的 slogan/panelOpacity 走既有 PATCH/快照/规范化链路。
- 涉及文件：`tests/personalization-store.test.mjs`
- 接口契约
  - Consumes：Task 1 的 catalog 字段；该测试文件既有的 `setOverride(store, skinId, key, value)` 辅助（`:177` 用法）。
  - Produces：无（纯测试）。
- 验证范围：`node --test tests/personalization-store.test.mjs`

- [ ] Step 1: 追加测试：`setOverride(store, "openbmc", "slogan", { zh: "甲", en: "Z" })` 与 `setOverride(store, "openbmc", "panelOpacity", 80)` 后，`snapshot.skins.openbmc.slogan` deepEqual 覆写值、`snapshot.skins.openbmc.panelOpacity === 80`；uefi 同样各设一项；断言 `setOverride(store, "openbmc", "panelOpacity", 101)` 被拒（校验失败路径，与文件内既有非法值断言式样一致）；重载规范化后（参照文件内既有 normalize 用例的触发方式）有效覆写保留。本任务是纯增测：Task 1 声明字段后机制应已生效，**前置状态即为可观察的「新字段走通链路」**；若测试失败，说明 Task 1 声明与机制有出入，停下排查而非改产品代码。
- Run: `node --test tests/personalization-store.test.mjs`
- Expected: 全部 pass（含新增往返用例）。
- [ ] Step 2: checkpoint commit：`git commit -m "test: openbmc/uefi slogan+panelOpacity store roundtrip"`。

### Task 6: ADR-0004 + design v2.7 注记

- 目标：把裁决逆转与升级/降级语义落盘。
- 涉及文件：`docs/adr/0004-legacy-skin-personalization.md`（新建）、`docs/plans/design-1.0.0-personalization.md`
- 接口契约
  - Consumes：ADR-0003 的文档格式；design 修订史「v2.6 增补」段式样。
  - Produces：ADR 编号 `0004`，供 checklist 与 catalog 注释引用。
- 验证范围：文件存在 + 锚点 grep。

- [ ] Step 1: 写 `docs/adr/0004-legacy-skin-personalization.md`（格式同 0003）。必含：背景（§9a 字节等价裁决及其测试锁定）；决定（两皮肤全量开放 slogan+panelOpacity，per-skin `project()`，默认 P=55 锚定烘焙视觉）；新不变量（默认投影派生串与工厂烘焙串逐字节相等，由 `personalization-projector.test.mjs` 真实工厂测试钉死）；格式细则（派生 alpha 一律 `(points/100).toFixed(2)` 两位小数——字节等价不变量的格式前提）；blur 双层语义（P>55 起壁纸模糊与面板霜同步增强，与 tgcf 同机制，`runtime.js:132-134`）；升级语义（0.6.0→1.0.0 首升：state 从头创建、默认值永不落盘、零 localStorage 新键、增量 side effect 为零）；降级不对称（降回 0.6.0 = 孤儿文件可无损再升；降回旧 1.0.0-dev = 新字段键被规范化静默剔除且 revision+1，不可逆）；前瞻原则（官方皮肤永不入 catalog；未来代码级皮肤一律声明标准字段集）；被否方案（共享曲线 helper——两消费者不成抽象、tgcf 不适用；slogan 走 legacy 投影通用化——机制分叉；scrim 迁 overlay 通道——破坏默认字节等价）；附录（grill 共识 13 项决策清单内联存档，避免裁决只存在于会话记忆）。
- [ ] Step 2: design 文档三处：① 头部「状态」行更新为 v2.7 摘要句（推翻 §9a → ADR-0004，legacy 皮肤全量个性化）——状态行原停留在 v2.5 而修订史已有 v2.6 增补段，本次一并补齐裂隙（v2.6 内容以既有修订史段落为准，状态行直接落 v2.7）；② §9a 终态句（「仅开放 wallpaper 字段（§9a 终态）；默认投影必须与 0.6.0 行为逐字节等价」）改写为「全量开放标准字段集（ADR-0004）；默认投影与当前烘焙值逐字节等价（由真实工厂测试钉死）」；③ 修订史末尾按 v2.6 段式样追加「v2.7 增补」段。
- Run: `grep -n "v2.7\|ADR-0004" docs/plans/design-1.0.0-personalization.md | head`
- Expected: 三处锚点命中。
- [ ] Step 3: checkpoint commit：`git commit -m "docs: ADR-0004 reverses §9a — legacy skins fully personalizable"`。

### Task 7: 双语 README 字段描述 + release checklist 演练修订

- 目标：用户文档与发布门与新裁决（ADR-0004）一致。
- 涉及文件：`README.md`、`README.en.md`、`README.i18n.yaml`、`docs/plans/release-checklist-1.0.0.md`
- 接口契约
  - Consumes：ADR-0004（checklist 引用）；`scripts/verify-readme-pairing.mjs` 的 `--write` 模式（脚本以 `git hash-object` 比对双 README 与 `README.i18n.yaml` 记录，`scripts/verify-readme-pairing.mjs:16-20`）。
  - Produces：无。
- 验证范围：`node scripts/verify-readme-pairing.mjs --write && pnpm run verify:readme`；grep 锚点。

- [ ] Step 1: `README.md:83` 的「（`tgcf` 全量开放；`openbmc` / `uefi-harness` 开放壁纸）」改为三皮肤同一字段集表述（壁纸 + 标语中英 + 面板通透度 0–100% 单值联动面板底色、遮罩与模糊三层，默认值锚定各皮肤出厂视觉）；grep 全文确认无其他「开放壁纸」残留。`README.en.md:83` 的「fully open on `tgcf`; wallpaper-only on `openbmc` / `uefi-harness`」同步改写；`:73` 仅述 tgcf 同人背景，不动。
- [ ] Step 2: 双 README 编辑后两 hash 均变化，必须先刷新配对记录再验证：`node scripts/verify-readme-pairing.mjs --write`（更新 `README.i18n.yaml`），随后 `pnpm run verify:readme` 确认配对通过。
- [ ] Step 3: `release-checklist-1.0.0.md` 三处：① `:37-38` 演练前提修正——删除「在 v0.6.0 上写入个性化配置」（0.6.0 无个性化功能，不可执行），改为两段：A. 0.6.0（空数据）一键更新 → 首装分支断言（state.json 创建、revision 0、无恢复误报）；B. 1.0.0-dev 中间版本写入配置 → 新构建加载规范化剔除并 revision+1。② `:40` 「默认视觉与 0.6.0 截图逐像素对照」保留并补注「openbmc/uefi 烘焙值 ≡ 0.6.0（皮肤文件零改动），新断言=派生串与烘焙串字节相等」。③ `:46` 「设计 §9a 已获产品负责人批准」改为「ADR-0004 已获产品负责人批准」。追加一条新证据项：在 openbmc/uefi 设 slogan/panelOpacity → 刷新持久 → 降级到不识别新字段的构建 → 键被剔除且 revision+1。
- Run: `pnpm run verify:readme && grep -n "ADR-0004" docs/plans/release-checklist-1.0.0.md`
- Expected: 配对检查通过；checklist 锚点命中。
- [ ] Step 4: checkpoint commit：`git commit -m "docs: README bilingual field scope + release rehearsal per ADR-0004"`（提交含 `README.i18n.yaml` 配对记录刷新）。

### Task 8: smoke-test legacy 断言 + 最终验证

- 目标：GUI 冒烟层面锁住 openbmc 默认投影与 token 层。
- 涉及文件：`smoke-test.cjs`
- 接口契约
  - Consumes：runtime 既有 tag/layer 命名 `dsh-skins/${skin.id}.css`、`dsh-skins/${skin.id}.backdrop.css`、token 层 `dsh-skins/${skin.id}`（`runtime.js:219-243`）；smoke 既有 `styleTag()` / `ctx.theme._layers` 取用式样（tgcf 段 `:414-421`）。
  - Produces：无。
- 验证范围：`pnpm check`

- [ ] Step 1: 在 smoke 的 UEFI 段之后、tgcf 段之前插一段「switch back to openbmc」：`mod.selectSkin("openbmc")` 后断言 `ctx.theme._layers.get("dsh-skins/openbmc")["--dsw-alias-bg-base"].light` 以 `"rgba(247, 250, 252,"` 开头（默认 P=55 派生=烘焙）；`styleTag("openbmc.backdrop")` 文本含 `"linear-gradient(rgba(247, 250, 252, 0.15)"`（烘焙 scrim 原串）；`styleTag("openbmc")` 存在且不含 `backdrop-filter`（默认无玻璃规则）。注意本地 helper 的签名是 `styleTag(id)` → 匹配 `dsh-skins/${id}.css`（`smoke-test.cjs:177`），**不要**把完整 tag id 传进去；断言式样镜像 tgcf 段 `:414-421` 的 `styleTag("tgcf.backdrop")` / `styleTag("tgcf")` 用法。同步把 tgcf 段注释「Direct UEFI → TGCF switch (no official detour)」（`smoke-test.cjs:405` 附近）改写为「Direct UEFI → openbmc → TGCF switch」以匹配新的插入顺序。
- Run: `pnpm run build && node smoke-test.cjs`
- Expected: 新断言通过，末尾既有汇总行照常输出。**必须先 build**：smoke 第 7 行读取的是构建产物 `lib/client.js`，不重建会打到旧 bundle（旧包 openbmc 仍走 legacy 投影、无 token 层，断言失败且现象误导）。
- [ ] Step 2: 全量最终验证。
- Run: `pnpm check`
- Expected: build、`node --check lib/*.js`、smoke、`node --test tests/*.test.mjs`、`verify:readme` 全绿。
- [ ] Step 3: checkpoint commit：`git commit -m "test: smoke covers openbmc default projection and token layer"`——提交包含重建后的 `lib/client.js`（`lib/` 是 git 跟踪文件，checklist `:45` 的 `git diff --exit-code -- lib` 门禁依赖它）。

## 执行纪律

- 开工前置（当前仓库现实）：工作区在 `main` 分支，且有未提交的 `CONTEXT.md`「官方皮肤」词条增补与本计划文件（未跟踪）。先建执行分支，随后**第一笔 commit 提交计划文件本身**（执行历史可追溯），`CONTEXT.md` 词条随 Task 1 或先行单独提交。
- 开始实现前先批判性复查本计划；发现缺项、矛盾、命名不一致或验证命令无效，先修计划再动手。
- 按任务顺序执行，不无声跳步、合并步或改变任务目标；每任务完成即运行其验证。
- 提交前确认当前分支非 `main`/`master`（或已获用户同意）。
- 遇阻塞、重复失败或计划与仓库现实不符，立即停下说明，不猜。
- 全部任务完成后运行最终验证并输出修改摘要。

## 最终验证

- Run: `pnpm check`
- Expected: 构建成功、`lib/client.js` / `lib/index.js` 语法检查通过、smoke-test 全过（含 Task 8 新断言）、全部单测通过（含三皮肤契约测试与同源不变量）、README 双语配对通过。
- 人工 gate 补充（发布前，按修订后 checklist 执行）：两段升级演练 + 新字段降级剔除往返证据。

## 审阅 Checkpoint

- 计划正文结束后请求用户审阅；审阅通过前不进入实现。
