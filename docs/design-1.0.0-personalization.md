# dsh-skins 1.0.0 设计文档 v2.3：声明式个性化框架 + 「天官赐福 · 百无禁忌」皮肤

> 状态：**v2.3**（实现评审修订）。产品决策树（Q1–Q34）与架构不变；v2.2 契约之外，本版记录两项经实现评审确认的修订：SkinEffects backdrop 接口形状（§3a）与旧皮肤 scrim 字段偏差（§9a，待产品负责人批准）。
> 版本目标：单版本 **1.0.0** 全量交付，每个 commit 保持 `pnpm run check` 绿色；发布流程见 §16（preflight → tag → tag workflow → Release）。

---

## 0. 决策记录（增量）

| 领域 | 决策 |
|---|---|
| 资产 ID | `u_` + `randomUUID().replaceAll("-","")`（32 hex），与全部正则统一（R1） |
| bodyAttr | `dshTgcfSkin`（沿用现有 camelCase dataset 契约，零 runtime 改动；派生属性 `data-dsh-tgcf-skin`）（R2.3） |
| titleBrand | 存储值 `天官赐福`（**不含分隔符**；` — ` 归 runtime 所有）（R2.4） |
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
| ZIP | store-only + 全部结构约束（单盘/单 EOCD/偏移区间/防溢出/manifest ≤256KB/流式有界读取）（Y1） |
| 发布流程 | preflight CI → 打 tag → tag workflow 复验 → job 级 `contents: write` 自动建 Release（Y7） |

---

## 1. 模块划分（四大 seam，职责已裁决）

| 模块 | 职责（裁决后） |
|---|---|
| `PersonalizationCatalog`<br>`src/shared/personalization/catalog.js` | 纯数据：字段元数据（type/scope/约束/labelKey/option values+labelKeys/builtin 资产登记）、`defaultsFor`、`validateOverride(skinId,key,value,assetMeta?)`、`listAssetFields` |
| `PersonalizationStore`<br>`src/host/personalization/store.js` | revision、串行队列、原子状态提交（复用提取后的 `atomicWriteText`）、staging、GC、恢复安全模式、unknown 保留、导入事务、image 字段级再校验 |
| `SkinProjector`<br>`src/client/personalization/projector.js` | **投影管道唯一入口** `projectSkin(skin, rawValues, assetResolver)`：① 调用 catalog 提供的**纯 merge/校验函数**合成 默认值+覆写 ② assetResolver 解析引用（builtin 编译期表 / `/dsh-skins/assets/…` URL）③ 调 `skin.project(normalized, resolvedAssets)` 得业务映射 ④ 校验并冻结 SkinEffects shape ⑤ 失败按三层回退语义处理（§3）。零 DOM |
| `SkinEffectsRuntime`<br>`src/client/runtime.js` 扩展 | 唯一 DOM 触点：执行/清理 SkinEffects、`overrideTokens()` disposer、`updateActive()` 热更新、事务化 mount |

裁决要点：皮肤工厂的 `project()` 只做"值 → 效果"业务映射，不 merge、不解析资产、不碰 DOM、不知道存储；**merge/校验规则由 catalog 以纯函数提供，由 projector 调用执行**；资产解析在 projector 调 assetResolver；回退由 projector 按三层语义统一处理。panel 与 config-client 不理解字段业务含义。

## 2. 字段值模型（type × scope）

同 v2（type：`text/color/image/select/range`；scope：`single/locale/colorScheme`；合法组合不变）。补充冻结：

- **LWW 字段粒度 = 整个 scope 对象**：`slogan:{zh,en}` 是一个字段、`accent:{light,dark}` 是一个字段；Client 提交必须携带完整对象，Host 不做子键隐式合并
- **全局 revision 覆盖一切可见状态提交**：config PATCH、上传、删除、导入 commit 全部递增同一全局 revision（导入 baseRevision 因此对 library 变化也敏感）

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
  titleBrand: string | null,           // 可选；不含分隔符；null = 不覆写
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

- **ID 正则全文统一**：`^u_[0-9a-f]{32}$`；生成 `"u_" + randomUUID().replaceAll("-", "")`；DELETE suffix、assets GET suffix、state validator、ZIP manifest 资产映射、config image 引用、GC、测试语料全部使用同一正则常量（catalog 导出）
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

## 6. image 字段执行点（R6）

`AssetMeta`（state.library 值）：`{ id, displayName, mime, extension, byteLength, width, height, sha256, createdAt }`（上传时魔数+免解码尺寸解析写入，作为可信元数据）。

