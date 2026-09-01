# 1.0.0 发版手工清单（打 tag 前的显式前置条件）

> 以下步骤需要一台装好 1.0.0 候选构建的 DSH Web GUI。每步记录「实际结果」与证据路径；
> 任何一步失败即停止发版。此清单为设计 §14/§13 手工 gate 的落地（评审 Y12）。

## 准备

- [ ] 在候选机器安装本地构建：`dsh plugin --profile web add link:<仓库路径>`，重启 DSH Web
- [ ] 确认版本：弹层更新栏显示 v1.0.0（本地开发模式字样属正常）

## 自动化 gate（半自动）

> 美人志（meirenzhi）入列后齿轮数为 4，且 `--skin` 现在真正决定 gate 操作的皮肤
> （旧实现恒操作列表最后一张卡）。四套皮肤各自的 gate 都要通过：

- [ ] `node scripts/capture-previews.mjs --skin tgcf --gate` → 输出 `GATE PASSED`
      （断言：4 个齿轮键盘可达、面板粘连展开、Esc 整壳关闭、保存→标题换装且刷新后保持、
      恢复默认→保存→出厂标语「百无禁忌」复原、静态印章 favicon；截图含隐私门禁）
      证据：终端输出 + `docs/assets/tgcf-personalize.webp`
- [ ] `node scripts/capture-previews.mjs --skin meirenzhi --gate` → `GATE PASSED`
      （恢复默认 → 出厂标语「风起凡尘 · 红颜问道」；掌天瓶 favicon）
      证据：终端输出 + `docs/assets/meirenzhi-personalize.webp`
- [ ] `node scripts/capture-previews.mjs --skin openbmc --gate` → `GATE PASSED`
      （恢复默认 → 出厂标语「察于未萌 · 治于未乱」）证据：终端输出
- [ ] `node scripts/capture-previews.mjs --skin uefi-harness --gate` → `GATE PASSED`
      （恢复默认 → 出厂标语「启于固件 · 行于万象」）证据：终端输出
- [ ] `node scripts/capture-previews.mjs --skin tgcf`、`--skin openbmc`、`--skin meirenzhi` 重拍全部截图
      证据：`docs/assets/{tgcf,openbmc,meirenzhi}-{dark,light}.webp`、`*-switcher-dark.webp`

## 手工验收（每项记录观察结果）

- [ ] meirenzhi 视觉：亮色暖雾白主视觉 / 深色玄夜蓝紫；12 张内置壁纸切换正常
      （001合照「云台雅集」默认领头，4 合照 + 8 单人，通透度出厂 35）
- [ ] meirenzhi 面板：壁纸一行 6 张共两排（内置 12 张 + 图库）；标语中英出厂
      「风起凡尘 · 红颜问道」/ "From mortal dust, immortals bloom"；编辑/恢复默认走 ADR-0003 自动保存
- [ ] meirenzhi 明暗同图机制：切换外观配色时壁纸不变，仅纱与面板色系切换
      （浅=暖雾白纱、深=玄夜纱）；掌天瓶 favicon/徽章在两态下反色正常；萤火粒子
      reduced-motion 下静止
- [ ] tgcf 视觉：暗色朱红鎏金 / 亮色素白金线；三张内置画作切换正常（月下同伞默认 / 花城、谢怜备选，遮罩单值 35 出厂默认）
- [ ] tgcf 新会话框通透（1.0.0）：浅/深两主题下输入卡片均为玻璃态（input-major 随旋钮联动，非宿主实色），拖动通透度旋钮卡片浓淡随动
- [ ] 自动保存流（ADR-0003）：拖动遮罩/模糊/面板透明度、改标语或换壁纸 → 界面即时生效；
      停顿约半秒自动落库，刷新页面后保持；双标签页 ~1s 内同步；面板内无保存按钮
- [ ] 无确认弹窗（ADR-0003）：有在途修改时点空白 / 换肤 / Esc / 收面板 / 切换皮肤 →
      全部直接执行，绝不弹「放弃未保存的修改」；离线时变更控件禁用
- [ ] 面板随行切换（v2.4.1）：面板展开时点其他皮肤卡片 → 面板即时切到该皮肤；
      点不可个性化皮肤（official）卡片 → 面板收起
- [ ] 面板滚动与常驻操作条（v2.4.1）：720p 矮视口下面板壳顶不出屏、面板列内可滚动
      看全全部内容、「恢复默认/还原/保存」常驻可见；图库缩略图右上角"×"角标删除
- [ ] 宽面板无横向滚动（v2.4.1 #3）：点开面板即整宽呈现、壁纸一行 6 张共两行、
      标语中英输入框并排；<904px 堆叠态网格回落 4 列、无横向滚动
- [ ] 「还原」：丢弃全部未保存修改回到已同步值（离线时同样可用）；「恢复默认」生成待保存的预览
- [ ] 清空图库：确认框列出全部受影响 `皮肤 · 字段` 与不可恢复警示；确认后全部回退默认
- [ ] reduced-motion：系统开启「减弱动态效果」后呼吸/漂浮/光晕停止、面板直接呈现无滑入
- [ ] 双标签页同步：标签 A 保存修改 → 标签 B 聚焦后 ~1s 内同步（BroadcastChannel + focus 兜底）
- [ ] 0.6.0 → 1.0.0 升级演练两段：A. 0.6.0 正式版（空数据，无个性化功能）一键更新到 1.0.0 →
      state.json 首装创建、revision 0、无恢复模式误报；B. 1.0.0-dev 中间版本写入个性化配置 → 更新到新构建 →
      未知键被加载规范化剔除并 revision+1（配置与图库其余部分保留）
- [ ] 新字段往返（ADR-0004）：在 openbmc/uefi 设标语/通透度 → 刷新持久 → 降级到不识别新字段的构建 →
      新字段键被规范化剔除且 revision+1（降级不对称语义，可再升级恢复）
- [ ] 删除被引用图片：确认框高亮受影响皮肤 → 确认后回退默认壁纸
- [ ] 旧皮肤等价：openbmc/uefi 默认视觉与 0.6.0 截图逐像素对照无差异
      （烘焙值 ≡ 0.6.0：两皮肤文件 0 diff；自动化断言=默认投影派生串与烘焙串字节相等，ADR-0004）

## 收尾

- [ ] 截图入库（修复 README 破图引用：tgcf-dark.webp 等）
- [ ] `pnpm run check` + `git diff --exit-code -- lib` 全绿
- [ ] ADR-0004（推翻 §9a，legacy 皮肤全面个性化）已获产品负责人批准
- [ ] 以上全部勾选后：推 `v1.0.0` tag，Release workflow 自动走门禁并发布
