// Rate limiting middleware to prevent API abuse
// Uses only default IP-based rate limiting without custom keyGenerators

import rateLimit from 'express-rate-limit';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

// Global rate limiter - uses default IP-based limiting
export const globalRateLimit = rateLimit({
  windowMs: config.rateLimiting.windowMs,
  max: config.rateLimiting.maxRequests,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.rateLimiting.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Global rate limit exceeded', { 
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(config.rateLimiting.windowMs / 1000)
    });
  }
});

// Basic rate limiter factory - no custom keyGenerator
export const createBasicRateLimit = (maxRequests: number, windowMs: number) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    message: {
      error: 'Too many requests, please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', { 
        ip: req.ip,
        path: req.path,
        maxRequests,
        windowMs
      });
      res.status(429).json({
        error: 'Too many requests, please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Auth-specific rate limiter - uses default IP-based limiting
export const authRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 requests per 5 minutes
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 300
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', { 
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: 300
    });
  }
});

// API rate limiter - uses default IP-based limiting
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: {
    error: 'Too many API requests, please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiter - uses default IP-based limiting
export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Predefined rate limiters for backward compatibility
export const rateLimitStrict = strictRateLimit;
export const rateLimitUser = apiRateLimit;
export const jobSubmissionRateLimit = createBasicRateLimit(20, 10 * 60 * 1000); // 20 requests per 10 minutes

// Export all rate limiters
export const rateLimiters = {
  global: globalRateLimit,
  auth: authRateLimit,
  api: apiRateLimit,
  strict: strictRateLimit,
  jobSubmission: jobSubmissionRateLimit,
  createBasic: createBasicRateLimit
};