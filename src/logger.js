import { createLogger, format, transports } from 'winston';

const { combine, timestamp, errors, splat, printf, colorize } = format;

const logFormat = printf(({ level, message, timestamp: ts, stack, ...rest }) => {
  const meta = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
  return `${ts} ${level}: ${stack || message}${meta}`;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp(),
    splat(),
    process.env.NODE_ENV === 'production' ? logFormat : combine(colorize(), logFormat)
  ),
  transports: [new transports.Console()],
});

export default logger;
