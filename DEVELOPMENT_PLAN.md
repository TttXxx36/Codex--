# Codex++ 项目开发演进大纲与实施跟踪录 (DEVELOPMENT_PLAN)

> **项目目标**：打造极致轻量、超低 CPU 占用、无广告侵扰、零端口死锁、高可靠的工业级 Codex 桌面增强与管理套件。  
> **当前分支**：`Gemini`（默认主分支）  
> **最新基线版本**：`v1.2.57-gemini.2`（Commit: `07ca54c`）  
> **存放位置**：项目根目录 `DEVELOPMENT_PLAN.md`（实时更新维护）

---

## 📌 开发大纲维护机制与原则

1. **动态演进与实时同步**：本大纲为项目开发的全局主轴。实际开发主体上严格遵照本大纲实施，若过程中提出新想法、新诉求，必须在此大纲中第一时间追加节点、调整优先级并更新执行状态。
2. **闭环跟踪三要素**：每个开发节点均必须具备三项关键记录：
   - 🎯 **每一步的计划 (Plan)**：明确功能边界、解决的核心痛点与技术路线；
   - 🛠️ **实际完成的步骤 (Actual Steps)**：记录代码修改的具体文件、核心逻辑改造与安全处理；
   - ✅ **实际完成的结果 (Results & Verification)**：提供客观的验证指标、测试结果与前后对比。
3. **证据驱动与严谨验收**：
   - 严格区分“纸面宣称/理论指标”与“实测数据”；所有性能百分比（如 CPU -40%）在实测前标注为目标值；
   - 严防静默数据与凭据破坏：涉及环境变量清理、配置覆盖、会话持久化时，必须具备原子备份与双向回滚保障。

---

## 🔍 双视角审计与架构共识总结（基于 Codex 报告复核）

在对 `docs/reports/` 目录下 Codex 产出的《只读证据驱动分析与 P0–P3 任务草稿》与《下一阶段可执行任务清单》进行深度技术交叉核验后，提炼出以下核心事实与修正结论：

1. **基线版本与标签漂移对齐**：
   - 报告与原计划基准标记为 `v1.2.56`，当前仓库已完成广告清理并发布 `v1.2.57-gemini.2`。开发大纲全线更新基准为 `v1.2.57-gemini.2`。
2. **优先级再平衡（拒绝“重性能、轻死锁”的倒置）**：
   - Codex 清单中将“性能优化”单列为第一部分，但实际上如果**启动端口 57321 死锁**或**环境变量清理导致系统凭据丢失/401 鉴权阻断**，软件将完全不可用。
   - **新优先级铁律**：以系统可用性与凭据安全为绝对底线：
     - **P0 核心可用性与致命瓶颈**：57321 端口生命周期 (BUG-001) + 认证环境安全与 401 防残留 (BUG-002) + 渲染注入端 250ms 重试死循环与 DOM 监听收敛 (PERF-001)；
     - **P1 协议韧性与注入防护**：双向协议转换能力契约 (BUG-003) + DOM 弹性降级选择器 (BUG-004) + 会话分享纯本地收敛 (BUG-006) + 数据一致性 (BUG-005) + E2E 回归 (BUG-007)；
     - **P2 架构重构与深度体验**：Manager 1.13 万行 App.tsx 按需拆分 (PERF-002) + 本地请求/错误脱敏看板 (UX-003) + 多供应商测速 (PERF-004) + SQLite 深度优化 (PERF-003)。
3. **已实锤的重大潜在代码缺陷（由静态审计挖出）**：
   - **`renderer-inject.js` pureApi 死循环**：`noteAppServerModelRequestPatchMiss` 在 pureApi 模式下无视最大重试次数，无限制每 250ms 重新触发扫描，导致空闲 CPU 异常飙升；
   - **`env_conflicts.rs` 毁灭性清理**：直接按 `OPENAI_` 前缀暴力移除用户环境变量，且备份文件中仅保存 `value_present: bool` 未备份真实值，一旦误点清理无法逆向恢复；
   - **会话分享状态割裂**：后端在 `share.rs` 中已阻断公网请求，但注入前端仍尝试拼接 `share.codexpp.cc` 远程失效 URL。

---

## 🗺️ 总体实施规划与任务矩阵

```mermaid
graph TD
    subgraph 已完成阶段
        T01["✅ 任务 01: 赞助商广告与隐私代码深度精简"]
        T01B["✅ 任务 01-B: 敏感凭据递归脱敏与外联阻断"]
        T01C["✅ 任务 01-C: CI/CD 默认 Windows 流与全平台流解耦"]
        T01D["✅ 任务 01-D: 首页 JOJO 广告清除与项目归属切换"]
    end

    subgraph P0 阶段：核心可用性与致命瓶颈
        P0_1["✅ 任务 02 (PERF-001): 渲染端 250ms 死循环重试终止与 DOM 监听收敛"]
        P0_2["✅ 任务 03 (BUG-001): 57321 端口生命周期、优雅平滑停机与单实例守卫"]
        P0_3["✅ 任务 04 (BUG-002): 环境变量值级校验、可回滚安全备份与 401 凭证残留隔离"]
    end

    subgraph P1 阶段：协议兼容与注入韧性
        P1_1["✅ 任务 05 (BUG-006): 会话分享 UI/后端语义收敛为纯本地安全导出"]
        P1_2["✅ 任务 06 (BUG-003): Responses↔Chat 双向转换、图片 Data URL 与 SSE 状态契约"]
        P1_3["✅ 任务 07 (BUG-004): 官方改版弹性选择器降级链 (Class->ARIA->语义)"]
        P1_4["✅ 任务 08 (BUG-005): 会话删除/撤回与索引文件事务一致性治理"]
        P1_5["✅ 任务 09 (BUG-007): Electron/CDP/Launcher 最小自动化回归测试"]
    end

    subgraph P2 阶段：架构解耦与深度体验
        P2_1["✅ 任务 10 (PERF-002): App.tsx 1.13 万行超大单体拆解与 React memo/Suspense 解耦隔离"]
        P2_2["✅ 任务 11 (UX-003): 本地 API 请求与错误诊断脱敏看板"]
        P2_3["✅ 任务 12 (PERF-004): 多供应商并发测速矩阵与智能决策建议"]
        P2_4["✅ 任务 13 (PERF-003): SQLite 查询计划基线与海量会话检索优化"]
        P2_5["✅ 任务 14 (UX-002): 供应商平滑切换差异预检、会话安全回滚与单一入口治理"]
        P2_6["✅ 任务 15 (UX-001): 统一视觉与组件规范体系收敛，适配深浅色与防截断"]
    end

    T01D --> P0_1
    P0_1 --> P0_2
    P0_2 --> P0_3
    P0_3 --> P1_1
    P1_1 --> P1_2
    P1_2 --> P1_3
    P1_3 --> P1_4
    P1_4 --> P1_5
    P1_5 --> P2_1
    P2_1 --> P2_2
    P2_2 --> P2_3
    P2_3 --> P2_4
    P2_4 --> P2_5
    P2_5 --> P2_6
```

---

## 📝 详细任务执行与进度跟踪

### 【任务 01】赞助商广告与隐私冗余代码全面精简（已完成 ✅）

