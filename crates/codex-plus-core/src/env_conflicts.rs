use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const WINDOWS_USER_ENV_KEY: &str = "Environment";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvConflict {
    pub name: String,
    pub source: EnvConflictSource,
    pub value_present: bool,
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
pub struct EnvConflictRemovalResult {
    pub removed: Vec<EnvConflictRemoval>,
    pub backup_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvConflictBackupEntry {
    pub name: String,
    pub source: EnvConflictSource,
    pub value: Option<String>,
}

pub fn is_codex_env_conflict_name(name: &str) -> bool {
    let name = name.trim();
    name.starts_with("OPENAI_")
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
    let mut conflicts = pairs
        .into_iter()
        .filter_map(|(name, value)| {
            let name = name.as_ref().trim();
            if !is_codex_env_conflict_name(name) {
                return None;
            }
            Some(EnvConflict {
                name: name.to_string(),
                source,
                value_present: !value.as_ref().trim().is_empty(),
            })
        })
        .collect::<Vec<_>>();
    conflicts.sort_by(|left, right| left.name.cmp(&right.name));
    conflicts.dedup_by(|left, right| left.name == right.name && left.source == right.source);
    conflicts
}

pub fn detect_env_conflicts() -> Vec<EnvConflict> {
    let mut conflicts =
        detected_env_conflicts_from_pairs(std::env::vars(), EnvConflictSource::Process);
    conflicts.extend(detect_user_env_conflicts());
    conflicts.sort_by(|left, right| {
        left.name
            .cmp(&right.name)
            .then_with(|| source_order(left.source).cmp(&source_order(right.source)))
    });
    conflicts.dedup_by(|left, right| left.name == right.name && left.source == right.source);
    conflicts
}

pub fn remove_env_conflicts(
    names: &[String],
    backup_dir: PathBuf,
) -> anyhow::Result<EnvConflictRemovalResult> {
    remove_env_conflicts_with_user_env(names, backup_dir, true)
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
        });
    }

    std::fs::create_dir_all(&backup_dir)?;
    let backup_path = backup_dir.join(format!("env-conflicts-{}.json", timestamp_millis()));
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
            if let Ok(user_values) = crate::windows_integration::read_current_user_string_values(WINDOWS_USER_ENV_KEY) {
                if let Some((_, val)) = user_values.into_iter().find(|(k, _)| k.eq_ignore_ascii_case(name)) {
                    before.push(EnvConflictBackupEntry {
                        name: name.clone(),
                        source: EnvConflictSource::User,
                        value: val,
                    });
                }
            }
        }
    }
    std::fs::write(&backup_path, serde_json::to_vec_pretty(&before)?)?;

    let mut removed = Vec::new();
    for name in names {
        let had_process = std::env::var_os(&name).is_some();
        unsafe {
            std::env::remove_var(&name);
        }
        let removed_user = remove_user_env && remove_user_env_value(&name)?;
        removed.push(EnvConflictRemoval {
            name,
            removed_process: had_process,
            removed_user,
        });
    }

    Ok(EnvConflictRemovalResult {
        removed,
        backup_path: Some(backup_path.to_string_lossy().to_string()),
    })
}

pub fn restore_env_conflicts(backup_path: &Path) -> anyhow::Result<usize> {
    let bytes = std::fs::read(backup_path)?;
    let entries: Vec<EnvConflictBackupEntry> = serde_json::from_slice(&bytes)?;
    let mut restored = 0;
    for entry in entries {
        if let Some(value) = entry.value {
            match entry.source {
                EnvConflictSource::Process => {
                    unsafe {
                        std::env::set_var(&entry.name, &value);
                    }
                    restored += 1;
                }
                EnvConflictSource::User => {
                    #[cfg(windows)]
                    {
                        crate::windows_integration::set_current_user_string_value(
                            WINDOWS_USER_ENV_KEY,
                            &entry.name,
                            &value,
                        )?;
                        restored += 1;
                    }
                }
            }
        }
    }
    Ok(restored)
}

fn normalized_conflict_names(names: &[String]) -> Vec<String> {
    let mut names = names
        .iter()
        .map(|name| name.trim().to_string())
        .filter(|name| is_codex_env_conflict_name(name))
        .collect::<Vec<_>>();
    names.sort();
    names.dedup();
    names
}

fn source_order(source: EnvConflictSource) -> u8 {
    match source {
        EnvConflictSource::Process => 0,
        EnvConflictSource::User => 1,
    }
}

fn timestamp_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

#[cfg(windows)]
fn detect_user_env_conflicts() -> Vec<EnvConflict> {
    crate::windows_integration::read_current_user_string_values(WINDOWS_USER_ENV_KEY)
        .unwrap_or_default()
        .into_iter()
        .map(|(name, value)| (name, value.unwrap_or_default()))
        .pipe(|pairs| detected_env_conflicts_from_pairs(pairs, EnvConflictSource::User))
}

#[cfg(not(windows))]
fn detect_user_env_conflicts() -> Vec<EnvConflict> {
    Vec::new()
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

trait Pipe: Sized {
    fn pipe<T>(self, f: impl FnOnce(Self) -> T) -> T {
        f(self)
    }
}

impl<T> Pipe for T {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_openai_prefixed_conflicts_but_not_codex_home() {
        let conflicts = detected_env_conflicts_from_pairs(
            [
                ("OPENAI_API_KEY", "sk-test"),
                ("OPENAI_BASE_URL", "https://example.test/v1"),
                ("CODEX_HOME", "C:/Users/me/.codex"),
                ("CUSTOM_OPENAI_API_KEY", "sk-custom"),
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
    }

    #[test]
    fn removal_normalization_only_keeps_conflict_names() {
        assert_eq!(
            normalized_conflict_names(&[
                "CODEX_HOME".to_string(),
                "OPENAI_API_KEY".to_string(),
                " OPENAI_BASE_URL ".to_string(),
                "OPENAI_API_KEY".to_string(),
            ]),
            vec!["OPENAI_API_KEY", "OPENAI_BASE_URL"]
        );
    }

    #[test]
    fn backup_and_restore_round_trips_correctly() {
        let temp = tempfile::tempdir().unwrap();
        let backup_dir = temp.path().to_path_buf();
        unsafe {
            std::env::set_var("OPENAI_TEST_ROUNDTRIP_KEY", "sk-test-secret-value-xyz");
        }
        assert_eq!(
            std::env::var("OPENAI_TEST_ROUNDTRIP_KEY").unwrap(),
            "sk-test-secret-value-xyz"
        );

        let result = remove_process_env_conflicts_for_tests(
            &["OPENAI_TEST_ROUNDTRIP_KEY".to_string()],
            backup_dir,
        )
        .unwrap();
        assert!(std::env::var("OPENAI_TEST_ROUNDTRIP_KEY").is_err());
        assert!(result.backup_path.is_some());

        let backup_file = PathBuf::from(result.backup_path.unwrap());
        let restored_count = restore_env_conflicts(&backup_file).unwrap();
        assert_eq!(restored_count, 1);
        assert_eq!(
            std::env::var("OPENAI_TEST_ROUNDTRIP_KEY").unwrap(),
            "sk-test-secret-value-xyz"
        );

        unsafe {
            std::env::remove_var("OPENAI_TEST_ROUNDTRIP_KEY");
        }
    }
}
