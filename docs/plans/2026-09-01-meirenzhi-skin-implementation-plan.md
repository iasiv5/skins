# 美人志（meirenzhi）皮肤 · 出厂默认 实施计划（修订版 2.3）

> 修订记录：
> - v2 吸收外部评审第一轮（2026-09-01）：素材预算重校准、Task 8 十项迁移表、release gate 纳入、grep 退出码、Y1–Y7。
> - v2.1 吸收外部评审第二轮（2026-09-01）：**产品负责人已裁决——在 `main` 分支执行、素材采用方案 B（质量优先，固定 2560/q80），本计划已按此落盘，执行者不得就这两个选择再次询问**。R2 修正 gate 齿轮数量与索引算法（`runtime.list()` 只含扩展皮肤，v2 的 `−1` 公式错误）；R3 收紧 checkpoint 纪律；R4 工作区干净改用 `git status --porcelain` 断言；Y1 WebP 合计改机器可读标记；Y2 原子写明确为临时文件 + rename；Y3 panel 测试改述为覆盖扩展；Y4 Task 8 的 OpenBMC grep 允许范围修正。
> - v2.2 吸收外部评审第三轮（2026-09-01）：R1 实施计划文件本身纳入文件清单与最终提交（否则 Step 5 的 clean 断言必然失败）；R2 修复 release gate 截图阶段重复 `openSwitcher()` 把仍打开的弹层点关的生命周期缺陷；Y1 checkpoint 纪律改写为「细粒度 / 合并」两个无歧义模式（Task 10/11/12 为非打包文件，独立于两模式）；Y2 `lib`、`src/client/skins/meirenzhi` 等目录路径展开为精确文件路径；Y3 README URL 明确为在 `/?skin=official` 之后**插入**。
> - v2.3 吸收执行产物审查（2026-09-01）：机器标记改为 JSDoc 后的独立行注释（`^// TOTAL_WEBP_BYTES=`，计划内 sed 命令同步更新）；生成器护栏失败改 throw 进 finally（不再 process.exit 漏临时目录）并补失败清理测试；新增 `scripts/verify-bundle-guard.mjs` 并入 `pnpm run check`；SVG/CSS 来源措辞修正（徽章=HTML/CSS、萤火=CSS 伪元素+径向渐变）；release checklist「标题换装」改为「标语自动保存」。

## 目标

- 新增第四套皮肤 `meirenzhi`（凡人修仙传 · 美人志）：12 张内置壁纸（4 合照 + 8 单人，出厂默认 `yuntai`=001合照）、绯红×鎏金×月银/玄夜双主题色系、掌天瓶 Mark、萤火粒子动效、三字段个性化目录（壁纸/标语/通透度 35%）。
- 把出厂皮肤从 `openbmc` 切换为 `meirenzhi`（仅影响无存储选择的首装用户；术语「出厂皮肤」已入 CONTEXT.md）。
- 同步全部集成点：注册顺序、官方深色兜底 `:not()` 链、smoke-test 首装断言、personalization-panel 测试矩阵、capture-previews 发布 gate、README 双语承诺、词汇表、设计定案文档。

## 架构快照

- 皮肤模块沿用「声明式 effects」架构：`project(values, assets) → SkinEffects`，effects 由通用 runtime 执行，模块自身不碰 DOM。文件组织以 openbmc 为模版（Mark/Name/favicon/CSS/SLOGANS/project 的分区结构），投影数学与内置资产管线以 tgcf 为模版（`builtinAssets` 显式注册、单值联动二次曲线）。壁纸引用解析由 projector 层完成（`builtin:meirenzhi:<key>` → assetResolver → `builtinAssets[key].url`），皮肤模块统一消费 `assets.wallpaper.url`，**不需要** `resolveImageRef`。
- 壁纸走 base64 data URL 内嵌（三套现有皮肤同模式）：源 JPEG 经 ffmpeg 固定 `scale=2560:-2` + libwebp `-quality 80` 转码（方案 B，质量优先；2560/q80 避免方案 A 那类激进降质/降宽造成的明显模糊，但非 4K 原生分辨率，不在此承诺原生清晰度），脚本产出 `wallpapers.js` 并以字节上限做漂移护栏。
- 出厂皮肤切换 = 注册顺序第一位（`runtime.resolveSelectedId()` 兜底 `order[0]`），存储选择（localStorage `dsh-skins:active`）与 `?skin=` URL 参数的优先级不变。
- 明暗策略：出厂壁纸明暗**同图**（与字段语义一致），浅色态主视觉（暖雾白纱）、深色态玄夜纱压色。同图意味着 runtime 的 `backdropCss()` **不会**生成暗色专用 `::before`（仅当 `imageDark !== imageLight` 才生成），明暗差异由必然生成的暗色 `::after`（overlayLight/overlayDark 不同）与 token 承担——smoke-test 断言按此写。

## 全局约束

- **已批准的执行裁决（产品负责人，2026-09-01，不得再次询问）**：① 直接在 `main` 分支执行；② 素材采用**方案 B**：固定 `scale=2560:-2` + `-c:v libwebp -quality 80`，不做逐图降 quality、不回退 2048/1728。
- 命名规则：皮肤 id `meirenzhi`；body 属性 `dshMeirenzhiSkin`（attr `data-dsh-meirenzhi-skin`）；CSS style-tag 前缀 `dsh-skins/meirenzhi`；CSS 变量前缀 `--dsh-mrz-`；badge 类名 `dsh-mrz-badge`；keyframes 前缀 `dsh-mrz-`。
- 术语规则：面向文档与注释使用「出厂皮肤」，避用「默认皮肤」（CONTEXT.md 已裁定，与「官方皮肤」区分）。
- 素材声明文案规则：壁纸头注释写「AI 生成同人图，非官方《凡人修仙传》素材」，**不标注具体生成工具**；逐张记录源文件 sha256、实际宽高、quality（固定 80）、WebP 字节数。
- 素材管线字节契约（方案 B 漂移护栏；以下为 2026-09-01 对 12 张源图 q80/2560 实测的护栏上限，不是目标值）：
  - 单张 WebP ≤ **640,000 字节**（实测最大 610,842）；
  - 12 张 WebP 合计 ≤ **4,700,000 字节**（实测合计 4,539,816）；
  - 三个体积口径必须区分表述：原始 WebP 合计 ~4.54MB、base64 字符串增量 ~6.05MB、最终 `lib/client.js` ~6.8MB；网络传输经 gzip/brotli 可再压缩，但门禁一律按未压缩 bundle 字节数计算；
  - 超限即脚本非零退出（提示检查源图是否被替换），**不做降质重试**。
- alpha 字符串规则：随动族 alpha 一律 `toFixed(2)` 两位小数（openbmc 惯例；`String(0.4)` 产 `"0.4"` 与烘焙值不等，禁用）；scrim alpha 用 `toFixed(3)`（tgcf 惯例）。
- 皮肤模块规约：不碰 DOM、不 import React 之外的宿主 API；`catalog.js` 保持纯数据纯函数（两文件头部既有规约）。
- 平台/工具链：Node 22 / es2022（build-client.mjs 既有 target）；转码依赖 `/usr/bin/ffmpeg`（libwebp 编码器支持 `-quality 0–100`，已实测）；构建走 `pnpm run build`（esbuild，入口 `src/client/index.js` → `lib/client.js`；`lib/` 入库）。
- **checkpoint 纪律（两模式，开工时二选一，中途不得混用）**：触碰打包源码的中间 checkpoint 为 Task 1/3/5/6/8/9。
  - **模式 A · 细粒度提交**：按顺序全部执行 Task 1 → 3 → 5 → 6 → 8 → 9 的 checkpoint；每个 commit 只 stage 本任务文件 + 重建后的 `lib/client.js`、`lib/index.js`（前序源文件已各自入库，无携带问题）。
  - **模式 B · 合并提交**：跳过 Task 1/3/5/6 的 checkpoint → Task 8 执行**一次累计提交**（stage Task 1–8 全部累积源文件 + lib）→ 跳过 Task 9 的 checkpoint → Task 9 及后续改动由 Task 13 最终提交。
  - 两模式均不会出现「bundle 携带未提交源码」；**禁止混用**（例如跳过 Task 3 却执行 Task 5 的 checkpoint）。Task 10/11/12 的 checkpoint 涉及非打包文件（脚本/文档/README），独立于两模式，可自行选择执行。
- **提交一致性规则**：任何执行了的 commit 若触碰打包源码（`src/**`），必须先 `pnpm run build` 并把 `lib/client.js`、`lib/index.js` 一并 `git add`，保证 commit 内源码与已提交 bundle 一致；纯文档/脚本/资产模块（未被 import 前）提交不在此列。
- 当前分支为 `main`，已获批准（见上），无需再确认。

## 输入工件

- 设计共识：本计划「架构快照 + 全局约束 + 任务正文中的色值表与公式」即设计来源；任务 11 将其落盘为 `docs/plans/2026-09-01-meirenzhi-skin-design.md`（后续维护者从这里读，不依赖原会话）。
- 素材源：`/home/ubuntu/tmp/凡人修仙传/`（12 张 JPEG，3840×2160 或 4096×2319）。
- 词汇表：`CONTEXT.md`（「出厂皮肤」条目已就位）。
- 模版参照：`src/client/skins/openbmc-harness/index.js`（结构）、`src/client/skins/tgcf/index.js`（投影数学/内置资产）。

## 文件结构与职责

