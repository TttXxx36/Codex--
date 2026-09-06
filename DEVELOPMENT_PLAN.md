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
        P0_3["⚡ 任务 04 (BUG-002): 环境变量值级校验、可回滚安全备份与 401 凭证残留隔离"]
    end

    subgraph P1 阶段：协议兼容与注入韧性
        P1_1["🛡️ 任务 05 (BUG-006): 会话分享 UI/后端语义收敛为纯本地安全导出"]
        P1_2["🛡️ 任务 06 (BUG-003): Responses↔Chat 双向转换、图片 Data URL 与 SSE 状态契约"]
        P1_3["🛡️ 任务 07 (BUG-004): 官方改版弹性选择器降级链 (Class->ARIA->语义)"]
        P1_4["🛡️ 任务 08 (BUG-005): 会话删除/撤回与索引文件事务一致性治理"]
        P1_5["🛡️ 任务 09 (BUG-007): Electron/CDP/Launcher 最小自动化回归测试"]
    end

    subgraph P2 阶段：架构解耦与深度体验
        P2_1["🎨 任务 10 (PERF-002): App.tsx 1.13 万行超大单体拆解与 React.lazy 按需加载"]
        P2_2["📊 任务 11 (UX-003): 本地 API 请求与错误诊断脱敏看板"]
        P2_3["🚀 任务 12 (PERF-004): 多供应商并发测速矩阵与智能决策建议"]
        P2_4["💾 任务 13 (PERF-003): SQLite 查询计划基线与海量会话检索优化"]
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

### 【任务 04 (P0 / BUG-002)】环境变量值级校验、可回滚安全备份与 401 凭证残留隔离（待推进 ⏳）

- **🎯 阶段计划 (Plan)**：
  - **解决核心痛点**：
    1. 彻底修复 `crates/codex-plus-core/src/env_conflicts.rs` 粗暴按 `OPENAI_` 前缀直接移除用户环境变量、导致合法 API Key 被永久销毁的重大隐患；
    2. 解决备份只存布尔标记而无法恢复原值的致命缺陷；
    3. 解决从官方混入模式切换到纯 API 模式时，内存中残留旧 Bearer Token 导致请求误报 401 的问题。
  - **核心实施方案**：
    - 改造环境冲突检测，对比当前环境值与 active profile 的目标配置，相同值不报警、不破坏；
    - 在执行环境变更前，将原环境变量名与**真实原始值**以本地受保护方式落盘保存，提供一键安全回滚能力；
    - 切换供应商时执行 Cookie、Session Storage 与内存 Bearer 的原子级清空与重置。
- **🛠️ 实际完成的步骤 (Actual Steps)**：*（等待实施）*
- **✅ 实际完成的结果 (Results & Verification)**：*（等待验证）*

---

### 【任务 05 (P1 / BUG-006)】会话分享 UI 与后端阻断的语义收敛（待推进 ⏳）

- **🎯 阶段计划 (Plan)**：
  - **解决核心痛点**：
    - 目前 `share.rs` 已阻断向公网 `share.codexpp.cc` 上传会话，但 `renderer-inject.js` 的分享按钮仍会构造带有 `share.codexpp.cc` 域名的外链并复制到剪贴板，导致他人打开时必然 404 或报错。
  - **核心实施方案**：
    - 统一收敛为“纯本地 Markdown / JSON 安全导出”，不再生成任何外网失效网址；
    - 界面弹窗文案明确标识为“会话本地导出成功（未连接外部网络）”，提供直接复制 Markdown 或保存文件的清晰交互。
- **🛠️ 实际完成的步骤 (Actual Steps)**：*（等待实施）*
- **✅ 实际完成的结果 (Results & Verification)**：*（等待验证）*

---

### 【任务 06 (P1 / BUG-003)】Responses↔Chat 双向转换、图片 Data URL 与 SSE 状态契约（待推进 ⏳）

- **🎯 阶段计划 (Plan)**：
  - **解决核心痛点**：
    - 解决 GLM 等特定国产模型在传递图片 Data URL 时的 400 报错（需按需剥离 base64 前缀）；
    - 解决 DeepSeek 在流式返回终末事件时 `call_id` 丢失为 `fc_` 或空串导致死循环的问题；
    - 解决部分第三方 API 对 `custom` 工具不兼容引发的调用崩溃。
  - **核心实施方案**：
    - 建立供应商/模型 Capability 特性适配映射表；
    - 在 `protocol_proxy.rs` 中强化 SSE 状态机，保证 `call_id` 与 `turn_id` 全生命周期一致；
    - 对不支持 custom tool 的模型提供向标准 `function` 转换或安全降级的提示。
