use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use regex::Regex;
use serde::Serialize;
use serde_json::{Value, json};

static TEST_LOG_PATH: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();

const MAX_DIAGNOSTIC_LOG_BYTES: u64 = 50 * 1024 * 1024;
const COMPACTED_DIAGNOSTIC_LOG_BYTES: u64 = 5 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
struct DiagnosticRecord {
    timestamp_ms: u64,
    pid: u32,
    event: String,
    detail: Value,
}

pub fn append_diagnostic_log(event: &str, detail: impl Serialize) -> std::io::Result<()> {
    let path = diagnostic_log_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let detail = sanitize_log_value(serde_json::to_value(detail).unwrap_or_else(|error| {
        json!({
            "serialization_error": error.to_string()
        })
    }));
    let record = DiagnosticRecord {
        timestamp_ms: now_ms(),
        pid: std::process::id(),
        event: event.to_string(),
        detail,
    };
    let line = serde_json::to_string(&record).unwrap_or_else(|error| {
        json!({
            "timestamp_ms": now_ms(),
            "pid": std::process::id(),
            "event": "diagnostic_log.serialization_failed",
            "detail": {
                "message": error.to_string()
            }
        })
        .to_string()
    });

    compact_diagnostic_log_if_needed(&path)?;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)?;
    writeln!(file, "{line}")?;
    Ok(())
}

pub fn clear_diagnostic_log() -> std::io::Result<()> {
    let path = diagnostic_log_path();
    clear_diagnostic_log_path(&path)
}

fn clear_diagnostic_log_path(path: &Path) -> std::io::Result<()> {
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    }
}

pub fn diagnostic_log_path() -> PathBuf {
    if let Some(lock) = TEST_LOG_PATH.get() {
        if let Ok(guard) = lock.lock() {
            if let Some(path) = &*guard {
                return path.clone();
            }
        }
    }
    crate::paths::default_diagnostic_log_path()
}

#[doc(hidden)]
pub fn set_diagnostic_log_path_for_tests(path: Option<PathBuf>) {
    let lock = TEST_LOG_PATH.get_or_init(|| Mutex::new(None));
    *lock.lock().expect("test log path lock poisoned") = path;
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn compact_diagnostic_log_if_needed(path: &PathBuf) -> std::io::Result<()> {
    compact_diagnostic_log(
        path,
        MAX_DIAGNOSTIC_LOG_BYTES,
        COMPACTED_DIAGNOSTIC_LOG_BYTES,
    )
}

fn compact_diagnostic_log(
    path: &PathBuf,
    max_bytes: u64,
    compacted_bytes: u64,
) -> std::io::Result<()> {
    let len = match std::fs::metadata(path) {
        Ok(metadata) => metadata.len(),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error),
    };
    if len <= max_bytes {
        return Ok(());
    }

    let keep = compacted_bytes.min(len);
    let mut file = std::fs::File::open(path)?;
    file.seek(SeekFrom::Start(len - keep))?;
    let mut tail = Vec::with_capacity(keep as usize);
    file.read_to_end(&mut tail)?;
    drop(file);
    if len > keep {
        if let Some(pos) = tail.iter().position(|byte| *byte == b'\n') {
            tail.drain(..=pos);
        }
    }

    crate::settings::atomic_write(path, &tail).map_err(std::io::Error::other)
}

fn sanitize_log_value(mut value: Value) -> Value {
    match &mut value {
        Value::Object(map) => {
            for (key, val) in map.iter_mut() {
                let lower = key.to_ascii_lowercase();
                if lower.contains("key")
                    || lower.contains("token")
                    || lower.contains("secret")
                    || lower.contains("auth")
                    || lower.contains("password")
                    || lower.contains("credential")
                {
                    *val = json!("[REDACTED]");
                } else {
                    *val = sanitize_log_value(val.take());
                }
            }
        }
        Value::Array(list) => {
            for item in list.iter_mut() {
                *item = sanitize_log_value(item.take());
            }
        }
        Value::String(s) => {
            *s = sanitize_string(s);
        }
        _ => {}
    }
    value
}