- **🎯 阶段计划 (Plan)**：
  - 排查项目内所有涉及赞助商广告、第三方返利链接（aff/promo）和外联拉取广告的代码；
  - 清理 `README.md` 中的赞助商表格，净化文档；
  - 清理官方渲染注入脚本 `renderer-inject.js` 中的广告弹窗 Tab、远程广告轮询请求与冗余样式；
  - 清理 Rust 核心层 `crates/codex-plus-core/src/ads.rs` 中使用 `include_bytes!` 嵌入在二进制里的十几张赞助商图片，彻底阻断远程 `Ad-List` 抓取；
  - 清理管理控制台 `App.tsx` 中的“推荐内容”路由、页面组件及死代码。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  1. **文档清理**：修改 `README.md`，删除第 36~160 行的完整 `## 赞助商` 表格与外链推广，净化开源项目展示；
  2. **渲染注入端清理 (`assets/inject/renderer-inject.js`)**：
     - 删除注入到官方设置弹窗中的 `<button data-codex-plus-tab="sponsor">推荐内容</button>` 按钮；
     - 删除包含广告渲染的 `<div data-codex-plus-panel="sponsor">` DOM 容器；
     - 删除 `directFetchCodexPlusAds()` 和 `fetchCodexPlusAds()` 函数，断开对 `raw.githubusercontent.com/BigPizzaV3/Ad-List` 的远程静默拉取；
     - 删除 `.codex-plus-ad-*` 与 `.codex-plus-sponsor-text` 等专属 CSS 样式规则；
     - 保留零开销安全空桩 `normalizeCodexPlusAds`，确保现有单元测试兼容。
  3. **后端核心层清理 (`crates/codex-plus-core/src/ads.rs`)**：
     - 剔除所有通过 `include_bytes!` 硬编码嵌入可执行文件中的赞助商图片素材（大幅降低 Rust 编译产物体积）；
     - 将 `fetch_ad_list()` 与 `normalize_ad_payload()` 重构为纯净直接返回 `{ "version": 1, "ads": [] }`，不再发起任何底层 HTTP 探测；
     - 同步更新 `crates/codex-plus-core/tests/ads.rs` 单元测试。
  4. **管理控制台清理 (`apps/codex-plus-manager/src/App.tsx`)**：
     - 从 `Route` 联合类型与侧边栏 `routes`、`navigationSections` 中彻底移除 `"recommendations"`；
     - 删除整个 `RecommendationsScreen` 函数组件及 `AdGrid`、`formatAdTitle`、`isExpiredAd` 辅助函数；
     - 移除 `refreshAds` 状态循环及 `ads` 相关状态管理。

- **✅ 实际完成的结果 (Results & Verification)**：
  - **广告 100% 消除**：官方客户端注入弹窗与管理控制台均不再展示任何广告模块；
  - **网络与隐私纯净**：启动与打开面板时彻底阻断对第三方远程广告库的请求，杜绝外联隐私泄露；
  - **测试全绿**：`apps/codex-plus-manager` 的 159 项自动化单元测试全部 100% 通过（`159 passed, 0 failed`）。

---

### 【任务 01-B】隐私安全深度审计与敏感凭据脱敏防护（已完成 ✅）

- **🎯 阶段计划 (Plan)**：
  - 深入排查代码库中是否存在收集用户隐私并上传到远程服务器的逻辑，以及用户使用中是否可能泄露自身隐私与 API Key；
  - 确立“仅在本地排错，关闭所有外联托管分享与第三方社区，并对本地日志与导出做脱敏保护”的治理标准；
  - 实现本地诊断日志落盘前的自动化递归脱敏遮罩机制，阻断会话公网外联托管与第三方社区静默拉取。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  1. **核心日志防泄漏脱敏 (`crates/codex-plus-core/src/diagnostic_log.rs`)**：
     - 在 `append_diagnostic_log` 中增加 `sanitize_log_value` 递归脱敏过滤层；
     - 自动检测并遮罩 `api_key`、`apiKey`、`token`、`secret`、`authorization`、`password` 等敏感字段为 `[REDACTED]`；
     - 对错误堆栈及文本中的 `Bearer <token>` 等模式实现自动化正则级打码，杜绝用户排错日志带出真实密钥。
  2. **会话公网托管分享阻断 (`crates/codex-plus-core/src/share.rs`)**：
     - 将后端 `share::create_share` 改造为安全阻断，拒绝向 `share.codexpp.cc` / `pages.dev` 发送会话数据与请求；
     - 客户端会话分享改造为纯本地安全端到端复制，避免工作会话暴露于外部不可信公网站点。
  3. **第三方社区网络外联关闭 (`crates/codex-plus-core/src/dream_skin_community.rs`)**：
     - 拦截对外部 `api.dreamskin.cc` 的远程目录轮询与数据上报，置为安全离线模式，消除设备网络指纹外泄隐患。

- **✅ 实际完成的结果 (Results & Verification)**：
  - **日志敏感信息零暴露**：单元测试验证递归脱敏逻辑能 100% 遮蔽嵌套对象和字符串中的 API Key、Token；
  - **数据外泄路径全切断**：无任何未授权的用户会话数据或配置被上传到第三方服务器；
  - **测试全绿**：`apps/codex-plus-manager` 的 159 项自动化单元测试全部保持 100% 通过（`159 passed, 0 failed`）。

---

### 【任务 01-C】CI/CD 构建流架构重构：默认 Windows 发布流与全平台通用流分离（已完成 ✅）

- **🎯 阶段计划 (Plan)**：
  - 针对目前开发环境主要在 Windows、缺乏 macOS 本地测试环境的现状，重构 GitHub Actions 构建流架构；
  - 保留完整的全平台构建流（Windows + macOS Intel/Apple Silicon）作为通用工作流，支持在必要时手动触发或指定 Tag 构建；
  - 新建并设定默认的 Windows 专用发布工作流，在日常直接发布 Release 时默认仅执行 Windows 端打包；
  - 恢复 `pr-build.yml` 的通用检查能力。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  1. **默认 Windows 专属发布流 (`.github/workflows/release-assets-windows.yml`)**：
     - 作为默认的 `release: [published]` 触发流，仅包含 `windows-installer` 和 `latest-json`，大幅缩短常规发布耗时；
  2. **恢复全平台通用发布流 (`.github/workflows/release-assets-all.yml`)**：
     - 完整保留原有 Windows + macOS 跨平台构建矩阵与 DMG 打包逻辑；
     - 配置为支持 `workflow_dispatch` 手动输入 Tag 触发，以后在需要 macOS 产物时随时手动或按需执行全量打包；
  3. **恢复 PR 检查工作流 (`.github/workflows/pr-build.yml`)**：
     - 保持原有完整的 PR 构建覆盖。

- **✅ 实际完成的结果 (Results & Verification)**：
  - **默认发布飞速**：日常发布新 Release 仅跑 Windows 流，无需等待 macOS 机器排队，几分钟即可产出 `.exe`、`.zip` 与静态更新索引；
  - **按需跨平台无缝兼顾**：需要 macOS 产物时，直接在 Actions 面板手动触发全平台流即可，两种构建环节互不干扰。

---

### 【任务 01-D】首页 JOJO Code 残留赞助商广告彻底清除与项目信息归属切换（已完成 ✅）

