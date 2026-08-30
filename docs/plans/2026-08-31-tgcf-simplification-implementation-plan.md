# 天官赐福个性化精简 实施计划（v2.1，已吸收三轮评审）

## 目标

按共识 Q35–Q53（ADR-0001/0002、CONTEXT.md 已落盘）重构 1.0.0 未发布代码：tgcf 字段 10→6（scrim 单值化默认 30）、显式保存模型（预览+保存+还原）、主题包全链路删除、加载时存量规范化、粘连外壳大面板（右侧 ~520px，窄视口堆叠）、壁纸区合并、清空图库。

## 架构快照

- catalog 仍是 Host/Client 共享事实源；删字段后投影管线（projector 三层回退）不变，tgcf `project()` 内把颜色/favicon **静态化**（皮肤视觉身份不随字段删除而丢失）。
- config-client 四态状态机不变；去掉 400ms 防抖自动落库与**关弹层冲刷**（ADR-0001），`flushNow()` 即「保存」，新增 `restore()` 清预览层；409 冲突后自动 refetch（预览保留），重试保存即可成功。
- store 删主题包导入导出机制（设计 §8/§9；`store.js` 内"design §6"注释系误标，随 T2 一并更正，L6）、zip.js 与**死设施 staging**；新增 init 时的存量规范化（仅 normal 态执行）。
- sidebar-switcher 的 popover 升级为粘连外壳：左列现状内容（360px）+ 右列个性化面板（`.dsh-skins-pz-panel`）；关闭通道脏态统一确认，同意即丢弃。

## 全局约束

- 版本仍为 1.0.0（未发布）；**tag 冻结令持续，本计划不推 tag**。
- 每个 commit `pnpm run check` 全绿；`lib/` 产物随源码同 commit（build 零 diff）。
- 零新增依赖；不引第三方 ZIP（zip.js 是删除项）。
- runtime 挂载保持 teardown-first（N1 教训，勿回退）。
- 测试纪律：每个行为变更至少断言一次完整公开路径（N2/N3 教训）。
- UI 文案 zh/en 双语键完备（`tests/dicts.test.mjs` 强制双向 parity）。
- 术语按 `CONTEXT.md`：保存/还原/恢复默认/图库/清空图库/标签页标题；按钮文案「恢复默认」对齐术语（不用「重置」）。
- 几何：右列 ~520px，外壳总宽 `min(880px, 100vw - 24px)`；**堆叠断点 904px**（360+520+24 边距的精确算术，860–904 区间不得横向溢出）；面板滑入 200ms ease-out + `prefers-reduced-motion` 直接呈现；关闭无出场动画。
- 共识工件（CONTEXT.md / docs/adr/ / docs/plans/）先经 T0 入库，后续任务不携带 untracked 文件。

## 输入工件

- 设计文档 `docs/design-1.0.0-personalization.md`（v2.3，本计划执行后升 v2.4）
- ADR `docs/adr/0001-explicit-save-model.md`、`docs/adr/0002-theme-package-removal.md`
- 术语表 `CONTEXT.md`；共识对话 Q35–Q53；评审报告 `docs/plans/2026-08-31-tgcf-simplification-plan-review.md`

## 文件结构与职责

- Modify `src/shared/personalization/catalog.js` — tgcf 6 字段、scrim range×single 默认 30、mergeValues 注释措辞更新
- Modify `src/client/skins/tgcf/index.js` — project() 适配单值 scrim；颜色/favicon 静态化
- Modify `src/host/personalization/store.js` — 删 §6 与 staging 死设施；加 init 规范化
- Delete `src/host/personalization/zip.js`
- Modify `src/host/personalization-routes.js` — 删 theme 两条路由与 IMPORT_* 错误码
- Modify `src/client/personalization/config-client.js` — 去防抖与关弹层冲刷、显式保存、restore()、409 后 refetch、删 theme 方法
- Modify `src/client/personalization/panel.js` — 面板重写（footer 操作条/壁纸合并区/清空图库；删 ColorField、theme UI、返回键）
- Modify `src/client/sidebar-switcher.js` — 粘连外壳、关闭通道脏态统一确认（删关闭 effect 的 flushNow）、焦点/动画
- Modify `src/client/dicts.js` — 键增删（见 T5 契约）
- Tests: Modify `tests/personalization-catalog.test.mjs`、`tests/personalization-projector.test.mjs`、`tests/personalization-store.test.mjs`、`tests/built-host.test.mjs`、`tests/config-client.test.mjs`、`tests/personalization-panel.test.mjs`、`smoke-test.cjs`、`scripts/capture-previews.mjs`；Delete `tests/theme-package.test.mjs`、`tests/theme-package-zip.test.mjs`；Create `tests/fake-react.mjs`、`tests/sidebar-switcher.test.mjs`
- Docs: Modify `docs/design-1.0.0-personalization.md`、`docs/release-checklist-1.0.0.md`、`README.md`、`README.en.md`、`README.i18n.yaml`（经 `--write` 重记录）
- 每任务同步重建 `lib/client.js` / `lib/index.js`（`pnpm run build`）

