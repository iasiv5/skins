# 评审报告：tgcf 精简实施计划（2026-08-31）

- 评审对象：`docs/plans/2026-08-31-tgcf-simplification-implementation-plan.md`
- 评审方式：逐条事实核对（计划中的每个行号、文件清单、代码行为断言均对照仓库现状验证），非通读印象式评审
- 评审结论：**有条件通过**。计划整体质量高（契约式 Consumes/Produces、红绿步骤、逐任务 commit、诚实的事实先行步骤都做得好），事实准确率约九成。但存在 **4 个高风险问题（R1–R4）**：其中两个会导致执行后直接违反 ADR-0001（显式保存模型），两个会让计划自带的"check 全绿"门槛在对应任务上必然失败。另有 7 个中风险、8 个低风险问题。**建议修订计划后再开工，不建议按现稿直接执行。**

---

## 一、事实核对结果（已验证为真的断言）

以下断言我已逐一到代码里验证，全部属实，计划的可信度在此基础上建立：

| 计划断言 | 核对结果 |
|---|---|
| tgcf 现有 10 字段，删 4（favicon/accent/gold/bubbleColor）后恰为计划所列 6 字段且顺序一致 | ✅ `catalog.js:74-159`，删除后顺序 = wallpaper, slogan, titleBrand, panelOpacity, blur, scrim |
| scrim 现为 `range×colorScheme`，默认 `{light:18, dark:42}`；`range:single` 是合法组合 | ✅ `catalog.js:148-158`、`LEGAL_COMBOS` 含 `range:single` |
| `smoke-test.cjs:407` 的 `0.180` 需改 `0.300`；token 层旧默认值断言在静态化后仍通过 | ✅ 行号与数值精确；`#C3272B/#E0564A`、`#8E2A2F` 等静态常量=旧默认 |
| overlay 基色 亮 `rgba(255,246,234,α)` / 暗 `rgba(14,7,8,α)` | ✅ `tgcf/index.js:211-212` |
| config-client 400ms 防抖（`FLUSH_DEBOUNCE_MS`/`scheduleFlush`/`flushTimer`/`debounceMs`）、三个 theme 方法、`flushNow` 409 返回 `blocked:"conflict"` | ✅ `config-client.js:23,33,45,142-202,301-349` |
| host 两条 theme 路由、`CODE_STATUS` 四个 `IMPORT_*`、`THEME_ARCHIVE_LIMIT` 均在 `personalization-routes.js` | ✅ `personalization-routes.js:16-35,239-290`；`errors.js` 无 IMPORT 码 |
| `src/index.js` 不引用 zip/theme，删链路后零改动可加载 | ✅ 已核对 import 清单 |
| zip.js 的消费者只有 store.js 与两个 theme-package 测试 | ✅ grep 全仓确认 |
| store 测试中 §6 相关引用恰为 15 处（分布在 5 个 test 块：R3×2、R4、Y3、Y4） | ✅（但措辞问题见 L6） |
| dicts 待删键全部存在；`HOST_ERROR_KEYS` 四个 IMPORT 映射存在；`IMPORT_TOO_LARGE` 与上传共用 `tooLarge` 键、删映射保键的处理正确 | ✅ `dicts.js` 全对 |
| gate 断言位于 `capture-previews.mjs:217-261`，选择器 `.dsh-skins-pz`、favicon href 断言现状如计划所述 | ✅ |
| 设计文档锚点：§7.1 现为防抖+关面板冲刷、§8 ZIP、§9 导入幂等、§10 十行表、§11 的 13/16/17、§13/§15/§17/§19/§20 均存在且内容与计划描述相符 | ✅ |
| README `:83` 可定制项、`:85` 主题包特性行、`:234` FAQ；checklist 主题包导出导入项 | ✅ |
| `restore()` 经 `src/client/index.js:55-62` 的 onStateChange 重投影回到已同步值 | ✅ 逻辑成立（`lastOverridesKey` 会因预览清除而变化） |
| T2→T7 的任务顺序无测试红绿死锁（中间态死 UI 但不炸测试） | ✅ T2 后客户端 theme 按钮点击才报错、无测试触达；T4 后 panel 渲染不调用已删方法 |

---

## 二、高风险问题（必须在计划中修复，否则开工即错）

### R1｜关弹层自动保存路径未被删除——直接违反 ADR-0001 【最高优先级】

