# Codex++ (分支: Gemini) 开发交接与会话延续文档

> **文档生成时间**：2026-09-07 12:30 (Asia/Shanghai)  
> **交接目标**：在新会话中 100% 无缝继承 Codex++ 项目全量上下文、分支状态、已完成任务清单、当前工作区代码变更及下一步开发决策。

---

## 📌 1. 仓库、分支与测试基线

- **工作区绝对路径**：`d:\Document\Antigravity\Codex--`
- **当前开发分支**：`Gemini`（远程跟踪 `origin/Gemini`）
- **第二阶段基线备份分支**：`Codex`（已创建并推送至 `origin/Codex`，基线 Commit 为 `fbabee3`）
- **测试套件现状**：
  - `apps/codex-plus-manager` 纯 Node.js 测试：当前 **191 项自动化单测 100% 通过（0 failure）**，执行耗时 ~600ms；
  - 本地环境仅有 Node.js v24 + npm，缺少 Rust/Cargo/Tsc；
  - 遵循已建立的**双环测试验证架构**（内环：本地 `npm test` 极速拦截；外环：GitHub Actions 全矩阵编译与打包验证）。

---

## 📚 2. 四维架构治理体系（四大顶层大纲）

项目已建立完全独立的四维治理大纲，且均已与 `origin/Gemini` 保持同步：
1. **开发大纲**：[`DEVELOPMENT_PLAN_2.md`](file:///d:/Document/Antigravity/Codex--/DEVELOPMENT_PLAN_2.md)（承接第一阶段 15 个任务，规划任务 16 ~ 32，包含 P0/P1/P2 三级里程碑）；
2. **审查大纲**：[`AUDIT_PLAN.md`](file:///d:/Document/Antigravity/Codex--/AUDIT_PLAN.md)（涵盖 7 大审查红线、10 个独立审查维度、审计评分卡）；
3. **测试大纲**：[`TESTING_PLAN.md`](file:///d:/Document/Antigravity/Codex--/TESTING_PLAN.md)（四层测试金字塔、基准测量指标、脱敏红线扫描，以及第 5 节【双环驱动本地/CI协同架构】）；
4. **发版运维大纲**：[`RELEASE_OPS_PLAN.md`](file:///d:/Document/Antigravity/Codex--/RELEASE_OPS_PLAN.md)（三色门禁分级、金丝雀灰度、全自动构建与故障紧急撤退）。

---

## 🏆 3. 历史任务全景 (任务 01 ~ 任务 16 已全部完成并推送到远程)

### 第一阶段任务 (已发版发布至 v1.2.58)
- **任务 01**: 赞助商与隐私代码彻底清理 (Commit: `45d11a0`)
- **任务 02 (PERF-001)**: 注入端 250ms 死循环重试终止 (Commit: `001dfcb`)
- **任务 03 (BUG-001)**: 57321 端口平滑停机与单实例防死锁 (Commit: `1d915c6`)
- **任务 04 (BUG-002)**: 环境变量值级备份与原子撤销 (Commit: `3b1001e`)
- **任务 05 (BUG-006)**: 会话分享纯本地导出阻断远程 URL (Commit: `e775e13`)
- **任务 06 (BUG-003)**: 协议代理 Responses↔Chat 契约 (Commit: `f9a1c3a`)
- **任务 07 (BUG-004)**: 官方 DOM 选择器回退弹性 (Commit: `493a525`)
- **任务 08 (BUG-005)**: 401 诊断细化与 MiniMax 凭证安全 (Commit: `8a791a8`)
- **任务 09 (UX-002)**: 诊断日志敏感信息彻底脱敏 (Commit: `582e379`)
- **任务 10 (PERF-002)**: 会话列表分页游标与虚拟滚动 (Commit: `fa0b63b`)
- **任务 11 (PERF-003)**: SQLite 索引与查询执行计划深度优化 (Commit: `d434947`)
- **任务 12 (PERF-004)**: 供应商真实验证流式测速评分系统 (Commit: `8029c78`)
- **任务 13 (UX-003)**: 页面样式规范收敛与设计令牌系统 (Commit: `3ff5bb5`)
- **任务 14 (ENG-001)**: 测试套件与构建流全量绿灯收尾 (Commit: `72ec3cb`)
- **任务 15 (UX-001)**: 会话删除与重命名快捷操作前端闭环与安全加固 (Commit: `dc9ae8b`, Tag: `v1.2.58`)

### 第二阶段已提交任务
- **任务 16 (BUG-008)**: 命令执行结果结构化契约、持久化快照与 CAS 事务防篡改撤销 (Commit: `fbabee3`)
  - 后端实现 `relay_switch.rs` 磁盘隔离快照与 SHA-256 指纹；
  - 接入 `CommandActionResult<T>` 统一结构；
  - 注册 `undo_relay_switch` 与 `load_relay_switch_undo` Tauri 命令；
  - 前端彻底移除随机数与内存快照，支持重启后持久化发现与一键撤销。

---

## ⚡ 4. 当前工作区未提交状态与特别说明（重要！）

在上一轮对话中，Codex 根据之前的 Prompt 提前编写了针对 **启动器环境嗅探双轨收敛与强杀前优雅停机 (原任务 18 / BUG-010 / 对应原 BUG-007)** 的完整实现代码。当前工作区中包含以下未提交变更：

### 修改与新增文件清单
1. `Cargo.toml`：添加 `tokio` 的 `signal` 特性；
2. `apps/codex-plus-launcher/src/main.rs`：
   - 监听 Windows Console Close / Break / Logoff / Shutdown 及 Unix SIGTERM / Ctrl-C；
   - 触发 2 秒预算内的优雅停机 `handle.graceful_shutdown()`；
   - 对 `/helper/shutdown` 强制要求 POST 请求与 Authorization Bearer Token；
   - OPTIONS 预检请求拒绝直接触发停机，修复误停机隐患；
3. `crates/codex-plus-core/src/launcher.rs`：
   - 实现带鉴权 Token 的单次 Helper 停机；
   - 实现 CDP 断开前的资源注销与 Hook 清理；
4. `crates/codex-plus-core/src/watcher.rs` & `tests/watcher.rs`：
   - 收敛 `CodexRuntimeState` 状态机（`Absent`, `Starting`, `Ready`, `CdpOnly`）；
   - 修复进程存在但 CDP 尚在启动期间被误判为 absent 导致的重复拉起；
5. `crates/codex-plus-core/src/bridge.rs`：
   - 实现 `uninstall_bridge` 与 `build_bridge_cleanup_script`，清理注入的 DOM/Window 全局变量与回调；
6. `crates/codex-plus-core/src/paths.rs`：
   - 新增 `default_helper_runtime_path(helper_port)`；
7. `apps/codex-plus-manager/src/launcher-lifecycle.ts` & `.test.ts`：
   - 前端增加生命周期状态机与 2 秒清理预算断言，单测增至 **191 项**全部通过。

> ⚠️ **任务编号对齐状态**：
> 在大纲 [`DEVELOPMENT_PLAN_2.md`](file:///d:/Document/Antigravity/Codex--/DEVELOPMENT_PLAN_2.md) 中：
> - **任务 17 (BUG-009)** 为：环境变量值级归属判定与 401 凭证防破坏；
> - **任务 18 (BUG-010)** 为：Launcher / Bridge 生命周期状态机、停机 Token 认证与端口解耦。
> 
> 当前工作区实际已经完成了 **任务 18** 的代码。

---

## 🎯 5. 新会话接棒操作指引（在新会话中首要执行）

在新会话启动后，请按以下顺序推进：

### 选项 A（推荐：先审查合入当前已完成的代码并登记为任务 18）
1. 架构师审查当前工作区已就绪的 Launcher/Bridge 停机状态机代码（`npm test` 191/191 通过）；
2. 在 `DEVELOPMENT_PLAN_2.md` 中登记【任务 18 (P0 / BUG-010)】的实施步骤与验证结果；
3. 提交并推送任务 18：`git commit -m "feat(launcher): implement BUG-010 lifecycle state machine, shutdown token auth and bridge cleanup"` -> `git push origin Gemini`；
4. 随后分派【任务 17 (P0 / BUG-009): 环境变量值级归属判定与 401 凭证防破坏】给 Codex 执行。

### 选项 B（严格按大纲顺序）
1. 暂存当前未提交代码：`git stash push -m "wip: task 18 launcher lifecycle"`；
2. 分派并执行任务 17 (BUG-009)；
3. 任务 17 完成并合入后，再 `git stash pop` 恢复任务 18 进行审查与合入。
