# Codex++ 第二轮开发演进大纲与实施跟踪 (DEVELOPMENT_PLAN_2)

> **项目目标**：打造极致轻量、超低 CPU 占用、无广告侵扰、零端口死锁、高可靠的工业级 Codex 桌面增强与管理套件。  
> **文档定位**：全量承接第一阶段大纲 `DEVELOPMENT_PLAN.md` 任务 01～15 成果（v1.2.58 稳定里程碑），作为第二轮深度稳健重构与可靠性自愈的全局执行主轴。  
> **当前代码基线**：Commit `dc9ae8b` (`v1.2.58`)，分支 `Gemini`。  
> **前置审查继承**：任务 01～14 的代码审计与问题发现已完成，已登记于《审查大纲》，第二轮跳过重复初审，直接进入针对性缺陷闭环修复。  
> **存放位置**：项目根目录 `DEVELOPMENT_PLAN_2.md`（实时更新维护）。

---

## 📌 开发大纲维护机制与执行原则

1. **结构传承与逻辑对齐**：
   - 严格继承第一阶段大纲的架构框架与标准范式，保持逻辑与工程结构 100% 一致性；
   - 每个任务节点均严格落实三要素闭环跟踪：
     - 🎯 **每一步的计划 (Plan)**：明确功能边界、解决的核心痛点与技术路线；
     - 🛠️ **实际完成的步骤 (Actual Steps)**：记录代码修改的具体文件、核心逻辑改造与安全处理；
     - ✅ **实际完成的结果 (Results & Verification)**：提供客观的验证指标、测试结果与前后对比。
2. **严谨的真实性与证据等级判定 (True Grounding)**：
   - 严格区分“纸面宣称/理论指标”与“实测数据”，所有性能指标实测前标注为目标值，禁止无证据断言；
   - 严格区分四级证据：**S**（源码存在）/ **T**（单元测试通过）/ **C**（CI/构建产物生成）/ **D**（桌面端端到端运行验证）；
   - 告别纯前端内存模拟，所有配置与凭据操作均由后端命令提供结构化返回与原子快照。
3. **渐进式实施铁律（稳定性与门禁优先）**：
   - **第一阶段（P0 深度稳定性与凭据事务闭环）**：优先攻坚统一命令结果与恢复契约、供应商切换真实事务、环境变量归属判定、Launcher/Bridge 端口与停机接口认证；
   - **第二阶段（P1 隐私与质量门禁强守护）**：收口本地 Markdown 分享语义与残留外联、补齐诊断面板与错误脱敏泄漏、建立 CI 最小自动化门禁；
   - **第三阶段（P2 架构解耦与海量数据性能拓展）**：在门禁守护下安全推进 App.tsx 模块级动态路由拆分、renderer 模块打包、真实 TTFT 流式测速接入与 SQLite 真实 Keyset 接入。
4. **安全底线与凭据保护**：
   - 严禁真实凭据、Token、Cookie 或未脱敏数据进入日志、快照、测试用例或 Git 历史。

---

## 🔍 第二轮核心问题与架构共识总结（吸收两份复核报告）

结合 GPT 产出的两份只读审查报告与复核评估，确立第二轮重点闭环的架构事实与缺陷清单：

1. **统一命令结果与恢复契约缺失（假成功隐患）**：
   - 前端存在“invoke 执行失败但 UI 依然展示成功提示”的盲区；后端必须返回统一样式的 `{ ok: boolean, code?: string, undoToken?: string, recovery?: string }`，UI 必须以真实结果驱动。
2. **供应商切换跨层事务与持久化回滚**：
   - 撤销 ID 不能靠前端 `Math.random()` 临时生成；由后端在切换前捕获 `settings.json`、`config.toml`、`auth.json` 真实快照并在本地持久化；撤销前校验文件防踩踏。
3. **环境变量归属模型与 401 隔离**：
   - 区分 process env 与 user env，结合变量名、来源、真实指纹与预期 profile 综合判定；消除误删风险与启动 401 隐患。
