import { z } from 'zod';
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './validation';

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export interface AuthUserProfile {
  id: string;
  username: string;
  displayName: string;
  nexaVoiceId: string;
  email?: string;
  roles: string[];
  accountState: string;
  avatarUrl?: string;
}

export interface AuthResponsePayload {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUserProfile;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
  resetToken?: string;
}
