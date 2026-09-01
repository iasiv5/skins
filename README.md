# dsh-skins — DSH Web 多皮肤插件

[![Release](https://img.shields.io/github/v/release/iasiv5/skins?label=Release&sort=semver)](../../releases)
[![CI](https://img.shields.io/github/actions/workflow/status/iasiv5/skins/ci.yml?branch=main&label=CI)](../../actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/iasiv5/skins?label=License)](./LICENSE)
[![DSH Web](https://img.shields.io/badge/DSH%20Web-0.1.1--rc.2%20verified-2563eb)](#faq)

[English](./README.en.md) · 中文

为 DeepSeek Harness Web 换上可热切换的品牌皮肤，随时一键回到官方界面。

![OpenBMC 暗色](docs/assets/openbmc-dark.webp)

## 30 秒上手

本节回答：怎么装上、怎么换皮肤。

```sh
dsh plugin --profile web add github:iasiv5/skins#main
```

1. 执行上面的安装命令。
2. 重启 DSH Web（例如 `systemctl restart` 对应的服务，按你的部署方式而定）。
3. 刷新页面。
4. 点击侧栏底部的「皮肤切换」，挑选皮肤。

首次安装且没有已保存选择时，默认使用「凡人修仙传 · 美人志」皮肤（出厂皮肤）。需要可复现安装时，请使用 [Releases](../../releases) 中的 tag，或固定到经过审核的 40 位 commit SHA：

```sh
dsh plugin --profile web add github:iasiv5/skins#<commit-sha>
```

更新与卸载：

```sh
dsh plugin --profile web update dsh-skins    # 更新
dsh plugin --profile web remove dsh-skins    # 卸载
```

<details>
<summary>把安装交给 Agent（提示词安装法）</summary>

把下面这段整体复制给 DSH Web 里的 Agent：

```text
帮我安装 DSH 皮肤插件 dsh-skins：
1. 执行 dsh plugin --profile web add github:iasiv5/skins#main；
2. 安装成功后重启 DSH Web（若由 systemd 管理，重启对应服务即可）；
3. 最后提醒我刷新页面。
若安装失败，把命令输出原样发给我，最多重试一次。
```

</details>

## 五款外观

本节回答：有哪些皮肤、各是什么气质。

| 选择 ID | 类型 | 描述 |
|---|---|---|
| `official` | 内置选项 | 素笺玄墨 · 留白生辉 · 本色天成 |
| `meirenzhi` | 正式皮肤 · 出厂默认 | 云鬓花颜 · 霞衣夜月 · 凡尘问道 |
| `openbmc` | 正式皮肤 | 冰绡叠浪 · 风雷入画 · 缥碧盈卷 |
| `uefi-harness` | 占位皮肤 | 紫电初醒 · 流霞渐染 · 绀青成韵 |
| `tgcf` | 正式皮肤 | 千灯引路 · 朱红鎏金 · 长夜同明 |

- `official` 恢复 DeepSeek Harness 官方品牌、背景与 favicon，并保留皮肤切换器与官方明暗配色。
- `meirenzhi` 是出厂皮肤：首次加载、无已存选择时默认启用；`openbmc` 不再承担首装兜底。「官方」只表示恢复官方界面，不是首次加载的选择。
- 每套皮肤明暗各一套配色，跟随「外观配色」自动切换：

![OpenBMC 亮色](docs/assets/openbmc-light.webp)

- `meirenzhi`（凡人修仙传 · 美人志）是**非官方粉丝作品**，与《凡人修仙传》版权方无关联、未获授权；内置 12 张壁纸（4 张合照 + 8 张单人）均为 AI 生成粉丝画作（由插件作者提供），龙标站点图标采用产品主人提供的图样，BEAUTY 徽章由 HTML/CSS 绘制、萤火粒子由 CSS 伪元素与径向渐变绘制，均不包含官方素材。绯红鎏金亮暗双态，出厂标语「风起凡尘 · 红颜问道」。
- `uefi-harness` 是占位皮肤：架构与交互先行，品牌位用 UEFI Forum 官方标志，背景铺鎏金电路板原画，等待正式设计接手。
- `tgcf`（天官赐福 · 百无禁忌）是**非官方粉丝作品**，与《天官赐福》版权方无关联、未获授权；出厂壁纸为 AI 生成粉丝画作（豆包AI 生成，由插件作者提供），站点图标与飘蝶装饰为原创代码绘制 SVG，不含任何官方素材。暗色朱红鎏金、亮色素白金线，出厂标语「百无禁忌」。

![TGCF 暗色](docs/assets/tgcf-dark.webp)

## 个性化

本节回答：每套皮肤能改什么、配置存在哪、修改何时生效。

每张皮肤卡右侧有齿轮按钮，在换肤弹层右侧展开该皮肤的个性化大面板（窄窗口时上下堆叠）：

- **可定制项**（四皮肤同一字段集：`tgcf` / `openbmc` / `uefi-harness` / `meirenzhi`）：壁纸（内置画作 + 个人图库）、标语（中英）、面板通透度（0–100%，单值联动面板底色、遮罩与模糊三层：0% 纯壁纸完全透出，100% 完全遮蔽；各皮肤默认值锚定出厂视觉——tgcf 35%、meirenzhi 35%、openbmc/uefi 55%）。颜色、站点图标与标签页标题为皮肤固定设计，不再提供调节。
- **个人图库**：上传 PNG / JPEG / WebP / GIF（单张 ≤ 20MB、GIF ≤ 12MP；动画 WebP 与 SVG 不收），支持一次多选、自动逐张上传并播报进度与失败原因，图库无数量上限，所有皮肤共用；删除被引用的图片或清空图库时会先列出全部受影响的皮肤与字段。
- **自动保存**：面板内任何修改（壁纸、标语、面板通透度）立即生效，经短暂防抖自动写入配置并跨标签页同步，字段修改无保存按钮、无确认弹窗；「恢复默认」是唯一带二次确认的操作——先列出将被重置的设置，确认后立即回出厂并自动保存。与切换皮肤一致：即改即存。面板展开时点其他皮肤卡片，面板会随之切到该皮肤。
- **存储与升级**：配置与图库存于 `$DSH_HOME/dsh-skins/`（与插件安装目录隔离），升级 / 回滚 / 一键更新天然保留；配置只存「改过什么」，新版默认值自动流向未修改的字段，已下线字段的残留覆写会在加载时自动清理。
- **安全设计**：上传走魔数校验与尺寸上限；配置状态损坏时进入恢复模式（只重建图库、绝不清除图片）；字段级并发写入互不覆盖（同字段最后写入胜）。

## 皮肤切换器

本节回答：切换器里有什么、怎么用。

![皮肤切换器](docs/assets/switcher-dark.webp)

侧栏底部的「皮肤切换」弹层包含两个区块：

1. **外观配色**：浅色、深色、跟随系统。它调用官方 theme service，与「设置 → 通用 → 外观」同步。
2. **选择皮肤**：第一项为 DeepSeek Harness（官方），其后是扩展皮肤。点击立即切换并持久化，弹层保持打开，方便连续预览。

侧栏收起时，入口显示为圆形调色盘图标。选择「官方」只撤销扩展皮肤，不改动明暗偏好。多个 `sidebar.footer.action` 入口会纵向排列，避免重叠。

URL 也能切皮肤：`/?skin=official`、`/?skin=meirenzhi`、`/?skin=openbmc`、`/?skin=uefi-harness`、`/?skin=tgcf`。选择保存在 `localStorage["dsh-skins:active"]`。

控制台调试 API：

```js
__DSH_SKINS__.list();                  // 列出扩展皮肤，不包含 official
__DSH_SKINS__.select("official");      // 恢复官方界面
__DSH_SKINS__.active();                // 当前选择 ID
__DSH_SKINS__.themePreference();       // 浏览器保存的配色偏好；可能为 null
```

## 一键更新与安全设计

本节回答：怎么更新、为什么敢让它自己装。

打开皮肤切换器时，Host 会检查本仓库的最新正式版 Release。发现新版本后，更新栏显示当前/最新版本与 Release 说明链接：

1. 点击「更新」，下载、安装、校验自动完成；
2. 点击「立即重启」（或选「稍后」），新版本重启后生效；
3. 有 Agent 正在运行时阻止重启，任务结束后再试。

为什么敢装——每一步都有代码校验，不靠信任：

- 只接受严格的 `vX.Y.Z` 正式版 tag，并解析到完整 40 位 commit SHA；
- 校验远端包名、仓库与 `package.json` 版本一致；
- 实际安装固定到该 SHA，不跟随分支漂移；
- 安装后复验 profile 与已安装包，失败自动恢复原版本；
- systemd 等服务管理器下，重启交回服务的 `Restart` 策略，不硬杀进程。

> 更新模块从 `v0.4.0` 起提供。更早版本请先手动执行一次 `dsh plugin --profile web update dsh-skins`，之后即可在弹层一键更新。

## 工作原理

本节面向想读源码的人：插件怎么构成、更新事务怎么落地。

**双端结构**。客户端负责皮肤与切换界面，Host 负责 Release 检查、安全安装与重启。esbuild 产出 `lib/client.js` 与 `lib/index.js`，产物随仓库提交——GitHub 安装不在目标机器上构建。

**更新事务**（Host）：

- 检查结果缓存在 `$DSH_HOME/dsh-skins/update-cache.json`，有效期 1 小时并跨 DSH 重启保留。已是最新时不显示更新栏；网络失败时可在弹层底部手动重试。
- 更新开始前重新检查安装来源。只有从官方 GitHub 仓库安装的版本允许一键更新：`link:` 安装显示「本地开发模式」并禁用在线更新，`file:`、tar 包与其他仓库来源不会被覆盖。
- 安装完成后校验 profile 依赖固定、bundle 注册与已装包元数据；任何一步失败，自动恢复更新前的 GitHub 安装。
- 重启安全：检测运行中的 Agent 并阻止；服务管理器环境（探测 `INVOCATION_ID`/`NOTIFY_SOCKET`）以非零码退出，把重启交回 `Restart` 策略；脱离服务管理器运行时才使用内置的脱离重拉助手。

**明暗持久化**。非 loopback 浏览器中，插件监听官方 `theme/change` 事件，把浅色/深色/跟随系统存入 `localStorage["dsh-skins:theme-preference"]`，启动时经官方 `theme.setTheme()` 恢复。loopback 浏览器不启用这一回退，直接使用 DSH 自身的 Host 持久化。

**报错本地化**。所有会显示在界面里的 Host 报错都带稳定错误码与模板参数，客户端据此渲染中英文文案；未知错误码回退为 Host 原始消息。

## 自建一套皮肤

本节回答：怎么加一套自己的皮肤。

在 `src/client/skins/<id>/index.js` 中导出创建函数：

```js
export function createMySkin({ jsx }) {
  function Mark({ size = 24 }) { /* 返回图标 */ }
  function Name() { /* 返回品牌名 */ }

  return {
    id: "my-skin",
    label: "My Skin",
    description: { zh: "一句话描述", en: "One-line description" },
    bodyAttr: "dshMySkin",
    Mark,
    Name,
    favicon: "data:image/svg+xml,...",
    faviconMime: "image/svg+xml",
    title: "My Skin",
    css: `body[data-dsh-my-skin] { /* DSH tokens */ }`,
    art: "",
    scrimLight: "",
    scrimDark: "",
    placeholderLight: "linear-gradient(...)明色",
    placeholderDark: "linear-gradient(...)暗色",
    slogans: { zh: "中文标语", en: "English slogan" },
  };
}
```

然后：

1. 在 `src/client/index.js` 中加入对应的 import 与 `runtime.register(...)`；
2. 在 `src/shared/personalization/catalog.js` 中登记皮肤的字段声明（`fields[]` 与内置资产），即可自动获得个性化面板——支持 `text / color / image / select / range` 五类字段、`single / locale / colorScheme` 三种值作用域；
3. 需要自定义「值 → 效果」映射时，在皮肤工厂上提供 `project(values, assets)` 纯函数；不提供则走与旧皮肤逐字节等价的内置适配器；
4. 删除皮肤时反向操作；
5. 保留 ID `official` 与兼容别名 `default`，不要用于扩展皮肤。

`label` 与 `description` 接受语言中立的字符串（如品牌名）或 `{ zh, en }` 映射，解析顺序为当前语言 → en → zh。皮肤卡片与 `__DSH_SKINS__.list()` 始终返回解析后的字符串，中英词典由 `tests/dicts.test.mjs` 强制键与占位符双向对齐。

`title`（可选）改写浏览器标签页的品牌段，接受与 `label` 相同的字符串或 `{ zh, en }` 形式。官方 `DocumentTitle` 投影器会把标签页维护为「会话名 — DeepSeek Harness」，皮肤挂载期间只替换其中的品牌段、保留会话名；选择官方外观或插件卸载时换回官方品牌。

每个皮肤目录自持品牌标识、favicon、CSS、背景与标语，不从其他皮肤目录导入视觉资源；`runtime.js` 与 `sidebar-switcher.js` 只承载通用机制。

## 本地开发与验证

本节回答：怎么跑起来、怎么保证不弄脏产物。

```sh
pnpm install
pnpm run check     # 构建 + 语法检查 + 冒烟测试 + 全部单测
pnpm run watch     # 监听 src/，分别重建 lib/client.js 与 lib/index.js
```

- 客户端 bundle 经 DSH HMR 热更新；Host 源码、`package.json`、`cordis.patch.yml` 或依赖变化后需重启 DSH Web。
- 提交前同时提交源码与重新生成的 `lib/` 两个产物。CI 会复查构建、产物无差异与安装包内容。
- 文档截图用 `node scripts/capture-previews.mjs` 重拍。脚本内置隐私规程：折叠全部工作区、新建空会话取景、界面强制中文，不泄露任何会话内容。
- 两份 README（中/英）由校验脚本做内容配对；改动任一侧须同步另一侧，详见 `README.i18n.yaml`。

开发模式安装（本地源码直连，客户端改动即改即见）：

```sh
dsh plugin --profile web add link:<本仓库路径>
```

## FAQ

**怎么彻底回到官方界面？**
在皮肤切换器中选择「DeepSeek Harness（官方）」，或访问 `/?skin=official`。它撤销扩展皮肤的品牌、背景与 favicon，保留皮肤切换器与官方明暗配色，也不会改动你的浅色/深色/跟随系统偏好。

**更新失败会怎样？**
更新事务先备份再安装。任何校验失败都会自动恢复原版本，弹层显示失败原因（中英双语）。仍失败时可用 `dsh plugin --profile web update dsh-skins` 手动更新。

**支持哪些 DSH Web 版本？**
已使用 DSH Web `0.1.1-rc.2` 验证。同系列 rc 版本理论上兼容，未经验证的版本不作承诺。

**外观偏好在不同的浏览器间同步吗？**
在 DSH 所在机器的浏览器（loopback）上，偏好由 DSH Host 持久化，天然共享。其他远程浏览器由插件将偏好存入本地 `localStorage`，各浏览器独立、互不覆盖。

**个性化配置会随升级丢吗？**
不会。配置与图库存放在 `$DSH_HOME/dsh-skins/` 数据目录，自更新只替换插件安装目录，物理上碰不到它；回滚同样保留。只有磁盘级损坏可能丢失配置——那时恢复模式仍会保住图库图片。

## 已知边界

- OpenBMC 用户气泡描边使用版本相关类 `.gdEzaW_bubble`；该类变化只影响描边，token 配色不受影响。
- 标签页品牌段替换依赖官方 `DocumentTitle` 投影器的固定文案「DeepSeek Harness」与「 — 」分隔符；投影器实现变化时只影响标签页品牌段，其余界面不受影响。
- 品牌标语经当前 DSH locale 字典接口替换，皮肤卸载时恢复；升级 DSH locale 实现后需要复核。
- 其他皮肤插件也可能修改 body 背景、品牌位或 favicon；应避免同时启用多个视觉皮肤插件。
- `uefi-harness` 的标志为 UEFI Forum 官方商标（红色立方体，源自 uefi.org 发布的 uefi_logo_red.gif，经 Wikimedia Commons「Logo of the UEFI Forum.svg」矢量描摹嵌入），仅作标识用途，权利归 UEFI Forum 所有。
- `tgcf` 为非官方粉丝作品：名称与意象取自《天官赐福》，与墨香铜臭、哔哩哔哩等版权方无任何关联，未获得授权；全部内置视觉为原创代码绘制，不含官方素材。若版权方提出异议，将以中性名称（如「千灯 · 朱红鎏金」）重新发布该皮肤。

## License

[MIT](./LICENSE)
