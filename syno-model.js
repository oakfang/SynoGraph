'use strict';

const _ = require('lodash');

module.exports = function registerNodeType(synoGraph, nodeType, properties) {
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
      props = synoGraph.getNodeById(_id)
    } else {
      _id = synoGraph.createNode(nodeType, props);
    }
    props = _.union(Object.keys(props), Array.from(properties.properties));

    var instance = Object.create(null);

    instance._id = _id;
    instance._type = nodeType;
    instance.remove = function () {
      synoGraph.deleteNode(_id);
    }

    Object.defineProperty(instance, '$$strength', {get() {
      return synoGraph.graph.inEdges(_id).concat(synoGraph.graph.outEdges(_id)).length;
    }});
    props.forEach(prop => {
      Object.defineProperty(instance, prop, {
        get() {
          return synoGraph.getNodeById(_id)[prop];
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
            .filter(e => e.name === conn)
            .map(e => synoGraph.nodeTypes[type || synoGraph.getNodeById(e.w).type](e.w));
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
            .filter(e => e.name === conn)
            .map(e => synoGraph.nodeTypes[type || synoGraph.getNodeById(e.w).type](e.w));
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

  Factory.find = function (filter, limit) {
    return {
      query(node) {
        return node.type === nodeType && filter(node);
      },
      limit: limit || 0,
      factory: Factory
    }
  };
  return Factory;
}