image 字段 schema 追加：`{ allowedUserMime[], maxBytes, maxWidth, maxHeight, maxPixels }`。`maxPixels` 语义：40MP 是**所有入库资产的 全局 ingest 不变量**，字段级 `maxPixels` 只能在其下收紧（wallpaper 沿用 40MP；favicon 512×512=0.26MP；**GIF 含动画统一 12MP**——覆盖 4K 静帧 8.3MP，同时把最坏单帧解码内存压到 ~48MB RGBA）。

Store 在以下路径用 `state.library[id]` 的 AssetMeta **再校验**（不只验 id 形状）：config PATCH、导入 prepare/commit、re-id 映射后；并校验资产存在（DELETE 后到达的并发 PATCH → `ASSET_NOT_FOUND`，不写入悬空引用）。reset/fallback 不需要。

builtin 资产规则：`allowedUserMime` 永不含 SVG；builtin SVG 仅经编译期 catalog 登记（可信通道）；builtin 引用必须属于**当前皮肤**已登记 asset key，禁止 `builtin:<他皮肤>:…` 交叉引用；user 引用只能是已存在的 `u_…`。

## 7. Client

### 7.1 启动状态机（R3，修正）

config client 四态：`loading / synced / offline-failed / unsupported-readonly`。

- `loading`：面板可预览但**禁止持久化**（控件禁用 + "同步中"标识）
- `offline-failed`：显示"配置尚未同步" + 重试按钮；任何写入被拒；绝不标"已保存"
- `unsupported-readonly`：可查看不可写
- 仅 `synced` 发 PATCH；fetch 晚到时本地 dirty preview 字段不被覆盖；关闭面板 flush 只提交基于已同步快照产生的 ops；请求序号防乱序；dispose 后到达响应丢弃；fetch 晚到但已切肤 → 丢弃

runtime：`updateActive(values)` 热更新专用入口（不复用 select）；mount 事务化——每效果应用前校验、`try/catch` 失败逆序清理已注册 disposer；替换新 effects 失败 → 恢复上一份已知有效 effects；测试覆盖第 N 个效果抛错前 N−1 个全清理、非法 token/favicon/background 中途失败。

### 7.2 事件 / 面板（同 v2）

`dsh-skins:active-changed` / `dsh-skins:config-changed` + BroadcastChannel + focus 兜底；面板 a11y 与保存语义同 v2。

## 8. ZIP 结构约束（Y1 全收）

store-only 基础上追加：单磁盘（disk number 必须为 0）；恰好一个 EOCD 且条目数 = 实际 central entries；central directory offset/size 必须在文件范围内；local data 区间互不重叠且不得侵入 central directory；method 0 下 compressed size == uncompressed size；所有 offset+size 防整数溢出检查；恰好一个 `manifest.json` 且 ≤256KB；entry extra field 与 archive comment 一律拒绝；不允许 trailing payload；实现先限长流式写 staging 再按有界 entry 读取（不整包常驻内存）。

图片规则（Y2 裁决，三轮措辞修正）：WebP 尺寸解析覆盖 **VP8X / `VP8 ` / VP8L 三种 chunk**；**animated WebP（ANIM flag）1.0.0 拒绝**（`ANIMATION_UNSUPPORTED`）；**animated GIF 允许**——风险接受表述：浏览器 GIF 解码器通常有解码缓存与内存上限保护（如 Chromium 按"帧内存 × 缓存帧数"计算并超限 purge），但**不承诺单帧内存模型**；1.0.0 以文件大小 20MB、GIF maxPixels 12MP、客户端分页 24/页、lazy loading 控制风险，**接受复杂动画仍可能造成 CPU/内存压力**；出现实际问题后增加帧数或总动画像素预算（升级路径已登记）。

## 9. 导入事务幂等（Y6）

prepare token 状态机：`prepared → committed`（保存 result 供重试）`/ expired`。同一 token + 相同参数重试 → 返回同一 result（网络重试幂等）；同 token 不同参数 → 409；TTL 后 → 410。commit 经 store 串行队列 + baseRevision 校验。

## 9a. v2.3 待批偏差：旧皮肤仅开放壁纸字段

v2.2 §9 要求 openbmc/uefi-harness 开放 wallpaper + scrim 两字段。实现中 scrim 为
range×colorScheme 数字概念，而旧皮肤的"遮罩"是烘焙进 art 的渐变字符串——实现数字 scrim
无法同时满足「与 0.6.0 行为逐字节等价」的更强约束。取舍：**旧皮肤仅开放 wallpaper 字段**
（scrim 字段只属于 tgcf）。

