'use strict';

const Threads = require('webworker-threads');
const _ = require('lodash');
const BSON = new (require('bson').BSONPure.BSON)();
const fs = require('fs');

const CLUSTER_ROOT_MINIMUM = 4;

class Cluster {
  constructor(graph, data) {
    this._graph = graph;
    this._data = data || Object.create(null);
  }

  static load(graph, file) {
    return new Promise((resolve, reject) => {
      fs.readFile(file, (err, data) => {
        if (err) reject(err);
        else resolve(new Cluster(graph, BSON.deserialize(data)));
      });
    });
  }

  static loadSync(graph, file) {
    return new Cluster(graph, BSON.deserialize(fs.readFileSync(file)));
  }

  save(file) {
    return new Promise((resolve, reject) => {
      fs.writeFile(
        file,
        BSON.serialize(this._data, false, true, false),
        err => err ? reject(err) : resolve()
      );
    });
  }

  init() {
    this._worker = Threads.create();
  }

  add(id) {
    this._data[id] = this._graph.getNodeById(id).type;
  }

  has(id) {
    return !!this._data[id];
  }

  getAllNodesOfType(type) {
    return Object.keys(this._data).filter(id => this._data[id] === type).map(id => {return Object.assign({id}, this._graph.getNodeById(id) || {})});
  }

  filter(query) {
    return new Promise((resolve, reject) => {
      let nodes = this.getAllNodesOfType(query.factory.type);
      this._worker.eval(`
        (function () {
          return JSON.stringify(${JSON.stringify(nodes)}.filter(${query.query}));
        })();
      `, (err, nodes) => {
        if (err) setTimeout(reject, 0, err);
        else {
          nodes = JSON.parse(nodes);
          setTimeout(resolve, 0, nodes);
        }
      })
    });
  }

  get length() {
    return Object.keys(this._data).length;
  }

  close() {
    this._worker.destroy();
  }
}

Cluster.MAX_CLUSTER_SIZE = 1000;

function createUrCluster(graph, clusters) {
  clusters = clusters || [];
  var gen = graph.iterNodes();
  var next;
  var cluster = new Cluster(graph);
  while (!(next = gen.next()).done) {
    let id = next.value;
    if (!clusters.some(c => c.has(id))) {
      cluster.add(id);
    }
  }
  return cluster;
}

function createCluster(graph, clusters) {
  clusters = clusters || [];
  var gen = graph.iterNodes();
  var next;
  var cluster;
  var mx = {
    s: CLUSTER_ROOT_MINIMUM,
    i: null
  }
  while (!(next = gen.next()).done) {
    let id = next.value;
    if (!clusters.some(c => c.has(id))) {
      let numConns = graph.getAllConnections(id).length;
      if (mx.s < numConns) {
        mx.s = numConns;
        mx.i = id;
      }
    }
  }
  if (!mx.i) return;
  cluster = new Cluster(graph);
  cluster.add(mx.i);
  let conns = graph.getAllConnections(mx.i);
  while (cluster.length < Cluster.MAX_CLUSTER_SIZE) {
    for (let id of conns) {
      if (cluster.length < Cluster.MAX_CLUSTER_SIZE && !clusters.some(c => c.has(id))) {
        cluster.add(id);
      }
    }
    conns = _(conns)
    .map(id => graph.getAllConnections(id))
    .flatten().uniq().value();
  }
  return cluster;
}

function clusterize(graph) {
  var clusters = [];
  var nodeCount = graph.graph.nodeCount();
  var stranded = false;
  while (clusters.length < Math.floor(nodeCount / Cluster.MAX_CLUSTER_SIZE)) {
    let cluster = createCluster(graph, clusters);
    if (cluster) clusters.push(cluster);
    else {
      stranded = true;
      break;
    }
  }
  if (stranded || nodeCount % Cluster.MAX_CLUSTER_SIZE) {
    clusters.push(createUrCluster(graph, clusters));
  }
  return clusters;
}

module.exports = {Cluster, clusterize, createCluster, createUrCluster};
