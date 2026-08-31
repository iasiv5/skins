# dsh-skins 1.0.0 设计文档 v2.4.1：声明式个性化框架（精简版）+ 「天官赐福 · 百无禁忌」皮肤

> 状态：**v2.4.1**（精简轮 v2.4 + 实测修订 #1）。v2.4（Q35–Q53 + 三轮计划评审）记录五项产品裁决：字段精简与 scrim 单值化（§10）、显式保存模型（§7.1，ADR-0001）、主题包机制移除（§8/§9 → §17，ADR-0002）、加载时存量规范化（§5.5）、粘连外壳与五通道脏态确认（§7.2）。v2.4.1 修订 §7.2：面板展开时点皮肤**卡片** = 面板目标随行切换（取代 Q48 的"仅切肤"半则，§19）。v2.3 的 SkinEffects 接口形状（§3a）与 §9a 决策不变。
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
| ZIP | ~~store-only + 全部结构约束（Y1）~~ **经 ADR-0002 随主题包移除（v2.4）** |
| 发布流程 | preflight CI → 打 tag → tag workflow 复验 → job 级 `contents: write` 自动建 Release（Y7） |
| 显式保存 | 编辑仅本地预览，「保存」是唯一落库路径；「还原」清预览层（离线可用）；离开编辑面的五条通道统一脏态确认（Q37–Q41/Q49，ADR-0001） |
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

### 7.1 启动状态机与显式保存模型（v2.4，ADR-0001）

config client 四态不变：`loading / synced / offline-failed / unsupported-readonly`。

- `loading`：面板可预览但**禁止持久化**（控件禁用 + "同步中"标识）
- `offline-failed`：显示"配置尚未同步" + 重试按钮；保存/上传/删除被拒；绝不标"已保存"；**「还原」离线可用**（纯本地操作）
- `unsupported-readonly`：可查看不可写
- **保存语义（v2.3 的 400ms 防抖自动落库与"关弹层即冲刷"整体废除）**：`preview/previewReset` 只写本地预览层并即时投影；「保存」(`flushNow`) 是唯一写路径；「还原」(`restore`) 清空预览层回到已同步值；离开编辑面的五条通道（点空白 / 换肤按钮 / Esc / 齿轮收面板 / 面板目标切换）统一 `dirtyLeave` 确认，同意 = `restore()` 丢弃后继续原动作，拒绝 = 状态原样保持（守卫在 `runtime.select` 之前）
- 409 分 flavor：`STORE_READONLY` → 只读降级且不 refetch；revision 冲突 → 先 refetch（预览保留、revision 更新）再返回冲突，用户再点保存即以新 baseRevision 提交；冲突横幅仅 `synced` 态渲染
- fetch 晚到时本地 dirty preview 字段不被覆盖；请求序号防乱序；dispose 后到达响应丢弃；fetch 晚到但已切肤 → 丢弃

runtime：`updateActive(values)` 热更新专用入口（不复用 select）；mount 事务化——每效果应用前校验、`try/catch` 失败逆序清理已注册 disposer；替换新 effects 失败 → 恢复上一份已知有效 effects；测试覆盖第 N 个效果抛错前 N−1 个全清理、非法 token/favicon/background 中途失败。

### 7.2 事件 / 粘连外壳 / 面板（v2.4 重写）

`dsh-skins:active-changed` / `dsh-skins:config-changed` + BroadcastChannel + focus 兜底不变。

- **粘连外壳（Q44/Q46）**：换肤弹层升级为单一 dialog：左列 `.dsh-skins-pop-main`（360px，外观 + 皮肤列表 + 更新栏）+ 右列 `.dsh-skins-pz-panel`（520px，`role=region`）；总宽 `min(880px, 100vw-24px)`；**视口 <904px 上下堆叠**（壳关闭三通道 + 面板收起/目标切换，合计五条脏态确认通道）。面板滑入 200ms ease-out，`prefers-reduced-motion` 直接呈现；关闭无出场动画。
- **面板（Q47/Q50/Q51）**：壁纸为唯一合并区（内置精选 + 我的图片同网格、角标删除、上传、清空图库带影响清单确认——确认文案列全部受影响 `皮肤 · 字段` 与不可恢复警示，首个失败即停并刷新剩余）；底部固定操作条 `position:sticky`：状态簇（同步中/离线+重试/只读/恢复模式/冲突[仅 synced]/未保存计数）在左，「恢复默认」「还原」「保存」在右；无「返回」按钮、无主题包 UI。
- 卡片点击 = 切换当前皮肤；**面板展开时**点卡片 = 面板目标随行切换（目标皮肤不可个性化则经同一确认收起面板），脏态确认守卫置于 `runtime.select` 之前（**v2.4.1 修订**，取代 Q48 的"仅切肤"半则）；面板收起时点卡片 = 仅切肤（预览层必空，无需确认）。齿轮点击 = 展开或收起面板目标。焦点：面板展开→面板标题；壳关闭→换肤按钮（齿轮随壳卸载）；齿轮收面板→焦点还齿轮。不变式：面板展开期间**面板目标 ≡ 当前皮肤**（不存在 active=B/面板=A 半态）。

