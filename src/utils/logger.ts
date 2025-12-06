import winston from 'winston';
import { config } from './config';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json({
    replacer: (_, value) => {
      // Handle circular references and Error objects in production logs too
      if (typeof value === "object" && value !== null) {
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack
          };
        }
        // For other objects, let winston's built-in JSON formatter handle them
      }
      return value;
    }
  })
);

const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      try {
        // Handle circular references by using a replacer function
        const seen = new WeakSet();
        metaStr = '\n' + JSON.stringify(meta, (_, value) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
              return "[Circular Reference]";
            }
            seen.add(value);
          }
          // Convert Error objects to plain objects
          if (value instanceof Error) {
            return {
              name: value.name,
              message: value.message,
              stack: value.stack
            };
          }
          return value;
        }, 2);
      } catch (error) {
        metaStr = '\n[Unable to stringify meta data: ' + String(error) + ']';
      }
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

export const logger = winston.createLogger({
  level: config.server.nodeEnv === 'production' ? 'info' : 'debug',
  format: config.server.nodeEnv === 'production' ? logFormat : developmentFormat,
  defaultMeta: { service: 'karmayogi' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (config.server.nodeEnv === 'test') {
  logger.silent = true;
}