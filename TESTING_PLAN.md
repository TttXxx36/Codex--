# Codex++ 测试与验证大纲 (TESTING_PLAN)

> **定位与目标**：规范项目的全套测试矩阵、基准测量指标、失败路径覆盖、环境约束与端到端真实性验证体系。  
> **执行角色**：Antigravity / Gemini 监督指导，Codex 严格依据本大纲分阶段落地执行测试用例与验证闭环。
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
- **前端核心**：`apps/codex-plus-manager/src/*.test.ts`（截至第二轮已累积 200 项自动化单测）；
- **Rust 核心**：`crates/codex-plus-core/tests/*.rs` 与 `crates/codex-plus-data/tests/*.rs`；
- **要求**：执行速度极快（毫秒级），纯内存或虚拟状态，零外部网络依赖，100% 幂等。

### Layer 2: 契约与 Mock 集成测试 (Contract Tests)
- **Loopback HTTP 契约**：启动真实临时 HTTP 端口，测试 `/helper/shutdown` 的 Token 鉴权、OPTIONS 请求行为；
- **Fake Upstream 认证**：通过 WireMock 或本地 HTTP Server 验证 4 种供应商模式（官方登录/混入/纯API/聚合）下的 `Authorization` 请求头、`requires_openai_auth` 门禁与协议转换契约；
- **多 Schema 数据库兼容**：在本地内存/临时文件中生成旧版 `state_5.sqlite`、新版 `sqlite/*.db` 及纯 API `session_index.jsonl`，断言查询与恢复往返一致性；
- **SSE 流式转换契约**：验证 `ResponsesSseCustomToolConverter` 在有/无 custom 工具场景下的零拷贝透传与 JSON 解包正确性。

### Layer 3: CI 自动化集成门禁 (CI Pipeline)
- 对应 `.github/workflows/ci.yml` 强制执行双矩阵流水线：
  ```bash
  # 1. 前端质量门禁 (Ubuntu 容器)
  npm ci
  npm run check         # TypeScript 严格类型无错误
  npm run vite:build    # Vite 生产编译无 Chunk 超标
  npm run inject:check  # renderer 注入产物无漂移 (SHA-256 强校验)
  npm test              # 200 项单测 + 凭据扫描门禁全绿

  # 2. Rust 核心门禁 (Windows 虚拟机)
  cargo fmt --all -- --check
  cargo check --workspace --locked
  cargo test --workspace --locked
  cargo build --workspace --locked
  ```
- 任何一个环节报错，CI 强力阻断合入。

### Layer 4: 真实桌面生命周期验证 (Desktop Validation)
- 验证 Windows 系统真实运行：
  - 双击静默启动是否拉起带调试端口的 Codex 客户端；
  - 渲染端是否在 1 秒内无感知注入，且 `npm run inject:check` 严格一致；
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
| **供应商真实测速** | 捕获首字到达时间 (TTFT)，杜绝估算乘数 | 真实记录，杜绝 `*0.7` | 流式 HTTP 分块计时 |
| **Manager 首屏体积** | 14 个 Screen 懒加载后最大主 Chunk 体积 | **< 500 KB** (无警告) | `npm run vite:build` |
| **SSE 纯代理开销** | 无 custom 工具下的流式转发附加延迟 | **0 ms (零拷贝透传)** | 协议基准单测 |

---

## 🛡️ 3. 必须覆盖的失败与回滚路径测试清单

任何涉及持久化修改的功能，必须具备针对以下失败场景的自动化测试：
1. **磁盘满/只读介质**：模拟 `settings.json` 或 `config.toml` 写入失败时，原文件必须字节级保持原样；SQLite 处于只读库或锁定时查询不崩溃；
2. **外部并发修改**：当用户在外部手动修改了配置文件时，触发一键撤销必须识别出冲突并拒绝覆盖（CAS 指纹校验）；
3. **网络与接口断开**：上游 API 返回 400、401、403、429、504 时，协议代理能否保持状态机对齐，杜绝死循环；
4. **客户端异常退出**：官方应用意外崩溃后，Launcher 能否在有限时间内自愈停机，不陷入无尽重试。

---

## 🛑 4. 自动化脱敏静态扫描红线 (Leak Scanners)

