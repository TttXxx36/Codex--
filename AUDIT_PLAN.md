# Codex++ 审查与准入大纲 (AUDIT_PLAN)

> **定位与目标**：规范代码合规、静态安全、凭据防泄漏、架构一致性与改动准入，充当进入开发与测试大纲前的“第一道质量安检门”。  
> **审查基线**：全量继承 GPT 两份深度只读审计报告（[codex-plus-plus-review-report.md](D:/Document/Codex/codex-plus-plus-review-report.md) 与 [codex-plus-plus-review-assessment.md](D:/Document/Codex/codex-plus-plus-review-assessment.md)）。  
> **核心原则**：审查只证明“问题已被发现并列入台账”，不因审查通过而免除代码修复与自动化测试。

---

## 📌 1. 核心审查原则与证据评级体系

所有拟合入的改动或新增代码，均须经受四级证据审查评级（Grounding Levels）：
- **Level S (Source Checked)**：经静态代码走查，函数签名、错误处理路径与防御分支完备，消除未捕获的异常与空指针风险；
- **Level T (Test Verified)**：包含明确的单元测试或 Mock 契约测试，断言精准无遗漏，在纯内存环境下自动化通过；
- **Level C (CI Pass)**：在严格依赖环境下（`npm ci`、`tsc`、`cargo test`、`cargo build`）通过全量构建与静态扫描；
- **Level D (Desktop Validated)**：在宿主桌面系统经过进程、窗口和渲染真实环境人工复核，确认行为一致。

---

## 🛡️ 2. 八大安全与合规审查闸门 (Audit Gates)

拟合入的任何功能，必须逐项通过以下 8 个审查维度的硬性检验：

### 闸门 1：敏感凭据与数据脱敏 (Privacy & Secrets)
- [ ] 严禁在日志中输出未脱敏的 API Key（如 `sk-...`）、Authorization 头部（`Bearer ...`，支持大小写不敏感 `(?i)bearer\s+` 与多 token 递归脱敏）；
- [ ] 诊断面板的 `statusDescription` 禁止直接拼接底层错误原文（如带有敏感参数的 URL、API Key 或私密报文）；
- [ ] 会话分享机制必须为纯本地 Markdown 导出与系统剪贴板安全写入，杜绝拼接任何无效公网域名（如 `share.codexpp.cc`、`codexpp-share.pages.dev`）或静默外联上传。

### 闸门 2：命令契约与“假成功”阻断 (Truth in UI)
- [ ] Tauri 后端核心指令返回必须遵循结构化契约：`{ ok: bool, code?: String, message?: String, undo_token?: String, recovery?: String }`；
- [ ] 前端 UI 禁止在无后端明确确认的情况下提前弹出“操作成功”；
- [ ] 撤销或回滚操作若在后端执行失败，前端必须保留撤销凭证，并显示真实错误与恢复入口，严禁显示假成功。

### 闸门 3：进程生命周期与本地网络安全 (Loopback & Lifecycle)
- [ ] 本地 Helper 优雅停机接口（`/helper/shutdown`）必须校验随机单次生命周期 Token（Bearer 鉴权），且仅允许本地回环 `POST` 请求；
- [ ] 严格禁止未认证的 HTTP `OPTIONS` 请求触发停机或修改系统状态（必须返回 405 Method Not Allowed）；
- [ ] 本地 HTTP 接口禁止向公网开放通配 CORS（`*`），严格限制只允许授权的本地域名或应用来源；
- [ ] 动态端口探测逻辑严禁在重试重定向中硬编码 57321，必须贯穿实际分配的动态端口。

### 闸门 4：配置与文件事务原子性 (Configuration Atomicity)
- [ ] 涉及 `config.toml`、`auth.json`、`settings.json` 的批量修改必须具备原子快照与回滚补偿；
- [ ] 撤销动作前必须比对文件当前指纹，防止覆盖用户在外部手动编辑的新内容（CAS 防并发踩踏）；
- [ ] 纯 API 模式或会话索引删除时，备份写入失败严禁通过 `.ok()` 静默吞掉，必须显式向上冒泡。

### 闸门 5：环境变量治理与 401 隔离 (Env Conflicts & Auth Guard)
- [ ] 环境变量清理禁止简单按 `OPENAI_` 前缀一刀切；
- [ ] 必须比对变量名、来源、真实哈希与当前 Profile 预期，相同值自动视为一致，未知变量仅作提示而不擅自删除；
- [ ] 清理前必须原子备份明文值，并提供产品级的还原入口；
- [ ] 针对非 OpenAI 供应商，必须校验是否有残留的旧官方凭据导致请求被意外重定向并返回 401。

