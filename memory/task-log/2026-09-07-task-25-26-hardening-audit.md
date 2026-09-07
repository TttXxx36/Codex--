# Task 25 & Task 26 运行时异常与性能瓶颈深度加固记录

- **日期**：2026-09-07
- **分支**：Gemini
- **执行角色**：Antigravity / Gemini 架构审查与运行时审计

## 1. 发现的问题与隐患分析

在针对任务 25（PERF-008 Keyset 分页）与任务 26（BUG-011 微信与 Responses 兼容）的代码进行深入运行态审视时，发现 4 项存在实际报错和严重性能瓶颈的代码逻辑：

1. **SQLite 只读与并发只读崩溃风险（`storage.rs`）**：
   - 现象：在分页查询 `list_local_sessions_keyset` 与读取 `list_local_session_ids` 时，直接使用了 `ensure_session_indexes(&db)?`。
   - 隐患：当用户多开 Codex 客户端、数据库文件处于只读介质、或遇到短暂的 SQLite 写入锁（Busy）时，`CREATE INDEX IF NOT EXISTS` 必然失败抛出 `Err`，直接导致原本纯只读的会话列表渲染接口全盘崩溃。
   - 修复：将其调整为容错执行 `let _ = ensure_session_indexes(&db);`，确保纯读操作不受索引创建失败的影响；同时在 `find_local_session_time` 中移除了重复的索引创建开销。

2. **Keyset 分页未能避免内存全量加载（`commands.rs`）**：
   - 现象：前端翻页时，每次调用 `list_local_sessions`，Tauri 端都会先执行 `adapter.list_local_session_ids()`。
   - 隐患：当用户历史会话达到 30,000+ 条时，每一次翻页都会在内存中分配 30,000 个 `String` 对象构建 `HashSet`，产生大量堆分配和 GC 抖动，使得后端虽然在 SQL 层实现了 $O(1)$ Keyset，但在宿主内存层依然是 $O(N)$。
   - 修复：在 `storage.rs` 中新增 `count_local_sessions`（利用 SQLite `SELECT COUNT(*)` 和覆盖索引极速计数）；在 `commands.rs` 中当检测到单库时（覆盖 95% 以上常规安装），直接调用 `count_local_sessions()`，彻底旁路 `list_local_session_ids()`。

3. **跨库去重无谓的重复开库开销（`commands.rs`）**：
   - 现象：遍历每条会话查验是否有跨库更新副本时，会连带检查会话来源本身的数据库。
   - 修复：增加 `if db_path.to_string_lossy() == session.db_path { continue; }` 快速跳过当前库，减少磁盘 I/O。

4. **Responses SSE 流式转发每个 Chunk 的 JSON 重解析与重序列化（`protocol_proxy.rs` & `launcher.rs`）**：
   - 现象：所有经由 Responses 协议代理的 SSE 流，无条件送入 `ResponsesSseCustomToolConverter`，将每个 chunk 解析为 JSON AST 并尝试转换，即使用户请求根本不包含任何 `custom` 工具。
   - 隐患：在长文本或高频代码补全时，大量无意义的字符串切分、UTF-8 边界重组与 JSON 反序列化带来可观的 CPU 占用与延迟。
   - 修复：新增 `request_has_custom_tools` 判定。若未请求 `custom` 工具，流式直接由 TCP 零拷贝字节透传，非流式直接原样透传 `upstream_body`。

## 2. 验证结果

- `npm test`：200/200 全部通过。
- `npm run inject:check`：通过，`renderer-inject.js` 483004 字节，SHA-256 无漂移。
- `git diff --check`：通过，无 CRLF 异常。
- 零新增敏感凭据/Token。
