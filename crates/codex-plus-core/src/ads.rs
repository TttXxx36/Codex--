use serde_json::{Value, json};

pub const DEFAULT_AD_LIST_URLS: [&str; 0] = [];

pub fn normalize_ad_payload(_payload: Value) -> Value {
    json!({
        "version": 1,
        "ads": [],
        "topAds": []
    })
}

pub async fn fetch_ad_list() -> anyhow::Result<Value> {
    fetch_ad_list_from_urls(&DEFAULT_AD_LIST_URLS).await
}

pub fn cache_busted_ad_url(url: &str, version: u128) -> String {
    let separator = if url.contains('?') { '&' } else { '?' };
    format!("{url}{separator}v={version}")
}

pub async fn fetch_ad_list_from_urls<S>(_urls: &[S]) -> anyhow::Result<Value>
where
    S: AsRef<str>,
{
    // 0 广告、0 推广策略：绝不发起外部广告拉取请求，永远安全返回空列表
    Ok(json!({
        "version": 1,
        "ads": [],
        "topAds": []
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_ad_payload_always_returns_empty_ads() {
        let payload = json!({
            "version": 1,
            "ads": [{
                "id": "sponsor-test",
                "type": "sponsor",
                "title": "测试广告",
                "description": "描述",
                "url": "https://example.com"
            }],
            "top_ad": {
                "id": "top-test",
                "type": "sponsor",
                "title": "置顶广告",
                "description": "描述",
                "url": "https://example.com"
            }
        });
        let normalized = normalize_ad_payload(payload);
        assert_eq!(normalized["version"], 1);
        assert_eq!(normalized["ads"], json!([]));
        assert_eq!(normalized["topAds"], json!([]));
        assert!(normalized.get("topAd").is_none());
    }

    #[tokio::test]
    async fn fetch_ad_list_never_makes_network_calls_and_returns_empty() {
        let result = fetch_ad_list().await.unwrap();
        assert_eq!(result["ads"], json!([]));
        assert_eq!(result["topAds"], json!([]));
    }
}
