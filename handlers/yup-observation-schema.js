const yup = require('yup');

const containerSchema = yup.object().shape({
  name: yup.string().max(100).required(),
  image: yup.string().max(200).required(),
  running: yup.boolean().required(),
  restarting: yup.string().max(200).required(),
  state: yup.string().max(200).required(),
  status: yup.string().max(200).required(),
  started_at: yup.string().max(200).required(),
  finished_at: yup.string().max(200).required(),
});

const zigbeeSchema = yup.object().shape({
  devices: yup.array().of(
    yup.object().shape({
      ieee: yup.string().max(64).required(),
      brand: yup.string().max(64).required(),
      entity_name: yup.string().max(64).required(),
      last_updated: yup.string().max(64).required(),
      lqi: yup.number().required(),
      integration_type: yup.string().max(32).required(),
      power_source: yup.string().max(32).nullable(),
      name_by_user: yup.string().max(128).nullable(),
      battery_level: yup.number().nullable(),
    }),
  ),
});

const environmentSchema = yup.object().shape({
  cpu: yup.object().shape({
    architecture: yup.string().max(50).required(),
    model_name: yup.string().max(100).required(),
    cpu_mhz: yup.string().max(20).required(),
    load: yup.number().required(),
  }),
  memory: yup.object().shape({
    total: yup.number().required(),
    used: yup.number().required(),
    free: yup.number().required(),
    shared: yup.number().required(),
    buff_cache: yup.number().required(),
    available: yup.number().required(),
  }),
  storage: yup
    .array()
    .max(20) // Set the maximum number of elements in the array
    .of(
      yup.object().shape({
        used: yup.string().max(10).required(),
        mounted_on: yup.string().max(200).required(),
        name: yup.string().max(100).required(),
        size: yup.string().max(20).required(),
        use_percentage: yup.string().max(5).required(),
        available: yup.string().max(20).required(),
      }),
    )
    .required(),
});

const haConfigSchema = yup.object().shape({
  version: yup.string().max(32).nullable(),
});

const automationsSchema = yup.object().shape({
  id: yup.string().max(32).required(),
  alias: yup.string().max(255).required(),
  description: yup.string().max(4096),

  last_triggered: yup.string().max(64).nullable(),
  friendly_name: yup.string().max(255).nullable(),
  state: yup.string().max(64).nullable(),
});

const scriptsSchema = yup.object().shape({
  alias: yup.string().max(64).required(),

  last_triggered: yup.string().max(64).nullable(),
  friendly_name: yup.string().max(255).nullable(),
  state: yup.string().max(64).nullable(),
});

const scenesSchema = yup.object().shape({
  id: yup.string().max(64).required(),
  name: yup.string().max(64).required(),
  friendly_name: yup.string().max(255).nullable(),
  state: yup.string().max(64).nullable(),
});

const observationSchema = yup.object().shape({
  installation_id: yup.string().max(64).required(),
  agent_version: yup.string().max(32).required(),
  docker: yup.object().shape({
    containers: yup.array().max(10).of(containerSchema).required(),
  }),
  logs: yup.string().max(64 * 1000),
  environment: environmentSchema.required(),
  zigbee: zigbeeSchema,
  ha_config: haConfigSchema.nullable(),
  automations: yup.array().of(automationsSchema),
  scripts: yup.array().of(scriptsSchema),
  scenes: yup.array().of(scenesSchema),
});

module.exports = observationSchema;