## 任务清单

### Task 0: 共识与评审工件入库

- 涉及文件：`CONTEXT.md`、`docs/adr/0001-explicit-save-model.md`、`docs/adr/0002-theme-package-removal.md`、`docs/plans/2026-08-31-tgcf-simplification-implementation-plan.md`、`docs/plans/2026-08-31-tgcf-simplification-plan-review.md`
- 接口契约
  - Consumes: 会话已产出的五个未跟踪文件
  - Produces: 工作树无 untracked 文档；后续 commit 干净
- 验证范围：`git status` 干净（仅剩本任务后的源码变更）

- [ ] Step 1: `git add` 五文件并 commit（`docs: personalization simplification consensus, ADRs, plan, and review`）
- [ ] Step 2: Run: `git status --short`；Expected: 空输出

### Task 1: catalog 裁剪 + tgcf project 适配（scrim 单值、颜色/favicon 静态化）

- 涉及文件：`src/shared/personalization/catalog.js`、`src/client/skins/tgcf/index.js`、`tests/personalization-catalog.test.mjs`、`tests/personalization-projector.test.mjs`、`smoke-test.cjs`
- 接口契约
  - Consumes: 现有 catalog `SKINS.tgcf.fields`（10 字段）、tgcf `project(values, assets)`
  - Produces: `getSkinSchema("tgcf").fields` 恰为 `["wallpaper","slogan","titleBrand","panelOpacity","blur","scrim"]`；`defaultsFor("tgcf")` 中 `scrim === 30`（number）；tgcf `project()` 输出 `overlayLight/overlayDark` 的 α 均来自 `values.scrim/100`（基色不变：亮 `rgba(255,246,234,α)`、暗 `rgba(14,7,8,α)`）；tokenOverrides 用皮肤内静态常量（值=旧默认：brand-primary #C3272B/#E0564A、gold #C9A227/#D4AF37、bubble #C3272B/#8E2A2F、按钮 token 同旧映射）；favicon 恒为 `builtinAssets["lantern-favicon"]`（不再依赖 `assets.favicon`）
- 验证范围：catalog/projector 单测 + smoke 全链路

- [ ] Step 1: 改测试期望（红）
  - Change: `tests/personalization-catalog.test.mjs` 断言 tgcf 字段数 6、key 集合、`scrim` 为 `scope:"single"` 默认 30、无 accent/gold/bubbleColor/favicon；`tests/personalization-projector.test.mjs` 用**真 `createTgcfSkin({ jsx: () => null }).project()`** 断言单值 scrim → 双 overlay 同 α（L9；无参调用会在工厂解构 `jsxRuntime.jsx` 处抛 TypeError，③-4②），并删 color/favicon 字段级回退用例；`smoke-test.cjs:407` 的 `0.180` 改 `0.300`（scrim 30%）
- [ ] Step 2: 确认失败
  - Run: `node --test tests/personalization-catalog.test.mjs tests/personalization-projector.test.mjs`
  - Expected: 字段数/默认值断言失败（红）
- [ ] Step 3: 最小实现
  - Change: catalog.js 删 4 字段、scrim 改 `scope:"single", default:30`；tgcf/index.js 按契约改 `project()`（静态调色常量、静态 favicon、单值 scrim 派生双 overlay）
- [ ] Step 4: 确认通过
  - Run: `pnpm test`
  - Expected: 全绿（smoke 含 tgcf backdrop/token/title 断言）
- [ ] Step 5: checkpoint commit（含 `pnpm run build` 后的 lib 变更）

### Task 2: 主题包全链路删除（host）

