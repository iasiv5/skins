# dsh-skins 1.0.0 设计文档 v2.5：声明式个性化框架（精简版）+ 「天官赐福」皮肤

> 状态：**v2.5**（实测修订轮）。v2.4（Q35–Q53 + 三轮计划评审）记录五项产品裁决：字段精简与 scrim 单值化（§10）、显式保存模型（§7.1，ADR-0001，**v2.5 经 ADR-0003 逆转**）、主题包机制移除（§8/§9 → §17，ADR-0002）、加载时存量规范化（§5.5）、粘连外壳（§7.2）。v2.4.1 记录七项实测修订（§19：卡片随行切换、面板滚动、六列壁纸、展示文案、标签页标题静态化、删除反馈与快照通知、保存失败上浮）。**v2.5：修改即自动保存（ADR-0003，取代 ADR-0001）——「保存/还原」按钮与全部脏态确认移除**（§7.1/§7.2/§19）。v2.3 的 SkinEffects 接口形状（§3a）与 §9a 决策不变。
> 版本目标：单版本 **1.0.0** 全量交付，每个 commit 保持 `pnpm run check` 绿色；发布流程见 §16（preflight → tag → tag workflow → Release）。

---

## 0. 决策记录（增量）

| 领域 | 决策 |
|---|---|
| 资产 ID | `u_` + `randomUUID().replaceAll("-","")`（32 hex），与全部正则统一（R1） |
| bodyAttr | `dshTgcfSkin`（沿用现有 camelCase dataset 契约，零 runtime 改动；派生属性 `data-dsh-tgcf-skin`）（R2.3） |
| titleBrand | **不可个性化（v2.4.1 #5）**：面板字段移除，`effects.titleBrand` 恒为皮肤静态 title「天官赐福」；存量覆写由加载规范化剔除（§5.5）；` — ` 分隔符仍归 runtime 所有 |
| SkinEffects | 精确 shape 冻结 + 分层裁决：catalog 提供元数据与纯 merge/校验规则，projector 调用执行并负责资产解析/校验冻结，skin.project 只做业务映射（R2.1/2.2，三轮措辞统一） |
| 热更新 | 新增 `runtime.updateActive(values)`；mount 事务化（失败逆序清理；替换失败恢复上一套有效 effects）（R2.5） |
| 面板状态机 | `loading / synced / offline-failed / unsupported-readonly`，仅 `synced` 可持久化（R3） |
| 恢复模式（两分支，三轮 R） | **A 损坏/缺失/空 state** → 恢复分支：禁破坏性 GC、blob 保留、quarantine 仅登记（恢复提交前不物理移动）、成功提交后才恢复 GC；**B configVersion 过新** → 严格零写入：不重建/不移动/不清理 staging/不 GC，只读上报，等升级 |
| 掉电后果上限 | state 可能丢失且**配置未必可恢复**（blob 元数据可重建，覆写值不能）；恢复分支保证资产 blob 不被删除、可重新挂接；last-known-good 备份列为升级路径，1.0.0 不做 |
| GC 存活定义 | blob 存活 ⟺ `state.library[id]` 存在（与皮肤是否引用无关）（R4） |
| 原子写 | 复用仓内 `atomicWriteText`（self-update.js:97 提取为共享 host 模块）；不引新依赖；durability 承诺范围=进程崩溃/异常路径，掉电不承诺、由恢复分支兜底（R5） |
| 回退语义 | 三层：字段级回默认 → 整套 defaults-only → fail-closed（恢复上一套有效 effects / 首次 mount 回退 official）（三轮 Y1） |
| staticCss | 皮肤作者编译期预先以 `body[data-dsh-…]` 作用域化；runtime 原样注入、按 generation 清理，**不做通用 CSS 重写**；用户值禁入 CSS 文本（三轮 Y2） |
| maxPixels | image schema 增设 `maxPixels`；40MP 为全局入库不变式、字段只能收紧；**GIF（含动画）收紧为 12MP**（三轮补强） |
| motif 字段 | **删除**，合并进 wallpaper 字段 builtin 页签（四张内置纹样即选项）（Y10） |
| 缓存 | `Cache-Control: private, max-age=31536000, immutable`（Y8） |
| ZIP | ~~store-only + 全部结构约束（Y1）~~ **经 ADR-0002 随主题包移除（v2.4）** |
| 发布流程 | preflight CI → 打 tag → tag workflow 复验 → job 级 `contents: write` 自动建 Release（Y7） |
| 自动保存 | **修改即落库（v2.5，ADR-0003 取代 ADR-0001 显式保存）**：字段变更经 400ms 防抖合并为一个 PATCH 自动写入并跨标签页同步；「保存/还原」按钮与五条脏态确认通道移除；「恢复默认」立即生效并自动保存 |
| 主题包 | **整体移除**（§8/§9 → §17；ADR-0002）：客户端 UI、host 路由、store 事务、zip.js、staging 死设施全删 |
| 字段精简 | tgcf 10→6 字段：删 favicon/accent/gold/bubbleColor；scrim 单值化（默认 30）；颜色与 favicon 静态化为皮肤身份（Q35） |
| 存量规范化 | 加载时按当前 catalog 剔除未知键、校验不通过值与孤儿段（§5.5，Q36）；"未知键永久保留"原则就此翻转 |
| 粘连外壳 | 换肤弹层（360px）+ 右侧个性化面板列（520px）合为单一 dialog；<904px 上下堆叠（Q44/Q46）；壁纸区合并、清空图库带影响清单确认（Q45/Q47） |

---

## 1. 模块划分（四大 seam，职责已裁决）

| 模块 | 职责（裁决后） |
|---|---|
| `PersonalizationCatalog`<br>`src/shared/personalization/catalog.js` | 纯数据：字段元数据（type/scope/约束/labelKey/option values+labelKeys/builtin 资产登记）、`defaultsFor`、`validateOverride(skinId,key,value,assetMeta?)`、`listAssetFields` |
| `PersonalizationStore`<br>`src/host/personalization/store.js` | revision、串行队列、原子状态提交（复用提取后的 `atomicWriteText`）、GC、恢复安全模式、加载时存量规范化（§5.5）、image 字段级再校验 |
| `SkinProjector`<br>`src/client/personalization/projector.js` | **投影管道唯一入口** `projectSkin(skin, rawValues, assetResolver)`：① 调用 catalog 提供的**纯 merge/校验函数**合成 默认值+覆写 ② assetResolver 解析引用（builtin 编译期表 / `/dsh-skins/assets/…` URL）③ 调 `skin.project(normalized, resolvedAssets)` 得业务映射 ④ 校验并冻结 SkinEffects shape ⑤ 失败按三层回退语义处理（§3）。零 DOM |
| `SkinEffectsRuntime`<br>`src/client/runtime.js` 扩展 | 唯一 DOM 触点：执行/清理 SkinEffects、`overrideTokens()` disposer、`updateActive()` 热更新、事务化 mount |

裁决要点：皮肤工厂的 `project()` 只做"值 → 效果"业务映射，不 merge、不解析资产、不碰 DOM、不知道存储；**merge/校验规则由 catalog 以纯函数提供，由 projector 调用执行**；资产解析在 projector 调 assetResolver；回退由 projector 按三层语义统一处理。panel 与 config-client 不理解字段业务含义。

