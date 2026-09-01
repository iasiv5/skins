# 美人志（meirenzhi）皮肤 · 设计定案

## 背景与共识来源

- 设计过程：`/grill-with-docs` 两轮问答（2026-09-01），随后四轮外部评审修订；执行契约见
  `docs/plans/2026-09-01-meirenzhi-skin-implementation-plan.md`（v2.3）。
- 素材方案裁决（产品负责人，2026-09-01）：**方案 B 质量优先**——固定 `scale=2560:-2` +
  libwebp `-quality 80`，不做逐图降质、不回退宽度；字节护栏仅作源图漂移检测
  （单张 ≤640,000 B、合计 ≤4,700,000 B，实测 4,539,816 B）。
- 素材声明：12 张壁纸均为 **AI 生成同人图，非官方《凡人修仙传》素材，不标注生成工具**；
  龙标 mark/favicon（金龙红底圆角方，参照产品主人提供的龙标图）为原创代码绘制
  SVG，BEAUTY 徽章由 HTML/CSS 绘制，萤火粒子由
  CSS 伪元素与径向渐变绘制——均不包含官方素材。源图 sha256 逐张记录于
  `src/client/skins/meirenzhi/wallpapers.js` 头注释。

## 身份与注册

| 项 | 值 |
|---|---|
| 皮肤 id | `meirenzhi` |
| label | zh「凡人修仙传 · 美人志」/ en "Mortal's Journey · Beauty Chronicle" |
| description | zh「云鬓花颜 · 霞衣夜月 · 凡尘问道」/ en "Moonlit silks · crimson & gold · mortal path"（三段式为 smoke 既有规则所要求） |
| body 属性 | `dshMeirenzhiSkin`（attr `data-dsh-meirenzhi-skin`） |
| style tag / 变量前缀 | `dsh-skins/meirenzhi` / `--dsh-mrz-*` |
| titleBrand / favicon | 「美人志」/ 龙标 SVG data URL |
| 注册顺序 | 第 1 位（出厂皮肤），其后 openbmc / uefi-harness / tgcf |

出厂皮肤语义：仅当无 URL 参数、无 localStorage 选择时兜底 `order[0]`；用户显式选择
（含选官方）后立即让位。术语裁定见 CONTEXT.md「出厂皮肤」（避用「默认皮肤」）。

## 壁纸资产

12 张内置精选，网格顺序 = `builtinChoices` 顺序（出厂默认领头，合照前、单人后）：

| key | 源文件 | zh 标签 | en 标签 |
|---|---|---|---|
| `yuntai` | 001.jpg | 云台雅集 · 合照（默认壁纸） | Yuntai Gathering · Group (default) |
| `yuanfeng` | 002.jpg | 远峰同倚 · 合照 | Distant Peaks · Group |
| `taoyuan` | 003.jpg | 桃源春集 · 合照 | Peach Spring · Group |
| `yueye` | 004.jpg | 月夜同辉 · 合照 | Moonlit Night · Group |
| `mupeiling` | 005慕沛灵.jpg | 慕沛灵 · 单人 | Mu Peiling · Solo |
| `ziling` | 006紫灵.jpg | 紫灵 · 单人 | Zi Ling · Solo |
| `nangongwan` | 007南宫婉.jpg | 南宫婉 · 单人 | Nangong Wan · Solo |
| `nangongque` | 008南宫阙.jpg | 南宫阙 · 单人 | Nangong Que · Solo |
| `yinyue` | 009银月.jpg | 银月 · 单人 | Yin Yue · Solo |
| `meining` | 010梅凝.jpg | 梅凝 · 单人 | Mei Ning · Solo |
| `songyu` | 011宋玉.jpg | 宋玉 · 单人 | Song Yu · Solo |
| `yanruyan` | 012燕如嫣.jpg | 燕如嫣 · 单人 | Yan Ruyan · Solo |

转码：ffmpeg `scale=2560:-2 -c:v libwebp -quality 80`；同目录临时文件 + `renameSync`
原子落盘；脚本 `scripts/build-meirenzhi-wallpapers.mjs` 可复现。base64 内嵌进 bundle
（`lib/client.js` ~6.8MB，方案 B 已知并接受）。

## 视觉系统

常量 token（不随通透度动）：

| token | light | dark |
|---|---|---|
| `--dsw-alias-brand-primary`（=button fill） | `#B8433F` | `#E58A80` |
| `--dsw-alias-brand-text`（=button hover） | `#A87B2F` | `#D9B45C` |
| `--dsw-specific-bubble` | `rgba(184, 67, 63, 0.10)` 绯红轻纱 | `rgba(24, 24, 34, 0.90)` 玄夜 |
| `--dsw-specific-bubble-highlight` | `rgba(184, 67, 63, 0.18)` | `rgba(40, 40, 56, 0.92)` |
| `--dsw-alias-bg-overlay` | `rgba(252, 250, 246, 0.85)` | `rgba(24, 24, 34, 0.88)` |
| `--dsw-alias-interactive-bg-hover` | `rgba(184, 67, 63, 0.08)` | `rgba(229, 138, 128, 0.14)` |
| `--dsw-alias-interactive-bg-active` | `rgba(184, 67, 63, 0.14)` | `rgba(229, 138, 128, 0.20)` |
| `--dsw-specific-sidebar-nav-item-hover` | `rgba(250, 249, 246, 0.6)` | `rgba(28, 28, 40, 0.6)` |
| `--dsw-specific-sidebar-nav-item-active` | `rgba(250, 249, 246, 0.9)` | `rgba(28, 28, 40, 0.9)` |

