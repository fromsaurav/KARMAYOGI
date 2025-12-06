import { API_BASE_URL } from '@/constants';

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

export interface GoogleAuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: GoogleUser;
    token: string;
    isNewUser: boolean;
  };
}

class GoogleAuthService {
  private readonly baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  /**
   * Initiate Google OAuth login by redirecting to backend
   */
  public initiateGoogleLogin(): void {
    const googleAuthUrl = `${this.baseURL}/api/auth/google`;
    window.location.href = googleAuthUrl;
  }

  /**
   * Parse Google OAuth callback response from URL parameters
   * This would be called on the callback page (e.g., /auth/callback)
   */
  public parseAuthCallback(): GoogleAuthResponse | null {
    if (typeof window === 'undefined') return null;

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const isNewUser = urlParams.get('isNewUser') === 'true';
    const error = urlParams.get('error');

    if (error) {
      return {
        success: false,
        message: decodeURIComponent(error)
      };
    }

    if (token) {
      try {
        // Parse JWT token to get user info (basic parsing, not verification)
        const payload = this.parseJWT(token);
        
        return {
          success: true,
          message: 'Google authentication successful',
          data: {
            user: {
              id: payload.userId,
              email: payload.email,
              name: payload.name || payload.email,
            },
            token,
            isNewUser
          }
        };
      } catch (error) {
        return {
          success: false,
          message: 'Failed to parse authentication token'
        };
      }
    }

    return null;
  }

  /**
   * Simple JWT parser (client-side only for display purposes)
   * Note: This is NOT for verification, only for extracting user info
   */
  private parseJWT(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      throw new Error('Invalid token format');
    }
  }

  /**
   * Check if Google OAuth is available on the backend
   */
  public async checkGoogleOAuthAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/google`, {
        method: 'HEAD',
        redirect: 'manual' // Don't follow redirects
      });
      
      // If it returns a redirect (302), Google OAuth is configured
      // If it returns 503, Google OAuth is not configured
      return response.status === 302 || response.status === 0; // 0 is for CORS preflight
    } catch (error) {
      console.warn('Failed to check Google OAuth availability:', error);
      return false;
    }
  }

  /**
   * Clean up authentication callback parameters from URL
   */
  public cleanupCallbackUrl(): void {
    if (typeof window !== 'undefined' && window.history.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      url.searchParams.delete('isNewUser');
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url.toString());
    }
  }

  /**
   * Get the expected callback URL for Google OAuth setup
   */
  public getCallbackUrl(): string {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/auth/callback`;
    }
    return 'http://localhost:3001/auth/callback';
  }
}

// Export singleton instance
export const googleAuthService = new GoogleAuthService();

// Export class for testing
export default GoogleAuthService;