## 2. 字段值模型（type × scope）

同 v2（type：`text/color/image/select/range`；scope：`single/locale/colorScheme`；合法组合不变）。补充冻结：

- **LWW 字段粒度 = 整个 scope 对象**：`slogan:{zh,en}` 是一个字段；Client 提交必须携带完整对象，Host 不做子键隐式合并（精简轮后无 colorScheme 字段在册，机制保留给未来皮肤）
- **全局 revision 覆盖一切可见状态提交**：config PATCH、上传、删除全部递增同一全局 revision

## 3. SkinEffects 精确 interface（冻结）
## 3a. v2.3 修订：backdrop 接口形状

实现评审（R8）指出 v2.2 冻结的 `{ image, scrim:{light,dark}, blur }` 无法表达旧皮肤按明暗分层的
烘焙背景（placeholder/scrim 双态字符串）。经裁决，接口修订为：

```js
backdrop: {
  imageLight, imageDark,       // CSS background-image 值（url/gradient/dataURL），明暗各一
  overlayLight, overlayDark,   // 可选叠层（tgcf 的数字 scrim 由 project 派生为 rgba 渐变）
  blur,                        // 0–24px，作用于 fixed 伪元素
}
```

理由：单 `image` + 数字 `scrim` 是 tgcf 专有视角；明暗双图 + 双 overlay 统一覆盖 tgcf（壁纸+派生遮罩）
与旧皮肤（烘焙双态字符串）两条投影路径，且 legacy 适配器因此得以保持与 0.6.0 逐字节等价。
数字 scrim → rgba 的转换归皮肤 project() 所有（tgcf 已实现）。归一化结果深冻结（递归 Object.freeze）。



```js
{
  bodyAttribute: "dshTgcfSkin",        // 必填；camelCase dataset 键（现有契约），派生属性 data-dsh-tgcf-skin
  slogans: { zh, en } | null,          // 可选；null = 不覆写（宿主词条保持）
  titleBrand: string | null,           // 静态：恒为皮肤 title（字段已移除，v2.4.1 #5）；不含分隔符
  favicon: { href, mime } | null,      // 可选；href 为 builtin dataURL 或资产 URL
  backdrop: {                           // 可选
    image: string | null,               // 已解析 URL；null = 皮肤无背景覆写
    scrim: { light: number, dark: number },   // 0–100
    blur: number,                       // px，0 = 无
  } | null,
  tokenOverrides: { [token]: { light, dark } } | null,  // 走 overrideTokens({light,dark})
  cssVariables: { [name]: { light, dark } } | null,     // 裸 style 注入兜底通道
  staticCss: string | null,             // 皮肤作者预先以 body[data-dsh-…] 作用域化；runtime 原样注入、
                                        // 按 generation 清理，不做通用 CSS 重写；用户值禁止拼入 CSS 文本，
                                        // 动态值只经已验证的 token/cssVariables 通道进入
  decorations: [{ key, css }] | null,   // 可选；额外 <style data-decor=key>，按 key 清理
}
```

逐项语义：null/缺省 = 该效果完全不应用（宿主默认行为保持）；所有效果由单一 dispose 函数统一清理；runtime mount 对每类效果先校验再应用。

**三层回退语义（冻结，三轮 Y1）**：

1. **字段级**——override 值不合法（color 格式错、image 资产不存在、range 超限、select value 不存在）：仅该字段回退 catalog default，投影正常继续
2. **管道级**——assetResolver / `skin.project()` 抛错、返回非对象、SkinEffects 聚合结构不合法：整套重跑 defaults-only 投影
3. **fail-closed**——defaults-only 仍失败：不挂载该皮肤 effects，恢复上一套已知有效 effects；首次 mount 即失败则回退 official 并报告错误

测试按三层分别断言（字段默认值 / null 不应用 / 整套 defaults-only / 整皮肤不挂载是四种可区分结果）。

## 4. Host 路由契约（v2 基础上修正）

exact/prefix 注册表同 v2。修正与补充：

- **ID 正则全文统一**：`^u_[0-9a-f]{32}$`；生成 `"u_" + randomUUID().replaceAll("-", "")`；DELETE suffix、assets GET suffix、state validator、config image 引用、GC、测试语料全部使用同一正则常量（catalog 导出）
- **x-filename**：`encodeURIComponent` 后传输；Host 解码一次（失败 400）、解码后 ≤200 UTF-8 字节、滤控制字符、仅作展示名，不进路径/响应头
- **磁盘硬阈值**：`requiredFree = incomingBytes + 临时文件开销(2×) + 64MB safetyReserve`；不足返回 `DISK_FULL` 5xx 拒写（软配额 QUOTA_WARN 仅是提醒，硬阈值是底线）
- **缓存**：`Cache-Control: private, max-age=31536000, immutable` + `ETag` + nosniff + CORP same-origin（private：壁纸可能含私有内容，禁止共享缓存留存）
- 错误码表追加：`DISK_FULL`、`FILENAME_INVALID`、`ANIMATION_UNSUPPORTED`（animated WebP）

## 5. 存储层：事务与恢复

### 5.1 常规事务（同 v2）

state.json 单点原子提交 + 不可变 blob + staging + 进程内 mutex + 提交后 GC。原子写复用仓内 `atomicWriteText`（temp+rename）——**提取为 `src/host/atomic-write.js` 共享模块**，self-update.js 同步改引，不新增任何依赖（v2 误写 `dsh-atomic-write` 包，仓库实际从未依赖它）。

### 5.2 durability 承诺范围（裁决）

- **承诺**：进程崩溃 / 异常路径 / 请求失败 → 完整旧状态或完整新状态（rename 原子性保证），故障注入测试证明
- **不承诺**：掉电级 durability（无 fsync；如需升级：state 临时文件+目标+父目录 fsync，blob rename 同理——1.0.0 不做）
- **掉电兜底（分层防御）**：掉电最坏产生空/半/缺失 state → 进入恢复分支（5.3）；后果上限 = **state 丢失且配置未必可恢复**（blob 的 MIME/尺寸/hash/扩展名可重建，但 slogan/颜色/引用关系/displayName 等覆写值不能从图片重建），**进入恢复分支后，现存 blob 不被删除、可重新挂接**。1.0.0 不做 last-known-good 备份（列为升级路径）。

### 5.3 恢复模式（两分支，三轮 R）

触发条件与分支**一一对应**，不共用后续动作：

**分支 A：state 损坏 / 空文件 / 缺失且 `assets/` 非空** → 恢复分支

> 注意：`state.json` 缺失但 `assets/` 非空**必须**进恢复分支——掉电或误删 state 的典型表现即此；只有 `state.json` 缺失**且** `assets/` 为空才是真正的首次初始化。

1. 禁止一切破坏性 GC；保留全部 `assets/` 与 staging
2. 扫描 blob 构建恢复候选：从文件名/扩展名/魔数/尺寸/hash 重建 AssetMeta
3. 无法识别的文件**仅在 quarantine 清单中登记（或复制）**，恢复提交前**不物理移动**——避免半途操作把可恢复状态变成混合状态
4. 恢复候选经确认/成功提交新 state 后，才重新启用 GC
5. 状态接口上报恢复结果，UI 呈现

**分支 B：`configVersion` 高于当前支持** → 严格零写入

