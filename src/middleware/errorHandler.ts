// Global error handling middleware for Express application
// Provides consistent error responses and logging across all routes

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = error.statusCode || 500;
  const isProduction = config.server.nodeEnv === 'production';

  logger.error('Application error', {
    error: error.message,
    stack: error.stack,
    statusCode,
    path: req.path,
    method: req.method,
    userId: (req as any).user?.userId
  });

  const errorResponse = {
    error: isProduction && statusCode === 500 ? 'Internal Server Error' : error.message,
    statusCode,
    ...((!isProduction || error.isOperational) && {
      stack: error.stack,
      details: error
    })
  };

  res.status(statusCode).json(errorResponse);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Resource not found',
    path: req.path
  });
};