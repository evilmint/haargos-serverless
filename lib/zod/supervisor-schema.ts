import * as z from 'zod';

export const supervisorSchema = z
  .object({
    version: z.string(),
    version_latest: z.string(),
    update_available: z.boolean(),
    arch: z.string(),
    channel: z.string(),
    timezone: z.string(),
    healthy: z.boolean(),
    supported: z.boolean(),
    logging: z.string(),
    ip_address: z.string(),
    wait_boot: z.number(),
    debug: z.boolean(),
    debug_block: z.boolean(),
    diagnostics: z.union([z.null(), z.any()]), // Replace z.any() with a more specific type if applicable
    addons_repositories: z.array(z.string()),
    auto_update: z.boolean(),
  })
  .strict();