### 闸门 6：依赖供应链与安全配额 (Supply Chain & Quotas)
- [ ] 脚本市场、主题市场与插件安装必须强制 HTTPS 下载、仅跟随 HTTPS 重定向、校验 SHA-256 完整性与 5 MiB 文件大小上限；
- [ ] 解压本地或外部 ZIP 文件必须有单文件大小、解压总大小、文件总数与目录深度配额，杜绝解压炸弹与资源耗尽；
- [ ] CI 流水线统一使用锁定版本的 `npm ci`，杜绝动态引入未经审计的次级依赖。

### 闸门 7：性能真实性与零虚假估算 (Performance Honesty)
- [ ] 供应商测速矩阵严禁采用任何固定比例乘数（如 `ttftMs = latency * 0.7`）伪造首字节时间；非流式必须显式标为 `TTFT 未测`，仅在 SSE 首个非空分块到达时真实捕获时间；
- [ ] 测速请求严禁将 3xx 重定向误判为成功，必须返回 `redirect` 分类与目标 URL 配置指引；
- [ ] 协议代理转发在客户端未声明 `custom` 工具时，严禁无条件解析 JSON AST，必须进行原生响应透传与零拷贝字节流传输；
- [ ] 数据库查询必须具备覆盖索引基线，杜绝 $O(N)$ 翻页全表 ID 扫描与内存堆内存风暴。

### 闸门 8：模块化工程边界与注入脚本一致性 (Modular Engineering & Drift Gate)
- [ ] 前端 `App.tsx` 路由屏幕必须采用模块顶层 `lazy(() => import(...))` 进行异步按需解耦，并由 `Suspense` 隔离；
- [ ] 注入脚本 `renderer-inject.js` 必须采用有序分层源码维护（`assets/inject/src/`），且打包产物必须通过 `npm run inject:check` 校验，保证与 Rust `include_str!` 单一产物字节级严格对齐，零隐形漂移。

---

## 📋 3. 审查缺陷台账与全生命周期状态映射 (Phase 1 & Phase 2)

| 缺陷编号 | 风险描述与审查位置 | 严重级别 | 承接任务与实现 Commit | 审查验收结论 |
| :--- | :--- | :---: | :---: | :---: |
| **AUDIT-01** | 回环停机接口缺少 Token 认证，OPTIONS 误触停机 (`launcher.rs:1326`) | **P1** | 任务 18 (`dad1589`) | **Pass (Level S/T)**: 增加随机 Token，OPTIONS 返回 405 |
| **AUDIT-02** | 供应商切换撤销 ID 由前端生成且失败存在假成功 (`App.tsx:2818` / `relay_switch.rs`) | **P1** | 任务 16 (`fbabee3`) | **Pass (Level S/T)**: 后端不可伪造 UUID 快照，CAS 校验防踩踏 |
| **AUDIT-03** | 环境变量清理按前缀误删且缺少前端恢复入口 (`env_conflicts.rs:163`) | **P1** | 任务 17 (`619ff64`) | **Pass (Level S/T)**: 值级比对，原子备份，提供还原入口 |
| **AUDIT-04** | 日志脱敏只处理首个大小写敏感 Bearer Token (`diagnostic_log.rs:165`) | **P1** | 任务 19 (`82d0bd6`) | **Pass (Level S/T)**: 正则不区分大小写全局替换多 Bearer 与查询参数 |
| **AUDIT-05** | 诊断错误面板将原始未分类信息透传可能泄露凭据 (`request-diagnostics.ts:191`) | **P1** | 任务 19 (`82d0bd6`) | **Pass (Level S/T)**: 结构化状态分类，过滤敏感 URL/报文 |
| **AUDIT-06** | 测速矩阵 TTFT 为前端乘 0.7 估算伪造 (`App.tsx:4367` / `relay_config.rs`) | **P2** | 任务 24 (`5eefb7d`) | **Pass (Level S/T)**: 消除 0.7 乘数，真实 SSE 首块耗时测量，3xx 严谨判定 |
| **AUDIT-07** | Keyset 辅助代码存在但未真正接入会话实际分页 (`App.tsx:6094` / `storage.rs`) | **P2** | 任务 25 (`bb1b67e`) | **Pass (Level S/T)**: 多 Schema 自适应索引，双向游标贯通 |
| **AUDIT-08** | 动态端口探测分支中重试停机写死 57321 (`launcher.rs:285`) | **P2** | 任务 18 (`dad1589`) | **Pass (Level S/T)**: 动态端口隔离路径与统一参数贯穿 |
| **AUDIT-09** | 纯 API 模式删除备份写入失败被 `.ok()` 吞掉 (`storage.rs:53`) | **P1** | 任务 16 (`fbabee3`) | **Pass (Level S/T)**: 写入失败显式返回 Err 阻断 |
| **AUDIT-10** | 注入端残留远程分享加密调用与伪公网 URL 拼接 (`renderer-inject.js:7229`) | **P2** | 任务 20 (`6642e1a`) | **Pass (Level S/T)**: 清理失效外联与加密参数，纯本地导出 |
| **AUDIT-11** | 缺乏跨平台 CI 自动化门禁，本地无依赖易漏测 (`.github/workflows/`) | **P1** | 任务 21 (`aed14dc`) | **Pass (Level S)**: 新增 `ci.yml` 双矩阵检查工作流 |
| **AUDIT-12** | `App.tsx` 1.13 万行巨型单体导致首屏 Chunk 膨胀 (`App.tsx`) | **P2** | 任务 22 (`3a749fa`) | **Pass (Level S/T)**: 14 个 Screen 全部拆解为独立 lazy 模块 |
| **AUDIT-13** | `renderer-inject.js` 单文件维护容易产生注入漂移 (`renderer-inject.js`) | **P2** | 任务 23 (`0aa6214`) | **Pass (Level S/T)**: 拆分为 17 个模块并增加 SHA-256 漂移构建检查 |
| **AUDIT-14** | WeChat 沙箱枚举不兼容与国产模型 Responses custom 工具调用崩溃 | **P2** | 任务 26 (`af070a7`) | **Pass (Level S/T)**: 沙箱映射修复，custom 降级为 function 并恢复 |
| **AUDIT-15** | SQLite 只读库与并发锁导致会话分页查询崩溃 (`storage.rs:545`) | **P1** | 任务 25-加固 (`2d1d80d`) | **Pass (Level S/T)**: 索引建立改为容错非致命执行 |
| **AUDIT-16** | 翻页调用全量 ID 查询导致内存堆内存暴增与 GC 停顿 (`commands.rs:2425`) | **P2** | 任务 25-加固 (`2d1d80d`) | **Pass (Level S/T)**: 单库使用 `count_local_sessions` 旁路全量 ID |

