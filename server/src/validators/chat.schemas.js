import { z } from 'zod';

export const MESSAGE_MAX_LENGTH = 4000;

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id.');

export const sendMessageSchema = z.strictObject({
  message: z
    .string({ error: 'Message is required.' })
    .trim()
    .min(1, 'Message cannot be empty.')
    .max(MESSAGE_MAX_LENGTH, `Message must be at most ${MESSAGE_MAX_LENGTH} characters.`),
  conversationId: objectId.nullish(),
  clientMessageId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,64}$/, 'clientMessageId must be 8-64 letters, digits, "-" or "_".')
    .optional(),
});

export const conversationIdParams = z.object({ id: objectId });

export const historyQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const messagesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: objectId.optional(),
});
