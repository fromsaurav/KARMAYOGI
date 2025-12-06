import { Request, Response, NextFunction } from 'express';
import { UserRole, AuthTokenPayload } from '../types';

/**
 * Role-based access control middleware
 * Ensures user has one of the required roles to access the route
 */
export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Insufficient permissions for this action',
        code: 'FORBIDDEN',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
};

/**
 * Admin-only middleware
 */
export const requireAdmin = requireRole([UserRole.ADMIN]);

/**
 * Manager or Admin middleware
 */
export const requireManager = requireRole([UserRole.MANAGER, UserRole.ADMIN]);

/**
 * All authenticated users middleware (includes all roles)
 */
export const requireUser = requireRole([UserRole.USER, UserRole.MANAGER, UserRole.ADMIN]);

/**
 * Check if user can access another user's data
 * Admins can access anyone's data
 * Managers can access their team members' data
 * Users can only access their own data
 */
export const canAccessUser = (targetUserId: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { userId, role } = req.user;

    // Admin can access anyone
    if (role === UserRole.ADMIN) {
      return next();
    }

    // Users can only access their own data
    if (role === UserRole.USER) {
      if (userId !== targetUserId) {
        return res.status(403).json({
          message: 'You can only access your own data',
          code: 'FORBIDDEN_USER_ACCESS'
        });
      }
      return next();
    }

    // Managers can access their team members' data
    if (role === UserRole.MANAGER) {
      // TODO: Implement team member check when team relationships are implemented
      // For now, managers can access their own data and will be extended later
      if (userId !== targetUserId) {
        return res.status(403).json({
          message: 'Managers can only access their team members\' data',
          code: 'FORBIDDEN_MANAGER_ACCESS'
        });
      }
      return next();
    }

    return res.status(403).json({ message: 'Access denied' });
  };
};

/**
 * Resource ownership middleware
 * Checks if user owns the resource or has sufficient permissions
 */
export const canModifyResource = (resourceUserId: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { userId, role } = req.user;

    // Admin can modify anything
    if (role === UserRole.ADMIN) {
      return next();
    }

    // Users can only modify their own resources
    if (userId === resourceUserId) {
      return next();
    }

    // Managers can modify their team members' resources (to be implemented)
    if (role === UserRole.MANAGER) {
      // TODO: Check if resourceUserId is in manager's team
      return res.status(403).json({
        message: 'Managers can only modify their team members\' resources',
        code: 'FORBIDDEN_RESOURCE_ACCESS'
      });
    }

    return res.status(403).json({
      message: 'You can only modify your own resources',
      code: 'FORBIDDEN_MODIFICATION'
    });
  };
};