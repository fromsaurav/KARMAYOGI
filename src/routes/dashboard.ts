import { Router } from 'express';
import { protectRoute } from '../middleware/protectRoute';
import { requireRole, requireAdmin, requireManager } from '../middleware/roleMiddleware';
import { UserRole } from '../types';
import {
  getUserStats,
  getManagerStats,
  getAdminStats,
  getTeamMembers,
  getAllUsers,
  getWorkerStatus
} from '../controllers/dashboardController';

const router = Router();

// All dashboard routes require authentication
router.use(protectRoute);

// User Dashboard Routes - Accessible by all authenticated users
router.get('/user/stats', getUserStats);

// Manager Dashboard Routes - Accessible by MANAGER and ADMIN
router.get('/manager/stats', requireManager, getManagerStats);
router.get('/manager/team-members', requireManager, getTeamMembers);

// Admin Dashboard Routes - Accessible by ADMIN only
router.get('/admin/stats', requireAdmin, getAdminStats);
router.get('/admin/users', requireAdmin, getAllUsers);
router.get('/admin/workers', requireAdmin, getWorkerStatus);

export default router;
