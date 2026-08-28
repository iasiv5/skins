# dsh-skins — DSH Web 多皮肤插件

`dsh-skins` 为 DeepSeek Harness Web 提供可热切换的品牌皮肤，同时保留一个
**DeepSeek Harness（官方）**选项，用于撤销插件施加的视觉覆盖并恢复官方界面。

插件是纯前端 DSH bundle：源码由 esbuild 打包为 `lib/client.js`，生成产物随仓库提交；
GitHub 安装不运行 `prepare`，也不需要在目标机器上构建。

> 已使用 DSH Web `0.1.1-rc.2` 验证。
>
> English: [README.en.md](README.en.md)

## 可选外观

| 选择 ID | 类型 | 说明 |
|---|---|---|
| `official` | 内置选项 | 恢复 DeepSeek Harness 官方品牌、背景和 favicon；保留皮肤切换器与官方明暗配色 |
| `openbmc` | 正式皮肤 | OpenBMC 飘带徽标、favicon、冰蓝明暗配色、风雷翅背景和品牌标语 |
| `uefi-harness` | 占位皮肤 | 独立 UEFI 芯片标识、紫蓝明暗配色和渐变背景，供后续正式设计替换 |

首次加载且没有已保存选择时使用 `openbmc`；因此“官方”只表示恢复官方界面，
并不是本插件的首次加载选择。

## 使用皮肤切换器

侧栏底部的 **皮肤切换** 弹层包含两部分：

1. **外观配色**：浅色、深色、跟随系统。它调用 DSH 官方 theme service，并与
   “设置 → 通用 → 外观”同步。
2. **选择皮肤**：第一项为 **DeepSeek Harness（官方）**，其后为仓库提供的扩展皮肤。
   点击后立即切换，当前选择会持久化，弹层保持打开以便连续预览。

选择“官方”只撤销扩展皮肤，不会改动浅色、深色或跟随系统偏好。侧栏收起时，入口显示为
圆形调色盘图标。多个 `sidebar.footer.action` 入口会纵向排列，避免彼此重叠。

### URL 与调试 API

```js
__DSH_SKINS__.list();                  // 列出扩展皮肤，不包含 official
__DSH_SKINS__.select("official");      // 恢复 DeepSeek Harness 官方界面
__DSH_SKINS__.select("uefi-harness");  // 热切到 UEFI 占位皮肤
__DSH_SKINS__.active();                // 当前选择 ID
__DSH_SKINS__.themePreference();       // 远程浏览器保存的官方配色偏好；可能为 null
```

也可以使用 `/?skin=official`、`/?skin=openbmc` 或 `/?skin=uefi-harness`。
皮肤选择保存在 `localStorage["dsh-skins:active"]`。

## 明暗配色持久化

在非 loopback 浏览器中，插件监听官方 `theme/change`，将 `light`、`dark` 或 `system`
保存到 `localStorage["dsh-skins:theme-preference"]`，启动时再通过官方
`theme.setTheme()` 恢复。loopback 浏览器不启用这一 fallback，继续使用 DSH 自身的
Host 持久化。

## 仓库结构

```text
src/client/
├── index.js                         # DSH ModuleLoader 入口与模块组装
├── runtime.js                       # 注册、挂载、卸载、选择与持久化
├── sidebar-switcher.js              # 侧栏入口、弹层和本地化词条
├── theme-persistence.js             # 非 loopback 配色持久化 fallback
└── skins/
    ├── openbmc-harness/index.js     # OpenBMC 独立皮肤
    └── uefi-harness/index.js        # UEFI 独立占位皮肤
scripts/build-client.mjs             # esbuild：src/client/index.js → lib/client.js
lib/index.js                         # 无 Host 行为的入口
lib/client.js                        # 自动生成并提交；不要手工编辑
cordis.patch.yml                     # 注册 row id `skins`
smoke-test.cjs                       # ModuleLoader、DOM、切换与清理冒烟测试
```

每个扩展皮肤目录自行提供品牌标识、favicon、CSS、背景和标语，不得从其他皮肤目录
导入视觉资源。`runtime.js` 和 `sidebar-switcher.js` 只承载通用机制。

## 新增扩展皮肤

在 `src/client/skins/<id>/index.js` 中导出创建函数，并返回以下结构：

```js
export function createMySkin({ jsx }) {
  function Mark({ size = 24 }) { /* 返回图标 */ }
  function Name() { /* 返回品牌名 */ }

  return {
    id: "my-skin",
    label: "My Skin",
    description: "一句话描述",
    bodyAttr: "dshMySkin",
    Mark,
    Name,
    favicon: "data:image/svg+xml,...",
    faviconMime: "image/svg+xml",
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

然后在 `src/client/index.js` 中增加对应的 import 和 `runtime.register(...)`。删除皮肤时
反向操作。保留 ID `official` 与兼容别名 `default`，不要用于扩展皮肤。

## 本地开发与验证

```sh
pnpm install
pnpm run check
pnpm run watch
```

`check` 会构建客户端 bundle、执行 JavaScript 语法检查并运行冒烟测试。`watch` 监听
`src/client/`，自动重建 `lib/client.js`。使用本地 `link:` 安装时，DSH Web 可通过客户端
HMR 加载新的 bundle；修改 `package.json` 的 `dsh.client`、`cordis.patch.yml` 或插件
依赖关系后仍需重启 DSH Web。

提交前应同时提交源码和重新生成的 `lib/client.js`。CI 会再次运行检查、确认生成产物无差异，
并验证安装包内容。

## 从 GitHub 安装

安装开发分支：

```sh
dsh plugin --profile web add github:iasiv5/skins#main
```

安装后重启 DSH Web 并刷新页面。需要可复现安装时，请使用 [Releases](https://github.com/iasiv5/skins/releases)
中的 tag，或固定到经过审核的 40 位 commit SHA：

```sh
dsh plugin --profile web add github:iasiv5/skins#<commit-sha>
```

更新从 `main` 安装的版本：

```sh
dsh plugin --profile web update dsh-skins
```

卸载：

```sh
dsh plugin --profile web remove dsh-skins
```

## 已知边界

- OpenBMC 用户气泡描边使用版本相关类 `.gdEzaW_bubble`；该类变化只会影响描边，token
  配色仍然生效。
- 品牌标语通过当前 DSH locale 字典接口替换，并在皮肤卸载时恢复；升级 DSH locale
  实现后需要复核。
- 其他皮肤插件也可能修改 body 背景、品牌 slot 或 favicon；应避免同时启用多个视觉皮肤插件。
- `uefi-harness` 是架构与交互占位皮肤，不代表正式 UEFI 品牌设计。
