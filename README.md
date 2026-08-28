# dsh-skins — DSH Web 多皮肤插件

`dsh-skins` 为 DeepSeek Harness Web 提供可热切换的品牌皮肤，同时保留一个
**DeepSeek Harness（官方）**选项，用于撤销插件施加的视觉覆盖并恢复官方界面。

插件是 Host/Client 双端 DSH bundle：客户端负责皮肤与更新界面，Host 负责正式 Release 检查、
安全安装和重启。esbuild 生成 `lib/client.js` 与 `lib/index.js`，产物随仓库提交；GitHub 安装
不运行 `prepare`，也不需要在目标机器上构建。

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

## 正式版本更新

打开皮肤切换器时，Host 会检查 `iasiv5/skins` 的最新正式 GitHub Release。检查结果缓存在
`$DSH_HOME/dsh-skins/update-cache.json`，有效期为 1 小时并跨 DSH 重启保留；已是最新版时
不显示更新栏，网络失败时可在弹层底部手动重试。

仅从官方 GitHub 仓库安装的版本可以一键更新。`link:` 开发安装会显示“本地开发模式”且禁用
在线更新，`file:`/tar 与其他仓库来源也不会被覆盖。发现新版本后，更新栏显示当前/最新版本、
Release 说明链接和更新按钮。

更新模块会校验严格的 `vX.Y.Z` tag、解析完整 commit SHA，并确认远端包名、仓库、
`package.json.version` 与 DSH Web 元数据一致。实际安装固定到 SHA；安装后再次校验 profile
和已安装包，失败则自动恢复原 GitHub 安装。更新成功后可选择“立即重启”或“稍后”；检测到
运行中的 Agent 时会阻止重启。当 DSH 运行在 systemd 等服务管理器下（探测
`INVOCATION_ID`/`NOTIFY_SOCKET`），“立即重启”以非零码退出并把重启交回服务管理器的
`Restart` 策略；脱离服务管理器运行时才使用内置的脱离重拉助手。

每次正式发布必须保证 `package.json.version` 与 GitHub Release tag 完全一致。由于更新模块从
`v0.4.0` 才开始提供，早于 `v0.4.0` 的安装需要先手动升级一次；之后才能在弹层中一键更新。

## 明暗配色持久化

在非 loopback 浏览器中，插件监听官方 `theme/change`，将 `light`、`dark` 或 `system`
保存到 `localStorage["dsh-skins:theme-preference"]`，启动时再通过官方
`theme.setTheme()` 恢复。loopback 浏览器不启用这一 fallback，继续使用 DSH 自身的
Host 持久化。

## 仓库结构

```text
src/
├── index.js                         # Host 入口，组装更新模块与路由
├── host/
│   ├── self-update.js               # Release、缓存、SHA 校验、安装事务与回滚
│   ├── runner.js                    # DSH profile 命令 adapter
│   ├── routes.js                    # DSH 浏览器信任栅栏保护的更新/重启 HTTP interface
│   └── restart.js                   # Agent 安全检查与 DSH 自重启
└── client/
    ├── index.js                     # DSH ModuleLoader 客户端入口
    ├── runtime.js                   # 皮肤注册、挂载、卸载、选择与持久化
    ├── sidebar-switcher.js          # 侧栏入口、弹层和本地化词条
    ├── update-panel.js              # 更新栏、进度、错误与重启交互
    ├── theme-persistence.js         # 非 loopback 配色持久化 fallback
    └── skins/
        ├── openbmc-harness/index.js # OpenBMC 独立皮肤
        └── uefi-harness/index.js    # UEFI 独立占位皮肤
scripts/build-client.mjs             # esbuild：同时生成 Host 与 Client bundle
lib/index.js                         # 自动生成的 Host bundle
lib/client.js                        # 自动生成的 Client bundle
cordis.patch.yml                     # 注册 row id `skins`
smoke-test.cjs                       # 客户端 ModuleLoader/DOM 冒烟测试
tests/*.test.mjs                     # Host 更新、缓存、回滚与重启安全测试
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

`check` 会构建 Host/Client bundle、执行 JavaScript 语法检查，并运行客户端冒烟测试与 Host
更新模块测试。`watch` 同时监听 `src/client/` 和 `src/host/`，分别重建 `lib/client.js` 与
`lib/index.js`。客户端 bundle 可通过 DSH HMR 热更新；Host 源码、`package.json`、
`cordis.patch.yml` 或插件依赖变化后仍需重启 DSH Web。

提交前应同时提交源码和重新生成的两个 `lib` 产物。CI 会再次运行检查、确认生成产物无差异，
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
