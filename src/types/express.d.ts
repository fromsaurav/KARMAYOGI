// Extend Express types for authentication
import { AuthTokenPayload } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
    
    interface User {
      userId: string;
      email: string;
      role: string;
      iat?: number;
      exp?: number;
    }
  }
}