4. **Helper 停机接口安全与端口参数贯穿**：
   - `/helper/shutdown` 增加基于随机一次性 Token 的访问校验与 OPTIONS 请求拦截，关闭开放式 CORS；消除动态端口路径下重试逻辑硬编码 57321 的缺陷。
5. **脱敏与分享语义彻底收敛**：
   - 修复 `diagnostic_log.rs` 中只脱敏首个 Bearer token 的缺陷；修复未知错误原文流入 `statusDescription` 导致的潜在泄漏；彻底清理 renderer 中残留的远程分享伪链接构造。

---

## 🗺️ 第二轮任务演进全景图 (Mermaid)

```mermaid
graph TD
    subgraph 基线继承阶段
        V1["✅ 阶段一里程碑: v1.2.58 (任务 01 ~ 15 全部交付并发布)"]
    end

    subgraph 第一阶段：深度稳定性与凭据事务闭环 (P0)
        T16["🎯 任务 16 (BUG-008): 统一命令执行结果契约与供应商切换后端持久化撤销"]
        T17["🎯 任务 17 (BUG-009): 环境变量值级归属判定与 401 凭证防破坏"]
        T18["🎯 任务 18 (BUG-010): Launcher / Bridge 生命周期状态机、停机Token认证与端口解耦"]
    end

    subgraph 第二阶段：隐私脱敏收口与质量门禁强守护 (P1)
        T19["🎯 任务 19 (BUG-012): 全局大小写敏感多Bearer脱敏与诊断错误面板原文泄漏防护"]
        T20["🎯 任务 20 (BUG-013): 纯本地会话分享语义彻底收敛与残留公网代码清理"]
        T21["🎯 任务 21 (TEST-001): 跨平台最小自动化 E2E 回归与 CI 质量门禁"]
    end

    subgraph 第三阶段：架构解耦、海量数据与协议深度拓展 (P2)
        T22["🎯 任务 22 (PERF-005): App.tsx 1.13 万行真·路由文件拆分与 lazy chunk 编译"]
        T23["🎯 任务 23 (PERF-006): renderer-inject.js 1.05 万行单 IIFE 模块工程化打包"]
        T24["🎯 任务 24 (PERF-007): 测速矩阵真实流式 TTFT 采集与 3xx 判定严谨化"]
        T25["🎯 任务 25 (PERF-008): SQLite 多 Schema 真实接入与 Keyset 游标后端闭环"]
        T26["🎯 任务 26 (BUG-011): 国产大模型协议 / WeChat 权限枚举与条件性安全加固"]
    end

    V1 --> T16
    T16 --> T17
    T17 --> T18
    T18 --> T19
    T19 --> T20
    T20 --> T21
    T21 --> T22
    T22 --> T23
    T23 --> T24
    T24 --> T25
    T25 --> T26
```

---

## 📝 详细任务定义与实施计划

### 【任务 16 (P0 / BUG-008)】统一命令执行结果契约与供应商切换后端持久化撤销

