import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateTokenAndSetCookie } from '../utils/generateTokenAndSetCookie';

const prisma = new PrismaClient();

export const signup = async (req: Request, res: Response) => {
  try {
    const { fullName, username, email, password, role, managerId } = req.body;

    if (!fullName || !username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    if (username.length < 3) {
      return res.status(400).json({ message: "Username must be at least 3 characters" });
    }

    // Check if username contains only allowed characters
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ message: "Username can only contain letters, numbers, and underscores" });
    }

    // Check if user with email already exists
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUserByEmail) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Check if user with username already exists
    const existingUserByUsername = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUserByUsername) {
      return res.status(400).json({ message: "Username is already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        fullName,
        username,
        email,
        password: hashedPassword,
        role: role || 'USER',
        managerId: managerId || null,
      }
    });

    generateTokenAndSetCookie({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role
    }, res);

    res.status(201).json({
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        username: newUser.username,
        email: newUser.email,
        profilePic: newUser.profilePic,
        role: newUser.role,
      }
    });
  } catch (error) {
    console.log("Error in signup controller:", (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    generateTokenAndSetCookie({
      id: user.id,
      email: user.email,
      role: user.role
    }, res);

    res.status(200).json({
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        profilePic: user.profilePic,
        role: user.role,
      }
    });
  } catch (error) {
    console.log("Error in login controller:", (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = (req: Request, res: Response) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller:", (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = (req: Request, res: Response) => {
  try {
    res.status(200).json({ user: req.user });
  } catch (error) {
    console.log("Error in checkAuth controller:", (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkUsernameAvailability = async (req: Request, res: Response) => {
  try {
    const { username } = req.query;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ message: "Username is required" });
    }

    if (username.length < 3) {
      return res.status(200).json({ available: false, message: "Username must be at least 3 characters" });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(200).json({ available: false, message: "Username can only contain letters, numbers, and underscores" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    res.status(200).json({ available: !existingUser });
  } catch (error) {
    console.log("Error in checkUsernameAvailability controller:", (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};