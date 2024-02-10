import * as z from 'zod';

const AlarmCategory = z.enum(['ADDON', 'CORE', 'NETWORK', 'DEVICE']);

const AlarmConfigurationSchema = z
  .object({
    datapointCount: z.number().optional(),
    addons: z
      .array(z.object({ slug: z.string() }))
      .optional()
      .nullable(),
    notificationMethod: z.literal('E-mail'),
  })
  .refine(
    data => {
      // If category is 'ADDON', addons must not be empty.
      return data.addons !== null && data.addons !== undefined
        ? data.addons.length > 0
        : true;
    },
    {
      message: 'At least one addon must be selected for ADDON category',
      path: ['addons'],
    },
  );

export const createAlarmSchema = z
  .object({
    type: z.string(),
    category: AlarmCategory,
    configuration: AlarmConfigurationSchema.nullable(),
  })
  .strict()
  .refine(
    data => {
      return (
        data.category !== 'ADDON' ||
        (data.configuration?.addons && data.configuration.addons.length > 0)
      );
    },
    {
      message: 'Addons array must not be empty when category is ADDON',
      path: ['configuration', 'addons'],
    },
  );