## 8. ZIP 结构约束（**经 ADR-0002 移除**）

本节所述 store-only ZIP 机制已随主题包整体移除（v2.4，§17/ADR-0002）；原文归档于 git 历史（v2.3）。

## 9. 导入事务幂等（**经 ADR-0002 移除**）

同上：导入令牌状态机已删除；原文归档于 v2.3 历史。

## 10. tgcf 完整 catalog 表（R6.4，冻结）

皮肤 id `tgcf`；bodyAttr `dshTgcfSkin`（CSS 作用域 `body[data-dsh-tgcf-skin]`）；label zh「天官赐福 · 百无禁忌」en「Heaven Official's Blessing」。

| key | type×scope | 约束 | 出厂默认 | labelKey | 投影目标 |
|---|---|---|---|---|---|
| wallpaper | image×single | allowedUserMime: png/jpeg/webp/gif；≤20MB；maxPixels 40MP（GIF 12MP）；builtin 页签四选 | `builtin:tgcf:lanterns` | f.wallpaper | backdrop.image |
| slogan | text×locale | maxLength 40 | {zh:"千灯引路 · 长夜同明", en:"A thousand lights before the dawn"} | f.slogan | slogans |
| titleBrand | text×single | maxLength 24 | "天官赐福"（无分隔符） | f.titleBrand | titleBrand |
| panelOpacity | range×single | 30–100, step 1, unit % | 82 | f.panelOpacity | tokenOverrides(bg-base/sidebar-fill, rgba 派生) |
| blur | range×single | 0–24, step 1, unit px | 12 | f.blur | backdrop.blur |
| scrim | range×single | 0–100, step 1, unit % | **30**（单值，亮暗同 α） | f.scrim | backdrop.overlayLight/Dark（单 α 双基色） |

**v2.4 精简注记（Q35）**：favicon/accent/gold/bubbleColor 四字段删除。皮肤视觉身份不随之丢失——tgcf `project()` 将原 catalog 默认值（brand-primary #C3272B/#E0564A、鎏金 #C9A227/#D4AF37、气泡 #C3272B/#8E2A2F、灯笼 favicon）静态烘焙为皮肤常量；SkinEffects 契约（§3/§3a）不变。

builtin 资产登记：`lanterns`（祥云灯笼阵，默认壁纸）、`butterflies`（银蝶群）、`mountains`（金线山水）、`maples`（红枫落雨）、`lantern-favicon`（红灯笼 favicon，SVG，仅 builtin、静态引用）。motif select 已删除（Y10）。所有 labelKey 与 option 文案进 dicts.js 双语键集测试。动效（呼吸/光晕/漂浮）不设字段，随皮肤 staticCss 常开，`prefers-reduced-motion` 停。

旧皮肤：`openbmc`（bodyAttr `dshOpenbmcSkin` 不变）与 `uefi-harness`（`dshUefiHarness`）仅开放 wallpaper 字段（§9a 终态）；**默认投影必须与 0.6.0 行为逐字节等价**（列入兼容测试）。

## 11. Corner cases 清单（v2 基础上修订）

v2 的 13 条保留，修订：3（碰撞：高熵 + exclusive create + 重试，跨命名空间结构隔离）；8（孤儿 blob 仅在非恢复态下 GC，存活=library 成员）；9（损坏→恢复分支 A，不破坏性 GC；版本过新→分支 B 零写入）。新增：14 掉电上限=state 丢失且配置未必可恢复、blob 保留可重挂（5.2/5.3）；15 未同步面板禁止持久化（7.1）；18 state 缺失但 assets 非空 → 恢复分支（5.3）；19 三层回退语义（§3）；20 staticCss 预作用域、用户值禁入 CSS 文本（§3）；21 加载时存量规范化仅 normal 态执行、剔除即 revision+1（5.5）；22 五通道脏态确认守卫先于 runtime.select（7.2）。【v2.4 删除：13 ZIP 结构约束、16 favicon 字段级约束、17 导入幂等——随主题包机制移除（ADR-0002）】

## 12. 测试计划（Y5 全收）

在 v2 矩阵上追加：

