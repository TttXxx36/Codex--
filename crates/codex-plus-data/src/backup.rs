use anyhow::Context;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct BackupStore {
    root: PathBuf,
}

impl BackupStore {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn write_backup(
        &self,
        session_id: &str,
        source_db: &Path,
        tables: serde_json::Value,
    ) -> anyhow::Result<String> {
        let epoch = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let token = format!("{epoch}-{}", Uuid::new_v4().simple());
        fs::create_dir_all(&self.root).with_context(|| {
            format!(
                "failed to create backup directory {}",
                self.root.to_string_lossy()
            )
        })?;
        let tables_bytes = serde_json::to_vec(&tables)?;
        let checksum = format!("sha256:{:x}", Sha256::digest(&tables_bytes));
        let payload = json!({
            "token": token,
            "session_id": session_id,
            "source_db": source_db.to_string_lossy(),
            "checksum": checksum,
            "tables": tables,
        });
        let path = self.path_for(&token);
        let serialized = serde_json::to_string_pretty(&payload)?;
        codex_plus_core::settings::atomic_write(&path, serialized.as_bytes())?;
        Ok(token)
    }

    pub fn read_backup(&self, token: &str) -> anyhow::Result<serde_json::Value> {
        let path = self.path_for(token);
        let text = fs::read_to_string(&path)
            .with_context(|| format!("Backup token not found: {token}"))?;
        let val: serde_json::Value = serde_json::from_str(&text)?;
        if let Some(expected_checksum) = val.get("checksum").and_then(|c| c.as_str()) {
            if let Some(tables) = val.get("tables") {
                let tables_bytes = serde_json::to_vec(tables)?;
                let actual_checksum = format!("sha256:{:x}", Sha256::digest(&tables_bytes));
                if expected_checksum != actual_checksum {
                    anyhow::bail!(
                        "Backup checksum mismatch for token {token}: expected {expected_checksum}, got {actual_checksum}"
                    );
                }
            }
        }
        Ok(val)
    }

    pub fn path_for(&self, token: &str) -> PathBuf {
        let safe: String = token
            .chars()
            .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '-' || *ch == '_')
            .collect();
        self.root.join(format!("{safe}.json"))
    }
}
