export interface SpeedTestCandidate {
  id: string;
  name: string;
  endpoint?: string;
  protocol?: string;
  testModel?: string;
  apiKey?: string;
  relayMode?: string;
}

export interface SpeedTestResult {
  profileId: string;
  profileName: string;
  endpoint: string;
  httpStatus: number;
  latencyMs: number;
  ttftMs?: number;
  throughput?: number;
  status: "success" | "error" | "timeout";
  errorMessage?: string;
  score: number;
}

export interface SpeedMatrixSummary {
  testedCount: number;
  successCount: number;
  failedCount: number;
  results: SpeedTestResult[];
  fastestProfileId?: string;
  fastestProfileName?: string;
  recommendation?: string;
  explanation: string;
}

export function calculateSpeedScore(latencyMs: number, isSuccess: boolean, ttftMs?: number): number {
  if (!isSuccess || latencyMs <= 0) return 0;

  // Base score from latency (0 - 80 points)
  let score = 0;
  if (latencyMs < 200) {
    score = 80;
  } else if (latencyMs < 500) {
    score = 80 - ((latencyMs - 200) / 300) * 20; // 60 - 80
  } else if (latencyMs < 1200) {
    score = 60 - ((latencyMs - 500) / 700) * 30; // 30 - 60
  } else if (latencyMs < 3000) {
    score = 30 - ((latencyMs - 1200) / 1800) * 20; // 10 - 30
  } else {
    score = 5;
  }

  // TTFT bonus (up to 20 points)
  if (ttftMs && ttftMs > 0) {
    if (ttftMs < 150) {
      score += 20;
    } else if (ttftMs < 500) {
      score += 20 - ((ttftMs - 150) / 350) * 10;
    } else {
      score += 5;
    }
  } else {
    // Default proportional TTFT estimation bonus
    score += 15;
  }

  return Math.min(100, Math.max(1, Math.round(score)));
}

export function generateDecisionAdvice(
  results: SpeedTestResult[],
  activeProfileId?: string
): {
  fastestProfileId?: string;
  fastestProfileName?: string;
  recommendation?: string;
  explanation: string;
} {
  const successful = results.filter((r) => r.status === "success" && r.score > 0);
  if (successful.length === 0) {
    return {
      explanation: "所有参与测速的供应商均未成功响应，建议排查网络代理、上游 Base URL 或 API Key 是否有效。",
    };
  }

  // Sort by score descending, then latency ascending
  successful.sort((a, b) => b.score - a.score || a.latencyMs - b.latencyMs);
  const best = successful[0];
  const isAlreadyActive = activeProfileId && best.profileId === activeProfileId;

  const failedItems = results.filter((r) => r.status !== "success");
  let warningNote = "";
  if (failedItems.length > 0) {
    const failedNames = failedItems.map((f) => f.profileName).join("、");
    warningNote = `（注意：供应商「${failedNames}」本次测速异常，建议检查配额或降为备用）`;
  }

  if (isAlreadyActive) {
    return {
      fastestProfileId: best.profileId,
      fastestProfileName: best.profileName,
      recommendation: `当前主力供应商「${best.profileName}」即为最优节点（延迟 ${best.latencyMs}ms，综合评分 ${best.score} 分）。保持当前配置即可。${warningNote}`,
      explanation: `当前主力节点响应最快且状态健康，无需切换。${warningNote}`,
    };
  }

  return {
    fastestProfileId: best.profileId,
    fastestProfileName: best.profileName,
    recommendation: `推荐切换至「${best.profileName}」（延迟 ${best.latencyMs}ms，综合评分 ${best.score} 分），性能表现优异。${warningNote}`,
    explanation: `测速数据显示「${best.profileName}」具备最低延迟与最高可靠性，点击下方按钮可一键切换为主力供应商。${warningNote}`,
  };
}

export async function runConcurrentSpeedMatrix(
  candidates: SpeedTestCandidate[],
  testSingleProfile: (candidate: SpeedTestCandidate) => Promise<{
    httpStatus: number;
    endpoint?: string;
    errorMessage?: string;
    latencyMs?: number;
    ttftMs?: number;
  }>,
  options: {
    concurrency?: number;
    activeProfileId?: string;
    onProgress?: (completed: number, total: number, latest: SpeedTestResult) => void;
  } = {}
): Promise<SpeedMatrixSummary> {
  const { concurrency = 3, activeProfileId, onProgress } = options;
  const results: SpeedTestResult[] = [];
  const testable = candidates.filter((c) => c.relayMode !== "aggregate");

  let completed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < testable.length) {
      const index = cursor++;
      const candidate = testable[index];
      const start = Date.now();
      let outcome: SpeedTestResult;

      try {
        const testRes = await testSingleProfile(candidate);
        const elapsed = testRes.latencyMs ?? Date.now() - start;
        const isSuccess = testRes.httpStatus >= 200 && testRes.httpStatus < 400;
        const score = calculateSpeedScore(elapsed, isSuccess, testRes.ttftMs);

        outcome = {
          profileId: candidate.id,
          profileName: candidate.name || "未命名供应商",
          endpoint: testRes.endpoint || candidate.endpoint || "",
          httpStatus: testRes.httpStatus,
          latencyMs: elapsed,
          ttftMs: testRes.ttftMs,
          status: isSuccess ? "success" : "error",
          errorMessage: testRes.errorMessage,
          score,
        };
      } catch (err: unknown) {
        const elapsed = Date.now() - start;
        const errMsg = err instanceof Error ? err.message : String(err);
        const isTimeout = errMsg.toLowerCase().includes("timeout") || errMsg.toLowerCase().includes("timed out");
        outcome = {
          profileId: candidate.id,
          profileName: candidate.name || "未命名供应商",
          endpoint: candidate.endpoint || "",
          httpStatus: isTimeout ? 504 : 0,
          latencyMs: elapsed,
          status: isTimeout ? "timeout" : "error",
          errorMessage: errMsg,
          score: 0,
        };
      }

      results.push(outcome);
      completed++;
      if (onProgress) {
        onProgress(completed, testable.length, outcome);
      }
    }
  }

  const workerCount = Math.min(concurrency, testable.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  // Sort overall results: successful by score desc, failed at bottom
  results.sort((a, b) => b.score - a.score || a.latencyMs - b.latencyMs);

  const advice = generateDecisionAdvice(results, activeProfileId);

  return {
    testedCount: results.length,
    successCount: results.filter((r) => r.status === "success").length,
    failedCount: results.filter((r) => r.status !== "success").length,
    results,
    fastestProfileId: advice.fastestProfileId,
    fastestProfileName: advice.fastestProfileName,
    recommendation: advice.recommendation,
    explanation: advice.explanation,
  };
}