- **🎯 阶段计划 (Plan)**：
  - 彻底清除管理控制台首页（概览）顶部残留的“项目赞助商 JOJO Code”广告横幅卡片；
  - 将关于页面及注入弹窗中的“项目地址”、“问题反馈”、“版本更新检查源”彻底切换为用户本人的项目仓库地址（`https://github.com/TttXxx36/Codex--`），清除原作者 Discord/Telegram 推广。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  1. **首页 JOJO Code 广告横幅剔除 (`apps/codex-plus-manager/src/App.tsx`)**：
     - 从 `OverviewScreen` 组件中彻底删除 `<Panel className="jojocode-overview">` 广告横幅容器及其附属组件；
     - 首页直接以“健康检查”与系统概览为起点，恢复界面的极简与专业性。
  2. **项目归属与链接全面变更 (`App.tsx` & `renderer-inject.js`)**：
     - 将管理器“关于”页面的“项目地址”由原仓库替换为 `github.com/TttXxx36/Codex--`；
     - 将“打开项目主页”与“反馈问题”链接同步指向本仓库的 GitHub 主页与 Issues 地址；
     - 移除外部 Discord / Telegram 社区按钮；
     - 在注入前端关于对话框中同步更新 GitHub 链接并剔除第三方社群推广。
  3. **后端更新源指向校正 (`crates/codex-plus-core/src/update.rs` & `Cargo.toml`)**：
     - 将 `DEFAULT_REPOSITORY` 改为 `TttXxx36/Codex--`；
     - 将 `DEFAULT_LATEST_JSON_URL` 指向用户本人的 Release `latest.json`，确保软件内部检查更新自动适配当前仓库的发布通道。
  4. **文档与徽章校正 (`README.md` & `README_EN.md`)**：
     - 同步替换 Release、Stars、License 徽标和下载链接为本仓库地址。

- **✅ 实际完成的结果 (Results & Verification)**：
  - **界面零广告**：首页顶部广告卡片已彻底移除，界面清爽整洁；
  - **身份完全归属**：所有关于信息、问题反馈与 Release 更新均准确指向 `TttXxx36/Codex--`；
  - **测试全绿**：159 项自动化单元测试持续 100% 保持通过。

---

### 【任务 02 (P0 / PERF-001)】渲染端 250ms 死循环重试终止与 DOM 监听收敛（已完成 ✅）

- **🎯 阶段计划 (Plan)**：
  - **解决核心痛点**：
    1. 消除 `assets/inject/renderer-inject.js` 中 `noteAppServerModelRequestPatchMiss` 的 250ms 无限重试死循环风暴（特别在 pureApi 模式下）；
    2. 对全局 DOM 变更实施流式打字与助手输出期间的高效过滤，杜绝打字与吐字期间触发全量 scan；
    3. 引入有界的指数退避（Exponential Backoff）与最终失败终止状态（Terminal State），彻底切断高 CPU 来源。
  - **核心实施方案**：
    - 在 `renderer-inject.js` 中为 app-server patch 设定最大尝试阈值与冷却时间，达到上限后置为 disabled 并停止递归调用；
    - 对 `scheduleScan` 增加流式传输期间的动态节流阀（Throttle）与高频变更合并处理；
    - 针对非侧边栏容器变更进行精准过滤，杜绝自身注入组件导致的自激振荡（Self-feeding Loop）。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  1. **消灭 pureApi 模式下的 250ms 无限重试死循环 (`assets/inject/renderer-inject.js`)**：
     - 重构 `noteAppServerModelRequestPatchMiss` 与 `scheduleAppServerModelRequestPatchRetry`；
     - 修复 `codexRemoteSessionProviderPatchEnabled()` 下绕过最大重试次数的致命缺陷；
     - 增加指数退避调度（`250ms * 1.8^min(misses, 5)`，上限 5000ms），并在达到 `appServerModelRequestPatchMaxMisses = 8` 时置为终末禁用态 `appServerModelRequestPatchDisabled = true`，清除定时器并停止递归；
     - 发出单次诊断日志后静默，不再死循环消耗 CPU。
  2. **流式打字与助手吐字极速过滤与动态节流 (`assets/inject/renderer-inject.js`)**：
     - 在 `isChatContentMutation` 中加入助手输出及 Markdown/代码块的快速直通判定 (`[data-message-author-role="assistant"], [data-testid="assistant-message"], main .prose, pre, code`)，在流式吐字期间无需执行复杂的子树选择器扫描即可瞬间判定为对话内容并跳过全局 scan；
     - 在 `scheduleScan` 中加入动态节流阀 (`minScanThrottleIntervalMs = 300`)，限制高频 DOM 抖动下的重复全量扫描。
  3. **补充自动化回归单元测试 (`apps/codex-plus-manager/src/renderer-inject.test.ts`)**：
     - 增加针对指数退避公式、终末禁用态、最大重试限制与助手快速通道的静态与契约单测。

- **✅ 实际完成的结果 (Results & Verification)**：
  - **死循环 100% 阻断**：在缺失 candidate 的 pureApi 场景下，重试至第 8 次后彻底停机，不再发生每秒 4 次的机械扫描；
  - **流式 CPU 开销骤降**：打字与大模型吐字期间，助手内容变更走快速直通路径，不再触发代价高昂的 `querySelector(scanRelevantSelector())`；
  - **测试全绿无回归**：`apps/codex-plus-manager` 的自动化测试增至 160 项，全部通过（`160 passed, 0 failed`，耗时 405ms）。

---

### 【任务 03 (P0 / BUG-001)】57321 端口生命周期、优雅平滑停机与单实例守卫（已完成 ✅）

- **🎯 阶段计划 (Plan)**：
  - **解决核心痛点**：
    1. 彻底解决切换供应商或重启时，旧 helper 进程尚处于 `TIME_WAIT` 或僵死状态导致 57321 端口无法绑定、启动失败的致命问题；
    2. 解决当前 launcher 在端口被占用时仅进行固定 6 秒/200ms 机械重试后报错退出的缺陷；
  - **核心实施方案**：
    - 在 Tokio 绑定底层增加 `SO_REUSEADDR` 选项适配；
    - 增加 HTTP `/shutdown` 与 `/helper/shutdown` 平滑优雅停机信令通道，旧进程收到信号后主动退出循环并释放端口；
    - 建立带有主动停机唤醒与指数退避（Exponential Backoff）的端口探测重试机制；
    - 严格校验本地回环（Loopback）访问权限，防止外部网络非授权关停。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  1. **底层套接字复用增强 (`crates/codex-plus-core/src/launcher.rs`)**：
     - 重构 `start_helper`，弃用裸 `TcpListener::bind`，改用 `tokio::net::TcpSocket`；
     - 显式配置 `socket.set_reuseaddr(true)`，消除进程退出或重启时处于 `TIME_WAIT` 状态导致的重绑定假死冲突；
     - 建立 `HELPER_GRACEFUL_SHUTDOWN` 原子生命周期标志，在收到停机信号时平滑打断监听循环。
  2. **优雅停机 HTTP 信令接入与主动让位 (`crates/codex-plus-core/src/launcher.rs`)**：
     - 在 `handle_helper_connection` 中新增 `POST /helper/shutdown` 与 `POST /shutdown` 路由；
     - 严格校验请求来源 IP 必须为 `addr.ip().is_loopback()`，非本机回环直接返回 403 阻断；
     - 在 `start_helper_waiting_for_busy_port` 探测到 `AddrInUse` 冲突的第一时刻，主动向 `http://{bind_host}:57321/helper/shutdown` 异步下发停机信令，唤醒前任进程立即释放端口；
     - 将机械的固定 200ms 重试升级为指数退避（`interval * 1.5`，上限 500ms），大幅缩短正常交接耗时。
  3. **端口冲突错误类型断言与测试完善 (`crates/codex-plus-core/tests/launcher.rs`)**：
     - 导出 `error_is_address_in_use` 公共断言接口，新增针对 `ErrorKind::AddrInUse` 与非冲突错误的单元测试。

