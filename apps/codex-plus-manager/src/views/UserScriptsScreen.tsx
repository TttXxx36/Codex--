import {
  Download,
  ExternalLink,
  LayoutGrid,
  List,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  Star,
} from "lucide-react";
import { memo, useMemo, useState } from "react";

import { UiBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { t, tf } from "@/i18n";
import { isGitHubRepositoryHomepage } from "../github-repository";
import { SCRIPT_MARKET_REPOSITORY_URL } from "../App";
import type {
  Actions,
  ScriptMarketItem,
  ScriptMarketResult,
  SettingsResult,
  UserScriptInventory,
} from "../App";
import { CardHead, Metric, Panel, Toolbar } from "./ScreenPrimitives";

export const UserScriptsScreen = memo(function UserScriptsScreen({ settings, market, actions }: { settings: SettingsResult | null; market: ScriptMarketResult | null; actions: Actions }) {
  const inventory = settings?.user_scripts;
  const scripts = inventory?.scripts ?? [];
  const marketScripts = market?.market.scripts ?? [];
  const [marketSearch, setMarketSearch] = useState("");
  const [marketView, setMarketView] = useState<"grid" | "list">("grid");
  const filteredMarketScripts = useMemo(() => {
    const query = marketSearch.trim().toLocaleLowerCase();
    if (!query) return marketScripts;
    return marketScripts.filter((script) => {
      const haystack = [
        script.name,
        script.author,
        script.description,
        script.version,
        script.homepage,
        ...script.tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return haystack.includes(query);
    });
  }, [marketSearch, marketScripts]);
  const installedCount = marketScripts.filter((script) => script.installed).length;
  return (
    <>
      <Panel>
        <CardHead title={t("脚本市场")} detail={tf("{0} 个市场脚本，已安装 {1} 个，本地整体 {2}", [marketScripts.length, installedCount, inventory?.enabled === false ? t("关闭") : t("开启")])} />
        <CardContent>
          <div className="metric-list">
            <Metric label={t("市场状态")} value={market?.market.message ?? t("尚未刷新")} />
            <Metric label={t("远程脚本")} value={tf("{0} 个", [marketScripts.length])} />
            <Metric label={t("已安装")} value={tf("{0} 个", [installedCount])} />
            <Metric label={t("本地整体")} value={inventory?.enabled === false ? t("关闭") : t("开启")} />
          </div>
          <Toolbar>
            <Button onClick={() => void actions.refreshScriptMarket()}>
              <RefreshCw className="h-4 w-4" />
              {t("刷新市场")}
            </Button>
            <Button onClick={() => void actions.openExternalUrl(SCRIPT_MARKET_REPOSITORY_URL)} variant="secondary">
              <ExternalLink className="h-4 w-4" />
              {t("投稿")}
            </Button>
            <Button onClick={() => void actions.refreshCurrent()} variant="secondary">
              <RefreshCw className="h-4 w-4" />
              {t("刷新本地")}
            </Button>
          </Toolbar>
        </CardContent>
      </Panel>
      <Panel>
        <CardHead
          title={t("市场脚本")}
          detail={
            market?.market.updatedAt
              ? tf("清单更新时间：{0}，当前显示 {1} / {2}", [market.market.updatedAt, filteredMarketScripts.length, marketScripts.length])
              : t("从 GitHub 静态清单加载")
          }
        />
        <CardContent>
          <div className="script-market-toolbar">
            <div className="script-market-search">
              <Search className="h-4 w-4" />
              <Input
                aria-label={t("搜索市场脚本")}
                onChange={(event) => setMarketSearch(event.currentTarget.value)}
                placeholder={t("搜索名称、作者、描述或标签")}
                value={marketSearch}
              />
            </div>
            <div className="script-market-view-toggle" role="group" aria-label={t("脚本市场排版")}>
              <Button
                aria-pressed={marketView === "grid"}
                onClick={() => setMarketView("grid")}
                size="sm"
                variant={marketView === "grid" ? "secondary" : "ghost"}
              >
                <LayoutGrid className="h-4 w-4" />
                {t("板块")}
              </Button>
              <Button
                aria-pressed={marketView === "list"}
                onClick={() => setMarketView("list")}
                size="sm"
                variant={marketView === "list" ? "secondary" : "ghost"}
              >
                <List className="h-4 w-4" />
                {t("列表")}
              </Button>
            </div>
          </div>
          {marketScripts.length ? (
            filteredMarketScripts.length ? (
              <div className={marketView === "list" ? "script-market-list" : "script-market-grid"}>
                {filteredMarketScripts.map((script) => (
                  <MarketScriptCard key={script.id} script={script} actions={actions} view={marketView} />
                ))}
              </div>
            ) : (
              <div className="empty">{t("没有匹配的市场脚本。")}</div>
            )
          ) : (
            <div className="empty">{market?.status === "failed" ? market.message : t("点击刷新市场加载远程脚本。")}</div>
          )}
        </CardContent>
      </Panel>
      <Panel>
        <CardHead title={t("本地脚本")} detail={t("内置、手动和市场安装脚本；可在这里启停或删除用户脚本")} />
        <CardContent>
          <div className="table">
            {scripts.length ? scripts.map((script) => <ScriptRow key={script.key} script={script} actions={actions} />) : <div className="empty">{t("未发现用户脚本。")}</div>}
          </div>
        </CardContent>
      </Panel>
    </>
  );
});

function MarketScriptCard({ script, actions, view = "grid" }: { script: ScriptMarketItem; actions: Actions; view?: "grid" | "list" }) {
  const status = script.updateAvailable ? t("可更新") : script.installed ? tf("已安装 {0}", [script.installedVersion]) : t("未安装");
  const isGitHubHomepage = script.homepage ? isGitHubRepositoryHomepage(script.homepage) : false;
  const githubSupportLabel = isGitHubHomepage ? tf("在 GitHub 上支持作者：{0}", [script.name]) : undefined;
  return (
    <div className="script-market-card" data-view={view}>
      <div className="script-market-title">
        <div>
          <strong>{script.name}</strong>
          <span>{script.author || t("未知作者")}</span>
        </div>
        <UiBadge variant={script.updateAvailable ? "default" : script.installed ? "secondary" : "outline"}>{status}</UiBadge>
      </div>
      <p className="script-market-description">{script.description || t("暂无描述。")}</p>
      <div className="script-market-tags">
        <span className="script-market-tag">v{script.version}</span>
        {script.tags.map((tag) => (
          <span className="script-market-tag" key={tag}>{tag}</span>
        ))}
      </div>
      <div className="script-market-actions">
        <Button onClick={() => void actions.installMarketScript(script.id)} size="sm">
          <Download className="h-4 w-4" />
          {script.updateAvailable ? t("更新") : script.installed ? t("重新安装") : t("安装")}
        </Button>
        {script.homepage ? (
          <Button
            aria-label={githubSupportLabel}
            onClick={() => void actions.openExternalUrl(script.homepage)}
            size="sm"
            title={githubSupportLabel}
            variant="secondary"
          >
            {isGitHubHomepage ? (
              <>
                <Star className="h-4 w-4" />
                Star
                <ExternalLink className="h-3 w-3" />
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4" />
                {t("主页")}
              </>
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ScriptRow({ script, actions }: { script: NonNullable<UserScriptInventory["scripts"]>[number]; actions: Actions }) {
  const source = script.market_id ? tf("市场 · {0}", [script.version || t("未知版本")]) : script.source === "builtin" ? t("内置") : t("用户");
  const canDelete = script.source === "user";
  return (
    <div className="table-row">
      <span>{script.name}</span>
      <span>{source}</span>
      <span>{script.enabled ? t("启用") : t("关闭")}</span>
      <span>{script.status}</span>
      <div className="script-row-actions">
        <Button onClick={() => void actions.setUserScriptEnabled(script.key, !script.enabled)} size="sm" variant="secondary">
          {script.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
          {script.enabled ? t("禁用") : t("启用")}
        </Button>
        {canDelete ? (
          <Button onClick={() => void actions.deleteUserScript(script.key)} size="sm" variant="outline">
            <Trash2 className="h-4 w-4" />
            {t("删除")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
export default UserScriptsScreen;
