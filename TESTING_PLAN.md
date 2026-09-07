# Codex++ 测试与验证大纲 (TESTING_PLAN)

> **定位与目标**：规范项目的全套测试矩阵、基准测量指标、失败路径覆盖、环境约束与端到端真实性验证体系。  
> **核心原则**：不把“前端 UI 模拟”等同于“后端真实事务”；不把“局部测试通过”等同于“真实运行通过”；所有性能宣称必须提供可重放的真实测试环境、样本、耗时与统计分布（p50/p95）。

---

## 🧪 1. 四层测试金字塔与验证矩阵

```text
       ▲
      / \        [Layer 4] 真实桌面生命周期验证 (Desktop Validation)
     /   \       • 真实 Electron/CDP 注入 • Windows/macOS 真实进程 • 崩溃恢复
    /-----\      [Layer 3] CI 自动化集成流水线 (CI Automation & Smoke)
   /       \     • npm ci • tsc • vite:build • cargo test • 脱敏静态扫描
  /---------\    [Layer 2] 契约与 Mock 集成测试 (Contract & Fake Server)
 /           \   • Localhost Fake API • 临时 SQLite Schema • 真实 Loopback HTTP
/-------------\  [Layer 1] 纯函数与核心单元测试 (Unit Tests)
                 • 算法 • 编解码 • 状态机转移 • 评分公式 • 正则脱敏
```

### Layer 1: 纯函数与核心单测 (Unit Tests)
- **前端核心**：`apps/codex-plus-manager/src/*.test.ts`（目前已累积 187 项自动化单测）；
- **Rust 核心**：`crates/codex-plus-core/tests/*.rs` 与 `crates/codex-plus-data/tests/*.rs`；
- **要求**：执行速度极快（毫秒级），纯内存或虚拟状态，零外部网络依赖，100% 幂等。

### Layer 2: 契约与 Mock 集成测试 (Contract Tests)
- **Loopback HTTP 契约**：启动真实临时 HTTP 端口，测试 `/helper/shutdown` 的 Token 鉴权、OPTIONS 请求行为；
- **Fake Upstream 认证**：通过 WireMock 或本地 HTTP Server 验证 4 种供应商模式（官方登录/混入/纯API/聚合）下的 `Authorization` 请求头、`requires_openai_auth` 门禁与协议转换契约；
- **多 Schema 数据库兼容**：在本地内存/临时文件中生成旧版 `state_5.sqlite`、新版 `sqlite/*.db` 及纯 API `session_index.jsonl`，断言查询与恢复往返一致性。

### Layer 3: CI 自动化集成门禁 (CI Pipeline)
- 在标准 CI 环境中强制执行完整流水线：
  ```bash
  # 1. 严格版本安装
  npm ci
  # 2. 静态类型检查
  npm run check
  # 3. 生产产物编译
  npm run vite:build
  # 4. 前端自动化测试
  npm test
  # 5. Rust 代码格式与测试
  cargo fmt --check
  cargo test --workspace
  ```
- 任何一个环节报错，CI 强力阻断合入。

### Layer 4: 真实桌面生命周期验证 (Desktop Validation)
- 验证 Windows 系统真实运行：
  - 双击静默启动是否拉起带调试端口的 Codex 客户端；
  - 渲染端是否在 1 秒内无感知注入；
  - 任务管理器中观察无 250ms 死循环空转，空闲 CPU 稳定在 0%~1%；
  - 强杀 Codex 客户端后，Helper 进程在 2 秒内主动释放端口并退出。

---

## 📊 2. 性能基准测量与统计规范 (Benchmarking Standards)

拒绝“提速 40%”、“极速响应”等模糊描述，性能指标必须按以下标准测试并记录：

| 指标维度 | 测量方法 | 性能预算目标 | 验证命令/工具 |
| :--- | :--- | :--- | :--- |
| **空闲 CPU 占用** | 启动后无任何用户操作静置 3 分钟，采集平均 CPU | **< 1.5%** | Windows 资源监视器 / CDP Profiler |
| **流式打字延迟** | 助手吐字流式返回期间，输入框字符响应延迟 | **p95 < 16ms** (无掉帧) | Chrome DevTools Performance 面板 |
| **会话分页检索** | 10,000 条合成历史会话数据库中单页（50条）检索耗时 | **p50 < 1ms, p95 < 5ms** | Node.js 基准单测 / SQLite EQP |
| **供应商真实测速** | 捕获首字到达时间 (TTFT)，禁止估算 | 真实记录，杜绝 `*0.7` | 流式 HTTP 分块计时 |
| **Manager 首屏体积** | Vite 编译后的最大单个 JS Chunk 大小 | **< 500 KB** (无警告) | `npm run vite:build` |

---

## 🛡️ 3. 必须覆盖的失败与回滚路径测试清单

任何涉及持久化修改的功能，必须具备针对以下失败场景的自动化测试：
1. **磁盘满/只读介质**：模拟 `settings.json` 或 `config.toml` 写入失败时，原文件必须字节级保持原样；
2. **外部并发修改**：当用户在外部手动修改了配置文件时，触发一键撤销必须识别出冲突并拒绝覆盖；
3. **网络与接口断开**：上游 API 返回 400、401、403、429、504 时，协议代理能否保持状态机对齐，杜绝死循环；
4. **客户端异常退出**：官方应用意外崩溃后，Launcher 能否在有限时间内自愈停机，不陷入无尽重试。