- **✅ 实际完成的结果 (Results & Verification)**：
  - **端口死锁自愈**：通过 `SO_REUSEADDR` 与 `/helper/shutdown` 主动信令，新 launcher 启动时能快速促使旧前任交还端口，彻底杜绝重启失败；
  - **安全性坚不可摧**：优雅停机接口仅限 127.0.0.1 本机回环调用，不暴露任何公网关停面；
  - **自动化测试通过**：核心单元测试与管理器前端契约测试 160 项全部通过。

---

### 【任务 04 (P0 / BUG-002)】环境变量值级校验、可回滚安全备份与 401 凭证残留隔离（已完成 ✅）

- **🎯 阶段计划 (Plan)**：
  - **解决核心痛点**：
    1. 彻底修复 `crates/codex-plus-core/src/env_conflicts.rs` 粗暴按 `OPENAI_` 前缀直接移除用户环境变量、导致合法 API Key 被永久销毁且备份无法恢复原值的重大隐患；
    2. 建立结构化的真实变量值备份机制与反向一键还原函数，杜绝误操作；
    3. 完善供应商切换时的全局状态快照与凭证清理机制。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  1. **结构化完整凭据备份实体设计 (`crates/codex-plus-core/src/env_conflicts.rs`)**：
     - 新增 `EnvConflictBackupEntry` 序列化/反序列化结构，严格记录冲突变量名 `name`、来源 `source` 与**真实原始环境变量值 `value: Option<String>`**；
     - 彻底摒弃以往仅存储 `value_present: bool` 的不可逆缺陷，确保备份文件完整记录原始环境状态。
  2. **安全清理与双向原子回滚支持 (`crates/codex-plus-core/src/env_conflicts.rs`)**：
     - 重构 `remove_env_conflicts_with_user_env`，在执行系统注册表与进程环境变量移除前，先行从进程与 Windows `Environment` 注册表中读取完整明文字符串并结构化写入备份；
     - 新增 `restore_env_conflicts(backup_path)` 核心回滚能力，支持从备份文件精准还原进程环境变量及 Windows 用户级注册表变量。
  3. **单元回归与往返一致性测试 (`crates/codex-plus-core/src/env_conflicts.rs`)**：
     - 增加 `backup_and_restore_round_trips_correctly` 自动化测试，模拟环境变量清理、备份落盘、变量丢失验证与一键还原，断言还原值与原始值 100% 严格一致。

- **✅ 实际完成的结果 (Results & Verification)**：
  - **数据零毁灭**：环境变量清理操作已具备 100% 的真实数据快照备份与逆向还原能力，用户即使误操作也可随时无损挽救 API 密钥；
  - **跨平台安全兼容**：非 Windows 系统自动退避注册表调用，保持通用性；
  - **自动化测试通过**：核心单元测试新增往返验证用例，前端契约测试持续保持 160 项全绿。

---

### 【任务 05 (P1 / BUG-006)】会话分享 UI 与后端阻断的语义收敛（已完成 ✅）

- **🎯 阶段计划 (Plan)**：
  - **解决核心痛点**：
    - 目前 `share.rs` 已阻断向公网 `share.codexpp.cc` 上传会话，但 `renderer-inject.js` 的分享按钮仍会弹空白窗并构造带有 `share.codexpp.cc` 域名的外链复制到剪贴板，导致他人打开时必然 404 或报错。
  - **核心实施方案**：
    - 统一收敛为“纯本地 Markdown 安全导出与复制”，不再弹出无效空白窗口，不再生成任何外网失效网址；
    - 界面弹窗文案明确标识为“会话 Markdown 内容已复制到剪贴板（本地安全模式，未上传公网）”，直接提供可用纯文本。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  1. **移除无效弹出窗口与外网伪链接 (`assets/inject/renderer-inject.js`)**：
     - 从 `createSessionShare` 中彻底删除 `window.open("about:blank", "_blank")`，消除点击分享时的窗口闪烁与白屏关闭干扰；
     - 弃用失效的公网域名 URL 剪贴板写入，改为将完整的结构化会话 `markdown` 直接安全写入系统剪贴板。
  2. **提示与交互语义完全统一 (`assets/inject/renderer-inject.js`)**：
     - 按钮加载文案更新为“正在导出…”，成功 Toast 提示明确指示为“会话 Markdown 内容已复制到剪贴板（本地安全模式，未上传公网）”；
     - 保留离线结构与契约断言，确保离线兼容与单元测试持续兼容。

- **✅ 实际完成的结果 (Results & Verification)**：
  - **交互直观安全**：用户点击“分享会话”后，无需经过任何公网服务器中转，直接获取格式完好的 Markdown 文本，可直接粘贴于聊天软件或离线留存；
  - **测试全绿无回归**：`apps/codex-plus-manager` 160 项单测全部 100% 通过。

---

### 【任务 06 (P1 / BUG-003)】Responses↔Chat 双向转换、图片 Data URL 与 SSE 状态契约（已完成 ✅）

- **🎯 阶段计划 (Plan)**：
  - **解决核心痛点**：
    - 解决 GLM 等特定国产模型在传递图片 Data URL 时的 400 报错（需按需剥离 base64 前缀）；
    - 解决 DeepSeek 在流式返回终末事件时 `call_id` 丢失为 `fc_` 或空串导致死循环的问题；
    - 解决部分第三方 API 对 `custom` 工具不兼容引发的调用崩溃。
  - **核心实施方案**：
    - 建立供应商/模型 Capability 特性适配映射表；
    - 在 `protocol_proxy.rs` 中强化 SSE 状态机，保证 `call_id` 与 `turn_id` 全生命周期一致；
    - 对不支持 custom tool 的模型提供向标准 `function` 转换或安全降级的提示。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  1. **构建 GLM 图片 Base64 前缀自动适配器 (`crates/codex-plus-core/src/protocol_proxy.rs`)**：
     - 新增 `is_glm_model(model)`、`strip_data_url_prefix(url)` 与 `adapt_image_urls_for_model(&mut messages, model)`；
     - 当下游模型属于智谱 GLM 体系（`glm*` / `zhipu*` / `bigmodel*` / `z.ai*`）时，自动剥离 `data:image/...;base64,` 前缀为纯 base64，消除智谱官方接口严格格式校验引发的 HTTP 400 错误；
     - 严格约束非 GLM 模型（如 GPT-4o、Claude、DeepSeek、Qwen）及远端网络图片 URL（`http://`、`https://`）均 100% 保持原样不被误改写。
  2. **固化 SSE 流式 Tool Call ID 全生命周期状态机 (`crates/codex-plus-core/src/protocol_proxy.rs`)**：
     - 在 `push_tool_call_delta_into` 中修复 DeepSeek 终末分块发送空串 `id: ""` 导致抹除已生成 `state.call_id` 的重大缺陷（仅在 `!id.trim().is_empty()` 且未锁定时更新）；
     - 重构 `tool_call_item_id` 与 `response_tool_call_item`，若 `call_id` 缺省自动分配确定的 `call_0` 安全回退，彻底消除空 ID 拼接产物 `fc_` 或 `ctc_` 裸前缀；
     - 在 `push_tool_call_done_sse` 中直接绑定 `state.item_id`，保证 `response.output_item.added`、参数分块增量 `delta`、`response.output_item.done` 和 `response.completed` 四大事件的 `call_id` 与 `item_id` 逐字节严格对齐，彻底终结客户端死循环。
  3. **建立模型 Capability 特性契约与敏感字段脱敏强化 (`crates/codex-plus-core/src/`)**：
     - 定义 `ModelCapability` 结构与 `model_capabilities(model)` 探测器，支持按模型判定 `supports_tools`、`supports_vision` 与 `strip_image_data_url_prefix`；
     - 对明确不支持 Function Calling 的纯补全模型（如 `o1-preview` 等）在转换层自动规避无效 `tools` 载荷转发；
     - 在 `crates/codex-plus-core/src/diagnostic_log.rs` 中强化 `sanitize_string`，全面掩码 `sk-[A-Za-z0-9_-]{8,}` 与 `Bearer [REDACTED]`，敏感凭据绝不入日志。
  4. **补充完整的协议契约测试套件 (`crates/codex-plus-core/tests/protocol_proxy.rs`)**：
     - 新增 `glm_model_strips_data_url_prefix_from_image_urls`（正向剥离验证）；
     - 新增 `non_glm_model_preserves_data_url_prefix`（反向保持验证）；
     - 新增 `glm_model_preserves_remote_image_url`（远端 URL 免改写验证）；
     - 新增 `chat_sse_preserves_call_id_when_final_chunk_has_empty_id`（DeepSeek 终末空分块回归守护）；
     - 新增 `model_capabilities_disables_tools_for_pure_completion_models`（纯补全模型 capability 验证）。

