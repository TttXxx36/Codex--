use std::ffi::OsString;
use std::sync::Mutex;

use codex_plus_core::env_conflicts::{
    EnvConflictStatus, detect_env_conflicts_against_profile,
    remove_process_env_conflicts_for_tests, restore_env_conflicts,
};

static ENV_LOCK: Mutex<()> = Mutex::new(());

struct ProcessEnvGuard {
    name: &'static str,
    previous: Option<OsString>,
}

impl ProcessEnvGuard {
    fn set(name: &'static str, value: &str) -> Self {
        let previous = std::env::var_os(name);
        unsafe {
            std::env::set_var(name, value);
        }
        Self { name, previous }
    }
}

impl Drop for ProcessEnvGuard {
    fn drop(&mut self) {
        unsafe {
            match &self.previous {
                Some(value) => std::env::set_var(self.name, value),
                None => std::env::remove_var(self.name),
            }
        }
    }
}

#[test]
fn matching_openai_api_key_is_aligned_and_masked() {
    let _lock = ENV_LOCK.lock().unwrap();
    let _key = ProcessEnvGuard::set("OPENAI_API_KEY", "fixture-profile-key-1234");

    let conflict = detect_env_conflicts_against_profile(
        Some("fixture-profile-key-1234"),
        Some("https://fixture.example/v1"),
    )
    .into_iter()
    .find(|item| item.name == "OPENAI_API_KEY")
    .expect("the process key should be detected");

    assert_eq!(conflict.status, EnvConflictStatus::Aligned);
    assert!(!conflict.current_value_masked.contains("fixture-profile-key-1234"));
    assert_eq!(
        conflict.expected_value_masked.as_deref(),
        Some(conflict.current_value_masked.as_str())
    );
}

#[test]
fn unrelated_openai_api_key_is_divergent_against_the_active_profile() {
    let _lock = ENV_LOCK.lock().unwrap();
    let _key = ProcessEnvGuard::set("OPENAI_API_KEY", "fixture-external-key-9999");

    let conflict = detect_env_conflicts_against_profile(
        Some("fixture-profile-key-1234"),
        Some("https://fixture.example/v1"),
    )
    .into_iter()
    .find(|item| item.name == "OPENAI_API_KEY")
    .expect("the process key should be detected");

    assert_eq!(conflict.status, EnvConflictStatus::Divergent);
    assert!(!conflict.current_value_masked.contains("fixture-external-key-9999"));
    assert!(
        !conflict
            .expected_value_masked
            .as_deref()
            .unwrap_or_default()
            .contains("fixture-profile-key-1234")
    );
}

#[test]
fn removal_backup_restores_the_process_environment_value() {
    let _lock = ENV_LOCK.lock().unwrap();
    let _key = ProcessEnvGuard::set("OPENAI_API_KEY", "fixture-restore-key-5678");
    let temp = tempfile::tempdir().unwrap();

    let removed = remove_process_env_conflicts_for_tests(
        &["OPENAI_API_KEY".to_string()],
        temp.path().to_path_buf(),
    )
    .unwrap();
    let backup_path = removed.backup_path.expect("a backup path is returned");
    assert!(std::path::Path::new(&backup_path).exists());
    assert!(std::env::var_os("OPENAI_API_KEY").is_none());

    let restored = restore_env_conflicts(std::path::Path::new(&backup_path)).unwrap();
    assert_eq!(restored, 1);
    assert!(std::env::var_os("OPENAI_API_KEY").is_some());
}
