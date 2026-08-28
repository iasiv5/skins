# skins（dsh-skins）— 模块化 DSH Web 多皮肤插件

每一个扩展皮肤都是 `src/client/skins/` 下的独立一级目录：想加就加，想删就删；
`default` 是撤销全部扩展覆盖、恢复 DeepSeek Harness 官方界面的内置虚拟选项。
不存在 family/shared 视觉资源层，也不允许皮肤之间互相 import。源码用 esbuild 生成 DSH
实际加载的单文件 `lib/client.js`，发布时提交产物且不使用 `prepare`，GitHub 安装者无需构建。

> 已随 DSH 0.1.1-rc.2 / web profile 验证。
> English: [README.en.md](README.en.md)

## 当前皮肤

| id | 目录 | 状态 | 说明 |
|---|---|---|---|
| `default` | — | 内置 | DeepSeek Harness 官方界面；撤销扩展皮肤，但保留切换入口和外观配色 |
| `openbmc` | `src/client/skins/openbmc-harness/` | 正式 | OpenBMC 徽标、favicon、冰蓝双主题、风雷翅背景、品牌标语 |
| `uefi-harness` | `src/client/skins/uefi-harness/` | **Dummy** | 独立 UEFI 芯片标识、紫蓝双主题、渐变背景；供未来替换成正式设计 |

`openbmc-lite` 已删除。

## 切换

侧栏底部、插件广场上方的 **“皮肤切换”** 打开两段式弹层：

1. **外观配色**：浅色、深色、跟随系统；复用官方 theme service，与“设置 → 通用 → 外观”
   双向同步，远程访问时继续通过 localStorage fallback 持久化。
2. **选择皮肤**：第一项是 **DeepSeek Harness（默认）**，用于撤销扩展皮肤并恢复官方界面；其后是 OpenBMC Harness、UEFI Harness。当前选择会高亮并持久化，弹层保持打开以便连续预览。首次加载仍默认使用 OpenBMC。

侧栏收起时入口自动变成圆形调色盘图标。所有注册到 `sidebar.footer.action` 的插件入口
都会自动纵向排列。

调试入口：

```js
__DSH_SKINS__.list();                 // 当前全部扩展皮肤
__DSH_SKINS__.select("default");      // 恢复 DeepSeek Harness 官方界面
__DSH_SKINS__.select("uefi-harness"); // 热切 UEFI dummy
__DSH_SKINS__.active();               // 当前选择 id（含 default）
```

也可访问 `/?skin=default` 或 `/?skin=uefi-harness`，选择保存在 `localStorage["dsh-skins:active"]`。

## 目录结构

```text
skins/
├── src/client/
│   ├── index.js                    # DSH ModuleLoader 入口，仅负责组装模块和注册皮肤
│   ├── runtime.js                  # 注册表、单皮肤挂载/卸载、选择与持久化
│   ├── sidebar-switcher.js         # 侧栏“皮肤切换”入口、弹层、纵向多插件布局
│   ├── theme-persistence.js        # 远程 light/dark/system localStorage fallback
│   └── skins/
│       ├── openbmc-harness/
│       │   └── index.js            # 完整且独立的 OpenBMC 皮肤
│       └── uefi-harness/
│           └── index.js            # 完整且独立的 Dummy UEFI 皮肤
├── scripts/build-client.mjs        # esbuild：src/client/index.js → lib/client.js
├── lib/
│   ├── index.js                    # Host 空入口
│   └── client.js                   # 自动生成、提交发布；禁止手工编辑
├── smoke-test.cjs
├── package.json
└── pnpm-lock.yaml
```

### 边界规则

1. `runtime.js` / `sidebar-switcher.js` 只能包含通用技术能力，不能出现品牌素材。
2. 每个 `skins/<id>/` 自带徽标、favicon、CSS、背景和 slogan。
3. 皮肤目录之间禁止互相 import；即使暂时有重复，也优先保持独立。
4. 新增/删除皮肤只修改自己的目录和 `src/client/index.js` 的一行注册。
5. `lib/client.js` 是生成文件，不能手改。