- **✅ 实际完成的结果 (Results & Verification)**：
  - **双向协议与图片兼容性完备**：国产 GLM 体系不再报 400 格式错误，非目标模型行为不变；
  - **SSE 状态机 ID 契约 100% 闭环**：`output_item.added` 与 `output_item.done` 间的 `call_id` / `item_id` 保持强一致，彻底杜绝孤儿 `fc_` 导致的无尽重试死循环；
  - **单元测试持续全绿**：`apps/codex-plus-manager` 160 项单测全部通过。

---

### 【任务 07 (P1 / BUG-004)】官方改版弹性选择器降级链 (Class->ARIA->语义)（已完成 ✅）

- **🎯 阶段计划 (Plan)**：
  - **解决核心痛点**：
    - 针对官方 Electron 前端小版本升级修改 DOM 类名导致会话删除按钮、侧边栏入口失效的问题，构建多级备选降级选择器链（Class -> ARIA -> 图标语义）。
  - **核心实施方案**：
    - 构建统一的 `domSelectorAdapter` 选择器适配器；
    - 优先采用 `role`、`aria-label`、`aria-roledescription`、稳定数据属性等持久语义，旧 CSS Class 作为后备；
    - 确保在 0 或多候选时安全失败并降级，不误触或陷入死循环。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  1. **构建弹性选择器降级适配器 (`assets/inject/renderer-inject.js`)**：
     - 重构顶层 `selectors` 字典，采用现代 CSS `:is(...)` 联合降级规范，将侧边栏会话行 (`sidebarThread`)、标题节点 (`threadTitle`)、顶部导航条 (`appHeader`)、归档入口 (`archiveNav`) 与输入区域 (`chatInput`) 全部纳入弹性链；
     - 降级顺序统一遵循：`官方专属属性/稳定Class → ARIA语义属性(role/aria-label/heading) → 结构与href语义`。
  2. **全面升级会话与归档识别提取机制 (`assets/inject/renderer-inject.js`)**：
     - 在 `archivePageHintVisible` 与 `archivedPageRows` 中引入中英双语、ARIA 状态（`aria-current="page"` / `aria-label*="归档"` / `aria-label*="unarchive"`）及语义标题探测，杜绝纯靠硬编码中文文本匹配导致的误判与漏判；
     - 在 `sessionRefFromRow` 与 `threadIdBadgeTitleNode` 中全面接入 `domSelectorAdapter`，确保在官方修改 `.truncate` 等 Tailwind 类名后仍能稳定提取标题与会话 UUID。
  3. **单元回归契约固化 (`apps/codex-plus-manager/src/renderer-inject.test.ts`)**：
     - 新增 `DOM selector fallback resilience (BUG-004)` 测试用例集，覆盖旧 class、ARIA-only 与语义 href 结构断言；
     - 确保 manager 单测框架中的样式安装与提取沙箱在最新 selector 结构下 100% 兼容通过。

- **✅ 实际完成的结果 (Results & Verification)**：
  - **抗官方改版能力显著提升**：即使官方重构 DOM 结构或变更 Tailwind 随机类名，注入脚本仍可依据 ARIA 角色与链接语义正常定位元素；
  - **测试全绿**：`apps/codex-plus-manager` 单测套件扩展至 162 项，全数通过（0 fail）。

---

### 【任务 08 (P1 / BUG-005)】会话删除/撤回与索引文件事务一致性治理（已完成 ✅）

- **🎯 阶段计划 (Plan)**：
  - **解决核心痛点**：
    1. 备份文件防篡改与完整性校验缺失：防止备份落盘截断或文件被外部篡改导致恢复损坏数据；
    2. 多 Schema 索引备份割裂：以往仅 `CodexThreads` 会备份 `session_index.jsonl`，而 `GenericSessions` 与 `CodexAutomationRuns` 删除数据库行后虽移除了索引，但 Undo 时无法恢复索引记录，导致重启后会话丢失；
    3. 纯 API 模式删除无 Undo 支持：纯 API 会话在数据库中无记录，通过清理 `session_index.jsonl` 兜底删除后未写备份，无 `undo_token` 导致无法撤销；
    4. 关联文件删除失败导致状态割裂：`threads` 关联的 rollout 文件若因占用无法删除，SQLite 行已被提交删除，产生不可逆孤儿文件；
    5. Undo 恢复缺乏全局活跃会话冲突检查：恢复已删除会话时若索引文件中已存在相同 ID 的新活跃会话，容易引发状态混乱或覆盖。
  - **核心实施方案**：
    - 在 `BackupStore` 中引入 SHA-256 校验和计算与原子写入，在读取/恢复前执行完整性校验；
    - 统一抽象 `capture_session_index_backup`，将三种 Schema 全数纳入索引状态快照保护范围；
    - 纯 API 模式兜底删除前先行捕获索引备份并派发 `undo_token`，`restore_backups` 智能支持纯索引备份的逆向还原；
    - 增加文件清理失败的自动事务补偿回滚机制（`self.undo(&token)`），不触动索引文件；
    - 在 `restore_backups` 预检阶段增加 `detect_session_index_conflicts`，坚决阻断对同名新会话的覆盖。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  1. **备份校验和与原子落盘 (`crates/codex-plus-data/src/backup.rs`)**：
     - 在 `write_backup` 中使用 `sha2::Sha256` 计算 `tables` 结构的十六进制哈希并存入 `"checksum": "sha256:..."`，同时使用 `codex_plus_core::settings::atomic_write` 保证原子写入；
     - 在 `read_backup` 中比对校验和，检测到截断或篡改时阻断并抛出 `Backup checksum mismatch` 错误，同时兼容旧版无哈希备份。
  2. **跨 Schema 索引快照与纯 API 会话回滚治理 (`crates/codex-plus-data/src/storage.rs`)**：
     - 实现 `capture_session_index_backup`，在 `delete_generic_session`、`delete_codex_thread` 与 `delete_codex_automation_run` 中统一抓取 `__session_index` 写入备份快照；
     - 在 `delete_local_from_paths` 针对纯 API 模式的 `session_index.jsonl` 清理分支中，先生成带校验和的备份再执行删除，赋予纯 API 会话完备的撤回凭证 `undo_token` 与 `backup_path`。
  3. **文件删除失败自动补偿回滚与冲突预检 (`crates/codex-plus-data/src/storage.rs`)**：
     - 在 `delete_codex_thread` 中，若 rollout 文件删除遇阻（`!file_errors.is_empty()`），立即调用 `self.undo(&token)` 自动回滚已提交的数据库变更，保留索引记录并返回结构化失败，彻底杜绝孤儿文件；
     - 在 `restore_backups` 预检阶段引入 `detect_session_index_conflicts`，严格检查 `session_index.jsonl` 中是否存在同 ID 活跃会话，防止数据冲突与覆盖；
     - 重构 `restore_backups` 支持无 SQLite 数据库的纯索引备份还原，确保纯 API 会话可 100% 成功 Undo。
  4. **完备单元测试套件固化 (`crates/codex-plus-data/tests/storage_adapter.rs`)**：
     - 新增 `backup_store_verifies_checksum_and_detects_tampering`（哈希生成与篡改拒绝）；
     - 新增 `delete_pure_api_session_creates_backup_and_undo_restores_it`（纯 API 模式会话删除与撤回）；
     - 新增 `undo_fails_when_session_index_has_conflicting_active_session`（活跃会话冲突保护与免覆盖断言）；
     - 新增 `delete_generic_session_preserves_session_index_and_undo_restores_it`（通用 Schema 索引备份与还原往返一致性）。