- Create: `scripts/build-meirenzhi-wallpapers.mjs` — 一次性转码+生成脚本（可复现）：固定参数转码、sha256 记录、字节护栏校验、临时文件 + rename 原子落盘。
- Create: `src/client/skins/meirenzhi/wallpapers.js` — 12 张壁纸 base64 data URL 模块（脚本产物，入库）。
- Create: `src/client/skins/meirenzhi/index.js` — 皮肤模块（Mark/Name/favicon/CSS/project/builtinAssets）。
- Create: `tests/meirenzhi-skin.test.mjs` — 皮肤模块契约、投影数值、品牌契约断言。
- Create: `docs/plans/2026-09-01-meirenzhi-skin-design.md` — 设计定案记录（共识落盘）。
- Modify: `src/shared/personalization/catalog.js` — `SKINS` 增补 `meirenzhi` 字段目录（§Catalog 数据区，`"uefi-harness"` 条目之后，即对象末尾）。
- Modify: `src/client/dicts.js` — zh/en 各增 12 条壁纸标签。
- Modify: `src/client/index.js` — 工厂数组注册顺序（`createMeirenzhiSkin` 置首）。
- Modify: `src/client/runtime.js` — `resolveSelectedId()` 内首装兜底注释改写（仅注释，`// Preserve the existing first-install behavior` 锚点）。
- Modify: `src/client/sidebar-switcher.js` — 官方深色兜底 `:not()` 链加入 `:not([data-dsh-meirenzhi-skin])`（`.dsh-skins-pop{background:rgba(41,42,44,0.97)}` 规则锚点）。
- Modify: `smoke-test.cjs` — 首装断言从 openbmc 迁移到 meirenzhi（十项迁移表，见任务 8）。
- Modify: `tests/personalization-catalog.test.mjs` — 皮肤清单断言 + meirenzhi 目录断言 + 12 键跨层一致性。
- Modify: `tests/dicts.test.mjs` — meirenzhi 壁纸标签断言。
- Modify: `tests/sidebar-switcher.test.mjs` — 深色弹层 CSS 断言字符串同步。
- Modify: `tests/personalization-panel.test.mjs` — 面板测试矩阵加入 `meirenzhi`（现硬编码 `const SKINS = ["openbmc", "uefi-harness", "tgcf"]`，L17 锚点）。
- Modify: `scripts/capture-previews.mjs` — release gate 齿轮计数与目标定位更新（`gears.count() === 3` 锚点；`runtime.list()` 只含扩展皮肤，official 由 switcher 渲染时 prepend）。
- Modify: `docs/plans/release-checklist-1.0.0.md` — 齿轮数、meirenzhi 验收项与截图证据路径。
- Modify: `README.md` / `README.en.md` — 出厂皮肤承诺、「四款外观」→「五款外观」标题、URL 列表、个性化默认值、素材声明。
- Modify: `README.i18n.yaml` — `verify-readme-pairing.mjs --write` 重录哈希（脚本产物）。
- Modify: `CONTEXT.md` — 头部「三套皮肤」→「四套皮肤」。
- Add: `docs/plans/2026-09-01-meirenzhi-skin-implementation-plan.md` — 本实施计划自身（含评审修订记录），随 Task 13 最终提交入库（否则收口的 clean 断言必失败）。
- 一起变化：`catalog.js` + `dicts.js` + `meirenzhi/index.js` 三者的 key 必须同批落（`builtinChoices` ↔ catalog `builtinAssets` ↔ 皮肤 `builtinAssets` ↔ `personalization.meirenzhi.*` ↔ `wallpapers.js` 导出同名 12 键），并由测试跨层锁死；稳定边界：`runtime.js` 的 effects 执行器与 `projector.js` 不改。

## 任务清单

### Task 1: 素材转码脚本 + 生成 wallpapers.js（方案 B）

- 目标：把 12 张源 JPEG 以固定 2560/q80 转 WebP（护栏校验），原子落盘 base64 模块。
- 涉及文件：Create `scripts/build-meirenzhi-wallpapers.mjs`；Create `src/client/skins/meirenzhi/wallpapers.js`（脚本产物）。
- 接口契约：
  - Consumes: `/home/ubuntu/tmp/凡人修仙传/` 下 12 个源文件；`/usr/bin/ffmpeg`。
  - Produces: `src/client/skins/meirenzhi/wallpapers.js` 导出 12 个常量，键序与命名精确为：`WALLPAPER_YUNTAI` / `WALLPAPER_YUANFENG` / `WALLPAPER_TAOYUAN` / `WALLPAPER_YUEYE` / `WALLPAPER_MUPEILING` / `WALLPAPER_ZILING` / `WALLPAPER_NANGONGWAN` / `WALLPAPER_NANGONGQUE` / `WALLPAPER_YINYUE` / `WALLPAPER_MEINING` / `WALLPAPER_SONGYU` / `WALLPAPER_YANRUYAN`，值为 `"data:image/webp;base64,..."`。头注释含逐张「源 sha256 / 实际宽高 / quality / WebP 字节」及三行**机器可读标记**：`// TOTAL_WEBP_BYTES=<合计字节数>`、`// ENCODE_WIDTH=2560`、`// ENCODE_QUALITY=80`（后续门禁按标记解析，禁止脆弱 grep）。
- 验证范围：脚本退出码 0；产物 12 个导出齐全；护栏达标；失败不留半成品。

- [ ] Step 1: 确认当前缺失状态（产物尚不存在）
- Run: `ls src/client/skins/meirenzhi/wallpapers.js 2>&1; ls "/home/ubuntu/tmp/凡人修仙传/"*.jpg | wc -l`
- Expected: `No such file or directory`；`12`
- [ ] Step 2: 写脚本 `scripts/build-meirenzhi-wallpapers.mjs`
- Change: 脚本要点（全部落实，不留占位）：
  - 源清单（有序，file → key）：`001.jpg→yuntai`、`002.jpg→yuanfeng`、`003.jpg→taoyuan`、`004.jpg→yueye`、`005慕沛灵.jpg→mupeiling`、`006紫灵.jpg→ziling`、`007南宫婉.jpg→nangongwan`、`008南宫阙.jpg→nangongque`、`009银月.jpg→yinyue`、`010梅凝.jpg→meining`、`011宋玉.jpg→songyu`、`012燕如嫣.jpg→yanruyan`。**文件名含中文，源路径拼接后必须原样传给 ffmpeg（不要做任何归一化）。**
  - 参数：`--src <dir>`（默认 `/home/ubuntu/tmp/凡人修仙传`）、`--out`（默认 `src/client/skins/meirenzhi/wallpapers.js`）。
  - 逐张转码（方案 B，固定参数、无搜索、无回退）：`ffmpeg -y -loglevel error -i <src> -vf scale=2560:-2 -c:v libwebp -quality 80 <tmpdir>/<key>.webp`。
  - 护栏（超限即非零退出并列出超标文件，不降质重试）：单张 > 640,000 字节；合计 > 4,700,000 字节。
  - 工作目录卫生：`mkdir(dirname(out), { recursive: true })` 建父目录；临时目录用 `mkdtemp()`（并行运行安全）；`try/finally` 清理临时目录。
  - **原子落盘**：先在目标文件同目录写 `<out>.tmp-<pid>`，再 `fs.renameSync(tmp, out)` 替换目标（进程中途崩溃不会截断旧产物）；rename 失败时 finally 清理 tmp。
  - 记录：对原始 JPEG 计算 sha256（`node:crypto`）；产物头注释含「AI 生成同人图，非官方《凡人修仙传》素材；不标注生成工具」+ 12 行 `sha256 / 宽x高 / q80 / 字节` + 三行机器可读标记（见接口契约）。
  - 产物格式：头注释块 + 12 行 `export const WALLPAPER_<KEY> = "data:image/webp;base64,....";`（单行字面量）。末尾打印逐张「宽/字节」与合计。
- [ ] Step 3: 运行脚本
- Run: `node scripts/build-meirenzhi-wallpapers.mjs`
- Expected: 退出码 0；输出 12 行字节与合计（实测口径 ~4.54MB，护栏 ≤4,700,000）
- [ ] Step 4: 验证产物
- Run: `grep -c "^export const WALLPAPER_" src/client/skins/meirenzhi/wallpapers.js && grep -c "sha256" src/client/skins/meirenzhi/wallpapers.js && sed -n 's|^// TOTAL_WEBP_BYTES=||p' src/client/skins/meirenzhi/wallpapers.js && node -e "import('./src/client/skins/meirenzhi/wallpapers.js').then(m => console.log(Object.keys(m).length, Object.values(m).every(v => v.startsWith('data:image/webp;base64,'))))"`
- Expected: `12`、`≥ 12`、一个 >0 且 ≤4700000 的整数、`12 true`
- [ ] Step 5: checkpoint commit（可选，受 checkpoint 两模式纪律约束；产物尚未被 import，不触发提交一致性规则）
- Run: `git add scripts/build-meirenzhi-wallpapers.mjs src/client/skins/meirenzhi/wallpapers.js && git commit -m "feat(meirenzhi): wallpaper transcode pipeline + bundled assets"`

### Task 2: catalog 测试断言（先失败）

- 目标：把皮肤清单断言扩为四套，新增 meirenzhi 目录断言与 12 键跨层一致性。
- 涉及文件：Modify `tests/personalization-catalog.test.mjs`（锚点：`test("shipped skins are exactly tgcf, openbmc and uefi-harness", ...)`）。
- 接口契约：
  - Consumes: `SKINS` / `getSkinSchema`（catalog.js 既有导出）。
  - Produces: 失败中的测试，等待 Task 3 实现。
- 验证范围：`node --test tests/personalization-catalog.test.mjs` 在 Task 3 前红、后绿。

- [ ] Step 1: 改写清单断言并新增目录与跨层断言
- Change: 清单断言改为：