- **🛠️ 实际完成的步骤 (Actual Steps)**：*（等待实施）*
- **✅ 实际完成的结果 (Results & Verification)**：*（等待验证）*

---

### 【任务 07 (P1 / BUG-004)】官方改版弹性选择器降级链 (Class->ARIA->语义)（待推进 ⏳）

- **🎯 阶段计划 (Plan)**：
  - 针对官方 Electron 前端小版本升级修改 DOM 类名导致会话删除按钮、侧边栏入口失效的问题，构建多级备选降级选择器链（Class -> ARIA -> 图标语义）。
- **🛠️ 实际完成的步骤 (Actual Steps)**：*（等待实施）*
- **✅ 实际完成的结果 (Results & Verification)**：*（等待验证）*

---

### 【任务 08 (P1 / BUG-005)】会话删除/撤回与索引文件事务一致性治理（待推进 ⏳）

- **🎯 阶段计划 (Plan)**：
  - 保证在多版本 SQLite Schema、rollout 本地文件及 `session_index.jsonl` 之间执行删除与 Undo 时的数据完整性，杜绝孤儿会话与重启复现。
- **🛠️ 实际完成的步骤 (Actual Steps)**：*（等待实施）*
- **✅ 实际完成的结果 (Results & Verification)**：*（等待验证）*

---

### 【任务 09 (P1 / BUG-007)】Electron/CDP/Launcher 最小自动化回归测试（待推进 ⏳）

- **🎯 阶段计划 (Plan)**：
  - 建立最小化的 CDP 与 Launcher Smoke 测试用例，覆盖启动、注入、优雅退出和状态机重置，确保核心注入流程在版本升级时不发生静默回归。
- **🛠️ 实际完成的步骤 (Actual Steps)**：*（等待实施）*
- **✅ 实际完成的结果 (Results & Verification)**：*（等待验证）*

---

### 【任务 10 (P2 / PERF-002)】App.tsx 1.13 万行超大单体拆解与 React.lazy 按需加载（待推进 ⏳）

- **🎯 阶段计划 (Plan)**：
  - 解决管理工具 1.13 万行超大单体组件在输入时触发整树 Re-render 引发的界面响应迟钝；
  - 将 16 个功能视图抽离为独立子组件并使用 React 原生 `lazy` / `Suspense` 按需加载；
  - 表单输入实施草稿状态与持久化状态解耦，增加局部防抖更新。
- **🛠️ 实际完成的步骤 (Actual Steps)**：*（等待实施）*
- **✅ 实际完成的结果 (Results & Verification)**：*（等待验证）*

---

### 【任务 11 (P2 / UX-003)】本地 API 请求与错误排错脱敏看板（待推进 ⏳）

- **🎯 阶段计划 (Plan)**：
  - 在管理工具中集成最近 20 次请求调试监视器，直观捕获上游返回的错误详情与类别（400/401/超时/模型降级），提供一键修复引导，且 100% 保持本地脱敏。
- **🛠️ 实际完成的步骤 (Actual Steps)**：*（等待实施）*
- **✅ 实际完成的结果 (Results & Verification)**：*（等待验证）*

---

### 【任务 12 (P2 / PERF-004)】多供应商并发测速矩阵与智能决策建议（待推进 ⏳）

- **🎯 阶段计划 (Plan)**：
  - 提供所有已配置供应商的一键并发测速能力，展示延迟、首字耗时（TTFT）与吞吐速率，支持智能一键切换主力节点。
- **🛠️ 实际完成的步骤 (Actual Steps)**：*（等待实施）*
- **✅ 实际完成的结果 (Results & Verification)**：*（等待验证）*

---

### 【任务 13 (P2 / PERF-003)】SQLite 查询计划基线与海量会话检索优化（待推进 ⏳）

- **🎯 阶段计划 (Plan)**：
  - 引入 `EXPLAIN QUERY PLAN` 对会话列表与搜索进行查询开销摸底，按真实 Schema 增加覆盖索引与 Keyset 分页支持，改善成千上万会话下的首屏打开速度。
- **🛠️ 实际完成的步骤 (Actual Steps)**：*（等待实施）*
- **✅ 实际完成的结果 (Results & Verification)**：*（等待验证）*