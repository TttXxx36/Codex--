# Codex++ 审查与准入大纲 (AUDIT_PLAN)

> **定位与目标**：规范代码合规、静态安全、凭据防泄漏、架构一致性与改动准入，充当进入开发与测试大纲前的“第一道质量安检门”。  
> **审查基线**：全量继承 GPT 两份深度只读审计报告（[codex-plus-plus-review-report.md](D:/Document/Codex/codex-plus-plus-review-report.md) 与 [codex-plus-plus-review-assessment.md](D:/Document/Codex/codex-plus-plus-review-assessment.md)）。  
> **核心原则**：审查只证明“问题已被发现并列入台账”，不因审查通过而免除代码修复与自动化测试。

---

## 📌 1. 核心审查原则与证据评级体系

所有拟合入的改动或新增代码，均须经受四级证据审查评级：
- **Level S (Source Checked)**：经静态代码走查，函数签名、错误处理路径与防御分支完备；
- **Level T (Test Verified)**：包含明确的单元测试或 Mock 契约测试，断言精准无遗漏；
- **Level C (CI Pass)**：在严格依赖环境下（`npm ci`、`tsc`、`cargo test`）通过全量构建与静态扫描；
- **Level D (Desktop Validated)**：在宿主桌面系统经过进程、窗口和渲染真实环境人工复核。

---

## 🛡️ 2. 六大安全与合规审查闸门 (Audit Gates)

拟合入的任何功能，必须逐项通过以下 6 个审查维度的硬性检验：

### 闸门 1：敏感凭据与数据脱敏 (Privacy & Secrets)
- [ ] 严禁在日志中输出未脱敏的 API Key（如 `sk-...`）、Authorization 头部（`Bearer ...`，支持大小写不敏感与多 token 场景）；
- [ ] 诊断面板的 `statusDescription` 禁止直接拼接底层错误原文（如带有敏感参数的 URL 或报文）；
- [ ] 会话分享机制必须为纯本地 Markdown 导出，杜绝拼接任何无效公网域名（如 `share.codexpp.cc`）或静默外联上传。

### 闸门 2：命令契约与“假成功”阻断 (Truth in UI)
- [ ] Tauri 后端核心指令返回必须遵循结构化契约：`{ ok: bool, code?: String, message?: String, undo_token?: String, recovery?: String }`；
- [ ] 前端 UI 禁止在无后端明确确认的情况下提前弹出“操作成功”；
- [ ] 撤销或回滚操作若在后端执行失败，前端必须保留撤销凭证，并显示真实错误与恢复入口，严禁显示假成功。

### 闸门 3：进程生命周期与本地网络安全 (Loopback & Lifecycle)
- [ ] 本地 Helper 优雅停机接口（`/helper/shutdown`）必须校验随机单次生命周期 Token；
- [ ] 严格禁止未认证的 HTTP `OPTIONS` 请求触发停机或修改系统状态；
- [ ] 本地 HTTP 接口禁止向公网开放通配 CORS（`*`），严格限制只允许授权的本地域名或应用来源；
- [ ] 动态端口探测逻辑严禁在重试重定向中硬编码 57321。

### 闸门 4：配置与文件事务原子性 (Configuration Atomicity)
- [ ] 涉及 `config.toml`、`auth.json`、`settings.json` 的批量修改必须具备原子快照与回滚补偿；
- [ ] 撤销动作前必须比对文件当前指纹，防止覆盖用户在外部手动编辑的新内容（防并发踩踏）；
- [ ] 纯 API 模式或会话索引删除时，备份写入失败严禁通过 `.ok()` 静默吞掉。

### 闸门 5：环境变量治理与 401 隔离 (Env Conflicts & Auth Guard)
- [ ] 环境变量清理禁止简单按 `OPENAI_` 前缀一刀切；
- [ ] 必须比对变量名、来源、真实哈希与当前 Profile 预期，相同值自动视为一致，未知变量仅作提示而不擅自删除；
- [ ] 清理前必须原子备份明文值，并提供产品级的还原入口。

### 闸门 6：依赖供应链与安全配额 (Supply Chain & Quotas)
- [ ] 脚本市场、主题市场与插件安装必须校验 SHA-256 完整性与文件大小上限；
- [ ] 解压本地或外部 ZIP 文件必须有单文件大小、解压总大小、文件总数与目录深度配额，杜绝解压炸弹与资源耗尽；
- [ ] CI 流水线统一使用锁定版本的 `npm ci`，杜绝动态引入未经审计的次级依赖。

---

## 📋 3. 审查缺陷台账与当前状态映射

| 缺陷编号 | 风险描述 | 对应审查位置 | 严重级别 | 承接开发任务 |
| :--- | :--- | :--- | :---: | :---: |
| **AUDIT-01** | 回环停机接口缺少 Token 认证，OPTIONS 误触停机 | `launcher.rs:1326` | **P1** | 任务 18 |
| **AUDIT-02** | 供应商切换撤销 ID 由前端生成且失败存在假成功 | `App.tsx:2818` / `relay_switch.rs` | **P1** | 任务 16 |
| **AUDIT-03** | 环境变量清理按前缀误删且缺少前端恢复入口 | `env_conflicts.rs:163` | **P1** | 任务 17 |
| **AUDIT-04** | 日志脱敏只处理首个大小写敏感 Bearer Token | `diagnostic_log.rs:165` | **P1** | 任务 19 |
| **AUDIT-05** | 诊断错误面板将原始未分类信息透传可能泄露凭据 | `request-diagnostics.ts:191` | **P1** | 任务 19 |
| **AUDIT-06** | 测速矩阵 TTFT 为前端乘 0.7 估算伪造 | `App.tsx:4367` / `relay_config.rs` | **P2** | 任务 24 |
| **AUDIT-07** | Keyset 辅助代码存在但未真正接入会话实际分页 | `App.tsx:6094` / `storage.rs` | **P2** | 任务 25 |
| **AUDIT-08** | 动态端口探测分支中重试停机写死 57321 | `launcher.rs:285` | **P2** | 任务 18 |
| **AUDIT-09** | 纯 API 模式删除备份写入失败被 `.ok()` 吞掉 | `storage.rs:53` | **P1** | 任务 16 |
| **AUDIT-10** | 注入端残留远程分享加密调用与伪公网 URL 拼接 | `renderer-inject.js:7229` | **P2** | 任务 20 |

---

## 🎯 4. 审查准入工作流 (Audit Workflow)

1. **提交前自检**：开发者提交 PR 前，依据上述 6 大闸门与台账进行逐项核验；
2. **审查结论判定**：每次审查给出明确结论：
   - `Pass`：通过，准入进入自动化测试；
   - `Conditional Pass`：带条件通过（如仅针对特定环境修复，需在特定平台补充测试）；
   - `Block`：拒绝合入，列出违背的闸门与缺陷，打回修改。