## 新增独立皮肤

创建 `src/client/skins/my-skin/index.js`，导出一个创建函数：

```js
export function createMySkin({ jsx }) {
  function Mark({ size = 24 }) { /* 返回图标 */ }
  function Name() { /* 返回名字标 */ }

  return {
    id: "my-skin",
    label: "My Skin",
    description: "一句话描述",
    bodyAttr: "dshMySkin",
    Mark,
    Name,
    favicon: "data:image/svg+xml,...",
    faviconMime: "image/svg+xml",
    css: `body[data-dsh-my-skin] { /* tokens */ }`,
    art: "",
    scrimLight: "",
    scrimDark: "",
    placeholderLight: "linear-gradient(...)明色",
    placeholderDark: "linear-gradient(...)暗色",
    slogans: { zh: "中文标语", en: "English slogan" },
  };
}
```

在 `src/client/index.js` 增加：

```js
import { createMySkin } from "./skins/my-skin/index.js";
runtime.register(createMySkin(jsxRuntime));
```

构建验证：

```sh
pnpm run build
pnpm run test
# 或一次完成
pnpm run check
```

删除皮肤则反向操作：删除目录、删除 import/register 两行、重新 build/test。

## 开发

```sh
pnpm install
pnpm run watch   # 监听 src，自动重建 lib/client.js
```

修改 `package.json` 的 `dsh.client.inject` 或 `cordis.patch.yml` 后必须重启 `dsh web`。

## 远程浏览器的浅色 / 深色持久化

DSH 官方外观偏好在远程/反向代理连接中是 memory 模式。本插件仅对非 loopback 连接监听
官方 `theme/change`，把 `light / dark / system` 写入
`localStorage["dsh-skins:theme-preference"]`，启动时通过官方 `theme.setTheme()` 恢复。
本机 loopback 完全跳过 fallback。可用 `__DSH_SKINS__.themePreference()` 检查值。

## 从 GitHub 安装（从零开始）

前置：已安装 DSH，并能正常启动 web profile。无需手动 clone，也无需在插件目录执行
`pnpm install`；下面的命令会在首次使用时自动初始化 web profile 并安装插件：

```sh
dsh plugin --profile web add github:iasiv5/skins#main
```

安装成功后重启正在运行的 `dsh web`，刷新页面，侧栏底部应出现 **“皮肤切换”**。
可在浏览器控制台验证：

```js
__DSH_SKINS__.list();
// 应包含 openbmc 和 uefi-harness
```

### 更新到 main 最新版本

```sh
dsh plugin --profile web update dsh-skins
```

更新后重启 `dsh web`。正式发布 Git tag 后，也可以安装固定版本：

```sh
dsh plugin --profile web add github:iasiv5/skins#v0.3.1
# 或固定到可审计的 40 位 commit SHA：
dsh plugin --profile web add github:iasiv5/skins#<commit-sha>
```

### 卸载

```sh
dsh plugin --profile web remove dsh-skins
```

仓库没有 `prepare`：GitHub 安装者直接使用已提交的 `lib/client.js`，不会下载开发工具或
在安装阶段构建。维护者提交前执行 `pnpm run check`，并同时提交 `src/`、生成后的
`lib/client.js`、`package.json` 和 `pnpm-lock.yaml`。

## 已知边界

- OpenBMC 气泡描边仍使用版本相关哈希类 `.gdEzaW_bubble`；失效只影响描边。
- slogan 通过内部 `locale.dicts` 改写，卸载会还原；DSH locale 大版本升级需复核。
- 与其他皮肤插件同时启用会竞争 body 背景；应在皮肤市场停用其一。
- Dummy UEFI 只是架构占位皮肤，不代表正式 UEFI 品牌视觉。
