# Codex++ 下一阶段可执行开发任务清单（P0–P2）

> 研究对象：[`TttXxx36/Codex--`](https://github.com/TttXxx36/Codex--) 的 `Gemini` 分支；报告与计划以 v1.2.56 为基线，当前源码 HEAD 为 `07ca54c0f1e96dd708c8eb785e98d64c747282b5`。  
> 核心依据：仓库源码主目录、[深入分析报告](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md)、[开发大纲计划](https://github.com/TttXxx36/Codex--/blob/Gemini/DEVELOPMENT_PLAN.md)。

## 使用边界与排序口径

- **[R] 报告明确**：报告直接写出的架构、结论、数字或风险。
- **[P] 计划列出**：`DEVELOPMENT_PLAN.md` 的目标或待办；T2–T8 的 Actual/Results 仍需补证。
- **[S] 源码核验**：在当前 HEAD 看到的实现事实；不能替代桌面端运行验证。
- 报告没有附带可追溯的 Bug 编号、复现环境或用户原话；因此“待复现/需确认”的项目不能写成已经证实的生产事故。
- 报告中“数十 MB、冷启动瞬时、数百毫秒 watchdog、工业级 API 验证”等是报告表述，不是本轮实测；计划 T2 的 **CPU -40%** 是目标值，不是现状数据。

优先级综合考虑影响面、数据/安全风险、不可用程度和解决成本：

| 等级 | 判定口径 | 执行要求 |
|---|---|---|
| **P0** | 核心请求/启动不可用、凭据可能错误处理，或全局资源消耗足以拖垮桌面端 | 先做合成 fixture 复现；修复后才进入下一层 |
| **P1** | 核心功能高概率异常、官方页面/协议改版易触发，或影响大范围诊断与回归 | 紧随 P0；必须有契约测试或端到端 smoke |
| **P2** | 体验、可维护性和运营效率问题，存在替代路径且不直接损坏数据 | P0/P1 达标后实施 |

## 一、第一优先级：性能优化

### PERF-001：终止 renderer 失败重试风暴并收敛 DOM 观察范围

- **所属类别**：性能优化
- **优先级**：**P0**；影响 renderer 全局 CPU、内存和输入/流式响应，修复成本中高。
- **问题/目标**：报告指出 renderer 与 DOM 结构耦合、脚本规模超过 10,600 行；计划 T2 要求收敛全局 `MutationObserver`、对流式处理限流并将 CPU 降低 40%（[报告风险](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L274-L286)、[计划 T2](https://github.com/TttXxx36/Codex--/blob/Gemini/DEVELOPMENT_PLAN.md#L146-L153)）。当前源码仍存在全页观察和 pure API candidate 失败后的定时 retry 路径（[renderer 失败重试](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/assets/inject/renderer-inject.js#L6851-L6891)、[观察器/扫描](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/assets/inject/renderer-inject.js#L10255-L10402)）；最终 CPU/RSS 影响仍需实测。
- **初步方案**：为 patch discovery 建立 `success / retrying / terminal-failed` 状态、失败阈值、指数冷却和手动重试；把全局 observer 缩小到 sidebar/相关容器，过滤无关 `MutationRecord`；流式期间合并扫描，禁止重复 listener、promise 和 generation。
- **验收标准**：
  1. 缺失 candidate 的 fixture 在达到阈值后停止全量扫描，不再固定间隔无限重试；手动 retry 不叠加 observer 或 promise。
  2. 同一版本、同一 fixture、连续 3 分钟 idle profile 中，扫描次数、ScriptDuration、DOM node/listener 增量均有明确上限。
  3. 相对修复前基线，CPU 达到计划 **-40% 目标**；若未达标，必须记录环境、原始数据、差距和下一步，而不是宣称完成。
  4. 流式输出的 frame gap、输入响应 p95 不得较基线恶化超过 10%，且不出现功能回归。

### PERF-002：拆分 Manager 首屏负载并消除输入链路的全树更新

- **所属类别**：性能优化
- **优先级**：**P1**；影响所有管理器用户的加载等待和输入延迟，改动面大但可分阶段落地。
- **问题/目标**：报告把 `App.tsx` 超大、UI 耦合列为主要技术债务，并声称冷启动很快但没有 benchmark；计划 T3 明确要求拆分约 1.13 万行 `App.tsx`、视图按需加载和输入防抖（[报告债务](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L274-L286)、[计划 T3](https://github.com/TttXxx36/Codex--/blob/Gemini/DEVELOPMENT_PLAN.md#L157-L163)）。
- **初步方案**：按路由/面板边界抽离 `views/`，使用 React 原生 `lazy`/`Suspense`，让 `App.tsx` 只保留壳和路由协调；将输入草稿 state 与持久化保存 state 分离，对保存操作做局部 debounce，避免每次击键触发全树渲染。
- **验收标准**：
  1. 每个主要视图首次进入只加载所需模块；lazy 失败有可恢复的 ErrorBoundary，不丢失已有路由和默认设置。
  2. 在固定输入 fixture 下，输入事件到可见值的 p95 达到预先登记的预算，且不再触发无关视图重渲染。
  3. 首屏与二次返回的加载 p50/p95 相对基线改善；指标包含版本、机器、样本数和 artifact。
  4. Manager 现有行为、设置保存和会话操作回归通过。

### PERF-003：以查询计划和数据规模驱动 SQLite 会话列表/搜索优化

- **所属类别**：性能优化
- **优先级**：**P1**；数据量增大时会放大首屏和搜索等待，成本中等；涉及 schema 时必须保持可回滚。
- **问题/目标**：报告将 SQLite 会话治理列为核心数据层；源码列表查询包含动态 schema、`NOT EXISTS`、排序和 `LIMIT`，当前未见按实际 schema 建立的性能基线（[报告数据层](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L154-L182)、[当前列表查询](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-data/src/storage.rs#L210-L332)）。
- **初步方案**：用脱敏/合成的 1k、10k、100k sessions 采集 p50/p95 与 `EXPLAIN QUERY PLAN`；按真实 schema 增加复合/覆盖索引，必要时采用 keyset pagination，并缓存不变的 schema 探测结果；不直接迁移、删字段或改变删除/undo 语义。
- **验收标准**：
  1. 首屏、翻页、搜索分别有目标预算和 p50/p95 报告；查询计划不出现未解释的全表扫描或临时排序。
  2. 旧 schema、纯 API 的 `session_index.jsonl` fallback、删除和 undo 回归通过。
  3. 优化前后数据库文件、结果顺序、分页边界和数据完整性一致；失败可恢复，不要求用户手工修复数据库。

### PERF-004：建立多供应商并发测速与可解释的切换依据

- **所属类别**：性能优化
- **优先级**：**P1**；直接服务 TTFT、吞吐和并发能力，成本中等；没有公平基线前不能自动切换生产流量。
- **问题/目标**：报告描述四种 provider/relay 模式及多种轮询策略，但没有可比较的延迟数据；计划 T8 要求并发测量延迟、TTFT、吞吐并支持智能切换（[报告路由](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L183-L200)、[计划 T8](https://github.com/TttXxx36/Codex--/blob/Gemini/DEVELOPMENT_PLAN.md#L205-L210)）。
- **初步方案**：使用固定合成 prompt、同模型/参数和受控并发上限，采集 connect、TTFT、first-byte、total、throughput、p50/p95；每个请求支持 timeout/cancel；将“建议切换”和“自动切换”分离，默认只给建议。
- **验收标准**：
  1. 同一 fixture 可重复运行并输出 provider/model/capability 绑定的可比较结果。
  2. 单个供应商超时或失败不阻塞其他测试；取消后无后台请求、线程或连接泄漏。
  3. 诊断结果不写入 key、完整响应或会话内容；自动切换必须显式 opt-in，并能回滚。

## 二、第二优先级：稳定保障与缺陷修复

### BUG-001：修复 57321 helper/protocol proxy 生命周期和 Bridge 重注入风暴

- **所属类别**：缺陷修复
- **优先级**：**P0**；端口占用或 Bridge 反复失败会使启动和核心请求不可用，影响面全局。
- **问题/目标**：报告把固定 57321 冲突、watchdog/CDP 生命周期列为风险，并称 watchdog 可在数百毫秒感知刷新；源码当前仍是固定端口、约 6 秒/200ms bind retry、5 秒 watchdog（[报告风险/建议](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L274-L306)、[计划 T4](https://github.com/TttXxx36/Codex--/blob/Gemini/DEVELOPMENT_PLAN.md#L167-L173)、[当前 launcher](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-core/src/launcher.rs#L937-L992)）。报告的“数百毫秒”与源码不一致，必须先测量。
- **初步方案**：增加明确 owner/single-instance guard、`/shutdown` drain 和健康检查；使用 Tokio socket 设置 `SO_REUSEADDR` 后 bind；区分 `AddrInUse` 与权限/地址错误，采用有上限的指数退避；把进程退出、CDP 不可达、页面忙、Bridge stale、browser identity change 建成独立状态机，禁止 timeout 直接触发 generation storm。
- **验收标准**：
  1. 合成环境连续启动/退出/重启 100 次，bind 成功率 100%，或每次给出明确且可操作的失败状态。
  2. 旧 helper 收到 shutdown 后才允许新 helper 宣告 ready；进程退出后在有限时间内停止轮询。
  3. 非端口占用错误不做无意义重试；端口被其他进程占用时不擅自改写用户的 base URL/config。
  4. Windows 与 macOS fixture 均有脱敏日志，能证明最终状态是 `ready`、`stopped` 或 `needs_user_action`。

### BUG-002：修复供应商切换的值级认证、环境变量和会话残留问题

- **所属类别**：缺陷修复
- **优先级**：**P0**；可能导致真实请求 401、错误覆盖/删除凭据或切换后状态不一致，兼具安全与数据风险。
- **问题/目标**：计划 T5 明确要求清理 Bearer/Cookie/Session 并杜绝 401 残留；报告的四种 provider 模式都依赖配置、认证文件和运行态正确对齐（[计划 T5](https://github.com/TttXxx36/Codex--/blob/Gemini/DEVELOPMENT_PLAN.md#L177-L183)、[报告 provider 模式](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L183-L200)）。源码当前环境冲突判断按 `OPENAI_` 前缀并可直接移除变量，不能证明值属于当前 profile（[环境处理](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-core/src/env_conflicts.rs#L36-L134)）。具体用户影响需用合成凭据复现。
- **初步方案**：对 process env、user env、`auth.json`、`config.toml` 和 active profile 建立来源/值快照；只清理明确属于当前冲突且不等于目标凭据的项；采用临时文件、atomic rename、失败回滚；用 localhost mock upstream 检查 Manager 测试与启动后 Codex 请求的 URL、Authorization 和 auth gate 一致。
- **验收标准**：
  1. 值与当前 auth 配置一致时不误报；清理不能替换成历史 key，也不能删除当前有效 key。
  2. Manager 测试成功与启动后真实请求在 mock upstream 上拥有一致的 Base URL、认证头和 provider gate。
  3. Cookie/Session 只清理目标 profile 管辖项；任一写入失败均恢复 settings/config/auth。
  4. 重启后状态一致，日志和诊断 artifact 不出现 key、Bearer、Cookie 或完整认证内容。

### BUG-003：建立 Responses↔Chat、SSE、工具和图片的 capability 契约

- **所属类别**：缺陷修复
- **优先级**：**P1**；协议错误会直接表现为 400/401、工具不可用、图片失败或对话中断，修复成本高。
- **问题/目标**：报告把双向协议代理和 SSE 转换列为核心机制，同时指出第三方模型/接口兼容是主要风险（[报告协议代理](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L154-L182)）；计划 T8 又要求把测速和 provider/model 能力绑定，而不是对所有供应商采用同一规则。
- **初步方案**：维护 provider/model capability map；按能力决定图片 data URL 是否转换、`custom` tool 是否可降级为 `function`；SSE 状态机保持 call id、item id 和 completed 事件一致；模型目录声明与工具能力分离；所有适配由固定 request/response fixture 驱动。
- **验收标准**：
  1. 非目标模型和远程图片 URL 不被全局改写；目标模型的图片转换规则有正反例。
  2. tool call 的 id 从请求到 done/completed 全程一致，能力不足时显示明确降级/错误，不静默伪造成功。
  3. 文本、流式、工具、图片和取消场景均通过 Responses↔Chat 契约测试；敏感字段不落诊断日志。

### BUG-004：增加官方 renderer 改版下的 DOM selector fallback

- **所属类别**：缺陷修复
- **优先级**：**P1**；官方页面变化可能使删除、输入、侧边栏等核心操作失效，修复成本中等。
- **问题/目标**：报告明确指出 DOM coupling 是长期风险；计划 T6 指定 `Class → ARIA → icon/semantic` 的 fallback 路线（[报告风险](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L274-L286)、[计划 T6](https://github.com/TttXxx36/Codex--/blob/Gemini/DEVELOPMENT_PLAN.md#L187-L192)）。
- **初步方案**：把删除、侧边栏、输入框、菜单 selector 收入 adapter；优先 role/aria/label 等稳定语义，class 作为后备；限定搜索容器和候选数，遇到 0 或多候选安全失败并记录 selector version/reason。
- **验收标准**：旧 class、新 class、ARIA-only 三类 fixture 都能完成目标动作；0/多候选时不误操作；单次操作只产生一次诊断，不触发全页循环；兼容测试进入 CI smoke。

### BUG-005：保证会话删除、索引、备份与 undo 的一致性

- **所属类别**：缺陷修复
- **优先级**：**P1**；错误删除或重启后复现会破坏数据准确性，成本中等。
- **问题/目标**：报告把 SQLite 会话治理、删除和备份恢复列为核心数据层；源码虽有事务删除、backup 和纯 API index fallback，但多 schema/文件/索引之间的一致性需要回归验证（[报告数据层](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L154-L182)、[删除与恢复实现](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-data/src/storage.rs#L494-L636)）。
- **初步方案**：为每种 schema 建合成 fixture；删除前写带校验和的 backup，数据库行、关联文件和 `session_index.jsonl` 使用可重入的事务/补偿流程；undo 先做冲突检查并给出明确结果。
- **验收标准**：删除后重启不复现；undo 可恢复且不覆盖新会话；DB 行、rollout 文件和 index 无孤儿或误删；任一中途失败均保留 backup 并可恢复，旧 schema 和纯 API fallback 回归通过。

### BUG-006：统一会话分享的 UI、后端和隐私状态

- **所属类别**：缺陷修复
- **优先级**：**P1**；当前源码存在“后端阻断分享、renderer 仍构造远程 URL”的语义不一致，可能造成误导或隐私误操作；成本低中。
- **问题/目标**：计划 T1-B 要求日志脱敏并阻断远程会话分享；源码交叉核验显示 `share.rs` 的 create path 已阻断，但 renderer 仍有生成远程 share URL 的路径（[计划 T1-B](https://github.com/TttXxx36/Codex--/blob/Gemini/DEVELOPMENT_PLAN.md#L70-L91)、[后端状态](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/crates/codex-plus-core/src/share.rs#L1-L10)、[renderer 分享路径](https://github.com/TttXxx36/Codex--/blob/07ca54c0f1e96dd708c8eb785e98d64c747282b5/assets/inject/renderer-inject.js#L7165-L7224)）。这是源码缺陷候选，仍应先复现。
- **初步方案**：当前安全默认保持 local-only；后端返回结构化 `disabled/local-only` 状态，renderer 不生成失效远程 URL、不复制看似可用的链接；本地导出/导入作为明确替代。重新启用托管分享属于权限/外部发布决策，不纳入本任务。
- **验收标准**：默认分享流程无远程请求和远程 URL；UI 文案、后端返回和文档一致；用户能明确知道“已导出本地”还是“不可分享”；合成会话可 round-trip，测试不含真实会话内容。

### BUG-007：补齐 Electron/CDP/launcher 的最小端到端回归

- **所属类别**：缺陷修复
- **优先级**：**P1**；没有真实入口回归，P0/P1 修复容易在注入、重启或官方页面变化时反复出现；成本中高。
- **问题/目标**：报告明确把 E2E 薄弱列为主要欠账，并建议补 E2E；计划要求每个节点填写 Plan/Actual/Results（[报告建议](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L290-L306)、[计划基线](https://github.com/TttXxx36/Codex--/blob/Gemini/DEVELOPMENT_PLAN.md#L1-L31)）。
- **初步方案**：用固定版本的 fake Electron/Codex fixture 覆盖 target 选择、new-document/current-page 注入、Bridge health/reinject、helper restart、selector variants 和 protocol fixture；失败保存 trace、DOM snapshot 和脱敏日志。
- **验收标准**：CI 至少运行启动、注入、重启、错误停止四条 smoke；每条失败有可下载 artifact；不连接真实 OpenAI/第三方服务；Windows 必测，具备 macOS runner 时同步验证。

## 三、第三优先级：用户体验打磨

### UX-001：建立 Manager 统一的视觉与组件规范

- **所属类别**：用户体验
- **优先级**：**P2**；影响面广但不直接阻断功能，必须在性能/稳定性基线稳定后实施。
- **问题/目标**：报告把项目定位为包含 Manager、Stepwise/Zed/WeChat 等体验增强的套件，同时指出前端体量和 DOM coupling 造成一致性维护成本；计划 T3 的拆分为统一组件提供窗口（[报告组织与体验](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L93-L120)、[计划 T3](https://github.com/TttXxx36/Codex--/blob/Gemini/DEVELOPMENT_PLAN.md#L157-L163)）。
- **初步方案**：先盘点按钮、表单、卡片、表格、状态、弹窗和间距，抽取颜色/字号/圆角/间距 tokens；统一 hover/focus/disabled/loading/error/success 状态，沿用现有布局与默认值，不以视觉重构替换功能修复。
- **验收标准**：核心设置、供应商、会话和诊断页面使用同一组件语义；键盘 focus 和禁用态可见；窄窗口/深浅主题无文字截断；截图或人工 checklist 能证明无未解释的样式漂移。

### UX-002：简化供应商切换、会话治理和恢复工作流

- **所属类别**：用户体验
- **优先级**：**P2**；可降低误操作和学习成本，但依赖 BUG-002/BUG-005 的正确性。
- **问题/目标**：计划同时安排认证切换（T5）、DOM 操作 fallback（T6）和错误引导（T7）；报告把配置网关、会话治理和启动/交互痛点列为产品定位问题，但没有可量化用户反馈（[计划 T5–T7](https://github.com/TttXxx36/Codex--/blob/Gemini/DEVELOPMENT_PLAN.md#L177-L201)、[报告定位](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L10-L24)）。
- **初步方案**：为切换流程提供“当前来源 → 目标 profile → 将改变的配置 → 预检 → 应用 → 可回滚结果”的单一入口；删除/undo 显示影响范围和备份状态；启动/重注入显示 ready、处理中、失败和需要用户操作四种明确状态。
- **验收标准**：核心流程没有重复入口或隐式副作用；切换前可见差异并能取消，失败后可一键回滚；删除只需一次确认且能直接进入 undo；首次用户测试中每一步都有明确下一步，不依赖查看日志或手工编辑 TOML。

### UX-003：提供本地脱敏请求错误看板和可执行反馈文案

- **所属类别**：用户体验
- **优先级**：**P2**；直接改善故障定位和用户信任，计划明确要求，成本中等。
- **问题/目标**：计划 T7 要求展示最近 20 次请求、错误详情和一键修复引导；报告同时指出诊断、协议代理和 provider 路由复杂，当前报告没有证明已有统一的用户可读反馈（[计划 T7](https://github.com/TttXxx36/Codex--/blob/Gemini/DEVELOPMENT_PLAN.md#L196-L201)、[报告技术拓扑](https://github.com/TttXxx36/Codex--/blob/Gemini/docs/reports/2026-09-06-codex-plus-plus-comprehensive-analysis-report.md#L28-L91)）。
- **初步方案**：复用现有本地结构化诊断日志，按 request id 关联 provider/model/protocol/status/elapsed/TTFT/error class；把 400、401、timeout、tool、media、bridge 分成用户可理解的类别，每类提供原因、下一步和安全的复制内容；默认不启用远程 collector。
- **验收标准**：看板最多 20 条且刷新不产生轮询风暴；每类错误都有清晰标题、当前状态、建议动作和重试/回滚入口；单测确认 key/token/Bearer/header/body 不出现；离线运行不产生网络请求。

## 推荐落地顺序与总闸门

```text
PERF-001（renderer CPU/RSS）
        ↓
PERF-002 / PERF-003 / PERF-004（加载、查询、并发基线）
        ↓
BUG-001 / BUG-002（启动与认证核心闸门）
        ↓
BUG-003 / BUG-004 / BUG-005 / BUG-006 / BUG-007（协议、注入、数据、回归）
        ↓
UX-001 / UX-002 / UX-003（视觉、工作流、反馈）
```

每项完成前都必须补齐 **Plan / Actual / Results**，记录版本、环境、命令、样本、p50/p95 和 artifact；真实 API key、Cookie、会话内容不进入 fixture、日志或报告。若发现凭据可能被覆盖/误删、真实 session 可能外传，或动态换端口会改写用户配置，应立即停止该分支并保留回滚副本。