`sidebar-switcher.js:174-180` 现有：

```js
react.useEffect(() => {
  if (open) return undefined;
  setPersonalizeId(null);
  configClient?.flushNow();   // ← 关闭弹层即冲刷（Y6 旧行为）
  return undefined;
}, [open]);
```

ADR-0001 的 Consequences 明确写：**"防抖自动冲刷与'关弹层即冲刷'路径删除"**。但计划 T4（只改 config-client.js + 其测试）和 T6（改 switcher 但契约文本只字未提这个 effect）都没有安排删除这行。后果推演：T6 落地后，用户有脏预览 → 点空白 → 弹出"未保存离开"确认 → 用户选"离开"（ intending 丢弃）→ `setOpen(false)` → 该 effect 触发 `flushNow()` → **预览被自动保存**。显式保存模型被完整推翻，且这正是 ADR 记录的产品主人改判点。

**要求**：T6 契约显式增加"删除 `[open]` effect 中的 `configClient?.flushNow()`（保留 `setPersonalizeId(null)`）"；T6 新测试增加断言：脏态下确认离开后 **无任何 PATCH 发出**（与 R2 的语义定义绑定）。

### R2｜「同意离开」后的预览处置未定义；齿轮收面板不确认造成语义不对称

T6 只定义了拒绝路径（"拒绝则保持打开…预览保留"），**同意路径上预览是丢弃（`restore()`）还是保留在 configClient 中**完全没有写。两种选择都有道理（保留=重开面板仍在编辑；丢弃=干净离开），但必须二选一写进契约，因为它决定 R1 的测试断言、决定齿轮收面板（不确认通道）与壳关闭（确认通道）的不对称是否成立、决定最终验证⑤"还原→回到已同步值"与"脏态离开"的组合行为。T6 测试③也只覆盖拒绝分支。

**要求**：在 T6 契约中明确同意离开的预览去向，并给同意路径补断言（若选"保留"，需同时说明齿轮点灭不确认的理由——预览无丢失风险，仅离开外壳才确认）。

### R3｜`tests/built-host.test.mjs` 硬断言 theme 路由，T2 文件清单缺失

`built-host.test.mjs:40-48` 断言路由表**恰为 9 条、含 `/dsh-skins/theme/import` 与 `/dsh-skins/theme/export`、`routeDisposals === 9`**。T2 删两条路由后该测试必红，而 T2 的"涉及文件"没有列它。T2 Step 5 期望"`pnpm test` 全绿（含 built-host 集成加载）"将无法成立。

**要求**：T2 涉及文件加入 `tests/built-host.test.mjs`（改为 7 条路由、7 次 dispose），并把"改此测试"放进 Step 2 的测试先行变更里。

### R4｜T3 与现有测试及既有设计原则正面冲突，计划未声明

三处冲突：

1. `tests/personalization-store.test.mjs:172` 现有用例 **"unknown fields and orphan skin sections survive later commits"** —— 直接在盘上注入 `futureField` 与 `removedSkin` 段，断言重开 store 后**原样存活**。T3 的 init 规范化会把这两类键全部删掉（`getField===null` → 删），该用例必红，但 T3 的步骤只说"新增用例"，没说改写/删除这条旧用例。
2. `catalog.js:344-345` 注释与设计 §2/§3 的既有原则是 **"unknown keys are ignored (the store preserves them)"**（为版本升降级保留未知字段）。T3 把同版本未知键改为启动即剔除，是一次设计原则翻转，但计划没有在任何地方（T3 契约或 T8 文档任务）声明这个翻转及理由。
3. 设计 §15 DoD 现有行 **"未知字段经读写/reset/删除/导入后按约定保留"** —— T8 的 §15 变更清单只列了"删主题包/favicon 字段两行、加保存流一行"，漏了这一行。

另有两个 T3 契约自身的未定义边界：**未知 skinId 的整段**（`skins.removedSkin`——逐键判 null 后剩空对象 `{}`，段本身删不删？）；以及 `CONTEXT.md:82-83` 对存量规范化的定义是"剔除**未知或形状不符**"，而计划契约是 `validateOverride 不 ok → 删`（还涵盖 `BAD_VALUE`、`MISSING_ASSET`、`BAD_ASSET`）——两者口径不一致，需统一（建议按实现契约收窄 CONTEXT.md 措辞，并在设计文档记录"configVersion 门保护未来版本字段不被误删"的安全性论证——那是这套规范化不破坏降级安全的根因）。