- **🎯 阶段计划 (Plan)**：
  - **解决核心痛点**：
    1. 前端目前使用 `Math.random()` 构造内存快照，刷新即丢；`undoProviderSwitch` 在调用失败时仍可能无条件弹出“撤销成功”；
    2. 后端缺乏结构化命令契约，无法将“恢复成功 / 恢复失败 / 需要人工干预”清晰传回。
  - **核心实施方案**：
    - 统一 Tauri 命令交互规范：后端核心结构返回 `{ ok: bool, code?: String, message?: String, undo_token?: String, recovery?: String }`；
    - 在 `relay_switch.rs` 中实现不可伪造的持久化快照，切换前将 `settings.json`、`config.toml`、`auth.json` 写入隔离目录并记录 SHA-256 指纹；
    - 实现 `restore_last_switch(token)` 后端撤销命令，校验当前文件指纹仍属于该次切换产物（防外部修改踩踏）；
    - 前端严格根据返回结果的 `ok` 状态刷新界面，失败时保留撤销 Token 并展示真实错误与恢复入口，坚决杜绝虚假成功。
  - **必须覆盖的测试场景**：
    - settings 保存失败、config/auth 写入失败模拟；
    - 切换成功后一键撤销文件字节级往返复原测试；
    - 撤销时文件已被外部手动改动的冲突拒绝保护；
    - 应用重启后仍能识别持久化快照或给出清晰不可撤销说明。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  - `crates/codex-plus-core/src/relay_switch.rs`：将供应商切换改为后端事务式流程；切换前将 `settings.json`、`config.toml`、`auth.json` 以原始字节和 SHA-256 指纹写入隔离快照目录，成功后记录切换后指纹并返回后端生成的 UUID 撤销 token；失败时尝试回滚，回滚失败映射为 `recovery_required`。
  - `crates/codex-plus-core/src/settings.rs`：暴露 `SettingsStore::path()`，供快照/恢复流程定位真实 settings 文件。
  - `apps/codex-plus-manager/src-tauri/src/commands.rs`、`src-tauri/src/lib.rs`：统一供应商切换/撤销/持久化撤销状态的结构化动作结果，并注册 `undo_relay_switch`、`load_relay_switch_undo`；日志仅记录错误 code，不记录错误详情中的潜在凭据。
  - `apps/codex-plus-manager/src/App.tsx`、`src/provider-switch-preflight.ts`：移除前端 `Math.random()` 和内存 settings 快照；启动时加载后端快照，成功只接受 `ok === true` 且有可信 token 的撤销入口，失败保留 token 并展示后端错误/恢复建议，敏感 diff 仅显示掩码值。
  - `crates/codex-plus-core/tests/relay_switch.rs`、`src/provider-switch-preflight.test.ts`：补充字节级往返、外部修改冲突拒绝、快照写入中断不变更文件、重载发现快照，以及动作结果/敏感字段契约测试。

- **✅ 实际完成的结果 (Results & Verification)**：
  - `apps/codex-plus-manager`：`npm test` 通过 **188/188**（0 failed）。
  - `git diff --check` 通过。
  - 静态审阅确认成功/失败/恢复冲突/人工恢复路径均由结构化 `ok`、`code`、`undo_token`、`recovery` 驱动；未运行真实桌面 E2E。
  - `npm run check` 未完成：当前环境缺少 `tsc`；Rust 测试/编译未完成：当前环境缺少 `cargo`、`rustc`、`rustfmt`、`rust-analyzer`。因此 Rust 编译与新增 Rust 集成测试结果仍标记为 **未验证**，没有伪称为通过。

---

### 【任务 17 (P0 / BUG-009)】环境变量值级归属判定与 401 凭证防破坏

