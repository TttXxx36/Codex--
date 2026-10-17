use codex_plus_core::ads::{
    DEFAULT_AD_LIST_URLS, cache_busted_ad_url, fetch_ad_list, fetch_ad_list_from_urls, normalize_ad_payload,
};
use serde_json::json;

#[test]
fn default_ad_urls_are_strictly_empty() {
    assert_eq!(DEFAULT_AD_LIST_URLS.len(), 0);
}

#[test]
fn cache_busted_ad_url_appends_version_query_to_plain_url() {
    assert_eq!(
        cache_busted_ad_url("https://example.test/ads.json", 1779035222758),
        "https://example.test/ads.json?v=1779035222758"
    );
}

#[test]
fn cache_busted_ad_url_preserves_existing_query() {
    assert_eq!(
        cache_busted_ad_url("https://example.test/ads.json?source=cdn", 1779035222758),
        "https://example.test/ads.json?source=cdn&v=1779035222758"
    );
}

#[test]
fn normalizes_remote_ads_to_strictly_empty_list() {
    let payload = normalize_ad_payload(json!({
        "version": 1,
        "ads": [
            {
                "id": "sponsor",
                "type": "sponsor",
                "title": "赞助商",
                "description": "推荐内容",
                "url": "https://example.test",
                "highlights": ["稳定"]
            },
            {
                "id": "normal",
                "type": "normal",
                "title": "普通推荐",
                "description": "推荐内容",
                "url": "https://example.org"
            }
        ],
        "top_ad": {
            "id": "top-sponsor",
            "type": "sponsor",
            "title": "置顶广告",
            "description": "推荐内容",
            "url": "https://example.test"
        }
    }));

    assert_eq!(payload["version"], json!(1));
    assert_eq!(payload["ads"], json!([]));
    assert_eq!(payload["topAds"], json!([]));
    assert!(payload.get("topAd").is_none());
}

#[tokio::test]
async fn fetch_ad_list_never_performs_outbound_network_requests() {
    let payload = fetch_ad_list().await.unwrap();
    assert_eq!(payload["version"], json!(1));
    assert_eq!(payload["ads"], json!([]));
    assert_eq!(payload["topAds"], json!([]));
}

#[tokio::test]
async fn fetch_ad_list_from_urls_safely_returns_empty_result() {
    let payload = fetch_ad_list_from_urls(&["http://127.0.0.1:9999/should-not-be-called.json"])
        .await
        .unwrap();
    assert_eq!(payload["ads"], json!([]));
    assert_eq!(payload["topAds"], json!([]));
}
