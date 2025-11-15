import express from 'express';
import config from './config/index.js';
import MaxClient from './max/client.js';
import TrustLineBot from './bot/handler.js';
import logger from './logger.js';
import verifySignature from './middleware/verify-signature.js';

const client = new MaxClient({ token: config.botToken, baseUrl: config.maxApiBaseUrl });
const bot = new TrustLineBot(client);

const app = express();

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(verifySignature);

app.get('/healthz', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.post('/webhook/max', async (req, res) => {
  await bot.handleUpdate(req.body);
  res.sendStatus(200);
});

const start = async () => {
  if (config.webhookUrl) {
    try {
      await client.setWebhook(config.webhookUrl, config.webhookSecret);
      logger.info('Webhook registered at %s', config.webhookUrl);
    } catch (err) {
      logger.error('Failed to register webhook: %s', err.message);
    }
  } else {
    logger.warn('WEBHOOK_URL is not set. Configure long polling separately.');
  }

  app.listen(config.port, () => {
    logger.info('TrustLine bot listening on port %d', config.port);
  });
};

start();