- **🎯 阶段计划 (Plan)**：
  - **解决核心痛点**：
    1. 消除粗暴按 `OPENAI_` 前缀判定冲突的缺陷，防止误删用户自定义系统的其它合法环境变量；
    2. 解决检测成功但实际请求缺少 Authorization 头导致的 401 故障，建立系统环境、`auth.json` 与目标 profile 的值级一致性判定；
    3. `env_conflicts.rs` 虽有恢复函数但前端缺乏产品化操作入口。
  - **核心实施方案**：
    - 明确区分进程环境变量 (process env) 与 Windows 用户注册表环境变量 (user env)；
    - 建立“变量名 + 来源 + 当前值哈希 + 归属状态”的多维判定实体，当前值与当前 profile 完全一致时自动判定为“一致”，不弹出误报；
    - 提供产品级环境冲突撤销/恢复入口与安全确认机制；
    - 使用本地 fake server 校验 4 种供应商模式（官方登录/混入/纯API/聚合）下的 Authorization 请求头行为。
  - **必须覆盖的测试场景**：
    - 相同密钥不重复弹窗误报测试；
    - 外部修改后的变量免误删保护测试；
    - 4 种模式下 fake server 鉴权请求头逐项断言；
    - 备份落盘与逆向一键还原往返一致性测试。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  - `crates/codex-plus-core/src/env_conflicts.rs`：将环境变量匹配从 `OPENAI_` 前缀收敛为影响 Codex 请求的显式白名单；新增 `Aligned` / `Divergent` / `External` 值级状态、进程/用户来源保留、当前值与期望值掩码字段，并以 active profile 的 API key / Base URL 进行比较；空字符串保持 `<empty>` 掩码且不标记为 `valuePresent`。
  - `crates/codex-plus-core/src/env_conflicts.rs`、`crates/codex-plus-core/tests/env_conflicts.rs`：删除路径仅接受值级 `Divergent` 项；备份使用原子写入并返回持久化 `EnvConflictUndo` 元数据；恢复前校验变量名白名单，补齐一致、分歧、空值、掩码和备份还原集成测试。
  - `apps/codex-plus-manager/src-tauri/src/commands.rs`、`src-tauri/src/lib.rs`：`check_env_conflicts` / `remove_env_conflicts` 接入当前 profile，正式注册恢复命令，并以结构化 `RestoreEnvConflictsPayload` 返回恢复计数与备份路径；删除响应仅返回掩码冲突、删除结果和本地撤销路径；恢复命令拒绝应用备份目录之外的路径。
  - `apps/codex-plus-manager/src/env-conflicts-guard.ts`、`env-conflicts-guard.test.ts`、`src/App.tsx`：新增纯逻辑守卫，过滤 `Aligned` / 未配置 `External`、按变量名去重、校验掩码标记并消费备份恢复契约；Manager 增加一键恢复入口，恢复动作只提交后端返回的备份路径。

- **✅ 实际完成的结果 (Results & Verification)**：
  - `apps/codex-plus-manager`：`npm test` 通过 **195/195**（0 failure，较 BUG-010 基线 191 项新增 4 项 BUG-009 契约测试）。【T】
  - `git diff --check` 通过。【S/T 辅助检查】
  - `npm run check` 未完成：当前环境没有可执行的 `tsc`；`cargo test -p codex-plus-core --test env_conflicts` 未完成：当前环境没有 `cargo`。因此 Rust 编译、Rust 集成测试、TypeScript 类型检查、桌面端 E2E 仍标记为 **未验证**，未将静态审计冒充为通过。
  - 安全边界：源码、命令 payload、Manager 展示均不返回完整环境变量值；本地备份仅用于恢复，测试与诊断输出不打印备份内容。当前未提交、未推送。

---

### 【任务 18 (P0 / BUG-010)】Launcher / Bridge 生命周期状态机、停机Token认证与端口解耦

