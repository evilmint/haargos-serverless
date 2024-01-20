import * as z from 'zod';

export const updateAddonsSchema = z.array(
  z
    .object({
      name: z.string(),
      slug: z.string(),
      description: z.string(),
      advanced: z.boolean(),
      stage: z.string(),
      version: z.string(),
      version_latest: z.string(),
      update_available: z.boolean(),
      available: z.boolean(),
      detached: z.boolean(),
      homeassistant: z.string().nullable(),
      state: z.string(),
      repository: z.string(),
      build: z.boolean(),
      url: z.string(),
      icon: z.boolean(),
      logo: z.boolean(),
    })
    .strict(),
);