1. **不**重建 state、**不**移动/复制/quarantine 任何 blob、**不**清理 staging、**不** GC、**不**修改目录结构（旧版本不认识的新版资产/结构一律原样保留，否则升级回新版后引用将 404）
2. 只读上报 `unsupported-readonly`，等待升级回支持该版本的插件

两分支共同点：均禁破坏性 GC；差异：A 允许构建恢复候选（不动原件），B 一切写操作归零。故障注入测试分别覆盖两分支，断言 assets 数量不减。

### 5.4 GC 存活定义（冻结）

> blob 存活 ⟺ `state.library[id]` 存在。与"当前是否被某皮肤引用"完全无关。

已上传未使用的图片是合法图库成员，永不被 GC；GC 只清 state.library 之外的无主 blob（且仅在非 recoverySafeMode 下）。

### 5.5 加载时存量规范化（v2.4，Q36）

boot 的 normal 路径上，持久化覆写按**当前** catalog 对账：未知键、`validateOverride` 不通过的值（已删字段、形状变更如旧 scrim 亮暗对、悬空 user 引用）、未注册皮肤的整段、删空后的残段——全部剔除；实际发生剔除时 revision+1 并原子落盘，无剔除零写入。

- 仅 normal 态执行：恢复分支在用户确认前零写入；configVersion 过新的 state 被 §5.3 B 的版本门先行分流入 `unsupported`——这正是未来版本新增字段永远不会被子版本规范化损伤的原因。
- **原则翻转声明**：v2.3 之前"未知键由 store 永久保留"自本节起改为"加载时规范化剔除"；投影层对未知键的忽略语义（§1 mergeValues）不变。

## 6. image 字段执行点（R6）

`AssetMeta`（state.library 值）：`{ id, displayName, mime, extension, byteLength, width, height, sha256, createdAt }`（上传时魔数+免解码尺寸解析写入，作为可信元数据）。

image 字段 schema 追加：`{ allowedUserMime[], maxBytes, maxWidth, maxHeight, maxPixels }`。`maxPixels` 语义：40MP 是**所有入库资产的全局 ingest 不变量**，字段级 `maxPixels` 只能在其下收紧（wallpaper 沿用 40MP；**GIF 含动画统一 12MP**——覆盖 4K 静帧 8.3MP，同时把最坏单帧解码内存压到 ~48MB RGBA）。

Store 在以下路径用 `state.library[id]` 的 AssetMeta **再校验**（不只验 id 形状）：config PATCH；并校验资产存在（DELETE 后到达的并发 PATCH → `ASSET_NOT_FOUND`，不写入悬空引用）。reset/fallback 不需要。

builtin 资产规则：`allowedUserMime` 永不含 SVG；builtin SVG 仅经编译期 catalog 登记（可信通道）；builtin 引用必须属于**当前皮肤**已登记 asset key，禁止 `builtin:<他皮肤>:…` 交叉引用；user 引用只能是已存在的 `u_…`。

## 7. Client

### 7.1 启动状态机与自动保存模型（v2.5，ADR-0003）

config client 四态不变：`loading / synced / offline-failed / unsupported-readonly`。

- `loading`：面板控件禁用 + "同步中"标识，变更不可持久化
- `offline-failed`：显示"配置尚未同步" + 重试按钮；上传/删除/变更落库被拒；绝不标"已保存"
- `unsupported-readonly`：可查看不可写
- **自动保存语义（v2.5，ADR-0003）**：`preview/previewReset` 写本地预览层并即时投影，**400ms 防抖后把窗口内的全部变更合并为一个 PATCH 自动落库**——用户无任何保存操作；「保存」「还原」按钮删除（预览层仅是投影管线的内部概念，不再暴露为用户状态）；「恢复默认」= 全字段 previewReset 后立即冲刷，前置非默认字段清单的二次确认（v2.5，用户裁决 #9——自动保存后它是唯一破坏性即时操作）。防抖在途时关闭弹层无碍——config client 是会话级全局单例，与弹层生死无关（v2.3"关弹层即冲刷"的时序隐患不复存在）
- 409 分 flavor：`STORE_READONLY` → 只读降级且不 refetch；revision 冲突 → **先 refetch 取新 baseRevision，再自动重试一次**（v2.5：无"再点保存"步骤），仍失败才上浮警示条；非 409 失败警示条携带服务器原因（实测 #7 机制），下次编辑自动清除
- fetch 晚到时本地 dirty preview 字段不被覆盖；请求序号防乱序；dispose 后到达响应丢弃；fetch 晚到但已切肤 → 丢弃
- **快照落地即通知（v2.4.1）**：`refetch()` 三处成功分支（synced/unsupported/recovery）应用新快照后无条件 `emit()`——同状态下 `setStatus` 不触发通知，仅靠它会静默换掉快照、饿死全部订阅者（实测 #4 续报：删除成功而图库网格不更新）；状态转换期的双发无害

runtime：`updateActive(values)` 热更新专用入口（不复用 select）；mount 事务化——每效果应用前校验、`try/catch` 失败逆序清理已注册 disposer；替换新 effects 失败 → 恢复上一份已知有效 effects；测试覆盖第 N 个效果抛错前 N−1 个全清理、非法 token/favicon/background 中途失败。

### 7.2 事件 / 粘连外壳 / 面板（v2.4 重写）

`dsh-skins:active-changed` / `dsh-skins:config-changed` + BroadcastChannel + focus 兜底不变。

- **粘连外壳（Q44/Q46）**：换肤弹层升级为单一 dialog：左列 `.dsh-skins-pop-main`（360px，外观 + 皮肤列表 + 更新栏）+ 右列 `.dsh-skins-pz-panel`（**700px 基准，`flex:0 1` 可收缩 + `overflow-x:hidden` 兜底**，`role=region`）；总宽 `min(1105px, 100vw-24px)`（v2.4.1 #3，原 880/520 组合两列实占 895px 必然横向溢出）；**一级菜单宽度恒定（v2.5，用户裁决 #10/#11）**：左列 360px 固定于**基础规则**（`width:360px;flex:none`，不挂在模式类名上）——收回时宽类名瞬移移除、壳宽仍在动画中，若列宽来源随模式切换会被拉伸再回缩（实测 #11）；窄壳总宽 390px（= 左列 360 + 内边距 28 + 边框 2）；壳宽 200ms ease-out 过渡动画（reduced-motion 直切），面板停靠/收回合成连续动效，收回即再次点击齿轮；壁纸网格**一行 6 张**（~110×83，内建与图库各一排）；标语 zh/en 输入框并排一行（宽面板下堆叠既难看又费高）；**视口 <904px 上下堆叠**（网格回落 4 列；关闭/收起/切换全部直接执行——v2.5 自动保存后无脏状态，无确认弹窗）。面板滑入 200ms ease-out，`prefers-reduced-motion` 直接呈现；关闭无出场动画。**壳高钳制（v2.4.1，实测问题 #2）**：`maxHeight = max(220, innerHeight − 底锚点 − 12)` 由 JS 内联给出——CSS `100vh−24px` 不扣锚点会让壳顶滑出屏幕且内容不可达不可滚；宽模式右列为**独立滚动区**（`overflow-y:auto` + `overscroll-behavior:contain`，左列常驻不动），<904px 堆叠态滚动交还整壳。
- **面板（Q47/Q50/Q51）**：壁纸为唯一合并区（内置精选 + 我的图片同网格、角标删除、上传、清空图库带影响清单确认——确认文案列全部受影响 `皮肤 · 字段` 与不可恢复警示，首个失败即停并刷新剩余）；底部固定操作条 `position:sticky`：状态簇（同步中/离线+重试/只读/恢复模式/保存失败警示）在左，「恢复默认」在右，点击先弹影响清单（当前非默认字段）二次确认（v2.5，用户裁决 #9；v2.5：「保存」「还原」按钮删除——变更自动落库，见 §7.1）；无「返回」按钮、无主题包 UI。
- 卡片点击 = 切换当前皮肤；**面板展开时**点卡片 = 面板目标随行切换（目标皮肤不可个性化则收起面板）（v2.4.1 修订取代 Q48；**v2.5 起无脏态确认、守卫删除，直接执行**）。齿轮点击 = 展开或收起面板目标。焦点：面板展开→面板标题；**宽模式获得焦点时使用 `focus({ preventScroll: true })`**（标题初始暂在窄壳右侧，禁止浏览器为保持焦点可见而横向滚动壳、推移一级菜单；<904px 堆叠模式保留正常 focus scroll）；壳关闭→换肤按钮（齿轮随壳卸载）；齿轮收面板→焦点还齿轮。不变式：面板展开期间**面板目标 ≡ 当前皮肤**（不存在 active=B/面板=A 半态）。

