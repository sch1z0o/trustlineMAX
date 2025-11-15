import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const resolvePath = (p) => {
  if (!p) {
    return null;
  }
  if (path.isAbsolute(p)) {
    return p;
  }
  return path.join(projectRoot, p);
};

const loadJsonFile = (maybePath, fallback) => {
  if (!maybePath) {
    return fallback;
  }
  const absolutePath = resolvePath(maybePath);
  if (!fs.existsSync(absolutePath)) {
    return fallback;
  }
  const content = fs.readFileSync(absolutePath, 'utf-8');
  return JSON.parse(content);
};

const rawConfig = {
  botToken: process.env.BOT_TOKEN,
  webhookUrl: process.env.WEBHOOK_URL || null,
  webhookSecret: process.env.WEBHOOK_SECRET || null,
  maxApiBaseUrl: process.env.MAX_API_BASE_URL || 'https://api.max.ru/bot/v1',
  dbUrl: process.env.DB_URL || 'sqlite://data/trustline.db',
  orgsConfigPath: process.env.ORGS_CONFIG || 'config/orgs.json',
  reviewersWhitelistPath: process.env.REVIEWERS_WHITELIST || 'config/reviewers-whitelist.json',
  accessCodesPath: process.env.ACCESS_CODES || 'config/access-codes.json',
  retentionDays: Number(process.env.RETENTION_DAYS || '365'),
  port: Number(process.env.PORT || '8080'),
};

const ConfigSchema = z.object({
  botToken: z.string().min(1, 'BOT_TOKEN is required'),
  webhookUrl: z.string().url().optional().nullable(),
  webhookSecret: z.string().min(1).optional().nullable(),
  maxApiBaseUrl: z.string().url(),
  dbUrl: z.string().startsWith('sqlite://'),
  orgsConfigPath: z.string().min(1),
  reviewersWhitelistPath: z.string().min(1),
  accessCodesPath: z.string().min(1),
  retentionDays: z.number().positive(),
  port: z.number().int().positive(),
});

const validated = ConfigSchema.parse(rawConfig);

const dbPath = (() => {
  const trimmed = validated.dbUrl.replace('sqlite://', '');
  const resolved = path.isAbsolute(trimmed)
    ? trimmed
    : path.join(projectRoot, trimmed.replace(/^\/+/, ''));
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return resolved;
})();

const orgs = loadJsonFile(validated.orgsConfigPath, []);
const reviewersWhitelist = loadJsonFile(validated.reviewersWhitelistPath, {});
const accessCodes = loadJsonFile(validated.accessCodesPath, []);

export default {
  botToken: validated.botToken,
  webhookUrl: validated.webhookUrl,
  webhookSecret: validated.webhookSecret,
  maxApiBaseUrl: validated.maxApiBaseUrl,
  dbPath,
  retentionDays: validated.retentionDays,
  port: validated.port,
  orgs,
  reviewersWhitelist,
  accessCodes,
  paths: {
    orgs: resolvePath(validated.orgsConfigPath),
    reviewersWhitelist: resolvePath(validated.reviewersWhitelistPath),
    accessCodes: resolvePath(validated.accessCodesPath),
  },
};
