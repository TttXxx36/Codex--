use std::sync::Mutex;

use codex_plus_core::diagnostic_log::{append_diagnostic_log, set_diagnostic_log_path_for_tests};
use serde_json::json;

static LOG_LOCK: Mutex<()> = Mutex::new(());

struct DiagnosticLogPathGuard;

impl Drop for DiagnosticLogPathGuard {
    fn drop(&mut self) {
        set_diagnostic_log_path_for_tests(None);
    }
}

#[test]
fn diagnostic_log_append_redacts_multiple_mixed_case_tokens_and_queries() {
    let _lock = LOG_LOCK.lock().unwrap();
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("diagnostic.log");
    set_diagnostic_log_path_for_tests(Some(path.clone()));
    let _path_guard = DiagnosticLogPathGuard;

    append_diagnostic_log(
        "protocol_proxy.request_error",
        json!({
            "message": "bearer abc-123 ... Bearer def-456 api-key=secret-one&token=secret-two",
            "normal": "keep-me"
        }),
    )
    .unwrap();

    let serialized = std::fs::read_to_string(path).unwrap();
    assert!(!serialized.contains("abc-123"));
    assert!(!serialized.contains("def-456"));
    assert!(!serialized.contains("secret-one"));
    assert!(!serialized.contains("secret-two"));
    assert!(serialized.contains("keep-me"));
}