```js
test("shipped skins are exactly meirenzhi, openbmc, tgcf and uefi-harness", () => {
  assert.deepEqual(Object.keys(SKINS).sort(), ["meirenzhi", "openbmc", "tgcf", "uefi-harness"]);
});

test("meirenzhi ships 12 builtin wallpapers with yuntai as the factory default", () => {
  const schema = getSkinSchema("meirenzhi");
  const field = (key) => schema.fields.find((f) => f.key === key);
  assert.equal(field("wallpaper").default, "builtin:meirenzhi:yuntai");
  assert.deepEqual(field("wallpaper").builtinChoices, [
    "yuntai", "yuanfeng", "taoyuan", "yueye",
    "mupeiling", "ziling", "nangongwan", "nangongque",
    "yinyue", "meining", "songyu", "yanruyan",
  ]);
  assert.deepEqual(field("slogan").default, { zh: "风起凡尘 · 红颜问道", en: "From mortal dust, immortals bloom" });
  assert.equal(field("panelOpacity").default, 35);
});

test("meirenzhi catalog builtinAssets keys equal the wallpaper choices (cross-layer lock)", () => {
  const schema = getSkinSchema("meirenzhi");
  const choices = schema.fields.find((f) => f.key === "wallpaper").builtinChoices;
  assert.deepEqual(Object.keys(schema.builtinAssets), choices);
});
```

- [ ] Step 2: 运行并确认失败
- Run: `node --test tests/personalization-catalog.test.mjs`
- Expected: 新测试失败（`meirenzhi` 不在 `SKINS`；`getSkinSchema("meirenzhi")` 返回 null 导致断言错误）
- [ ] Step 3–4: 实现在 Task 3，此处不写实现
- [ ] Step 5: 无独立 commit（受 checkpoint 两模式纪律约束，与 Task 3 合并）

### Task 3: catalog.js 注册 meirenzhi 字段目录

- 目标：`SKINS` 增补第四套字段目录，目录自校验通过。
- 涉及文件：Modify `src/shared/personalization/catalog.js`（锚点：`export const SKINS = {` 数据区，`"uefi-harness"` 条目之后）。
- 接口契约：
  - Consumes: `WALLPAPER_FIELD`（同文件既有模板）。
  - Produces: `SKINS.meirenzhi`（`getSkinSchema`/`defaultsFor`/`validateOverride` 自动生效）；12 个 `builtinAssets` 键 `yuntai…yanruyan`（与 Task 1 的 wallpapers 键、Task 5 的 dicts 键同名）。
- 验证范围：Task 2 的测试转绿 + 目录自校验。

- [ ] Step 1: 写最小实现
- Change: 在 `"uefi-harness"` 条目后插入（结构与 tgcf 条目同构，注释注明出厂默认与锚点）：

```js
  // 美人志（出厂皮肤，注册顺序第一位）：12 张内置精选，出厂默认 yuntai
  // （001合照）领头并对齐 tgcf 的「出厂默认领先」惯例；panelOpacity 锚定
  // tgcf 二次曲线（projector 数学见 skins/meirenzhi/index.js）。
  meirenzhi: {
    builtinAssets: {
      yuntai: { mime: "image/webp", labelKey: "personalization.meirenzhi.yuntai" },
      yuanfeng: { mime: "image/webp", labelKey: "personalization.meirenzhi.yuanfeng" },
      taoyuan: { mime: "image/webp", labelKey: "personalization.meirenzhi.taoyuan" },
      yueye: { mime: "image/webp", labelKey: "personalization.meirenzhi.yueye" },
      mupeiling: { mime: "image/webp", labelKey: "personalization.meirenzhi.mupeiling" },
      ziling: { mime: "image/webp", labelKey: "personalization.meirenzhi.ziling" },
      nangongwan: { mime: "image/webp", labelKey: "personalization.meirenzhi.nangongwan" },
      nangongque: { mime: "image/webp", labelKey: "personalization.meirenzhi.nangongque" },
      yinyue: { mime: "image/webp", labelKey: "personalization.meirenzhi.yinyue" },
      meining: { mime: "image/webp", labelKey: "personalization.meirenzhi.meining" },
      songyu: { mime: "image/webp", labelKey: "personalization.meirenzhi.songyu" },
      yanruyan: { mime: "image/webp", labelKey: "personalization.meirenzhi.yanruyan" },
    },
    fields: [
      {
        ...WALLPAPER_FIELD,
        default: "builtin:meirenzhi:yuntai",
        builtinChoices: [
          "yuntai", "yuanfeng", "taoyuan", "yueye",
          "mupeiling", "ziling", "nangongwan", "nangongque",
          "yinyue", "meining", "songyu", "yanruyan",
        ],
      },
      {
        key: "slogan",
        type: "text",
        scope: "locale",
        labelKey: "personalization.slogan",
        maxLength: 40,
        default: { zh: "风起凡尘 · 红颜问道", en: "From mortal dust, immortals bloom" },
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
        default: 35,
      },
    ],
  },
```

- [ ] Step 2: 运行并确认通过
- Run: `node --test tests/personalization-catalog.test.mjs`
- Expected: 全部测试通过（含 `catalog self-invariants hold for every shipped skin` 与跨层一致性）
- [ ] Step 3: checkpoint commit（可选，受 checkpoint 两模式纪律约束；触碰打包源码，按提交一致性规则先构建再连同 lib 提交）
- Run: `pnpm run build && git add tests/personalization-catalog.test.mjs src/shared/personalization/catalog.js lib && git commit -m "feat(meirenzhi): personalization catalog entry (12 builtins, P=35)"`

### Task 4: dicts 测试断言（先失败）

- 目标：锁定 12 条壁纸标签的 zh/en 双语存在性与「默认壁纸」标记。
- 涉及文件：Modify `tests/dicts.test.mjs`（文件末尾追加测试）。
- 接口契约：
  - Consumes: `DICTS`（dicts.js 既有导出）。
  - Produces: 等待 Task 5 的 12 个 `personalization.meirenzhi.*` 键。

- [ ] Step 1: 追加测试
- Change:

```js
test("meirenzhi wallpaper labels are localized with the factory-default marker", () => {
  const keys = [
    "yuntai", "yuanfeng", "taoyuan", "yueye",
    "mupeiling", "ziling", "nangongwan", "nangongque",
    "yinyue", "meining", "songyu", "yanruyan",
  ];
  for (const key of keys) {
    const dictKey = `personalization.meirenzhi.${key}`;
    assert.ok(DICTS.zh[dictKey]?.length > 0, `zh missing ${dictKey}`);
    assert.ok(DICTS.en[dictKey]?.length > 0, `en missing ${dictKey}`);
  }
  assert.ok(DICTS.zh["personalization.meirenzhi.yuntai"].includes("默认壁纸"));
  assert.ok(DICTS.en["personalization.meirenzhi.yuntai"].includes("default"));
});
```

- [ ] Step 2: 运行并确认失败
- Run: `node --test tests/dicts.test.mjs`
- Expected: 新测试失败（`zh missing personalization.meirenzhi.yuntai`）

### Task 5: dicts.js 增补 zh/en 壁纸标签

- 目标：补齐 12 条壁纸标签，双语 parity 门自动覆盖。
- 涉及文件：Modify `src/client/dicts.js`（锚点：zh 段 `personalization.uefi.art` 之后；en 段 `personalization.uefi.art` 之后）。
- 接口契约：
  - Consumes: Task 3 的 labelKey 命名。
  - Produces: `personalization.meirenzhi.<key>` ×12（面板壁纸缩略图 tooltip 消费）。
- 验证范围：Task 4 测试转绿 + `node --test tests/dicts.test.mjs` 全绿。

- [ ] Step 1: 写实现
- Change: zh 段插入：

```js
    "personalization.meirenzhi.yuntai": "云台雅集 · 合照（默认壁纸）",
    "personalization.meirenzhi.yuanfeng": "远峰同倚 · 合照",
    "personalization.meirenzhi.taoyuan": "桃源春集 · 合照",
    "personalization.meirenzhi.yueye": "月夜同辉 · 合照",
    "personalization.meirenzhi.mupeiling": "慕沛灵 · 单人",
    "personalization.meirenzhi.ziling": "紫灵 · 单人",
    "personalization.meirenzhi.nangongwan": "南宫婉 · 单人",
    "personalization.meirenzhi.nangongque": "南宫阙 · 单人",
    "personalization.meirenzhi.yinyue": "银月 · 单人",
    "personalization.meirenzhi.meining": "梅凝 · 单人",
    "personalization.meirenzhi.songyu": "宋玉 · 单人",
    "personalization.meirenzhi.yanruyan": "燕如嫣 · 单人",
```

  en 段插入：

```js
    "personalization.meirenzhi.yuntai": "Yuntai Gathering · Group (default)",
    "personalization.meirenzhi.yuanfeng": "Distant Peaks · Group",
    "personalization.meirenzhi.taoyuan": "Peach Spring · Group",
    "personalization.meirenzhi.yueye": "Moonlit Night · Group",
    "personalization.meirenzhi.mupeiling": "Mu Peiling · Solo",
    "personalization.meirenzhi.ziling": "Zi Ling · Solo",
    "personalization.meirenzhi.nangongwan": "Nangong Wan · Solo",
    "personalization.meirenzhi.nangongque": "Nangong Que · Solo",
    "personalization.meirenzhi.yinyue": "Yin Yue · Solo",
    "personalization.meirenzhi.meining": "Mei Ning · Solo",
    "personalization.meirenzhi.songyu": "Song Yu · Solo",
    "personalization.meirenzhi.yanruyan": "Yan Ruyan · Solo",
```

