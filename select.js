'use strict';

const _ = require('lodash');

module.exports = class Selector {
  constructor(graph, lastStep) {
    this._graph = graph;
    this._path = [{step: lastStep}];
  }

  of(step, filter) {
    this._path.push({step, filter});
    return this;
  }

  ofAny(modelQuery) {
    this._path.push({step: modelQuery, query: true});
    return this;
  }

  _uniqify(noUnique, results) {
    if (noUnique) return results;
    if (results.length && typeof results[0] === 'object') return _.uniq(results, '_id');
    return _.uniq(results);
  }

  get(noUnique) {
    var node = this._path.pop();
    var results;
    if (node.query && Array.isArray(node.step)) {
      results = _.flatten(node.step.map(node => this._get(node, this._path)));
    } else if (node.query) {
      return this._graph.query(node.step)
      .then(nodes => {
        let results = _.flatten(nodes.map(node => this._get(node, this._path)));
        return this._uniqify(noUnique, results);
      })
    } else {
      results = this._get(node.step, this._path);
    }
    return this._uniqify(noUnique, results);
  }

  _get(node, path) {
    if (!path || !path.length) return node;
    let stepObj = _.last(path);
    let step = stepObj.step;
    let filter = stepObj.filter;
    let nodeConnections = this._graph.nodeTypes[node._type].connections;

    if (!nodeConnections[step] || !nodeConnections[step].collection) {
      return this._get(node[step], _.initial(path));
    } else {
      let nodes = node[step].get();
      if (filter) nodes = nodes.filter(filter);
      return _.flatten(nodes.map(node => this._get(node, _.initial(path))));
    }
  }
}
