// Middleware for validating request bodies using Joi schemas
// Provides consistent error handling and validation across all API endpoints

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

export const validateRequest = (schema: Joi.ObjectSchema, target: 'body' | 'query' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const dataToValidate = target === 'body' ? req.body : req.query;
    const { error } = schema.validate(dataToValidate);
    
    if (error) {
      logger.warn('Request validation failed', { 
        error: error.details,
        data: dataToValidate,
        target,
        path: req.path 
      });
      
      res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
      return;
    }
    
    next();
  };
};