## 8. ZIP 结构约束（**经 ADR-0002 移除**）

本节所述 store-only ZIP 机制已随主题包整体移除（v2.4，§17/ADR-0002）；原文归档于 git 历史（v2.3）。

## 9. 导入事务幂等（**经 ADR-0002 移除**）

同上：导入令牌状态机已删除；原文归档于 v2.3 历史。

## 10. tgcf 完整 catalog 表（R6.4，冻结）

皮肤 id `tgcf`；bodyAttr `dshTgcfSkin`（CSS 作用域 `body[data-dsh-tgcf-skin]`）；label zh「天官赐福」en「Heaven Official's Blessing」。

| key | type×scope | 约束 | 出厂默认 | labelKey | 投影目标 |
|---|---|---|---|---|---|
| wallpaper | image×single | allowedUserMime: png/jpeg/webp/gif；≤20MB；maxPixels 40MP（GIF 12MP）；builtin 页签二选（v2.4.1 #6：AI 画作取代四个代码纹样） | `builtin:tgcf:crimson` | f.wallpaper | backdrop.image |
| slogan | text×locale | maxLength 40 | {zh:"百无禁忌", en:"No Taboos"} | f.slogan | slogans |
| panelOpacity | range×single | **0–100, step 1, unit %（裁决 #14 起）** | **10（裁决 #15 起）** | f.panelTranslucency | tokenOverrides(bg-base + sidebar-fill 按参考皮肤增量分层，rgba 派生) + backdrop.scrim/blur/玻璃雾化（曲线联动，见 §7.2 裁决 #14/#15） |

**v2.4 精简注记（Q35）**：favicon/accent/gold/bubbleColor 四字段删除。皮肤视觉身份不随之丢失——tgcf `project()` 将原 catalog 默认值（brand-primary #C3272B/#E0564A、鎏金 #C9A227/#D4AF37、气泡 #C3272B/#8E2A2F、灯笼 favicon）静态烘焙为皮肤常量；SkinEffects 契约（§3/§3a）不变。

builtin 资产登记（v2.4.1 #6 起）：`crimson`（花城 · 银蝶灯笼，**默认壁纸**，AI 生成画作）、`pale`（谢怜 · 云海宫阙，AI 生成画作）、`lantern-favicon`（红灯笼 favicon，SVG，仅 builtin、静态引用）。四个代码纹样与 motif select 已删除（Y10/#6）。所有 labelKey 与 option 文案进 dicts.js 双语键集测试。动效（呼吸/光晕/漂浮）不设字段，随皮肤 staticCss 常开，`prefers-reduced-motion` 停。

旧皮肤：`openbmc`（bodyAttr `dshOpenbmcSkin` 不变）与 `uefi-harness`（`dshUefiHarness`）仅开放 wallpaper 字段（§9a 终态）；**默认投影必须与 0.6.0 行为逐字节等价**（列入兼容测试）。

## 11. Corner cases 清单（v2 基础上修订）

v2 的 13 条保留，修订：3（碰撞：高熵 + exclusive create + 重试，跨命名空间结构隔离）；8（孤儿 blob 仅在非恢复态下 GC，存活=library 成员）；9（损坏→恢复分支 A，不破坏性 GC；版本过新→分支 B 零写入）。新增：14 掉电上限=state 丢失且配置未必可恢复、blob 保留可重挂（5.2/5.3）；15 未同步面板禁止持久化（7.1）；18 state 缺失但 assets 非空 → 恢复分支（5.3）；19 三层回退语义（§3）；20 staticCss 预作用域、用户值禁入 CSS 文本（§3）；21 加载时存量规范化仅 normal 态执行、剔除即 revision+1（5.5）；22 ~~五通道脏态确认守卫先于 runtime.select~~（v2.5 随 ADR-0003 移除——无脏状态即无守卫）。【v2.4 删除：13 ZIP 结构约束、16 favicon 字段级约束、17 导入幂等——随主题包机制移除（ADR-0002）】

## 12. 测试计划（Y5 全收）

在 v2 矩阵上追加：

- `tests/config-client.test.mjs`：四态状态机全迁移、fetch 晚到×切肤/dispose/乱序、dirty preview 保护、unsupported 只读、BroadcastChannel 去回声；**v2.5**：变更经 400ms 防抖自动发 PATCH（窗口内合并）、409 自动 refetch+重试一次、非 409 失败 errorMessage 上浮
- runtime：`updateActive` 同 id 热更新、第 N 效果失败前 N−1 全清理、替换失败恢复旧 effects、bodyAttr 实际 DOM 属性、title 无双分隔符
- 兼容：openbmc/uefi 默认投影 ≡ 0.6.0、state 损坏后 assets 数量不减、unsupported configVersion 后 assets 数量不减、库中未引用图片不被 GC、UUID 生成值与全部正则一致
- `smoke-test.cjs` 重构：children 位置断言改语义节点定位（v2.4 再降入 `.dsh-skins-pop-main`）
- **v2.4**：`tests/fake-react.mjs` 共享桩（持久 hook 帧/deps-aware effect/useCallback 记忆化/ref 接线）；`tests/personalization-panel.test.mjs` 走面板公开路径（3 皮肤×双态、恢复默认、清空图库、保存失败警示条、无保存/还原按钮）；`tests/sidebar-switcher.test.mjs` 走壳公开路径（开关/卡片随行/无确认弹窗断言）；store 加载规范化三分支（剔除+落盘 / 干净零写入 / 恢复与未来版零写入）
- capture-previews 输出名参数化（`--skin tgcf` 不再覆盖 openbmc 图）；**v2.5 gate**：编辑→自动落库→刷新持久证据 + 恢复默认清理步 + 静态 favicon
- 恢复模式分支测试（三轮 R）：分支 A（损坏/空/缺失+assets 非空）断言 quarantine 仅登记不移动、恢复提交前 assets 数量不减；分支 B（configVersion 过新）断言零写入——文件 mtime/目录结构不变；`state.json` 缺失+assets 非空 ≠ 首次初始化
- 三层回退测试（三轮 Y1）：非法 override 只回退该字段；projector/skin.project 抛错整套 defaults-only；defaults-only 失败 fail-closed 恢复上一套 effects / 首挂回退 official

