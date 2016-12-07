const iter = require('./iter');

function* getEdges(source, edges, isOrigin) {
  for (const other in edges) {
    for (const type of edges[other]) {
      yield {
        origin: isOrigin ? source : other,
        target: isOrigin ? other : source,
        type,
      };
    }
  }
}

function* getAllEdges(graph, id) {
  yield* graph.outEdges(id);
  yield* graph.inEdges(id);
}

class Graph {
  constructor() {
    this._vertices = new Map();
    this._edgesFrom = new Map();
    this._edgesTo = new Map();
    this._verticesTypes = Object.create(null);
  }

  setVertex(id, type, props) {
    if (!this._vertices.has(id)) {
      this._edgesTo.set(id, Object.create(null));
      this._edgesFrom.set(id, Object.create(null));
    }

    this._vertices.set(id, Object.assign({ type, id }, props || {}));
    if (!this._verticesTypes[type]) this._verticesTypes[type] = new Set();
    this._verticesTypes[type].add(id);
  }

  vertex(id) {
    return this._vertices.get(id);
  }

  hasVertex(id) {
    return this._vertices.has(id);
  }

  removeVertex(id) {
    const type = this._vertices.get(id).type;
    this._verticesTypes[type].delete(id);
    const deletedEdges = new Set();
    for (const { origin, target, type } of this.outEdges(id)) {
      this.removeEdge(origin, target, type);
      deletedEdges.add({ origin, target, type });
    }

    for (const { origin, target, type } of this.inEdges(id)) {
      this.removeEdge(origin, target, type);
      deletedEdges.add({ origin, target, type });
    }

    this._edgesFrom.delete(id);
    this._edgesTo.delete(id);
    this._vertices.delete(id);
    return deletedEdges;
  }

  setEdge(origin, target, type) {
    this._edgesFrom.get(origin)[target] = (
      this._edgesFrom.get(origin)[target] || new Set()
    ).add(type);
    this._edgesTo.get(target)[origin] = (
      this._edgesTo.get(target)[origin] || new Set()
    ).add(type);
  }

  removeEdge(origin, target, type) {
    if (this._edgesFrom.get(origin)[target]) {
      this._edgesFrom.get(origin)[target].delete(type);
      this._edgesTo.get(target)[origin].delete(type);

      if (!this._edgesFrom.get(origin)[target].size) {
        delete this._edgesFrom.get(origin)[target];
        delete this._edgesTo.get(target)[origin];
      }
    }
  }

  hasEdge(origin, target, type) {
    return (this._edgesFrom.has(origin) &&
            this._edgesFrom.get(origin)[target] &&
            this._edgesFrom.get(origin)[target].has(type)) || false;
  }

  edge(origin, target, type) {
    return this.hasEdge(origin, target, type) ? { origin, target, type } : null;
  }

  outEdges(origin) {
    const edges = this._edgesFrom.get(origin);
    return iter(getEdges(origin, edges, true));
  }

  inEdges(target) {
    const edges = this._edgesTo.get(target);
    return iter(getEdges(target, edges, false));
  }

  interEdges(origin, target) {
    return this.outEdges(origin).filter(e => e.target === target);
  }

  allEdges(id) {
    return iter(getAllEdges(this, id));
  }

  vertices(type) {
    if (type) {
      return iter(this._verticesTypes[type]).map(id => this.vertex(id));
    }

    return iter(this._vertices.values());
  }
}

module.exports = Graph;
