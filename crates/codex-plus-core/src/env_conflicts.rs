use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const WINDOWS_USER_ENV_KEY: &str = "Environment";

/// Environment variables that can change the provider endpoint or credential
/// used by Codex. Keep this list explicit: an OPENAI_ prefix alone is not
/// evidence that a variable affects Codex.
const CODEX_ENV_VARIABLES: &[(&str, EnvVariableKind)] = &[
    ("OPENAI_API_KEY", EnvVariableKind::ApiKey),
    ("OPENAI_BASE_URL", EnvVariableKind::BaseUrl),
    ("OPENAI_API_BASE_URL", EnvVariableKind::BaseUrl),
    ("OPENAI_API_BASE", EnvVariableKind::BaseUrl),
    ("OPENAI_API_URL", EnvVariableKind::BaseUrl),
    ("CODEX_PLUS_OPENAI_API_KEY", EnvVariableKind::ApiKey),
    ("CODEX_PLUS_API_KEY", EnvVariableKind::ApiKey),
    ("CODEX_PLUS_OPENAI_BASE_URL", EnvVariableKind::BaseUrl),
    ("CODEX_PLUS_BASE_URL", EnvVariableKind::BaseUrl),
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EnvVariableKind {
    ApiKey,
    BaseUrl,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EnvConflictStatus {
    /// The current environment value belongs to the active profile.
    Aligned,
    /// The current environment value differs from the active profile.
    Divergent,
    /// An environment value exists, but the active profile has no value for it.
    External,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvConflict {
    pub name: String,
    pub source: EnvConflictSource,
    pub value_present: bool,
    pub status: EnvConflictStatus,
    pub current_value_masked: String,
    pub expected_value_masked: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EnvConflictSource {
    Process,
    User,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvConflictRemoval {
    pub name: String,
    pub removed_process: bool,
    pub removed_user: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvConflictUndo {
    pub backup_path: String,
    pub created_at_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvConflictRemovalResult {
    pub removed: Vec<EnvConflictRemoval>,
    pub backup_path: Option<String>,
    pub undo: Option<EnvConflictUndo>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvConflictBackupEntry {
    pub name: String,
    pub source: EnvConflictSource,
    pub value: Option<String>,
}

pub fn is_codex_env_conflict_name(name: &str) -> bool {
    variable_kind(name).is_some()
}

pub fn detected_env_conflicts_from_pairs<I, K, V>(
    pairs: I,
    source: EnvConflictSource,
) -> Vec<EnvConflict>
where
    I: IntoIterator<Item = (K, V)>,
    K: AsRef<str>,
    V: AsRef<str>,
{
    detect_conflicts_from_pairs(pairs, source, None, None)
}

/// Detect only the environment variables known to affect Codex and compare
/// their values against the active profile at value level. Raw values never
/// leave this module; both current and expected values are masked.
pub fn detect_env_conflicts_against_profile(
    active_key: Option<&str>,
    active_base_url: Option<&str>,
) -> Vec<EnvConflict> {
    let mut conflicts = detect_conflicts_from_pairs(
        std::env::vars_os().map(|(name, value)| {
            (
                name.to_string_lossy().into_owned(),
                value.to_string_lossy().into_owned(),
            )
        }),
        EnvConflictSource::Process,
        active_key,
        active_base_url,
    );

    #[cfg(windows)]
    conflicts.extend(detect_user_env_conflicts_against_profile(
        active_key,
        active_base_url,
    ));

    conflicts.sort_by(|left, right| {
        left.name
            .to_ascii_uppercase()
            .cmp(&right.name.to_ascii_uppercase())
            .then_with(|| source_order(left.source).cmp(&source_order(right.source)))
    });
    conflicts.dedup_by(|left, right| {
        left.name.eq_ignore_ascii_case(&right.name) && left.source == right.source
    });
    conflicts
}

pub fn detect_env_conflicts() -> Vec<EnvConflict> {
    detect_env_conflicts_against_profile(None, None)
}

/// Remove only variables explicitly requested by the caller. The command
/// layer should normally use `remove_env_conflicts_against_profile`, which
/// additionally restricts removal to value-divergent entries.
pub fn remove_env_conflicts(
    names: &[String],
    backup_dir: PathBuf,
) -> anyhow::Result<EnvConflictRemovalResult> {
    remove_env_conflicts_with_user_env(names, backup_dir, true)
}

pub fn remove_env_conflicts_against_profile(
    names: &[String],
    active_key: Option<&str>,
    active_base_url: Option<&str>,
    backup_dir: PathBuf,
) -> anyhow::Result<EnvConflictRemovalResult> {
    let requested = names
        .iter()
        .map(|name| name.trim())
        .filter(|name| !name.is_empty())
        .collect::<Vec<_>>();
    let divergent_names = detect_env_conflicts_against_profile(active_key, active_base_url)
        .into_iter()
        .filter(|conflict| conflict.status == EnvConflictStatus::Divergent)
        .filter(|conflict| {
            requested
                .iter()
                .any(|name| name.eq_ignore_ascii_case(&conflict.name))
        })
        .map(|conflict| conflict.name)
        .collect::<Vec<_>>();
    remove_env_conflicts_with_user_env(&divergent_names, backup_dir, true)
}

pub fn remove_process_env_conflicts_for_tests(
    names: &[String],
    backup_dir: PathBuf,
) -> anyhow::Result<EnvConflictRemovalResult> {
    remove_env_conflicts_with_user_env(names, backup_dir, false)
}

fn remove_env_conflicts_with_user_env(
    names: &[String],
    backup_dir: PathBuf,
    remove_user_env: bool,
) -> anyhow::Result<EnvConflictRemovalResult> {
    let names = normalized_conflict_names(names);
    if names.is_empty() {
        return Ok(EnvConflictRemovalResult {
            removed: Vec::new(),
            backup_path: None,
            undo: None,
        });
    }

    std::fs::create_dir_all(&backup_dir)?;
    let created_at_ms = timestamp_millis();
    let backup_path = unique_backup_path(&backup_dir, created_at_ms)?;
    let mut before = Vec::new();
    for name in &names {
        if let Some(val) = std::env::var_os(name) {
            before.push(EnvConflictBackupEntry {
                name: name.clone(),
                source: EnvConflictSource::Process,
                value: Some(val.to_string_lossy().to_string()),
            });
        }
        #[cfg(windows)]
        if remove_user_env {
            if let Ok(user_values) =
                crate::windows_integration::read_current_user_string_values(WINDOWS_USER_ENV_KEY)
            {
                if let Some((_, val)) = user_values
                    .into_iter()
                    .find(|(key, _)| key.eq_ignore_ascii_case(name))
                {
                    before.push(EnvConflictBackupEntry {
                        name: name.clone(),
                        source: EnvConflictSource::User,
                        value: val,
                    });
                }
            }
        }
    }
    let backup_bytes = serde_json::to_vec_pretty(&before)?;
    crate::settings::atomic_write(&backup_path, &backup_bytes)?;

    let mut removed = Vec::new();
    for name in names {
        let had_process = std::env::var_os(&name).is_some();
        unsafe {
            std::env::remove_var(&name);
        }
        let removed_user = match if remove_user_env {
            remove_user_env_value(&name)
        } else {
            Ok(false)
        } {
            Ok(removed_user) => removed_user,
            Err(error) => {
                if let Err(restore_error) = restore_env_entries(&before) {
                    anyhow::bail!(
                        "environment removal failed: {error}; backup restore also failed: {restore_error}"
                    );
                }
                return Err(error);
            }
        };
        removed.push(EnvConflictRemoval {
            name,
            removed_process: had_process,
            removed_user,
        });
    }

    let backup_path_string = backup_path.to_string_lossy().to_string();
    Ok(EnvConflictRemovalResult {
        removed,
        backup_path: Some(backup_path_string.clone()),
        undo: Some(EnvConflictUndo {
            backup_path: backup_path_string,
            created_at_ms,
        }),
    })
}

pub fn restore_env_conflicts(backup_path: &Path) -> anyhow::Result<usize> {
    let bytes = std::fs::read(backup_path)?;
    let entries: Vec<EnvConflictBackupEntry> = serde_json::from_slice(&bytes)?;
    if entries
        .iter()
        .any(|entry| !is_codex_env_conflict_name(&entry.name))
    {
        anyhow::bail!("environment backup contains an unsupported variable name");
    }

    restore_env_entries(&entries)
}

fn restore_env_entries(entries: &[EnvConflictBackupEntry]) -> anyhow::Result<usize> {
    let mut restored = 0;
    for entry in entries {
        if let Some(value) = entry.value.as_deref() {
            match entry.source {
                EnvConflictSource::Process => {
                    unsafe {
                        std::env::set_var(&entry.name, value);
                    }
                    restored += 1;
                }
                EnvConflictSource::User => {
                    #[cfg(windows)]
                    {
                        crate::windows_integration::set_current_user_string_value(
                            WINDOWS_USER_ENV_KEY,
                            &entry.name,
                            value,
                        )?;
                        restored += 1;
                    }
                }
            }
        }
    }
    Ok(restored)
}

/// Return a display-safe value. API keys retain at most the conventional
/// `sk-` prefix and four trailing characters; all other values are shortened
/// on both sides. Empty values are represented without exposing content.
pub fn mask_env_value(name: &str, value: &str) -> String {
    let value = value.trim();
    if value.is_empty() {
        return "<empty>".to_string();
    }
    if matches!(variable_kind(name), Some(EnvVariableKind::ApiKey)) {
        return mask_secret(value);
    }
    mask_non_secret(value)
}

fn detect_conflicts_from_pairs<I, K, V>(
    pairs: I,
    source: EnvConflictSource,
    active_key: Option<&str>,
    active_base_url: Option<&str>,
) -> Vec<EnvConflict>
where
    I: IntoIterator<Item = (K, V)>,
    K: AsRef<str>,
    V: AsRef<str>,
{
    let mut conflicts = pairs
        .into_iter()
        .filter_map(|(name, value)| {
            let name = name.as_ref().trim();
            variable_kind(name)?;
            Some(build_env_conflict(
                name,
                value.as_ref(),
                source,
                active_key,
                active_base_url,
            ))
        })
        .collect::<Vec<_>>();
    conflicts.sort_by(|left, right| left.name.cmp(&right.name));
    conflicts.dedup_by(|left, right| {
        left.name.eq_ignore_ascii_case(&right.name) && left.source == right.source
    });
    conflicts
}

fn build_env_conflict(
    name: &str,
    current_value: &str,
    source: EnvConflictSource,
    active_key: Option<&str>,
    active_base_url: Option<&str>,
) -> EnvConflict {
    let expected = match variable_kind(name) {
        Some(EnvVariableKind::ApiKey) => active_key.map(str::trim).filter(|value| !value.is_empty()),
        Some(EnvVariableKind::BaseUrl) => active_base_url
            .map(str::trim)
            .filter(|value| !value.is_empty()),
        None => None,
    };
    let status = match expected {
        Some(expected) if current_value.trim() == expected => EnvConflictStatus::Aligned,
        Some(_) => EnvConflictStatus::Divergent,
        None => EnvConflictStatus::External,
    };

    EnvConflict {
        name: name.to_string(),
        source,
        value_present: !current_value.trim().is_empty(),
        status,
        current_value_masked: mask_env_value(name, current_value),
        expected_value_masked: expected.map(|value| mask_env_value(name, value)),
    }
}

fn variable_kind(name: &str) -> Option<EnvVariableKind> {
    let name = name.trim();
    CODEX_ENV_VARIABLES
        .iter()
        .find(|(candidate, _)| candidate.eq_ignore_ascii_case(name))
        .map(|(_, kind)| *kind)
}

fn normalized_conflict_names(names: &[String]) -> Vec<String> {
    let mut names = names
        .iter()
        .map(|name| name.trim().to_string())
        .filter(|name| is_codex_env_conflict_name(name))
        .collect::<Vec<_>>();
    names.sort_by_key(|name| name.to_ascii_uppercase());
    names.dedup_by(|left, right| left.eq_ignore_ascii_case(right));
    names
}

fn source_order(source: EnvConflictSource) -> u8 {
    match source {
        EnvConflictSource::Process => 0,
        EnvConflictSource::User => 1,
    }
}

fn timestamp_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn unique_backup_path(backup_dir: &Path, created_at_ms: u64) -> anyhow::Result<PathBuf> {
    let base = format!("env-conflicts-{created_at_ms}");
    for suffix in 0..1000u16 {
        let file_name = if suffix == 0 {
            format!("{base}.json")
        } else {
            format!("{base}-{suffix}.json")
        };
        let path = backup_dir.join(file_name);
        if !path.exists() {
            return Ok(path);
        }
    }
    anyhow::bail!("could not allocate a unique environment backup path")
}

fn mask_secret(value: &str) -> String {
    let chars = value.chars().collect::<Vec<_>>();
    if chars.len() <= 8 {
        return "***".to_string();
    }
    let suffix = chars[chars.len().saturating_sub(4)..].iter().collect::<String>();
    if value.starts_with("sk-") {
        format!("sk-***{suffix}")
    } else {
        format!("***{suffix}")
    }
}

fn mask_non_secret(value: &str) -> String {
    let chars = value.chars().collect::<Vec<_>>();
    if chars.len() <= 12 {
        return "***".to_string();
    }
    let prefix = chars[..4].iter().collect::<String>();
    let suffix = chars[chars.len().saturating_sub(4)..].iter().collect::<String>();
    format!("{prefix}***{suffix}")
}

#[cfg(windows)]
fn detect_user_env_conflicts_against_profile(
    active_key: Option<&str>,
    active_base_url: Option<&str>,
) -> Vec<EnvConflict> {
    let pairs = crate::windows_integration::read_current_user_string_values(WINDOWS_USER_ENV_KEY)
        .unwrap_or_default()
        .into_iter()
        .map(|(name, value)| (name, value.unwrap_or_default()));
    detect_conflicts_from_pairs(
        pairs,
        EnvConflictSource::User,
        active_key,
        active_base_url,
    )
}

#[cfg(windows)]
fn remove_user_env_value(name: &str) -> anyhow::Result<bool> {
    crate::windows_integration::delete_current_user_value(WINDOWS_USER_ENV_KEY, name)?;
    Ok(true)
}

#[cfg(not(windows))]
fn remove_user_env_value(_name: &str) -> anyhow::Result<bool> {
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_only_core_variables_and_not_arbitrary_openai_prefixes() {
        let conflicts = detected_env_conflicts_from_pairs(
            [
                ("OPENAI_API_KEY", "synthetic-key"),
                ("OPENAI_BASE_URL", "https://example.test/v1"),
                ("OPENAI_CUSTOM_SETTING", "synthetic-value"),
                ("CODEX_HOME", "C:/Users/me/.codex"),
            ],
            EnvConflictSource::Process,
        );

        assert_eq!(
            conflicts
                .iter()
                .map(|conflict| conflict.name.as_str())
                .collect::<Vec<_>>(),
            vec!["OPENAI_API_KEY", "OPENAI_BASE_URL"]
        );
        assert!(conflicts.iter().all(|conflict| {
            conflict.current_value_masked != "synthetic-key"
                && conflict.current_value_masked != "https://example.test/v1"
        }));
    }

    #[test]
    fn compares_process_values_against_the_active_profile() {
        let conflicts = detect_conflicts_from_pairs(
            [
                ("OPENAI_API_KEY", "same-key"),
                ("OPENAI_BASE_URL", "https://other.example/v1"),
            ],
            EnvConflictSource::Process,
            Some("same-key"),
            Some("https://active.example/v1"),
        );

        assert_eq!(conflicts[0].status, EnvConflictStatus::Aligned);
        assert_eq!(conflicts[1].status, EnvConflictStatus::Divergent);
        assert_eq!(
            conflicts[0].expected_value_masked.as_deref(),
            Some("***")
        );
    }

    #[test]
    fn empty_environment_values_are_present_but_not_value_present() {
        let conflicts = detect_conflicts_from_pairs(
            [("OPENAI_API_KEY", "")],
            EnvConflictSource::Process,
            Some("profile-key"),
            None,
        );

        assert_eq!(conflicts[0].status, EnvConflictStatus::Divergent);
        assert!(!conflicts[0].value_present);
        assert_eq!(conflicts[0].current_value_masked, "<empty>");
    }

    #[test]
    fn removal_normalization_only_keeps_core_conflict_names() {
        assert_eq!(
            normalized_conflict_names(&[
                "CODEX_HOME".to_string(),
                "OPENAI_API_KEY".to_string(),
                " OPENAI_BASE_URL ".to_string(),
                "OPENAI_API_KEY".to_string(),
                "OPENAI_CUSTOM_SETTING".to_string(),
            ]),
            vec!["OPENAI_API_KEY", "OPENAI_BASE_URL"]
        );
    }

    #[test]
    fn backup_and_restore_round_trips_correctly() {
        let temp = tempfile::tempdir().unwrap();
        let backup_dir = temp.path().to_path_buf();
        let previous = std::env::var_os("OPENAI_API_KEY");
        unsafe {
            std::env::set_var("OPENAI_API_KEY", "synthetic-roundtrip-key");
        }
        assert!(std::env::var("OPENAI_API_KEY").is_ok());

        let result = remove_process_env_conflicts_for_tests(
            &["OPENAI_API_KEY".to_string()],
            backup_dir,
        )
        .unwrap();
        assert!(std::env::var("OPENAI_API_KEY").is_err());
        assert!(result.backup_path.is_some());
        assert!(result.undo.is_some());

        let backup_file = PathBuf::from(result.backup_path.unwrap());
        let restored_count = restore_env_conflicts(&backup_file).unwrap();
        assert_eq!(restored_count, 1);
        assert_eq!(
            std::env::var("OPENAI_API_KEY").unwrap(),
            "synthetic-roundtrip-key"
        );

        unsafe {
            match previous {
                Some(value) => std::env::set_var("OPENAI_API_KEY", value),
                None => std::env::remove_var("OPENAI_API_KEY"),
            }
        }
    }
}
