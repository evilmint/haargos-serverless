import * as z from 'zod';
import { isLocalDomain } from '../local-domain';

export const createInstallationFormSchema = z.object({
  name: z
    .string()
    .min(2, {
      message: 'Name must be at least 2 characters.',
    })
    .max(30, {
      message: 'Name must not be longer than 32 characters.',
    }),
  instance: z.union([
    z.literal(''),
    z
      .string()
      .trim()
      .url()
      .refine(i => {
        const url = new URL(i);

        if (isLocalDomain(url)) {
          return true;
        }

        try {
          return url.protocol.toLowerCase() == 'https:';
        } catch {
          return false;
        }
      }, 'Only HTTPS URLs are allowed.'),
  ]),
});

export const updateInstallationFormSchema = z.object({
  name: z
    .string()
    .min(2, {
      message: 'Name must be at least 2 characters.',
    })
    .max(30, {
      message: 'Name must not be longer than 32 characters.',
    }),
  notes: z.string().trim().max(255, {
    message: 'Notes must not be longer than 255 characters.',
  }),
  instance: z.union([
    z.literal(''),
    z
      .string()
      .trim()
      .url()
      .refine(i => {
        const url = new URL(i);

        if (isLocalDomain(url)) {
          return true;
        }

        try {
          return url.protocol.toLowerCase() == 'https:';
        } catch {
          return false;
        }
      }, 'Only HTTPS URLs are allowed.'),
  ]),
});
