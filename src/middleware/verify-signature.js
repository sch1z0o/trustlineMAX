import crypto from 'crypto';
import config from '../config/index.js';

const SIGNATURE_HEADER = 'x-max-signature';

const verifySignature = (req, res, next) => {
  if (!config.webhookSecret) {
    return next();
  }
  const provided = req.get(SIGNATURE_HEADER);
  if (!provided) {
    return res.status(401).send('missing signature');
  }
  const expected = crypto.createHmac('sha256', config.webhookSecret).update(req.rawBody || Buffer.alloc(0)).digest('hex');
  const safeProvided = Buffer.from(provided);
  const safeExpected = Buffer.from(expected);
  if (
    safeProvided.length !== safeExpected.length ||
    !crypto.timingSafeEqual(safeProvided, safeExpected)
  ) {
    return res.status(401).send('invalid signature');
  }
  return next();
};

export default verifySignature;
