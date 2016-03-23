'use strict';

const _ = require('lodash');

function resolveStep(graph, node, path, cache) {
    if (!path || !path.length) return node;
    cache = cache || Object.create(null);
    const level = path.length;
    cache[level] = cache[level] || new Set();
    cache[level].add(node._id);

    let nodeConnections = graph.nodeTypes[node._type].connections;

    let nextStep = _.last(path);
    let property = nextStep.step;
    let filter = nextStep.filter;

    if (!nodeConnections[property] || !nodeConnections[property].collection) {
        return resolveStep(graph, node[property], _.initial(path), cache);
    } else {
        let nodes = node[property].get().filter(n => !cache[level].has(n._id) && (!filter || filter(n)));
        return _.flatten(nodes.map(node => resolveStep(graph, node, _.initial(path), cache)));
    }
}

function resolve(graph, path, noUnique) {
    const initStep = _.last(path);
    let cache = {};
    if (initStep.query && Array.isArray(initStep.step)) {
        return uniqify(noUnique, _.flatten(initStep.step.map(step => resolveStep(graph, step, _.initial(path), cache))));
    } else if (initStep.query) {
        return uniqify(noUnique, graph
                                 .queryIter(initStep.step)
                                 .map(step => resolveStep(graph, step, _.initial(path), cache))
                                 .reduce((results, cluster) => results.concat(cluster), []));
    } else {
        return uniqify(noUnique, resolveStep(graph, initStep.step, _.initial(path), cache));
    }
}

function uniqify(noUnique, results) {
    if (noUnique) return results;
    if (results.length && typeof results[0] === 'object') return _.uniq(results, '_id');
    return _.uniq(results);
}

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
  
    get(noUnique) {
        return resolve(this._graph, this._path, noUnique);
    }
}