- 涉及文件：`src/host/personalization/store.js`、`src/host/personalization/zip.js`（删）、`src/host/personalization-routes.js`、`tests/personalization-store.test.mjs`、`tests/built-host.test.mjs`、`tests/theme-package.test.mjs`（删）、`tests/theme-package-zip.test.mjs`（删）
- 接口契约
  - Consumes: store `exportTheme/prepareImport/commitImport`、routes `/dsh-skins/theme/*`、`CODE_STATUS.IMPORT_*`；`tests/built-host.test.mjs:40-48` 的 9 路由断言
  - Produces: store 不再导出三个方法、无 `imports` Map；routes 无 theme 注册；`CODE_STATUS`/`THEME_ARCHIVE_LIMIT` 删 `IMPORT_INVALID/IMPORT_EXPIRED/IMPORT_CONFLICT/IMPORT_TOO_LARGE`；**staging 死设施整删**（已核实：uploadAsset 经 `openSync("wx")` 直写 assets、导入缓冲驻内存——`STAGING_DIR` 常量、`ensureDirs` 的 mkdir、staging 清理/GC、头部注释行全删，M6）；built-host 断言改为 **7 条路由、`routeDisposals===7`**（R3）；`src/index.js` 零改动仍可加载
- 验证范围：store/routes/built-host 测试

- [ ] Step 1: 删测试与改断言先行（红）
  - Change: 删两个 theme-package 测试文件；`tests/personalization-store.test.mjs` 删主题包相关 5 个 test 块（15 处调用）；`tests/built-host.test.mjs` 路由断言改 7 条、disposals===7
- [ ] Step 2: 确认失败
  - Run: `node --test tests/built-host.test.mjs tests/personalization-store.test.mjs`
  - Expected: built-host 红（实现仍注册 9 条）
- [ ] Step 3: 删实现
  - Change: store.js 删 import zip、三方法、imports 表与 TTL 清理、staging 全套；routes 删两条 theme 路由与 IMPORT_* 错误码；删 `src/host/personalization/zip.js`
- [ ] Step 4: 确认通过
  - Run: `pnpm test`
  - Expected: 全绿（含 built-host 集成加载）
- [ ] Step 5: checkpoint commit

### Task 3: store 加载时存量规范化

- 涉及文件：`src/host/personalization/store.js`、`src/shared/personalization/catalog.js`（注释）、`tests/personalization-store.test.mjs`
- 接口契约
  - Consumes: `readStateFile()` 的 `{kind:"ok"}` 分支、catalog `getField/validateOverride`；现有用例「unknown fields and orphan skin sections survive later commits」（`tests/personalization-store.test.mjs:172` 起）
  - Produces: init 时（**仅 normal 态**；corrupt/future 分支零写入）对 `state.skins` 规范化：①skinId 不在 catalog → **整段删除**（孤儿段）；②段内逐键：`getField(skinId,key)===null` → 删；`validateOverride(skinId,key,value,(id)=>state.library[id]??null)` 不 ok（含 BAD_VALUE 与 BAD_ASSET 悬空引用）→ 删；③段删空后整段移除。有删除 → `revision+=1` 并 `commitState`；无删除零写入。**原则翻转声明**：旧原则"未知键 store 永久保留"自本任务起改为"加载时规范化剔除"（configVersion 门保证未来版本字段走 future 分支零写入，故翻转不破坏降级安全）；catalog.js `mergeValues` 注释同步改写（投影层忽略未知键不变，store 层启动剔除）
- 验证范围：store 单测（含改写的 survive 用例）

- [ ] Step 1: 改写旧用例 + 写新用例（红）
  - Change: `tests/personalization-store.test.mjs` 将「survive later commits」用例改写为「normalized away on load」：预置 `futureField`、`removedSkin` 孤儿段、旧 scrim pair、悬空 user 引用 → init 后全部消失、revision+1、盘上文件已更新；合法键（slogan/wallpaper builtin）保留；损坏 state → 文件字节不变；configVersion 过新 → 零写入
- [ ] Step 2: 确认失败
  - Run: `node --test tests/personalization-store.test.mjs`
  - Expected: 新用例红（键仍存活）
- [ ] Step 3: 实现 init 规范化（契约如上）+ catalog 注释改写
- [ ] Step 4: 确认通过
  - Run: `pnpm test`
  - Expected: 全绿