**已获产品负责人批准**（第三轮复审后，2025）：「旧皮肤仅开放壁纸字段」为正式决策，
README 双语表述即为终态，实现评审方同轮给出批准建议。§15 DoD 对应项按此执行。

## 10. tgcf 完整 catalog 表（R6.4，冻结）

皮肤 id `tgcf`；bodyAttr `dshTgcfSkin`（CSS 作用域 `body[data-dsh-tgcf-skin]`）；label zh「天官赐福 · 百无禁忌」en「Heaven Official's Blessing」。

| key | type×scope | 约束 | 出厂默认 | labelKey | 投影目标 |
|---|---|---|---|---|---|
| wallpaper | image×single | allowedUserMime: png/jpeg/webp/gif；≤20MB；maxPixels 40MP（GIF 12MP）；builtin 页签四选 | `builtin:tgcf:lanterns` | f.wallpaper | backdrop.image |
| favicon | image×single | allowedUserMime: png/jpeg/webp/gif；≤1MB；≤512×512 | `builtin:tgcf:lantern-favicon` | f.favicon | favicon |
| slogan | text×locale | maxLength 40 | {zh:"千灯引路 · 长夜同明", en:"A thousand lights before the dawn"} | f.slogan | slogans |
| titleBrand | text×single | maxLength 24 | "天官赐福"（无分隔符） | f.titleBrand | titleBrand |
| accent | color×colorScheme | hex | {light:"#C3272B", dark:"#E0564A"} | f.accent | tokenOverrides |
| gold | color×colorScheme | hex | {light:"#C9A227", dark:"#D4AF37"} | f.gold | tokenOverrides |
| bubbleColor | color×colorScheme | hex | {light:"#C3272B", dark:"#8E2A2F"} | f.bubble | tokenOverrides[`--dsw-specific-bubble`] |
| panelOpacity | range×single | 30–100, step 1, unit % | 82 | f.panelOpacity | cssVariables(rgba 派生) |
| blur | range×single | 0–24, step 1, unit px | 12 | f.blur | backdrop.blur |
| scrim | range×colorScheme | 0–100, step 1, unit % | {light:18, dark:42} | f.scrim | backdrop.scrim |

builtin 资产登记：`lanterns`（祥云灯笼阵，默认壁纸）、`butterflies`（银蝶群）、`mountains`（金线山水）、`maples`（红枫落雨）、`lantern-favicon`（红灯笼 favicon，SVG，仅 builtin）。motif select 已删除（Y10）。所有 labelKey 与 option 文案进 dicts.js 双语键集测试。动效（呼吸/光晕/漂浮）不设字段，随皮肤 staticCss 常开，`prefers-reduced-motion` 停。

旧皮肤：`openbmc`（bodyAttr `dshOpenbmcSkin` 不变）与 `uefi-harness`（`dshUefiHarness`）各加 wallpaper + scrim 字段，默认=现状；**默认投影必须与 0.6.0 行为逐字节等价**（列入兼容测试）。

## 11. Corner cases 清单（v2 基础上修订）

v2 的 13 条保留，修订：3（碰撞：高熵 + exclusive create + 重试，跨命名空间结构隔离）；8（孤儿 blob 仅在非恢复态下 GC，存活=library 成员）；9（损坏→恢复分支 A，不破坏性 GC；版本过新→分支 B 零写入）；13（ZIP 结构约束全集 §8）。新增：14 掉电上限=state 丢失且配置未必可恢复、blob 保留可重挂（5.2/5.3）；15 未同步面板禁止持久化（7.1）；16 favicon 字段级约束执行点（6）；17 导入 commit 网络重试幂等（9）；18 state 缺失但 assets 非空 → 恢复分支（5.3）；19 三层回退语义（§3）；20 staticCss 预作用域、用户值禁入 CSS 文本（§3）。

## 12. 测试计划（Y5 全收）

在 v2 矩阵上追加：

- `tests/config-client.test.mjs`：四态状态机全迁移、fetch 晚到×切肤/dispose/乱序、dirty preview 保护、unsupported 只读、BroadcastChannel 去回声
- runtime：`updateActive` 同 id 热更新、第 N 效果失败前 N−1 全清理、替换失败恢复旧 effects、bodyAttr 实际 DOM 属性、title 无双分隔符
- 兼容：openbmc/uefi 默认投影 ≡ 0.6.0、export→import roundtrip、state 损坏后 assets 数量不减、unsupported configVersion 后 assets 数量不减、库中未引用图片不被 GC、UUID 生成值与全部正则一致
- `smoke-test.cjs` 重构：children 位置断言改语义节点定位（加齿轮/二级面板不致脆断）
- ZIP：§8 结构约束逐条攻击语料
- capture-previews 输出名参数化（`--skin tgcf` 不再覆盖 openbmc 图）
- 恢复模式分支测试（三轮 R）：分支 A（损坏/空/缺失+assets 非空）断言 quarantine 仅登记不移动、恢复提交前 assets 数量不减；分支 B（configVersion 过新）断言零写入——文件 mtime/目录结构不变；`state.json` 缺失+assets 非空 ≠ 首次初始化
- 三层回退测试（三轮 Y1）：非法 override 只回退该字段；projector/skin.project 抛错整套 defaults-only；defaults-only 失败 fail-closed 恢复上一套 effects / 首挂回退 official