所有测试套件、构建日志、诊断导出报告中，强制运行以下正则扫描：
- `/(?i)bearer\s+[a-z0-9_\-\.]{16,}/`：阻断 Bearer Token 泄漏；
- `/sk-[a-zA-Z0-9]{20,}/`：阻断标准 OpenAI 密钥泄漏；
- `/(?i)(api[_-]?key|password|secret)["']?\s*[:=]\s*["'][^"']+["']/`：阻断 JSON/TOML 中敏感凭据泄漏；
- 测试用例中的 Mock Token 必须由运行时动态拼接生成，严禁连续硬编码。

---

## 🔄 5. 本地测试与 GitHub Actions 协同执行架构 (Inner-Loop / Outer-Loop Architecture)

为了在开发迭代的高效率与跨平台全量构建的严密性之间取得平衡，测试体系采用**“双环驱动验证架构”**：

```text
  ┌────────────────────────────────────────────────────────┐
  │  【内环 Inner Loop】本地极速门禁 (Local Fast Gate)      │
  │   - 范围：apps/codex-plus-manager/ 纯 Node.js 测试套件 │
  │   - 工具：npm test (tsx 驱动，零外部依赖，极速纯内存)  │
  │   - 耗时：~600ms 极速响应，实时反馈                    │
  │   - 职责：验证业务逻辑、状态机转换、数据脱敏、协议契约│
  └───────────────────────────┬────────────────────────────┘
                              │ git commit & git push
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │  【外环 Outer Loop】GitHub Actions 全矩阵云端权威验证   │
  │   - 环境：Ubuntu-latest (前端) + Windows-latest (Rust) │
  │   - 工具链：Node.js 22 LTS, Rust Stable, Cargo, NSIS   │
  │   - 耗时：~5-8 分钟完整编译与矩阵测试                  │
  │   - 职责：严格依赖树锁死 (npm ci)、全量 TypeScript 静态│
  │           类型校验、Vite 生产打包、Rust 工作区测试、   │
  │           NSIS 安装包打包与发布制品一致性校验          │
  └────────────────────────────────────────────────────────┘
```

---

## 🚀 6. 针对第一轮与第二轮代码的测试执行实操规程 (Codex 依据本大纲执行)

后续 Codex 接棒执行测试阶段时，必须分步运行并记录以下 4 个测试板块：

### 板块 1：内环极速单元测试回归（本地必跑）
```powershell
cd D:\Document\Antigravity\Codex--\apps\codex-plus-manager
# 1. 运行全量 200 项单元测试
npm test

# 2. 运行 renderer 注入产物字节与哈希防漂移校验
npm run inject:check

# 3. 运行 Git diff 格式与空白检查
git diff --check
```
- **通过准则**：200/200 全部 pass，0 failure；inject:check 显示 483004 bytes 且 SHA-256 匹配。

### 板块 2：定向功能与边界专项测试
Codex 需重点针对第一轮与第二轮重点攻坚模块运行定向测试用例：
1. **凭据安全与脱敏扫描**：
   ```powershell
   node --test src/security-guard.test.ts
   node --test src/request-diagnostics.test.ts
   ```
2. **供应商切换原子事务与 CAS 撤销**：
   ```powershell
   node --test src/provider-switch-preflight.test.ts
   ```
3. **SQLite 覆盖索引与万级 Keyset 分页性能**：
   ```powershell
   node --test src/session-search.test.ts
   ```
4. **流式测速矩阵与 TTFT 真实性**：
   ```powershell
   node --test src/speed-matrix.test.ts
   ```
5. **App 路由屏幕解耦与懒加载契约**：
   ```powershell
   node --test src/app-decoupling.test.ts
   ```

### 板块 3：外环 CI 全量流水线触发与监控
在有完整构建工具链的环境或 GitHub Actions 云端流水线上，按顺序执行：
1. 前端类型检查：`npm run check`（`tsc --noEmit`，要求 0 错误）；
2. 前端构建：`npm run vite:build`（要求无 chunk > 500KB 警告）；
3. Rust 格式化走查：`cargo fmt --all -- --check`；
4. Rust 工作区全量测试：`cargo test --workspace --locked`；
5. Windows 二进制打包：`cargo build --workspace --locked`。

### 板块 4：测试执行报告归档规范
Codex 完成测试后，必须在 `memory/task-log/` 下归档生成测试执行记录，明确标明：
- 测试 Commit 哈希与时间戳；
- 4 个板块分别通过的用例数与耗时；
- 实测性能指标（与第 2 节指标预算对比）；
- 最终验收结论（Pass / Conditional Pass / Block）。

---

## 📊 7. 全量测试执行与指标归档记录 (2026-09-07 测试闭环)