**要求**：T3 Step 1 明确改写 `:172` 旧用例为新语义；T3 契约补未知 skinId 段的处理；T8 的 §15/§2 变更清单补"未知字段保留原则翻转为启动剔除"；CONTEXT.md 措辞与契约对齐。

---

## 三、中风险问题（开工前应修；不修则执行中会撞墙或产生次品）

### M1｜`personalization.theme.working` 被上传流程复用，T5 全删 `theme.*` 会留下悬空键

`panel.js:207`：壁纸上传的进行中提示用的是 `tr("personalization.theme.working")`（非 theme 语义）。T5 删除**全部** `personalization.theme.*` 后，上传图片会直接在 UI 上回显键名 `personalization.theme.working`。**要求**：T5 增键清单加一个上传态键（如 `personalization.library.uploading`）并把 `panel.js:207` 换键，或从删除清单里排除 `theme.working`（不推荐，语义脏）。

### M2｜T5 内部自相矛盾：「还原」的禁用条件

T5 契约写"左「还原」（`dirtyCount===0` 禁用）"，但 Step 1 测试⑤写"offline 态：保存/**还原**/上传禁用"。`restore()` 是纯本地操作（清预览层+emit），离线完全可执行。两处必须统一（建议：还原仅 `dirtyCount===0` 禁用，离线可用；或产品上确要禁用则改契约并说明理由）。

### M3｜粘连外壳几何断点算术不一致：860px vs 实际需要的 904px

左列 360（固定）+ 右列 `flex:0 0 520`（不可收缩）= 880；外壳宽 `min(880px, 100vw - 24px)`。要横排容纳 880，需 `100vw ≥ 904`。计划的堆叠断点是 `max-width:860px`，**860–904px 视口区间外壳容器 <880 而两列都不可收缩 → 横向溢出/裁切约 44px**。修复二选一：断点改 904px（或 `max-width: 903px`）；或右列改 `flex: 0 1 520px` 允许收缩。另建议补一句：面板收起时外壳宽度回到 `min(360px, …)`（现状值）。

### M4｜T7 gate ④ 会写入并遗留真实用户配置，且无清理步骤

"改 titleBrand → 保存 → 刷新后保持"是对**真实 DSH_HOME 状态**的持久写入。当前 gate 是只读的；改后每次跑 gate 都会往用户配置里留下一个 titleBrand 覆写，污染后续截图与双标签页手工验收。**要求**：gate ④ 断言通过后追加清理步（UI 上「恢复默认」→「保存」，并断言 `document.title` 复原），或至少在 checklist 写明残留与手工清理。

### M5｜409 冲突横幅是死胡同

`flushNow()` 的 409 分支（`config-client.js:166-170`）保留预览、**不 refetch**。冲突后本地 revision 已落后，重试保存必然再次 409。T5 只写了"显示冲突横幅"，没给动作。**要求**：横幅至少带一个动作（如「拉取最新」→ `refetch()` 后由用户重新决定，或明确"横幅仅提示、经 focus/BroadcastChannel 兜底自愈"并接受窗口期），写进 T5 契约与测试。

### M6｜T2 Step 1 的 staging 二分支不覆盖仓库真实现状：staging 是无人使用的死设施

实测：`uploadAsset` 经 `writeBlobExclusive`（`openSync("wx")`）**直写 assets 目录**，不经过 staging；导入的资产缓冲存内存 `imports` Map，也不落 staging。staging 只被 `ensureDirs()` 创建、被 `cleanupStaging()` 清理，**没有任何代码往里写**（grep 全部命中仅 `store.js:9,19,64,66,168,182,283,335-340`）。计划预设的"uploadAsset 也用 / 仅导入用"两分支都不成立。结论方向没错（应整删 staging：`STAGING_DIR`/`STAGING_TTL_MS`/`ensureDirs` 中的 mkdir/`cleanupStaging`/头部注释行），但执行纪律里"事实与预期相反时停下"的场景正是这里——建议把第三分支写进计划，免得执行者误判自己查错了。

### M7｜T8 漏掉 README 配对哈希重记录：`verify:readme` 会挡住自己的绿灯