## 13. 浏览器验收（Y4，事实修正后）

**承认 v2 事实错误**：仓库已有 `playwright-core@1.62.1`（devDependencies）且 `capture-previews.mjs` 已驱动 headless Chromium。修正表述：**仓库已有 Playwright 驱动与截图脚本，但 CI 无 DSH GUI/浏览器编排；1.0.0 不把完整 E2E 纳入 CI，以本地半自动 release gate 替代**。零新增依赖扩展本地脚本断言：齿轮键盘可达、面板粘连展开、Esc 整壳关闭、**编辑→自动落库→刷新持久→恢复默认→复原（自动保存流证据 + 无残留清理）**、静态 favicon、reduced-motion、旧皮肤默认投影等价、双标签页同步、0.6.0→1.0.0 升级路径（加载规范化演练）。gate 写明步骤/期望/失败即禁发/执行证据留存。

## 14. CI 与发布（Y7 修正）

1. 普通 CI（push/PR）：check + lib 零 diff + pack + 版本校验脚本（提取为 `scripts/verify-release.mjs`，tag 前即可本地/CI 预跑）
2. 打 `v1.0.0` tag
3. tag workflow（`refs/tags/v*`）：`GITHUB_REF_NAME === "v"+version` → check → lib 零 diff → pack → 产物解包最小 host 加载测试 → **job 级 `permissions: contents: write` 自动创建 Release**；失败不建 Release 并删除错误 tag

## 15. DoD（v2 12 项 + 二轮 15 项，全列）

- [ ] 每字段唯一规范持久化形状（type×scope）
- [ ] Host/Client 共用 catalog 事实源
- [ ] 未知键与校验不通过的覆写在加载时被规范化剔除，剔除即 revision+1（§5.5，v2.4 翻转）
- [ ] 两标签页独立字段并发编辑不互相覆盖
- [ ] 删除任一步骤崩溃可恢复（故障注入）
- [ ] 切肤/回官方/热更新/dispose 无 token/DOM 残留
- [ ] 自动保存流端到端：变更即落库（400ms 防抖合并）、409 自动 refetch+重试一次、失败警示条、无保存/还原/确认 UI（ADR-0003）
- [ ] 清空图库确认列全量影响清单，首个失败即停并刷新剩余
- [ ] `openbmc` id 全文一致
- [ ] node 单测 + host 集成 + 本地半自动 gate 全过
- [ ] tag/version/Release/repo identity 一致
- [ ] `u_` ID 生成与 DELETE/assets/config 正则完全一致
- [ ] tgcf body attribute 真实 Chromium mount/unmount 不抛错
- [ ] titleBrand 静态等于皮肤 title（标签页标题不可个性化，v2.4.1 #5）
- [ ] SkinEffects shape 与失败回滚语义冻结并有测试
- [ ] config 未同步时不允许持久化默认值
- [ ] state 损坏或版本过新时绝不执行破坏性 GC
- [ ] GC 存活 = library entry 而非皮肤引用
- [ ] 原子写为仓内共享模块；掉电承诺不超出 rename 语义
- [ ] image PATCH 按 AssetMeta 执行字段级约束
- [ ] builtin SVG 与 user SVG 规则互不冲突
- [ ] WebP VP8/VP8L/VP8X 全覆盖
- [ ] 启动状态机四类乱序守卫有自动测试
- [ ] 加载规范化三分支测试（剔除落盘/干净零写入/恢复与未来版零写入）
- [ ] 恢复模式两分支独立测试：损坏态 quarantine 不物理移动；版本过新态严格零写入
- [ ] 三层回退语义有区分性断言（字段默认/null/defaults-only/fail-closed 四态可辨）
- [ ] staticCss 由皮肤预作用域；用户值不进入任何 CSS 文本拼接
- [ ] image schema 含 maxPixels；GIF 12MP 生效并有测试

## 16. 实施顺序（v2 十步微调；v2.4 精简轮按 T0–T8 执行，见 docs/plans/2026-08-31-tgcf-simplification-implementation-plan.md）

1. 冻结契约：type×scope / revision / catalog 全表 / SkinEffects / 恢复语义
2. 纯模块红测试：catalog、merge、projector、引用分析（含 AssetMeta 再校验）
3. Store：revision、串行化、原子提交（提取 atomic-write）、GC、恢复安全模式、故障注入
4. Host routes：信任栅、exact/prefix、body/磁盘/图片校验、错误码
5. Client config 状态机：四态、序号守卫、BroadcastChannel
6. 通用面板 + 交互测试（smoke 语义化重构）
7. tgcf / openbmc / uefi-harness 接入（含兼容等价测试）
8. ~~store-only ZIP + 结构约束攻击语料~~（v2.4 随主题包移除，ADR-0002）
9. 半自动 gate 脚本扩展、截图参数化、双语文档
10. verify-release 脚本 + tag workflow → preflight → `v1.0.0`

## 17. 不做清单（v2 + 增补）

v1/v2 条目保留。增补：掉电级 fsync durability（分层防御替代）、animated WebP（GIF 允许，§8→已移除）、motif 独立字段（并入壁纸 builtin 页签）、完整 E2E 进 CI（本地半自动 gate 替代，CI 编排留 1.x）。**v2.4 增补**：主题包机制整体移除（§8/§9 原文归档 v2.3 历史，ADR-0002；含其流式落盘升级路径——多用户/分享场景重现时须重新设计评审而非复活旧实现）、拖拽上传、壁纸填充方式（cover/contain/fill）、壁纸位置（上/中/下）、显示/隐藏壁纸开关、多文件同时上传（Q43 裁决不做；参考实现 dsh-custom-skin 有之，本插件保持精简）。**v2.4.1 增补**：标签页标题个性化（实测裁决 #5 移除字段；标题品牌段由皮肤静态提供，未来皮肤同此，§10/§0）；四个代码绘制壁纸纹样移除（用户裁决 #6，AI 画作取代，§18/§19）、壁纸按主题成对默认不做（字段模型保持 image×single，留 1.x）。**v2.5 增补**：手动保存/还原按钮与全部脏态确认弹窗移除（ADR-0003 逆转 ADR-0001；防抖自动落库取代，§7.1）。

## 18. 商标与非关联声明（v2.4.1 修订）

与《天官赐福》版权方无关联、未获授权；不含任何官方素材。**视觉构成（v2.4.1 #6 起）**：出厂壁纸为产品作者提供的 AI 生成粉丝画作（豆包AI 生成，两幅：花城/谢怜，源文件 sha256 见 `wallpapers.js` 头注）；站点图标与飘蝶装饰仍为原创代码绘制 SVG。README 双语保持非官方声明；发布前用户终审名称（中性备选「千灯 · 朱红鎏金」）。

## 19. v2 → v2.1 变更一览

