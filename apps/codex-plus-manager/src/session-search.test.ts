import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  type LocalSession,
  type SessionCursor,
  encodeSessionCursor,
  decodeSessionCursor,
  searchLocalSessions,
  paginateSessionsKeyset,
  analyzeQueryPlan,
} from './session-search.ts';

test('encodeSessionCursor and decodeSessionCursor roundtrip', () => {
  const cursor: SessionCursor = { updatedAtMs: 1718000000000, id: 'session-xyz-123' };
  const encoded = encodeSessionCursor(cursor);
  assert.ok(typeof encoded === 'string' && encoded.length > 0);
  const decoded = decodeSessionCursor(encoded);
  assert.deepEqual(decoded, cursor);

  // Invalid inputs
  assert.equal(decodeSessionCursor(''), null);
  assert.equal(decodeSessionCursor('invalid-base64!@#$'), null);
});

test('searchLocalSessions filters by status and scores matches by relevance', () => {
  const sessions: LocalSession[] = [
    {
      id: 's1',
      title: 'Fix SQLite performance query',
      cwd: '/home/project/backend',
      modelProvider: 'openai',
      archived: false,
      updatedAtMs: 1000,
    },
    {
      id: 's2',
      title: 'UI design for session search',
      cwd: '/home/project/frontend',
      modelProvider: 'deepseek',
      archived: true,
      updatedAtMs: 2000,
    },
    {
      id: 's3',
      title: 'SQLite database backup and restore',
      cwd: '/home/project/backend',
      modelProvider: 'anthropic',
      archived: false,
      updatedAtMs: 3000,
    },
    {
      id: 's4',
      title: 'Other unrelated task',
      cwd: '/home/project/docs',
      modelProvider: 'custom',
      archived: false,
      updatedAtMs: 4000,
    },
  ];

  // 1. Status filters
  const activeOnly = searchLocalSessions(sessions, { filterStatus: 'active' });
  assert.equal(activeOnly.length, 3);
  assert.ok(activeOnly.every((s) => !s.archived));

  const archivedOnly = searchLocalSessions(sessions, { filterStatus: 'archived' });
  assert.equal(archivedOnly.length, 1);
  assert.equal(archivedOnly[0].id, 's2');

  // 2. Multi-token search with relevance ranking
  const results = searchLocalSessions(sessions, { query: 'sqlite backend' });
  assert.equal(results.length, 2);
  // 's1' and 's3' both have sqlite and backend
  assert.ok(results.some((s) => s.id === 's1'));
  assert.ok(results.some((s) => s.id === 's3'));

  // 3. Exact match priority
  const exactMatch = searchLocalSessions(sessions, { query: 'Fix SQLite performance query' });
  assert.equal(exactMatch[0].id, 's1');
});

test('paginateSessionsKeyset achieves deterministic boundary traversal without drift', () => {
  const sessions: LocalSession[] = Array.from({ length: 15 }, (_, i) => ({
    id: `session-${String(i).padStart(3, '0')}`,
    title: `Task ${i}`,
    cwd: `/app/${i}`,
    modelProvider: 'openai',
    archived: false,
    updatedAtMs: 10000 - i * 100,
  }));

  // Page 1: 5 items
  const page1 = paginateSessionsKeyset(sessions, 5, null);
  assert.equal(page1.items.length, 5);
  assert.equal(page1.hasMore, true);
  assert.ok(page1.nextCursor);
  assert.equal(page1.items[0].id, 'session-000');
  assert.equal(page1.items[4].id, 'session-004');

  // Page 2: next 5 items
  const page2 = paginateSessionsKeyset(sessions, 5, page1.nextCursor);
  assert.equal(page2.items.length, 5);
  assert.equal(page2.hasMore, true);
  assert.equal(page2.items[0].id, 'session-005');
  assert.equal(page2.items[4].id, 'session-009');

  // Page 3: last 5 items
  const page3 = paginateSessionsKeyset(sessions, 5, page2.nextCursor);
  assert.equal(page3.items.length, 5);
  assert.equal(page3.hasMore, false);
  assert.equal(page3.nextCursor, null);
  assert.equal(page3.items[0].id, 'session-010');
  assert.equal(page3.items[4].id, 'session-014');

  // Total unique IDs across all pages
  const allIds = [...page1.items, ...page2.items, ...page3.items].map((s) => s.id);
  assert.equal(new Set(allIds).size, 15);
});