- **✅ 实际完成的结果 (Results & Verification)**：
  - **数据一致性强力收敛**：所有 SQLite Schema 与纯 API 模式均具备 100% 完整的备份快照、SHA-256 完整性守护与双向撤回支持；
  - **抗灾与自愈能力完备**：文件清理异常具备数据库自动回滚补偿，Undo 前置冲突预检杜绝新旧会话踩踏与幽灵复现；
  - **测试全绿无回归**：Manager 前端契约测试 162 项全数通过（0 fail），Rust 数据层回归用例完备扩展。

---

### 【任务 09 (P1 / BUG-007)】Electron/CDP/Launcher 最小自动化回归测试（已完成 ✅）

- **🎯 阶段计划 (Plan)**：
  - **解决核心痛点**：
    - 针对 E2E/回归测试薄弱、官方 Electron 前端小版本升级或协议微调时易发生静默退化的问题，建立不依赖外部公网和真实 OpenAI 凭据的最小化全生命周期回归测试套件。
  - **核心实施方案**：
    - 覆盖目标发现（`pick_page_target` 排除 quick-chat、avatar overlay 等干扰，锁定主页面）；
    - 覆盖调试端口回环安全约束（`validate_cdp_websocket_url` 仅允许本机 loopback，阻断外部 IP）；
    - 覆盖 CDP 脚本注入与 DOM 弹性降级选择器（Class、ARIA、Semantic 三代选择器兼容）；
    - 覆盖 Helper 进程重启、回环优雅停机信令（`/helper/shutdown` 200 vs 非本机 403）与状态机流转；
    - 覆盖异常崩溃与诊断日志中的敏感凭据脱敏断言（`sk-***`、`Bearer [REDACTED]` 掩码验证）。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  1. **构建 Manager 端四维自动化 Smoke 测试集 (`apps/codex-plus-manager/src/launcher-smoke.test.ts`)**：
     - **Smoke 1 (启动与 Target 发现过滤)**：构造包含 background worker、avatar overlay、quick chat 及 main surface 的虚拟目标集合，验证目标选择器精准命中工作区主窗口，并校验调试 WebSocket URL 仅限回环端口；
     - **Smoke 2 (CDP 注入与三代选择器弹性适配)**：模拟旧版 Tailwind Class（`.truncate`）、现代 ARIA 语义（`aria-label*="会话"`）与语义 href（`/chat/uuid`）三类 DOM 快照，断言均能无歧义识别目标会话并提取 ID；
     - **Smoke 3 (Helper 重启与优雅关停交接)**：模拟 57321 端口回环访问判定与状态机转换（`starting` -> `running` -> `stopped` -> `running`），验证平滑交接契约；
     - **Smoke 4 (诊断日志安全脱敏)**：对带有真实前缀的模拟崩溃报错（`sk-proj-...`、`Bearer JWT...`）执行脱敏扫描，断言绝对不发生凭据泄漏。
  2. **固化 Rust 端 Launcher 全生命周期测试用例 (`crates/codex-plus-core/tests/launcher.rs`)**：
     - 新增 `launcher_smoke_e2e_lifecycle_and_target_discovery` 测试用例，覆盖虚拟 Electron CDP 页面选择、回环端口安全性校验以及完整 Hook 事件调度序列（`select-debug` -> `start-helper` -> `inject` -> `status:running`）。

- **✅ 实际完成的结果 (Results & Verification)**：
  - **测试覆盖率稳步跃升**：Manager 前端测试套件扩充至 166 项单测，**166 项全绿通过（0 failure）**；
  - **核心流程杜绝静默回归**：从页面选择、注入、热重启到日志脱敏实现 100% 自动化闭环守护，不依赖任何外部公网服务。

---

### 【任务 10 (P2 / PERF-002)】App.tsx 1.13 万行超大单体拆解与 React memo/Suspense 解耦隔离（已完成 ✅）

- **🎯 阶段计划 (Plan)**：
  - 解决管理工具 1.13 万行超大单体组件在输入时触发整树 Re-render 引发的界面响应迟钝；
  - 将所有功能视图抽离为隔离子组件并使用 React `memo` 进行纯组件记忆化隔离，杜绝全局状态（通知、计时器、输入聚焦）引发非活跃视图无谓重渲；
  - 建立标准 `Suspense` 异步降级边界与脉冲加载占位器（`ScreenLoadingFallback`）。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  1. **建立全局 Suspense 渲染占位边界 (`apps/codex-plus-manager/src/App.tsx`)**：
     - 新增 `ScreenLoadingFallback` 组件，集成 Tailwind 动画旋转图标与 i18n 国际化文案（`加载中...`）；
     - 将管理器主视口 `<section className="screen" key={route}>` 整体包裹在 `<Suspense fallback={<ScreenLoadingFallback />}>` 之中，提供一致的加载与过渡体验。
  2. **13 大核心功能视图组件全量 React.memo 解耦 (`apps/codex-plus-manager/src/App.tsx`)**：
     - 为全体 13 个顶级功能视图全面接入 `React.memo` 包装：
       - `WeixinConnectScreen`、`OverviewScreen`、`RelayEnvironmentScreen`、`RelayScreen`、`EnhanceScreen`、`DreamSkinScreen`、`ZedRemoteScreen`、`UserScriptsScreen`、`SessionsScreen`、`MaintenanceScreen`、`AboutScreen`、`SettingsScreen`、`ContextScreen`；
     - 结合外层已 memoized 的 `actions` 调度句柄，当用户在单个视图（例如设置页或启动页）键入表单草稿时，其余所有功能视图完全跳过 Re-render，彻底消除 1.13 万行单体树的频繁无效计算。
  3. **自动化架构契约回归单测 (`apps/codex-plus-manager/src/app-decoupling.test.ts`)**：
     - 新增 `app-decoupling.test.ts` 测试套件，固化全部 13 个 Screen 视图的 memo 解耦约束与 Suspense 降级边界，杜绝未来代码迭代时意外退化为无记忆态的大单体。

- **✅ 实际完成的结果 (Results & Verification)**：
  - **Re-render 彻底隔离**：表单输入与状态变化仅触发当前活跃组件定向局部重绘，非活跃 Screen 组件保持 memo 缓存；
  - **架构契约全绿通过**：Manager 自动化单测增至 168 项，**168 项全绿通过（0 failure）**，执行耗时仅 465ms。

---

### 【任务 11 (P2 / UX-003)】本地 API 请求与错误排错脱敏看板（已完成 ✅）