R1 UUID 去连字符统一；R2 SkinEffects 冻结+分层裁决+`dshTgcfSkin`+titleBrand 无分隔符+`updateActive` 事务化；R3 四态状态机；R4 恢复安全模式+GC 存活定义；R5 仓内 atomic-write 归属修正+durability 范围；R6 AssetMeta 执行点+builtin 规则+labelKey+tgcf 全表；PATCH 两补充；Y1 ZIP 结构约束；Y2 WebP 三 chunk+动画裁决；Y3 filename 编码；Y4 事实修正+半自动 gate；Y5 测试增补；Y6 导入幂等；Y7 发布时序修正；Y8 private 缓存；Y9 磁盘硬阈值；Y10 motif 删除。

**v2.1 → v2.2（三轮差异复核）**：恢复模式拆两分支（损坏恢复 / 版本过新零写入）+ state 缺失且 assets 非空进恢复；掉电上限措辞改为"配置未必可恢复、blob 保留"；三层回退语义冻结；staticCss 改皮肤预作用域；image schema 增 maxPixels（GIF 12MP）；GIF 风险措辞按评审纠正；merge 措辞统一（catalog 纯函数、projector 执行）。

**v2.4 增补（精简轮，Q35–Q53 + 计划三轮评审）**：字段 10→6（删 favicon/accent/gold/bubbleColor；scrim 单值 30）与皮肤侧静态化；显式保存模型取代防抖自动落库与关弹层冲刷（Y6 语义反转，ADR-0001）；主题包机制整体移除（ADR-0002，staging 死设施一并删除）；加载时存量规范化（"未知键保留"原则翻转，configVersion 门保证未来版字段安全）；粘连外壳（360+520、<904 堆叠、滑入+reduced-motion）；壁纸区合并与清空图库影响清单确认；**对 Q49 的显式修订：离开编辑面的五条通道统一脏态确认——齿轮收面板由无条件收起改为脏态确认、面板目标切换同此**（三轮评审 ③-1/③-2）；409 分 flavor（readonly 不 refetch / 冲突 refetch 自愈）；冲突横幅仅 synced 渲染。实现按计划 T0–T8 执行（docs/plans/2026-08-31-tgcf-simplification-implementation-plan.md v2.1，经三轮计划评审：4高/7中/9低 → 6 项 → 4 句话级，全数吸收）。

**v2.3 增补（实现评审第二轮 N1/N2）**：runtime 挂载改回 teardown-first（共享节点身份下 build-then-swap 会拆毁活动皮肤——生产每次加载必触发的发布级回归），失败恢复 = 纯函数重投影旧皮肤；styleTag 复用必刷新内容；readStateFile 在 shape 校验前先做 configVersion 探测（shape 变化的未来版 → unsupported 零写入）；contextActive 接入 runtime.active；齿轮补 DOM id；verify-release 在 CI 锚定 GITHUB_REPOSITORY；Y1 登记入 §17；发版手工清单落为 `docs/release-checklist-1.0.0.md`（含 README 截图、双标签页、升级演练等 tag 前置条件）。

**v2.4.1 修订（实测问题 #1）**：粘连外壳内面板展开时，点另一皮肤**卡片**原按 Q48 仅切换当前皮肤、面板停留原皮肤——实测造成"面板还是上一个皮肤"的割裂观感，且脏态下该路径不经任何确认直接 `runtime.select`，恰是 ③-2 要防的 active=B/面板=A 半态。修订为：面板展开时点卡片 = 面板目标随行切换（目标不可个性化则经同一确认收起面板），守卫置于 `runtime.select` 之前，确立"面板展开期间面板目标 ≡ 当前皮肤"不变式。五通道集合不变（该路径并入"面板目标切换"通道）；齿轮语义、Q48 的齿轮半则不变。

**v2.4.1 修订（实测问题 #2）**：面板滚动与样式补全。三层叠加缺陷——①壳以底锚点向上生长而 CSS `max-height:100vh−24px` 不扣锚点偏移，矮视口下壳顶滑出屏幕且壳内无溢出，内容既看不见也滚不到；②T5 重写时 7 个面板类（`pz-cell`/`pz-del`/`pz-rowbtns`/`pz-actions`/`pz-cluster`/`pz-primary`/`pz-danger`）写了 JSX 未写 CSS——图库"×"删除钮被堆在缩略图下方（每行多占 ~26px，设计语义是角标删除）、Q50 的 sticky 常驻操作条实际未落地；③宽模式面板列无自身滚动区，内容以 `overflow:visible` 溢出壳圆角边框。修复：壳高 JS 钳制（见 §7.2）；补齐 7 类样式（角标删除、sticky 操作条、状态簇纵排、主/危险按钮强调）；宽模式面板列独立滚动、堆叠态整壳滚动。

**v2.4.1 修订（实测问题 #3）**：面板默认出现横向滚动——宽壳 880px 内容盒装不下两列实占（360 + 520 基准 + padding/border = 535），`flex:0 0` 不可收缩必然溢出。修订：面板列 `flex:0 1 700px` 可收缩 + `overflow-x:hidden` 兜底；宽壳总宽 `min(1105px, 100vw-24px)`；壁纸网格一行 **6** 张（~110×83，内建一排 + 图库一排共两行）；标语 zh/en 输入框由上下堆叠改并排；<904px 堆叠态网格回落 4 列。**级联陷阱记录**：同特异性复位规则必须排在基础规则之后（CSS 数组顺序即 cascade 顺序）——本条 4 列回落与 #2 的滚动复位两次踩中同一陷阱，已在样式数组内加注释。900px 高窗纵向剩 ~43px 滚动，≥~940px 完全无滚动条。

**v2.4.1 修订（用户裁决 #4）**：tgcf 展示文案——卡片 label zh「天官赐福 · 百无禁忌」→「天官赐福」（en 不变）；标语出厂默认 zh「千灯引路 · 长夜同明」→「百无禁忌」，en 采用 README 既有作品副题译法「No Taboos」。同步点：皮肤静态 `slogans` 字典与 catalog slogan 默认**必须一致**（面板默认值与无覆写时的落地文案同源不同处），另含三处测试断言与 README 双语出厂标语提及；已存覆写不受影响（默认只流向未修改字段）。

**v2.4.1 修订（用户裁决 #5）**：标签页标题退出个性化——`titleBrand` 字段从 catalog 移除（tgcf 5 字段：壁纸/标语/面板透明度/模糊/遮罩；未来皮肤不再提供此字段），面板不再渲染该控件。**效果契约不破**：`effects.titleBrand` 保留于 SkinEffects shape（§3a 冻结），来源改为皮肤静态 `title`（project() 恒返回字面量，legacy 回退路径本就是 `skin.title`），runtime 拼装 `会话标题 — 品牌段` 不变。存量 `titleBrand` 覆写由 §5.5 加载规范化自动剔除并落盘（revision+1）。词典键 `personalization.titleBrand` 双语删除；gate 保存流验收改由标语驱动（纯面板选择器断言持久化，§13）。沿用 favicon/颜色静态化同一模式（v2.4）：**删字段不删视觉**。