- [ ] Step 5: checkpoint commit

### Task 4: config-client 显式保存模型

- 涉及文件：`src/client/personalization/config-client.js`、`tests/config-client.test.mjs`
- 接口契约
  - Consumes: 现有 `preview/previewReset/flushNow`（保留）、debounce 定时器路径（删）
  - Produces: `preview()/previewReset()` 只写预览层+emit，**不再调度任何自动 flush**（删 `scheduleFlush/FLUSH_DEBOUNCE_MS/flushTimer/debounceMs` 及 `dispose()` 中 flushTimer 清理死变量）；`flushNow()` 语义不变（=保存）；新增 `restore()`：`previews.clear(); emit()`；删 `exportTheme/prepareThemeImport/commitThemeImport` 三方法；**409 分支分 flavor**（③-3）：`body.code === "STORE_READONLY"` → `setStatus("unsupported-readonly")` 且**不 refetch**（现有行为）；否则（revision 冲突）先 `refetch()` 再返回 `blocked:"conflict"`（预览保留、快照 revision 更新，用户再点保存即以新 baseRevision 提交，M5 自愈）；`src/client/index.js` 的 onStateChange 重投影接线不变（restore 的 emit 触发 `runtime.updateActive()` 回到已同步值）
- 验证范围：config-client 单测

- [ ] Step 1: 改测试（红）
  - Change: `tests/config-client.test.mjs`：删 `flushingClient` 对防抖的依赖与 theme 方法用例；新增 ①`preview` 后不 save → 任意等待后无 PATCH 发出；②`flushNow()` 批量落库（既有）；③`restore()` 后 `effectiveOverrides` 回到快照值、`dirtyCount===0`；④theme 三方法不存在（`typeof === "undefined"`）；⑤409 后快照 revision 已更新（refetch 被触发）、预览保留、二次 flush 成功
- [ ] Step 2: 确认失败
  - Run: `node --test tests/config-client.test.mjs`
  - Expected: 新断言红
- [ ] Step 3: 实现（删防抖、加 restore、409 refetch、删 theme 方法）
- [ ] Step 4: 确认通过
  - Run: `pnpm test`
  - Expected: 全绿
- [ ] Step 5: checkpoint commit

### Task 5: 面板重写（footer 操作条 / 壁纸合并区 / 清空图库 / dicts）

- 涉及文件：`src/client/personalization/panel.js`、`src/client/dicts.js`、`tests/personalization-panel.test.mjs`
- 接口契约
  - Consumes: T4 的 `flushNow/restore`；catalog 6 字段 schema；`configClient.uploadImage/deleteImage`
  - Produces:
    - 面板 props 仅 `{ skinId }`（删 `onBack`）；面板组件签名 `PersonalizationPanel({ skinId })`
    - 结构：①壁纸区（唯一 image 字段）：内置精选 + 我的图片同一网格（`.dsh-skins-pz-thumbs`，角标删除按钮，受影响清单进删除确认文案）+ 上传按钮（进行中提示用**新键 `personalization.library.uploading`**，替换 `panel.js:207` 现用的 `personalization.theme.working`，M1）；②三个滑杆 + slogan(zh/en) + titleBrand；③底部操作条 `.dsh-skins-pz-actions`（`position:sticky;bottom:0` + 外壳底色，L7）：左「还原」（仅 `dirtyCount===0` 禁用；**离线可用**——纯本地操作，M2）右「保存」（`dirtyCount===0 || writesBlocked` 禁用）；条内承载 未保存计数 / 冲突横幅（见下方 ③-3 护栏行）/ 离线+重试 / 恢复模式条
    - 「恢复默认」在还原旁（生成 delete 预览，仍待保存；文案对齐 CONTEXT 术语：zh「恢复默认」en「Restore defaults」，L5）
    - 冲突横幅**仅在 `state.status === "synced"` 时渲染**（③-3 护栏：STORE_READONLY 降级走既有只读提示条，不显示"请再次点击保存"死路建议）；文案=「配置已在其他窗口更新，已拉取最新，请再次点击保存」
    - 清空图库：图库非空时壁纸区尾部按钮 → `window.confirm`（Q45a），文案列出受影响 `皮肤 · 字段` 与"不可恢复"；确认后逐资产 `deleteImage`，**首个错误即停**、显示 `clearFailed` 并 refetch 呈现剩余（L8）
    - dicts 删键（zh+en 成对）：`personalization.back`、`personalization.favicon`、`personalization.accent`、`personalization.gold`、`personalization.bubble`、`personalization.library.manage`、`personalization.library.usedBy`、全部 `personalization.theme.*`、`host.personalization.importInvalid/importExpired/importConflict`；`HOST_ERROR_KEYS` 删 `IMPORT_INVALID/IMPORT_EXPIRED/IMPORT_CONFLICT/IMPORT_TOO_LARGE` 四映射
    - dicts 增键（zh+en）：`personalization.save`、`personalization.restore`、`personalization.dirtyLeave`、`personalization.conflict`、`personalization.library.clear`、`personalization.library.clearConfirm`、`personalization.library.clearFailed`、`personalization.library.uploading`、`personalization.panelLabel`
