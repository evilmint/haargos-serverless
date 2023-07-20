
const yup = require('yup');

const containerSchema = yup.object().shape({
  name: yup.string().max(100).required(),
  image: yup.string().max(200).required(),
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
      })
    )
    .required(),
});

const authSchema = yup.object().shape({
  token: yup.string().max(200).required(),
  user_id: yup.string().max(200).required(),
});

const observationSchema = yup.object().shape({
  auth: authSchema.required(),
  docker: yup.object().shape({
    containers: yup.array().max(10).of(containerSchema).required(), // Set the maximum number of containers in the array
  }),
  logs: yup.string().max(64000).required(), // Set the maximum length for logs string
  environment: environmentSchema.required(),
});

module.exports = observationSchema;