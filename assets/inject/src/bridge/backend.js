  async function loadBackendSettingsState() {
    const seq = codexPlusBackendSettingsSeq;
    try {
      const settings = await postJson("/settings/get", {});
      if (!settings || typeof settings !== "object" || (!("launchMode" in settings) && !("enhancementsEnabled" in settings) && !("providerSyncEnabled" in settings))) {
        throw new Error("invalid backend settings response");
      }
      if (seq !== codexPlusBackendSettingsSeq) {
        return false;
      }
      codexPlusBackendSettings = { ...codexPlusBackendSettings, ...settings };
      codexPlusBackendSettingsLoaded = true;
      return true;
    } catch (_) {
      return false;
    }
  }

  async function loadBackendSettings() {
    const loaded = await loadBackendSettingsState();
    if (loaded && codexRemoteSessionProviderOverrideEnabled()) {
      void loadCodexModelCatalog();
    }
    refreshCodexPlusBackendToggles();
    return loaded;
  }

  function loadBackendSettingsForStartup(attempt = 0) {
    loadBackendSettings().then((loaded) => {
      if (loaded) {
        scan();
        return;
      }
      if (attempt < 60) {
        setTimeout(() => loadBackendSettingsForStartup(attempt + 1), 250);
      }
    });
  }

  async function setBackendSetting(key, value) {
    const seq = ++codexPlusBackendSettingsSeq;
    codexPlusBackendSettings = { ...codexPlusBackendSettings, [key]: value };
    codexPlusBackendSettingsLoaded = true;
    refreshCodexPlusBackendToggles();
    try {
      const settings = await postJson("/settings/set", { [key]: value });
      if (seq === codexPlusBackendSettingsSeq) {
        codexPlusBackendSettings = { ...codexPlusBackendSettings, ...settings };
      }
    } finally {
      refreshCodexPlusBackendToggles();
    }
  }

  function refreshCodexPlusBackendToggles() {
    document.querySelectorAll(".codex-plus-toggle[data-codex-backend-setting]").forEach((button) => {
      const key = button.getAttribute("data-codex-backend-setting");
      button.dataset.enabled = String(!!codexPlusBackendSettings[key]);
    });
    syncStepwisePanel();
    renderCodexPlusMenu();
    scan();
  }

  let codexPlusUserScripts = { enabled: true, builtin_dir: "", user_dir: "", scripts: [] };
  let codexPlusBackendStatus = { status: "checking", message: "正在检查后端…" };
  let codexPlusBackendCheckSeq = 0;

  function renderBackendStatus() {
    const status = codexPlusBackendStatus.status || "failed";
    if (codexPlusBackendStatus.version) {
      codexPlusVersion = codexPlusBackendStatus.version;
      document.querySelectorAll("[data-codex-plus-version]").forEach((node) => {
        node.textContent = `Codex++ ${codexPlusVersion}`;
      });
    }
    const label = document.querySelector("[data-codex-backend-status]");
    if (label) {
      label.dataset.status = status;
      label.textContent = codexPlusBackendStatus.message || (status === "ok" ? "后端已连接" : "未连接");
    }
    document.querySelectorAll("[data-codex-backend-indicator]").forEach((indicator) => {
      indicator.dataset.status = status;
      indicator.title = status === "ok" ? "后端已连接" : status === "checking" ? "正在检查后端" : "未连接";
    });
    const sidebarStatus = document.querySelector(`#${codexPlusSidebarNavId} .codex-plus-sidebar-nav-status`);
    if (sidebarStatus) {
      sidebarStatus.dataset.status = status;
      sidebarStatus.title = status === "ok" ? "后端已连接" : status === "checking" ? "正在检查后端" : "未连接";
    }
    refreshCodexServiceTierControls();
  }

  function withBackendTimeout(request) {
    return Promise.race([
      request,
      new Promise((resolve) => setTimeout(() => resolve({ status: "failed", message: "后端检查超时", timeout: true }), 2000)),
    ]);
  }

  async function checkBackendStatus() {
    const seq = ++codexPlusBackendCheckSeq;
    const nextStatus = await withBackendTimeout(postJson("/backend/status", {}));
    if (seq !== codexPlusBackendCheckSeq) return;
    codexPlusBackendStatus = nextStatus;
    if (nextStatus?.status === "ok" && typeof nextStatus.hideOfficialUsageAlert === "boolean") {
      window.__CODEX_PLUS_HIDE_OFFICIAL_USAGE_ALERT__ = nextStatus.hideOfficialUsageAlert;
      refreshOfficialUsageAlertVisibility();
    }
    if (nextStatus?.status !== "ok") {
      sendCodexPlusDiagnostic("backend_check_failed", {
        status: nextStatus?.status || "unknown",
        message: nextStatus?.message || "",
        timeout: !!nextStatus?.timeout,
      });
    }
    renderBackendStatus();
  }

  async function openManagerFromCodex() {
    const result = await postJson("/manager/open", {});
    if (result.status === "ok") {
      showToast("管理工具已打开", null);
    } else {
      showToast(result.message || "打开管理工具失败", null);
    }
  }

  function scheduleBackendHeartbeat() {
    if (window.__codexPlusBackendHeartbeat) return;
    window.__codexPlusBackendHeartbeat = setInterval(checkBackendStatus, 5000);
    checkBackendStatus();
  }

  function userScriptStatusLabel(status) {
    return { loaded: "已加载", failed: "失败", disabled: "已禁用", not_loaded: "未加载", loading: "加载中" }[status] || status || "未知";
  }

  function renderUserScripts() {
    const enabledToggle = document.querySelector("[data-codex-user-scripts-enabled]");
    if (enabledToggle) enabledToggle.dataset.enabled = String(!!codexPlusUserScripts.enabled);
    const dirs = document.querySelector("[data-codex-user-script-dirs]");
    if (dirs) dirs.textContent = `内置：${codexPlusUserScripts.builtin_dir || "未找到"}  用户：${codexPlusUserScripts.user_dir || "未找到"}`;
    const list = document.querySelector("[data-codex-user-script-list]");
    if (!list) return;
    if (!codexPlusUserScripts.scripts?.length) {
      list.textContent = "未发现用户脚本。";
      return;
    }
    list.innerHTML = codexPlusUserScripts.scripts.map((script) => `
      <div class="codex-plus-user-script-item">
        <div>
          <div class="codex-plus-user-script-name">${escapeHtml(script.name || script.key)}</div>
          <div class="codex-plus-user-script-meta">${script.source === "builtin" ? "内置" : "用户"} · ${userScriptStatusLabel(script.status)}</div>
          ${script.error ? `<div class="codex-plus-user-script-error">${escapeHtml(script.error)}</div>` : ""}
        </div>
        <button type="button" class="codex-plus-toggle" data-codex-user-script-key="${escapeHtml(script.key)}" data-enabled="${String(!!script.enabled)}"><span></span></button>
      </div>
    `).join("");
  }

  async function loadUserScripts(path = "/user-scripts/list", payload = {}) {
    const requestPayload = path === "/user-scripts/list"
      ? { ...payload, runtime_status: window.__codexPlusUserScripts?.scripts || {} }
      : payload;
    const result = await postJson(path, requestPayload);
    if (result?.scripts) {
      codexPlusUserScripts = result;
      renderUserScripts();
    }
  }

  function normalizeCodexPlusAds(_payload) {
    return [];
  }


  function selectCodexPlusTab(tab) {
    document.querySelectorAll(".codex-plus-modal-content").forEach((modal) => {
      modal.dataset.codexPlusActiveTab = tab;
    });
    document.querySelectorAll("[data-codex-plus-tab]").forEach((button) => {
      button.dataset.active = String(button.getAttribute("data-codex-plus-tab") === tab);
    });
    document.querySelectorAll("[data-codex-plus-panel]").forEach((panel) => {
      panel.hidden = panel.getAttribute("data-codex-plus-panel") !== tab;
    });
    if (tab === "userScripts") loadUserScripts();
  }

  function setCodexPlusSidebarNavActive(active) {
    const nav = document.getElementById(codexPlusSidebarNavId);
    const button = nav?.querySelector("button");
    if (!button) return;
    button.dataset.active = String(active);
    button.setAttribute("aria-current", active ? "page" : "false");
  }

  function positionCodexPlusPage(overlay) {
    if (!overlay?.classList?.contains(codexPlusPageClass)) return;
    const sidebar = document.querySelector("aside.app-shell-left-panel");
    const rect = sidebar?.getBoundingClientRect?.();
    const left = rect && rect.width > 0 ? Math.max(0, rect.right) : 0;
    overlay.style.left = `${left}px`;
    overlay.style.top = "0px";
  }

  function codexPlusHostUsesLightTheme() {
    const root = document.documentElement;
    const body = document.body;
    const explicitTheme = [
      root?.getAttribute("data-theme"),
      body?.getAttribute("data-theme"),
      root?.getAttribute("data-color-scheme"),
      body?.getAttribute("data-color-scheme"),
    ].filter(Boolean).join(" ").toLowerCase();
    if (/\b(light|light-mode|theme-light)\b/.test(explicitTheme)) return true;
    if (/\b(dark|dark-mode|theme-dark)\b/.test(explicitTheme)) return false;

    const themeClasses = [root?.className, body?.className]
      .filter((value) => typeof value === "string")
      .join(" ")
      .toLowerCase();
    if (/(^|\s)(light|light-mode|theme-light)(\s|$)/.test(themeClasses)) return true;
    if (/(^|\s)(dark|dark-mode|theme-dark)(\s|$)/.test(themeClasses)) return false;

    return !window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  }

  function applyCodexPlusTheme(overlay) {
    if (!overlay?.style) return;
    const light = codexPlusHostUsesLightTheme();
    const palette = light ? {
      bgPrimary: "#ffffff",
      bgSecondary: "#f7f7f7",
      bgElevated: "#ffffff",
      bgHover: "rgba(0,0,0,.06)",
      bgSelected: "rgba(0,0,0,.08)",
      text: "#171717",
      textSecondary: "#5d5d5d",
      textTertiary: "#8a8a8a",
      border: "rgba(0,0,0,.12)",
      borderSubtle: "rgba(0,0,0,.08)",
    } : {
      bgPrimary: "#212121",
      bgSecondary: "#2f2f2f",
      bgElevated: "#2f2f2f",
      bgHover: "rgba(255,255,255,.08)",
      bgSelected: "rgba(255,255,255,.12)",
      text: "#f3f4f6",
      textSecondary: "#d1d5db",
      textTertiary: "#a1a1aa",
      border: "rgba(255,255,255,.14)",
      borderSubtle: "rgba(255,255,255,.08)",
    };
    const variables = {
      "--codex-plus-bg-primary": palette.bgPrimary,
      "--codex-plus-bg-secondary": palette.bgSecondary,
      "--codex-plus-bg-elevated": palette.bgElevated,
      "--codex-plus-bg-hover": palette.bgHover,
      "--codex-plus-bg-selected": palette.bgSelected,
      "--codex-plus-text": palette.text,
      "--codex-plus-text-secondary": palette.textSecondary,
      "--codex-plus-text-tertiary": palette.textTertiary,
      "--codex-plus-border": palette.border,
      "--codex-plus-border-subtle": palette.borderSubtle,
    };
    Object.entries(variables).forEach(([name, value]) => overlay.style.setProperty(name, value));
    overlay.dataset.codexPlusTheme = light ? "light" : "dark";
  }

  function openCodexPlusModal(options = {}) {
    const pageMode = options.page === true;
    document.querySelectorAll(".codex-plus-modal-overlay").forEach((node) => node.remove());
    document.querySelectorAll(`.${codexPlusPageClass}, [data-codex-plus-dialog="true"]`).forEach((node) => node.remove());
    const overlay = document.createElement("div");
    overlay.className = pageMode ? codexPlusPageClass : "codex-plus-modal-overlay";
    overlay.dataset.codexPlusPage = String(pageMode);
    applyCodexPlusTheme(overlay);
    overlay.innerHTML = `
      <div class="codex-plus-modal-content" role="dialog" aria-modal="true" aria-label="Codex++">
        <div class="codex-plus-modal-header">
          <div class="codex-plus-modal-title"><span class="codex-plus-backend-indicator" data-codex-backend-indicator="true" data-status="checking"></span><span data-codex-plus-version="true">Codex++ ${codexPlusVersion}</span></div>
          <button type="button" class="codex-plus-modal-close" aria-label="${pageMode ? "返回" : "关闭"}">${pageMode ? "返回" : "×"}</button>
        </div>
        <div class="codex-plus-tabs" role="tablist" aria-label="Codex++">
          <button type="button" class="codex-plus-tab-button" data-codex-plus-tab="home" data-active="true">主页</button>
          <button type="button" class="codex-plus-tab-button" data-codex-plus-tab="userScripts" data-active="false">用户脚本</button>
        </div>
        <div class="codex-plus-modal-body">
          <div class="codex-plus-panel" data-codex-plus-panel="home">
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">后端连接</div><div class="codex-plus-row-description">每 5 秒检查一次 launcher 后端状态。</div></div>
              <div class="codex-plus-backend-status">
                <div class="codex-plus-backend-label" data-codex-backend-status="true" data-status="checking">正在检查后端…</div>
              </div>
            </div>
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">Codex增强</div><div class="codex-plus-row-description">关闭后停用删除、导出、插件相关和菜单位置增强。</div></div>
              <button type="button" class="codex-plus-toggle" data-codex-backend-setting="enhancementsEnabled"><span></span></button>
            </div>
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">插件市场解锁</div><div class="codex-plus-row-description">${codexPlusBackendSettings.launchMode === "relay" ? "兼容增强模式下无需开启；ChatGPT 登录态会保留官方插件市场。" : "API Key 模式下扩展插件市场请求，尽量显示完整插件列表。"}</div></div>
              <button type="button" class="codex-plus-toggle" data-codex-plus-setting="pluginMarketplaceUnlock" ${codexPlusBackendSettings.launchMode === "relay" ? 'disabled data-relay-unneeded="true"' : ""}><span></span></button>
            </div>
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">模型白名单解锁</div><div class="codex-plus-row-description">从环境变量和 Codex config.toml 中的中转站 /v1/models 拉取模型，并补进模型选择列表。</div></div>
              <button type="button" class="codex-plus-toggle" data-codex-plus-setting="modelWhitelistUnlock"><span></span></button>
            </div>
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">Fast 按钮</div><div class="codex-plus-row-description">显示服务模式切换按钮；Fast 仅支持 ${codexServiceTierFastModelListLabel()}，其他模型按 Standard 发送。</div></div>
              <button type="button" class="codex-plus-toggle" data-codex-plus-setting="serviceTierControls"><span></span></button>
            </div>
            ${codexPlusIsWindowsPlatform ? `<div class="codex-plus-row">
              <div><div class="codex-plus-row-title">桌宠跟随真实鼠标</div><div class="codex-plus-row-description">仅支持 V2 桌宠；不会修改宠物文件。将 V2 的 Computer Use 光标朝向动作映射到真实鼠标，V1 开启后安全不生效；拖拽、原生悬停或 Computer Use 活跃时自动让步。</div></div>
              <button type="button" class="codex-plus-toggle" data-codex-plus-setting="petRealMouseLook"><span></span></button>
            </div>` : ""}
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">悬浮球 · Stepwise</div><div class="codex-plus-row-description">生成下一步建议。</div></div>
              <button type="button" class="codex-plus-toggle" data-codex-plus-setting="stepwise"><span></span></button>
            </div>
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">悬浮球 · 回答大纲</div><div class="codex-plus-row-description">整理回答结构。</div></div>
              <button type="button" class="codex-plus-toggle" data-codex-plus-setting="answerOutline"><span></span></button>
            </div>
            <div class="codex-plus-row" data-codex-service-tier-controls="true">
              <div><div class="codex-plus-row-title">服务模式</div><div class="codex-plus-row-description">继承优先读取 Codex 应用内设置，其次读取 config.toml 的 service_tier；全局模式覆盖全部 thread；自定义允许按 thread 覆盖。</div></div>
              <div class="codex-plus-service-tier-control">
                <div class="codex-plus-service-tier-status" data-codex-service-tier-status="true" data-status="loading">正在读取…</div>
                <div class="codex-plus-service-tier-actions">
                  <button type="button" class="codex-plus-service-tier-button" data-codex-service-tier-inherit="true">继承</button>
                  <button type="button" class="codex-plus-service-tier-button" data-codex-service-tier-standard="true">全局 Standard</button>
                  <button type="button" class="codex-plus-service-tier-button" data-codex-service-tier-fast="true">全局 Fast</button>
                  <button type="button" class="codex-plus-service-tier-button" data-codex-service-tier-custom="true">自定义</button>
                </div>
                <div class="codex-plus-service-tier-actions codex-plus-service-tier-thread-actions">
                  <span class="codex-plus-service-tier-thread-label">当前 thread 覆盖</span>
                  <button type="button" class="codex-plus-service-tier-button" data-codex-service-tier-thread-inherit="true" title="当前 thread 不单独覆盖，继承 Codex 默认设置">继承</button>
                  <button type="button" class="codex-plus-service-tier-button" data-codex-service-tier-thread-standard="true" title="仅当前 thread 使用 Standard，并切到自定义模式">Standard</button>
                  <button type="button" class="codex-plus-service-tier-button" data-codex-service-tier-thread-fast="true" title="仅当前 thread 使用 Fast，并切到自定义模式">Fast</button>
                </div>
              </div>
            </div>
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">会话删除</div><div class="codex-plus-row-description">在会话列表悬停显示删除按钮，并支持撤销。</div></div>
              <button type="button" class="codex-plus-toggle" data-codex-plus-setting="sessionDelete"><span></span></button>
            </div>
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">Markdown 导出</div><div class="codex-plus-row-description">在会话列表显示导出按钮，按本地 rollout 导出带时间戳的 Markdown。</div></div>
              <button type="button" class="codex-plus-toggle" data-codex-plus-setting="markdownExport"><span></span></button>
            </div>
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">粘贴修复</div><div class="codex-plus-row-description">从 Word 等富文本来源粘贴到 Codex composer 时只保留纯文本，避免被识别为图片/文件附件。需重启 Codex 才生效。</div></div>
              <button type="button" class="codex-plus-toggle" data-codex-plus-setting="pasteFix"><span></span></button>
            </div>
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">会话 ID 标识</div><div class="codex-plus-row-description">在侧边栏会话标题前显示短 ID 和 UUIDv7 创建时间，方便定位历史会话。</div></div>
              <button type="button" class="codex-plus-toggle" data-codex-plus-setting="threadIdBadge"><span></span></button>
            </div>
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">对话居中宽度</div><div class="codex-plus-row-description">开启后把主对话和输入框限制到固定最大宽度，适合大屏阅读。</div></div>
              <div class="codex-plus-width-control">
                <input class="codex-plus-width-input" data-codex-plus-conversation-view-width="true" min="${conversationViewMinWidth}" max="${conversationViewMaxAllowedWidth}" step="10" type="number" value="${conversationViewWidth()}">
                <button type="button" class="codex-plus-toggle" data-codex-plus-setting="conversationView"><span></span></button>
              </div>
            </div>
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">切换对话保留位置</div><div class="codex-plus-row-description">开启后在不同 thread 之间切换时恢复到上一次浏览位置，不再自动跳到底部。</div></div>
              <button type="button" class="codex-plus-toggle" data-codex-plus-setting="threadScrollRestore"><span></span></button>
            </div>
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">Zed Remote open</div><div class="codex-plus-row-description">Open supported remote SSH file references in Zed without patching Codex.app.</div></div>
              <button type="button" class="codex-plus-toggle" data-codex-plus-setting="zedRemoteOpen"><span></span></button>
            </div>
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">Upstream worktree</div><div class="codex-plus-row-description">Create a Git worktree from a fresh upstream branch, equivalent to git worktree add -b branch path upstream/base.</div></div>
              <div class="codex-plus-worktree-actions">
                <button type="button" class="codex-plus-action-button" data-codex-upstream-worktree-open="true">创建</button>
                <button type="button" class="codex-plus-toggle" data-codex-plus-setting="upstreamWorktreeCreate"><span></span></button>
              </div>
            </div>
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">历史会话修复</div><div class="codex-plus-row-description">切换官方登录、混合 API 或纯 API 后，让旧对话重新显示在当前模式下。</div></div>
              <button type="button" class="codex-plus-toggle" data-codex-backend-setting="providerSyncEnabled"><span></span></button>
            </div>
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">页面增强模式</div><div class="codex-plus-row-description">${codexPlusBackendSettings.launchMode === "relay" ? "兼容增强：保留会话删除、导出和用户脚本，仅关闭插件市场相关增强。" : "完整增强：加载插件市场、会话管理等全部页面能力。"}</div></div>
              <button type="button" class="codex-plus-action-button" data-codex-open-manager="true">打开管理工具</button>
            </div>
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">打开 DevTools</div><div class="codex-plus-row-description">打开当前 Codex 页面开发者工具，方便查看用户脚本报错。</div></div>
              <button type="button" class="codex-plus-action-button" data-codex-open-devtools="true">打开 DevTools</button>
            </div>
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">关于 Codex++</div><div class="codex-plus-about">Codex++ 是通过外部 launcher 注入的增强菜单，不修改 Codex App 原始安装文件。<br>Build: <span data-codex-plus-build="true">${codexPlusBuild}</span><br>GitHub: <a href="https://github.com/TttXxx36/Codex--" target="_blank" rel="noreferrer">https://github.com/TttXxx36/Codex--</a></div></div>
            </div>
            <div class="codex-plus-row">
              <div><div class="codex-plus-row-title">提出问题</div><div class="codex-plus-row-description">打开 GitHub Issues 反馈问题或建议。</div></div>
              <button type="button" class="codex-plus-issue-button" data-codex-plus-issue="true">提出问题</button>
            </div>
          </div>
          <div class="codex-plus-panel" data-codex-plus-panel="userScripts" hidden>
            <div class="codex-plus-row" data-codex-user-scripts-section="true">
              <div>
                <div class="codex-plus-row-title">用户脚本</div>
                <div class="codex-plus-row-description">启用用户脚本：自动加载内置目录和用户配置目录中的 .js 文件。</div>
                <div class="codex-plus-user-script-warning">禁用后需重载页面或重启 Codex++ 才能完全移除已执行效果。</div>
                <div class="codex-plus-user-script-dirs" data-codex-user-script-dirs="true">正在读取脚本目录…</div>
                <div class="codex-plus-user-script-list" data-codex-user-script-list="true">正在读取用户脚本…</div>
              </div>
              <div class="codex-plus-user-script-actions">
                <button type="button" class="codex-plus-toggle" data-codex-user-scripts-enabled="true"><span></span></button>
                <button type="button" class="codex-plus-user-script-reload" data-codex-user-scripts-reload="true">重新加载用户脚本</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    const closeButton = overlay.querySelector(".codex-plus-modal-close");
    closeButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      overlay.remove();
      if (pageMode) setCodexPlusSidebarNavActive(false);
    }, true);
    overlay.addEventListener("input", (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const widthInput = target?.closest("[data-codex-plus-conversation-view-width]");
      if (widthInput) setConversationViewWidth(widthInput.value);
    }, true);
    overlay.addEventListener("change", (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const widthInput = target?.closest("[data-codex-plus-conversation-view-width]");
      if (widthInput) {
        const width = normalizeConversationViewWidth(widthInput.value);
        widthInput.value = String(width || conversationViewWidth());
        setConversationViewWidth(widthInput.value);
      }
    }, true);
    overlay.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      if ((!pageMode && event.target === overlay) || target?.closest(".codex-plus-modal-close")) {
        overlay.remove();
        if (pageMode) setCodexPlusSidebarNavActive(false);
        return;
      }
      const tabButton = target?.closest("[data-codex-plus-tab]");
      if (tabButton) {
        selectCodexPlusTab(tabButton.getAttribute("data-codex-plus-tab"));
        return;
      }
      if (target?.closest("[data-codex-open-devtools]")) {
        postJson("/devtools/open", {});
        return;
      }
      if (target?.closest("[data-codex-open-manager]")) {
        openManagerFromCodex();
        return;
      }
      const issueButton = target?.closest("[data-codex-plus-issue]");
      if (issueButton) {
        const issueUrl = "https://github.com/TttXxx36/Codex--/issues";
        window.open(issueUrl, "_blank");
        return;
      }
      const userScriptsEnabled = target?.closest("[data-codex-user-scripts-enabled]");
      if (userScriptsEnabled) {
        loadUserScripts("/user-scripts/set-enabled", { enabled: userScriptsEnabled.dataset.enabled !== "true" });
        return;
      }
      if (target?.closest("[data-codex-service-tier-inherit]")) {
        setCodexServiceTierControlMode("inherit");
        return;
      }
      if (target?.closest("[data-codex-service-tier-standard]")) {
        setCodexServiceTierControlMode("global-standard");
        return;
      }
      if (target?.closest("[data-codex-service-tier-fast]")) {
        setCodexServiceTierControlMode("global-fast");
        return;
      }
      if (target?.closest("[data-codex-service-tier-custom]")) {
        setCodexServiceTierControlMode("custom");
        return;
      }
      if (target?.closest("[data-codex-service-tier-thread-inherit]")) {
        setCodexThreadServiceTierMode("inherit");
        return;
      }
      if (target?.closest("[data-codex-service-tier-thread-standard]")) {
        setCodexThreadServiceTierMode("standard");
        return;
      }
      if (target?.closest("[data-codex-service-tier-thread-fast]")) {
        setCodexThreadServiceTierMode("fast");
        return;
      }
      const userScriptToggle = target?.closest("[data-codex-user-script-key]");
      if (userScriptToggle) {
        loadUserScripts("/user-scripts/set-script-enabled", { key: userScriptToggle.getAttribute("data-codex-user-script-key"), enabled: userScriptToggle.dataset.enabled !== "true" });
        return;
      }
      if (target?.closest("[data-codex-user-scripts-reload]")) {
        loadUserScripts("/user-scripts/reload", {});
        return;
      }
      if (target?.closest("[data-codex-upstream-worktree-open]")) {
        if (!codexPlusSettings().upstreamWorktreeCreate) {
          showToast("Upstream worktree enhancement is disabled", null);
          return;
        }
        openUpstreamWorktreeDialog();
        return;
      }
      const toggle = target?.closest("[data-codex-plus-setting]");
      if (toggle) {
        if (toggle.disabled || toggle.dataset.pending === "true") return;
        const key = toggle.getAttribute("data-codex-plus-setting");
        setCodexPlusSetting(key, !codexPlusSettings()[key]);
        return;
      }
      const backendToggle = target?.closest("[data-codex-backend-setting]");
      if (backendToggle) {
        const key = backendToggle.getAttribute("data-codex-backend-setting");
        setBackendSetting(key, !codexPlusBackendSettings[key]);
        return;
      }
    }, true);
    document.body.appendChild(overlay);
    if (pageMode) {
      setCodexPlusSidebarNavActive(true);
      positionCodexPlusPage(overlay);
      if (!window.__codexPlusPageResizeHandler) {
        window.__codexPlusPageResizeHandler = () => positionCodexPlusPage(document.querySelector(`.${codexPlusPageClass}`));
        window.addEventListener("resize", window.__codexPlusPageResizeHandler);
      }
    }
    selectCodexPlusTab("home");
    renderCodexPlusMenu();
    refreshCodexPlusBackendToggles();
    renderBackendStatus();
    void loadCodexServiceTierState();
    loadUserScripts();
  }

  function openCodexPlusPage() {
    openCodexPlusModal({ page: true });
  }

  function closeCodexPlusPage() {
    document.querySelectorAll(`.${codexPlusPageClass}`).forEach((node) => node.remove());
    setCodexPlusSidebarNavActive(false);
  }

  function closeCodexPlusPageAfterNativeNavigation() {
    clearTimeout(window.__codexPlusPageNavigationCloseTimer);
    window.__codexPlusPageNavigationCloseTimer = setTimeout(() => {
      window.__codexPlusPageNavigationCloseTimer = null;
      closeCodexPlusPage();
    }, 0);
  }

  function installCodexPlusPageNavigationCloseHandler() {
    document.removeEventListener("click", window.__codexPlusPageNavigationCloseHandler, true);
    window.__codexPlusPageNavigationCloseHandler = (event) => {
      if (!document.querySelector(`.${codexPlusPageClass}`)) return;
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      if (!target?.closest(selectors.sidebarThread)) return;
      // Let Codex's own click handler update its route before removing our page.
      closeCodexPlusPageAfterNativeNavigation();
    };
    document.addEventListener("click", window.__codexPlusPageNavigationCloseHandler, true);
  }

  function installCodexPlusSidebarNavigation() {
    document.querySelectorAll(`#${codexPlusMenuId}, [data-codex-plus-menu="true"]`).forEach((node) => node.remove());
    const navigation = document.querySelector('aside.app-shell-left-panel nav[role="navigation"], nav[role="navigation"]');
    if (!navigation) return;
    const navButtons = Array.from(navigation.querySelectorAll("button"));
    const pluginButton = navButtons.find((button) => {
      if (button.querySelector(selectors.pluginSvgPath)) return true;
      const label = (button.getAttribute("aria-label") || button.textContent || "").trim();
      return /^(插件|Plugins)$/i.test(label);
    });
    const insertionButton = pluginButton || navButtons.find((button) => {
      const label = (button.getAttribute("aria-label") || button.textContent || "").replace(/\s+/g, " ").trim();
      return /^(已安排|Scheduled|拉取请求|Pull requests|新对话|New chat)$/i.test(label);
    });
    if (navigation.dataset.codexPlusSidebarNavigationListener !== "true") {
      navigation.dataset.codexPlusSidebarNavigationListener = "true";
      navigation.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : event.target?.parentElement;
        if (target?.closest(`#${codexPlusSidebarNavId}`)) return;
        if (target?.closest("button, a")) closeCodexPlusPageAfterNativeNavigation();
      }, true);
    }
    let wrapper = document.getElementById(codexPlusSidebarNavId);
    const parent = insertionButton?.parentElement || navigation;
    if (!wrapper || wrapper.parentElement !== parent) {
      wrapper?.remove();
      wrapper = document.createElement("div");
      wrapper.id = codexPlusSidebarNavId;
      wrapper.dataset.codexPlusSidebarNav = "true";
      const button = (insertionButton || document.createElement("button")).cloneNode(true);
      if (!(button instanceof HTMLElement)) return;
      if (!button.className) button.className = "h-token-nav-row w-full flex items-center gap-2 px-3 py-2 text-sm";
      button.type = "button";
      button.removeAttribute("data-state");
      button.removeAttribute("aria-current");
      button.removeAttribute("disabled");
      button.removeAttribute("aria-disabled");
      button.setAttribute("aria-label", "Codex++");
      button.textContent = "";
      button.innerHTML = `<span class="codex-plus-sidebar-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13"/></svg></span><span class="truncate">Codex++</span><span class="codex-plus-sidebar-nav-status" data-status="${codexPlusBackendStatus.status || "checking"}" aria-hidden="true"></span>`;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openCodexPlusPage();
      }, true);
      wrapper.appendChild(button);
      if (insertionButton?.nextSibling) {
        parent.insertBefore(wrapper, insertionButton.nextSibling);
      } else {
        parent.appendChild(wrapper);
      }
    }
    const status = wrapper.querySelector(".codex-plus-sidebar-nav-status");
    if (status) status.dataset.status = codexPlusBackendStatus.status || "checking";
    const active = !!document.querySelector(`.${codexPlusPageClass}`);
    setCodexPlusSidebarNavActive(active);
  }

  const codexPluginRemoteOnlyMarketplaceKinds = new Set(["created-by-me-remote", "shared-with-me"]);