---

## 🎯 4. 针对第一轮与第二轮代码的审查执行指南 (Codex 依据本大纲操作)

Codex 在执行审查环节时，必须严格按照以下三步执行，并输出《审查结论报告》：

### 步骤 1：第一轮与第二轮关键变更走查对照清单 (Review Checklist)
1. **基础稳定性走查 (Tasks 01~05, Tasks 16~18)**：
   - 检查 `crates/codex-plus-core/src/launcher.rs` 中 `/helper/shutdown` 路由的认证 Token 匹配逻辑；
   - 检查 `crates/codex-plus-core/src/relay_switch.rs` 中快照文件写入、SHA-256 计算与恢复时的指纹 CAS 比对；
   - 检查 `crates/codex-plus-core/src/env_conflicts.rs` 中环境变量是否严格基于值和哈希比对，而非粗暴匹配 `OPENAI_` 前缀。
2. **脱敏与本地化走查 (Tasks 05, 11, 19, 20)**：
   - 检查 `crates/codex-plus-core/src/diagnostic_log.rs` 中正则表达式是否包含 `(?i)bearer`、`sk-` 以及常见 URL 查询凭据；
   - 检查 `apps/codex-plus-manager/src/request-diagnostics.ts` 是否阻断了原生错误信息直出；
   - 检查 `assets/inject/renderer-inject.js` 确保彻底不存在 `share.codexpp.cc` 等公网域名构造。
3. **架构与解耦走查 (Tasks 10, 22, 23)**：
   - 检查 `apps/codex-plus-manager/src/views/` 下 14 个 Screen 模块是否全部采用 `React.lazy` 动态导入，且 App.tsx 中保留了 `Suspense` 降级兜底；
   - 检查 `assets/inject/src/` 的 17 个模块与构建脚本 `build-renderer-inject.mjs`，运行 `npm run inject:check` 验证是否有未同步产物。
4. **性能与协议走查 (Tasks 06, 12, 13, 24, 25, 26 及加固)**：
   - 检查 `crates/codex-plus-core/src/relay_config.rs`，确认已无 `* 0.7` 计算逻辑，TTFT 由真实分块计时产生；
   - 检查 `crates/codex-plus-data/src/storage.rs`，确认 `ensure_session_indexes` 不会引发只读查询 panic，且具备原生 `count_local_sessions`；
   - 检查 `crates/codex-plus-core/src/protocol_proxy.rs`，确认在 `!request_has_custom_tools` 时直接透传原始 SSE 字节流。

### 步骤 2：审查结论判定分级
每次代码审查必须给出明确判定：
- **`Pass`**：完全满足 8 大闸门与缺陷修复要求，无倒退隐患，准入进入全面测试执行；
- **`Conditional Pass`**：逻辑与静态无误，但依赖外部环境验证（如特定 Windows/macOS 桌面 E2E 或云端 CI 矩阵）；
- **`Block`**：存在凭据泄露风险、假成功隐患、死锁重试或严重性能回退，打回由工兵修复。
