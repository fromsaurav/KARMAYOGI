import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedUser, UserRole } from '../types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const prisma = new PrismaClient();

export const protectRoute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.jwt;
    
    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    
    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, fullName: true, email: true, profilePic: true, role: true }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Set req.user with backward compatible structure
    req.user = {
      id: user.id,
      userId: user.id,        // Add for backward compatibility
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      role: user.role as UserRole
    } as AuthenticatedUser;
    next();
  } catch (error) {
    console.log("Error in protectRoute middleware:", (error as Error).message);
    res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
};