`scripts/verify-readme-pairing.mjs` 以 `README.i18n.yaml` 里的 git blob 哈希做配对门禁——**改了 README 双语后必须 `node scripts/verify-readme-pairing.mjs --write` 重记录并提交该文件**，否则 T8 Step 3 的 `pnpm run check` 必红。T8 的涉及文件与步骤都没有 `README.i18n.yaml` 和 `--write`。**要求**：T8 涉及文件加 `README.i18n.yaml`，Step 2 后加"重记录配对哈希"。

---

## 四、低风险问题 / 建议（不阻塞，提升一次通过率）

- **L1（T8 清单不全 + grep 过窄）**：除已列锚点外还需清理——设计 §4 的"ZIP manifest 资产映射"提法、§6 的"导入 prepare/commit 再校验"提法、§10 尾段"旧皮肤各加 wallpaper + scrim 字段"（与 §9a 相悖的陈旧句）。T8 的验证 grep `'主题包|theme.export'` 抓不到 "ZIP/导入/import" 字样，建议扩为 `'主题包|theme\.|ZIP|导入|import'` 并人工复核命中。
- **L2（T8 缺 T3 的文档化）**：启动规范化是新的存储层行为，设计文档 §5 应增一小节（触发时机、仅 normal 态、revision+1、configVersion 门的安全性论证），§19 v2.4 段提及。现在 T8 的清单没有这项。
- **L3（计划输入未入库）**：`git status` 显示 `CONTEXT.md`、`docs/adr/`、`docs/plans/` 全部 untracked。计划自称"已落盘"的 ADR/术语表其实不在版本库。建议 T1 的 commit（或一个 T0 docs commit）先把这些入库，否则执行者与后续审计拿不到决策上下文。
- **L4（T6 测试桩范围被低估）**：SidebarAction 需要 runtime/configClient/ctx（effect/slots.inject+register/locale.register/on/theme）/UpdatePanel 全套桩，还要 document 桩（`getElementById`、`activeElement`）与 `window.confirm` 桩。`runtime-effects.test.mjs` 的 `makeCtx` 远不够用；建议点名复用 `personalization-panel.test.mjs` 的 `createFakeReact`（含 hooks 帧栈）并在计划里列出桩清单，避免执行者写出一个只能渲染空树的假测试。
- **L5（术语与键卫生）**：`personalization.reset` 现文案"重置为默认"，CONTEXT.md 术语是"恢复默认"（Avoid: 还原）——T5 既强调术语遵从，应顺手改文案；壁纸区合并后 `personalization.library.usedBy` 若不再渲染应列入删键（dicts parity 测试只查双向对齐，查不出死键）。
- **L6（措辞精度）**：T2"删 §6 相关 15 处用例"实为"5 个 test 块中的 15 处方法调用引用"，按"15 处用例"去数 test 数会对不上。另注意"store §6"沿用了 `store.js:599` 注释里的错误标签（设计的 §6 是 image 字段执行点，ZIP/导入是 §8/§9；ADR-0002 同样误标）——建议计划行文统一为"store 的 theme 导入导出块（注释误标 design §6）"，避免执行者去动设计 §6。
- **L7（底部"固定"操作条）**：外壳是 `overflow-y:auto` 的滚动容器，"底部固定操作条"需要 `position:sticky; bottom:0`（配背景遮罩）才能常驻可视区，建议在 T5/T6 契约写明，防止实现成普通流内元素被滚走。
- **L8（清空图库的 N 次请求）**：逐资产 `deleteImage` = N 次 DELETE + N 次 revision bump + N 次 refetch/announce，中途失败留下半清状态（有 `clearFailed` 提示，可接受）。建议 confirm 文案注明"可能部分失败可重试"，批量端点列入 §17 升级路径。
- **L9（T1 的 scrim 断言载体）**："单值 scrim 双 overlay 同 α 断言"未指明用真 `createTgcfSkin({jsx:()=>null})` 还是改桩皮肤。建议用真皮肤（`project()` 不依赖 jsx），顺带断言静态 token 恒等与 favicon 恒为 lantern——这正是"皮肤视觉身份不丢"的回归锚点。

---

## 五、逐任务简评

