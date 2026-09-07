use serde_json::Value;

const SHARE_ENDPOINTS: &[&str] = &[
    "https://share.codexpp.cc/api/shares",
    "https://codexpp-share.pages.dev/api/shares",
];

pub async fn create_share(_payload: Value) -> anyhow::Result<Value> {
    anyhow::bail!("为了保护用户工作隐私与数据安全，远程公网会话托管分享功能已停用。请使用本地导出功能。")
}
