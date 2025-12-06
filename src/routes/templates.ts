// Routes for job template management
// Provides CRUD operations for templates, favorites, and template-based job creation

import express from 'express';
import { protectRoute } from '../middleware/protectRoute';
import {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  addToFavorites,
  removeFromFavorites,
  createJobFromTemplate,
  getFavoriteTemplates
} from '../controllers/templateController';

const router = express.Router();

// All routes require authentication
router.use(protectRoute);

// Template CRUD
router.get('/', getTemplates);
router.get('/favorites', getFavoriteTemplates);
router.get('/:templateId', getTemplateById);
router.post('/', createTemplate);
router.put('/:templateId', updateTemplate);
router.delete('/:templateId', deleteTemplate);

// Favorites
router.post('/:templateId/favorite', addToFavorites);
router.delete('/:templateId/favorite', removeFromFavorites);

// Create job from template
router.post('/:templateId/use', createJobFromTemplate);

export default router;
