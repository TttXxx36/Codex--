# Codex++ 只读证据驱动分析与 P0–P3 任务草稿

> 研究日期：2026-09-06（Asia/Shanghai）  
> 研究对象：[`TttXxx36/Codex--`](https://github.com/TttXxx36/Codex--) 的 `Gemini` 分支  
> 锁定 HEAD：`07ca54c0f1e96dd708c8eb785e98d64c747282b5`（对应 release `v1.2.57-gemini.2`）  
> 基线文档版本：报告与开发计划都写作 `v1.2.56`，与当前 fork HEAD 的发布标签存在版本漂移。

## 0. 范围、方法与证据等级

本稿按用户指定的三个入口进行只读研究：

1. [仓库 `TttXxx36/Codex--`](https://github.com/TttXxx36/Codex--)；
2. [深入分析报告](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md)；
3. [开发计划 `DEVELOPMENT_PLAN.md`](https://github.com/TttXxx36/Codex--/blob/Gemini/DEVELOPMENT_PLAN.md)。

补充核对了 fork 的 GitHub API 元数据、工作流与 release Actions，以及其父仓库公开 Issue。父仓库 Issue 不是用户指定的三个主要来源，只作为“用户反馈/维护者处理状态”的补充证据，不把它们误写成 fork 自己的 Issue。

证据标签：

- **[R] 报告明确**：深入分析报告直接写出的结论、数字或路线；
- **[P] 计划列出**：`DEVELOPMENT_PLAN.md` 的 Plan/Actual/Results 状态；
- **[S] 源码核验**：在当前 HEAD 源码中找到的实现事实；
- **[F] 反馈**：父仓库公开 Issue 中的用户描述；
- **[A] Actions/API 核验**：当前 fork 的公开 GitHub 元数据、release 或 Actions 状态；
- **[U] 未确认**：只能由运行时、指定版本客户端或 CI 产物证明，本次未执行。

本次没有 clone、构建、启动桌面端、连接 CDP、发起真实供应商请求或修改远程仓库；API Key、Token、账号和会话内容不纳入稿件。所有性能百分比、故障率和“工业级/瞬时”等表述都保留其来源边界，不当作本次测量结果。

## 1. 一句话结论

Codex++ 是一个以 Rust/Tauri 管理器和无窗口 launcher 为入口、通过 CDP 向官方 Electron `app://-/` 渲染端注入脚本，并在本地提供 Bridge、Responses↔Chat 协议代理、供应商路由、SQLite 会话治理和备份恢复的桌面增强套件；当前最应先处理的是“认证/配置切换不产生错误凭据”和“launcher/57321/bridge 失败后确定停止或退避”，再处理渲染层全局观察器、协议兼容性和大型前端拆分。

## 2. 项目架构与组织结构

### 2.1 分层拓扑

```text
用户
 ├─ Codex++ 静默 launcher
 └─ Codex++ Manager（Tauri 2 + React 19 + TypeScript + Vite）
       │ invoke / 本地 HTTP / WebSocket
       ▼
Rust codex-plus-core
 ├─ 进程启动、单实例、CDP target 选择与 Runtime/Page 注入
 ├─ Local Bridge 与诊断日志
 ├─ 57321 protocol proxy：Responses ↔ Chat Completions
 ├─ RelayProfile、官方/混合/pure API/aggregate 路由与模型目录
 └─ provider switch、配置/认证文件原子写入、状态与恢复
       │
       ├─ codex-plus-data：SQLite 适配、会话列表/删除/undo、rollout 读取、备份
       ├─ assets/inject/renderer-inject.js：官方 renderer 页面增强
       ├─ services/share-site：会话分享站点代码（当前后端分享路径被阻断）
       └─ tools/scripts/docs：微信桥、安装打包、国际化检查、文档
       │
       ▼
官方 Codex/ChatGPT Electron + OpenAI 或第三方兼容 API
```

报告把该架构概括为“**双桌面入口 + Rust 核心守护与网关 + 注入式渲染增强 + Tauri 管理控制台**”，并明确“不修改官方二进制、`app.asar` 或安装目录文件”，主要依据见[报告第 2 节](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L21-L24)和[拓扑图](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L28-L91)。这是架构定位，是否在所有发行版本中仍保持非侵入性，仍应由安装包与运行时检查证明。

### 2.2 目录与职责

| 区域 | 当前职责 | 证据 |
|---|---|---|
| `apps/codex-plus-launcher` 的入口逻辑，以及 `crates/codex-plus-core/src/launcher.rs` | 启动官方应用、分配/选择 debug 与 helper 端口、注入、watchdog、退出清理 | [报告目录表](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L93-L120)；[launcher.rs](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-core/src/launcher.rs) |
| `apps/codex-plus-manager` | 16 类功能面板、设置/供应商/会话/上下文/增强功能和 Tauri invoke 调用；主 UI 仍集中在 `App.tsx` | [manager `lib.rs`](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/apps/codex-plus-manager/src-tauri/src/lib.rs#L19-L212)；[报告债务评估](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L274-L286) |
| `crates/codex-plus-core` | 设置、relay、CDP、Bridge、协议转换、模型目录、诊断、分享/更新和路由命令 | [workspace `Cargo.toml`](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/Cargo.toml#L1-L38)；[Tauri invoke 映射](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/apps/codex-plus-manager/src-tauri/src/lib.rs#L19-L212) |
| `crates/codex-plus-data` | 动态识别不同 SQLite schema；列出会话/automation run；删除前备份，事务删除，文件删除，undo 冲突检查 | [storage.rs 删除与 index 清理](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-data/src/storage.rs#L13-L70)；[列表查询](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-data/src/storage.rs#L210-L332) |
| `assets/inject` | 将 renderer 注入脚本以内嵌资源带入运行时，提供 Statsig 快速启动、粘贴净化、菜单/模型/会话/皮肤等增强 | [报告第 3.6 节](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L217-L224)；[assets.rs](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-core/src/assets.rs) |
| `.github/workflows` | Issue triage、PR 构建产物、Windows release、手动全平台 release | [当前 PR workflow](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/.github/workflows/pr-build.yml#L1-L51)；[Windows release](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/.github/workflows/release-assets-windows.yml#L1-L118) |

当前 fork API 元数据显示：仓库为公开 AGPL-3.0 fork，默认分支为 `Gemini`，父仓库为 `BigPizzaV3/CodexPlusPlus`；fork 自己的 Issue 计数为 0。它在 2026-09-06 已发布两个 `v1.2.57-gemini.*` release；`v1.2.57-gemini.2` 的 Windows release run 成功，`v1.2.57-gemini.1` 的 Windows、macOS x64、macOS arm64 和 `latest.json` jobs 成功。该事实只证明对应 Actions job 的流程成功，不证明桌面端运行时、真实 API 或性能目标已通过。

## 3. 技术机制

### 3.1 CDP 注入与生命周期

当前设计的关键链路是：

1. launcher 启动官方应用并附加 remote debugging 参数；
2. CDP `/json` 探测并验证 loopback、`app://-/` URL 与 websocket target；
3. 通过 `Page.addScriptToEvaluateOnNewDocument` 覆盖后续页面，并用 `Runtime.evaluate` 立即作用于当前页面；
4. Bridge 以 generation/health-check 方式处理重注入与旧请求；
5. watchdog 周期性检查 browser identity、宠物 overlay 和 bridge，必要时重注入。

报告称 watchdog 在“数百毫秒”内感知刷新；但当前 `launcher.rs` 的源码交叉核验显示 watchdog interval 为 **5 秒**，因此该性能表述不能直接从当前实现推出，应改成“目标/待测量”。源码还显示：启动完成后会在注入失败时写入 `running_degraded`，并保留后续等待，而不是把所有异常都当成启动失败。[当前 watchdog 实现](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-core/src/launcher.rs#L438-L481)、[watchdog 5 秒周期](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-core/src/launcher.rs#L937-L992)。

### 3.2 本地 Bridge、协议代理与 SSE

报告描述的 `protocol_proxy.rs` 是约 4,600 行的双向转换器：将 Responses 请求映射为 Chat Completions `messages`/tool calls，并将上游 SSE `delta.content`、reasoning 等重新封装为 Responses 事件。当前架构还包含本地 Bridge 的 HTTP/WebSocket 命令路由和诊断事件。

这是一条高风险边界：协议转换错误不会只表现为 UI 瑕疵，可能变成 400、401、工具不可用、图片输入错误、call id 丢失或对话循环。因此协议任务要以“按 provider/model capability 的契约测试”作为验收，而不是只测试一个文本请求成功。

### 3.3 供应商模式与切换

报告列出四种模式：官方登录、官方登录 + API 混入、纯 API、聚合供应商；聚合模式支持 failover、conversation round-robin、request round-robin 和 weighted round-robin。[报告模式表](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L183-L200)。

当前源码有一定保护：`switch_relay_profile_in_home` 先捕获 `config.toml`/`auth.json` 快照，保存设置并应用目标 profile；失败时回滚 settings 和实时文件。[切换入口与回滚](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-core/src/relay_switch.rs#L18-L67)。`PureApi` 会把 API key 写入 `auth.json`，官方混合模式会去掉 `auth.json` 的 `OPENAI_API_KEY`。[配置应用分支](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-core/src/relay_config.rs#L521-L552)。

但环境冲突检测当前只按 `OPENAI_` 前缀判断，并把选中的名称从 process env 和 Windows user env 直接移除，没有证明其值是否等于当前配置或是否属于当前 profile。[检测](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-core/src/env_conflicts.rs#L36-L79)、[移除](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-core/src/env_conflicts.rs#L96-L134)。这解释了为什么 Issue #2074 应优先按“值、来源、目标 profile、回滚”拆开，而不能只加一个提示文案。

### 3.4 模型目录与上下文窗口

模型目录生成器把模型窗口和自动压缩阈值拆到 `model_windows` 等映射，避免把 `[1M]` 后缀长期污染模型名；报告将它描述为 `model_catalog_json` 的动态合成机制。[报告第 3.4 节](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L201-L206)。这是配置投影，不能单凭配置文字证明上游模型真实支持 1M，也不能证明已经改善 FPS 或 token 成本。

### 3.5 SQLite 会话治理

`SQLiteStorageAdapter` 的当前行为包括：

- 按 schema 动态读取 `threads` / `automation_runs` 列；
- `threads` 列表排除子 agent thread，按 `updated_at` 或 fallback 时间降序，再以 id 降序并 `LIMIT`；
- 删除前写 backup，事务删除相关行，并尝试删除 rollout 文件和 `session_index.jsonl`；
- 当纯 API 的 DB 表不含 UI 需要的记录时，提供从 `session_index.jsonl` 清理的 fallback；
- undo 先校验恢复冲突，再事务恢复 DB 行和文件。

相关实现见[列表与排序](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-data/src/storage.rs#L210-L332)、[删除备份/事务/文件处理](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-data/src/storage.rs#L494-L636)。源码观察到列表每次打开 DB 并探测 schema，查询含动态列、`NOT EXISTS` 和排序；当前未见针对实际 schema 的专用索引、keyset 分页或 `EXPLAIN QUERY PLAN` 基线，故只能列为 P2 性能任务，不能断言已有数据库性能回归。

## 4. 性能指标、技术债务与限制

### 4.1 报告/计划明确写出的指标

| 指标/表述 | 来源 | 证据状态 |
|---|---|---|
| renderer 空闲不应出现 30%–50% CPU；纯 API patch 失败应停止/退避 | 父仓库 Issue #2043 的用户测量 | [F] 有具体采样，但针对上游 v1.2.56 + macOS；fork 当前版本是否复现/修复未测 |
| 计划 T2 目标：渲染端 DOM/stream 优化降低 CPU **40%** | [DEVELOPMENT_PLAN T2](https://github.com/TttXxx36/Codex--/blob/Gemini/DEVELOPMENT_PLAN.md#L146-L153) | [P] 目标值，不是本次测量结果 |
| 计划 T3：消除 App.tsx 输入/击键延迟 | [DEVELOPMENT_PLAN T3](https://github.com/TttXxx36/Codex--/blob/Gemini/DEVELOPMENT_PLAN.md#L157-L163) | [P] 尚无输入延迟基线 |
| 报告宣称 watchdog “数百毫秒”自愈、Statsig 启动“数倍跃升” | [报告 3.1、3.6](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L126-L142)；[报告 3.6](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L217-L224) | [R] 表述明确；[U] 无可重放 benchmark，且 watchdog 与当前源码 5 秒 interval 不一致 |
| 报告称 manager 内存数十 MB、冷启动瞬时，协议经过工业级 API 验证 | [报告优势](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L261-L272) | [R] 仅为报告结论；[U] 没有样本、环境、分位数、前后对照或 CI artifact |
| `App.tsx` 超过 11,300 行、renderer 超过 10,600 行 | [报告债务](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L274-L286) | [R] 量级判断成立；[S] 当前 HEAD 约 11,209 / 10,451 行，报告为四舍五入/版本漂移 |

### 4.2 当前应保留的性能基线

在实际实现或 CI 之前，建议把以下数据写成固定测试协议：

1. `pureApi + whitelist unlock + 缺失 app-server candidate`：连续 3 分钟记录 CPU、JS script duration、GC、`querySelector*`、DOM nodes/listeners 增量和 patch 尝试次数；
2. 流式输出固定 prompt：记录 50/100 token/s 下 p50/p95 frame gap、输入延迟和 renderer 主线程占用；
3. launcher 连续启动/退出/重启 100 次：记录 57321 bind 成功率、等待时间、TIME_WAIT、bridge generation 和最终状态；
4. manager 在每个路由首次进入/返回时记录 bundle 加载、首屏时间和输入事件到可见值的延迟；
5. SQLite 用合成的 1k/10k/100k sessions 测试首屏列表、翻页、搜索和删除/undo，保存 `EXPLAIN QUERY PLAN` 文本和 p50/p95。

所有百分比（包括计划中的 -40%）在完成前都应标记为“目标/假设”，不得写成保证。

## 5. 已明确的问题与用户反馈

### 5.1 报告本身的反馈边界

深入分析报告第 1 节用“全球开发者普遍面临”描述配额、第三方模型、负载均衡、会话治理和启动/交互痛点，但没有 Issue 编号、用户原话、复现环境、时间或可追溯链接。因此这些内容可作为产品定位，**不能单独计为用户反馈统计或已验证 Bug**。报告第 5 节的 DOM coupling、57321 冲突、Linux 缺失、E2E 不足是技术债务判断，不是故障复现报告。

### 5.2 父仓库公开 Issue 的补充反馈

| 优先候选 | Issue 与状态（研究时） | 用户证据与影响 | 与当前 fork 的关系 |
|---|---|---|---|
| 认证/配置切换 | [#2074](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2074)，open | 用户称 Windows `OPENAI_API_KEY` 与 `auth.json` 完全一致仍被误报；点击清理后变成其他历史 key；Manager API 测试成功但启动后的 Codex 401 缺少 Authorization；另含图标偶发丢失和 Markdown/TOML 粘贴污染。[Issue 原文](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2074#L155-L209) | [F] 严重症状尚未在当前 fork 运行时复现；[S] 当前环境检测确实按前缀并可直接移除，切换虽有 config/auth 回滚但无值级授权判定 |
| 诊断与真实请求不一致 | [#2040](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2040)，open | 维护者提醒“诊断成功”只证明连通性，不能证明当前 provider 的 `requires_openai_auth`/认证门控正确；用户反馈每次切换都要手改配置 | [F] 适合作为 P0 认证契约测试，不应只增加 ping 测试 |
| renderer 无限扫描/空闲高 CPU | [#2043](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2043)，closed | macOS v1.2.56 记录空闲 CPU 约 33%–53%、RSS 1.2–1.6 GB；3 秒 CDP 采样含 ScriptDuration 0.755s、RecalcStyleCount 326、+274 nodes、+181 listeners、candidateCount 1895。[Issue 原文](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2043#L155-L189) | 维护者称父仓库 commit `5a3ed5c` 已加入冷却/失败阈值/in-flight 去重；当前 fork HEAD 的 renderer 仍能看到 pureApi 分支提前 return 后按约 250ms retry 的旧逻辑，需做 fork parity 验证 |
| launcher/CDP 无限轮询 | [#2045](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2045)，closed | Windows v1.2.56 报告最长 231 次失败跨 3.5 小时、`conn_refused` 1540 次、重注入失败率 91%（574/631）；期望检查进程存活、指数退避、避免 Runtime.evaluate 超时触发 generation thrash。[Issue 原文](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2045#L155-L184) | 维护者称 `5a3ed5c`/后续 `2093` 已加入保护；当前 fork launcher 的 watchdog interval 仍为 5 秒且 helper bind 仍为固定 6 秒/200ms，是否已包含完整修复必须以源码 diff + runtime 测试确认 |
| 启动卡死 | [#2065](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2065)，open | 用户称测试 API 成功后点击重启，Codex++ 只留在后台进程，手动打开也不行，但未提供日志。[Issue 原文](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2065#L155-L186) | [F] 可信度/根因信息不足；应由 launcher 状态机和进程转储补证，不宜直接归因于 57321 |
| GLM 图片输入 | [#2031](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2031)，open | `glm-5.3-flash` 的 Responses→Chat 转换保留 data URL 时上游 400；同一图片去掉 `data:image/...;base64,` 前缀后 200，远程 URL 也 200。[Issue 原文](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2031#L155-L230) | [F] 特定模型/供应商兼容差异，不能全局剥离 data URL；需要 capability matrix 和转换契约 |
| DeepSeek 对话循环/ID 丢失 | [#2026](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2026)，open | 用户称流式过程中 call_id 正常，但 `output_item.done` 和最终 `response.completed` 的 ID 被清成 `fc_`/空字符串。[Issue 原文](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2026#L155-L183) | [F] 直接指向 SSE 状态机和事件关联，尚无完整复现样本 |
| WeChat sandbox 枚举不匹配 | [#2116](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2116)，open | WeChat 调 app-server 传 `read-only`/`workspace-write`，但目标 Codex 只接受 `readOnly`/`workspaceWrite`/`dangerFullAccess`。[Issue 原文](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2116#L155-L185) | [F] 一个明确的协议枚举适配任务，适合加入兼容性契约测试 |
| Computer Use tool 类型不兼容 | [#1225](https://github.com/BigPizzaV3/CodexPlusPlus/issues/1225)，open | MiMo Responses 配置下原生 Computer Use 触发 `tool type 'custom' is not supported`；Issue 分析指出第三方网关只接受 `function`。[Issue 原文](https://github.com/BigPizzaV3/CodexPlusPlus/issues/1225#L155-L195) | [F] 需要按上游能力转换或明确降级，不应盲目将所有 custom tool 变成 function |
| `js_repl` 被禁用 | [#2038](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2038)，open | 非官方第三方 API 的模型工具能力标识不足时，Codex 自动禁用 `js_repl` | [F] 与模型目录/capability 宣告有关；当前缺少跨版本 E2E 证据 |

Issue #2043/#2045 的关闭只代表父仓库维护者认为主线已有修复并关闭旧报告，不代表当前 fork 已包含修复，更不代表对应用户版本已重新验收。Issue #2074 被维护者明确拆成四个独立问题，故本稿不把它伪装成一个单一 Bug。

## 6. 开发计划里程碑与进度

### 6.1 已完成节点（按计划文本）

| 节点 | 计划声称完成的内容 | 当前可核对证据 | 保留意见 |
|---|---|---|---|
| T1 | 删除赞助商广告、广告远程请求和嵌入素材 | 当前提交历史有 `feat: remove bloat ads and sponsors`；`ads.rs` 返回空广告列表 | [P] 计划称 159 测试全绿；本次未运行 manager 测试 |
| T1-B | 日志递归脱敏、阻断远程会话分享/社区外联 | `diagnostic_log.rs` 有递归 sanitize；`share.rs` 的 create path 当前阻断 | 发现 renderer 仍会基于 share id/session id 构造远程 URL 的源码路径，而 backend create 已 bail；UI/后端语义需统一并复现 |
| T1-C | 默认 Windows release 与手动全平台 release 分离，恢复 PR workflow | 当前四个 workflow 存在；两次 release run 的构建 jobs 成功 | [A] 只验证了 release Actions；没有 PR build run 证明 `npm test`/`npm run check`/`cargo test --workspace` |
| T1-D | 删除首页 JOJO card，更新仓库/反馈/更新源归属 | 当前 HEAD 最新提交为 `feat: remove JOJO Code sponsor card...`；release `v1.2.57-gemini.2` 成功 | UI 像素级结果未做桌面截图验证 |

计划 T1–T1-D 的“Actual Steps/Results”记录了实现叙述和“159 passed, 0 failed”，但 `DEVELOPMENT_PLAN.md` 本身不是 CI 日志。建议把 run URL、commit SHA、测试命令、artifact digest 回填到计划中。

### 6.2 待推进节点

| 计划节点 | 原计划目标 | 依赖与风险 |
|---|---|---|
| T2 | 收敛全局 `MutationObserver` 到 sidebar，流式期间 throttle，CPU -40% | 必须先修 pureApi patch 失败路径并建立 CDP profiling 基线，否则可能把 patch 循环误判为 DOM 问题 |
| T3 | 拆解 1.13 万行 `App.tsx`，视图按需加载，关键输入局部防抖 | 依赖稳定的状态边界和路由行为契约；React lazy 组件必须在模块顶层声明，避免 remount 丢状态 |
| T4 | 57321 生命周期、HTTP 平滑停机、`SO_REUSEADDR`、指数退避 | 固定 base URL 意味着“自动换端口”不是单纯 bind 修复；动态端口需要配置投影/启动顺序的架构决策 |
| T5 | 供应商切换时清理 Bearer/Cookie/Session，杜绝 401 残留 | 涉及凭据、文件、环境变量和官方应用运行态；必须使用合成 key/mock upstream，严禁真实凭据测试 |
| T6 | Class → ARIA → icon/语义的多级 DOM selector fallback | 需要官方页面 fixture、selector telemetry 和明确的误匹配保护 |
| T7 | 最近 20 次请求、错误详情、一键修复引导 | 先定义本地结构化事件和脱敏 schema；不因“看板”引入默认远程上传 |
| T8 | 多供应商并发测延迟/TTFT/吞吐，并支持智能切换 | 需要固定 prompt、并发上限、取消/超时和结果可比性；真实供应商凭据不能进入测试记录 |

计划原文可见 [T2–T5](https://github.com/TttXxx36/Codex--/blob/Gemini/DEVELOPMENT_PLAN.md#L146-L183) 和 [T6–T8](https://github.com/TttXxx36/Codex--/blob/Gemini/DEVELOPMENT_PLAN.md#L187-L210)。截至本研究，T2–T8 的 Actual/Results 仍是“等待实施/验证”。

## 7. 成熟方案调研与复用结论

在线调研只选官方文档/官方仓库，并把 stars、release、维护活动当作“可核查信号”，不把热度当质量证明；信号随时间变化，以下是研究时的近似快照。

| 领域 | 候选与可核查信号 | 可复用机制 | 适配 Codex++ 的结论/安全边界 |
|---|---|---|---|
| React 路由拆分 | [React](https://github.com/facebook/react) 约 245k stars、21k+ commits；官方 [`lazy`](https://react.dev/reference/react/lazy) / [`Suspense`](https://react.dev/reference/react/Suspense) 文档 | `lazy(() => import(...))` 延迟加载，Suspense 提供 fallback；React 明确要求 lazy 组件在模块顶层声明 | T3 先按路由/面板边界拆分，保留现有 state/context；不直接引入新的状态库作为重构前置条件 |
| Rust 端口 | [Tokio](https://github.com/tokio-rs/tokio) 约 32k stars、近期有 release；[`TcpSocket::set_reuseaddr`](https://docs.rs/tokio/latest/tokio/net/struct.TcpSocket.html) 有官方 API 示例 | 先配置 socket，再 bind/listen；`SO_REUSEADDR` 行为明确标为 platform-specific | T4 可复用 Tokio socket API，但 Windows/macOS 必须分别测，不能因为 set 选项成功就宣称解决 TIME_WAIT 或多实例竞争 |
| Electron/CDP E2E | [Playwright](https://github.com/microsoft/playwright) 约 94k stars、官方 Electron API 与持续 release；[`_electron`](https://playwright.dev/docs/api/class-electron)、[locators](https://playwright.dev/docs/locators)、[trace viewer](https://playwright.dev/docs/trace-viewer) | Electron launch/firstWindow、role/label 等可访问语义 locator、失败 trace/DOM snapshot | T6/T8/launcher smoke test 优先复用 Playwright；其 Electron 支持仍标注 experimental，先用 fixture 验证，不把实验支持当生产覆盖 |
| SQLite 性能 | [SQLite 官方 Git mirror](https://github.com/sqlite/sqlite) 约 9.8k stars、31k+ commits；[`EXPLAIN QUERY PLAN`](https://sqlite.org/eqp.html)、[query planner](https://sqlite.org/queryplanner.html) | 以 SEARCH/SCAN、索引使用、temporary B-tree 和排序计划作为对照；复合/covering index 要由真实查询驱动 | P2 data 任务先采集不同 Codex schema 的 plan 与数据规模，再增加兼容索引；不要盲目迁移/删除字段，也不要依赖 EQP 输出字符串作为稳定 API |
| 本地/结构化可观测性 | [OpenTelemetry JS](https://github.com/open-telemetry/opentelemetry-js) 官方仓库；文档显示 traces/metrics stable、logs development，browser instrumentation 仍有实验性提示 | 统一 span/metric/log 语义、局部采样和脱敏属性 | T7 先沿用现有本地 JSONL `diagnostic_log`；若未来采用 OTel，默认 local-only、无 DSN/remote exporter，先解决隐私和体积治理 |

复用结论：T3 使用 React 原生 `lazy`/`Suspense`，T4 使用 Tokio 原生 socket 配置与取消机制，T6/T8 使用 Playwright fixture/locator/trace，T7 借鉴 OTel 字段语义但保留本地脱敏，T2/T4/T5/T8 都不应手写一个未经基准验证的“万能重试器”。

## 8. P0–P3 结构化任务草稿

工时为单人实现 + 单元/契约测试的粗略估算，不是承诺；若需要跨平台桌面人工复现，另加 0.5–1 天。P0 的含义是“若该场景复现，将导致无法请求、凭据错误或启动不可用”；在复现前仍应标记为“P0 候选/需确认”，避免把用户报告直接当成已证实生产事故。

### P0：先保护请求正确性与可启动性

#### P0-1 供应商切换的值级认证契约与安全清理（T5）

- **证据**：[#2074](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2074) 的误报/历史 key/启动后 401；[#2040](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2040) 的诊断成功但真实请求 401；[env_conflicts.rs](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-core/src/env_conflicts.rs#L36-L134)。
- **范围**：为 process env、user env、`auth.json`、`config.toml`、active profile 建立来源和值的快照；只有明确属于当前冲突且不等于目标凭据时才提示/清理；切换以临时文件 + atomic rename + rollback 完成；通过 localhost mock upstream 验证 Manager test 与 Codex-launched request 的 Base URL、`Authorization` 和 `requires_openai_auth` 一致；对 Cookie/Session 清理只清理目标 profile 管辖的项。
- **估算**：12–16 小时。
- **依赖**：T5；Windows env API；不含真实 API key 的合成 fixture；需要先定义“官方登录/混合/pure API”的认证契约。
- **验收**：
  1. env key 与当前 `auth.json` 值一致时不再误报；
  2. 清理不能替换成历史 key，也不能删除当前有效 key；
  3. mock API 上 Manager test 和启动后 Codex 请求的 URL、认证头、provider gate 一致；
  4. 任一写入失败都恢复 settings/config/auth，日志无凭据；
  5. 重启后状态仍一致，且不依赖手改 `config.toml`。

#### P0-2 57321 helper/protocol proxy 的可证明生命周期（T4）

- **证据**：计划称 TIME_WAIT/bind failure 为致命问题；当前实现固定 57321，bind 失败时仅按 6,000ms/200ms 重试。[端口常量](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-core/src/launcher.rs#L27-L33)、[bind retry](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-core/src/launcher.rs#L274-L327)、[helper 启动](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-core/src/launcher.rs#L401-L435)。
- **范围**：helper/proxy owner token 或 single-instance guard；显式 `/shutdown`/drain/超时；`TcpSocket` 配置后 bind；指数退避 + jitter；准确区分 `AddrInUse` 与权限/地址错误；固定 base URL 下暂不擅自改为动态端口，动态迁移另立架构任务。
- **估算**：10–14 小时。
- **依赖**：现有 oneshot shutdown、status store、T4；Tokio socket；Windows/macOS 两套重复启动 fixture。
- **验收**：
  1. 合成环境连续启动/退出/重启 100 次，57321 bind 成功率 100%，或每次给出明确可操作错误；
  2. 旧 helper 收到 shutdown 后，新 helper 只在健康检查通过后宣告 ready；
  3. `SO_REUSEADDR` 仅作为平台适配的一部分验证，不掩盖双实例占用；
  4. 非 `AddrInUse` 错误不进行无意义重试；
  5. 端口被真实其他进程占用时不修改已有 config 的 base URL。

### P1：控制高频失败、协议兼容与官方改版风险

#### P1-1 renderer patch 失败终止/冷却 + MutationObserver 收敛（T2）

- **证据**：Issue #2043 的 CPU/DOM 采样；当前 renderer 中 `maxMisses` 与 retry 代码、pureApi 提前 return 和约 250ms retry；全局 observer 仍观察 body/documentElement subtree，且 `scan` 内存在全局 querySelector/布局测量；计划 T2。
- **范围**：patch candidate discovery 的 promise/cache/terminal state；失败阈值、指数冷却和手动 retry；MutationRecord relevance filter；sidebar/container 局部 observer；流式输出期间合并 scan，并避免重复 listener/node。
- **估算**：12–18 小时。
- **依赖**：P0-2 的稳定 helper；P1-2 的 bridge 状态；CDP performance fixture；不得把所有 DOM 问题归因于 observer。
- **验收**：
  1. 缺失 candidate 的 pureApi fixture 在阈值后停止，不再每 250ms 全量扫描；
  2. 3 分钟 idle profile 中尝试次数、ScriptDuration、listeners/nodes 增量有固定上限；
  3. 流式 fixture 的 frame gap 与输入延迟不回归；
  4. 在同一环境/脚本下，CPU 相对基线达到计划 -40% 目标或记录未达标原因；
  5. 手动 retry 不会叠加 observer、promise 或 generation。

#### P1-2 bridge watchdog 的存活检测、退避与重注入状态机（T4/T2）

- **证据**：[#2045](https://github.com/BigPizzaV3/CodexPlusPlus/issues/2045) 的 231 次/3.5 小时失败数据；当前 watchdog 每 5 秒 tick，并在同一轮 join overlay sync 与 reinject。[当前实现](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-core/src/launcher.rs#L940-L992)。
- **范围**：进程不存在、CDP port 消失、页面忙、Bridge stale、browser identity changed 五态分开；连续失败计数；指数退避/上限；`Runtime.evaluate` 超时不直接重注入；最终状态写 `stopped`/`needs_user_action`。
- **估算**：10–14 小时。
- **依赖**：P0-2、现有 process wait/status store、CDP fixture。
- **验收**：进程退出后有限时间内停止轮询；页面忙时不产生 generation storm；重启后只恢复一次新 generation；所有最终失败都有脱敏诊断与 Manager 可读提示。

#### P1-3 DOM selector adapter 与可访问语义 fallback（T6）

- **证据**：报告明确指出 class/结构 coupling；计划要求 Class → ARIA → icon semantic；Playwright 官方推荐 role/label/placeholder 等 locator。
- **范围**：将删除/侧边栏/输入框/菜单的 selector 收到 adapter；优先稳定 `role`/`aria-*`/label，再退回 class；每次只在相关容器搜索，限制候选数，记录 selector version/reason；不引入未经签名的远程热修复。
- **估算**：8–12 小时。
- **依赖**：P1-1 relevance filtering；官方 DOM fixture；会话管理现有单测。
- **验收**：至少三种 fixture（旧 class、新 class、ARIA-only）均能完成目标动作；无候选/多候选时安全失败；真实页面只产生一次诊断，不能全页扫描循环。

#### P1-4 Responses/Chat/工具/图片/SSE capability contract（#2031/#2026/#1225/#2038）

- **证据**：GLM data URL 400/raw base64 200；DeepSeek final event ID 丢失；MiMo custom tool 不支持；第三方模型 `js_repl` 能力标识不足。
- **范围**：建立 provider/model capability map；按模型而非全局改写图片；GLM 仅在明确 capability 下剥离 data URL 前缀，保留 detail/remote URL；工具只在上游接受时做 `custom`→`function` 适配，否则显示可操作降级；SSE 状态机保证 call_id、item id、response.completed 一致；模型目录声明与工具能力分开。
- **估算**：16–24 小时。
- **依赖**：protocol_proxy、固定请求/响应 fixture；P2-3 benchmark 可复用但不是前置；不需要真实 key。
- **验收**：
  1. GLM fixture 只改写 `data:image/...;base64,` 且非 GLM/远程 URL 不变；
  2. 每个 tool call 的 id 从 request 到 done/completed 保持；
  3. custom tool 不被静默错误转换，能力不足时给出明确错误/降级；
  4. `js_repl` 是否可用由能力契约决定，而非“有无 model name”猜测；
  5. 转换前后敏感字段仍不写入诊断日志。

#### P1-5 会话分享 UI/backend 语义收敛

- **证据**：计划 T1-B 声称纯本地分享并阻断外联；当前 `share.rs` create path 已直接阻断，但 renderer 仍构造远程 share URL 的源码路径。
- **范围**：二选一并由用户确认产品方向：完全 local-only，或重新设计明确 opt-in 的托管分享。当前安全默认应是 local-only：后端返回结构化 `disabled/local-only`，renderer 不生成失效远程 URL、不复制看似可用的链接，服务端文档同步声明。
- **估算**：4–8 小时。
- **依赖**：现有 share route、日志脱敏；若重新启用托管则升级为 L3 外部发布/权限任务，不在本稿授权范围内。
- **验收**：默认流程无远程 share 请求和远程 URL；UI 文案与后端状态一致；本地导出/导入可 round-trip；测试扫描不包含真实会话内容。

### P2：可维护性、可观测性、数据与验证基础设施

#### P2-1 `App.tsx` 路由拆分、lazy loading 与输入局部更新（T3）

- **证据**：当前约 11,209 行；计划 T3；报告建议按 16 个视图拆分。React 官方 `lazy`/`Suspense` 提供成熟机制。
- **范围**：先抽 `views/` 和 route-level boundaries，再收缩 props/context；只对慢/重面板做 lazy；把 textarea 草稿 state 与持久化 save state 分离，局部 debounce；保持现有 UI/路由/默认值。
- **估算**：20–32 小时。
- **依赖**：P1 认证/bridge 合约稳定；现有 manager tests；不可先大规模改状态库。
- **验收**：每个 route 首次加载/返回均保持行为；输入事件不触发全树重渲染；短文本输入延迟 p95 达到预定预算；lazy load 失败有 ErrorBoundary/fallback；`App.tsx` 只保留壳和路由协调。

#### P2-2 本地 API 请求/错误看板与脱敏 schema（T7）

- **证据**：计划要求最近 20 次请求/错误详情；当前已有本地 JSONL diagnostic log、递归脱敏和 route elapsed logging。
- **范围**：复用已有事件，不新增默认远程 collector；按 request id 关联 provider/model/protocol/status/elapsed/TTFT/error class；key/token/auth/header/body 全部只显示存在性或 hash；支持复制修复建议而非复制原始凭据。
- **估算**：12–18 小时。
- **依赖**：P0-1 的认证事件、P1-4 的转换错误分类、现有 log compaction。
- **验收**：看板最多 20 条且刷新不会造成轮询风暴；401/400/timeout/tool/media/bridge 分类可筛选；单测确认敏感字段和 Bearer 不出现；离线运行不产生网络请求。

#### P2-3 多供应商并发测速与选择建议（T8）

- **证据**：计划 T8；报告有四种路由策略；没有现成公平 benchmark。
- **范围**：合成 prompt、同模型/同参数/并发上限、connect/TTFT/first-byte/total/throughput/p50/p95、超时取消；结果与 provider/model/capability 绑定；“建议切换”与“自动切换”分开，默认只给建议。
- **估算**：10–16 小时。
- **依赖**：P1-4 capability contract、P2-2 本地事件；真实供应商授权不在本任务内。
- **验收**：同一 fixture 可重跑且结果可比较；失败供应商不阻塞其他测试；取消后无后台请求；key/响应内容不落盘；自动切换必须显式 opt-in 并可回滚。

#### P2-4 SQLite 列表/搜索的计划、索引与分页基线

- **证据**：当前查询是动态 schema + `NOT EXISTS` + `ORDER BY ... LIMIT`；未见针对各 schema 的性能基线；SQLite 官方建议用 query planner/EQP 驱动索引。
- **范围**：对 `threads`、`thread_spawn_edges`、`agent_job_items`、`automation_runs` 的实际列和 cardinality 建 fixture；采集 1k/10k/100k rows 的 p50/p95 与 EQP；再添加兼容索引、keyset pagination 或按需缓存 schema，不做未经确认的迁移。
- **估算**：10–16 小时。
- **依赖**：真实 schema 样本（脱敏/合成）、P2-2 诊断；需要用户确认若涉及数据迁移。
- **验收**：首屏/翻页/归档搜索有目标预算；计划不出现意外全表扫描或临时排序，若无法避免则记录理由；旧 schema 与纯 API index fallback 回归通过；删除/undo 行为不变。

#### P2-5 Electron/CDP/launcher 端到端回归 fixture

- **证据**：报告指出现有主要是 Rust 单测和局部 helper 单测，缺乏真实 Electron/CDP E2E；Playwright 提供官方 Electron API、locator 和 trace。
- **范围**：最小 fake Electron/fixture：target 选择、new-document/current-page 注入、Bridge health/reinject、helper restart、selector variants、protocol fixture；失败保存 trace/DOM snapshot/脱敏 log。
- **估算**：16–24 小时。
- **依赖**：P0-2、P1-1、P1-2、P1-3；需锁定受测 Electron/Codex fixture 版本。
- **验收**：CI 至少运行启动/注入/重启/错误停止四条 smoke；每条失败有 artifact；不连接真实 OpenAI/第三方；Windows 为必测，macOS 作为可用 runner 验证。

### P3：平台扩展与低紧急度能力

#### P3-1 Linux 路径、入口与 AppImage/Deb 打包

- **证据**：报告明确列为缺口，当前 workflow 只有 Windows/macOS；计划第三阶段建议补齐 Linux。
- **估算**：24–40 小时；依赖 P2-5 和核心路径稳定。
- **验收**：路径探测、单实例、CDP、安装卸载、更新检查在目标发行版 fixture 通过；产物可复现、无凭据；发布另需用户授权。

#### P3-2 Agent/MCP 请求轨迹与本地调试面板

- **证据**：报告路线图建议；计划 T7 可提供数据基础。
- **估算**：16–24 小时；依赖 P2-2、P1-4 和权限边界。
- **验收**：只展示脱敏 metadata/时序/错误类别；工具输入默认折叠；没有隐式远程上传；大 payload 有大小上限；可按 request/turn 关联。

#### P3-3 文档与证据治理

- **证据**：报告存在“数十 MB/数百毫秒/数倍跃升”等无基准表述；计划要求每个节点有 Plan/Actual/Results。
- **估算**：4–8 小时；可与每个任务并行。
- **验收**：每项性能数字含环境、版本、命令、样本和 artifact URL；计划中的 Results 不再只写“159 passed”；明确区分父仓库修复、fork HEAD 和未验证事项；当前 release/Actions URL 回填。

## 9. 推荐执行顺序与停止条件

```text
Gate A  复现/隔离：P0-1 认证 + P0-2 57321
   │  mock API、合成 env/auth、连续 restart、无真实凭据
   ▼
Gate B  稳定性：P1-1 renderer + P1-2 watchdog + P1-3 selector
   │  CDP profiling、failure threshold、fixture variants
   ▼
Gate C  协议/体验：P1-4 converter + P1-5 share + P2-1 manager
   │  capability contract、local-only privacy、route/input baseline
   ▼
Gate D  运营与扩展：P2-2/3/4/5 → P3
```

停止条件：任何测试发现当前 active provider 的认证凭据可能被覆盖/误删、真实 session 可能外传、或动态换端口会修改用户配置时，先暂停并保留回滚副本；这类事项需要额外用户确认，不能在“只读分析”阶段推演成已修复。

## 10. 研究结论的置信度与未决问题

高置信度：当前 fork 的分层组织、workspace/manager/data/renderer 的存在、固定 57321 设计、当前 launcher 的 6 秒/200ms bind retry、watchdog 5 秒 interval、SQLite 列表/删除代码形态、计划 T2–T8 尚未填入 Actual/Results、公开 release Actions 的成功状态。

中置信度：pureApi patch 旧 retry 路径仍会造成当前 fork 的空闲 CPU；share UI 与 backend 语义存在失配；环境删除会在真实 Windows 场景替换历史 key；这些需要运行时 fixture 或完整源码 diff 复核，不能只由静态代码推出最终用户影响。

低置信度/待补充：报告中的冷启动、内存、工业级兼容、数倍/数百毫秒性能；#2065 的根因；父仓库修复 commit `5a3ed5c`/`2093` 是否已完整进入当前 fork；T2 的 -40% 是否可达；官方客户端新版本的真实 DOM/协议兼容性。

最小下一轮证据包：

1. fork HEAD 与父仓库修复 commit 的源码 diff（只读）；
2. synthetic env/auth + localhost mock 的 provider switch trace；
3. 100 次 Windows/macOS helper restart 的脱敏 launcher log；
4. 缺失 candidate 与 streaming 的 CDP profile 前后对照；
5. manager `npm test`/`npm run check`、`cargo test --workspace` 的 run URL 和 artifact，而不是计划文本中的摘要。