- [ ] Step 2: 运行并确认通过
- Run: `node --test tests/dicts.test.mjs`
- Expected: 全部通过（含既有的 zh/en key parity 与 placeholder parity）
- [ ] Step 3: checkpoint commit（可选，受 checkpoint 两模式纪律约束；触碰打包源码，按提交一致性规则先构建再连同 lib 提交）
- Run: `pnpm run build && git add tests/dicts.test.mjs src/client/dicts.js lib && git commit -m "feat(meirenzhi): wallpaper label dictionaries (zh/en)"`

### Task 6: 皮肤模块 + 模块测试（先失败后通过）

- 目标：实现 `createMeirenzhiSkin`：掌天瓶 Mark/徽章 Name/静态 CSS（含粒子）/`project()` 投影。
- 涉及文件：Create `tests/meirenzhi-skin.test.mjs`；Create `src/client/skins/meirenzhi/index.js`。
- 接口契约：
  - Consumes: Task 1 的 `WALLPAPER_<KEY>` ×12（本模块不 import `resolveImageRef`，壁纸统一消费 `assets.wallpaper.url`）。
  - Produces: `createMeirenzhiSkin(jsxRuntime)` → 皮肤对象（`id:"meirenzhi"`、`bodyAttr:"dshMeirenzhiSkin"`、`builtinAssets` 12 键带 `url`、`project(values, assets)`），Task 7 注册消费。
- 验证范围：`node --test tests/meirenzhi-skin.test.mjs` 红→绿。

- [ ] Step 1: 写测试（数值全部钉死，公式见 Step 3）
- Change: `tests/meirenzhi-skin.test.mjs` 全文：

```js
import assert from "node:assert/strict";
import test from "node:test";
import { createMeirenzhiSkin } from "../src/client/skins/meirenzhi/index.js";
import { getSkinSchema } from "../src/shared/personalization/catalog.js";

const skin = createMeirenzhiSkin({ jsx: (component, props) => ({ component, props }) });
const WALLPAPER_URL = "data:image/webp;base64,AAAA";
const project = (values) =>
  skin.project(
    { wallpaper: "builtin:meirenzhi:yuntai", slogan: { zh: "测", en: "t" }, ...values },
    { wallpaper: { url: WALLPAPER_URL } },
  );

test("skin contract: identity, slots and 12 builtin assets", () => {
  assert.equal(skin.id, "meirenzhi");
  assert.equal(skin.bodyAttr, "dshMeirenzhiSkin");
  assert.deepEqual(skin.label, { zh: "凡人修仙传 · 美人志", en: "Mortal's Journey · Beauty Chronicle" });
  assert.equal(typeof skin.Mark, "function");
  assert.equal(typeof skin.Name, "function");
  assert.ok(skin.favicon.startsWith("data:image/svg+xml,"));
  assert.equal(skin.faviconMime, "image/svg+xml");
  assert.equal(skin.title, "美人志");
  assert.deepEqual(
    Object.keys(skin.builtinAssets),
    getSkinSchema("meirenzhi").fields.find((f) => f.key === "wallpaper").builtinChoices,
  );
  for (const asset of Object.values(skin.builtinAssets)) {
    assert.equal(asset.mime, "image/webp");
    assert.ok(asset.url.startsWith("data:image/webp;base64,"));
  }
});

test("brand contract: mark palette, name copy and badge inversion are pinned", () => {
  const svg = decodeURIComponent(skin.favicon.slice("data:image/svg+xml,".length));
  for (const color of ["#BFE3A8", "#6FAF7C", "#2E6B3E", "#DFF2D0", "#D9B45C", "#8C6B3F"]) {
    assert.ok(svg.includes(color), `mark svg must carry ${color}`);
  }
  for (const fragment of ["linearGradient", "M32 20", "M27 12 h10", "M24.5 52"]) {
    assert.ok(svg.includes(fragment), `mark svg must carry ${fragment}`);
  }
  const mark = skin.Mark({});
  assert.ok(String(mark.props.src).startsWith("data:image/svg+xml,"));
  assert.equal(mark.props["aria-hidden"], "true");
  const name = skin.Name({});
  assert.equal(name.props.children[0].props.children, "凡人修仙传");
  assert.equal(name.props.children[1].props.children, "美人志");
  const css = skin.css;
  assert.ok(css.includes("body[data-dsh-meirenzhi-skin][data-ds-dark-theme] .dsh-mrz-badge{background:#FAF9F6;color:#12121A}"));
  assert.ok(css.includes("@keyframes dsh-mrz-drift-a"));
  assert.ok(css.includes("@keyframes dsh-mrz-drift-b"));
  assert.ok(css.includes("prefers-reduced-motion:reduce"));
  assert.ok(css.includes("#root::before") && css.includes("#root::after"));
});

test("project at factory P=35: riding alphas, constants, scrim and blur", () => {
  const fx = project({ panelOpacity: 35 });
  assert.equal(fx.bodyAttribute, "dshMeirenzhiSkin");
  assert.equal(fx.titleBrand, "美人志");
  assert.deepEqual(fx.slogans, { zh: "测", en: "t" });
  assert.equal(fx.backdrop.imageLight, `url("${WALLPAPER_URL}")`);
  assert.equal(fx.backdrop.imageDark, `url("${WALLPAPER_URL}")`);
  assert.equal(fx.backdrop.blur, 1);
  assert.ok(fx.backdrop.overlayLight.includes("rgba(252, 250, 246, 0.040)"));
  assert.ok(fx.backdrop.overlayDark.includes("rgba(16, 16, 26, 0.040)"));
  const t = fx.tokenOverrides;
  assert.equal(t["--dsw-alias-bg-base"].light, "rgba(250, 249, 246, 0.35)");
  assert.equal(t["--dsw-alias-bg-base"].dark, "rgba(18, 18, 26, 0.35)");
  assert.equal(t["--dsw-specific-sidebar-fill"].light, "rgba(250, 249, 246, 0.40)");
  assert.equal(t["--dsw-specific-sidebar-fill"].dark, "rgba(18, 18, 26, 0.52)");
  assert.equal(t["--dsw-alias-bg-module-platform"].dark, "rgba(18, 18, 26, 0.40)");
  assert.equal(t["--dsw-specific-input-major"].dark, "rgba(18, 18, 26, 0.45)");
  assert.equal(t["--dsw-alias-brand-primary"].light, "#B8433F");
  assert.equal(t["--dsw-alias-brand-primary"].dark, "#E58A80");
  assert.equal(t["--dsw-alias-brand-text"].dark, "#D9B45C");
  assert.equal(t["--dsw-alias-bg-overlay"].light, "rgba(252, 250, 246, 0.85)");
  assert.equal(t["--dsw-alias-bg-overlay"].dark, "rgba(24, 24, 34, 0.88)");
  assert.equal(t["--dsw-specific-bubble"].dark, "#7E2D33");
  assert.deepEqual(fx.cssVariables, { "--dsh-mrz-glass-blur": { light: "1px", dark: "1px" } });
  assert.ok(fx.staticCss.includes("dsh-mrz-badge"));
  assert.equal(fx.decorations, null);
});

test("project at P=0: pure wallpaper, no blur layer; at P=100 alphas clamp to 1.00", () => {
  const zero = project({ panelOpacity: 0 });
  assert.equal(zero.backdrop.blur, 0);
  assert.equal(zero.cssVariables, null);
  assert.equal(zero.tokenOverrides["--dsw-alias-bg-base"].light, "rgba(250, 249, 246, 0.00)");
  assert.ok(zero.backdrop.overlayLight.includes("rgba(252, 250, 246, 0.000)"));
  const full = project({ panelOpacity: 100 });
  assert.equal(full.tokenOverrides["--dsw-specific-sidebar-fill"].dark, "rgba(18, 18, 26, 1.00)");
  assert.equal(full.backdrop.blur, 12);
});

test("project falls back to factory slogan when the field is missing", () => {
  const fx = skin.project(
    { wallpaper: "builtin:meirenzhi:yuntai", panelOpacity: 35 },
    { wallpaper: { url: WALLPAPER_URL } },
  );
  assert.deepEqual(fx.slogans, { zh: "风起凡尘 · 红颜问道", en: "From mortal dust, immortals bloom" });
});
```

