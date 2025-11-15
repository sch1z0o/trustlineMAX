import crypto from 'crypto';
import dayjs from 'dayjs';
import { DEFAULT_CATEGORIES } from '../config/constants.js';
import logger from '../logger.js';

const syncReferenceData = (db, config) => {
  const now = dayjs().toISOString();

  const upsertOrg = db.prepare(`
    INSERT INTO organizations (id, name, short_code, is_active, created_at)
    VALUES (@id, @name, @shortCode, @isActive, @createdAt)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      short_code=excluded.short_code,
      is_active=excluded.is_active
  `);

  const upsertCategory = db.prepare(`
    INSERT INTO categories (id, org_id, name_ru)
    VALUES (@id, @orgId, @name)
    ON CONFLICT(id, org_id) DO UPDATE SET name_ru=excluded.name_ru
  `);

  const upsertAccessCode = db.prepare(`
    INSERT INTO access_codes (org_id, code_hash, created_at, expires_at)
    VALUES (@orgId, @codeHash, @createdAt, NULL)
    ON CONFLICT(org_id, code_hash) DO NOTHING
  `);

  const defaultOrg = {
    createdAt: now,
    shortCode: null,
    isActive: 1,
  };

  config.orgs.forEach((org) => {
    upsertOrg.run({
      ...defaultOrg,
      id: org.id,
      name: org.name,
      shortCode: org.shortCode || null,
      isActive: org.isActive === false ? 0 : 1,
      createdAt: now,
    });

    if (Array.isArray(org.categories) && org.categories.length) {
      org.categories.forEach((cat) => {
        upsertCategory.run({
          id: cat.id,
          orgId: org.id,
          name: cat.name,
        });
      });
    }
  });

  DEFAULT_CATEGORIES.forEach((cat) => {
    upsertCategory.run({
      id: cat.id,
      orgId: null,
      name: cat.name,
    });
  });

  config.accessCodes.forEach((code) => {
    const hash = crypto.createHash('sha256').update(code.code).digest('hex');
    upsertAccessCode.run({
      orgId: code.org_id,
      codeHash: hash,
      createdAt: now,
    });
  });

  logger.info('Reference data synced: %d orgs, %d access codes', config.orgs.length, config.accessCodes.length);
};

export default syncReferenceData;