## 13. 浏览器验收（Y4，事实修正后）

**承认 v2 事实错误**：仓库已有 `playwright-core@1.62.1`（devDependencies）且 `capture-previews.mjs` 已驱动 headless Chromium。修正表述：**仓库已有 Playwright 驱动与截图脚本，但 CI 无 DSH GUI/浏览器编排；1.0.0 不把完整 E2E 纳入 CI，以本地半自动 release gate 替代**。零新增依赖扩展本地脚本断言：齿轮键盘可达、focus 进出、favicon 换装、reduced-motion、旧皮肤默认投影等价、双标签页同步、导入 preview/commit、0.6.0→1.0.0 升级路径。gate 写明步骤/期望/失败即禁发/执行证据留存。

## 14. CI 与发布（Y7 修正）

1. 普通 CI（push/PR）：check + lib 零 diff + pack + 版本校验脚本（提取为 `scripts/verify-release.mjs`，tag 前即可本地/CI 预跑）
2. 打 `v1.0.0` tag
3. tag workflow（`refs/tags/v*`）：`GITHUB_REF_NAME === "v"+version` → check → lib 零 diff → pack → 产物解包最小 host 加载测试 → **job 级 `permissions: contents: write` 自动创建 Release**；失败不建 Release 并删除错误 tag

## 15. DoD（v2 12 项 + 二轮 15 项，全列）

- [ ] 每字段唯一规范持久化形状（type×scope）
- [ ] Host/Client 共用 catalog 事实源
- [ ] 未知字段经读写/reset/删除/导入后按约定保留
- [ ] 两标签页独立字段并发编辑不互相覆盖
- [ ] 删除/导入任一步骤崩溃可恢复（故障注入）
- [ ] 主题包全约束 + 图片复用上传校验器
- [ ] 切肤/回官方/热更新/dispose 无 token/DOM 残留
- [ ] favicon 字段实现于 tgcf
- [ ] `openbmc` id 全文一致
- [ ] node 单测 + host 集成 + 本地半自动 gate 全过
- [ ] tag/version/Release/repo identity 一致
- [ ] `u_` ID 生成与 DELETE/assets/config/ZIP 正则完全一致
- [ ] tgcf body attribute 真实 Chromium mount/unmount 不抛错
- [ ] titleBrand 不含 runtime 分隔符
- [ ] SkinEffects shape 与失败回滚语义冻结并有测试
- [ ] config 未同步时不允许持久化默认值
- [ ] state 损坏或版本过新时绝不执行破坏性 GC
- [ ] GC 存活 = library entry 而非皮肤引用
- [ ] 原子写为仓内共享模块；掉电承诺不超出 rename 语义
- [ ] image PATCH 按 AssetMeta 执行字段级约束
- [ ] builtin SVG 与 user SVG 规则互不冲突
- [ ] manifest 独立大小上限；ZIP offsets/区间全验证
- [ ] WebP VP8/VP8L/VP8X 全覆盖
- [ ] 导入 commit 网络重试幂等
- [ ] 启动状态机四类乱序守卫有自动测试
- [ ] 恢复模式两分支独立测试：损坏态 quarantine 不物理移动；版本过新态严格零写入
- [ ] 三层回退语义有区分性断言（字段默认/null/defaults-only/fail-closed 四态可辨）
- [ ] staticCss 由皮肤预作用域；用户值不进入任何 CSS 文本拼接
- [ ] image schema 含 maxPixels；GIF 12MP 生效并有测试

## 16. 实施顺序（v2 十步微调）

1. 冻结契约：type×scope / revision / catalog 全表 / SkinEffects / 恢复语义
2. 纯模块红测试：catalog、merge、projector、引用分析（含 AssetMeta 再校验）
3. Store：revision、串行化、原子提交（提取 atomic-write）、GC、恢复安全模式、故障注入
4. Host routes：信任栅、exact/prefix、body/磁盘/图片校验、错误码
5. Client config 状态机：四态、序号守卫、BroadcastChannel
6. 通用面板 + 交互测试（smoke 语义化重构）
7. tgcf / openbmc / uefi-harness 接入（含兼容等价测试）
8. store-only ZIP + 结构约束攻击语料
9. 半自动 gate 脚本扩展、截图参数化、双语文档
10. verify-release 脚本 + tag workflow → preflight → `v1.0.0`

