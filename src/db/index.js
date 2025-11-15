import Database from 'better-sqlite3';
import config from '../config/index.js';
import logger from '../logger.js';
import runMigrations from './migrations.js';
import syncReferenceData from './sync.js';

const db = new Database(config.dbPath);
db.pragma('foreign_keys = ON');

runMigrations(db);
syncReferenceData(db, config);

logger.info('SQLite database ready at %s', config.dbPath);

export default db;
