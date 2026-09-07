export interface LocalSession {
  id: string;
  title: string;
  cwd: string;
  modelProvider: string;
  archived: boolean;
  updatedAtMs?: number | null;
  rolloutPath?: string;
  dbPath?: string;
}

export interface SessionCursor {
  updatedAtMs: number;
  id: string;
}

export interface SearchFilterOptions {
  query?: string;
  filterStatus?: 'all' | 'active' | 'archived';
  cwd?: string;
  modelProvider?: string;
  limit?: number;
  cursor?: SessionCursor | null;
}

export interface QueryPlanRow {
  id: number;
  parent: number;
  notused?: number;
  detail: string;
}

export interface QueryPlanAnalysis {
  hasTableScan: boolean;
  hasTempBTreeSort: boolean;
  usesIndex: boolean;
  usesCoveringIndex: boolean;
  isOptimal: boolean;
  details: string[];
  warnings: string[];
}

export function encodeSessionCursor(cursor: SessionCursor): string {
  const payload = JSON.stringify({ u: cursor.updatedAtMs, i: cursor.id });
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(payload, 'utf8').toString('base64url');
  }
  return btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSessionCursor(raw: string): SessionCursor | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    let jsonStr: string;
    if (typeof Buffer !== 'undefined') {
      jsonStr = Buffer.from(raw, 'base64url').toString('utf8');
    } else {
      let base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4 !== 0) base64 += '=';
      jsonStr = atob(base64);
    }
    const parsed = JSON.parse(jsonStr);
    const updatedAtMs = parsed?.u ?? parsed?.updatedAtMs;
    const id = parsed?.i ?? parsed?.id;
    if (Number.isFinite(updatedAtMs) && typeof id === 'string' && id.length > 0) {
      return { updatedAtMs, id };
    }
    return null;
  } catch {
    return null;
  }
}

export function toSessionCursorParam(
  cursor: SessionCursor | string | null | undefined,
): string | undefined {
  if (typeof cursor === 'string') {
    return decodeSessionCursor(cursor) ? cursor : undefined;
  }
  if (
    cursor &&
    Number.isFinite(cursor.updatedAtMs) &&
    typeof cursor.id === 'string' &&
    cursor.id.length > 0
  ) {
    return encodeSessionCursor(cursor);
  }
  return undefined;
}

/**
 * High-performance, tokenized multi-field session search with relevance scoring.
 */
