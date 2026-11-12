import { z } from 'zod';

const email = z
  .string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .min(1, 'Email is required.')
  .max(254, 'Email is too long.')
  .email('Please enter a valid email address.');

const newPassword = z
  .string({ error: 'Password is required.' })
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
  .regex(/\d/, 'Password must contain at least one number.');

export const signupSchema = z.strictObject({
  name: z
    .string({ error: 'Name is required.' })
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(60, 'Name must be at most 60 characters.'),
  email,
  password: newPassword,
});

export const loginSchema = z.strictObject({
  email,
  password: z
    .string({ error: 'Password is required.' })
    .min(1, 'Password is required.')
    .max(128, 'Password must be at most 128 characters.'),
});
