import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Please enter your username, email, or NexaVoice ID')
    .min(3, 'Identifier must be at least 3 characters'),
  password: z
    .string()
    .min(1, 'Please enter your password')
    .min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional(),
});

export const signupSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Display name is required')
      .min(2, 'Display name must be at least 2 characters')
      .max(64, 'Display name cannot exceed 64 characters'),
    username: z
      .string()
      .trim()
      .min(1, 'Username is required')
      .min(3, 'Username must be at least 3 characters')
      .max(32, 'Username cannot exceed 32 characters')
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        'Username can only contain alphanumeric characters, underscores, and hyphens',
      ),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, 'Work email is required')
      .email('Please enter a valid email address'),
    password: z
      .string()
      .min(1, 'Password is required')
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, 'New password is required')
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
