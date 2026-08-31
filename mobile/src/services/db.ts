import * as SQLite from 'expo-sqlite';

// open database legacy way for expo-sqlite v15 compatibility (which allows openDatabaseSync or transactional tx calls)
const db = SQLite.openDatabaseSync('jeevan.db');

export interface DraftIssue {
  id: string;
  payload_json: string;
  created_at: number;
  synced: number;
}

// Initialize the database schema
export async function initDatabase() {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS draft_issues (
      id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      synced INTEGER DEFAULT 0
    );
  `);
  console.log('Database initialized style: async WAL');
}

// Save a draft issue (unsynced submission)
export async function saveDraftIssue(payload: any): Promise<string> {
  const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  await db.runAsync(
    `INSERT INTO draft_issues (id, payload_json, created_at) VALUES (?, ?, ?)`,
    [id, JSON.stringify(payload), Date.now()]
  );
  console.log(`Draft issue saved: ${id}`);
  return id;
}

// Get all unsynced draft issues
export async function getUnsyncedDrafts(): Promise<Array<{id: string; payload: any}>> {
  const rows: DraftIssue[] = await db.getAllAsync(
    `SELECT id, payload_json FROM draft_issues WHERE synced = 0`
  );
  return rows.map(row => ({
    id: row.id,
    payload: JSON.parse(row.payload_json)
  }));
}

// Mark a draft as synced (after successful API submission)
export async function markDraftAsSynced(id: string): Promise<void> {
  await db.runAsync(
    `UPDATE draft_issues SET synced = 1 WHERE id = ?`,
    [id]
  );
  console.log(`Draft ${id} marked as synced`);
}

// Delete a draft
export async function deleteDraft(id: string): Promise<void> {
  await db.runAsync(`DELETE FROM draft_issues WHERE id = ?`, [id]);
  console.log(`Draft ${id} deleted`);
}
