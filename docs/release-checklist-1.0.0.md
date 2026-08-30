# 1.0.0 发版手工清单（打 tag 前的显式前置条件）

> 以下步骤需要一台装好 1.0.0 候选构建的 DSH Web GUI。每步记录「实际结果」与证据路径；
> 任何一步失败即停止发版。此清单为设计 §14/§13 手工 gate 的落地（评审 Y12）。

## 准备

- [ ] 在候选机器安装本地构建：`dsh plugin --profile web add link:<仓库路径>`，重启 DSH Web
- [ ] 确认版本：弹层更新栏显示 v1.0.0（本地开发模式字样属正常）

## 自动化 gate（半自动）

- [ ] `node scripts/capture-previews.mjs --skin tgcf --gate` → 输出 `GATE PASSED`
      （断言：3 个齿轮键盘可达、面板开合、标题换装、favicon 换装；截图含隐私门禁）
      证据：终端输出 + `docs/assets/tgcf-personalize.webp`
- [ ] `node scripts/capture-previews.mjs --skin tgcf` 与 `--skin openbmc` 重拍全部截图
      证据：`docs/assets/{tgcf,openbmc}-{dark,light}.webp`、`*-switcher-dark.webp`

## 手工验收（每项记录观察结果）

- [ ] tgcf 视觉：暗色朱红鎏金 / 亮色素白金线；四张内置壁纸切换正常
- [ ] reduced-motion：系统开启「减弱动态效果」后呼吸/漂浮/光晕停止（CSS 动画归零）
- [ ] 双标签页同步：标签 A 改 slogan/壁纸 → 标签 B 聚焦后 ~1s 内同步（BroadcastChannel + focus 兜底）
- [ ] 主题包导出→导入：tgcf 导出 zip → 恢复默认 → 导入 → 预览 diff 正确 → 确认后配置复刻
- [ ] 0.6.0 → 1.0.0 升级演练：先装 v0.6.0 正式版并写入个性化配置 → 一键更新到 1.0.0 →
      配置与图库保留、无恢复模式误报
- [ ] 删除被引用图片：确认框高亮受影响皮肤 → 确认后回退默认壁纸
- [ ] 旧皮肤等价：openbmc/uefi 默认视觉与 0.6.0 截图逐像素对照无差异

## 收尾

- [ ] 截图入库（修复 README 破图引用：tgcf-dark.webp 等）
- [ ] `pnpm run check` + `git diff --exit-code -- lib` 全绿
- [ ] 设计 §9a 已获产品负责人批准
- [ ] 以上全部勾选后：推 `v1.0.0` tag，Release workflow 自动走门禁并发布
