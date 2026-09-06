import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSpeedScore,
  generateDecisionAdvice,
  runConcurrentSpeedMatrix,
  type SpeedTestCandidate,
  type SpeedTestResult,
} from "./speed-matrix.ts";

test("calculateSpeedScore awards high score for low latency and zero for failures", () => {
  assert.equal(calculateSpeedScore(150, false), 0);
  assert.equal(calculateSpeedScore(0, true), 0);

  const fastScore = calculateSpeedScore(150, true, 80);
  const midScore = calculateSpeedScore(600, true, 400);
  const slowScore = calculateSpeedScore(2500, true, 1800);

  assert.ok(fastScore >= 90, `fastScore should be >= 90, got ${fastScore}`);
  assert.ok(fastScore > midScore, "fastScore should exceed midScore");
  assert.ok(midScore > slowScore, "midScore should exceed slowScore");
});

test("generateDecisionAdvice produces intelligent, explainable recommendations", () => {
  // All failed scenario
  const allFailed: SpeedTestResult[] = [
    {
      profileId: "p1",
      profileName: "Node A",
      endpoint: "https://a.com",
      httpStatus: 500,
      latencyMs: 1200,
      status: "error",
      score: 0,
    },
  ];
  const adviceFailed = generateDecisionAdvice(allFailed);
  assert.ok(adviceFailed.explanation.includes("均未成功响应"));

  // Clear winner scenario
  const results: SpeedTestResult[] = [
    {
      profileId: "fast",
      profileName: "Fast Node",
      endpoint: "https://fast.com",
      httpStatus: 200,
      latencyMs: 120,
      status: "success",
      score: 98,
    },
    {
      profileId: "slow",
      profileName: "Slow Node",
      endpoint: "https://slow.com",
      httpStatus: 200,
      latencyMs: 850,
      status: "success",
      score: 55,
    },
    {
      profileId: "broken",
      profileName: "Broken Node",
      endpoint: "https://broken.com",
      httpStatus: 429,
      latencyMs: 300,
      status: "error",
      score: 0,
    },
  ];

  // When active is not the fastest
  const adviceSwitch = generateDecisionAdvice(results, "slow");
  assert.equal(adviceSwitch.fastestProfileId, "fast");
  assert.ok(adviceSwitch.recommendation?.includes("推荐切换至「Fast Node」"));
  assert.ok(adviceSwitch.explanation.includes("最低延迟"));
  assert.ok(adviceSwitch.explanation.includes("Broken Node")); // warning note

  // When active is already the fastest
  const adviceKeep = generateDecisionAdvice(results, "fast");
  assert.equal(adviceKeep.fastestProfileId, "fast");
  assert.ok(adviceKeep.recommendation?.includes("即为最优节点"));
  assert.ok(adviceKeep.explanation.includes("无需切换"));
});

test("runConcurrentSpeedMatrix tests profiles concurrently and isolates errors", async () => {
  const candidates: SpeedTestCandidate[] = [
    { id: "c1", name: "Candidate 1", endpoint: "https://c1.test" },
    { id: "c2", name: "Candidate 2", endpoint: "https://c2.test" },
    { id: "c3", name: "Candidate 3", endpoint: "https://c3.test" },
    { id: "agg", name: "Aggregate Group", relayMode: "aggregate" }, // should be skipped
  ];

  let progressCount = 0;
  const summary = await runConcurrentSpeedMatrix(
    candidates,
    async (cand) => {
      if (cand.id === "c1") {
        return { httpStatus: 200, latencyMs: 110, ttftMs: 60 };
      }
      if (cand.id === "c2") {
        throw new Error("Connection timed out after 5000ms");
      }
      return { httpStatus: 200, latencyMs: 320, ttftMs: 180 };
    },
    {
      concurrency: 2,
      activeProfileId: "c3",
      onProgress: () => {
        progressCount++;
      },
    }
  );

  // Assert aggregate skipped: 3 tested out of 4 candidates
  assert.equal(summary.testedCount, 3);
  assert.equal(progressCount, 3);
  assert.equal(summary.successCount, 2);
  assert.equal(summary.failedCount, 1);

  // Assert error isolation: c2 timeout did not fail the matrix
  const c2Res = summary.results.find((r) => r.profileId === "c2");
  assert.equal(c2Res?.status, "timeout");
  assert.equal(c2Res?.score, 0);

  // Assert fastest is c1
  assert.equal(summary.fastestProfileId, "c1");
  assert.equal(summary.results[0].profileId, "c1");
});
