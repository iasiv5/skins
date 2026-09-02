# 1.0.1 发版手工清单（打 tag 前的显式前置条件）

> 本清单覆盖修订号乐观锁补丁与 release-gate 截图隔离策略。以下步骤需要一台装好 1.0.1 候选构建的 DSH Web GUI；任何一步失败即停止发版。gate 截图是本地验收证据，不是文档资产，不进入 Git。

## 准备

- [ ] `package.json` 为 1.0.1，候选提交已通过远端 CI
- [ ] 在候选机器安装当前 main 构建并重启 DSH Web
- [ ] 确认弹层更新栏显示 v1.0.1（本地开发模式字样属正常）
- [ ] 清理同版本旧证据：`rm -rf .artifacts/release-gates/v1.0.1`

## 四皮肤半自动 gate（证据仅落本地）

`--gate` 默认从 `package.json.version` 推导输出目录；本版本应输出到 `.artifacts/release-gates/v1.0.1/`：

- [ ] `node scripts/capture-previews.mjs --skin tgcf --gate` → `GATE PASSED`
- [ ] `node scripts/capture-previews.mjs --skin meirenzhi --gate` → `GATE PASSED`
- [ ] `node scripts/capture-previews.mjs --skin openbmc --gate` → `GATE PASSED`
- [ ] `node scripts/capture-previews.mjs --skin uefi-harness --gate` → `GATE PASSED`
- [ ] 每次输出含 `personalization evidence frame settled`，且记录 shell ≥600px、panel ≥240px，证明截图不是宽度扫动中的列表-only 瞬间
- [ ] 目录内恰有四张人工可读证据：`{tgcf,meirenzhi,openbmc,uefi-harness}-personalize.webp`
- [ ] 人工查看四张证据：目标皮肤、个性化面板、隐私规程均正确，无会话内容泄露

## 1.0.1 专项验收

- [ ] 双窗口基于同一修订号打开个性化面板；窗口 A 先完成自动保存，窗口 B 随后编辑时可自动 refetch 并基于新修订号重试，最终持久化且 dirty preview 清空
- [ ] 冲突无法自动化解时显示「配置已在其他窗口更新，请重试」，不出现 synced+normal+dirty 且无警示的静默状态
- [ ] offline / recovery / unsupported-readonly 继续由各自状态条承接，不误显示修订号冲突
- [ ] 下次实际编辑会清除冲突警示并重新安排 ADR-0003 自动保存；不要求任意后续 refetch 自动重排 flush

## 文档截图策略

- [ ] 本补丁未改变 README 常态视觉，**不重拍** dark/light/switcher 或现有 `*-personalize.webp`
- [ ] `git diff --exit-code -- docs/assets` 通过，证明 gate 没有污染 tracked 文档资产
- [ ] 未来只有 README、视觉样式或截图引用变化时才显式执行：`node scripts/capture-previews.mjs --skin <id> --out docs/assets`

## 自动化门禁

- [ ] `PATH="$PWD/.artifacts/node-v22.21.1-linux-x64/bin:$PATH" pnpm run check` 全绿
- [ ] `PATH="$PWD/.artifacts/node-v22.21.1-linux-x64/bin:$PATH" node scripts/verify-release.mjs` → `dsh-skins@1.0.1 OK`
- [ ] `node scripts/rehearse-upgrade-1.0.0.mjs` → `REHEARSAL PASSED`
- [ ] 重建后 `git diff --exit-code -- lib/client.js lib/index.js` 通过
- [ ] `git status --short` 干净

## 收尾与 Release

- [ ] 远端 main 包含候选提交，远端 CI 全绿
- [ ] 以上全部勾选后创建 `v1.0.1` tag，按 stable Release 流程发布
- [ ] Release 验证完成后，可删除本地证据：`rm -rf .artifacts/release-gates/v1.0.1`

> 删除 `.artifacts` 证据不会影响 Git、README 或 npm 包；现有 `docs/assets/*-personalize.webp` 作为 1.0.0 历史证据保留，不在本版本删除。
