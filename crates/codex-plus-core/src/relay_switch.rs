use std::fmt;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::Context;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::relay_config::{
    backfill_relay_profile_from_home_with_common, relay_config_status_from_home,
};
use crate::settings::{BackendSettings, RelayMode, SettingsStore};

const SWITCH_BACKUPS_DIR: &str = "switch_backups";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandActionResult<T = ()> {
    pub ok: bool,
    pub code: Option<String>,
    pub message: Option<String>,
    pub undo_token: Option<String>,
    pub recovery: Option<String>,
    pub data: Option<T>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SwitchFileSnapshot {
    pub exists: bool,
    pub contents: Option<Vec<u8>>,
    pub sha256: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SwitchFileFingerprint {
    pub exists: bool,
    pub sha256: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SwitchTransactionFingerprints {
    pub settings: SwitchFileFingerprint,
    pub config: SwitchFileFingerprint,
    pub auth: SwitchFileFingerprint,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SwitchTransactionSnapshot {
    pub token: String,
    pub created_at_ms: u64,
    pub source_profile_name: String,
    pub target_profile_name: String,
    pub settings: SwitchFileSnapshot,
    pub config: SwitchFileSnapshot,
    pub auth: SwitchFileSnapshot,
    #[serde(default)]
    pub after: Option<SwitchTransactionFingerprints>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchUndoInfo {
    pub token: String,
    pub created_at_ms: u64,
    pub source_profile_name: String,
    pub target_profile_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RelaySwitchResult {
    pub settings: BackendSettings,
    pub configured: bool,
    pub backup_path: Option<String>,
    pub undo_token: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RelaySwitchError {
    pub code: String,
    pub message: String,
    pub undo_token: Option<String>,
    pub recovery: Option<String>,
}

impl RelaySwitchError {
    fn new(
        code: impl Into<String>,
        message: impl Into<String>,
        undo_token: Option<String>,
        recovery: Option<String>,
    ) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            undo_token,
            recovery,
        }
    }
}

impl fmt::Display for RelaySwitchError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for RelaySwitchError {}

pub fn default_switch_backup_dir() -> PathBuf {
    crate::paths::default_app_state_dir().join(SWITCH_BACKUPS_DIR)
}

pub fn switch_relay_profile_in_home(
    store: &SettingsStore,
    home: &Path,
    next_settings: BackendSettings,
    previous_active_relay_id: &str,
) -> Result<RelaySwitchResult, RelaySwitchError> {
    switch_relay_profile_in_home_with_backup_dir(
        store,
        home,
        next_settings,
        previous_active_relay_id,
        &default_switch_backup_dir(),
    )
}

pub fn switch_relay_profile_in_home_with_backup_dir(
    store: &SettingsStore,
    home: &Path,
    next_settings: BackendSettings,
    previous_active_relay_id: &str,
    backup_dir: &Path,
) -> Result<RelaySwitchResult, RelaySwitchError> {
    let mut selected_settings = next_settings;
    if !selected_settings.relay_profiles_enabled {
        return Err(RelaySwitchError::new(
            "switch_disabled",
            "供应商配置总开关已关闭，未写入 config.toml / auth.json。",
            None,
            None,
        ));
    }

    let original_settings = store.load().map_err(|error| {
        RelaySwitchError::new(
            "settings_read_failed",
            format!("读取供应商设置失败：{error}"),
            None,
            Some("请检查 settings.json 是否可读后重试。".to_string()),
        )
    })?;
    let token = Uuid::new_v4().to_string();
    let mut snapshot = SwitchTransactionSnapshot::capture(
        &token,
        profile_display_name(&original_settings, &original_settings.active_relay_id),
        profile_display_name(&selected_settings, &selected_settings.active_relay_id),
        store,
        home,
    )
    .map_err(|error| {
        RelaySwitchError::new(
            "snapshot_capture_failed",
            format!("读取切换前配置快照失败：{error}"),
            None,
            Some("请检查 settings.json、config.toml 和 auth.json 是否可读。".to_string()),
        )
    })?;
    snapshot.persist(backup_dir).map_err(|error| {
        RelaySwitchError::new(
            "snapshot_persist_failed",
            format!("保存供应商切换快照失败：{error}"),
            None,
            Some("未执行切换；请检查本地备份目录是否可写后重试。".to_string()),
        )
    })?;

    crate::codex_app_state::capture_app_state_snapshot_nonfatal(home, "relay_switch.before");

    if !previous_active_relay_id.trim().is_empty()
        && previous_active_relay_id != selected_settings.active_relay_id
        && let Err(error) =
            backfill_profile_before_switch(home, &mut selected_settings, previous_active_relay_id)
    {
        let _ = snapshot.remove(backup_dir);
        return Err(RelaySwitchError::new(
            "switch_validation_failed",
            format!("切换前回填当前供应商配置失败：{error}"),
            None,
            None,
        ));
    }

    if let Err(error) = store.save(&selected_settings) {
        let _ = snapshot.remove(backup_dir);
        return Err(RelaySwitchError::new(
            "settings_write_failed",
            format!("保存供应商设置失败：{error}"),
            None,
            Some("未执行 live 配置写入；请检查 settings.json 后重试。".to_string()),
        ));
    }
    let selected_settings = match store.load() {
        Ok(settings) => settings,
        Err(error) => {
            return Err(fail_after_mutation(
                &snapshot,
                store,
                home,
                backup_dir,
                &token,
                "settings_read_failed",
                format!("读取已保存的供应商设置失败：{error}"),
            ));
        }
    };

    match apply_selected_relay_profile(home, &selected_settings) {
        Ok(mut result) => {
            snapshot.after = Some(
                SwitchTransactionFingerprints::capture(store, home).map_err(|error| {
                    fail_after_mutation(
                        &snapshot,
                        store,
                        home,
                        backup_dir,
                        &token,
                        "snapshot_capture_failed",
                        format!("读取切换后配置指纹失败：{error}"),
                    )
                })?,
            );
            if let Err(error) = snapshot.persist(backup_dir) {
                return Err(fail_after_mutation(
                    &snapshot,
                    store,
                    home,
                    backup_dir,
                    &token,
                    "snapshot_persist_failed",
                    format!("保存切换后配置指纹失败：{error}"),
                ));
            }
            let _ = prune_other_snapshots(backup_dir, &token);
            result.undo_token = Some(token);
            crate::codex_app_state::sync_app_state_after_provider_switch_nonfatal(
                home,
                "relay_switch.after",
            );
            Ok(result)
        }
        Err(error) => Err(fail_after_mutation(
            &snapshot,
            store,
            home,
            backup_dir,
            &token,
            "switch_failed",
            error,
        )),
    }
}

pub fn restore_last_switch(token: &str) -> Result<RelaySwitchResult, RelaySwitchError> {
    let store = SettingsStore::default();
    let home = crate::relay_config::default_codex_home_dir();
    restore_last_switch_in_home(&store, &home, &default_switch_backup_dir(), token)
}

pub fn restore_last_switch_in_home(
    store: &SettingsStore,
    home: &Path,
    backup_dir: &Path,
    token: &str,
) -> Result<RelaySwitchResult, RelaySwitchError> {
    let path = snapshot_path(backup_dir, token).map_err(|error| {
        RelaySwitchError::new(
            "invalid_undo_token",
            error.to_string(),
            Some(token.to_string()),
            None,
        )
    })?;
    if !path.exists() {
        return Err(RelaySwitchError::new(
            "undo_token_not_found",
            "撤销凭证不存在或已过期。",
            Some(token.to_string()),
            Some("请检查是否已在其他管理器窗口完成撤销；否则需要手动检查配置文件。".to_string()),
        ));
    }
    let snapshot = load_snapshot(&path).map_err(|error| {
        RelaySwitchError::new(
            "snapshot_corrupt",
            format!("读取供应商切换快照失败：{error}"),
            Some(token.to_string()),
            Some("请保留当前配置文件，并根据 recovery 建议手动核对。".to_string()),
        )
    })?;
    if snapshot.token != token {
        return Err(RelaySwitchError::new(
            "snapshot_corrupt",
            "撤销快照 token 与请求不一致，已拒绝恢复。",
            Some(token.to_string()),
            Some("请保留当前配置文件并手动核对本地恢复快照。".to_string()),
        ));
    }
    if let Err(error) = snapshot.verify_integrity() {
        return Err(RelaySwitchError::new(
            "snapshot_corrupt",
            format!("撤销快照校验失败：{error}"),
            Some(token.to_string()),
            Some("请保留当前配置文件并手动核对本地恢复快照。".to_string()),
        ));
    }
    if snapshot.after.is_none() {
        return Err(RelaySwitchError::new(
            "recovery_required",
            "该切换没有完整的切换后指纹，无法安全自动撤销。",
            Some(token.to_string()),
            Some("请不要覆盖当前配置；手动比较 settings.json、config.toml 和 auth.json 后恢复。".to_string()),
        ));
    }

    let after = snapshot.after.as_ref().expect("checked above");
    if let Err(error) = after.verify_current(store, home) {
        return Err(RelaySwitchError::new(
            "restore_conflict",
            format!("撤销被拒绝：{error}"),
            Some(token.to_string()),
            Some("请先检查并保存外部修改；确认无误后再手动恢复切换前的配置。".to_string()),
        ));
    }
    if let Err(error) = restore_snapshot_files(store, home, &snapshot) {
        return Err(RelaySwitchError::new(
            "recovery_required",
            format!("撤销写入失败：{error}"),
            Some(token.to_string()),
            Some("请保留当前文件并手动核对三个配置文件；不要重复覆盖未知的外部修改。".to_string()),
        ));
    }
    if let Err(error) = snapshot.remove(backup_dir) {
        return Err(RelaySwitchError::new(
            "recovery_required",
            format!("配置已恢复，但撤销快照清理失败：{error}"),
            Some(token.to_string()),
            Some("请确认文件已恢复后删除对应的 switch_backups 快照。".to_string()),
        ));
    }

    let settings = store.load().map_err(|error| {
        RelaySwitchError::new(
            "restore_result_read_failed",
            format!("撤销后读取 settings.json 失败：{error}"),
            None,
            Some("请检查恢复后的 settings.json 是否可读。".to_string()),
        )
    })?;
    let status = relay_config_status_from_home(home);
    Ok(RelaySwitchResult {
        settings,
        configured: status.configured,
        backup_path: None,
        undo_token: None,
    })
}

pub fn load_last_switch_undo() -> anyhow::Result<Option<SwitchUndoInfo>> {
    load_last_switch_undo_in_dir(&default_switch_backup_dir())
}

pub fn load_last_switch_undo_in_dir(backup_dir: &Path) -> anyhow::Result<Option<SwitchUndoInfo>> {
    let Some(snapshot) = load_latest_snapshot(backup_dir)? else {
        return Ok(None);
    };
    snapshot.verify_integrity()?;
    Ok(Some(SwitchUndoInfo {
        token: snapshot.token,
        created_at_ms: snapshot.created_at_ms,
        source_profile_name: snapshot.source_profile_name,
        target_profile_name: snapshot.target_profile_name,
    }))
}

impl SwitchFileSnapshot {
    fn capture(path: &Path) -> anyhow::Result<Self> {
        let contents = match fs::read(path) {
            Ok(contents) => Some(contents),
            Err(error) if error.kind() == ErrorKind::NotFound => None,
            Err(error) => return Err(error.into()),
        };
        Ok(Self::from_contents(contents))
    }

    fn from_contents(contents: Option<Vec<u8>>) -> Self {
        let sha256 = contents.as_deref().map(sha256_hex);
        Self {
            exists: contents.is_some(),
            contents,
            sha256,
        }
    }

    fn fingerprint(&self) -> SwitchFileFingerprint {
        SwitchFileFingerprint {
            exists: self.exists,
            sha256: self.sha256.clone(),
        }
    }
}

impl SwitchTransactionSnapshot {
    fn capture(
        token: &str,
        source_profile_name: String,
        target_profile_name: String,
        store: &SettingsStore,
        home: &Path,
    ) -> anyhow::Result<Self> {
        Ok(Self {
            token: token.to_string(),
            created_at_ms: now_ms(),
            source_profile_name,
            target_profile_name,
            settings: SwitchFileSnapshot::capture(store.path())?,
            config: SwitchFileSnapshot::capture(&home.join("config.toml"))?,
            auth: SwitchFileSnapshot::capture(&home.join("auth.json"))?,
            after: None,
        })
    }

    fn persist(&self, backup_dir: &Path) -> anyhow::Result<()> {
        let bytes = serde_json::to_vec_pretty(self)?;
        let path = snapshot_path(backup_dir, &self.token)?;
        crate::settings::atomic_write(&path, &bytes)
    }

    fn remove(&self, backup_dir: &Path) -> anyhow::Result<()> {
        let path = snapshot_path(backup_dir, &self.token)?;
        match fs::remove_file(path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error.into()),
        }
    }

    fn verify_integrity(&self) -> anyhow::Result<()> {
        self.settings.verify_integrity("settings.json")?;
        self.config.verify_integrity("config.toml")?;
        self.auth.verify_integrity("auth.json")?;
        Ok(())
    }
}

impl SwitchFileSnapshot {
    fn verify_integrity(&self, name: &str) -> anyhow::Result<()> {
        if self.exists != self.contents.is_some() {
            anyhow::bail!("{name} 快照存在标志与内容不一致");
        }
        let actual = self.contents.as_deref().map(sha256_hex);
        if actual != self.sha256 {
            anyhow::bail!("{name} 快照 SHA-256 不一致");
        }
        Ok(())
    }
}

impl SwitchTransactionFingerprints {
    fn capture(store: &SettingsStore, home: &Path) -> anyhow::Result<Self> {
        Ok(Self {
            settings: SwitchFileSnapshot::capture(store.path())?.fingerprint(),
            config: SwitchFileSnapshot::capture(&home.join("config.toml"))?.fingerprint(),
            auth: SwitchFileSnapshot::capture(&home.join("auth.json"))?.fingerprint(),
        })
    }

    fn verify_current(&self, store: &SettingsStore, home: &Path) -> anyhow::Result<()> {
        let current = Self::capture(store, home)?;
        verify_fingerprint("settings.json", &self.settings, &current.settings)?;
        verify_fingerprint("config.toml", &self.config, &current.config)?;
        verify_fingerprint("auth.json", &self.auth, &current.auth)?;
        Ok(())
    }
}

fn verify_fingerprint(
    name: &str,
    expected: &SwitchFileFingerprint,
    actual: &SwitchFileFingerprint,
) -> anyhow::Result<()> {
    if expected != actual {
        anyhow::bail!("{name} 当前指纹与切换后指纹不一致，检测到外部修改。");
    }
    Ok(())
}

fn restore_snapshot_files(
    store: &SettingsStore,
    home: &Path,
    snapshot: &SwitchTransactionSnapshot,
) -> anyhow::Result<()> {
    let current = SwitchTransactionSnapshot {
        token: String::new(),
        created_at_ms: 0,
        source_profile_name: String::new(),
        target_profile_name: String::new(),
        settings: SwitchFileSnapshot::capture(store.path())?,
        config: SwitchFileSnapshot::capture(&home.join("config.toml"))?,
        auth: SwitchFileSnapshot::capture(&home.join("auth.json"))?,
        after: None,
    };
    if let Err(error) = restore_snapshot_files_unchecked(store, home, snapshot) {
        let rollback_error = restore_snapshot_files_unchecked(store, home, &current).err();
        return match rollback_error {
            Some(rollback_error) => Err(anyhow::anyhow!(
                "恢复切换前配置失败：{error}；回滚恢复写入也失败：{rollback_error}"
            )),
            None => Err(error),
        };
    }
    Ok(())
}

fn restore_snapshot_files_unchecked(
    store: &SettingsStore,
    home: &Path,
    snapshot: &SwitchTransactionSnapshot,
) -> anyhow::Result<()> {
    restore_optional_file(store.path(), snapshot.settings.contents.as_deref())
        .context("恢复 settings.json 失败")?;
    restore_optional_file(&home.join("config.toml"), snapshot.config.contents.as_deref())
        .context("恢复 config.toml 失败")?;
    restore_optional_file(&home.join("auth.json"), snapshot.auth.contents.as_deref())
        .context("恢复 auth.json 失败")?;
    Ok(())
}

fn fail_after_mutation(
    snapshot: &SwitchTransactionSnapshot,
    store: &SettingsStore,
    home: &Path,
    backup_dir: &Path,
    token: &str,
    code: &str,
    operation_error: impl fmt::Display,
) -> RelaySwitchError {
    let operation_error = operation_error.to_string();
    match restore_snapshot_files(store, home, snapshot) {
        Ok(()) => {
            let _ = snapshot.remove(backup_dir);
            RelaySwitchError::new(
                code,
                format!("供应商切换失败：{operation_error}"),
                None,
                None,
            )
        }
        Err(rollback_error) => RelaySwitchError::new(
            "recovery_required",
            format!(
                "供应商切换失败：{operation_error}；同时回滚配置失败：{rollback_error}"
            ),
            Some(token.to_string()),
            Some("请保留当前文件，手动比较 settings.json、config.toml 和 auth.json 后恢复。".to_string()),
        ),
    }
}

fn snapshot_path(backup_dir: &Path, token: &str) -> anyhow::Result<PathBuf> {
    let parsed = Uuid::parse_str(token).context("撤销凭证格式无效")?;
    Ok(backup_dir.join(format!("{parsed}.json")))
}

fn load_snapshot(path: &Path) -> anyhow::Result<SwitchTransactionSnapshot> {
    let bytes = fs::read(path)?;
    Ok(serde_json::from_slice(&bytes)?)
}

fn load_latest_snapshot(
    backup_dir: &Path,
) -> anyhow::Result<Option<SwitchTransactionSnapshot>> {
    let entries = match fs::read_dir(backup_dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    let mut latest: Option<SwitchTransactionSnapshot> = None;
    for entry in entries {
        let path = entry?.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let snapshot = load_snapshot(&path)?;
        if latest
            .as_ref()
            .map(|current| snapshot.created_at_ms > current.created_at_ms)
            .unwrap_or(true)
        {
            latest = Some(snapshot);
        }
    }
    Ok(latest)
}

fn prune_other_snapshots(backup_dir: &Path, keep_token: &str) -> anyhow::Result<()> {
    let entries = match fs::read_dir(backup_dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.into()),
    };
    for entry in entries {
        let path = entry?.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        if path.file_stem().and_then(|value| value.to_str()) != Some(keep_token) {
            fs::remove_file(path)?;
        }
    }
    Ok(())
}

fn profile_display_name(settings: &BackendSettings, id: &str) -> String {
    let profile = settings.relay_profiles.iter().find(|profile| profile.id == id);
    profile
        .map(|profile| {
            if profile.name.trim().is_empty() {
                profile.id.clone()
            } else {
                profile.name.clone()
            }
        })
        .filter(|name| !name.trim().is_empty())
        .unwrap_or_else(|| id.to_string())
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn restore_optional_file(path: &Path, contents: Option<&[u8]>) -> anyhow::Result<()> {
    match contents {
        Some(contents) => crate::settings::atomic_write(path, contents).map_err(Into::into),
        None => match fs::remove_file(path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error.into()),
        },
    }
}

fn backfill_profile_before_switch(
    home: &Path,
    settings: &mut BackendSettings,
    previous_active_relay_id: &str,
) -> anyhow::Result<()> {
    let profile = settings
        .relay_profiles
        .iter_mut()
        .find(|profile| profile.id == previous_active_relay_id)
        .with_context(|| "当前供应商已不在配置列表中，已停止切换以避免覆盖用户改动。")?;
    backfill_relay_profile_from_home_with_common(
        home,
        profile,
        &mut settings.relay_context_config_contents,
    )
    .with_context(|| "回填当前供应商配置失败")
}

fn apply_selected_relay_profile(
    home: &Path,
    settings: &BackendSettings,
) -> anyhow::Result<RelaySwitchResult> {
    let relay = settings.active_relay_profile();
    let common_config = relay_combined_common_config(settings);
    let result = if relay.relay_mode == RelayMode::Official && !relay.official_mix_api_key {
        let auth_contents =
            (!relay.auth_contents.trim().is_empty()).then_some(relay.auth_contents.as_str());
        crate::relay_config::clear_relay_config_to_home_with_auth(home, auth_contents)?
    } else {
        validate_switch_profile_files(&relay)?;
        crate::relay_config::apply_relay_profile_to_home_with_switch_rules(
            home,
            &relay,
            &common_config,
        )?
    };
    let status = relay_config_status_from_home(home);
    if relay.relay_mode == RelayMode::PureApi && !status.configured {
        anyhow::bail!(
            "纯 API 配置写入后未检测到完整 custom provider，请检查 config.toml 和供应商 API Key。"
        );
    }
    Ok(RelaySwitchResult {
        settings: settings.clone(),
        configured: status.configured,
        backup_path: result.backup_path,
        undo_token: None,
    })
}

fn validate_switch_profile_files(profile: &crate::settings::RelayProfile) -> anyhow::Result<()> {
    if profile.relay_mode != RelayMode::Aggregate && profile.config_contents.trim().is_empty() {
        anyhow::bail!(
            "供应商「{}」缺少独立 config.toml，已停止切换，避免继续显示上一套配置文件。",
            if profile.name.trim().is_empty() {
                profile.id.as_str()
            } else {
                profile.name.as_str()
            }
        );
    }
    if profile.relay_mode == RelayMode::Official
        && serde_json::from_str::<serde_json::Value>(&profile.auth_contents)
            .ok()
            .and_then(|value| {
                value
                    .get("OPENAI_API_KEY")
                    .and_then(serde_json::Value::as_str)
                    .map(str::trim)
                    .map(str::is_empty)
            })
            == Some(false)
    {
        anyhow::bail!(
            "官方混合 API 不应在 auth.json 中保存 OPENAI_API_KEY。请清理此供应商的 auth.json 后再切换。"
        );
    }
    Ok(())
}

fn relay_combined_common_config(settings: &BackendSettings) -> String {
    let sections = [
        settings.relay_common_config_contents.trim(),
        settings.relay_context_config_contents.trim(),
    ]
    .into_iter()
    .filter(|section| !section.is_empty())
    .collect::<Vec<_>>();
    if sections.is_empty() {
        String::new()
    } else {
        crate::relay_config::normalize_config_text(&format!("{}\n", sections.join("\n\n")))
    }
}
