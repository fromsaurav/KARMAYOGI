// Audit logging middleware for tracking all API requests
// Logs user actions, request/response data, and performance metrics for compliance

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export const auditLog = async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Skip audit logging for health check and static routes
  if (req.path === '/health' || req.path.startsWith('/static')) {
    return next();
  }

  // Capture original send function
  const originalSend = res.send;

  res.send = function(data: any): Response {
    // Calculate duration
    const duration = Date.now() - startTime;

    // Extract resource information from path
    const pathParts = req.path.split('/').filter(p => p);
    const resource = pathParts[1] || 'unknown'; // e.g., 'jobs', 'templates', etc.
    const resourceId = req.params.id || req.params.jobId || req.params.templateId || null;

    // Log audit entry (async, don't wait)
    prisma.auditLog.create({
      data: {
        userId: (req as any).user?.userId || undefined,
        action: `${req.method} ${req.path}`,
        resource,
        resourceId: resourceId || undefined,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        ipAddress: req.ip || req.socket.remoteAddress || undefined,
        userAgent: req.headers['user-agent'] || undefined,
        requestBody: req.method !== 'GET' && req.body ? req.body : undefined,
        responseBody: res.statusCode >= 400 && typeof data === 'string' ? JSON.parse(data) : undefined
      }
    }).catch(error => {
      logger.error('Failed to create audit log:', error);
    });

    return originalSend.call(this, data);
  };

  next();
};

// Get audit logs for admin dashboard
export async function getAuditLogs(
  filters: {
    userId?: string;
    resource?: string;
    method?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
): Promise<{ logs: any[]; total: number }> {
  const where: any = {};

  if (filters.userId) where.userId = filters.userId;
  if (filters.resource) where.resource = filters.resource;
  if (filters.method) where.method = filters.method;

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 100,
      skip: filters.offset || 0
    }),
    prisma.auditLog.count({ where })
  ]);

  return { logs, total };
}

// Export audit logs to CSV format
export async function exportAuditLogs(
  filters: {
    userId?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<string> {
  const { logs } = await getAuditLogs({ ...filters, limit: 10000 });

  // CSV header
  const header = 'Timestamp,User,Action,Resource,Resource ID,Method,Status Code,Duration (ms),IP Address\n';

  // CSV rows
  const rows = logs.map((log: any) => {
    return [
      log.createdAt.toISOString(),
      log.user?.fullName || 'Anonymous',
      log.action,
      log.resource,
      log.resourceId || '',
      log.method,
      log.statusCode,
      log.duration,
      log.ipAddress || ''
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
  }).join('\n');

  return header + rows;
}