test('SQLite query plan baseline asserts covering index and eliminates temp B-Tree sort', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE threads (
      id TEXT PRIMARY KEY,
      title TEXT,
      cwd TEXT,
      model_provider TEXT,
      archived INTEGER,
      updated_at_ms INTEGER,
      rollout_path TEXT
    );
    CREATE TABLE thread_spawn_edges (
      parent_thread_id TEXT,
      child_thread_id TEXT
    );
  `);

  const querySql = `
    SELECT id, title, cwd, model_provider, archived, updated_at_ms, rollout_path
    FROM threads
    WHERE NOT EXISTS (SELECT 1 FROM thread_spawn_edges e WHERE e.child_thread_id = threads.id)
    ORDER BY COALESCE(updated_at_ms, 0) DESC, id DESC
    LIMIT 50
  `;

  // 1. Without indexes: full scan + temp B-tree sort
  const unindexedPlan = db.prepare(`EXPLAIN QUERY PLAN ${querySql}`).all() as any[];
  const unindexedAnalysis = analyzeQueryPlan(unindexedPlan);
  assert.equal(unindexedAnalysis.hasTempBTreeSort, true, 'Must detect temporary B-Tree sort without index');
  assert.equal(unindexedAnalysis.hasTableScan, true, 'Must detect unindexed table scan');
  assert.equal(unindexedAnalysis.isOptimal, false);

  // 2. Apply covering index and subquery index
  db.exec(`
    CREATE INDEX idx_threads_updated_at_id ON threads (COALESCE(updated_at_ms, 0) DESC, id DESC);
    CREATE INDEX idx_thread_spawn_edges_child ON thread_spawn_edges (child_thread_id);
  `);

  // 3. With indexes: covering index search, no temp B-tree sort
  const indexedPlan = db.prepare(`EXPLAIN QUERY PLAN ${querySql}`).all() as any[];
  const indexedAnalysis = analyzeQueryPlan(indexedPlan);
  assert.equal(indexedAnalysis.hasTempBTreeSort, false, 'Temporary B-Tree sort must be eliminated');
  assert.equal(indexedAnalysis.usesIndex, true, 'Must use covering index');
  assert.equal(indexedAnalysis.hasTableScan, false, 'Full table scan must be eliminated');
  assert.equal(indexedAnalysis.isOptimal, true);
});

test('synthetic 10,000 sessions query benchmark executes in < 15ms with covering index', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE threads (
      id TEXT PRIMARY KEY,
      title TEXT,
      cwd TEXT,
      model_provider TEXT,
      archived INTEGER,
      updated_at_ms INTEGER,
      rollout_path TEXT
    );
    CREATE INDEX idx_threads_updated_at_id ON threads (COALESCE(updated_at_ms, 0) DESC, id DESC);
  `);

  // Insert 10,000 synthetic rows in a single transaction
  db.exec('BEGIN TRANSACTION;');
  const insertStmt = db.prepare(`
    INSERT INTO threads (id, title, cwd, model_provider, archived, updated_at_ms, rollout_path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < 10000; i++) {
    insertStmt.run(
      `thread-${i}`,
      `Session task ${i} about code analysis`,
      `/workspace/project-${i % 50}`,
      i % 2 === 0 ? 'openai' : 'deepseek',
      i % 10 === 0 ? 1 : 0,
      1700000000000 + i * 1000,
      `/logs/rollout-${i}.jsonl`,
    );
  }
  db.exec('COMMIT;');

  const queryStmt = db.prepare(`
    SELECT id, title, cwd, model_provider, archived, updated_at_ms, rollout_path
    FROM threads
    ORDER BY COALESCE(updated_at_ms, 0) DESC, id DESC
    LIMIT 50
  `);

  // Measure latency over 20 iterations
  const latencies: number[] = [];
  for (let i = 0; i < 20; i++) {
    const start = performance.now();
    const rows = queryStmt.all();
    const elapsed = performance.now() - start;
    assert.equal(rows.length, 50);
    latencies.push(elapsed);
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];

  // Budget requirement: p50 < 5ms, p95 < 15ms
  assert.ok(p50 < 5, `p50 latency ${p50}ms must be under 5ms budget`);
  assert.ok(p95 < 15, `p95 latency ${p95}ms must be under 15ms budget`);
});