## 17. 不做清单（v2 + 增补）

v1/v2 条目保留。增补：掉电级 fsync durability（分层防御替代）、animated WebP（GIF 允许，§8）、motif 独立字段（并入壁纸 builtin 页签）、完整 E2E 进 CI（本地半自动 gate 替代，CI 编排留 1.x）、**主题包请求体流式落盘 + 增量 ZIP 解析（实现评审 Y1，部分采纳）**——本机单用户 + 80MB 硬上限已界定最坏内存；已做 prepare token 瘦身与 committed token TTL 驱逐消除无界驻留；多用户/远端部署场景出现时必须重做为流式。

## 18. 商标与非关联声明（同 v2）

README 双语非官方声明；发布前用户终审名称（中性备选「千灯 · 朱红鎏金」）。

## 19. v2 → v2.1 变更一览

R1 UUID 去连字符统一；R2 SkinEffects 冻结+分层裁决+`dshTgcfSkin`+titleBrand 无分隔符+`updateActive` 事务化；R3 四态状态机；R4 恢复安全模式+GC 存活定义；R5 仓内 atomic-write 归属修正+durability 范围；R6 AssetMeta 执行点+builtin 规则+labelKey+tgcf 全表；PATCH 两补充；Y1 ZIP 结构约束；Y2 WebP 三 chunk+动画裁决；Y3 filename 编码；Y4 事实修正+半自动 gate；Y5 测试增补；Y6 导入幂等；Y7 发布时序修正；Y8 private 缓存；Y9 磁盘硬阈值；Y10 motif 删除。

**v2.1 → v2.2（三轮差异复核）**：恢复模式拆两分支（损坏恢复 / 版本过新零写入）+ state 缺失且 assets 非空进恢复；掉电上限措辞改为"配置未必可恢复、blob 保留"；三层回退语义冻结；staticCss 改皮肤预作用域；image schema 增 maxPixels（GIF 12MP）；GIF 风险措辞按评审纠正；merge 措辞统一（catalog 纯函数、projector 执行）。

**v2.3 增补（实现评审第二轮 N1/N2）**：runtime 挂载改回 teardown-first（共享节点身份下 build-then-swap 会拆毁活动皮肤——生产每次加载必触发的发布级回归），失败恢复 = 纯函数重投影旧皮肤；styleTag 复用必刷新内容；readStateFile 在 shape 校验前先做 configVersion 探测（shape 变化的未来版 → unsupported 零写入）；contextActive 接入 runtime.active；齿轮补 DOM id；verify-release 在 CI 锚定 GITHUB_REPOSITORY；Y1 登记入 §17；发版手工清单落为 `docs/release-checklist-1.0.0.md`（含 README 截图、双标签页、升级演练等 tag 前置条件）。

## 20. 终审记录

Q1–Q34（产品）→ v1 → v2 → v2.1 → v2.2（三轮差异复核）→ **v2.3（实现评审修订：backdrop 接口形状 §3a、旧皮肤 scrim 偏差 §9a 待批）**。实现评审的 13 项红项已全部修复并附回归测试；第二轮 N1/N2 与第三轮 N3 亦闭合；§9a 偏差于第三轮复审后获产品负责人正式批准。

## 21. 对二轮评审的异议记录

1. **Y2 animated GIF（三轮更新）**：功能裁决（GIF 允许）维持，但**撤回"浏览器内存压力是单帧的"技术论断**——评审引用的 Chromium 解码器修改（按帧内存 × 缓存帧数计算、超限才 purge）证明该断言不成立。已改为显式风险接受措辞，并采纳其低成本加固选项：**GIF maxPixels 收紧为 12MP**（覆盖 4K 静帧 8.3MP，最坏单帧解码内存 ~48MB RGBA）；帧数/总动画像素预算列为升级路径。
2. **掉电措辞**：采纳评审的诚实上限表述（"配置未必可恢复、blob 保留可重挂"），**未采纳** last-known-good 备份进 1.0.0——以范围控制优先，LKG 已登记为升级路径；如评审认为 LKG 应进 1.0.0 请明示，属加法而非翻案。
3. 其余全部采纳；历史轮次的选项内选择（UUID 去连字符、dataset camelCase、仓内原子写、自动建 Release）不变。
