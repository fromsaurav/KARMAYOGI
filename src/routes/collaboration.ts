// Routes for collaboration features: comments, watchers, and job handoffs
// Enables team collaboration on jobs with real-time notifications

import express, { Request, Response } from 'express';
import { protectRoute } from '../middleware/protectRoute';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { assertJobAccess } from '../middleware/jobAccess';
import { UserRole } from '../types';
import {
  broadcastNewComment,
  broadcastCommentUpdate,
  broadcastCommentDelete,
  broadcastJobHandoff,
  broadcastWatcherChange,
} from '../services/websocket';

const prisma = new PrismaClient();
const router = express.Router();

// All routes require authentication
router.use(protectRoute);

// Add comment to job
router.post('/jobs/:jobId/comments', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { content } = req.body;
    const userId = req.user!.userId;

    if (!content || content.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Comment content is required' });
      return;
    }

    const comment = await prisma.jobComment.create({
      data: {
        jobId,
        userId,
        content
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profilePic: true
          }
        }
      }
    });

    // Extract @mentions (simplified - in production would use proper username lookup)
    const mentions = extractMentions(content);

    logger.info(`Comment added to job ${jobId} by user ${userId}`, {
      commentId: comment.id,
      mentions: mentions.length
    });

    // Broadcast real-time comment to job watchers
    broadcastNewComment(jobId, comment);

    // Broadcast @mention notifications
    if (mentions.length > 0) {
      // In production, look up user IDs from usernames
      // For now, log the mentions
      mentions.forEach(mentionedUsername => {
        logger.info(`@mention detected for ${mentionedUsername} in comment ${comment.id}`);
        // broadcastMention(mentionedUserId, { jobId, commentId: comment.id, content });
      });
    }

    res.status(201).json({
      success: true,
      data: comment,
      message: 'Comment added successfully'
    });
  } catch (error) {
    logger.error('Failed to add comment:', error);
    res.status(500).json({ success: false, message: 'Failed to add comment' });
  }
});

// Get job comments
router.get('/jobs/:jobId/comments', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { userId, role } = req.user!;

    try {
      await assertJobAccess(jobId, userId, role as UserRole);
    } catch (err: any) {
      res.status(err.statusCode ?? 403).json({ success: false, message: err.message });
      return;
    }

    const comments = await prisma.jobComment.findMany({
      where: { jobId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profilePic: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ success: true, data: comments, count: comments.length });
  } catch (error) {
    logger.error('Failed to fetch comments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch comments' });
  }
});

// Update comment
router.put('/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user!.userId;

    const existingComment = await prisma.jobComment.findUnique({
      where: { id: commentId }
    });

    if (!existingComment) {
      res.status(404).json({ success: false, message: 'Comment not found' });
      return;
    }

    if (existingComment.userId !== userId) {
      res.status(403).json({ success: false, message: 'You can only edit your own comments' });
      return;
    }

    const updated = await prisma.jobComment.update({
      where: { id: commentId },
      data: { content },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profilePic: true
          }
        }
      }
    });

    // Broadcast real-time comment update
    broadcastCommentUpdate(existingComment.jobId, updated);

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Failed to update comment:', error);
    res.status(500).json({ success: false, message: 'Failed to update comment' });
  }
});

// Delete comment
router.delete('/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = req.user!.userId;

    const comment = await prisma.jobComment.findUnique({
      where: { id: commentId }
    });

    if (!comment) {
      res.status(404).json({ success: false, message: 'Comment not found' });
      return;
    }

    if (comment.userId !== userId) {
      res.status(403).json({ success: false, message: 'You can only delete your own comments' });
      return;
    }

    await prisma.jobComment.delete({
      where: { id: commentId }
    });

    // Broadcast real-time comment deletion
    broadcastCommentDelete(comment.jobId, commentId);

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete comment:', error);
    res.status(500).json({ success: false, message: 'Failed to delete comment' });
  }
});

// Watch/unwatch job
router.post('/jobs/:jobId/watch', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = req.user!.userId;

    // Check if already watching
    const existing = await prisma.jobWatcher.findUnique({
      where: {
        jobId_userId: { jobId, userId }
      }
    });

    if (existing) {
      res.status(400).json({ success: false, message: 'Already watching this job' });
      return;
    }

    await prisma.jobWatcher.create({
      data: { jobId, userId }
    });

    logger.info(`User ${userId} started watching job ${jobId}`);

    // Broadcast watcher added event
    broadcastWatcherChange(jobId, userId, 'added');

    res.json({ success: true, message: 'Now watching job' });
  } catch (error) {
    logger.error('Failed to watch job:', error);
    res.status(500).json({ success: false, message: 'Failed to watch job' });
  }
});