- **🎯 阶段计划 (Plan)**：
  - **解决核心痛点**：
    1. `/helper/shutdown` 停机路由缺乏凭证校验与 HTTP Method 约束，OPTIONS 预检可能误触发停机，CORS `*` 存在潜在非授权探测风险；
    2. 动态分配端口场景下，重试停机信令仍硬编码发送到 57321；
    3. Watchdog 轮询缺乏终态退出机制，进程强杀后容易陷入 generation 风暴。
  - **核心实施方案**：
    - 为每次 Helper 实例启动派发随机单次生命周期 Token，停机请求必须携带 Token 方可执行；
    - 拦截未认证的 OPTIONS 请求，收紧跨域头为仅限允许来源；
    - 规范化实际 `helper_port` 参数贯穿，禁止在动态端口分支中写死 57321；
    - 固化守护状态机：`absent` / `starting` / `ready` / `cdp_only` 与有序退出规划（2 秒停机预算，CDP hook 卸载与资源释放）。
  - **覆盖的测试场景**：
    - 带 Token 正确停机与无 Token 401 拒绝测试；
    - OPTIONS 请求返回 405 且不篡改停机标志测试；
    - 动态 helper runtime 端口路径隔离与停机 Token 对齐；
    - 前端生命周期状态机、stale recovery 阻断与终止信号清理预算单测全量通过。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  - `crates/codex-plus-core/src/watcher.rs` & `tests/watcher.rs`：收敛 `CodexRuntimeState` 状态枚举（`Absent`, `Starting`, `Ready`, `CdpOnly`），统一 Launcher 与 Watcher 对进程与 CDP 的判定，避免误判与重复拉起；
  - `crates/codex-plus-core/src/launcher.rs` & `apps/codex-plus-launcher/src/main.rs`：为 Helper 增加随机 `shutdown_token` 与 Bearer 鉴权，停机路由必须为 POST 请求并匹配 loopback Bearer token；拦截 OPTIONS 预检请求防止误触停机；Windows Console Break/Close/Logoff/Shutdown 及 Unix SIGTERM/Ctrl-C 接入跨平台信号监听并赋予 2 秒优雅停机预算；
  - `crates/codex-plus-core/src/bridge.rs`：增加 `uninstall_bridge` 与 `build_bridge_cleanup_script`，清理注入的 DOM/Window 全局变量与回调；
  - `crates/codex-plus-core/src/paths.rs`：新增 `default_helper_runtime_path(helper_port)` 支撑动态端口实例隔离；
  - `apps/codex-plus-manager/src/launcher-lifecycle.ts` & `src/launcher-lifecycle.test.ts`：前端抽象生命周期状态机模型与优雅停机计划，新增 3 项自动化测试（总测试用例增至 191 项）；
  - `Cargo.toml`：开启 `tokio` 的 `signal` 特性以支持跨平台信号监听。

- **✅ 实际完成的结果 (Results & Verification)**：
  - `apps/codex-plus-manager`：`npm test` 自动化测试 **191/191 项 100% 全部通过 (0 failures)**；
  - `git diff --check` 通过；
  - 静态审计确认 helper 停机严格要求 `POST` + 本地回环 + Bearer Token，OPTIONS 不篡改停机标志；
  - （本地缺少 Cargo/Rust 工具链，Rust 集成测试标注为静态审查通过，等待 CI 外环矩阵验证）。

---

### 【任务 19 (P1 / BUG-012)】全局大小写敏感多Bearer脱敏与诊断错误面板原文泄漏防护

- **🎯 阶段计划 (Plan)**：
  - **解决核心痛点**：
    1. `crates/codex-plus-core/src/diagnostic_log.rs` 中采用大小写敏感的 `find("Bearer ")`，且只替换首个 token，导致多 token 或小写 `bearer` 遗漏；
    2. 前端 `request-diagnostics.ts` 将未分类错误原文直接写入 `statusDescription`，导致面板和导出报告中可能带出敏感密钥。
  - **核心实施方案**：
    - 在 Rust 核心层重构脱敏引擎，采用全局正则级、大小写不敏感（`(?i)bearer\s+[^\s"'\\]+`）多 Token 递归打码；
    - 在前端诊断解析管道中，严格限制 `statusDescription` 仅展示结构化安全摘要或枚举类别，禁止直接透传未经脱敏的底层 errorMessage；
    - 增加专门的敏感凭证泄漏红线测试。
  - **必须覆盖的测试场景**：
    - 多个不同大小写 Bearer token 单行混写脱敏断言；
    - 未知 500 / 网络错误报告生成断言不含明文 Key。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  - `crates/codex-plus-core/src/diagnostic_log.rs`：引入已存在于锁文件的 `regex` 依赖，使用缓存的全局、不区分大小写正则替换所有 Bearer token；同时覆盖 `sk-` 凭证与 `api-key` / `token` / `key` / `access-token` 等查询参数，并保留递归对象字段脱敏。
  - `apps/codex-plus-manager/src/request-diagnostics.ts`：扩展前端大小写无关多 Token/query 脱敏；未知错误不再透传 `errorMessage`，面板字段与导出报告增加二次安全过滤。
  - `apps/codex-plus-manager/src/request-diagnostics.test.ts`、`crates/codex-plus-core/src/diagnostic_log.rs`、`crates/codex-plus-core/tests/diagnostic_log.rs`：补齐混合大小写多 Bearer、查询凭证、畸形输入、未知网络错误及面板/报告无明文凭证回归测试。

