import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { UserRole } from '../types';

export const generateTokenAndSetCookie = (user: { id: string; email: string; role: UserRole }, res: Response) => {
  const token = jwt.sign({
    userId: user.id,
    email: user.email,
    role: user.role
  }, process.env.JWT_SECRET!, {
    expiresIn: "30d",
  });

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV !== "development",
  });

  return token;
};