随动族（tgcf 二次曲线，锚点 P=35；alpha `toFixed(2)`、scrim `toFixed(3)`）：
面板底 light `rgba(250, 249, 246, t)` / dark `rgba(18, 18, 26, t)`（暖雾白 × 玄夜蓝紫，
比 tgcf 暖墨黑冷一档）；侧栏 t+0.05 / t+0.17（ruling #15）；module-platform t / t+0.05；
input-major t+0.05 / t+0.10；纱 `30·t²`（暖雾白 `252,250,246` / 玄夜 `16,16,26`）；模糊 `12·t²`。

> 交付后调整（产品主人，2026-09-01 手测反馈）：用户气泡原为饱和红实底
> （`#B8433F`/`#7E2D33`），明暗两态观感突兀。已参照 openbmc/uefi 的双 token
> 结构改为——浅色态=品牌绯红轻透纱（0.10/0.18，融进暖雾白面板）、深色态=
> 玄夜面板族较实底（0.90/0.92，亮字），并增补 `--dsw-specific-bubble-highlight`。

明暗策略：出厂壁纸明暗**同图**（字段语义决定），**浅色态为主视觉**（001 本身浅调，
近零损耗），深色态玄夜纱压色；明暗差异由 overlay `::after` 与 token 承担，
runtime 不生成暗色专用 `::before`。

## 品牌组件

- **Mark = 龙标**（2026-09-01 产品主人裁决：掌天瓶退役；配色基准为其提供的
  金龙红底圆角方图）：红底渐变 `#D8402F→#9E1B14`、金边双线框 `#E8B923`、
  金身渐变 `#FFE066→#D4A017`、暗金描边 `#B8860B`、红瞳 `#7A1010`。原创代码绘制
  SVG，data URL 同时供 mark 与 favicon。
- **Name**：「凡人修仙传」渐变字（`#A87B2F → #D9B45C → #B8433F`）+ 反色徽章
  **BEAUTY**（2026-09-01 裁决：原「美人志」三字换英文）——亮=玄夜底 `#12121A` +
  雾白字 `#FAF9F6`，暗=雾白底 + 玄夜字（tgcf badge 反转结构）。
  待办：「凡人修仙传」五字按产品主人后续提供的字体参考图重绘（未收到图，暂维持
  浏览器渐变字渲染）。

## 动效

灵光呼吸（骑 runtime 壁纸 `::before` 层，26s）+ 萤火 ×2（`#root::before/::after`，
金白软光点 38s/47s 漂移，opacity .12–.2）——伪元素预算与 tgcf 持平（`::before/::after`
被 backdrop 占用，`#root::before/::after` 是仅剩的两个自由伪元素）。
`prefers-reduced-motion: reduce` 下全部静止。

## 个性化字段

三字段目录（与全皮肤同构）：壁纸（默认 `builtin:meirenzhi:yuntai`，12 选 1 + 图库）、
标语（出厂「风起凡尘 · 红颜问道」/ "From mortal dust, immortals bloom"）、
通透度（出厂 **35%**，壁纸主导型皮肤的 tgcf 锚点）。

## 交付范围与集成点

- 注册顺序（`src/client/index.js`）+ runtime 首装兜底注释改写。
- `sidebar-switcher.js` 官方深色兜底 `:not()` 链加入 `:not([data-dsh-meirenzhi-skin])`
  （否则官方深色炭色弹层盖掉本皮肤 `bg-overlay` token）。
- smoke-test 十项首装迁移（含 stateOverrides、official 清理区、同图暗色 `::after`
  正向断言、成功日志）；panel 测试矩阵加入 meirenzhi + 12 缩略图断言。
- `capture-previews.mjs` gate：齿轮数 = `list().length`（runtime.list 只含扩展皮肤）、
  齿轮按 `--skin` 的扩展列表索引定位、`.last()` 清除、factory slogan 完整四皮肤映射、
  面板截图复用已打开弹层（修复重复 `openSwitcher()` 的 toggle 关闭缺陷）。
- README 双语「五款外观」+ 出厂承诺 + 非关联声明；CONTEXT.md「出厂皮肤」术语与四套口径。
- 发布流程：装机后按 `release-checklist-1.0.0.md` 跑四皮肤 gate 与截图采集。
