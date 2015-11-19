'use strict';

const fs = require('fs');
const BSON = new (require('bson').BSONPure.BSON)();
const graphlib = require('graphlib');
const uuid = require('node-uuid').v4;
const glob = require('glob');
const _ = require('lodash');
const EventEmitter = require('events').EventEmitter;
const process = require('process');

const cluster = require('./cluster');
const Selector = require('./select');

const SAVE_INTERVAL = 3000;

class SynoGraph extends EventEmitter {
  static load(file, clusterPattern) {
    return new Promise((resolve, reject) => {
      fs.readFile(file, (err, data) => {
        if (err) reject(err);
        else resolve(new SynoGraph(graphlib.json.read(BSON.deserialize(data)), file, clusterPattern));
      });
    });
  }

  static loadSync(file, clusterPattern) {
    return new SynoGraph(graphlib.json.read(BSON.deserialize(fs.readFileSync(file))), file, clusterPattern);
  }

  constructor(graph, persistTo, clusterPattern) {
    super();
    this.graph = graph || new graphlib.Graph({multigraph: true});
    this.nodeTypes = {};

    if (persistTo) this._setPersistMode(persistTo);

    if (clusterPattern) {
      this._setClusterMode(clusterPattern);
    } else {
      this._usingClusters = false;
    }
  }

  _persist() {
    return this.save().then(() => this.emit('persist-end'));
  }

  _setPersistMode(persistTo) {
    this._path = persistTo;
    this.on('change', _.debounce(() => this._persist(), SAVE_INTERVAL));
    process.on('SIGINT', () => {
      this._persist().then(() => process.exit());
    });
  }

  _setClusterMode(clusterPattern) {
    this._usingClusters = true;
    this._clusterPromises = new Promise((resolve, reject) => {
      glob.glob(clusterPattern, (err, clusterPaths) => err ? reject(err) : resolve(clusterPaths));
    })
    .then(clusterPaths => Promise.all(clusterPaths.map(file => cluster.Cluster.load(this, file))))
    .then(clusters => {
      this._clusters = clusters;
      let urCluster = cluster.createUrCluster(this, clusters);
      this._clusters.push(urCluster);
      this._clusters.forEach(c => c.init());
      this.on('change', event => {
        if (event.type === 'CREATE-NODE') {
          urCluster.add(event.payload.id);
        }
      });
    });
  }

  _queryAllGraph(q) {
    return new Promise((resolve) => {
      var results = [];
      var gen = this.iterNodes();
      var next;
      while (!(next = gen.next()).done) {
        let node = q.factory(next.value);
        if (q.query(node)) {
          results.push(node);
          if (results.length === q.limit) {
            return results;
          }
        }
      }
      resolve(results);
    });
  }

  _queryClusters(q) {
    return this._clusterPromises
    .then(() => {
      return Promise.all(this._clusters.map(c => c.filter(q)));
    })
    .then(results => _.pluck(_.flatten(results), 'id').map(q.factory));
  }

  close() {
    if (this._usingClusters) {
      this._clusterPromises.then(() => this._clusters.forEach(c => c.close()));
    }
  }

  clusterize(prefix) {
    prefix = prefix || 'cluster';
    return Promise.all(cluster.clusterize(this).map((c, i) => c.save(`${prefix}-${i}.ctr`)));
  }

  save(file) {
    file = file || this._path;
    return new Promise((resolve, reject) => {
      fs.writeFile(
        file,
        BSON.serialize(graphlib.json.write(this.graph), false, true, false),
        err => err ? reject(err) : resolve()
      );
    });
  }

  createNode(type, props) {
    props = props || {};
    const id = uuid();
    this.graph.setNode(id, Object.assign({type}, props));
    this.emit('change', {type: 'CREATE-NODE', payload: {id}});
    return id;
  }

  updateNode(id, props) {
    props = props || {};
    let oldValues = this.graph.node(id)
    this.graph.setNode(id, Object.assign({}, oldValues, props));
    this.emit('change', {type: 'UPDATE-NODE', payload: {id, oldValues}});
    return true;
  }

  deleteNode(id) {
    let props = this.getNodeById(id);
    this.graph.removeNode(id);
    this.emit('change', {type: 'DELETE-NODE', payload: {props, id}});
  }

  makeEdge(source, dest, type, props) {
    props = props || {};
    this.graph.setEdge(source, dest, props, type);
    this.emit('change', {type: 'MAKE-EDGE', payload: {source, dest, type}});
  }

  removeEdge(source, dest, type) {
    let props = this.getEdge(source, dest, type);
    this.graph.removeEdge(source, dest, type);
    this.emit('change', {type: 'DELETE-EDGE', payload: {source, dest, type, props}});
  }

  getNodeById(id) {
    return this.graph.node(id);
  }

  getEdge(source, dest, type) {
    return this.graph.edge({v: source, w: dest, name: type});
  }

  getAllEdges(source, dest) {
    return this.this.graph.outEdges(source)
    .filter(e => e.w === dest)
    .map(e => Object.assign({type: e.name}, this.graph.edge({v: source, w: dest, name: e.name})));
  }

  getAllConnections(id) {
    return _.uniq(
      _.pluck(this.graph.inEdges(id), 'v')
      .concat(_.pluck(this.graph.outEdges(id), 'w'))
    );
  }

  select(step) {
    return new Selector(this, step);
  }

  *iterNodes() {
    for (let nodeId in this.graph._nodes) {
      if (this.graph._nodes.hasOwnProperty(nodeId)) {
        yield nodeId;
      }
    }
  }

  query(q) {
    if (this._usingClusters) {
      return this._queryClusters(q);
    }
    return this._queryAllGraph(q);
  }

  atom(callback) {
    var actions = [];
    var record = event => actions.push(event);
    this.on('change', record);
    try {
      callback();
      this.removeListener('change', record);
      return null;
    } catch (err) {
      this.removeListener('change', record);
      while (actions.length) {
        let action = actions.pop();
        switch (action.type) {
          case 'CREATE-NODE':
            this.deleteNode(action.payload.id);
            break;
          case 'UPDATE-NODE':
            this.updateNode(action.payload.id, action.payload.oldValues);
            break;
          case 'DELETE-NODE':
            this.updateNode(action.payload.id, action.payload.props);
            break;
          case 'MAKE-EDGE':
            this.removeEdge(action.payload.source, action.payload.dest, action.payload.type);
            break;
          case 'DELETE-EDGE':
            this.makeEdge(action.payload.source, action.payload.dest, action.payload.type, action.payload.props);
            break;
        }
      }
      return err;
    }
  }
}

module.exports = SynoGraph;
