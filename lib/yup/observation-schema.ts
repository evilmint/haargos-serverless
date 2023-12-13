import { z } from 'zod';

const containerSchema = z
  .object({
    name: z.string().max(100),
    image: z.string().max(200),
    running: z.boolean(),
    restarting: z.string().max(200),
    state: z.string().max(200),
    status: z.string().max(200),
    started_at: z.string().max(200),
    finished_at: z.string().max(200),
  })
  .strict();

const zigbeeDeviceSchema = z
  .object({
    ieee: z.string().max(64),
    brand: z.string().max(64),
    entity_name: z.string().max(64),
    device_id: z.string().max(64),
    last_updated: z.string().max(64),
    lqi: z.number(),
    integration_type: z.string().max(32),
    power_source: z.string().max(32).nullable(),
    name_by_user: z.string().max(128).nullable(),
    battery_level: z.number().nullable(),
  })
  .strict();

const zigbeeSchema = z
  .object({
    devices: z.array(zigbeeDeviceSchema),
  })
  .strict();

const cpuSchema = z
  .object({
    architecture: z.string().max(50),
    model_name: z.string().max(100),
    cpu_mhz: z.string().max(20),
    load: z.number(),
    temp: z.number().optional().nullable(),
  })
  .strict()
  .nullable();

const memorySchema = z
  .object({
    total: z.number(),
    used: z.number(),
    free: z.number(),
    shared: z.number(),
    buff_cache: z.number(),
    available: z.number(),
    swap_used: z.number().optional().nullable(),
    swap_total: z.number().optional().nullable(),
  })
  .strict()
  .nullable();

const storageItemSchema = z
  .object({
    used: z.string().max(10),
    mounted_on: z.string().max(200),
    name: z.string().max(100),
    size: z.string().max(20),
    use_percentage: z.string().max(5),
    available: z.string().max(20),
  })
  .strict();

const networkSchema = z
  .object({
    interfaces: z.array(
      z.object({
        name: z.string().max(32),
        rx: z.object({
          bytes: z.number(),
          packets: z.number(),
        }),
        tx: z.object({
          bytes: z.number(),
          packets: z.number(),
        }),
      }),
    ),
  })
  .strict();

const environmentSchema = z
  .object({
    cpu: cpuSchema,
    memory: memorySchema,
    storage: z.array(storageItemSchema).max(20),
    boot_time: z.string().max(32).nullable().optional(),
    network: networkSchema.optional(),
  })
  .strict();

const haConfigSchema = z
  .object({
    version: z.string().max(32).nullable(),
  })
  .strict();

const automationsSchema = z
  .object({
    id: z.string().max(32),
    alias: z.string().max(255),
    description: z.string().max(4096).optional(),
    last_triggered: z.string().max(64).nullable(),
    friendly_name: z.string().max(255).nullable(),
    state: z.string().max(64).nullable(),
  })
  .strict();

const scriptsSchema = z
  .object({
    alias: z.string().max(64),
    unique_id: z.string().max(64).optional(),
    last_triggered: z.string().max(64).nullable(),
    friendly_name: z.string().max(255).nullable(),
    state: z.string().max(64).nullable(),
  })
  .strict();

const scenesSchema = z
  .object({
    id: z.string().max(64),
    name: z.string().max(64),
    friendly_name: z.string().max(255).nullable(),
    state: z.string().max(64).nullable(),
  })
  .strict();

const observationSchema = z
  .object({
    installation_id: z.string().max(64),
    agent_version: z.string().max(32),
    agent_type: z.union([z.literal('bin'), z.literal('addon'), z.literal('docker')]).optional(),
    docker: z
      .object({
        containers: z.array(containerSchema).max(32),
      })
      .strict(),
    logs: z
      .string()
      .max(64 * 1000)
      .optional(),
    environment: environmentSchema,
    zigbee: zigbeeSchema.optional(),
    ha_config: haConfigSchema.nullable(),
    automations: z.array(automationsSchema).optional(),
    scripts: z.array(scriptsSchema).optional(),
    scenes: z.array(scenesSchema).optional(),
  })
  .strict();

export { environmentSchema, observationSchema };
