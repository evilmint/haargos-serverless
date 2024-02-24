import * as z from 'zod';

const AlarmCategory = z.enum([
  'ADDON',
  'CORE',
  'NETWORK',
  'DEVICE',
  'ZIGBEE',
  'LOGS',
  'AUTOMATIONS',
  'SCRIPTS',
  'SCENES',
]);

const AlarmConfigurationSchema = z
  .object({
    datapointCount: z.number().optional(),
    olderThan: z
      .object({
        componentValue: z.number(),
        timeComponent: z.enum(['Minutes', 'Hours', 'Days', 'Months']),
      })
      .nullable()
      .optional(),
    addons: z
      .array(z.object({ slug: z.string() }))
      .optional()
      .nullable(),
    scripts: z
      .array(z.object({ alias: z.string() }))
      .optional()
      .nullable(),
    scenes: z
      .array(z.object({ id: z.string() }))
      .optional()
      .nullable(),
    automations: z
      .array(z.object({ name: z.string(), id: z.string() }))
      .optional()
      .nullable(),
    zigbee: z
      .array(z.object({ ieee: z.string() }))
      .optional()
      .nullable(),
    notificationMethod: z.literal('E-mail'),
  })
  .strict()
  .refine(
    data => {
      if (!data.datapointCount) {
        return true;
      }

      return data.datapointCount >= 1 && data.datapointCount <= 5;
    },
    {
      message: 'Datapoint count must be between 1 and 5.',
      path: ['addons'],
    },
  )
  .refine(
    data => {
      if (data.addons === null || data.addons === undefined) {
        return true;
      }
      return data.addons.length > 0;
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
