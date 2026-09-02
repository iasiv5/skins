# 修订号乐观锁归还 Host — 1.0.1 实施计划（评审修订版 · 二轮）

## 目标

让配置写路径的修订号前置条件在 Host 侧真实执法：store 在序列化队列内最先校验 `baseRevision`，缺失/非整数/负数/不等于队首时刻修订号即返回 `409 REVISION_CONFLICT`；客户端按错误码显式分派，冲突自动重试一次，重试耗尽经警示条上浮（补全 ADR-0003「仍失败才上浮」承诺）。

**范围裁决（已定）**：本轮只锁 **config 字段 PATCH**（`applyOperations`）。图库上传/单删**不加**前置条件，登记为已知缺口，随「清空图库原子命令」的协议设计一并裁决——该设计将重整图库写路径，现在为上传/删除加前置条件会立即被重做。依据：CONTEXT.md 修订号词条原文为「**配置的**乐观锁计数」；设计文档 §2「全局 revision 覆盖一切可见状态提交」约束的是**计数器范围**（三种提交共用一个计数），并未规定每种写都携带前置条件。同步锐化 CONTEXT.md 修订号词条，写明「写入」指配置字段写入，图库增删为已登记缺口。

**main 分支授权（已定）**：用户已明确批准本次直接在 `main` 开发。不得 push、不得打 tag；仅在全部门禁通过后创建一个 checkpoint commit，提交包含本计划、源码、测试与重建的 `lib/` 产物，无无关改动。

## 架构快照

写路径现状：个性化面板 → `configClient.flushNow()`（400ms 防抖，PATCH 体携带 `baseRevision: snapshot.revision`）→ `personalization-routes.js` 透传 → `store.applyOperations({ operations })` **丢弃 baseRevision**，队列内直接提交并 `revision += 1`。修订号前置条件只存在于客户端约定，真实 Host 永不产生 409 冲突；唯一覆盖该路径的测试使用伪造码 `IMPORT_CONFLICT`。

改后：`applyOperations` interface 变为 `applyOperations({ baseRevision, operations })`；`enqueue` 回调内第一道检查即修订号比对，`operations` 结构校验移入队列、置于其后；`CODE_STATUS` 将 `REVISION_CONFLICT` 映射为 409。客户端 flushNow 的 409 分支按 `body.code` 分派，新增机器可读状态 `lastFlushCode`，与 `lastFlushError` 构成互斥对，由单一内部 helper 写入。

## 错误优先级矩阵（由测试钉死）

| # | 请求情形 | 结果 | 检查位置 |
|---|---|---|---|
| 1 | JSON 体不可解析 / content-type 非 JSON | `400 INVALID_CONFIG`（路由层，现状不变） | 路由 readJsonBody |
| 2 | store 处于 recovery / unsupported | `409 STORE_RECOVERY_REQUIRED` / `STORE_READONLY`（进入 store 后优先于 base/operations 校验，现状不变） | requireNormal（队列外） |
| 3 | normal + baseRevision 缺失/非整数/负数/≠当前修订号 | `409 REVISION_CONFLICT` | enqueue 回调**第一道** |
| 4 | normal + 有效 base + operations 结构非法（op/字段未知等） | `400 INVALID_CONFIG` | enqueue 回调，修订号之后（自队列外移入） |
| 5 | normal + 有效 base + 值校验失败 | `400 INVALID_CONFIG`（现状不变） | enqueue 回调 |

即：同时携带非法 base 与非法 operations 的请求按 3 优先返回 409——「不设 400 旁路」以矩阵第 3 行为准；现有路由测试「缺失 base + 非法 ops → 400」（tests/personalization-routes.test.mjs:106–116）补有效 baseRevision 后改为验证第 4 行。

## 全局约束（自设计共识逐字继承 + 评审修订）