- 验证范围：panel 公开路径单测（fake-react 渲染真面板）

- [ ] Step 1: 重写测试（红）
  - Change: `tests/personalization-panel.test.mjs` 重写：三皮肤 × {synced, offline-failed} 渲染真面板（真 catalog schema），断言 ①字段行=按 schema（无颜色/favicon 行）；②滑杆/文本 onChange → `preview` 被调且 dirtyCount 增；③「保存」onClick → `flushNow` 被调一次（clean 时按钮 disabled）；④「还原」→ `restore` 被调（clean 时 disabled；**offline 时仍可点**，M2）；⑤offline 态：保存/上传/删除/清空禁用 + 重试按钮在；⑥清空图库 confirm 文案含受影响清单（stub `window.confirm`）；⑦无「返回」按钮、无 theme 按钮、无 `theme.working` 键引用（grep 断言 dicts 与 panel）；⑧冲突横幅仅 `status==="synced"` 时渲染，unsupported-readonly 态无冲突横幅（③-3）
- [ ] Step 2: 确认失败
  - Run: `node --test tests/personalization-panel.test.mjs`
  - Expected: 红（旧面板无这些结构）
- [ ] Step 3: 实现面板与 dicts（契约如上）
- [ ] Step 4: 确认通过
  - Run: `pnpm test`
  - Expected: 全绿（dicts parity 测试同时覆盖新键）
- [ ] Step 5: checkpoint commit

### Task 6: sidebar-switcher 粘连外壳 + 关闭通道脏态统一确认

- 涉及文件：`src/client/sidebar-switcher.js`、`tests/fake-react.mjs`（新，自 panel 测试抽出 `createFakeReact`，L4）、`tests/personalization-panel.test.mjs`（改引共享桩）、`tests/sidebar-switcher.test.mjs`（新）、`smoke-test.cjs`
- 接口契约
  - Consumes: T5 面板（props 仅 skinId）、T4 `getState().dirtyCount` 与 `restore()`
  - Produces:
    - **删除关闭 effect 中的 `configClient?.flushNow()`**（`sidebar-switcher.js:174-180`，保留 `setPersonalizeId(null)`）——ADR-0001「关弹层即冲刷」路径终结（R1）
    - 脏态离开**统一确认**（R2，消除不对称）：**五条通道**（点空白 / 再点换肤按钮 / Esc / 已展开齿轮再点收面板 / **面板开启时点另一皮肤的齿轮切换目标**，③-2 第五通道）遇 `dirtyCount>0` 均 `window.confirm(tr("personalization.dirtyLeave"))`；**同意 = `configClient.restore()` 丢弃后继续原动作（关闭或切换目标）；拒绝 = 状态原样保持**（壳/面板/目标不动、预览保留）。实现要点：确认守卫须置于齿轮 onClick 的 `runtime.select()` **之前**（现实现先 select 后切目标，拒绝分支会留下 active=B/面板=A 半态）
    - 外壳结构：portal 根 `.dsh-skins-pop` 内 `div.dsh-skins-pop-main`（现状 360px 列）+ `personalizeId!==null` 时并置 `div.dsh-skins-pz-panel`（flex:0 0 520px；外壳总宽 `min(880px, calc(100vw - 24px))`）；`@media (max-width:904px)` 外壳 `flex-direction:column`，面板 `flex-basis:auto`（M3）
    - CSS：面板 `transform:translateX(16px);opacity:0→1` 200ms ease-out；`@media (prefers-reduced-motion:reduce)` 无位移直接呈现；关闭无出场动画
    - 卡片点击=仅切肤（现状语义，panel 目标不变）；齿轮点击=展开/切换面板目标
    - 焦点：面板展开 → 聚焦面板标题（`ref`，`tabIndex:-1`）；壳关闭 → 焦点归还触发齿轮（`document.getElementById`）；齿轮 `aria-expanded` 如现状
    - a11y：壳单一 `role="dialog"`；右列 `role="region" aria-label=tr("personalization.panelLabel")`
