import * as z from 'zod';

export const updateNotificationsSchema = z
  .object({
    notifications: z.array(
      z.object({
        message: z.string(),
        created_at: z.string(),
        title: z.string(),
        notification_id: z.string(),
      }),
    ),
  })
  .strict();