- 修订号比对必须发生在序列化队列**内**（enqueue 回调第一道），防 TOCTOU；`operations` 结构校验随之移入队列并置于其后，`requireNormal` 保持队列外优先。
- **冲突重试前置条件**：仅当冲突后的 `refetch()` 确实应用了新快照（`status === "synced"` 且 `mode === "normal"` 且 `revision !== attemptedRevision`，其中 `attemptedRevision` 为首次 PATCH 发送前记录的 `snapshot.revision`）才允许发送第二次 PATCH；否则**不发**第二次 PATCH，dirty 预览保留，两个失败字段按网络静默裁决清空，返回按实际状态（如 `{ flushed: 0, blocked: "offline" }`；refetch 落地为 recovery 态则 `{ flushed: 0, blocked: "recovery" }`），由 offline/恢复状态条负责提示。防的是「GET 失败/被丢弃后仍用旧 baseRevision 盲重试」——ADR-0003 要求重试建立在**新快照**之上。
- 错误码命名固定 `REVISION_CONFLICT`；响应体走既有 `codedError`/`publicError` 通道（`{ error, code }`）。
- 客户端遵守 ADR-0003：冲突自动 refetch + 恰好重试一次；耗尽才上浮；下次编辑自动清除警示。
- **零存储格式变更**：`CONFIG_VERSION` 保持 1，`state.json` 结构不动。
- **零副作用承诺（测试钉死）**：冲突拒绝路径不递增 revision、不改 overrides、**不写盘**（注入计数 fs 断言）。
- dicts 规则：`zh` 为键集真源，`en` 键全且 `{placeholder}` 对齐（parity 测试自动盯新词条）。
- `lastFlushCode` 与 `lastFlushError` **互斥**：每次赋值必须经单一内部 helper 同时写两字段，任何时刻至多一个非空。
- 不改动：400ms 防抖写穿、`STORE_READONLY` 降级语义、per-skin `project()`、图库操作即时生效、上传/单删协议。
- 环境前提：Node 22.x（CI 钉死；本机 PATH 为 24，最终门禁必须用 `.artifacts/node-v22.21.1-linux-x64/bin` 下的 node 22 再跑一遍）、pnpm 10.34.5、`pnpm install --frozen-lockfile`（当前工作区 `node_modules` 缺失，已实测 esbuild 不可解析）。

