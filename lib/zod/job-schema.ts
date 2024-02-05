import { z } from 'zod';

const submitJobSchema = z.object({
  type: z.union([
    z.literal('update_addon'),
    z.literal('update_supervisor'),
    z.literal('update_core'),
    z.literal('update_os'),

    z.literal('addon_stop'),
    z.literal('addon_restart'),
    z.literal('addon_start'),
    z.literal('addon_uninstall'),
    z.literal('addon_update'),

    z.literal('supervisor_update'),
    z.literal('supervisor_restart'),
    z.literal('supervisor_repair'),
    z.literal('supervisor_reload'),

    z.literal('core_stop'),
    z.literal('core_restart'),
    z.literal('core_start'),
    z.literal('core_update'),

    z.literal('host_reboot'),
    z.literal('host_shutdown'),
  ]),
  context: z.union([
    z.literal(null),
    z.object({
      addon_id: z.string(),
    }), // update_addon
  ]),
});

export { submitJobSchema };