- [ ] Step 2: 运行并确认失败
- Run: `node --test tests/meirenzhi-skin.test.mjs`
- Expected: 模块不存在，导入失败（`Cannot find module`）
- [ ] Step 3: 写皮肤模块 `src/client/skins/meirenzhi/index.js`
- Change: 模块要点（全部落实）：
  - import：仅 `import { WALLPAPER_YUNTAI, WALLPAPER_YUANFENG, WALLPAPER_TAOYUAN, WALLPAPER_YUEYE, WALLPAPER_MUPEILING, WALLPAPER_ZILING, WALLPAPER_NANGONGWAN, WALLPAPER_NANGONGQUE, WALLPAPER_YINYUE, WALLPAPER_MEINING, WALLPAPER_SONGYU, WALLPAPER_YANRUYAN } from "./wallpapers.js";`。**不要 import `resolveImageRef`**——壁纸引用解析由 projector 层完成，本模块统一消费 `assets.wallpaper.url`。文件头注释注明：非官方粉丝作品、壁纸为 AI 生成同人图（不标注工具）、掌天瓶/徽章/萤火为原创代码绘制、配色基准见设计定案文档。
  - `const SCOPE = "body[data-dsh-meirenzhi-skin]";`
  - **掌天瓶 MARK**（用户提供的配色基准图：深绿描边 + 玉绿渐变瓶身 + 浅绿叶脉 + 底部一点鎏金）：`MARK_SVG` 模板字符串（`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`），包含：瓶塞 `rect(x=26.5, y=5, w=11, h=7, rx=2.4, fill="#8C6B3F", stroke="#2E6B3E")`；瓶身 `path M27 12 h10 l1.2 7.2 c6.4 2.6 10.8 8.8 10.8 16 C49 44.6 41.4 52 32 52 s-17-7.4-17-16.8 c0-7.2 4.4-13.4 10.8-16 L27 12 Z`（fill 用 `<linearGradient id="dsh-mrz-jade">` 从 `#BFE3A8` 到 `#6FAF7C`，stroke `#2E6B3E` width 2）；叶脉 `path M32 20 c-4.2 4.2 -6.2 8.4 -6.2 13.6 M32 20 c4.2 4.2 6.2 8.4 6.2 13.6 M32 20 v20`（stroke `#DFF2D0` width 1.6）；足线 `M24.5 52 h15`（stroke `#2E6B3E`）；鎏金反光 `M23 46.5 c2.9 1.9 5.9 2.8 9 2.8 s6.1-0.9 9-2.8`（stroke `#D9B45C` width 1.6）。`const MARK_URL = "data:image/svg+xml," + encodeURIComponent(MARK_SVG);`
  - **Mark 组件**：`jsx("img", { src: MARK_URL, alt: "", width: size, height: size, className, style: { display: "block", borderRadius: "2px" }, "aria-hidden": "true" })`（tgcf img 模式）。
  - **Name 组件**：外层 `jsx("span", { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700, letterSpacing: "0.02em", whiteSpace: "nowrap" }, children: [渐变字, 徽章] })`；渐变字 `background: "linear-gradient(120deg, #A87B2F, #D9B45C 45%, #B8433F)"` + `WebkitBackgroundClip/backgroundClip: "text"` + `color: "transparent"`，文案「凡人修仙传」；徽章 `jsx("span", { className: "dsh-mrz-badge", children: "美人志" })`。
  - **CSS**（`.join("\n")`）：①徽章反色——`${SCOPE} .dsh-mrz-badge{display:inline-flex;align-items:center;background:#12121A;border-radius:4px;padding:0 5px;font-size:10px;line-height:16px;font-weight:600;letter-spacing:.08em;color:#FAF9F6}` + `body[data-dsh-meirenzhi-skin][data-ds-dark-theme] .dsh-mrz-badge{background:#FAF9F6;color:#12121A}`；②灵光呼吸（骑 runtime 壁纸 `::before` 层，tgcf 同机制）——`@keyframes dsh-mrz-breathe{0%,100%{opacity:.94}50%{opacity:1}}` + `${SCOPE}::before{animation:dsh-mrz-breathe 26s ease-in-out infinite}`；③萤火 ×2（`#root::before/::after`，伪元素预算与 tgcf 持平）——`@keyframes dsh-mrz-drift-a{0%{transform:translate(0,0)}50%{transform:translate(42px,-34px)}100%{transform:translate(0,0)}}`、`@keyframes dsh-mrz-drift-b{0%{transform:translate(0,0)}50%{transform:translate(-46px,28px)}100%{transform:translate(0,0)}}`、`${SCOPE} #root::before{content:"";position:fixed;left:13%;top:19%;width:9px;height:9px;z-index:-1;background:radial-gradient(circle, rgba(217,180,92,.95) 0%, rgba(217,180,92,0) 70%);opacity:.16;animation:dsh-mrz-drift-a 38s ease-in-out infinite;pointer-events:none}`、`${SCOPE} #root::after{content:"";position:fixed;right:17%;bottom:23%;width:14px;height:14px;z-index:-1;background:radial-gradient(circle, rgba(250,249,246,.9) 0%, rgba(250,249,246,0) 70%);opacity:.12;animation:dsh-mrz-drift-b 47s ease-in-out infinite;pointer-events:none}`；④`@media (prefers-reduced-motion:reduce){${SCOPE}::before,${SCOPE} #root::before,${SCOPE} #root::after{animation:none}}`。
  - `const GLASS_RULE = '${SCOPE} [id="root"]{backdrop-filter:blur(var(--dsh-mrz-glass-blur,0px))}';`
  - `const SLOGANS = { zh: "风起凡尘 · 红颜问道", en: "From mortal dust, immortals bloom" };`
  - **project(values, assets)**（公式钉死，测试数值由它们推出）：
    - `const t = Math.min(1, Math.max(0, values.panelOpacity / 100));`
    - `const a2 = (x) => Math.min(1, x).toFixed(2);`（随动族两位小数 + 钳 1）
    - 随动 tokenOverrides（light rgb=`250, 249, 246`，dark rgb=`18, 18, 26`）：`--dsw-alias-bg-base` = `rgba(250, 249, 246, a2(t))` / `rgba(18, 18, 26, a2(t))`；`--dsw-specific-sidebar-fill` = `a2(t+0.05)` / `a2(t+0.17)`；`--dsw-alias-bg-module-platform` = `a2(t)` / `a2(t+0.05)`；`--dsw-specific-input-major` = `a2(t+0.05)` / `a2(t+0.10)`。
    - 常量 tokenOverrides：`--dsw-alias-brand-primary` `{light:"#B8433F",dark:"#E58A80"}`；`--dsw-alias-brand-text` `{light:"#A87B2F",dark:"#D9B45C"}`；`--dsw-alias-button-primary-fill` 同 brand-primary；`--dsw-alias-button-primary-hover` 同 brand-text；`--dsw-alias-bg-overlay` `{light:"rgba(252, 250, 246, 0.85)",dark:"rgba(24, 24, 34, 0.88)"}`；`--dsw-alias-interactive-bg-hover` `{light:"rgba(184, 67, 63, 0.08)",dark:"rgba(229, 138, 128, 0.14)"}`；`--dsw-alias-interactive-bg-active` `{light:"rgba(184, 67, 63, 0.14)",dark:"rgba(229, 138, 128, 0.20)"}`；`--dsw-specific-sidebar-nav-item-hover` `{light:"rgba(250, 249, 246, 0.6)",dark:"rgba(28, 28, 40, 0.6)"}`；`--dsw-specific-sidebar-nav-item-active` `{light:"rgba(250, 249, 246, 0.9)",dark:"rgba(28, 28, 40, 0.9)"}`；`--dsw-specific-bubble` `{light:"#B8433F",dark:"#7E2D33"}`。
    - 纱：`const s = (Math.round(30 * t * t) / 100).toFixed(3);` → `overlayLight = linear-gradient(rgba(252, 250, 246, ${s}) 0%, rgba(252, 250, 246, ${s}) 100%)`、`overlayDark = linear-gradient(rgba(16, 16, 26, ${s}) 0%, rgba(16, 16, 26, ${s}) 100%)`。
    - `const blurPx = Math.round(12 * t * t);`
    - 壁纸：`const wallpaperUrl = assets?.wallpaper?.url ?? null;`（builtin/user 由 assetResolver 统一解析）；`imageLight/imageDark = wallpaperUrl === null ? null : \`url("${wallpaperUrl}")\``。
    - 返回 effects：`{ bodyAttribute: "dshMeirenzhiSkin", slogans: values.slogan ?? SLOGANS, titleBrand: "美人志", favicon: { href: MARK_URL, mime: "image/svg+xml" }, backdrop: { imageLight, imageDark, overlayLight, overlayDark, blur: blurPx }, tokenOverrides, cssVariables: blurPx > 0 ? { "--dsh-mrz-glass-blur": { light: `${blurPx}px`, dark: `${blurPx}px` } } : null, staticCss: blurPx > 0 ? CSS + "\n" + GLASS_RULE : CSS, decorations: null }`。
  - 返回皮肤对象：`{ id: "meirenzhi", label: { zh: "凡人修仙传 · 美人志", en: "Mortal's Journey · Beauty Chronicle" }, description: { zh: "云鬓花颜 · 霞衣夜月 · 凡尘问道", en: "Moonlit silks · crimson & gold" }, bodyAttr: "dshMeirenzhiSkin", Mark, Name, favicon: MARK_URL, faviconMime: "image/svg+xml", title: "美人志", css: CSS, art: "", scrimLight: \`url("${WALLPAPER_YUNTAI}")\`, scrimDark: \`url("${WALLPAPER_YUNTAI}")\`, placeholderLight: \`url("${WALLPAPER_YUNTAI}")\`, placeholderDark: \`url("${WALLPAPER_YUNTAI}")\`, slogans: SLOGANS, builtinAssets: { yuntai: { mime: "image/webp", url: WALLPAPER_YUNTAI }, yuanfeng: { mime: "image/webp", url: WALLPAPER_YUANFENG }, taoyuan: { mime: "image/webp", url: WALLPAPER_TAOYUAN }, yueye: { mime: "image/webp", url: WALLPAPER_YUEYE }, mupeiling: { mime: "image/webp", url: WALLPAPER_MUPEILING }, ziling: { mime: "image/webp", url: WALLPAPER_ZILING }, nangongwan: { mime: "image/webp", url: WALLPAPER_NANGONGWAN }, nangongque: { mime: "image/webp", url: WALLPAPER_NANGONGQUE }, yinyue: { mime: "image/webp", url: WALLPAPER_YINYUE }, meining: { mime: "image/webp", url: WALLPAPER_MEINING }, songyu: { mime: "image/webp", url: WALLPAPER_SONGYU }, yanruyan: { mime: "image/webp", url: WALLPAPER_YANRUYAN } }, project }`（legacy 兜底字段对齐 tgcf：projector 层-3 安全网保持可投影）。
