use codex_plus_core::ads::{fetch_ad_list, normalize_ad_payload};
use serde_json::json;

#[tokio::test]
async fn fetch_ad_list_returns_empty_payload_without_remote_requests() {
    let result = fetch_ad_list().await.expect("fetch_ad_list failed");
    assert_eq!(result["version"], json!(1));
    assert_eq!(result["ads"], json!([]));
}

#[test]
fn normalize_ad_payload_strips_all_ads() {
    let payload = normalize_ad_payload(json!({
        "version": 1,
        "ads": [
            {
                "id": "sponsor",
                "type": "sponsor",
                "title": "赞助商",
                "description": "广告内容",
                "url": "https://example.test"
            }
        ]
    }));
    assert_eq!(payload["ads"], json!([]));
}
