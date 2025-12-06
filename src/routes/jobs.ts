import express from 'express';
import {
  submitJob,
  getJob,
  getJobs,
  deleteJob,
  retryFailedJob,
  getJobLogEntries,
  getDashboardStats,
  getKanbanJobs,
  updateJobStatus
} from '../controllers/jobController';
import { getDashboardMetrics } from '../services/metrics';
import { protectRoute } from '../middleware/protectRoute';
import { validateRequest } from '../middleware/validation';
import { rateLimitUser } from '../middleware/rateLimiter';
import { requireUser, requireAdmin, requireManager } from '../middleware/roleMiddleware';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const submitJobSchema = Joi.object({
  type: Joi.string().valid(
    'FILE_PROCESSING', 
    'DATA_ANALYTICS', 
    'EMAIL_TASK', 
    'API_INTEGRATION', 
    'CUSTOM_SCRIPT'
  ).required(),
  payload: Joi.object().required(),
  priority: Joi.string().valid('HIGH', 'MEDIUM', 'LOW').optional(),
  maxRetries: Joi.number().integer().min(0).max(10).optional(),
  delay: Joi.number().integer().min(0).optional(),
  dependencies: Joi.array().items(Joi.string().uuid()).optional(),
  metadata: Joi.object().optional()
});

const getJobsSchema = Joi.object({
  status: Joi.string().valid('PENDING', 'ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED', 'DELAYED').optional(),
  type: Joi.string().valid(
    'FILE_PROCESSING', 
    'DATA_ANALYTICS', 
    'EMAIL_TASK', 
    'API_INTEGRATION', 
    'CUSTOM_SCRIPT'
  ).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  offset: Joi.number().integer().min(0).optional(),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'priority').optional(),
  sortOrder: Joi.string().valid('asc', 'desc').optional(),
  user: Joi.string().uuid().optional()
});

// Job management routes
router.post('/',
  protectRoute,
  requireUser,  // Only authenticated users can submit jobs
  rateLimitUser,
  validateRequest(submitJobSchema),
  submitJob
);

router.get('/', 
  protectRoute,
  validateRequest(getJobsSchema, 'query'), 
  getJobs
);

router.get('/dashboard',
  protectRoute,
  getDashboardStats
);

router.get('/kanban',
  protectRoute,
  getKanbanJobs
);

router.get('/metrics',
  protectRoute,
  requireManager,  // Managers and admins can see metrics
  async (_req, res) => {
    try {
      const metrics = await getDashboardMetrics();
      res.json({
        success: true,
        message: 'Metrics retrieved successfully',
        data: metrics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve metrics'
      });
    }
  }
);

router.get('/:jobId',
  protectRoute,
  getJob
);

router.patch('/:jobId/status',
  protectRoute,
  updateJobStatus
);

router.delete('/:jobId', 
  protectRoute, 
  deleteJob
);

router.post('/:jobId/retry', 
  protectRoute, 
  retryFailedJob
);

router.get('/:jobId/logs', 
  protectRoute, 
  getJobLogEntries
);

export default router;