- [ ] Step 4: 运行并确认通过
- Run: `node --test tests/meirenzhi-skin.test.mjs`
- Expected: 5 条测试全绿
- [ ] Step 5: checkpoint commit（可选，受 checkpoint 两模式纪律约束；触碰打包源码，按提交一致性规则先构建再连同 lib 提交）
- Run: `pnpm run build && git add src/client/skins/meirenzhi/index.js tests/meirenzhi-skin.test.mjs lib && git commit -m "feat(meirenzhi): skin module (mark, badge, fireflies, projector)"`

### Task 7: 注册顺序切换 + runtime 注释改写

- 目标：`meirenzhi` 成为注册顺序第一位（出厂皮肤），注释与新语义一致。
- 涉及文件：Modify `src/client/index.js`（锚点：import 区 + `for (const factory of [createOpenBmcHarness, createUefiHarness, createTgcfSkin])`）；Modify `src/client/runtime.js`（锚点：`resolveSelectedId()` 内 `// Preserve the existing first-install behavior: OpenBMC remains the fallback…` 注释）。
- 接口契约：
  - Consumes: Task 6 的 `createMeirenzhiSkin`。
  - Produces: `order[0] === "meirenzhi"`；smoke-test 旧断言进入预期失败状态（Task 8 修复）。
- 验证范围：构建通过 + 语法检查（smoke-test 的行为断言归 Task 8）。

- [ ] Step 1: 写实现
- Change: `src/client/index.js` 增加 `import { createMeirenzhiSkin } from "./skins/meirenzhi/index.js";`，工厂数组改为 `[createMeirenzhiSkin, createOpenBmcHarness, createUefiHarness, createTgcfSkin]`；`src/client/runtime.js` 注释改为 `// Factory default (出厂皮肤): the first registered skin wins until the user
// explicitly chooses an appearance — meirenzhi since its introduction,
// openbmc before that. Stored selections and ?skin= keep priority.`。
- [ ] Step 2: 构建验证
- Run: `pnpm run build && node --check lib/client.js && node --check lib/index.js`
- Expected: 构建无错误退出码 0（smoke-test 此刻会红，属预期，Task 8 收口）
- [ ] Step 3: 无独立 commit（受 checkpoint 两模式纪律约束，与 Task 8 合并）

### Task 8: smoke-test 首装断言迁移（十项完整迁移表）

- 目标：把「首装 = openbmc」的**全部**语义迁移为「首装 = meirenzhi」，卡片计数与顺序断言扩为四皮肤；迁移后 `node smoke-test.cjs` 全绿。
- 涉及文件：Modify `smoke-test.cjs`。
- 接口契约：
  - Consumes: Task 7 的注册顺序；Task 6 的皮肤对象契约（label/Name/title/品牌段）。
  - Produces: `node smoke-test.cjs` 退出码 0，含新增成功日志 `✓ factory skin (meirenzhi) mounts on first load`。
- 验证范围：`node smoke-test.cjs` 退出码 0。

- [ ] Step 1: 运行确认当前失败
- Run: `node smoke-test.cjs`
- Expected: 在 `first load must keep OpenBMC as the initial skin` 处失败
- [ ] Step 2: 按迁移表逐项改写（行号为当前锚点，漂移时按符号语义重新定位）
- Change:
  1. **registry presence**（L95–96 区）：追加 `if (!skins.some((s) => s.id === "meirenzhi")) throw new Error("registry missing meirenzhi");`
  2. **initial active id**（L98 注释 + L170）：注释改 `initial skin = meirenzhi`；断言改 `active() !== "meirenzhi"` → `"first load must land on the factory skin (meirenzhi)"`；紧随其后**新增成功日志** `console.log("✓ factory skin (meirenzhi) mounts on first load");`
  3. **initial style/body/backdrop/favicon/title**（L179–198）：`styleTag("meirenzhi")`、`body.dataset.dshMeirenzhiSkin === ""`、`styleTag("meirenzhi.backdrop")`、`body[data-dsh-meirenzhi-skin]::before`、`document.title !== "美人志"`；变量重命名 `tagMeirenzhi`。品牌段语义断言（L205–208）改 `"标题实验 — 美人志"`。
  4. **same-image dark behavior**（L187–194 区）：**不要**迁移「暗色专用 `::before`」断言——出厂壁纸明暗同图，runtime 只在 `imageDark !== imageLight` 时才生成暗色 `::before`。改为正向断言：主 `body[data-dsh-meirenzhi-skin]::before` 存在且含 `url(`；暗色差异由 overlay 层承担 → `backdropTag.textContent.includes("[data-ds-dark-theme]::after")`（overlayLight/overlayDark 不同，runtime 必然生成暗色 `::after`）。
  5. **localized descriptions**（L238–256 区）：zh/en 描述循环数组追加 `["meirenzhi", …]`——zh 含 `云鬓花颜`、en 含 `Moonlit silks` 且不含中文；meirenzhi zh 描述「云鬓花颜 · 霞衣夜月 · 凡尘问道」天然满足既有的 ` · `×2 三段式校验，无需改该校验。
  6. **stateOverrides**（L268）：`stateOverrides = [true, "openbmc", { left: 20, bottom: 50 }, null, "dark"];` → `[true, "meirenzhi", …]`（useState 顺序：open, active skin, box, personalize view, theme preference——不改这里，弹层渲染的选中卡仍是 openbmc）。
  7. **card count/order/selected/label**（L306–318）：`skinCards.length !== 4` → `5`；`gears.length !== 3` → `4`；`skinCards[1].props["aria-checked"] !== true` 保留（语义注释改 meirenzhi 首装选中）；**label 断言写 `skinCards[1].props.children[0].props.children !== "凡人修仙传 · 美人志"`**（卡片渲染的是 `runtime.list()` 的本地化 `label`，不是 Name 组件的渐变字；现有 tgcf 断言能过是因为 tgcf 的 label.zh 恰为「天官赐福」）；tgcf「list last」断言从 `skinCards[3]` 移到 `skinCards[4]`；L318 日志改 `skins(5: official first, meirenzhi second, tgcf last) + gears(4)`。
  8. **official cleanup**（L377–388）：该区断言的是「切回 official 时**初始皮肤**的挂载被卸载」——初始皮肤现在是 meirenzhi，必须整体迁移：`openbmcFavicon` → `meirenzhiFavicon`、`!tagMeirenzhi.removed`（错误文案同步改 factory skin / Meirenzhi）、`styleTag("meirenzhi.backdrop")`、`body.dataset.dshMeirenzhiSkin`。**否则变量未定义直接 ReferenceError。**
  9. **explicit openbmc tests stay**（L407 起 `mod.selectSkin("openbmc")` 之后）：UEFI → openbmc 的 ADR-0004 逐字节锚定检查、L268 之后的面板测试等显式选择 openbmc 的段落原样保留；仅复查其前文不依赖「初始 = openbmc」。
  10. **OpenBMC 残留复查**：逐项复查 `grep -n "OpenBMC\|openbmc" smoke-test.cjs` 的全部命中——不得再有「首装、初始挂载、初始清理对象为 OpenBMC」的语义；**允许保留**：registry presence、描述本地化、卡片元数据等非首装语义，以及第 9 项显式选择区与 ADR-0004 检查。
- [ ] Step 3: 运行并确认通过
- Run: `node smoke-test.cjs`
- Expected: 退出码 0，输出含 `✓ factory skin (meirenzhi) mounts on first load` 与 `skins(5`
- [ ] Step 4: checkpoint commit（受 checkpoint 两模式纪律约束；触碰打包源码，按提交一致性规则先构建。模式 A：只 stage 本任务文件 + lib；模式 B：stage Task 1–8 的全部累积文件 + lib，见下方 Run 的完整清单）
- Run: `pnpm run build && git add scripts/build-meirenzhi-wallpapers.mjs src/client/skins/meirenzhi/wallpapers.js src/client/skins/meirenzhi/index.js tests/personalization-catalog.test.mjs src/shared/personalization/catalog.js tests/dicts.test.mjs src/client/dicts.js tests/meirenzhi-skin.test.mjs src/client/index.js src/client/runtime.js smoke-test.cjs lib/client.js lib/index.js && git commit -m "feat(meirenzhi): factory-default skin registration + smoke test migration"`
- Expected: commit 成功；`git status --short` 中不再出现上述路径（模式 B 时覆盖 Task 1–8 全部源文件；模式 A 时前序文件已在各自 checkpoint 入库，此处 add 它们是无害幂等）

### Task 9: 官方深色兜底 :not() 链补新皮肤（先失败后通过）

- 目标：官方深色的炭色弹层规则只应在「无任何皮肤挂载」时生效，新增皮肤属性必须入链，否则会盖掉 meirenzhi 的 `bg-overlay` token。
- 涉及文件：Modify `tests/sidebar-switcher.test.mjs`（锚点：`css.includes('body[data-ds-dark-theme]:not(…` 断言）；Modify `src/client/sidebar-switcher.js`（锚点：`.dsh-skins-pop{background:rgba(41,42,44,0.97)}` 深色弹层规则及其上方注释的皮肤枚举）。
- 接口契约：
  - Consumes: Task 6 的 `data-dsh-meirenzhi-skin` 属性名。
  - Produces: 无（独立正确性修复）。
- 验证范围：`node --test tests/sidebar-switcher.test.mjs` 红→绿。