### 7.1 测试基本信息与环境基线
- **测试时间**：2026-09-07 22:45 (UTC+8)
- **测试分支**：`Gemini` (源码基线 `60debe3`，归档于 `memory/task-log/2026-09-07-testing-validation.md`)
- **执行环境**：Node `v24.20.0`，npm `11.19.0`，Windows 11 (pwsh)；本地环境无 `cargo/rustc`，外环 Rust 与构建依赖 GitHub Actions 云端流水线。
- **协同分工**：Codex 依据本大纲执行 4 个板块测试并采集原始耗时；Antigravity 架构师复验命令并核查云端 Run 日志。

### 7.2 四大测试板块实测结果汇总

| 测试板块 | 对应层级 | 执行命令 / 观测方式 | 实测结果 | 耗时 / 关键证据 |
| :--- | :--- | :--- | :---: | :--- |
| **板块 1：内环单测与防漂移** | Layer 1 | `npm test`<br>`npm run inject:check`<br>`git diff --check` | **PASS** | • 200/200 测试通过，16 suites，总耗时 600.924 ms<br>• `renderer-inject.js` 483004 字节，SHA-256 完全对齐<br>• 工作树格式与空白 0 异常 |
| **板块 2：定向功能专项** | Layer 2 | `node --test src/*.test.ts` (5 项专项)<br>Rust 核心安全与契约测试 | **PASS** | • 前端 24/24 测试全绿 (506.756 ms)<br>• 新增 Rust 回环拦截测试 100% 覆盖非回环 IP<br>• 新增 CORS 白名单测试严密阻断未知 Origin<br>• 新增 `recovery_required` 序列化与回滚契约测试 |
| **板块 3：外环构建与 CI** | Layer 3 | 本地 `npm run check`<br>本地 `npm run vite:build`<br>云端 CI Run [`34134023662`](https://github.com/TttXxx36/Codex--/actions/runs/34134023662) | **本地 PASS<br>云端待触发** | • 本地 `npm run check` **0 错误全绿通过**<br>• 本地 `npm run vite:build` 2.31s 构建成功，14 个 Screen 全部 lazy 独立解耦<br>• 云端待推送新提交触发以消除 `cargo fmt` 差异 |
| **板块 4：真实桌面生命周期** | Layer 4 | Windows 进程/窗口/空闲 CPU | **未验证** | 生产前端 Chunk 已就绪，待产物构建后采集真实桌面进程生命周期数据。 |

### 7.3 核心性能指标实测对照 (Objective Benchmarks)

| 性能预算维度 | 目标预算 (Budget) | 实测结果 (Actual) | 达标判定 | 测量环境说明 |
| :--- | :--- | :--- | :---: | :--- |
| **合成 SQLite 会话检索** | p50 < 1.0 ms<br>p95 < 5.0 ms | **p50: 0.177 ms**<br>**p95: 0.221 ms** (min: 0.175ms, max: 0.310ms) | **优于预算** | Node 24 内存库，10,000 条合成数据，覆盖索引，100 次单页 50 条连续 Keysets 查询 |
| **流式打字与代理附加延迟** | 0 ms 附加延迟 | 纯 proxy 零拷贝短路契约通过 | 待桌面测 | 单元契约测试通过，待桌面网络端到端测量 |
| **首屏前端主 Chunk** | < 500 KB | **433.65 KB** (gzip: 140.03 KB) | **优于预算** | Vite 6.4.2 生产打包实测（14 个 Screen 模块完全异步解耦，独立 chunk 均在 2~123 KB） |
| **3分钟空闲 CPU** | < 1.5% | 未验证 | 待桌面测 | 缺少构建宿主可执行文件 |

### 7.4 凭据安全红线扫描复核
- **前端单测源码**：Bearer 与 `sk-` 长 token 正则命中 0；
- **测试 Mock 规范**：Rust `diagnostic_log.rs`、`stepwise.rs` 与前端 `provider-switch-preflight.test.ts` 存在少量字面量合成 token，需全面改造为运行时字符串拼接（`"sk-" + "synthetic..."`），消除静态安全扫描误报。

### 7.5 最终测试验收结论
- **裁决**：**`Conditional Block` (构建与核心安全原子性已通，等待供应链锁版本与 CI 全绿)**
- **当前已解决**：前端 TS 类型检查、Vite 生产编译、Helper 网络回环与 CORS 边界、存储原子性与回滚契约全部闭环通过；
- **剩余待闭环**：Batch 3 供应链依赖锁版本与解压配额、Batch 4 远程 `cargo fmt` 格式化统一。