**v2.4.1 修订（实测问题 #4 + 续报：图库删除的反馈与刷新）**：删除反馈——× 点击后整段 DELETE+refetch 飞行期无任何反馈、成功静默，用户无法确认是否删掉。修复：目标格子进入忙碌态（× 变 spinner），飞行期全部删除/上传/清空按钮禁用（单飞防重复 DELETE），结果必播报（成功「已删除：{name}」/ 失败可重试）。**续报根因更深**：播报落地后网格仍不更新——`refetch()` 同状态下经 `setStatus` 不触发 emit，新快照被静默替换、订阅者饿死（上传此前正常仅因 preview emit 顺带读到新快照）。修复见 §7.1：快照落地即无条件通知；上传、跨标签、focus 刷新同享此修复。

**v2.4.1 修订（实测问题 #7：保存静默失败）**：三滑块拉最低后保存无报错、关闭却弹放弃确认——两层叠加。①**宿主进程陈旧**（T7 分离式重启后未再重启）：运行中的校验目录落后于共享 catalog 十余轮变更（旧 scrim 为亮暗对象，单值数字 0 → BAD_SHAPE；titleBrand 旧字段仍被接受），诊断中已确认并按既有流程重启宿主解决；教训：**改 src/host/** 或共享 catalog 后必须分离式重启，否则宿主按旧契约拒绝新客户端的合法写入**。②客户端把非 409 的保存失败整体吞掉（blocked:"error" 无任何 UI）——修复：flushNow 解析响应体携带 `errorMessage` 上浮，面板渲染「保存失败，请重试」警示条（含服务器原因，再编辑即清除），测试钉死贯通。

**v2.4.1 修订（用户裁决 #6）**：出厂壁纸换装——四个代码绘制 SVG 纹样（祥云灯笼阵/银蝶群/金线山水/红枫落雨）整体移除，改为产品作者提供的两幅 AI 生成粉丝画作（豆包AI）：`builtin:tgcf:crimson`（花城 · 银蝶灯笼，**出厂默认**）与 `builtin:tgcf:pale`（谢怜 · 云海宫阙）。技术通道：1920px WebP q78 内嵌 data-URI（共 +218KB），与 favicon 同为 embed-in-JS、零 asset loader（`src/client/skins/tgcf/wallpapers.js`，头注含源 sha256）。存量旧纹样引用由加载规范化按未知内建键剔除（BAD_ASSET，重选即可）。词典：4 个纹样标签键 → 2 个画作键，「内置纹样」→「内置画作」。§18 声明同步改写；站点图标与飘蝶装饰仍为原创 SVG。壁纸"按主题成对默认"（亮=谢怜/暗=花城）不做——image×single 模型保持，留 1.x。

**v2.5 修订（用户裁决 #8：修改即自动保存）**：实测一周后裁决显式保存的仪式成本（找保存按钮、关闭弹窗确认、脏状态心智）高于其收益，且"保存静默失败"类缺陷（#7）正是显式模型特有的处理盲区。逆转 ADR-0001（ADR-0003）：变更经 400ms 防抖合并为一个 PATCH 自动落库；「保存」「还原」删除；「恢复默认」立即生效并自动保存；五通道脏态确认全部移除（点空白/换肤按钮/Esc/收面板/切目标直接执行）；409 自动 refetch + 重试一次；失败警示条沿用 #7 机制。防抖与弹层解耦（client 全局单例），v2.3"关弹层即冲刷"时序隐患不复存在。与切肤行为对齐：切肤本就点击即生效并持久化，无保存步骤。Y6 语义二次翻转（v2.3 自动 → v2.4 显式 → v2.5 自动）如实记录于 ADR-0003。

**v2.5 修订（用户裁决 #9：齿轮红点移除 + 恢复默认二次确认）**：齿轮红点（有覆写即显示）的渲染依赖组件因其他原因重渲染，出现时机时有时无（实测常需切肤后才出现）——整体移除，任何时候齿轮无红点（`pz-gear-dot` 元素与样式删除）；其"有自定义"提示职能由面板内的「恢复默认」按钮自然承担。同时为「恢复默认」补上影响清单二次确认：弹窗列出当前非默认字段的本地化名称，确认才重置并自动落库，拒绝则分文不动——自动保存模型下这是唯一不可逆的破坏性即时操作，防误触即交互优化。

**v2.5 修订（用户裁决 #10：一级菜单宽度恒定 + 壳宽过渡动画）**：实测点齿轮时一级菜单肉眼可见跳变——窄壳下列宽实为 330px（360 壳宽 − 内边距 28 − 边框 2），宽壳下 flex-basis 360px，菜单自身被撑宽 30px，加上壳右缘瞬间跳开 745px 且无过渡，观感即"大刷新"。修复：窄壳（含 <904px 堆叠态）总宽统一 390px，使左列在两种状态下严格 360px、零重排；壳宽加 200ms ease-out 过渡，与面板既有 200ms 滑入动画合成为连续动效；收回 = 再次点击齿轮（面板列立即卸载，壳宽动画回缩）。JS 左锚点钳制（−1117）仅在触发器远离左缘时介入，侧栏场景不存在左跳。

**v2.5 修订（用户裁决 #11：收回时菜单被拉长）**：#10 的恒宽在展开方向生效，但收回方向仍会拉长——宽类名随齿轮二次点击**瞬间**移除，左列宽度来源随即从 flex-basis 切回 stretch 填充，而壳宽尚在 200ms 动画中（1105→390），左列先被撑到 ~1075px 再随动画缩回。修复：列宽 360px 固定写入基础规则（flex:none），模式类名只改排列方向不改列宽来源；40ms 间隔采样实测收回/展开全程左列恒 360px。

**v2.5 修订（实测问题 #12：展开时一级菜单被焦点滚动弹开）**：展开时面板标题挂载 effect 自动 focus；此刻壳仍处于窄宽、标题暂在右侧溢出区，浏览器为保持焦点可见将壳 `scrollLeft` 推到 25px，一级菜单由 x=29 瞬移到 x=4；壳宽展开后溢出消失、`scrollLeft` 归零，形成“弹掉/弹回”。修复：宽模式标题使用 `focus({ preventScroll: true })`，面板仍获得焦点但不触发中间横滚；<904px 堆叠模式保留普通 focus scroll，确保键盘焦点可达。逐帧实测宽模式展开全程 `scrollLeft=0`、一级菜单 x=29/宽 360px 不变。

**v2.5 修订（实测问题 #13：展开时壳高单帧跳变，一级菜单整体上弹）**：#12 修复后仍有“弹掉”——playwright 逐帧采样显示壳高在类翻转帧**单帧**从 493px 跳到 628px（底锚定，一级菜单内容随顶缘整体上跳 135px），而宽度仍是 390px，随后宽度过渡才开跑：跳变与滑行动离成两个节拍，观感即“弹一下再滑出”。根因：壳高是内容驱动的 auto→auto，`transition:height` 永远不插值，展开/收回两个方向都存在单帧跳变（收回只是恰好与宽度滑动同拍而被掩盖）。修复：`sweepShellHeight`（齿轮切换的提交后、绘制前布局 effect）先把壳高**钉在切换前实测值**（`overflow-y:hidden` 压掉过渡期滚动条），强制重排确立过渡起点后释放到目标高度（`min(内容高, maxHeight 钳制)`），内联 transition 同时声明 `width`+`height`（内联 transition 会**整体替换**样式表的 width-only 规则，漏写宽度会让水平方向瞬移），200ms ease-out 与壳宽同拍；`transitionend` + 260ms 兜底释放内联样式，快速连点/中途关壳由 effect cleanup 复位，reduced-motion 与首开壳（无前值）直接跳过。实测：展开 h=493→558.9→628 随 w=739→993→1105 同帧渐进、无单帧跳变；收回到 493/390；中途打断后内联样式清空、终态精确；面板缩略图加 `decoding:async` 降低动画期解码卡顿。