- **✅ 实际完成的结果 (Results & Verification)**：
  - `apps/codex-plus-manager`：`npm test` 通过 **198/198**（0 failure；基线 195 项新增 3 项 BUG-012 前端测试）。【T】
  - `node --test src/request-diagnostics.test.ts`：**7/7 passed**。【T】
  - `git diff --check`：通过。【S/T 辅助检查】
  - `npm run check` 未完成：当前环境没有可执行的 `tsc`；`cargo test -p codex-plus-core --test diagnostic_log` 未完成：当前环境没有 `cargo`。Rust 编译、Rust 集成测试、TypeScript 类型检查和桌面 E2E 仍标记为 **未验证**。
  - 安全边界：日志、面板、IPC 诊断条目和导出报告不携带完整 Key/Bearer；测试只使用合成 fixture。当前未提交、未推送。

---

### 【任务 20 (P1 / BUG-013)】纯本地会话分享语义彻底收敛与残留公网代码清理

- **🎯 阶段计划 (Plan)**：
  - **解决核心痛点**：
    - 虽然会话已阻断公网上传，但 `renderer-inject.js` 仍残留加密调用 `/share/create`、拼接失效远程 URL 的死逻辑，容易引起隐私顾虑与误解。
  - **核心实施方案**：
    - 彻底从注入端脚本中移除远程分享 URL 拼接、无效加密远程参数及 Discord/Telegram 遗留点击代码；
    - 会话分享纯粹保留为本地结构化 Markdown 导出与系统剪贴板安全复制；
    - 同步更新测试断言与产品文案说明。
  - **必须覆盖的测试场景**：
    - 点击会话导出无任何外部网络请求测试；
    - 本地 Markdown 导出内容结构化校验；
    - 静态源码断言无远程分享伪链接构造。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  - *（待任务实施后登记具体文件修改、核心逻辑改造与提交 commit）*

- **✅ 实际完成的结果 (Results & Verification)**：
  - *（待任务验证后登记客观测试命令、通过指标与失败路径覆盖断言）*

---

### 【任务 21 (P1 / TEST-001)】跨平台最小自动化 E2E 回归与 CI 质量门禁

- **🎯 阶段计划 (Plan)**：
  - **解决核心痛点**：
    - 第一阶段虽然单测全绿，但缺乏严格的真实生产路径测试（如本地缺少 tsc/vite 时未被及时拦截）；
    - 为后续大规模代码拆解提供绝对可靠的防退化质量门禁。
  - **核心实施方案**：
    - 建立全维度本地与 CI 构建测试门禁：覆盖 `npm ci`、`npm test`、`tsc --noEmit`、`vite build`、`cargo test --workspace`；
    - 增强基于真实 Loopback HTTP / WebSocket 通信的 Mock Smoke 测试集，覆盖真实握手与生命周期；
    - 在流水线中引入凭据与敏感字段自动化静态扫描。
  - **必须覆盖的测试场景**：
    - 自动化流水线在发生任何类型错误或单测失败时能强力阻断合入；
    - 完整编译构建生成 Windows 安装包与各端产物。

- **🛠️ 实际完成的步骤 (Actual Steps)**：
  - *（待任务实施后登记具体文件修改、核心逻辑改造与提交 commit）*

- **✅ 实际完成的结果 (Results & Verification)**：
  - *（待任务验证后登记客观测试命令、通过指标与失败路径覆盖断言）*

---

### 【任务 22 (P2 / PERF-005)】App.tsx 1.13 万行真·路由文件拆分与 lazy chunk 编译

