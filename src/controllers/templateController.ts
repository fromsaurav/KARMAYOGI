// Template controller for job template CRUD operations
// Allows users to create, use, and share reusable job templates

import { Request, Response } from 'express';
import { PrismaClient, JobType, JobPriority, UserRole } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Get all templates for a user (own + public templates)
export async function getTemplates(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { search, jobType, sortBy = 'usageCount', sortOrder = 'desc' } = req.query;

    const where: any = {
      OR: [
        { userId }, // User's own templates
        { isPublic: true } // Public templates
      ]
    };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { tags: { has: search as string } }
      ];
    }

    if (jobType) {
      where.jobType = jobType as JobType;
    }

    const templates = await prisma.jobTemplate.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        favorites: {
          where: { userId },
          select: { id: true }
        }
      },
      orderBy: {
        [sortBy as string]: sortOrder === 'desc' ? 'desc' : 'asc'
      }
    });

    const templatesWithFavorites = templates.map((template: any) => ({
      ...template,
      isFavorite: template.favorites.length > 0,
      favorites: undefined
    }));

    res.json({
      success: true,
      data: templatesWithFavorites,
      count: templatesWithFavorites.length
    });
  } catch (error) {
    logger.error('Failed to fetch templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates'
    });
  }
}

// Get a single template by ID
export async function getTemplateById(req: Request, res: Response): Promise<void> {
  try {
    const { templateId } = req.params;
    const userId = req.user!.userId;

    const template = await prisma.jobTemplate.findUnique({
      where: { id: templateId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        favorites: {
          where: { userId },
          select: { id: true }
        }
      }
    });

    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Template not found'
      });
      return;
    }

    // Check access permissions
    if (!template.isPublic && template.userId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Access denied to this template'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        ...template,
        isFavorite: template.favorites.length > 0,
        favorites: undefined
      }
    });
  } catch (error) {
    logger.error('Failed to fetch template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template'
    });
  }
}

// Create a new template
export async function createTemplate(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { name, description, jobType, priority, config, tags, isPublic } = req.body;

    // Validation
    if (!name || !jobType || !config) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: name, jobType, config'
      });
      return;
    }

    // Only admins can create public templates
    const userRole = req.user!.role;
    const templateIsPublic = userRole === UserRole.ADMIN && isPublic === true;

    const template = await prisma.jobTemplate.create({
      data: {
        userId,
        name,
        description,
        jobType,
        priority: priority || JobPriority.MEDIUM,
        config,
        tags: tags || [],
        isPublic: templateIsPublic
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    logger.info(`Template created: ${template.id} by user ${userId}`);

    res.status(201).json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error('Failed to create template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create template'
    });
  }
}

// Update a template
export async function updateTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { templateId } = req.params;
    const userId = req.user!.userId;
    const { name, description, jobType, priority, config, tags, isPublic } = req.body;

    // Check if template exists and user has permission
    const existingTemplate = await prisma.jobTemplate.findUnique({
      where: { id: templateId }
    });

    if (!existingTemplate) {
      res.status(404).json({
        success: false,
        message: 'Template not found'
      });
      return;
    }

    if (existingTemplate.userId !== userId) {
      res.status(403).json({
        success: false,
        message: 'You can only update your own templates'
      });
      return;
    }

    // Only admins can make templates public
    const userRole = req.user!.role;
    const updateData: any = {
      name,
      description,
      jobType,
      priority,
      config,
      tags
    };

    if (userRole === UserRole.ADMIN && isPublic !== undefined) {
      updateData.isPublic = isPublic;
    }

    const template = await prisma.jobTemplate.update({
      where: { id: templateId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    logger.info(`Template updated: ${templateId} by user ${userId}`);

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error('Failed to update template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update template'
    });
  }
}

// Delete a template
export async function deleteTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { templateId } = req.params;
    const userId = req.user!.userId;

    const template = await prisma.jobTemplate.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Template not found'
      });
      return;
    }

    if (template.userId !== userId) {
      res.status(403).json({
        success: false,
        message: 'You can only delete your own templates'
      });
      return;
    }

    await prisma.jobTemplate.delete({
      where: { id: templateId }
    });

    logger.info(`Template deleted: ${templateId} by user ${userId}`);

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete template'
    });
  }
}

// Add template to favorites
export async function addToFavorites(req: Request, res: Response): Promise<void> {
  try {
    const { templateId } = req.params;
    const userId = req.user!.userId;

    // Check if template exists and is accessible
    const template = await prisma.jobTemplate.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Template not found'
      });
      return;
    }

    if (!template.isPublic && template.userId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Access denied to this template'
      });
      return;
    }

    // Check if already favorited
    const existingFavorite = await prisma.favoriteTemplate.findUnique({
      where: {
        userId_templateId: {
          userId,
          templateId
        }
      }
    });

    if (existingFavorite) {
      res.status(400).json({
        success: false,
        message: 'Template already in favorites'
      });
      return;
    }

    const favorite = await prisma.favoriteTemplate.create({
      data: {
        userId,
        templateId
      }
    });

    logger.info(`Template ${templateId} added to favorites by user ${userId}`);

    res.status(201).json({
      success: true,
      data: favorite
    });
  } catch (error) {
    logger.error('Failed to add to favorites:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add to favorites'
    });
  }
}

// Remove template from favorites
export async function removeFromFavorites(req: Request, res: Response): Promise<void> {
  try {
    const { templateId } = req.params;
    const userId = req.user!.userId;

    const favorite = await prisma.favoriteTemplate.findUnique({
      where: {
        userId_templateId: {
          userId,
          templateId
        }
      }
    });

    if (!favorite) {
      res.status(404).json({
        success: false,
        message: 'Template not in favorites'
      });
      return;
    }

    await prisma.favoriteTemplate.delete({
      where: {
        id: favorite.id
      }
    });

    logger.info(`Template ${templateId} removed from favorites by user ${userId}`);

    res.json({
      success: true,
      message: 'Template removed from favorites'
    });
  } catch (error) {
    logger.error('Failed to remove from favorites:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove from favorites'
    });
  }
}

// Create job from template
export async function createJobFromTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { templateId } = req.params;
    const userId = req.user!.userId;
    const { customPayload } = req.body; // Optional payload overrides

    // Fetch template
    const template = await prisma.jobTemplate.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Template not found'
      });
      return;
    }

    if (!template.isPublic && template.userId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Access denied to this template'
      });
      return;
    }

    // Merge template config with custom payload
    const payload = {
      ...(template.config as object),
      ...(customPayload || {})
    };

    // Create job
    const job = await prisma.job.create({
      data: {
        userId,
        type: template.jobType,
        priority: template.priority,
        payload,
        metadata: {
          fromTemplate: templateId,
          templateName: template.name
        }
      }
    });

    // Increment template usage count
    await prisma.jobTemplate.update({
      where: { id: templateId },
      data: {
        usageCount: {
          increment: 1
        }
      }
    });

    logger.info(`Job ${job.id} created from template ${templateId} by user ${userId}`);

    res.status(201).json({
      success: true,
      data: job
    });
  } catch (error) {
    logger.error('Failed to create job from template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create job from template'
    });
  }
}

// Get user's favorite templates
export async function getFavoriteTemplates(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    const favorites = await prisma.favoriteTemplate.findMany({
      where: { userId },
      include: {
        template: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const templates = favorites.map((fav: any) => ({
      ...fav.template,
      isFavorite: true
    }));

    res.json({
      success: true,
      data: templates,
      count: templates.length
    });
  } catch (error) {
    logger.error('Failed to fetch favorite templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch favorite templates'
    });
  }
}
