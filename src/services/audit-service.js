import dayjs from 'dayjs';
import db from '../db/index.js';

const log = (caseId, actorUserId, action, meta = {}) => {
  const stmt = db.prepare(
    'INSERT INTO audit_log (case_id, actor_user_id, action, meta_json, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(caseId || null, actorUserId || null, action, JSON.stringify(meta), dayjs().toISOString());
};

export default { log };
