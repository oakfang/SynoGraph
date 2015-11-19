const models = require('./syno-model');

module.exports = {
  SynoGraph: require('./syno'),
  SynoModel: models.SynoModel,
  modelsFactory: models.modelsFactory
};
