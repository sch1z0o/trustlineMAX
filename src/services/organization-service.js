import db from '../db/index.js';

const listActiveOrganizations = () => {
  const stmt = db.prepare('SELECT id, name, short_code FROM organizations WHERE is_active = 1 ORDER BY name');
  return stmt.all();
};

const getOrganizationById = (id) => {
  const stmt = db.prepare('SELECT id, name, short_code FROM organizations WHERE id = ?');
  return stmt.get(id);
};

const listCategoriesForOrg = (orgId) => {
  const stmt = db.prepare(
    `SELECT id, name_ru as name FROM categories WHERE org_id IS NULL
     UNION ALL
     SELECT id, name_ru as name FROM categories WHERE org_id = ?`
  );
  const rows = stmt.all(orgId);
  const dedup = new Map();
  rows.forEach((row) => {
    dedup.set(row.id, row);
  });
  return Array.from(dedup.values());
};

export default {
  listActiveOrganizations,
  getOrganizationById,
  listCategoriesForOrg,
};
