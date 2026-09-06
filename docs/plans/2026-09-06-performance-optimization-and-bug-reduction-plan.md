# Codex++ 性能优化与稳定性提升实施计划 (Performance & Bug Reduction Plan)

> **目标**：全面优化 Codex++ 的使用性能、彻底降低运行时 Bug 发生率、大幅提升用户操作与模型调用体验。  
> **分支**：`Gemini`  
> **创建日期**：2026-09-06  
> **状态**：已立项 / 待实施

---

## 1. 核心目标与衡量指标

| 优化维度 | 现状瓶颈 | 预期达成目标 | 验证手段 |
| :--- | :--- | :--- | :--- |
| **运行时 CPU 占用** | 全局 MutationObserver 监听 `document.documentElement`，大模型高速吐字时高频触发生长遍历 | 渲染进程高频流式输出时的 CPU 占用率降低 **40% 以上**，打字无掉帧 | 开发者工具 Performance 面板录制流式输出时的 Scripting 耗时 |
| **管理工具 UI 流畅度** | 1.13 万行 `App.tsx` 状态全量集中，表单击键引起整树重新渲染 | 输入框击键延迟降至 **< 16ms**，组件按视图解耦 | React Profiler 检查 Re-render 范围与渲染耗时 |
| **服务重启端口竞态** | 协议代理 57321 端口在强制重启时因 `TIME_WAIT` 偶发性绑定失败 | 快速切换供应商或连续重启 20 次，端口重用成功率 **100%** | 循环触发重启/切换脚本，无端口占用报错 |
| **供应商切换认证隔离** | 官方混入模式与纯 API 模式切换时偶发 Token 缓存残留导致 401 | 模式切换后立即生效，Token 隔离率 **100%** | 连续在各模式间切换并立即发起对话请求 |
| **DOM 变更韧性** | 强依赖固定类名，官方前端更新时菜单或会话删除按钮可能隐蔽失效 | 核心按钮增加多级备选降级选择器，抗改版能力大幅提升 | 在 DOM 类名变更模拟测试中验证自动降级识别 |
| **使用体验与排错效率** | 上游 401/500 报错缺乏直观排错信息，只能翻看日志文件 | 管理器内置实时 API 调试看板与一键测速矩阵，排错时间缩短至 **秒级** | UI 直观查看最近请求 Payload 与状态码 |

---

## 2. 阶段性实施规划

### 阶段一：渲染进程与管理器性能调优 (消除卡顿)

- [ ] **1.1 收敛渲染端 DOM 变动监听范围 (`renderer-inject.js`)**
  - **问题定位**：`assets/inject/renderer-inject.js` 中的 `window.__codexSessionDeleteObserver`、`window.__codexUpstreamBranchDropdownObserver` 均采用 `{ childList: true, subtree: true }` 监听了 `document.documentElement`。
  - **改造方案**：
    1. 增加容器就绪检测：仅将监听范围锚定在侧边栏容器（如 `aside.app-shell-left-panel`）；
    2. 主会话对话流区域明确排除在监听之外；
    3. 流式输出期间加入动态节流阀（Throttle Window），在对话活跃接收 token 时挂起不必要的侧边栏重扫。
- [ ] **1.2 Statsig 快速启动劫持层优化**
  - 在 Rust 本地 Bridge 层对统计与打点请求（`ab.chatgpt.com`、`statsigapi.net`）提供快速 204 本地返回，彻底免除官方客户端海外连接握手延迟。
- [ ] **1.3 管理器前端 (`App.tsx`) 状态拆解与防抖**
  - 将庞大的 `App.tsx` 按 16 大路由模块拆解为独立的视图组件（如 `views/RelayView.tsx`、`views/SessionsView.tsx`、`views/EnhanceView.tsx`）；
  - 对 Base URL、API Key、上下文窗口等高频输入的受控状态增加防抖更新（Debounce），避免每次击键触发全局渲染。

---

### 阶段二：稳定性加固与 Bug 根治 (消除崩溃与异常)

- [ ] **2.1 57321 协议代理端口生命周期与套接字重用改造**
  - **文件**：`crates/codex-plus-core/src/launcher.rs` 与 `protocol_proxy.rs`
  - **改造方案**：
    1. 在杀死旧 launcher / helper 前，先调用 `POST /_shutdown` 触发平滑停机，主动关闭 TCP 监听套接字；
    2. 套接字绑定时设置 `SO_REUSEADDR`（以及支持平台上的 `SO_REUSEPORT`），消除 `TIME_WAIT` 锁死问题；
    3. 完善重试指数退避算法，避免固定 200ms 的忙等待。
- [ ] **2.2 供应商切换时的会话与 Cookie 原子清理**
  - **文件**：`crates/codex-plus-core/src/relay_switch.rs`
  - **改造方案**：
    1. 切换模式时，主动通过 CDP 执行 `Network.clearBrowserCookies` 与 `Storage.clearDataForOrigin`，清理 Electron 渲染进程中的残留鉴权缓存；
    2. 严格核验 `~/.codex/auth.json` 与 `~/.codex/config.toml` 的互斥一致性。
- [ ] **2.3 弹性选择器降级链 (Selector Fallback Chain)**
  - **文件**：`assets/inject/renderer-inject.js`
  - 为会话项、删除按钮、顶部状态栏等关键注入点构建降级选择器链：
    `[data-app-action-sidebar-thread-id]` -> `nav a[href*='/c/']` -> 遍历带有会话图标特征的 DOM 节点，避免官方单次类名改动导致功能大面积瘫痪。

---

### 阶段三：用户体验升级 (可视与可控)

- [ ] **3.1 上游 API 实时排错看板 (API Request & Error Inspector)**
  - **位置**：管理器“概览”或“供应商”页面
  - **功能**：
    1. 记录最近 20 条经过 `protocol_proxy.rs` 的请求元数据（时间戳、请求模型、目标 URL、HTTP 状态码、耗时）；
    2. 针对非 200 请求，一键查看上游返回的错误详情（如无效 Key、余额不足、无权访问模型等），提供针对性的修复建议。
- [ ] **3.2 多供应商并发测速矩阵 (Speed Matrix)**
  - **功能**：
    1. 支持一键并发向所有已启用的 Relay Profiles 发送测试 Prompt；
    2. 可视化表格呈现：连接延迟 (Ping)、首字响应耗时 (TTFT)、每秒 Token 吞吐速率及可用性状态；
    3. 支持按测速表现一键将最优节点设为当前主力。
- [ ] **3.3 系统托盘轻量控制**
  - 管理器支持最小化至系统托盘，托盘右键菜单直接提供“切换当前供应商”、“重启当前 Codex”，高频操作无需展开全量面板。

---

## 3. 验证准则与回归流程

每完成一个阶段的改动，必须通过以下验证流程：
1. **自动化构建与单元测试**：
   - Rust: `cargo test --workspace` 全部通过；
   - 前端: `npm run check` (TypeScript 类型检查) 与 `npm run test` 全部通过。
2. **场景化手动验证**：
   - [ ] 极速启动：冷启动 Codex++，确认从双击到主界面完全就绪在 2 秒以内；
   - [ ] 高速吐字：开启 DeepSeek-R1 / V3 等模型，生成 2000 字长文本，确认无主线程卡顿；
   - [ ] 疯狂切换：在管理工具中连续快速切换 5 个不同供应商配置，确认请求正常无 57321 端口占用错误；
   - [ ] 模式互斥：在“官方登录混入”与“纯 API”之间来回切换，确认官方凭据无泄露或被覆写。