**v2.5 修订（用户裁决 #14：三滑杆合并为「面板通透度」，范围 0–100，默认 70）**：产品主裁决——面板不透明度/背景模糊/遮罩强度合并为**一个字段**，且旧范围 30–100 在低端仍“看不清壁纸”。根因是壁纸之上叠了三层互相独立的视觉：面板底色 α、遮罩纱（亮暖白/暗墨色，Q35 单值）、壁纸 blur，外加 #root 固定 12px 玻璃雾化——只调透明度动不了其余三层。裁决要点：①**删字段不删视觉**（沿 v2.4.1 #5/Q35 先例）：blur/scrim 字段退役，`project()` 由 panelOpacity 经**过原点线性曲线**联动派生三层——`遮罩 α = round(P×30/82)/100`、`壁纸模糊 = round(P×12/82)px`、`#root 玻璃雾化 = 同模糊曲线`（静态 CSS 改为 `var(--dsh-tgcf-glass-blur)`，经 cssVariables 通道注入）；曲线在 **P=82 处精确复刻旧默认**（遮罩 30/模糊 12），存量用户观感零迁移。②**范围 0–100、默认 70**：移除 schema `min:30` 与渲染层 `Math.max(0.3,…)` 双重下限——P=0 即纯壁纸完全可见（三层全零）；P=70 → 遮罩 26/模糊 10。③**存量退役**：1.0.0 未发布、无外部存量数据，旧 blur/scrim 覆写由 §5.5 加载规范化静默剔除，不做迁移；`panelOpacity` 键名不动（存储兼容），labelKey 改 `personalization.panelTranslucency`（zh「面板通透度」/en Panel translucency）。不设新 ADR：发布前无可逆性损失，ADR-0003 的字段枚举就地修订。

**v2.5 修订（用户裁决 #15：默认通透度降至 10%，侧栏与正文分层）**：产品主实测后两项再校准——①出厂默认 70 → **10**：默认状态即“壁纸清晰可读”，想要更实的前提自己拖；曲线本身不动（P=82 校准点保留，历史观感仍可复现）。②**侧栏与正文区分离**：照搬 openbmc/uefi 两块参考皮肤的既有模式——`--dsh-specific-sidebar-fill` 在 `--dsw-alias-bg-base` 之上加**固定增量**（亮色 +0.05、暗色 +0.17，两参考皮肤完全一致），而非按比例缩放（比例法在低通透度端增量趋零，分层失效）。P=10 时：正文底色 α=0.10，侧栏 α=亮 0.15 / 暗 0.27——菜单文字有足够衬底，正文区与壁纸保持通透；P=100 时增量被 1.0 封顶。侧栏 α 四舍五入到百分位（0.1+0.05 不得印成 0.15000000000000002）。

**v2.5 修订（裁决 #15 补充：侧栏 token 前缀笔误 + 通透度端点契约）**：产品主重启宿主后实测三项——①滑杆调不动菜单区；②默认 10% 下菜单区完全不透；③滑杆到 50% 壁纸已不可读。归因：②③各有一半是 #15 实现笔误——侧栏 token 被误写为 **`--dsh-specific-sidebar-fill`**，而宿主消费的是 **`--dsw-specific-sidebar-fill`**（openbmc/uefi 同名），死键导致侧栏恒为宿主实色 #f9fafb、滑杆自然无效；已改回 dsw 前缀（该键自 e97ad02 起即为 dsw，8270417 引入笔误）。③为真实设计缺陷：线性曲线在 50% 处（α0.5+模糊7px+纱15%）壁纸已不可读，滑杆上半段形同虚设。修正端点契约为**滑杆全程映射完整视觉范围**：P=0 纯壁纸完全透出、P=100 完全遮蔽（α1.0+纱30+模糊12）；纱与模糊改**二次曲线**（30·(P/100)²、12·(P/100)²，玻璃雾化同模糊曲线），中段保持可读（P=50 → 纱8%/模糊3px），底色 α 保持线性即用户所见的百分比。出厂默认仍为 10%（纱0/模糊0/底色0.10/侧栏亮0.15暗0.27）。

**v2.5 修订（用户裁决 #16：深色弹层底色与皮肤色系统一）**：产品主反馈深色下官方与 tgcf 的换肤弹层底色「灰灰的」。实测：弹层底色消费 `--dsw-alias-bg-overlay`，openbmc/uefi 均以自身色系覆盖（深冰蓝 rgba(10,22,32,.88) / 深紫 rgba(27,21,54,.88)），而 tgcf 未覆盖、官方无皮肤可覆盖，双双落到宿主中灰默认 `#61666b`——比官方深色主底 `#151517` 亮一大截，观感发闷。修复：①tgcf `tokenOverrides` 增补 `bg-overlay` 常量对（亮=素白 rgba(255,252,246,.82)、暗=墨黑 rgba(24,16,16,.88)，即 panelBase 族、与 openbmc「浮层较实」结构一致）；②官方深色下由换肤器自身 CSS 提供深炭色弹层 `rgba(41,42,44,.97)`——作用域 `body[data-ds-dark-theme]:not([各皮肤 attr])`，只在无皮肤挂载时生效，皮肤态的 token 驱动不受影响（注意 uefi 的 body 属性是 `data-dsh-uefi-harness`，无 `-skin` 后缀）。

## 20. 终审记录

Q1–Q34（产品）→ v1 → v2 → v2.1 → v2.2（三轮差异复核）→ v2.3（实现评审修订：backdrop 接口形状 §3a、§9a 获批）→ **v2.4（精简轮：Q35–Q53 产品裁决 + ADR-0001/0002 + 计划三轮评审放行）**。实现评审 13 红项、N1/N2、N3 全部闭合；精简轮按 T0–T8 交付，每 commit check 绿色，活 GUI gate 8/8 通过。

## 21. 对二轮评审的异议记录

1. **Y2 animated GIF（三轮更新）**：功能裁决（GIF 允许）维持，但**撤回"浏览器内存压力是单帧的"技术论断**——评审引用的 Chromium 解码器修改（按帧内存 × 缓存帧数计算、超限才 purge）证明该断言不成立。已改为显式风险接受措辞，并采纳其低成本加固选项：**GIF maxPixels 收紧为 12MP**（覆盖 4K 静帧 8.3MP，最坏单帧解码内存 ~48MB RGBA）；帧数/总动画像素预算列为升级路径。
2. **掉电措辞**：采纳评审的诚实上限表述（"配置未必可恢复、blob 保留可重挂"），**未采纳** last-known-good 备份进 1.0.0——以范围控制优先，LKG 已登记为升级路径；如评审认为 LKG 应进 1.0.0 请明示，属加法而非翻案。
3. 其余全部采纳；历史轮次的选项内选择（UUID 去连字符、dataset camelCase、仓内原子写、自动建 Release）不变。