router.delete('/jobs/:jobId/watch', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = req.user!.userId;

    await prisma.jobWatcher.delete({
      where: {
        jobId_userId: { jobId, userId }
      }
    });

    logger.info(`User ${userId} stopped watching job ${jobId}`);

    // Broadcast watcher removed event
    broadcastWatcherChange(jobId, userId, 'removed');

    res.json({ success: true, message: 'Stopped watching job' });
  } catch (error) {
    logger.error('Failed to unwatch job:', error);
    res.status(500).json({ success: false, message: 'Failed to unwatch job' });
  }
});

// Get job watchers
router.get('/jobs/:jobId/watchers', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { userId, role } = req.user!;

    try {
      await assertJobAccess(jobId, userId, role as UserRole);
    } catch (err: any) {
      res.status(err.statusCode ?? 403).json({ success: false, message: err.message });
      return;
    }

    const watchers = await prisma.jobWatcher.findMany({
      where: { jobId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profilePic: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: watchers.map(w => w.user),
      count: watchers.length
    });
  } catch (error) {
    logger.error('Failed to fetch watchers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch watchers' });
  }
});

// Handoff job to another user
router.post('/jobs/:jobId/handoff', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { toUserId, message } = req.body;
    const fromUserId = req.user!.userId;

    if (!toUserId) {
      res.status(400).json({ success: false, message: 'toUserId is required' });
      return;
    }

    // Verify job exists and user has access
    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      res.status(404).json({ success: false, message: 'Job not found' });
      return;
    }

    if (job.userId !== fromUserId) {
      res.status(403).json({ success: false, message: 'You can only handoff your own jobs' });
      return;
    }

    // Verify target user exists
    const toUser = await prisma.user.findUnique({
      where: { id: toUserId }
    });

    if (!toUser) {
      res.status(404).json({ success: false, message: 'Target user not found' });
      return;
    }

    // Update job owner
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { userId: toUserId }
    });

    // Create handoff record
    const handoff = await prisma.jobHandoff.create({
      data: {
        jobId,
        fromUserId,
        toUserId,
        message
      },
      include: {
        fromUser: { select: { id: true, fullName: true, email: true } },
        toUser: { select: { id: true, fullName: true, email: true } }
      }
    });

    logger.info(`Job ${jobId} handed off from ${fromUserId} to ${toUserId}`);

    // Broadcast real-time handoff notification
    broadcastJobHandoff(jobId, handoff);

    res.json({
      success: true,
      message: 'Job handed off successfully',
      data: updatedJob
    });
  } catch (error) {
    logger.error('Failed to handoff job:', error);
    res.status(500).json({ success: false, message: 'Failed to handoff job' });
  }
});

// Get job activity feed
router.get('/jobs/:jobId/activity', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { userId, role } = req.user!;

    try {
      await assertJobAccess(jobId, userId, role as UserRole);
    } catch (err: any) {
      res.status(err.statusCode ?? 403).json({ success: false, message: err.message });
      return;
    }

    const [comments, handoffs, statusChanges] = await Promise.all([
      prisma.jobComment.findMany({
        where: { jobId },
        include: {
          user: { select: { id: true, fullName: true, profilePic: true } }
        }
      }),
      prisma.jobHandoff.findMany({
        where: { jobId },
        include: {
          fromUser: { select: { id: true, fullName: true } },
          toUser: { select: { id: true, fullName: true } }
        }
      }),
      prisma.jobStatusChange.findMany({
        where: { jobId },
        include: {
          user: { select: { id: true, fullName: true } }
        }
      })
    ]);

    // Combine and sort by timestamp
    const activity = [
      ...comments.map((c: any) => ({ type: 'comment', ...c })),
      ...handoffs.map((h: any) => ({ type: 'handoff', ...h })),
      ...statusChanges.map((s: any) => ({ type: 'status_change', ...s }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ success: true, data: activity, count: activity.length });
  } catch (error) {
    logger.error('Failed to fetch activity:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch activity' });
  }
});

// Helper function to extract @mentions from content
function extractMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]);
  }

  return mentions;
}

export default router;
