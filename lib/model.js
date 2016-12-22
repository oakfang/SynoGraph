const uuid = require('uuid').v4;

const CON_SYM = Symbol('syno/model/connections');
const PROPS_SYM = Symbol('syno/model/props');
const INST_SYM = Symbol('syno/model/instance');

const getId = uuid;

const modelsByGraph = new WeakMap();

function modelConnectionCollection(graph, vid, name, { mutual, reverse }) {
  const factories = modelsByGraph.get(graph);
  const para = mutual ? name : reverse;
  return {
    get() {
      return graph.outEdges(vid)
                  .filter(({ type }) => type === name)
                  .map(({ target }) => {
                    const { type } = graph.vertex(target);
                    return factories[type](target);
                  });
    },

    has(model) {
      if (!model[INST_SYM]) throw new Error('Not a model');
      return graph.hasEdge(vid, model.id, name);
    },

    add(model) {
      if (!model[INST_SYM]) throw new Error('Not a model');
      graph.setEdge(vid, model.id, name);
      if (para) {
        graph.setEdge(model.id, vid, para);
      }
    },

    remove(model) {
      if (!model[INST_SYM]) throw new Error('Not a model');
      graph.removeEdge(vid, model.id, name);
      if (para) {
        graph.removeEdge(model.id, vid, para);
      }
    },
  };
}

function modelConnection(graph, vid, name, { mutual, reverse }) {
  const factories = modelsByGraph.get(graph);
  const para = mutual ? name : reverse;
  return {
    get() {
      const tid = graph.outEdges(vid)
                        .filter(({ type }) => type === name)
                        .map(({ target }) => target)
                        .first();
      if (!tid) return;
      const { type } = graph.vertex(tid);
      return factories[type](tid);
    },

    set(model) {
      if (model && !model[INST_SYM]) throw new Error('Not a model');
      if (model) {
        graph.setEdge(vid, model.id, name);
        if (para) {
          graph.setEdge(model.id, vid, para);
        }
      } else {
        const model = this[name];
        if (!model) return;
        const tid = model.id;
        graph.removeEdge(vid, tid, name);
        if (para) {
          graph.removeEdge(tid, vid, para);
        }
      }

      return true;
    },
  };
}

function modelProperty(vertex, prop) {
  return {
    get() {
      return vertex[prop];
    },

    set(value) {
      vertex[prop] = value;
      return true;
    },
  };
}

function modelInstance(graph, vid, descs, methods, conns, props) {
  const vertex = graph.vertex(vid);
  const prototypeDescriptors = Object.assign(
  props.reduce((ps, prop) => {
    ps[prop] = modelProperty(vertex, prop);
    return ps;
  }, {}),
  Object.keys(conns).reduce((cs, name) => {
    if (!conns[name].collection) {
      cs[name] = modelConnection(graph, vid, name, conns[name]);
    }

    return cs;
  }, {}),
  descs);
  const prototype = Object.assign(Object.keys(conns).reduce((cs, name) => {
    if (conns[name].collection) {
      cs[name] = modelConnectionCollection(graph, vid, name, conns[name]);
    }

    return cs;
  }, {}), methods);
  const instance = Object.create(prototype, prototypeDescriptors);
  instance[INST_SYM] = true;
  return instance;
}

module.exports = graph => (type, proto) => {
  const conns = proto[CON_SYM] || {};
  const properties = (proto[PROPS_SYM] || []).concat(['type', 'id']);
  const descs = Object.getOwnPropertyNames(proto).reduce((ds, name) => {
    ds[name] = Object.getOwnPropertyDescriptor(proto, name);
    return ds;
  }, {});
  const methods = Object.keys(proto).reduce((ms, name) => {
    if (!descs[name]) ms[name] = proto[name];
    return ms;
  }, {

    toJS() {
      return properties.reduce((o, prop) => {
        o[prop] = this[prop];
        return o;
      }, {});
    },

    remove() {
      graph.removeVertex(this.id);
    },
  });

  const factory = vid => modelInstance(
    graph,
    vid,
    descs,
    methods,
    conns,
    properties
  );

  factory.create = props => {
    const vid = getId();
    graph.setVertex(vid, type, props);
    return factory(vid);
  };

  factory.find = (predicate=() => true) =>
    graph
    .vertices(type)
    .map(({ id }) => factory(id))
    .filter(predicate);

  let mbt = modelsByGraph.get(graph);
  if (!mbt) mbt = {};
  mbt[type] = factory;
  modelsByGraph.set(graph, mbt);

  return factory;
};

module.exports.connections = CON_SYM;
module.exports.properties = PROPS_SYM;
module.exports._mbt = modelsByGraph;
