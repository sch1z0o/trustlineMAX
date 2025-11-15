import crypto from 'crypto';
import dayjs from 'dayjs';
import db from '../db/index.js';
import { STATUS_LABELS_RU } from '../config/constants.js';

const attachmentsToJson = (attachments) => {
  if (!attachments?.length) {
    return null;
  }
  return JSON.stringify(attachments);
};

const generateShortId = () => crypto.randomBytes(4).toString('hex').toUpperCase();

const createCase = ({
  orgId,
  categoryId,
  text,
  reporterUserId,
  reporterChatId,
  contactOptIn,
  contactEmail,
  contactPhone,
  contactNote,
  attachments,
}) => {
  const id = crypto.randomUUID();
  const shortId = generateShortId();
  const now = dayjs().toISOString();

  const stmt = db.prepare(`
    INSERT INTO cases (
      id, short_id, org_id, category_id, text, status, reporter_user_id, reporter_chat_id,
      contact_opt_in, contact_phone, contact_email, contact_note, attachments_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    shortId,
    orgId,
    categoryId,
    text,
    reporterUserId,
    reporterChatId,
    contactOptIn ? 1 : 0,
    contactPhone || null,
    contactEmail || null,
    contactNote || null,
    attachmentsToJson(attachments),
    now,
    now
  );

  return { id, short_id: shortId, created_at: now, updated_at: now };
};

const insertCaseMessage = ({ caseId, senderType, text, attachments }) => {
  const stmt = db.prepare(`
    INSERT INTO case_messages (case_id, sender_type, text, attachments_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(caseId, senderType, text || null, attachmentsToJson(attachments), dayjs().toISOString());
};

const findCaseByShortId = (shortId) => {
  const stmt = db.prepare('SELECT * FROM cases WHERE short_id = ?');
  return stmt.get(shortId.toUpperCase());
};

const findCaseById = (id) => {
  const stmt = db.prepare('SELECT * FROM cases WHERE id = ?');
  return stmt.get(id);
};

const listCasesByStatuses = ({ orgId, statuses, limit = 5 }) => {
  const placeholders = statuses.map(() => '?').join(',');
  const stmt = db.prepare(
    `SELECT * FROM cases WHERE org_id = ? AND status IN (${placeholders}) ORDER BY updated_at DESC LIMIT ?`
  );
  return stmt.all(orgId, ...statuses, limit);
};

const updateCaseStatus = (caseId, status, actorUserId, auditService) => {
  const stmt = db.prepare('UPDATE cases SET status = ?, updated_at = ? WHERE id = ?');
  const now = dayjs().toISOString();
  stmt.run(status, now, caseId);
  auditService?.log(caseId, actorUserId, 'CASE_STATUS', { status });
  return now;
};

const assignCase = (caseId, userId, auditService) => {
  const stmt = db.prepare('UPDATE cases SET assignee_user_id = ?, updated_at = ? WHERE id = ?');
  const now = dayjs().toISOString();
  stmt.run(userId, now, caseId);
  auditService?.log(caseId, userId, 'CASE_ASSIGN', {});
};

const setPendingQuestion = (caseId, text) => {
  const stmt = db.prepare('UPDATE cases SET pending_question = ?, updated_at = ? WHERE id = ?');
  stmt.run(text, dayjs().toISOString(), caseId);
};

const clearPendingQuestion = (caseId) => {
  const stmt = db.prepare('UPDATE cases SET pending_question = NULL, updated_at = ? WHERE id = ?');
  stmt.run(dayjs().toISOString(), caseId);
};

const getStatusRu = (status) => STATUS_LABELS_RU[status] || status;

export default {
  createCase,
  insertCaseMessage,
  findCaseByShortId,
  findCaseById,
  listCasesByStatuses,
  updateCaseStatus,
  assignCase,
  setPendingQuestion,
  clearPendingQuestion,
  getStatusRu,
};