## 文件结构与职责

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/host/personalization/store.js` | 修改 | `applyOperations` 接收 `baseRevision`，队列内最先比对；结构校验移入队列其后 |
| `src/host/personalization-routes.js` | 修改 | `CODE_STATUS` 增 `REVISION_CONFLICT: 409` |
| `src/client/personalization/config-client.js` | 修改 | 409 按码分派；`setFlushFailure(code, message)` helper 与 `lastFlushCode` 状态；头部 stale 注释（ADR-0001 显式保存、冲突进 lastFlushError 的描述）同步更正 |
| `src/client/dicts.js` | 修改 | 新词条 `personalization.saveConflict`（紧邻 zh:87 / en:223 的 `saveFailed`） |
| `src/client/personalization/panel.js` | 修改 | 冲突警示条分支（优先于 `lastFlushError` 条）；386–387 行 stale 注释更正 |
| `CONTEXT.md` | 修改 | 修订号词条锐化：写入=配置字段写入；图库增删为已登记缺口 |
| `tests/personalization-store.test.mjs` | 修改 | 助手与直调补有效 base；改写既有并发测试为 TOCTOU 回归；新增过期/缺失/非法/零写盘测试 |
| `tests/personalization-routes.test.mjs` | 修改 | 修正三处既有 PATCH fixture（106–116、~190–195、~270–275）；新增 stale/缺失/非法 base 的 HTTP 契约测试 |
| `tests/config-client.test.mjs` | 修改 | 伪造码换真码；新增耗尽上浮、恢复分派、恢复 refetch 失败、未知 409、排队 flush 互斥测试 |
| `tests/personalization-panel.test.mjs` | 修改 | 冲突警示条渲染及与保存失败条互斥测试 |
| `scripts/rehearse-upgrade-1.0.0.mjs` | 修改 | 67–70 行 `applyOperations` 调用补 `baseRevision: writer.snapshot().revision` |
| `scripts/verify-bundle-guard.mjs` | 修改 | bundle 预算基线有意识棘轮上调（执行期裁决，第四轮评审修正数字）：`BASELINE_CLIENT_BYTES` 748,467 → **770,785**、`SLACK_BYTES` 20,480 语义不变。精确账目：origin/main 实测 `lib/client.js` 6,821,584，扣 base64 壁纸 6,053,088 后旧代码体量 **768,496**，距旧上限（748,467+20,480=768,947）仅剩 **451** 字节；本次新增 **2,289** 字节审批内客户端代码，超出旧上限 **1,838**；新基线 770,785 = 当前实测代码体量（6,823,873−6,053,088），较旧基线增 22,318 = 吸收此前已耗 slack 20,029 + 本次新增 2,289。守卫为防意外膨胀绊线，有意识增长即棘轮，未来意外膨胀仍有完整 20,480 字节绊线 |
| `package.json` | 修改 | `version` 1.0.0 → 1.0.1 |

重建产物 `lib/client.js`、`lib/index.js` 随任务 5 门禁生成并入库。稳定边界：`snapshot()` 返回形状、`publicState()` 既有字段、面板既有警示条机制、路由信任围栏。

## 任务清单

### 任务 1 · store 队列内执法 baseRevision + 全部直调调用方（TDD）

**Consumes**：`applyOperations({ operations })`（store.js:436，结构校验在队列外 439–452）、`enqueue`（:213）、`snapshot()`（:412）、`codedError`、`createPersonalizationStore({ dataDir, fs })` 的 fs 注入（:157）。
**Produces**：`applyOperations({ baseRevision, operations })`；按错误优先级矩阵第 3 行拒绝（消息「配置已被其他会话修改（修订号过期），请刷新后重试」）；拒绝路径零副作用（不 bump revision、不改 overrides、不写盘）。

**调用方盘点（完成条件）**：`git grep -n "applyOperations(" -- src tests scripts` 的**全部**匹配逐条人工分类：① store 函数定义；② 路由协议透传（`store.applyOperations(body)`）；③ 携带有效 `baseRevision` 的直调（测试助手、直调用例、演练脚本）；④ 刻意缺失/非法/过期 `baseRevision` 的负例测试。验收标准：**零未分类调用**，不使用固定条数（本轮新增冲突测试会继续增加匹配数）。

步骤：

1. 先改测试与调用方（预期先红）：
   - `tests/personalization-store.test.mjs` 助手 `setOverride`（:65）改为先取 `store.snapshot().revision` 传入；直调 5 处（:165、:174、:189、:193、:211）同样补齐。
   - `scripts/rehearse-upgrade-1.0.0.mjs`（:67–70）补 `baseRevision: writer.snapshot().revision`。
   - **改写既有并发测试**（:457–466「interleaved mutations from two clients never lose each other's fields」）为 TOCTOU 回归：捕获同一 `const base = store.snapshot().revision`；在**任何 await 之前**连续发起两个 `applyOperations({ baseRevision: base, ... })`（不同皮肤不同字段）；`Promise.allSettled` 断言恰好一 fulfilled 一 rejected（`REVISION_CONFLICT`）；`snapshot().revision` 恰为 `base + 1` 且被拒字段未落地；随后用最新 revision 重试被拒操作 → 成功；最终两字段都在、revision 共 +2。
   - 新增四测：过期 base（`base + 5`）拒绝且 revision/overrides 不变；正确 base 落地且 revision +1；缺失/非法（undefined、`-1`、`7.5`）同 `REVISION_CONFLICT`；**零写盘**——`createPersonalizationStore({ dataDir, fs: countingFs })`（包装默认 fs，计数 `writeFileSync`/`renameSync`），完成一次成功写后清零计数，再发冲突写，断言计数仍为 0。
   - 优先级组合钉子（第四轮评审补充，防未来把 operations 校验重排到 revision 之前）：缺失 base + 非法 operations（空数组）→ `REVISION_CONFLICT`；recovery 模式 + 缺失 base + 非法 operations → `STORE_RECOVERY_REQUIRED`；unsupported 模式 + 缺失 base + 非法 operations → `STORE_READONLY`（复用既有模式测试的造态方式）。
2. 运行 `node --test tests/personalization-store.test.mjs`，确认新测红、被改写的并发测红（REVISION_CONFLICT 不存在）。
3. 实现：签名改 `async function applyOperations({ baseRevision, operations })`；将现有 439–452 行的 operations 结构校验**移入** `enqueue` 回调，置于修订号检查之后；回调第一道：

   ```js
   if (!Number.isInteger(baseRevision) || baseRevision < 0 || baseRevision !== state.revision) {
     throw codedError("REVISION_CONFLICT", "配置已被其他会话修改（修订号过期），请刷新后重试");
   }
   ```

4. 复跑同命令全绿；并运行 `node scripts/rehearse-upgrade-1.0.0.mjs` 确认演练通过。

**验证**：`node --test tests/personalization-store.test.mjs` → exit 0；`node scripts/rehearse-upgrade-1.0.0.mjs` → 通过；调用方盘点分类核对、零未分类。

### 任务 2 · 路由 409 映射、fixture 修正与 HTTP 契约（TDD）

**Consumes**：任务 1 的 store 行为与优先级矩阵；`CODE_STATUS`（personalization-routes.js:16–29）、`makeHarness`/`makeRequest`/`TRUSTED` 脚手架。
**Produces**：`CODE_STATUS` 含 `REVISION_CONFLICT: 409`；HTTP 契约按矩阵第 3/4 行可测。

步骤：

1. 先修三处既有 fixture（此时仍绿，属语义隔离）：
   - :106–116（INVALID_CONFIG 测试）：body 补 `baseRevision: 0`（fresh store），断言不变（400 INVALID_CONFIG，矩阵第 4 行）。
   - ~:190–195（DELETE 测试的前置 PATCH）：补 `baseRevision: 1`（该测试先上传过资产，revision 已为 1；以实际 `snapshot().revision` 为准）。
   - ~:270–275（只读测试）：补 `baseRevision: 5`，断言不变（STORE_READONLY，矩阵第 2 行）。
2. 新增测试（预期先红）：
   a. 合法 operations + `baseRevision: 999` → `409` + `code === "REVISION_CONFLICT"`；紧随用正确 revision 重发 → 200（拒绝后 store 零污染）。
   b. 合法 operations + 缺失 `baseRevision` → 409 `REVISION_CONFLICT`（矩阵第 3 行的 HTTP 面钉死）。
   c. 合法 operations + `baseRevision: -1` / `7.5` → 409 `REVISION_CONFLICT`。
3. 运行 `node --test tests/personalization-routes.test.mjs` 确认新测红（未映射时 sendError 给 500）。
4. 实现：`CODE_STATUS` 增 `REVISION_CONFLICT: 409`。
5. 复跑全绿（既有 happy-path 发 `baseRevision: 0` 与 fresh store 修订号 0 恰合，不受影响）。

**验证**：`node --test tests/personalization-routes.test.mjs` → exit 0。

### 任务 3 · 客户端按码分派与互斥失败状态（TDD）

**Consumes**：任务 2 协议码；flushNow 409 分支（config-client.js:205–219）、`lastFlushError` 生命周期（:63、:84、:226、:235、:290、:298）、`refetch()` 对 recovery 快照的处理；测试脚手架 `makeFetch`/`jsonResponse`/`snapshotBody`/`flushingClient`。
**Produces**：`publicState()` 新字段 `lastFlushCode: "REVISION_CONFLICT" | null`；内部 helper `setFlushFailure(code, message)`（同时写 `lastFlushCode`/`lastFlushError`，保证互斥）；首次 PATCH 前记录 `attemptedRevision`，冲突重试受「新快照已应用」三条件门控；`{ blocked: "recovery" }` 与 `{ blocked: "offline" }` 返回值。

失败状态转移契约（唯一写入口 `setFlushFailure`）：

| flush 结果 | lastFlushCode | lastFlushError |
|---|---|---|
| 冲突重试耗尽（两次 409 REVISION_CONFLICT） | `"REVISION_CONFLICT"` | `null` |
| 普通 HTTP 失败 / 未知 409 | `null` | 服务器消息或 `HTTP <status>` |
| 成功 / 新 preview / previewReset | `null` | `null` |
| STORE_READONLY | `null`（降级态由 status 表达） | `null` |
| STORE_RECOVERY_REQUIRED 且 refetch 取得 `mode:"recovery"` | `null`（恢复态由 mode 表达） | `null` |
| STORE_RECOVERY_REQUIRED 但 refetch 未取得恢复态（如 GET 失败转 offline） | `null` | 服务器消息或「HTTP 409」 |
| REVISION_CONFLICT 后 refetch 落地为 offline / recovery / unsupported（不发第二次 PATCH） | `null` | `null`（专用状态条承接提示） |
| REVISION_CONFLICT 后 refetch 仍 synced+normal 但未取得新 revision（不发第二次 PATCH；含 refetch 响应被 guard 丢弃一类） | `"REVISION_CONFLICT"` | `null`（无其他状态条可承接——必须上浮，下次编辑清除；执行评审第四轮修正：原行误将此子情形并入网络静默裁决） |
| 网络异常（外层 catch） | `null` | `null`（清陈旧提示，预览保持脏、下次编辑重试——维持现状静默） |

409 分派规则：`STORE_READONLY` → 现状不变；`REVISION_CONFLICT` → `await refetch()`，**仅当应用了新快照**（`status === "synced" && mode === "normal" && revision !== attemptedRevision`；`attemptedRevision` 在首次 PATCH 前记录）才 `continue` 重试，耗尽按表置冲突态；refetch 未应用新快照 → 不发第二次 PATCH，按 refetch 落地状态分派：offline-failed → 清两失败字段、`blocked:"offline"`；recovery → 清两失败字段、`blocked:"recovery"`；unsupported-readonly → 清两失败字段、`blocked:"unsupported"`；**仍 synced+normal（revision 未变）→ 置 `lastFlushCode = "REVISION_CONFLICT"` 上浮、`blocked:"conflict"`**（自动保存为 fire-and-forget，无人消费返回值；此态无任何状态条承接，静默即未保存丢失）；`STORE_RECOVERY_REQUIRED` → refetch 后按实际快照判定（恢复态 → `blocked:"recovery"`；否则按表置错误态、`blocked:"error"`）；其他 409 → 按表置错误态、`blocked:"error"`、不重试。

步骤：

1. 先写测试（预期先红）：
   a. 既有冲突重试测试（:293）伪造码 `IMPORT_CONFLICT` 换 `REVISION_CONFLICT`，断言不变。
   b. 耗尽上浮：PATCH 恒返 `409 {code:"REVISION_CONFLICT"}` → 恰两次 PATCH、`lastFlushCode === "REVISION_CONFLICT"`、`lastFlushError === null`、dirty 保留；随后 `preview()` → `lastFlushCode === null`。
   c. 恢复分派：PATCH 返 `409 {code:"STORE_RECOVERY_REQUIRED"}`、GET 返 `snapshotBody({ mode: "recovery" })` → 恰一次 PATCH、`blocked === "recovery"`、`getState().mode === "recovery"`、两失败字段均空。
   d. 恢复 refetch 失败：PATCH 返 `STORE_RECOVERY_REQUIRED`、GET 返 500 → `blocked === "error"`、`lastFlushError` 非空、`lastFlushCode === null`。
   e. 未知 409 fail loud：`409 {code:"SOMETHING_ELSE", error:"boom"}` → 恰一次 PATCH、`lastFlushError === "boom"`、`lastFlushCode === null`。
   f. 排队 flush 互斥：第一个 flush 两次冲突（耗尽置冲突态），其间用户再 `preview()` 使第二个 flush 排队、其 PATCH 返 500 → 最终 `lastFlushError === "HTTP 500"`（或响应体消息）、`lastFlushCode === null`（后写覆盖先写，互斥不破）。
   g. 冲突后 refetch 失败不盲重试：PATCH #1 返 `409 REVISION_CONFLICT`，随后 GET 返 500 → **PATCH 总数严格为 1**、`status === "offline-failed"`、dirtyCount 保留、两失败字段均空（网络静默裁决）、返回 `{ flushed: 0, blocked: "offline" }`。
   h. 「refetch 未产生新 revision 时不重试，且冲突必须上浮」：PATCH #1 返 409，GET 返与旧值相同 revision 的正常快照 → PATCH 总数为 1、dirtyCount 保留、**`lastFlushCode === "REVISION_CONFLICT"`、`lastFlushError === null`**（执行评审第四轮修正：此态 synced+normal 无状态条承接，静默即未保存；面板层冲突警示条渲染已由任务 4 测试覆盖）。以行为命名与断言（重试必须建立在落地的新 revision 之上）；GET 失败、context guard 丢弃响应等一切「快照未应用」路径由同一道门控拦截，本用例不宣称单独验证 context guard 内部流程。
2. 运行 `node --test tests/config-client.test.mjs` 确认新测红。
3. 实现：`setFlushFailure` helper + 三处清除点（成功 :235、preview :290、previewReset :298）与各失败分支统一走 helper；`publicState` 暴露 `lastFlushCode`；409 分派按规则重写。
4. 复跑全绿。

**验证**：`node --test tests/config-client.test.mjs` → exit 0。

### 任务 4 · 面板冲突警示条、词典与注释更正（TDD）

**Consumes**：任务 3 的 `lastFlushCode`；panel statusCluster（:354–393）；dicts zh:87 / en:223。
**Produces**：词条 `personalization.saveConflict`（zh「配置已在其他窗口更新，请重试」/ en「Settings changed in another window; try again」——产品为单用户多窗口场景，避免「他人」暗示协作编辑；备选中性文案 zh「配置发生编辑冲突，请重试」/ en「A settings conflict occurred; try again」，最终以主人偏好为准）；面板冲突条分支；stale 注释更正（config-client.js 头部 :3 与 :20–27、panel.js :386–387）。

步骤：

1. 先写测试（预期先红）：仿「auto-save failure strip renders from lastFlushError」（personalization-panel.test.mjs:307）新增两测——置 `lastFlushCode === "REVISION_CONFLICT"` → 渲染冲突文案且**不**渲染「保存失败」条；置 `lastFlushError`（code 为空）→ 仅渲染保存失败条（互斥渲染钉死）。
2. 运行 `node --test tests/personalization-panel.test.mjs tests/dicts.test.mjs` 确认面板测红。
3. 实现：dicts 两处词条；statusCluster 在 `lastFlushError` 分支之前加 `if (state.lastFlushCode === "REVISION_CONFLICT")` 警示条（同款 `dsh-skins-pz-status dsh-skins-pz-warn`）；更正四处 stale 注释为 ADR-0003 语义 + `lastFlushCode` 描述（config-client.js 头部 :1–27、`preview()` 的 docstring ~:306 仍写 "persists nothing (ADR-0001)"——第四轮评审补充、panel.js :386–387）。
4. 复跑全绿（dicts parity 自动覆盖新键）。

**验证**：`node --test tests/personalization-panel.test.mjs tests/dicts.test.mjs` → exit 0。

### 任务 5 · 域词锐化、版本、全量门禁与 checkpoint commit

**Consumes**：任务 1–4 全部产出。
**Produces**：CONTEXT.md 修订号词条锐化；`package.json` 1.0.1；Node 22 门禁全绿；唯一 checkpoint commit。

步骤：

0. bundle 守卫基线棘轮（执行期已裁决，见文件表 `scripts/verify-bundle-guard.mjs` 行）：`BASELINE_CLIENT_BYTES` 改为 `770_785`，头注释的「pre-meirenzhi baseline」表述更新为记载 1.0.1 棘轮（含改动前压线事实与新基线来历）。
1. `CONTEXT.md` 修订号词条追加一句：「写入指配置字段写入（PATCH）；图库上传/删除暂不携带前置条件，为已登记缺口，随图库写路径的原子化设计一并裁决。」
2. `package.json` `version` → `"1.0.1"`（发布走既有 stable Release + 自更新链路，Release 工单由主人按惯例另排）。
3. 环境准备与门禁（当前工作区 `node_modules` 缺失，已实测）：

   ```sh
   pnpm install --frozen-lockfile
   node scripts/verify-release.mjs        # CI 同款 release preflight
   node --test tests/personalization-store.test.mjs tests/personalization-routes.test.mjs tests/config-client.test.mjs tests/personalization-panel.test.mjs tests/dicts.test.mjs
   node scripts/rehearse-upgrade-1.0.0.mjs
   pnpm run check                          # build + node --check 两产物 + smoke + 全测 + verify:readme + verify:bundle
   ```

   本机 PATH 的 Node 为 24.x；上述命令通过后，用仓库自带的 Node 22 对齐 CI 再全量跑一遍：

   ```sh
   PATH="$PWD/.artifacts/node-v22.21.1-linux-x64/bin:$PATH" node --version   # 应为 v22.21.1
   PATH="$PWD/.artifacts/node-v22.21.1-linux-x64/bin:$PATH" pnpm run check
   PATH="$PWD/.artifacts/node-v22.21.1-linux-x64/bin:$PATH" node scripts/verify-release.mjs
   ```

4. checkpoint commit（含计划文档、源码、测试、CONTEXT.md、package.json、重建的 `lib/` 两产物），建议信息：`fix: store enforces baseRevision optimistic locking; client dispatches REVISION_CONFLICT (ADR-0003)`。提交前用 `git diff --name-status` 与 `git diff --cached --name-status` 核对工作区/暂存区无范围外文件。
5. 提交后验证：
   - `git show --name-status --format= HEAD` 逐文件核对 checkpoint commit 清单与「文件结构与职责」表一致（不使用固定文件数作验收）；
   - `git log --oneline origin/main..HEAD` 恰为本次 checkpoint commit 一条、`git rev-list --count origin/main..HEAD` 为 1（基线钉在 origin/main）；
   - 生成物可复现（CI 同款，明确 Node 22）：`PATH="$PWD/.artifacts/node-v22.21.1-linux-x64/bin:$PATH" pnpm run build` 后 `git diff --exit-code -- lib/index.js lib/client.js` 无差异；
   - `git status --short` 干净。
6. 输出修改摘要（按 `git show --name-status` 清单逐文件说明变更性质与测试净增量）。

**验证**：任务 5 步骤 3 全部命令 exit 0；步骤 5 四项全部满足。

## 任务间接口契约汇总

- 任务 1 → 任务 2：store 以 `codedError("REVISION_CONFLICT", …)` 按优先级矩阵拒绝；错误经 `publicError` 序列化为 `{ error, code }`。
- 任务 2 → 任务 3：HTTP 契约——`409` + `body.code`（`REVISION_CONFLICT` / `STORE_RECOVERY_REQUIRED` / `STORE_READONLY`）。
- 任务 3 → 任务 4：`publicState().lastFlushCode ∈ { "REVISION_CONFLICT", null }`，与 `lastFlushError` 互斥、生命周期同步；面板只消费该字段与 `tr("personalization.saveConflict")`。
- 任务 5 消费全部产出，产出可发布状态。

## 执行纪律

- 开始实现前，先批判性复查整份计划；发现缺项、矛盾、命名不一致或验证命令无效，先修计划再动手。
- 已获用户授权直接在 `main` 开发：不 push、不 tag，仅门禁全绿后一个 checkpoint commit。
- 按任务顺序执行，不无声跳步、合并步或改变任务目标。
- 每完成一个任务，运行该任务定义的验证；失败即停，说明而非猜测。
- 全部任务完成后运行任务 5 的最终验证并输出修改摘要。

## 最终验证

1. 五个定向测试文件 + `pnpm run check` 在 **Node 22** 下全绿（含重建产物 `node --check`、smoke、全部单测、README 配对、bundle 守卫）。
2. `node scripts/verify-release.mjs` 与 `node scripts/rehearse-upgrade-1.0.0.mjs` 通过。
3. commit 后以 Node 22 重跑 build：`git diff --exit-code -- lib/index.js lib/client.js` 为空（产物可复现）。
4. `git show --name-status --format= HEAD` 与文件职责表逐一相符；`git rev-list --count origin/main..HEAD` 为 1。
5. 放行标准（逐项核对）：锁范围与 Spec 不再矛盾（含 CONTEXT.md 锐化落盘）；错误优先级矩阵有测试钉死；既有并发测试已改写为 TOCTOU 回归；全仓 `applyOperations(` 匹配零未分类；冲突后 refetch 失败/未应用新快照时**不发第二次 PATCH** 由测试证明；`lastFlushCode`/`lastFlushError` 互斥由测试证明；升级演练通过；Node 22 门禁通过；产物可复现；`main` 上仅一个预期 checkpoint commit、无 push、无 tag。