---

## 🛑 4. 自动化脱敏静态扫描红线 (Leak Scanners)

所有测试套件、构建日志、诊断导出报告中，强制运行以下正则扫描：
- `/(?i)bearer\s+[a-z0-9_\-\.]{16,}/`：阻断 Bearer Token 泄漏；
- `/sk-[a-zA-Z0-9]{20,}/`：阻断标准 OpenAI 密钥泄漏；
- `/(?i)(api[_-]?key|password|secret)["']?\s*[:=]\s*["'][^"']+["']/`：阻断 JSON/TOML 中敏感凭据泄漏。

---

## 🔄 5. 本地测试与 GitHub Actions 协同执行架构 (Inner-Loop / Outer-Loop Architecture)

为了在开发迭代的高效率与跨平台全量构建的严密性之间取得平衡，测试体系采用**“双环驱动验证架构”**：

```text
  ┌────────────────────────────────────────────────────────┐
  │  【内环 Inner Loop】本地极速门禁 (Local Fast Gate)      │
  │   - 范围：apps/codex-plus-manager/ 纯 Node.js 测试套件 │
  │   - 工具：npm test (tsx 驱动，零外部依赖，极速纯内存)  │
  │   - 耗时：~500ms 极速响应，实时反馈                    │
  │   - 职责：验证业务逻辑、状态机转换、数据脱敏、协议契约│
  └───────────────────────────┬────────────────────────────┘
                              │ git commit & git push
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │  【外环 Outer Loop】GitHub Actions 全矩阵云端权威验证   │
  │   - 环境：Windows-2022 纯净标准镜像                    │
  │   - 工具链：Node.js 22 LTS, Rust Stable, Cargo, NSIS   │
  │   - 耗时：~5-8 分钟完整编译与矩阵测试                  │
  │   - 职责：严格依赖树锁死 (npm ci)、全量 TypeScript 静态│
  │           类型校验、Vite 生产打包、Rust 工作区测试、   │
  │           NSIS 安装包打包与发布制品一致性校验          │
  └────────────────────────────────────────────────────────┘
```

### 5.1 环境能力与权衡对比矩阵 (Trade-off Matrix)

| 维度 | 本地测试 (Local Environment) | GitHub Actions CI (Cloud Pipeline) | 架构选型结论 |
| :--- | :--- | :--- | :--- |
| **执行时效** | **极快 (~0.5s)**，开发过程无缝伴随 | **较慢 (~5-8m)**，需排队并初始化 Runner | **本地作为内环第一道防线**，拦截 90% 逻辑错误 |
| **测试范围** | 前端逻辑、状态机、契约与纯算法单元测试 | 全量前端构建 + Rust 后端多 Crates + NSIS 安装包打包 | **CI 作为外环终极防线**，覆盖完整系统产物 |
| **环境依赖** | 仅需 Node.js，无需安装本地 Rust/Cargo/Tsc | 预装完整标准编译环境（Rust, MSVC, NSIS, Node.js） | 消除开发者“配齐所有重型编译链”的心智负担 |
| **洁净度** | 可能受本地 `node_modules` 缓存或残留文件污染 | 每次运行均为云端全新虚拟机，绝对幂等一致 | **CI 结果作为发布就绪与合入审查的唯一权威标准** |

### 5.2 标准协同工作流 (Workflow Protocol)

1. **本地提交前必须通过内环门禁 (Inner-Loop Gate)**：
   - 任何改动推送到远程仓库前，必须在本地执行：
     ```powershell
     cd apps/codex-plus-manager
     npm test
     ```
   - 必须确保所有自动化单测（当前 187/187）**100% 通过（0 failure）**。未跑通单测严禁 Commit 或 Push。
2. **远程推送后自动触发外环流水线 (Outer-Loop Verification)**：
   - 推送至 `Gemini` 分支或打 `v*` Release Tag 后，GitHub Actions 自动接管：
     - 阶段 A：`npm ci` 验证 `package-lock.json` 依赖一致性；
     - 阶段 B：`npx tsc --noEmit` 进行 TypeScript 严格类型检查；
     - 阶段 C：`npm run vite:build` 验证前端生产打包无 Chunk 膨胀；
     - 阶段 D：`cargo test --workspace` 验证底层 Rust 内存安全与通信；
     - 阶段 E：自动打包出 Windows Portable 及 Setup 安装包。
3. **本地完整环境补充指引（可选）**：
   - 若开发者需要完全在本地复现 CI 的全量编译与 Rust 测试，需安装以下工具：
     - **Rust 工具链**：通过 `winget install Rustlang.Rustup` 安装并运行 `rustup default stable`；
     - **C++ 构建工具**：Visual Studio Build Tools (包含 MSVC 与 Windows SDK)；
     - **依赖复位**：根目录下执行 `npm install` 确保开发依赖（如 TypeScript、Vite）就绪。

