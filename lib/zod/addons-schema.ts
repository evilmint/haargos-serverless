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
      stats: z
        .object({
          cpu_percent: z.number(),
          memory_usage: z.number(),
          memory_limit: z.number(),
          memory_percent: z.number(),
          network_tx: z.number(),
          network_rx: z.number(),
          blk_read: z.number(),
          blk_write: z.number(),
        })
        .strict()
        .optional(),
    })
    .strict(),
);