fn sanitize_string(input: &str) -> String {
    // 遮罩形如 Bearer <token>、sk-<key> 和 key=<value> 等常见密钥格式。
    static BEARER_RE: OnceLock<Regex> = OnceLock::new();
    static SK_RE: OnceLock<Regex> = OnceLock::new();
    static QUERY_CREDENTIAL_RE: OnceLock<Regex> = OnceLock::new();

    let result = BEARER_RE
        .get_or_init(|| {
            Regex::new(r#"(?i)bearer\s+[^\s"'\\]+"#).expect("valid bearer redaction regex")
        })
        .replace_all(input, "Bearer [REDACTED]");
    let result = SK_RE
        .get_or_init(|| {
            Regex::new(r"(?i)sk-[A-Za-z0-9._~+/=-]{8,}").expect("valid API key redaction regex")
        })
        .replace_all(&result, "sk-[REDACTED]");
    QUERY_CREDENTIAL_RE
        .get_or_init(|| {
            Regex::new(
                r#"(?i)(^|[?&; \t\n\r"'(\[\{])((?:api[-_]?key|access[-_]?token|key|token|password|secret|auth|credential))=([^&\s"'\\;,}\]]+)"#,
            )
            .expect("valid query credential redaction regex")
        })
        .replace_all(&result, "$1$2=[REDACTED]")
        .into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compact_diagnostic_log_keeps_tail_and_drops_partial_first_line() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("codex-plus.log");
        std::fs::write(&path, "line-1\nline-2\nline-3\nline-4\n").unwrap();

        compact_diagnostic_log(&path, 12, 16).unwrap();

        let contents = std::fs::read_to_string(path).unwrap();
        assert_eq!(contents, "line-3\nline-4\n");
    }

    #[test]
    fn clear_diagnostic_log_ignores_missing_file() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("missing.log");

        clear_diagnostic_log_path(&path).unwrap();
    }

    #[test]
    fn sanitize_log_value_redacts_sensitive_keys_and_tokens() {
        let input = json!({
            "apiKey": "sk-1234567890abcdef",
            "api_key": "secret-value",
            "Authorization": "Bearer secret-token",
            "nested": {
                "user_token": "my-secret-token",
                "normal": "normal-value"
            },
            "error_msg": "failed with Bearer secret-bearer-value in headers"
        });

        let sanitized = sanitize_log_value(input);
        let serialized = serde_json::to_string(&sanitized).unwrap();

        assert!(!serialized.contains("sk-1234567890abcdef"));
        assert!(!serialized.contains("secret-value"));
        assert!(!serialized.contains("secret-token"));
        assert!(!serialized.contains("my-secret-token"));
        assert!(!serialized.contains("secret-bearer-value"));
        assert!(serialized.contains("normal-value"));
    }

    #[test]
    fn sanitize_string_redacts_all_mixed_case_bearer_tokens_and_query_credentials() {
        let input = "bearer abc-123 ... Bearer def-456 ... BeArEr ghi-789?x=1 api-key=secret-one&Token=secret-two&KEY=secret-three";

        let sanitized = sanitize_string(input);

        assert!(!sanitized.contains("abc-123"));
        assert!(!sanitized.contains("def-456"));
        assert!(!sanitized.contains("ghi-789?x=1"));
        assert!(!sanitized.contains("secret-one"));
        assert!(!sanitized.contains("secret-two"));
        assert!(!sanitized.contains("secret-three"));
        assert_eq!(sanitized.matches("Bearer [REDACTED]").count(), 3);
    }

    #[test]
    fn sanitize_string_continues_after_malformed_bearer_input() {
        let input = "bearer \\\"unterminated Bearer valid-token-123456 key=secret-value";

        let sanitized = sanitize_string(input);

        assert!(!sanitized.contains("valid-token-123456"));
        assert!(!sanitized.contains("secret-value"));
    }
}
