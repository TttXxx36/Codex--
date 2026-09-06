use serde_json::{Value, json};

pub const DEFAULT_AD_LIST_URLS: [&str; 0] = [];

pub fn normalize_ad_payload(_payload: Value) -> Value {
    json!({ "version": 1, "ads": [] })
}

pub async fn fetch_ad_list() -> anyhow::Result<Value> {
    Ok(json!({ "version": 1, "ads": [] }))
}

pub fn cache_busted_ad_url(url: &str, _version: u128) -> String {
    url.to_string()
}

pub async fn fetch_ad_list_from_urls<S>(_urls: &[S]) -> anyhow::Result<Value>
where
    S: AsRef<str>,
{
    Ok(json!({ "version": 1, "ads": [] }))
}
