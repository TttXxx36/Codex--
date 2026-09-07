use anyhow::Context;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::user_scripts::UserScriptManager;

pub const DEFAULT_MARKET_INDEX_URL: &str =
    "https://raw.githubusercontent.com/BigPizzaV3/CodexPlusPlusScriptMarket/main/index.json";
pub const MAX_SCRIPT_DOWNLOAD_BYTES: usize = 5 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ScriptMarketManifest {
    pub version: u64,
    pub updated_at: Option<String>,
    pub scripts: Vec<MarketScript>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MarketScript {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub version: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub homepage: String,
    pub script_url: String,
    #[serde(default)]
    pub sha256: String,
}

pub fn parse_market_manifest(raw: Value) -> anyhow::Result<ScriptMarketManifest> {
    let version = raw.get("version").and_then(Value::as_u64).unwrap_or(1);
    let updated_at = raw
        .get("updated_at")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let scripts = raw
        .get("scripts")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(parse_market_script)
        .collect();

    Ok(ScriptMarketManifest {
        version,
        updated_at,
        scripts,
    })
}

pub async fn fetch_market_manifest(url: &str) -> anyhow::Result<ScriptMarketManifest> {
    let raw = reqwest::get(url)
        .await
        .with_context(|| format!("failed to request script market index {url}"))?
        .error_for_status()
        .with_context(|| format!("script market index returned an error status {url}"))?
        .json::<Value>()
        .await
        .context("failed to decode script market index JSON")?;
    parse_market_manifest(raw)
}

pub async fn download_script(url: &str) -> anyhow::Result<Vec<u8>> {
    let url = validate_script_url(url)?;
    let response = script_http_client()?
        .get(url.clone())
        .send()
        .await
        .with_context(|| format!("failed to request script {url}"))?
        .error_for_status()
        .with_context(|| format!("script download returned an error status {url}"))?;
    if !response.status().is_success() {
        anyhow::bail!("脚本下载未返回成功状态：{}", response.status());
    }
    if response.url().scheme() != "https" {
        anyhow::bail!("脚本下载只允许使用 HTTPS");
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_SCRIPT_DOWNLOAD_BYTES as u64)
    {
        anyhow::bail!(
            "脚本下载超过 {} MiB 大小上限",
            MAX_SCRIPT_DOWNLOAD_BYTES / (1024 * 1024)
        );
    }

    let mut content = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.context("failed to read script download body")?;
        if content.len().saturating_add(chunk.len()) > MAX_SCRIPT_DOWNLOAD_BYTES {
            anyhow::bail!(
                "脚本下载超过 {} MiB 大小上限",
                MAX_SCRIPT_DOWNLOAD_BYTES / (1024 * 1024)
            );
        }
        content.extend_from_slice(&chunk);
    }
    Ok(content)
}

pub fn install_market_script_content(
    manager: &UserScriptManager,
    script: &MarketScript,
    content: &[u8],
) -> anyhow::Result<()> {
    if !script.sha256.trim().is_empty() {
        let actual = format!("{:x}", Sha256::digest(content));
        if !actual.eq_ignore_ascii_case(script.sha256.trim()) {
            anyhow::bail!("脚本 SHA-256 校验失败：{}", script.id);
        }
    }
    let path = manager.user_script_path_for_market_id(&script.id);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).with_context(|| {
            format!(
                "failed to create user script directory {}",
                parent.display()
            )
        })?;
    }
    crate::settings::atomic_write(&path, content)
        .with_context(|| format!("failed to write script {}", path.display()))?;
    manager.record_market_install(script)?;
    Ok(())
}

fn validate_script_url(url: &str) -> anyhow::Result<reqwest::Url> {
    let parsed = reqwest::Url::parse(url.trim()).context("脚本 URL 格式无效")?;
    if parsed.scheme() != "https" {
        anyhow::bail!("脚本下载只允许使用 HTTPS");
    }
    Ok(parsed)
}

fn script_http_client() -> anyhow::Result<reqwest::Client> {
    Ok(reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.url().scheme() == "https" {
                attempt.follow()
            } else {
                attempt.stop()
            }
        }))
        .build()?)
}

pub async fn install_market_script(
    manager: &UserScriptManager,
    script: &MarketScript,
) -> anyhow::Result<()> {
    let content = download_script(&script.script_url).await?;
    install_market_script_content(manager, script, &content)
}

fn parse_market_script(raw: Value) -> Option<MarketScript> {
    let id = required_string(&raw, "id")?;
    let name = required_string(&raw, "name")?;
    let version = required_string(&raw, "version")?;
    let script_url = required_string(&raw, "script_url")?;
    Some(MarketScript {
        id,
        name,
        description: optional_string(&raw, "description"),
        version,
        author: optional_string(&raw, "author"),
        tags: raw
            .get("tags")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(ToOwned::to_owned)
                    .collect()
            })
            .unwrap_or_default(),
        homepage: optional_string(&raw, "homepage"),
        script_url,
        sha256: optional_string(&raw, "sha256"),
    })
}

fn required_string(raw: &Value, key: &str) -> Option<String> {
    raw.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn optional_string(raw: &Value, key: &str) -> String {
    raw.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or_default()
        .to_string()
}