- 验证范围：新 switcher 测试（共享 fake-react + portal 桩）+ smoke

- [ ] Step 1: 写失败测试
  - Change: 新建 `tests/sidebar-switcher.test.mjs`（复用 `tests/fake-react.mjs`；ctx 桩沿用 `tests/runtime-effects.test.mjs` 的 `makeCtx` 模式 + `reactDom.createPortal` 桩直挂 children）。断言 ①齿轮点击 → `.dsh-skins-pz-panel` 出现、焦点入面板标题；②clean 时点空白通道 → 壳关、焦点还齿轮、**无 PATCH 发出**（R1）；③dirty 时同通道 → confirm 被调；**同意 → `restore()` 被调、壳关、无 PATCH**（R2 同意路径）；拒绝 → 壳仍在、预览保留；④Esc 同路径同断言；⑤dirty 时已展开齿轮再点 → confirm；同意 → 面板收回、restore 调用、壳仍在；⑥dirty 时点**另一皮肤 B 的齿轮** → confirm；同意 → restore + 面板目标切到 B；拒绝 → 留在 A 且**断言 `runtime.active()` 不变**（守卫必须置于 `runtime.select(B)` 之前——现实现先 select 后切目标，`sidebar-switcher.js:263-267`，需调整顺序，否则拒绝后留下 active=B/面板=A 半态，三轮残留④）；⑦卡片点击不改 `personalizeId`
- [ ] Step 2: 确认失败
  - Run: `node --test tests/sidebar-switcher.test.mjs`
  - Expected: 红（外壳结构/确认逻辑不存在）
- [ ] Step 3: 实现外壳与确认逻辑（含删除关闭 effect 的 flushNow）；更新 `smoke-test.cjs` 弹层断言（齿轮仍 3、面板类名、行结构变化处）
- [ ] Step 4: 确认通过
  - Run: `pnpm test`
  - Expected: 全绿
- [ ] Step 5: checkpoint commit

### Task 7: capture-previews gate 与发版清单对齐

- 涉及文件：`scripts/capture-previews.mjs`、`docs/release-checklist-1.0.0.md`
- 接口契约
  - Consumes: T5/T6 的面板结构与保存流；gate 现有断言（`scripts/capture-previews.mjs:217-261`）
  - Produces: gate 断言改为 ①3 齿轮键盘可达（不变）；②Enter 开面板（选择器改 `.dsh-skins-pz-panel`）；③clean Esc → 整壳关闭（`.dsh-skins-pop` 消失）；④面板内改 titleBrand → 点「保存」→ `document.title` 换装 且 刷新后保持（持久化证据）；**清理步：恢复默认 → 保存 → 断言 title 复原**（M4，不留脏真实配置）；⑤favicon 断言改"静态灯笼 favicon 存在"（`link[rel=icon]` href 非空，不再换装）；⑥截图项保留。清单同步：删「主题包导出→导入」项，加「保存/还原/脏态离开确认」手工项，gate 断言描述更新
- 验证范围：`node --test` 不覆盖此脚本；以 `node scripts/capture-previews.mjs --skin tgcf --gate` 在活 GUI 上实跑

- [ ] Step 1: 改 gate 断言与清单文本
- [ ] Step 2: 活 GUI 实跑
  - Run: `node scripts/capture-previews.mjs --skin tgcf --gate`
  - Expected: `GATE PASSED`（若 GUI 环境不可用则记录 blocker，不跳过不伪造）
  - 前置：**T2/T3 改宿主侧，不热更**——先经用户同意后按 76c4b68 时同样的分离式流程重启 `dsh web`（保留原参数与环境）；T4–T6 为客户端代码，watcher 重建 + 刷新页面即生效（③-4①）
- [ ] Step 3: `pnpm run check` 全绿后 checkpoint commit

### Task 8: 设计文档 v2.4 + README 双语对齐

