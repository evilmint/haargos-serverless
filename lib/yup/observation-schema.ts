import { object, string, boolean, array, number } from 'yup';

const containerSchema = object().shape({
  name: string().max(100).required(),
  image: string().max(200).required(),
  running: boolean().required(),
  restarting: string().max(200).required(),
  state: string().max(200).required(),
  status: string().max(200).required(),
  started_at: string().max(200).required(),
  finished_at: string().max(200).required(),
});

const zigbeeSchema = object().shape({
  devices: array().of(
    object().shape({
      ieee: string().max(64).required(),
      brand: string().max(64).required(),
      entity_name: string().max(64).required(),
      last_updated: string().max(64).required(),
      lqi: number().required(),
      integration_type: string().max(32).required(),
      power_source: string().max(32).nullable(),
      name_by_user: string().max(128).nullable(),
      battery_level: number().nullable(),
    }),
  ),
});

const environmentSchema = object().shape({
  cpu: object().shape({
      architecture: string().max(50).required(),
      model_name: string().max(100).required(),
      cpu_mhz: string().max(20).required(),
      load: number().required(),
    })
    .nullable(),
  memory: object().shape({
      total: number().required(),
      used: number().required(),
      free: number().required(),
      shared: number().required(),
      buff_cache: number().required(),
      available: number().required(),
    })
    .nullable(),
  storage: array()
    .max(20) // Set the maximum number of elements in the array
    .of(
      object().shape({
        used: string().max(10).required(),
        mounted_on: string().max(200).required(),
        name: string().max(100).required(),
        size: string().max(20).required(),
        use_percentage: string().max(5).required(),
        available: string().max(20).required(),
      }),
    )
    .required(),
});

const haConfigSchema = object().shape({
  version: string().max(32).nullable(),
});

const automationsSchema = object().shape({
  id: string().max(32).required(),
  alias: string().max(255).required(),
  description: string().max(4096),

  last_triggered: string().max(64).nullable(),
  friendly_name: string().max(255).nullable(),
  state: string().max(64).nullable(),
});

const scriptsSchema = object().shape({
  alias: string().max(64).required(),

  last_triggered: string().max(64).nullable(),
  friendly_name: string().max(255).nullable(),
  state: string().max(64).nullable(),
});

const scenesSchema = object().shape({
  id: string().max(64).required(),
  name: string().max(64).required(),
  friendly_name: string().max(255).nullable(),
  state: string().max(64).nullable(),
});

const observationSchema = object().shape({
  installation_id: string().max(64).required(),
  agent_version: string().max(32).required(),
  docker: object().shape({
    containers: array().max(10).of(containerSchema).required(),
  }),
  logs: string().max(64 * 1000),
  environment: environmentSchema.required(),
  zigbee: zigbeeSchema,
  ha_config: haConfigSchema.nullable(),
  automations: array().of(automationsSchema),
  scripts: array().of(scriptsSchema),
  scenes: array().of(scenesSchema),
});

export { environmentSchema, observationSchema };

