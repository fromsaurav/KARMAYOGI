import { PrismaClient } from '@prisma/client';
import { UserRole } from '../types';

const prisma = new PrismaClient();

type JobStub = { id: string; userId: string };

/**
 * Asserts that the requesting user is allowed to access the given job.
 *
 * Access rules:
 *   USER    — must own the job (job.userId === requestingUserId)
 *   MANAGER — may access jobs owned by any of their direct reports,
 *             as well as their own jobs
 *   ADMIN   — unrestricted
 *
 * Throws an error with a `statusCode` property on failure:
 *   404 — job does not exist
 *   403 — role check failed
 *
 * Returns the job stub { id, userId } on success.
 */
export async function assertJobAccess(
  jobId: string,
  requestingUserId: string,
  role: UserRole
): Promise<JobStub> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, userId: true }
  });

  if (!job) {
    throw Object.assign(new Error('Job not found'), { statusCode: 404 });
  }

  if (role === UserRole.ADMIN) return job;

  if (role === UserRole.MANAGER) {
    if (job.userId === requestingUserId) return job;
    const report = await prisma.user.findFirst({
      where: { id: job.userId, managerId: requestingUserId },
      select: { id: true }
    });
    if (!report) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    return job;
  }

  // USER — must own the job
  if (job.userId !== requestingUserId) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  return job;
}