- 涉及文件：`docs/design-1.0.0-personalization.md`、`README.md`、`README.en.md`、`README.i18n.yaml`
- 接口契约
  - Consumes: T1–T7 落地事实
  - Produces: 设计文档升 **v2.4**：标题与状态行；§0 增行（显式保存/主题包移除/粘连外壳/清空图库/加载规范化，指向 ADR-0001/0002）；§2 删 colorScheme-scrim 表述影响；§4 删"ZIP manifest 资产映射"句（L1）；§5 **新增 §5.5 加载时存量规范化**（原则翻转声明 + configVersion 门安全性论证，L2/R4②）；§6 删 favicon 字段约束句与"导入 prepare/commit"提法（L1）；§8/§9 整节移入 §17 并标注"经 ADR-0002 移除"；§10 表改 6 行 + scrim 单值 30 + 颜色/favicon 静态化注记 + 删"旧皮肤各加 wallpaper + scrim 字段"陈旧尾句（L1）；§11 删 13/16/17 三条；§7.1 翻转为显式保存模型（Y6 语义反转注记）；§7.2 重写为粘连外壳与脏态确认全集（措辞：**壳关闭三通道 + 面板收起/目标切换，合计五条脏态确认通道**，三轮评审③残留措辞）；§12 测试计划同步；§13 gate 断言更新；§15 DoD：删主题包/favicon 字段两行、改"未知字段…按约定保留"行为"加载时规范化剔除"（R4③）、加保存流一行；§17 增补（主题包、拖拽上传、fit/位置、显隐壁纸、多选上传）；§19 增 v2.4 段（**含对 Q49 的显式修订记录：离开编辑面的五条通道统一脏态确认——齿轮收面板由无条件收起改为脏态确认、面板目标切换同此，不做沉默偏差**，③-1）；§20 终审追加 Q35–Q53 与两轮评审记录。README 双语：可定制项列表改 6 项 + 保存模型描述、删「主题包」特性行与 FAQ「主题包是什么格式？」、更新面板描述
- 验证范围：`pnpm run verify:readme` 配对绿；文档内无悬空引用

- [ ] Step 1: 改设计文档（按上述锚点逐节）
- [ ] Step 2: 改 README 双语，随后**重记录配对**：`node scripts/verify-readme-pairing.mjs --write` 并将 `README.i18n.yaml` 纳入 commit（M7）
- [ ] Step 3: 验证
  - Run: `pnpm run check`
  - Expected: 全绿（含 README 配对）；`grep -nE '主题包|theme\.|ZIP|manifest|导入|import' README.md README.en.md docs/design-1.0.0-personalization.md` 的每条命中经**逐条人工确认均为引用性或无关残余**（如 import 语句、皮肤导入语），不设机械白名单（③-4④）
- [ ] Step 4: checkpoint commit

## 执行纪律

- 开始实现前先批判性复查整份计划；发现缺项、矛盾、命名不一致或验证命令无效，先修计划再动代码。
- 按任务顺序执行；不无声跳步、合并步或改变任务目标。
- 每完成一个任务运行其定义的验证；`pnpm run check` 全绿才 commit（含 lib 产物）。
- 沿用现状：直接在当前分支提交（既有 e97ad02…76c4b68 先例）；tag 冻结，不推 v1.0.0。
- 遇阻塞、重复失败或计划与仓库现实不符：停下说明，不猜。
- 术语遵从 `CONTEXT.md`；UI 文案 zh/en 同步。

## 最终验证

- Run: `pnpm run check && git diff --exit-code -- lib`
- Expected: 全绿 + lib 零 diff（已随 commit 提交）
- 活 GUI 手工冒烟（刷新页面后）：①齿轮 → 右侧大面板展开、左列仍在；②拖滑杆即见预览、不点保存刷新后不持久；③保存 → 双标签页同步；④脏态点空白/Esc/换肤按钮/齿轮收面板/点另一皮肤齿轮 → 确认框，同意即丢弃（五条通道全验）；⑤还原 → 回到已同步值；⑥清空图库 → 确认框列影响；⑦openbmc/uefi 面板同模型；⑧904px 以下上下堆叠无横向溢出
- 产出「致评审 Agent」可转发块（变更总览 + 测试映射 + ADR 引用），交用户转发

## 审阅 Checkpoint

- 计划正文结束。审阅通过前不进入实现。
