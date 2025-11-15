import crypto from 'crypto';
import dayjs from 'dayjs';
import db from '../db/index.js';
import audit from './audit-service.js';

const getReviewerOrNull = (userId, orgId) => {
  const stmt = db.prepare('SELECT * FROM reviewers WHERE user_id = ? AND org_id = ?');
  return stmt.get(String(userId), orgId);
};

const listReviewerOrgIds = (userId) => {
  const stmt = db.prepare('SELECT org_id FROM reviewers WHERE user_id = ?');
  return stmt.all(String(userId)).map((row) => row.org_id);
};

const upsertReviewer = (userId, orgId, chatId) => {
  const stmt = db.prepare(`
    INSERT INTO reviewers (user_id, org_id, verified_at, chat_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, org_id) DO UPDATE SET
      verified_at=excluded.verified_at,
      chat_id=excluded.chat_id
  `);
  stmt.run(String(userId), orgId, dayjs().toISOString(), chatId || null);
  audit.log(null, userId, 'REVIEWER_VERIFIED', { orgId });
};

const ensureReviewerChat = (userId, orgId, chatId) => {
  const stmt = db.prepare('UPDATE reviewers SET chat_id = ? WHERE user_id = ? AND org_id = ?');
  stmt.run(chatId, String(userId), orgId);
};

const verifyByWhitelist = (userId, whitelist, chatId) => {
  const grantedOrgIds = [];
  Object.entries(whitelist || {}).forEach(([orgId, ids]) => {
    if (ids.map(String).includes(String(userId))) {
      upsertReviewer(userId, orgId, chatId);
      grantedOrgIds.push(orgId);
    }
  });
  return grantedOrgIds;
};

const verifyByAccessCode = (orgId, code) => {
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  if (orgId) {
    const stmt = db.prepare('SELECT * FROM access_codes WHERE org_id = ? AND code_hash = ?');
    return stmt.get(orgId, hash);
  }
  const stmt = db.prepare('SELECT * FROM access_codes WHERE code_hash = ?');
  return stmt.get(hash);
};

const listReviewersForOrg = (orgId) => {
  const stmt = db.prepare('SELECT user_id, chat_id FROM reviewers WHERE org_id = ?');
  return stmt.all(orgId);
};

export default {
  getReviewerOrNull,
  listReviewerOrgIds,
  upsertReviewer,
  ensureReviewerChat,
  verifyByWhitelist,
  verifyByAccessCode,
  listReviewersForOrg,
};