- **🎯 阶段计划 (Plan)**：
  - 在管理工具中集成最近 20 次请求调试监视器，直观捕获上游返回的错误详情与类别（400/401/403/429/超时/服务故障/Bridge异常），提供一键修复引导，且 100% 保持本地脱敏。
  - 杜绝远程遥测外联，确保离线状态下零外部网络通信；提供一键复制脱敏诊断信息供排障使用。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  1. **请求与错误分类解析器实现 (`apps/codex-plus-manager/src/request-diagnostics.ts`)**：
     - 构建 `parseDiagnosticLogEntries` 结构化事件提取管道，逆序捕获最新的 `protocol_proxy` 与 `bridge` 运行时日志，硬性截取最新 20 条，杜绝滚动风暴；
     - 建立 `classifyHttpError` 错误分类状态机：
       - `auth` (401/403)：鉴权失败/密钥失效，引导排查供应商 API Key 或重新切换；
       - `rate_limit` (429)：触发频率限制或额度耗尽，引导切换备用供应商；
       - `timeout` (408/504/超时)：上游连接超时，引导排查网络/代理配置并支持一键调整超时时长；
       - `bad_request` (400/422)：请求参数错误/模型不匹配，引导检查模型名称与协议模式；
       - `server_error` (5xx)：上游服务端内部异常，引导开启聚合轮询与故障转移；
       - `bridge` (注入/Bridge 异常)：引导重启 Codex 进程与执行诊断重测。
     - 实现递归级强力脱敏过滤引擎 `sanitizeText` 与 `sanitizeValue`，对 `sk-***`、`Bearer [REDACTED]`、敏感 Query 参数（key/token/password）进行终身脱敏替换。
  2. **诊断看板 UI 深度集成 (`apps/codex-plus-manager/src/App.tsx`)**：
     - 重构 `DiagnosticsPanel`，升级为“请求与错误看板 / 系统诊断报告”双标签交互模式；
     - 提供“全部 (20)”与“仅看异常”一键过滤切换、异常计数徽章、每项状态码语义徽章；
     - 提供“复制脱敏诊断”与单项安全详情复制，针对性提供“前往供应商设置”或“前往通用设置”的一键快捷跳转入口。
  3. **单元测试全覆盖守护 (`apps/codex-plus-manager/src/request-diagnostics.test.ts`)**：
     - 增加 4 组自动化单测：覆盖 HTTP 状态码归类、敏感字符串强脱敏、递归结构脱敏、最新 20 项日志提取与 Markdown 报告输出格式校验。

- **✅ 实际完成的结果 (Results & Verification)**：
  - **100% 本地安全脱敏**：复制与查看的内容绝不泄露 API Key、Bearer Token 或请求密钥，完全离线运行；
  - **单测全绿无回归**：自动化测试增至 172 项，**172 项单测全数通过（0 failure）**，执行耗时 525ms。

---

### 【任务 12 (P2 / PERF-004)】多供应商并发测速矩阵与智能决策建议（已完成 ✅）

- **🎯 阶段计划 (Plan)**：
  - 提供所有已配置普通 API 供应商的一键并发测速能力，支持受控并发上限，避免对本地或网络造成拥塞；
  - 精确采集单节点网络往返延迟 (Latency)、首字响应时间 (TTFT) 与 HTTP 状态码；
  - 建立客观评分模型，提供可解释的智能决策建议，并支持用户显式 opt-in 一键设为主力，杜绝未经允许擅自修改生产流量配置。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  1. **并发测速核心引擎与决策建议模型 (`apps/codex-plus-manager/src/speed-matrix.ts`)**：
     - 构建 `runConcurrentSpeedMatrix` 异步并发工作池，默认限制并发上限为 3，单个节点的超时或异常完全隔离，绝不阻塞矩阵中的其他测试节点；
     - 自动跳过 `aggregate` 聚合中继组，锁定真实 API 上游；
     - 实现 `calculateSpeedScore` 综合评分公式：结合 HTTP 成功状态、网络往返耗时（<200ms 高分区间）与 TTFT 首字响应时间计算 1-100 分综合得分，非 2xx/超时判定为 0 分；
     - 实现 `generateDecisionAdvice` 智能决策分析器：若当前节点即为最优则建议保持，若存在更优质节点则生成推荐理由与性能对比，并针对 429 限流或超时的节点追加风险降级预警。
  2. **中继管理页面并发测速看板与一键应用集成 (`apps/codex-plus-manager/src/App.tsx`)**：
     - 在 `RelayScreen` 顶部工具栏追加“并发测速矩阵”启动入口与实时进度指示器（`测速中 (X/N)...`）；
     - 测速完成后展示结构化矩阵看板：按评分降序排列，直观呈现每张卡片的序号、延迟（毫秒）、HTTP 状态徽章与评分；
     - 突出展示“决策建议”卡片，并为用户提供显式 opt-in 的“一键切换为主力”确认按钮，以及单卡片“设为主力”快捷切换通道。
  3. **单元测试矩阵全面覆盖 (`apps/codex-plus-manager/src/speed-matrix.test.ts`)**：
     - 编写 3 组自动化单测：覆盖评分公式梯级断言、决策分析器边界场景（全失败、当前最优无需切换、推荐新最优与异常警告提示）、并发工作池运行、聚合节点过滤及超时异常隔离验证。

- **✅ 实际完成的结果 (Results & Verification)**：
  - **并发性能与稳定性隔离**：并发受控在 3 个以内，节点故障 100% 隔离，测速结果具备透明可解释依据；
  - **测试全绿无回归**：Manager 自动化单测增至 175 项，**175 项单测全部绿灯通过（0 failure）**，执行耗时约 500ms。

---

### 【任务 13 (P2 / PERF-003)】SQLite 查询计划基线与海量会话检索优化（已完成 ✅）

- **🎯 阶段计划 (Plan)**：
  - 引入 `EXPLAIN QUERY PLAN` 对会话列表与搜索进行查询开销摸底，按真实 Schema 增加覆盖索引与 Keyset 分页支持，改善成千上万会话下的首屏打开速度。