- `tests/config-client.test.mjs`：四态状态机全迁移、fetch 晚到×切肤/dispose/乱序、dirty preview 保护、unsupported 只读、BroadcastChannel 去回声；**v2.4**：无保存不发 PATCH、restore 清预览、409 双 flavor（readonly 不 refetch / revision 冲突 refetch 后重试成功）
- runtime：`updateActive` 同 id 热更新、第 N 效果失败前 N−1 全清理、替换失败恢复旧 effects、bodyAttr 实际 DOM 属性、title 无双分隔符
- 兼容：openbmc/uefi 默认投影 ≡ 0.6.0、state 损坏后 assets 数量不减、unsupported configVersion 后 assets 数量不减、库中未引用图片不被 GC、UUID 生成值与全部正则一致
- `smoke-test.cjs` 重构：children 位置断言改语义节点定位（v2.4 再降入 `.dsh-skins-pop-main`）
- **v2.4**：`tests/fake-react.mjs` 共享桩（持久 hook 帧/deps-aware effect/useCallback 记忆化/ref 接线）；`tests/personalization-panel.test.mjs` 走面板公开路径（3 皮肤×双态、保存/还原/清空图库/仅 synced 冲突横幅）；`tests/sidebar-switcher.test.mjs` 走五通道公开路径（含拒绝分支 active 不变、R1 无 PATCH 断言）；store 加载规范化三分支（剔除+落盘 / 干净零写入 / 恢复与未来版零写入）
- capture-previews 输出名参数化（`--skin tgcf` 不再覆盖 openbmc 图）；**v2.4 gate**：保存流持久化证据 + 恢复默认清理步 + 静态 favicon
- 恢复模式分支测试（三轮 R）：分支 A（损坏/空/缺失+assets 非空）断言 quarantine 仅登记不移动、恢复提交前 assets 数量不减；分支 B（configVersion 过新）断言零写入——文件 mtime/目录结构不变；`state.json` 缺失+assets 非空 ≠ 首次初始化
- 三层回退测试（三轮 Y1）：非法 override 只回退该字段；projector/skin.project 抛错整套 defaults-only；defaults-only 失败 fail-closed 恢复上一套 effects / 首挂回退 official

## 13. 浏览器验收（Y4，事实修正后）

**承认 v2 事实错误**：仓库已有 `playwright-core@1.62.1`（devDependencies）且 `capture-previews.mjs` 已驱动 headless Chromium。修正表述：**仓库已有 Playwright 驱动与截图脚本，但 CI 无 DSH GUI/浏览器编排；1.0.0 不把完整 E2E 纳入 CI，以本地半自动 release gate 替代**。零新增依赖扩展本地脚本断言：齿轮键盘可达、面板粘连展开、Esc 整壳关闭、**保存→换装→刷新持久→恢复默认→保存→复原（显式保存流证据 + 无残留清理）**、静态 favicon、reduced-motion、旧皮肤默认投影等价、双标签页同步、0.6.0→1.0.0 升级路径（加载规范化演练）。gate 写明步骤/期望/失败即禁发/执行证据留存。

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
- [ ] 显式保存流端到端：预览不落库、保存唯一写路径、五通道脏态确认、还原离线可用、409 双 flavor（ADR-0001）
- [ ] 清空图库确认列全量影响清单，首个失败即停并刷新剩余
- [ ] `openbmc` id 全文一致
- [ ] node 单测 + host 集成 + 本地半自动 gate 全过
- [ ] tag/version/Release/repo identity 一致
- [ ] `u_` ID 生成与 DELETE/assets/config 正则完全一致
- [ ] tgcf body attribute 真实 Chromium mount/unmount 不抛错
- [ ] titleBrand 不含 runtime 分隔符
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

v1/v2 条目保留。增补：掉电级 fsync durability（分层防御替代）、animated WebP（GIF 允许，§8→已移除）、motif 独立字段（并入壁纸 builtin 页签）、完整 E2E 进 CI（本地半自动 gate 替代，CI 编排留 1.x）。**v2.4 增补**：主题包机制整体移除（§8/§9 原文归档 v2.3 历史，ADR-0002；含其流式落盘升级路径——多用户/分享场景重现时须重新设计评审而非复活旧实现）、拖拽上传、壁纸填充方式（cover/contain/fill）、壁纸位置（上/中/下）、显示/隐藏壁纸开关、多文件同时上传（Q43 裁决不做；参考实现 dsh-custom-skin 有之，本插件保持精简）。

## 18. 商标与非关联声明（同 v2）

README 双语非官方声明；发布前用户终审名称（中性备选「千灯 · 朱红鎏金」）。

## 19. v2 → v2.1 变更一览

R1 UUID 去连字符统一；R2 SkinEffects 冻结+分层裁决+`dshTgcfSkin`+titleBrand 无分隔符+`updateActive` 事务化；R3 四态状态机；R4 恢复安全模式+GC 存活定义；R5 仓内 atomic-write 归属修正+durability 范围；R6 AssetMeta 执行点+builtin 规则+labelKey+tgcf 全表；PATCH 两补充；Y1 ZIP 结构约束；Y2 WebP 三 chunk+动画裁决；Y3 filename 编码；Y4 事实修正+半自动 gate；Y5 测试增补；Y6 导入幂等；Y7 发布时序修正；Y8 private 缓存；Y9 磁盘硬阈值；Y10 motif 删除。