- [ ] Step 1: 改测试断言字符串
- Change: 断言改为 `css.includes('body[data-ds-dark-theme]:not([data-dsh-meirenzhi-skin]):not([data-dsh-openbmc-skin]):not([data-dsh-uefi-harness]):not([data-dsh-tgcf-skin]) .dsh-skins-pop{background:rgba(41,42,44,0.97)}')`。
- [ ] Step 2: 运行并确认失败
- Run: `node --test tests/sidebar-switcher.test.mjs`
- Expected: 该断言失败
- [ ] Step 3: 改 CSS
- Change: 深色弹层规则选择器插入 `:not([data-dsh-meirenzhi-skin])`（置于链首），规则体不变；同步注释里的皮肤枚举。
- [ ] Step 4: 运行并确认通过
- Run: `node --test tests/sidebar-switcher.test.mjs`
- Expected: 全绿
- [ ] Step 5: checkpoint commit（可选，受 checkpoint 两模式纪律约束；触碰打包源码，按提交一致性规则先构建再连同 lib 提交）
- Run: `pnpm run build && git add src/client/sidebar-switcher.js tests/sidebar-switcher.test.mjs lib && git commit -m "fix(switcher): official dark popover fallback excludes meirenzhi"`

### Task 10: panel 测试矩阵 + release gate + 发布清单

- 目标：让「所有 catalog 皮肤」的自动化与半自动化验证真正覆盖 meirenzhi，避免测试仍绿但新皮肤零覆盖。
- 涉及文件：Modify `tests/personalization-panel.test.mjs`（锚点 L17 `const SKINS = ["openbmc", "uefi-harness", "tgcf"]`）；Modify `scripts/capture-previews.mjs`（锚点：`check(await gears.count() === 3, …)` 与 gate 区所有 `.dsh-skins-pz-gear` 的 `.last()` 定位）；Modify `docs/plans/release-checklist-1.0.0.md`。
- 接口契约：
  - Consumes: Task 3 的 catalog 条目；Task 5 的 dicts；Task 7 的注册顺序。
  - Produces: 四皮肤面板矩阵全绿；`capture-previews.mjs --gate` 语义修正（`--skin` 真正决定 gate 操作的皮肤，official/未知 id 显式拒绝）。
- 验证范围：panel 矩阵为**覆盖扩展**（非严格红→绿）：改前可观察状态 = 矩阵不含 meirenzhi；改后 = meirenzhi 入矩阵且断言通过；若失败则说明通用 panel 与新 schema 不兼容，修 panel 实现。脚本改动以 `node --check` 语法门 + 装机后 `--gate` 实跑收口（Playwright 半自动 gate 无法离线断言 DOM）。

- [ ] Step 1: panel 测试矩阵
- Change: `const SKINS = ["openbmc", "uefi-harness", "tgcf"];` → `const SKINS = ["openbmc", "uefi-harness", "tgcf", "meirenzhi"];`（若该文件已 import catalog，可改为 `Object.keys(SKINS_CATALOG)` 派生，二选一，以最小改动为准）；确认矩阵循环对 meirenzhi 走通三字段渲染；追加一条断言：meirenzhi 面板的壁纸网格渲染 12 个内置缩略图（数量与 `getSkinSchema("meirenzhi").fields` 的 `builtinChoices` 长度对齐）。
- [ ] Step 2: 运行并确认覆盖扩展生效
- Run: `node --test tests/personalization-panel.test.mjs`
- Expected: 全绿（meirenzhi 已入矩阵）。若失败：通用 panel 与 meirenzhi schema 不兼容，修复 panel 实现后复跑至绿
- [ ] Step 3: capture-previews gate 更新（齿轮语义修正）
- Change:
  - **数量**：`runtime.list()` 只返回**扩展皮肤**（meirenzhi/openbmc/uefi-harness/tgcf），official 是 switcher 渲染时 prepend 的、不在 `list()` 里，齿轮数 = `list().length`（**无 `−1`**）：
    ```js
    const skinIds = await gpage.evaluate(() => window.__DSH_SKINS__.list().map((item) => item.id));
    check(await gears.count() === skinIds.length, `personalization gear on all ${skinIds.length} catalog skins (got ${await gears.count()})`);
    ```
  - **目标定位**：齿轮 NodeList 顺序 = 扩展皮肤列表顺序（list index === gear index，**无 `−1`**）。解析 `--skin` 后：
    ```js
    const targetIndex = skinIds.indexOf(skin);
    if (targetIndex < 0) throw new Error(`unknown or non-personalizable gate skin: ${skin}`);
    const targetGear = gears.nth(targetIndex);
    ```
    文件内**全部 `.last()` 齿轮定位改为复用 `targetGear`**，不得重新计算。
  - **factory slogan 映射**（固定完整映射，覆盖全部可作为 `--skin` 的皮肤，不做"内置表或读 personalization"的运行时分叉）：
    ```js
    const FACTORY_SLOGANS_ZH = {
      meirenzhi: "风起凡尘 · 红颜问道",
      openbmc: "察于未萌 · 治于未乱",
      "uefi-harness": "启于固件 · 行于万象",
      tgcf: "百无禁忌",
    };
    ```
    「恢复默认」断言改为 `FACTORY_SLOGANS_ZH[skin]`；硬编码的 `百无禁忌` 断言删除。
  - 脚本头注释注明行为修正：`--skin` 现在真正决定 gate 操作的皮肤（旧实现 `.last()` 恒为列表最后的 tgcf，与 `--skin` 声明不符）。
  - **gate 生命周期修复**：`openPanel()` 局部 helper（L249–253）内部的齿轮点击同样改用 `targetGear`（不再 `.last()`）。此外「personalization panel shot」段（L275–277）存在既有生命周期缺陷：L267 的 `openPanel()` 之后弹层**仍是打开的**，该段再无条件 `openSwitcher(gpage)` 会把弹层点关（trigger 是 toggle），随后 `targetGear.click()` 因节点消失失败、或 `waitForSelector` 先观察到未卸载的旧节点造成竞态。修复：删除该段重复的 `openSwitcher` + 齿轮点击，直接复用已打开的面板——`await gpage.waitForSelector(".dsh-skins-pz-panel", { timeout: 5_000 });` → 截图 → `await closeSwitcher(gpage);`。
- [ ] Step 4: 脚本语法门
- Run: `node --check scripts/capture-previews.mjs`
- Expected: 退出码 0
- [ ] Step 5: 发布清单更新
- Change: `docs/plans/release-checklist-1.0.0.md`：齿轮数 3 → 4；新增 meirenzhi 验收项（明暗双态视觉、12 张内置壁纸缩略图、三字段编辑/恢复默认、出厂标语「风起凡尘 · 红颜问道」）；gate 命令逐皮肤列出四行（`--skin meirenzhi|openbmc|uefi-harness|tgcf --gate` 各一次）；截图证据路径预留 `docs/assets/meirenzhi-light.webp` / `meirenzhi-dark.webp`（装机采集后回填）。
- [ ] Step 6: checkpoint commit（可选；脚本与文档为非打包源码，独立于 checkpoint 两模式纪律，不触发 lib 规则）
- Run: `git add tests/personalization-panel.test.mjs scripts/capture-previews.mjs docs/plans/release-checklist-1.0.0.md && git commit -m "test(meirenzhi): panel matrix + release gate coverage for the 4th skin"`

### Task 11: 设计定案文档 + 词汇表收口

- 目标：把设计共识落盘为独立文档，词汇表头部反映四套皮肤。
- 涉及文件：Create `docs/plans/2026-09-01-meirenzhi-skin-design.md`；Modify `CONTEXT.md`（锚点：头部第一段「三套皮肤（openbmc / uefi-harness / tgcf）」）。
- 接口契约：
  - Consumes: 本计划的「架构快照」「全局约束」「任务 6 的色值表与公式」（计划正文即设计来源）。
  - Produces: 设计定案文档（后续维护者追溯配色与资产决策的依据）。
- 验证范围：文档存在且章节齐全；CONTEXT.md 无「三套皮肤」残留。

- [ ] Step 1: 写设计文档
- Change: 章节固定为：`## 背景与共识来源`（grill-with-docs 两轮 + 两轮评审修订，2026-09-01）；`## 身份与注册`（id/label/description/body 属性/注册顺序/出厂语义，含「仅影响无存储选择用户」）；`## 壁纸资产`（12 张清单表：文件→key→中英标签、方案 B 固定 2560/q80 与漂移护栏、AI 生成声明与 sha256 记录——措辞用「避免激进降质/降宽造成的明显模糊」，不得写「保证高分辨率原生清晰」）；`## 视觉系统`（Task 6 的常量色值表 + 随动公式 + 浅色主视觉策略 + 同图暗色机制）；`## 品牌组件`（掌天瓶配色基准：用户提供的绿瓶图——深绿描边/玉绿渐变/浅绿叶脉/鎏金反光；徽章反转规则）；`## 动效`（萤火 ×2 + 呼吸、reduced-motion、伪元素预算理由）；`## 个性化字段`（三字段、35% 锚点、标语定案）；`## 交付范围与集成点`（switcher 链、注册顺序、README 双语、panel 矩阵、release gate、术语裁定）。
- [ ] Step 2: 更新 CONTEXT.md 头部
- Change: 「三套皮肤（openbmc / uefi-harness / tgcf）」→「四套皮肤（meirenzhi / openbmc / uefi-harness / tgcf）」。
- [ ] Step 3: 验证（grep 无匹配时退出码为 1，故用 `! grep -q` 断言"不存在"）
- Run: `test "$(grep -c '^## ' docs/plans/2026-09-01-meirenzhi-skin-design.md)" -eq 8 && ! grep -q "三套皮肤" CONTEXT.md && echo OK`
- Expected: 输出 `OK`，退出码 0
- [ ] Step 4: checkpoint commit（可选；纯文档，独立于 checkpoint 两模式纪律，不触发 lib 规则）
- Run: `git add docs/plans/2026-09-01-meirenzhi-skin-design.md CONTEXT.md && git commit -m "docs(meirenzhi): design record + glossary four-skin update"`

### Task 12: README 双语同步 + 配对重录