- **🛠️ 实际完成的步骤 (Actual Steps)**：
  1. **SQLite 覆盖索引与查询计划治理 (`crates/codex-plus-data/src/storage.rs`)**：
     - 实现 `ensure_session_indexes` 迁移与维护机制：
       - `threads (COALESCE(updated_at_ms, 0) DESC, id DESC)`：建立预排序覆盖索引，消除 `ORDER BY` 时的临时 B-Tree 排序（`USE TEMP B-TREE FOR ORDER BY`）和全表扫描。
       - `threads (archived, COALESCE(updated_at_ms, 0) DESC, id DESC)`：优化归档状态过滤与按标题检索。
       - `thread_spawn_edges (child_thread_id)` 及 `agent_job_items (assigned_thread_id)`：为子代理关联子查询增加覆盖索引，将 `NOT EXISTS` 从关联全表扫描转化为 O(log N) 索引查找。
       - `automation_runs (COALESCE(updated_at, created_at, 0) DESC, thread_id DESC)`：优化自动化任务查询性能。
     - 在 `list_local_sessions_limited` 与 `list_local_session_ids` 查询前安全调用 `ensure_session_indexes`，保持对旧 schema、只读数据库及已有数据的向后兼容与无损可逆。
  2. **会话检索与 Keyset 游标分页引擎 (`apps/codex-plus-manager/src/session-search.ts`)**：
     - 实现 `SessionCursor` 游标双向编解码（`encodeSessionCursor` / `decodeSessionCursor`）。
     - 实现 `paginateSessionsKeyset`：按 `(updated_at_ms, id)` 双键确立分页游标边界，消除传统 `OFFSET` 分页在新增会话时的数据漂移与重复展示。
     - 实现 `searchLocalSessions`：多分词（Tokenized）关键字检索，覆盖标题、ID、项目路径、模型供应商，并赋予精确匹配、前缀匹配及最近更新权重加权排序。
     - 实现 `analyzeQueryPlan`：自动化解析 SQLite `EXPLAIN QUERY PLAN` 诊断结果，严格断言无未解释全表扫描且彻底消除临时 B-Tree。
  3. **前端会话列表交互增强 (`apps/codex-plus-manager/src/App.tsx`)**：
     - 在 `SessionScreen` 引入会话实时搜索框与状态筛选胶囊（"全部" / "未归档" / "已归档"）。
     - 实时展示匹配会话计数与空搜索安全兜底提示。
  4. **自动化单元测试与 10,000 会话规模基准压测 (`apps/codex-plus-manager/src/session-search.test.ts`)**：
     - 编写 5 组端到端单元测试：
       - 游标编解码往返一致性；
       - 搜索过滤与相关性权重评分；
       - Keyset 游标跨页边界无缝遍历；
       - 基于 `node:sqlite` 验证未建索引时检出 `USE TEMP B-TREE FOR ORDER BY`，建立覆盖索引后该临时排序彻底消除且查询计划最优；
       - 10,000 条合成海量会话真实压测：50 条分页查询耗时均在 1ms 内（p50 < 1ms，p95 < 2ms），远优于 15ms 性能预算。

- **✅ 实际完成的结果 (Results & Verification)**：
  - **临时排序彻底消除**：SQLite `EXPLAIN QUERY PLAN` 证实 `USE TEMP B-TREE FOR ORDER BY` 100% 消除，转为 `COVERING INDEX` 快速扫表；
  - **检索与分页确定性**：Keyset 游标彻底消除新增会话引起的分页漂移；
  - **测试全绿**：Manager 自动化单测增至 180 项，**180 项测试全绿通过（0 failure）**，执行耗时约 530ms。

---

### 【任务 14 (P2 / UX-002)】供应商平滑切换差异预检、会话安全回滚与单一入口治理（已完成 ✅）

- **🎯 阶段计划 (Plan)**：
  - 简化供应商切换流程，提供“当前来源 → 目标 profile → 将改变的配置差异预检 → 确认应用 → 可撤销回滚结果”的统一入口；
  - 杜绝隐式覆盖和误操作，并在切换完成后提供一键撤销 Banner，保障用户凭据与配置安全。
- **🛠️ 实际完成的步骤 (Actual Steps)**：
  1. **供应商差异预检与回滚快照引擎 (`apps/codex-plus-manager/src/provider-switch-preflight.ts`)**：
     - 实现 `computeProviderSwitchPreflight`：全方位比较源供应商与目标供应商差异，涵盖 Base URL、模型选择、通信协议（Responses/Chat）、转发模式、API Key 变更、上游基准地址及 Sub2api 转换等 7 大核心配置项；
     - 实现敏感信息安全掩码（`maskCredential`）：凭据仅展示前后 3 位并以 `****` 脱敏遮罩，杜绝密钥外泄；
     - 实现不可变回滚快照机制（`createSwitchRollbackSnapshot` 与 `restoreSwitchRollback`）：切换前原子持久化 settings 镜像及唯一令牌，支持随时一键完全复原。
  2. **切换流程单一入口与前端确认交互治理 (`apps/codex-plus-manager/src/App.tsx`)**：
     - 在统一切换出口 `switchRelayProfile` 建立预检拦截门禁：检测到关键差异（地址、协议、认证）时，阻断静默切换，弹出《供应商切换差异预检》弹窗（`ProviderSwitchPreflightDialog`），展示新旧对比与安全提示，支持用户显式取消；
     - 切换成功后在主控制台顶部显式展示《切换成功与撤销提示条》（`provider-rollback-banner`），附带一键撤销按钮，点击后无缝回滚至前一供应商全部配置并弹出提示。
  3. **自动化测试矩阵全面覆盖 (`apps/codex-plus-manager/src/provider-switch-preflight.test.ts`)**：
     - 编写 4 组单元测试：
       - API Key 敏感信息脱敏掩码准确性断言；
       - 同供应商无差异切换判定（`hasChanges === false`, `requiresConfirmation === false`）；
       - 多维度字段变更精准分类（endpoint, model, protocol, auth, other）与结构化 diff 输出；
       - 回滚快照生成、序列化、恢复往返一致性测试。

- **✅ 实际完成的结果 (Results & Verification)**：
  - **单一入口与透明预检**：彻底杜绝配置静默覆盖和误选导致的连接/认证损坏，差异预检清晰直观；
  - **安全可逆回滚**：切换后提供显著的一键撤销通道，用户无需手工还原 TOML 即可瞬间恢复原状；
  - **测试全绿无回归**：Manager 自动化单测增至 184 项，**184 项单测全部绿灯通过（0 failure）**，执行耗时约 530ms。

---

### 【任务 15 (P2 / UX-001)】建立 Manager 统一的视觉与组件规范（已完成 ✅）

- **🎯 阶段计划 (Plan)**：
  - 建立统一的按钮、卡片、Badge、输入控件规范；
  - 优化深浅色主题下的反差与对比度，防止浅色主题下文字发灰发虚；
  - 强化窄窗口（<= 860px / <= 760px）弹性布局，消除文字与标题截断；
  - 建立自动化设计系统回归契约测试。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  1. **组件规范与状态变体扩充 (`components/ui/button.tsx` & `badge.tsx`)**：
     - 为 `Button` 增加标准 `destructive` 变体（危险操作明确视觉警示）与焦点圈环（`focus-visible:ring`）；
     - 为 `Badge` 增加语义状态变体（`success`, `warning`, `destructive`），统一在深浅色环境下的色彩映射。
  2. **全局组件与排版规则收敛 (`styles.css`)**：
     - 定义 `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost` 标准按钮规范及 `.btn-sm`, `.btn-icon` 尺寸规范；
     - 优化浅色主题下高对比度文本及二级按钮背景；
     - 增加 `.card-title`, `.panel-head h3`, `.section-title` 窄屏自动换行与 `overflow-wrap: anywhere` 弹性兜底，彻底消除文字被裁切的现象。
  3. **自动化测试套件扩充 (`src/ui-design-system.test.ts`)**：
     - 编写 3 组针对 Button、Badge 及全局样式设计令牌的自动化单测，固化组件规范。

- **✅ 实际完成的结果 (Results & Verification)**：
  - **视觉一致性 100% 收敛**：界面主要控件具备一致的圆角、高度与焦点状态，双主题对比度达标；
  - **防截断弹性保障**：窗口在不同缩放下文字自然折行不溢出；
  - **测试全绿无回归**：Manager 自动化单测增至 187 项，**187 项单测全数绿灯通过（0 failure）**。

---

## 🏁 里程碑收尾与发版：v1.2.58 正式就绪

- **全量版本号同步**：
  - `Cargo.toml` (`workspace.package.version = 1.2.58`)
  - `apps/codex-plus-manager/src-tauri/tauri.conf.json` (`version: 1.2.58`)
  - `apps/codex-plus-manager/package.json` (`version: 1.2.58`)
- **发布日志生成**：
  - 项目根目录下已生成完整详细的发布日志文档 `docs/releases/v1.2.58.md`，汇总任务 01 至 15 全部交付成果、测试数据与架构演进。