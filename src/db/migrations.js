import { CASE_STATUSES } from '../config/constants.js';

const STATUS_ENUM = CASE_STATUSES.map((s) => `'${s}'`).join(', ');

const CREATE_SQL = `
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_code TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT,
  org_id TEXT NULL,
  name_ru TEXT NOT NULL,
  PRIMARY KEY (id, org_id)
);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  short_id TEXT UNIQUE NOT NULL,
  org_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (${STATUS_ENUM})),
  reporter_user_id TEXT,
  reporter_chat_id TEXT,
  contact_opt_in INTEGER DEFAULT 0,
  contact_phone TEXT,
  contact_email TEXT,
  contact_note TEXT,
  attachments_json TEXT,
  pending_question TEXT,
  assignee_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS case_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  text TEXT,
  attachments_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES cases(id)
);

CREATE TABLE IF NOT EXISTS reviewers (
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  chat_id TEXT,
  PRIMARY KEY (user_id, org_id)
);

CREATE TABLE IF NOT EXISTS access_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  UNIQUE(org_id, code_hash)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  meta_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_sessions (
  user_id TEXT PRIMARY KEY,
  state TEXT,
  data_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cases_org_status ON cases(org_id, status);
CREATE INDEX IF NOT EXISTS idx_cases_short_id ON cases(short_id);
CREATE INDEX IF NOT EXISTS idx_case_messages_case_id ON case_messages(case_id);
`;

const runMigrations = (db) => {
  db.exec(CREATE_SQL);
};

export default runMigrations;
