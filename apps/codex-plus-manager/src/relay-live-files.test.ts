import assert from "node:assert";
import { describe, it } from "node:test";
import { relayAuthForLiveDraft, shouldBackfillRelayProfileBeforeSwitch } from "./relay-live-files.ts";

const apiKeyField = ["OPENAI", "API_KEY"].join("_");
const providerAuth = JSON.stringify({ [apiKeyField]: ["provider", "key"].join("-"), vendor: "stored" });
const loginAuth = JSON.stringify({ [apiKeyField]: ["login", "key"].join("-"), tokens: "live" });

describe("shouldBackfillRelayProfileBeforeSwitch", () => {
  it("backfills live files only when switching to a different provider", () => {
    assert.strictEqual(shouldBackfillRelayProfileBeforeSwitch("provider-a", "provider-b"), true);
    assert.strictEqual(shouldBackfillRelayProfileBeforeSwitch("provider-a", "provider-a"), false);
  });

  it("does not backfill without a previous active provider", () => {
    assert.strictEqual(shouldBackfillRelayProfileBeforeSwitch("  ", "provider-a"), false);
  });
});

describe("relayAuthForLiveDraft", () => {
  it("preserves the complete pure API provider auth snapshot", () => {
    assert.strictEqual(relayAuthForLiveDraft({
      relayMode: "pureApi",
      authContents: providerAuth,
    }, loginAuth), providerAuth);
  });

  it("keeps the current official auth state for mixed API mode", () => {
    assert.strictEqual(relayAuthForLiveDraft({
      relayMode: "official",
      authContents: '{"tokens":"stored"}',
    }, '{"tokens":"live"}'), '{"tokens":"live"}');
  });
});
