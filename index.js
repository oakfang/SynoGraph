const models = require('./syno-model');

module.exports = {
    Graph: require('./syno-graph'),
    PersistentGraph: require('./persist-lzma'),
    Model: models.SynoModel,
    modelsFactory: models.modelsFactory
};
