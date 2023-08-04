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
      lqi: yup.number().required()
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

const observationSchema = yup.object().shape({
  installation_id: yup.string().max(64).required(),
  agent_version: yup.string().max(32).required(),
  docker: yup.object().shape({
    containers: yup.array().max(10).of(containerSchema).required(), // Set the maximum number of containers in the array
  }),
  logs: yup.string().max(64000), // Set the maximum length for logs string
  environment: environmentSchema.required(),
  zigbee: zigbeeSchema,
});

module.exports = observationSchema;