**v2.1 → v2.2（三轮差异复核）**：恢复模式拆两分支（损坏恢复 / 版本过新零写入）+ state 缺失且 assets 非空进恢复；掉电上限措辞改为"配置未必可恢复、blob 保留"；三层回退语义冻结；staticCss 改皮肤预作用域；image schema 增 maxPixels（GIF 12MP）；GIF 风险措辞按评审纠正；merge 措辞统一（catalog 纯函数、projector 执行）。

**v2.4 增补（精简轮，Q35–Q53 + 计划三轮评审）**：字段 10→6（删 favicon/accent/gold/bubbleColor；scrim 单值 30）与皮肤侧静态化；显式保存模型取代防抖自动落库与关弹层冲刷（Y6 语义反转，ADR-0001）；主题包机制整体移除（ADR-0002，staging 死设施一并删除）；加载时存量规范化（"未知键保留"原则翻转，configVersion 门保证未来版字段安全）；粘连外壳（360+520、<904 堆叠、滑入+reduced-motion）；壁纸区合并与清空图库影响清单确认；**对 Q49 的显式修订：离开编辑面的五条通道统一脏态确认——齿轮收面板由无条件收起改为脏态确认、面板目标切换同此**（三轮评审 ③-1/③-2）；409 分 flavor（readonly 不 refetch / 冲突 refetch 自愈）；冲突横幅仅 synced 渲染。实现按计划 T0–T8 执行（docs/plans/2026-08-31-tgcf-simplification-implementation-plan.md v2.1，经三轮计划评审：4高/7中/9低 → 6 项 → 4 句话级，全数吸收）。

**v2.3 增补（实现评审第二轮 N1/N2）**：runtime 挂载改回 teardown-first（共享节点身份下 build-then-swap 会拆毁活动皮肤——生产每次加载必触发的发布级回归），失败恢复 = 纯函数重投影旧皮肤；styleTag 复用必刷新内容；readStateFile 在 shape 校验前先做 configVersion 探测（shape 变化的未来版 → unsupported 零写入）；contextActive 接入 runtime.active；齿轮补 DOM id；verify-release 在 CI 锚定 GITHUB_REPOSITORY；Y1 登记入 §17；发版手工清单落为 `docs/release-checklist-1.0.0.md`（含 README 截图、双标签页、升级演练等 tag 前置条件）。

**v2.4.1 修订（实测问题 #1）**：粘连外壳内面板展开时，点另一皮肤**卡片**原按 Q48 仅切换当前皮肤、面板停留原皮肤——实测造成"面板还是上一个皮肤"的割裂观感，且脏态下该路径不经任何确认直接 `runtime.select`，恰是 ③-2 要防的 active=B/面板=A 半态。修订为：面板展开时点卡片 = 面板目标随行切换（目标不可个性化则经同一确认收起面板），守卫置于 `runtime.select` 之前，确立"面板展开期间面板目标 ≡ 当前皮肤"不变式。五通道集合不变（该路径并入"面板目标切换"通道）；齿轮语义、Q48 的齿轮半则不变。

## 20. 终审记录

Q1–Q34（产品）→ v1 → v2 → v2.1 → v2.2（三轮差异复核）→ v2.3（实现评审修订：backdrop 接口形状 §3a、§9a 获批）→ **v2.4（精简轮：Q35–Q53 产品裁决 + ADR-0001/0002 + 计划三轮评审放行）**。实现评审 13 红项、N1/N2、N3 全部闭合；精简轮按 T0–T8 交付，每 commit check 绿色，活 GUI gate 8/8 通过。

## 21. 对二轮评审的异议记录

1. **Y2 animated GIF（三轮更新）**：功能裁决（GIF 允许）维持，但**撤回"浏览器内存压力是单帧的"技术论断**——评审引用的 Chromium 解码器修改（按帧内存 × 缓存帧数计算、超限才 purge）证明该断言不成立。已改为显式风险接受措辞，并采纳其低成本加固选项：**GIF maxPixels 收紧为 12MP**（覆盖 4K 静帧 8.3MP，最坏单帧解码内存 ~48MB RGBA）；帧数/总动画像素预算列为升级路径。
2. **掉电措辞**：采纳评审的诚实上限表述（"配置未必可恢复、blob 保留可重挂"），**未采纳** last-known-good 备份进 1.0.0——以范围控制优先，LKG 已登记为升级路径；如评审认为 LKG 应进 1.0.0 请明示，属加法而非翻案。
3. 其余全部采纳；历史轮次的选项内选择（UUID 去连字符、dataset camelCase、仓内原子写、自动建 Release）不变。