| 任务 | 评价 |
|---|---|
| T1 | 契约精确到数值与顺序，smoke 行号无误。仅 L9（断言载体）建议。**可执行** |
| T2 | 方向与清单基本准确，但 R3（built-host 测试）是硬遗漏，M6（staging 第三分支）需改写 Step 1。**修后可执行** |
| T3 | 机制设计合理（仅 normal 态、零写入、revision+1），但 R4 的四处冲突未处理前**不应动刀** |
| T4 | 干净利落，restore 接线论证正确；记得连带清理 `dispose()` 里的 flushTimer 与 `ownsTimers` 死变量（细节，实现自明） |
| T5 | 结构合理，但 M1（theme.working 悬空）、M2（还原矛盾）、M5（冲突横幅死胡同）都在这任务里 |
| T6 | 交互设计到位（三通道、焦点、a11y、reduced-motion），但 R1/R2 是这个任务的核心缺口，M3 断点需修，L4 桩成本要如实写 |
| T7 | "刷新后保持"的持久化证据与 favicon 静态断言都对；M4（写真实状态无清理）必须补 |
| T8 | 锚点大多核实无误，但 M7（README.i18n --write）会让绿灯失败，L1/L2 清单有漏 |

---

## 六、结论

计划的事实底子、结构纪律和验证文化都优于常见实施计划，8 个任务的切分、顺序与依赖也合理。问题集中在：**行为契约的"最后一公里"（R1/R2：旧的关弹层冲刷没有死、离开语义没定义）** 和 **计划自洽性（R3/R4/M7：三个会让自家 check 红的遗漏）**。这些都是修订计划层面的事，不动摇整体架构与任务划分。

**建议处理顺序**：先修 R1→R2（同一处代码、同一组测试，一起改），再 R3/R4/M7（三处清单补漏），然后 M1–M6，L 级可在对应任务执行时顺手带上。修完即可按 T1→T8 开工。

---

# 第二轮评审（针对计划 v2 的复核与终审）

- 评审对象：计划 v2（`2026-08-31-tgcf-simplification-implementation-plan.md`，执行 Agent 声称已全部吸收 R1–R4/M1–M7/L1–L9）+ CONTEXT.md 修订 + 执行 Agent 的三项"更薄实现"报备与 R2 裁决提问
- 评审方式：逐条对照 v2 正文核实修订映射是否真实落文；对三项薄实现做代码级行为推演；对 v2 新引入的表述做新缺陷扫描

## 一、修订映射核实（全部落实）

| 评审项 | v2 落实位置 | 核实结果 |
|---|---|---|
| R1 删关弹层 flushNow | T6 契约首条（指明 `sidebar-switcher.js:174-180`、保留 `setPersonalizeId(null)`）+ 测试②③"无 PATCH"断言 | ✅ |
| R2 四通道统一确认、同意=restore() 丢弃 | T6 契约 + 测试③④⑤（同意路径有断言：restore 被调、无 PATCH） | ✅（裁决见三） |
| R3 built-host 9→7 | T2 涉及文件 + Produces + Step 1 先行改断言（红：实现仍注册 9 条）——TDD 顺序正确 | ✅ |
| R4 四处冲突 | T3 契约：孤儿段整删①、逐键 getField/validateOverride②、段删空移除③、原则翻转声明含 configVersion 门论证；`:172` 用例改写为 normalized-away；catalog mergeValues 注释同步；T8 §15"未知字段保留"行更新 | ✅ 完整 |
| M1 uploading 换键 | T5 契约（新键 + 指明替换 `panel.js:207`）+ 测试⑦ grep 断言无 theme.working 残留 | ✅ |
| M2 还原离线口径 | 按契约方向统一（离线可用），修测试⑤矛盾文本；⑤同步补"删除/清空禁用"（网络操作，正确） | ✅ |
| M3 断点 904 | 全局约束 + T6 契约 `max-width:904px` + 最终手工冒烟⑧ | ✅ |
| M4 gate 清理步 | T7 ④：恢复默认→保存→断言 title 复原 | ✅ |
| M5 409 自愈 | T4：409 分支先 refetch 再返回 conflict；测试⑤覆盖二次 flush 成功 | ✅（护栏见四-2） |
| M6 staging 整删 | T2 Produces：常量/mkdir/清理/注释全套删除，事实陈述与仓库一致 | ✅ |
| M7 README.i18n --write | T8 涉及文件 + Step 2 显式重记录 | ✅ |
| L1/L2/L4/L5/L7/L8/L9 | §4/§6/§10 悬空句、§5.5 新节、tests/fake-react.mjs 共享桩、术语+usedBy 死键、sticky footer、首错即停、真皮肤断言 | ✅ 全部落文 |
| L3 工件入库 | 新增 T0（五个文件含本评审报告，验证 git status 干净） | ✅ |
| L6 措辞 | "5 个 test 块（15 处调用）"已修正；但架构快照仍写"store 删 §6"——误标残留（见四-5，不阻塞） | ◐ 半落实 |
| CONTEXT.md 定义收窄 | 已改盘："剔除未知键与校验不通过的覆写值，删除已卸载皮肤的整段"——与 T3 实现契约一致 | ✅ |