export function searchLocalSessions(
  sessions: LocalSession[],
  options: SearchFilterOptions = {},
): LocalSession[] {
  const { query = '', filterStatus = 'all', cwd = '', modelProvider = '', limit } = options;
  const trimmed = query.trim().toLowerCase();
  const tokens = trimmed.length > 0 ? trimmed.split(/\s+/).filter(Boolean) : [];

  let filtered = sessions.filter((session) => {
    if (filterStatus === 'active' && session.archived) return false;
    if (filterStatus === 'archived' && !session.archived) return false;
    if (cwd && !session.cwd.toLowerCase().includes(cwd.toLowerCase())) return false;
    if (
      modelProvider &&
      !session.modelProvider.toLowerCase().includes(modelProvider.toLowerCase())
    )
      return false;
    return true;
  });

  if (tokens.length === 0) {
    if (typeof limit === 'number' && limit > 0) {
      return filtered.slice(0, limit);
    }
    return filtered;
  }

  interface ScoredSession {
    session: LocalSession;
    score: number;
  }

  const scored: ScoredSession[] = [];

  for (const session of filtered) {
    const titleLower = (session.title || '').toLowerCase();
    const idLower = (session.id || '').toLowerCase();
    const cwdLower = (session.cwd || '').toLowerCase();
    const providerLower = (session.modelProvider || '').toLowerCase();

    let allMatch = true;
    let score = 0;

    for (const token of tokens) {
      let tokenMatched = false;

      if (titleLower === token || idLower === token) {
        score += 100;
        tokenMatched = true;
      } else if (titleLower.startsWith(token)) {
        score += 60;
        tokenMatched = true;
      } else if (titleLower.includes(token)) {
        score += 35;
        tokenMatched = true;
      }

      if (idLower.includes(token)) {
        score += 30;
        tokenMatched = true;
      }

      if (cwdLower.includes(token)) {
        score += 20;
        tokenMatched = true;
      }

      if (providerLower.includes(token)) {
        score += 15;
        tokenMatched = true;
      }

      if (!tokenMatched) {
        allMatch = false;
        break;
      }
    }

    if (allMatch) {
      const recency = session.updatedAtMs ? Math.min(10, Math.floor(session.updatedAtMs / 1e11)) : 0;
      score += recency;
      scored.push({ session, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aTime = a.session.updatedAtMs ?? 0;
    const bTime = b.session.updatedAtMs ?? 0;
    if (bTime !== aTime) return bTime - aTime;
    return b.session.id.localeCompare(a.session.id);
  });

  const results = scored.map((item) => item.session);
  if (typeof limit === 'number' && limit > 0) {
    return results.slice(0, limit);
  }
  return results;
}

/**
 * Keyset-based pagination for session collections.
 * Avoids offset drift when new sessions are inserted.
 */
export function paginateSessionsKeyset(
  sessions: LocalSession[],
  pageSize: number,
  cursor?: SessionCursor | null,
): {
  items: LocalSession[];
  nextCursor: SessionCursor | null;
  prevCursor: SessionCursor | null;
  hasMore: boolean;
} {
  const safePageSize = Math.max(1, pageSize);
  let startIndex = 0;

  if (cursor) {
    startIndex = sessions.findIndex((s) => {
      const sTime = s.updatedAtMs ?? 0;
      if (sTime < cursor.updatedAtMs) return true;
      if (sTime === cursor.updatedAtMs && s.id < cursor.id) return true;
      return false;
    });
    if (startIndex === -1) {
      return {
        items: [],
        nextCursor: null,
        prevCursor: cursor,
        hasMore: false,
      };
    }
  }

  const items = sessions.slice(startIndex, startIndex + safePageSize);
  const hasMore = startIndex + safePageSize < sessions.length;

  const nextCursor: SessionCursor | null =
    hasMore && items.length > 0
      ? {
          updatedAtMs: items[items.length - 1].updatedAtMs ?? 0,
          id: items[items.length - 1].id,
        }
      : null;

  const prevCursor: SessionCursor | null =
    startIndex > 0 && sessions.length > 0
      ? {
          updatedAtMs: sessions[Math.max(0, startIndex - 1)].updatedAtMs ?? 0,
          id: sessions[Math.max(0, startIndex - 1)].id,
        }
      : null;

  return {
    items,
    nextCursor,
    prevCursor,
    hasMore,
  };
}

/**
 * Analyzes SQLite EXPLAIN QUERY PLAN rows to assert covering index usage and lack of temporary sorting.
 */
export function analyzeQueryPlan(planRows: QueryPlanRow[]): QueryPlanAnalysis {
  const details = planRows.map((row) => row.detail);
  const warnings: string[] = [];

  let hasTableScan = false;
  let hasTempBTreeSort = false;
  let usesIndex = false;
  let usesCoveringIndex = false;

  for (const detail of details) {
    if (/USE TEMP B-TREE/i.test(detail)) {
      hasTempBTreeSort = true;
      warnings.push(`Temporary B-Tree sort detected: "${detail}". Create a composite index to eliminate sorting.`);
    }

    if (/COVERING INDEX/i.test(detail)) {
      usesCoveringIndex = true;
      usesIndex = true;
    } else if (/INDEX/i.test(detail)) {
      usesIndex = true;
    }

    if (/SCAN (?!.*USING.*INDEX)/i.test(detail)) {
      hasTableScan = true;
      warnings.push(`Unindexed full table scan detected: "${detail}".`);
    }
  }

  const isOptimal = !hasTempBTreeSort && !hasTableScan && usesIndex;

  return {
    hasTableScan,
    hasTempBTreeSort,
    usesIndex,
    usesCoveringIndex,
    isOptimal,
    details,
    warnings,
  };
}