- **🎯 阶段计划 (Plan)**：
  - **前置依赖**：必须在任务 16～21 全部完成并通过 CI 质量门禁后实施。
  - **实施方案**：
    - 建立清晰的 `views/` 目录，单次逐个解耦 Screen 视图组件（如 `views/RelayScreen.tsx`、`views/SessionsScreen.tsx`）；
    - 采用模块顶层声明的 `lazy(() => import(...))` 进行异步按需加载，配合 `Suspense` 与 `ErrorBoundary`；
    - 修复 TypeScript 检查暴露的 `updatedAtMs` 类型兼容警告；
    - 将 `App.tsx` 瘦身至纯粹的顶层 Shell 容器与路由协调器（800 行以内）。
  - **验收标准**：
    - 主 bundle 体积明显下降，消除 Vite chunk > 500KB 警告；
    - 拆分后单测保持 100% 绿灯通过，UI 行为与状态完全一致。

---

### 【任务 23 (P2 / PERF-006)】renderer-inject.js 1.05 万行单 IIFE 模块工程化打包

- **🎯 阶段计划 (Plan)**：
  - **实施方案**：
    - 将生命周期、选择器适配、会话处理、Markdown 导出、样式注入与 Bridge 通信解耦为独立模块；
    - 利用 Rollup/Vite 构建输出自包含单一 bundle，保持与 Rust 嵌入层 `assets.rs` 的完全透明兼容；
    - 修复选择器并集匹配可能造成的重复或错误挂载控件问题。
  - **验收标准**：
    - 消除全局变量污染，构建产物与原功能 100% 等价。

---

### 【任务 24 (P2 / PERF-007)】测速矩阵真实流式 TTFT 采集与 3xx 判定严谨化

- **🎯 阶段计划 (Plan)**：
  - **实施方案**：
    - 彻底剔除 `ttftMs = latency * 0.7` 的估算伪造逻辑；
    - 后端改用流式请求准确捕获首字节到达时间（TTFT）与总往返耗时；
    - 明确只将 2xx 状态码判定为有效成功，3xx 重定向予以针对性标注；
    - 修复进度指示器总数与实际过滤任务数的不一致问题。
  - **验收标准**：
    - 测速延迟与首字响应具备真实客观的可比性。

---

### 【任务 25 (P2 / PERF-008)】SQLite 多 Schema 真实接入与 Keyset 游标后端闭环

- **🎯 阶段计划 (Plan)**：
  - **实施方案**：
    - 将后端 `list_local_sessions_keyset` 指令与前端滚动/翻页全面对接，不再局限于首页数组切片；
    - 修复旧数据库缺失 `updated_at_ms` 时 archived 索引创建报错被静默吞掉的缺陷，增加安全 Schema 检测；
    - 保留 offset 作为安全兼容回退。
  - **验收标准**：
    - 在万级会话规模下遍历翻页无漂移、无漏查，查询计划最优。

---

### 【任务 26 (P2 / BUG-011)】国产大模型协议 / WeChat 权限枚举与条件性安全加固

- **🎯 阶段计划 (Plan)**：
  - **实施方案**：
    - 修正 WeChat app-server 调用的 sandbox 枚举映射（`read-only` -> `readOnly` 等）；
    - 针对 `custom` tool 提供自动向 `function` 转换或安全降级；
    - 将更新器签名/Hash校验、脚本市场 URL/大小校验、ZIP 解压配额等作为条件性安全防线按需完善。
  - **验收标准**：
    - 多种非标 API 与微信接入场景流式输出稳定。

---

## 🛑 跨任务数据安全准则与终止条件

1. **凭据安全绝对红线**：
   - 任何涉及 API Key、Cookie、Bearer 或用户私密会话的内容，绝不允许出现在测试 fixture、日志输出或提交历史中；
2. **操作原子性与双向回滚**：
   - 涉及系统注册表、环境变量或配置文件写入时，必须具备原子快照与失败补偿；
3. **遇到以下情况必须立即停止并保留现场**：
   - 切换可能破坏或覆盖用户当前有效凭据；
   - 撤销动作无法被后端有效验证；
   - 进程或端口出现无法自愈的死锁状态。
