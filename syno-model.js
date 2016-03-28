'use strict';

const _ = require('lodash');
const Iterator = require('itercol');

function SynoModel(synoGraph, nodeType, properties) {
  properties = properties || {};
  properties.connections = properties.connections || [];
  properties.properties = new Set(properties.properties || []);
  properties.dynamicProperties = properties.dynamicProperties || {};
  let mixins = properties.mixins;
  if (mixins) {
    mixins.forEach(mix => mix(properties));
  }
  synoGraph.nodeTypes[nodeType] = Factory;
  var connections = properties.connections;
  function Factory (props, _id) {
    if (typeof props === 'string') {
      _id = props;
      props = synoGraph.graph.vertex(_id);
    } else if (!_id) {
      _id = synoGraph.createNode(nodeType, props);
    }
    props = _.union(Object.keys(props), Array.from(properties.properties));

    var instance = Object.create(null);

    instance._id = _id;
    instance._type = nodeType;
    instance.remove = () => synoGraph.deleteNode(_id);
    instance.toJS = () => Object.keys(properties.dynamicProperties).reduce((properties, prop) => {
      if (!typeof instance[prop] === 'function') properties[prop] = instance[prop];
      return properties;
    }, props.reduce((properties, prop) => {
      properties[prop] = instance[prop];
      return properties;
    }, {id: _id, type: nodeType}));

    props.forEach(prop => {
      Object.defineProperty(instance, prop, {
        get() {
          return synoGraph.graph.vertex(_id)[prop];
        },
        set(val) {
          synoGraph.updateNode(_id, {[prop]: val});
        }
      });
    });

    _.forEach(properties.dynamicProperties, (getter, prop) => {
      Object.defineProperty(instance, prop, {get: getter.bind(instance)});
    });

    connections.forEach(connection => {
      let conn = connection.name;
      let type = connection.type;
      let isCollection = connection.collection || false;
      let reverse = (connection.mutual && conn) || connection.reverse || false;
      if (!isCollection) {
        Object.defineProperty(instance, conn, {
          get() {
            let nodes = synoGraph.graph.outEdges(_id)
            .filter(e => e.type === conn)
            .map(e => synoGraph.getNodeById(e.dest));
            return nodes.length ? nodes[0] : null;
          },
          set(node) {
            var remove = !node;
            if (remove) {
              node = instance[conn];
              synoGraph.removeEdge(_id, node._id, conn);
            } else {
              synoGraph.makeEdge(_id, node._id, conn);
            }
            if (reverse) {
              (remove ?
                synoGraph.removeEdge(node._id, _id, conn) :
                synoGraph.makeEdge(node._id, _id, reverse));
            }
          }
        });
      } else {
        instance[conn] = {
          get() {
            return synoGraph.graph.outEdges(_id)
            .filter(e => e.type === conn)
            .map(e => synoGraph.getNodeById(e.dest));
          },
          getIter() {
            return (new Iterator(synoGraph.graph.outEdges(_id)))
            .filter(e => e.type === conn)
            .map(e => synoGraph.getNodeById(e.dest));
          },
          add(node) {
            synoGraph.makeEdge(_id, node._id, conn);
            if (reverse) synoGraph.makeEdge(node._id, _id, reverse);
          },
          remove(node) {
            synoGraph.removeEdge(_id, node._id, conn);
            if (reverse) synoGraph.removeEdge(node._id, _id, reverse);
          },
          has(node) {
            return synoGraph.graph.hasEdge(_id, node._id, conn);
          }
        };
      }
    });
    return instance;
  }

  Factory.connections = connections.reduce((conns, con) => {
    conns[con.name] = con;
    return conns;
  }, {});

  Object.defineProperty(Factory, 'type', {value: nodeType});

  Factory.find = function (filter, limit) {
    return {
      query: filter || (() => true),
      limit: limit || 0,
      factory: Factory
    }
  };
  return Factory;
}


function modelsFactory(models) {
  return function (graph) {
    return _.mapValues(models, (props, type) => SynoModel(graph, type, props));
  }
}

module.exports = {
  SynoModel,
  modelsFactory
}
