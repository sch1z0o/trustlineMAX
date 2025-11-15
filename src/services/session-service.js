import dayjs from 'dayjs';
import db from '../db/index.js';

const getSession = (userId) => {
  const stmt = db.prepare('SELECT user_id, state, data_json FROM user_sessions WHERE user_id = ?');
  const row = stmt.get(userId);
  if (!row) {
    return { state: null, data: {} };
  }
  return {
    state: row.state,
    data: row.data_json ? JSON.parse(row.data_json) : {},
  };
};

const saveSession = (userId, { state, data }) => {
  const stmt = db.prepare(`
    INSERT INTO user_sessions (user_id, state, data_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      state=excluded.state,
      data_json=excluded.data_json,
      updated_at=excluded.updated_at
  `);
  stmt.run(userId, state || null, JSON.stringify(data || {}), dayjs().toISOString());
};

const clearSession = (userId) => {
  const stmt = db.prepare('DELETE FROM user_sessions WHERE user_id = ?');
  stmt.run(userId);
};

export default {
  getSession,
  saveSession,
  clearSession,
};