## 二、三项"更薄实现"评估

1. **M5：409 后自动 refetch + 横幅提示再次保存（无动作按钮）** —— **认可**。行为推演成立：409 → refetch（快照 revision 更新、预览保留、状态仍 synced）→ 横幅 → 用户再点保存以新 baseRevision 提交成功。与"用户手动重试"裁决一致，少一个控件少一个状态。唯一注意点见四-2（STORE_READONLY 子案）。
2. **M2：按契约方向修（还原离线可用），改测试⑤而非契约** —— **认可**。这本来就是我在 M2 中的建议方向（restore 是纯本地操作）。
3. **R2：不论证不对称而是消除不对称（齿轮收面板同样确认）** —— **认可并回答提问**，见三。

## 三、对 R2 提问的正面回答： endorse 收紧，不保留 Q49 原语义

裁决正确，理由充分：①统一后 dirtyLeave 语义闭合——所有离开编辑面的路径同规，T6 的实现与测试都更简单；②他们给出的危害真实存在——面板收起后预览仍投射在皮肤上，而齿轮徽标只反映已保存覆写（`hasOverride`）、不反映脏态，用户面对"看得见的改动 + 无编辑入口信号"的悬空态；③代价仅是低频操作上多一次确认。**要求一点**：这是对 Q49"现状语义"的产品级收紧，须在 T8 的 §19 v2.4 段把它记为对 Q49 的显式修订（"齿轮收面板由无条件收起改为脏态确认"），不做沉默偏差——v2 的 §19 条目目前只写"增 v2.4 段"，执行时确保点名。

## 四、本轮新发现（均非阻塞，随对应任务消化）

1. **第五条离开路径未入确认集（建议补进 T6）**：`sidebar-switcher.js:267` `setPersonalizeId(personalizeId === skin.id ? null : skin.id)`——面板开着编辑皮肤 A（脏）时，点**另一皮肤 B 的齿轮**会直接把面板目标切到 B，A 的脏预览留在 configClient 里继续投射但编辑面已不在 A。这与"齿轮收面板"是同一类"离开编辑面"路径（v2 用它自己论证的那条理由衡量：silent-dirty 悬空态）。建议：目标切换通道同样走 dirtyLeave 确认（同意=restore A + 切到 B；拒绝=留在 A）。若产品上选择不确认，须在设计文档写明排除理由。一行契约 + 一个测试断言的事，建议现在补进计划。
2. **409 有两种 flavor，横幅文案只对了一种**：`config-client.js:166-170` 中 revision 冲突与 `STORE_READONLY` 降级**返回同一个 `{blocked:"conflict"}`**。后者会把状态打成 unsupported-readonly（保存被禁），此时横幅文案"请再次点击保存"是死路 advice。护栏（一行）：面板仅在 `state.status === "synced"` 时渲染冲突横幅（readonly 降级走既有的只读提示条）；T4 的 refetch 对 readonly flavor 无害但多余，可只在非 STORE_READONLY 分支做。
3. **小勘误（T7 前置表述）**：v2 写"T2/T3/**T4** 改宿主侧"——T4（config-client.js）是客户端代码，进 `lib/client.js`，重建+刷新即可，不需要重启 dsh web；宿主侧是 T2/T3。不影响流程（T7 时本就该重启），改掉以免误导后续维护。
4. **小勘误（T1 测试写法）**：`createTgcfSkin().project()` 无参调用会在 `const { jsx } = jsxRuntime` 处抛 TypeError——测试须 `createTgcfSkin({ jsx: () => null })`。意图清楚，提防照抄。
5. **措辞残留**：架构快照仍写"store 删 §6 导入导出事务"——设计文档 §6 是 image 字段执行点，ZIP/导入是 §8/§9（store.js:599 注释与 ADR-0002 同样误标）。T8 已按真实锚点操作，建议计划行文顺手改为"store 的 theme 导入导出块"。
6. **T8 grep 预期措辞**：放宽后的模式会命中若干良性残余（如 README 更新机制里的 manifest/导入字样），"仅剩 §17/§19/ADR 引用性提及"可能过紧，建议改为"逐条人工确认均为引用性/无关残余"。