- 目标：README.md 与 README.en.md 同步承载「official + 4 皮肤 = 五款外观」的完整事实，配对校验重录。
- 涉及文件：Modify `README.md`；Modify `README.en.md`；Modify `README.i18n.yaml`（脚本产物）。
- 接口契约：
  - Consumes: Task 3 的默认值（35%）、Task 6 的 label/description/slogan 文案、Task 11 的术语。
  - Produces: `pnpm run verify:readme` 通过。
- 验证范围：`node scripts/verify-readme-pairing.mjs`（`--write` 后）退出码 0。

- [ ] Step 1: 改 README.md（锚点）
- Change:
  - L27：「首次安装且没有已保存选择时，默认使用 OpenBMC 皮肤。」→「首次安装且没有已保存选择时，默认使用「凡人修仙传 · 美人志」皮肤（出厂皮肤）。」
  - L55 标题：「## 四款外观」→「## 五款外观」。
  - 皮肤表格（L55 节内）：在 `official` 行后插入 `| \`meirenzhi\` | 正式皮肤 · 出厂默认 | 云鬓花颜 · 霞衣夜月 · 凡尘问道 |`。
  - L102 URL 列表：在 `/?skin=official` 之后**插入** `/?skin=meirenzhi`，保持与皮肤表格及 runtime 注册顺序一致（official → meirenzhi → openbmc → uefi-harness → tgcf；不是追加到列表末尾）。
  - 皮肤分节 bullet（约 L67）：把「`openbmc` 是默认皮肤。……」改为「`meirenzhi` 是出厂皮肤：首次加载、无已存选择时默认启用；`openbmc` 不再承担首装兜底。「官方」只表示恢复官方界面，不是首次加载的选择。」
  - 皮肤分节新增 meirenzhi 介绍 bullet（tgcf bullet 同位置风格）：非官方粉丝作品，与《凡人修仙传》版权方无关联、未获授权；内置 12 张壁纸（4 合照 + 8 单人）均为 AI 生成粉丝画作（由插件作者提供）；掌天瓶站点图标、徽章与萤火粒子为原创代码绘制 SVG，不含任何官方素材；绯红鎏金亮暗双态，出厂标语「风起凡尘 · 红颜问道」。**本任务不嵌入截图链接**（截图在装机后由 `capture-previews.mjs --skin meirenzhi` 采集，属发布步骤，见最终验证注记）。
  - 个性化分节（约 L83）：「三皮肤同一字段集：`tgcf` / `openbmc` / `uefi-harness`」→「四皮肤同一字段集：`tgcf` / `openbmc` / `uefi-harness` / `meirenzhi`」；默认值句追加「meirenzhi 35%」。
  - 复查是否还有其他「四款/3 个皮肤」类计数表述（`grep -n "四款\|三皮肤\|3 个皮肤" README.md`），一并改齐。
- [ ] Step 2: 同步 README.en.md
- Change: 与 Step 1 逐条对译——含「Four appearances」→「Five appearances」标题、URL 列表（同样在 `/?skin=official` 后插入 `/?skin=meirenzhi`，不追加到末尾）、出厂皮肤承诺、meirenzhi 介绍 bullet、个性化字段集与默认值、计数表述复查（`grep -n "Four appearances\|three skins\|Four skins" README.en.md`）；两文件不得单边改动。
- [ ] Step 3: 配对校验与重录
- Run: `node scripts/verify-readme-pairing.mjs`
- Expected: 失败（哈希未录）——这是预期信号
- Run: `node scripts/verify-readme-pairing.mjs --write && node scripts/verify-readme-pairing.mjs`
- Expected: `--write` 更新 `README.i18n.yaml`；复跑退出码 0
- [ ] Step 4: checkpoint commit（可选；README/哈希记录非打包源码，独立于 checkpoint 两模式纪律，不触发 lib 规则）
- Run: `git add README.md README.en.md README.i18n.yaml && git commit -m "docs: five appearances, factory skin promise switches to meirenzhi (zh/en)"`

### Task 13: 全量收口验证

- 目标：仓库门禁全绿，产物入库且与源码一致。
- 涉及文件：无新改动（若此步暴露问题，回到对应任务修复后重跑）。
- 接口契约：
  - Consumes: 全部前序任务。
  - Produces: 可交付的工作区状态。
- 验证范围：`pnpm run check`。

- [ ] Step 1: 全量门禁
- Run: `pnpm run check`
- Expected: build → `node --check` ×2 → smoke-test → 全部 `node --test` → `verify:readme` 依次通过，退出码 0
- [ ] Step 2: 工作区清点（完整输出，不截断）
- Run: `git status --short`
- Expected: 改动文件集合与本计划「文件结构与职责」完全一致；**出现任何清单外文件立即停下核查，不得并入提交**
- [ ] Step 3: bundle 体积上界断言（机器可读标记解析，ΣWebP 取 `wallpapers.js` 头注释的 `TOTAL_WEBP_BYTES`）
- Run: `SUM=$(sed -n 's|^// TOTAL_WEBP_BYTES=||p' src/client/skins/meirenzhi/wallpapers.js); test "$SUM" -gt 0 || exit 1; B64=$(( (SUM * 4 + 2) / 3 )); LIMIT=$(( 748467 + B64 + 20480 )); SIZE=$(wc -c < lib/client.js); echo "sum=$SUM size=$SIZE limit=$LIMIT"; test "$SIZE" -le "$LIMIT"`
- Expected: `size=` 值 ≤ `limit=`，退出码 0（基线 748,467 + base64 增量 + 20KiB slack；方案 B 实测口径下预期约 6.8MB）
- [ ] Step 4: checkpoint commit（显式逐文件路径，禁用 `git add -A` 与目录级批量；含本实施计划自身；此前未提交的计划内文件在此统一入库）
- Run: `pnpm run build && git add scripts/build-meirenzhi-wallpapers.mjs scripts/capture-previews.mjs src/client/skins/meirenzhi/wallpapers.js src/client/skins/meirenzhi/index.js src/client/dicts.js src/client/index.js src/client/runtime.js src/client/sidebar-switcher.js src/shared/personalization/catalog.js tests/meirenzhi-skin.test.mjs tests/personalization-catalog.test.mjs tests/dicts.test.mjs tests/sidebar-switcher.test.mjs tests/personalization-panel.test.mjs smoke-test.cjs docs/plans/2026-09-01-meirenzhi-skin-design.md docs/plans/2026-09-01-meirenzhi-skin-implementation-plan.md docs/plans/release-checklist-1.0.0.md README.md README.en.md README.i18n.yaml CONTEXT.md lib/client.js lib/index.js && git commit -m "feat(meirenzhi): factory-default skin with 12 built-in wallpapers"`
- Expected: commit 成功
- [ ] Step 5: 提交后一致性与干净断言
- Run: `git status --short; test -z "$(git status --porcelain)" && git diff --exit-code -- lib/index.js lib/client.js && echo CLEAN`
- Expected: 状态列表为空；`test -z` 通过；`lib/` 与 HEAD 一致；输出 `CLEAN`。**dirty 状态下命令以非零退出，绝不输出 CLEAN**

## 执行纪律

- 开始实现前先批判性复查本计划；发现缺项、矛盾、命名不一致或验证命令无效，先修计划再动手。
- **已批准裁决，不再询问**：在 `main` 分支执行；素材采用方案 B（固定 2560/q80）。
- 按任务顺序执行（Task 2→3、4→5、6 内部红→绿是硬顺序；Task 7 与 8 必须相邻完成，中间状态 smoke-test 预期为红）；不要无声跳步、合并步或改变任务目标。
- 每完成一个任务运行该任务定义的验证；验证不过不进入下一任务。
- **checkpoint 两模式纪律**：Task 1/3/5/6/8/9 的中间 checkpoint 开工时二选一——模式 A（细粒度）：六个全执行；模式 B（合并）：跳过 Task 1/3/5/6，Task 8 做一次累计提交，跳过 Task 9，其余由 Task 13 统一提交；禁止混用——那会让 bundle 携带未提交源码。
- **提交一致性**：凡 commit 触碰 `src/**`（打包源码），先 `pnpm run build` 并 `git add lib`；`verify-release.mjs` 与安装包产物检查属 CI/发布流程，不在本计划门禁内。
- 遇阻塞、重复失败或计划与仓库现实不符（如行号锚点漂移——按符号/章节锚点重新定位），立即停下说明，不要猜。
- 全部任务完成后运行 `pnpm run check` 并输出修改摘要。

## 最终验证

- `pnpm run check` 退出码 0（build + 语法 + smoke-test + 单测 + README 配对）。
- `node --test tests/meirenzhi-skin.test.mjs`、`node --test tests/personalization-catalog.test.mjs`、`node --test tests/dicts.test.mjs`、`node --test tests/sidebar-switcher.test.mjs`、`node --test tests/personalization-panel.test.mjs` 全绿。
- `node smoke-test.cjs` 输出含 `✓ factory skin (meirenzhi) mounts on first load`（Task 8 新增日志）与 `skins(5`。
- Task 13 Step 3 的 bundle 上界断言通过（方案 B 预期 `lib/client.js` 约 6.8MB，上界按公式计算）。
- 发布注记（非本计划门禁，交付后人工步骤）：装机后依次执行 ① `node scripts/capture-previews.mjs --skin meirenzhi --gate`（meirenzhi 面板交互 gate；四皮肤各自过 gate 见 release-checklist 的四行命令）→ ② `node scripts/capture-previews.mjs --skin meirenzhi`（全量截图）→ ③ 回填 README 截图链接并重录 `README.i18n.yaml`（需本地 DSH Web 在跑）。

## 审阅 Checkpoint

- 计划正文结束后请求用户审阅；审阅通过前不进入实现。