## 五、终审结论（第二轮）

**通过。** 20 项发现全部核实为已吸收（L6 半落实、属措辞级）；三项薄实现全部认可；R2 裁决 endorsed（附带 §19 记录要求）。本轮新发现六项均为非阻塞的收尾级补充，其中四-1（第五通道）与四-2（readonly 横幅护栏）建议在开工前以补丁形式写进 T6/T5 契约（各一行 + 一个断言），其余四项执行时顺手带上即可。**无需第三轮全文评审**——补丁落文后即可按 T0→T8 执行；唯四-1 若裁决为"不确认"须回报产品负责人知悉。

---

# 第三轮评审（v2.1 复核与放行）

- 评审对象：执行 Agent 声称的 v2.1 修订（五通道裁决、409 分 flavor、四处勘误、L6 清理）
- 评审方式：逐项对照计划正文验证落文 + 残留措辞扫描（grep 四条通道/T2\/T3\/T4/store §6/createTgcfSkin() 无参形态）+ 一致性复查（测试编号、§19/§20 锚点、最终验证清单）

## 一、落文核实（全部属实）

| 声称 | 落文位置 | 结果 |
|---|---|---|
| 五条通道统一确认（③-2 同走确认） | T6 契约（五通道明列，含"面板开启时点另一皮肤的齿轮切换目标"）+ 测试⑥同意/拒绝两分支 + §19 Q49 显式修订（含"面板目标切换同此"） | ✅ |
| 409 分 flavor（③-3） | T4：STORE_READONLY → setStatus 且不 refetch；revision 冲突 → 先 refetch 再 blocked:"conflict"。T5：横幅仅 `status==="synced"` 渲染 + 测试⑧ | ✅ |
| 四勘误（③-4） | T1 `createTgcfSkin({ jsx: () => null })` 附 TypeError 注记；T7 前置改"T2/T3 宿主重启；T4–T6 客户端 watcher+刷新"；T8 grep 预期改"逐条人工确认、不设机械白名单"；架构快照改"主题包导入导出机制（设计 §8/§9；store.js 注释误标随 T2 更正）" | ✅ |
| 残留扫描 | "四条通道/T2\/T3\/T4/store §6/无参 createTgcfSkin" 全部零命中；冲突横幅文案收敛至护栏行 | ✅ |

## 二、本轮残留（四项，均一句话级，随执行带上，不构成再评审条件）

1. **最终验证④仍只列四通道**（点空白/Esc/换肤按钮/齿轮收面板）——缺"点另一皮肤齿轮"，与 T6 五通道契约不同步；手工冒烟时补上。
2. **版本行仍是 v2**——执行 Agent 自称 v2.1 但标题未更；随手改为 v2.1（含两轮评审吸收注记），保持工件自述准确。
3. **§7.2 锚点"三通道关闭与脏态统一确认"** 与"五条通道"并存——非矛盾（壳关闭确为三通道），建议 T8 执行时措辞为"壳关闭三通道 + 面板收起/目标切换，合计五条脏态确认通道"以免读者困惑。
4. **测试⑥建议补一个断言**：拒绝分支除"留在 A"外，显式断言 `runtime.active()` 不变——现状齿轮 onClick 先 `runtime.select(B)` 再 `setPersonalizeId`（sidebar-switcher.js:263-267），确认守卫必须先于 select，否则拒绝后留下"active=B、面板=A"的半态；契约"状态原样保持"已涵盖，测试钉死更稳。

## 三、放行结论

**通过，放行。** 三轮评审闭环：第一轮 4 高/7 中/9 低 → v2 全吸收；第二轮 6 项收尾 → v2.1 全吸收；本轮仅余四项一句话级残留，授权随对应任务（T6/T8/最终验证）就地消化，不再送第四轮。执行纪律维持"撞墙即停"；T7 重启 dsh web 前须经用户同意；全部完成后按计划产出「致评审 Agent」收尾块。
