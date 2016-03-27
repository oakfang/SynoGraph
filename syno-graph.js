'use strict';

const EventEmitter = require('events').EventEmitter;

const uuid = require('node-uuid').v4;
const _ = require('lodash');

const Graph = require('./core');
const Iterator = require('./gentools');
const Selector = require('./select');
const models = require('./syno-model');

class SynoGraph extends EventEmitter {
    constructor(modelsScheme) {
        super();
        this.graph = new Graph();
        this.nodeTypes = Object.create(null);
        models.modelsFactory(modelsScheme)(this);
        for (let type in this.nodeTypes) {
            Object.defineProperty(this, type, {
                value: this.nodeTypes[type]
            });
        }
    }

    createNode(type, props) {
        props = props || {};
        const id = uuid();
        this.graph.setVertex(id, type, Object.assign({type, id}, props));
        this.emit('change', {type: 'CREATE-NODE', payload: {id}});
        return id;
    }

    updateNode(id, props) {
        props = props || {};
        let oldValues = this.graph.vertex(id);
        this.graph.setVertex(id, oldValues.type, Object.assign({}, oldValues, props));
        this.emit('change', {type: 'UPDATE-NODE', payload: {id, oldValues}});
        return true;
    }

    deleteNode(id) {
        let props = this.graph.vertex(id);
        let edges = this.graph.removeVertex(id);
        this.emit('change', {type: 'DELETE-NODE', payload: {props, id, edges}});
    }

    makeEdge(source, dest, type) {
        this.graph.setEdge(source, dest, type);
        this.emit('change', {type: 'MAKE-EDGE', payload: {source, dest, type}});
    }

    removeEdge(source, dest, type) {
        this.graph.removeEdge(source, dest, type);
        this.emit('change', {type: 'DELETE-EDGE', payload: {source, dest, type}});
    }

    getNodeById(id) {
        let v = this.graph.vertex(id); 
        const nodeType = this.nodeTypes[v.type];
        return nodeType(id);
    }

    getEdge(source, dest, type) {
        return this.graph.edge(source, dest, type);
    }

    getAllEdges(source, dest) {
        return this.graph.interEdges(source, dest);
    }

    getAllConnections(id) {
        return this.graph.allEdges(id);
    }

    iterNodes() {
        return (new Iterator(this.graph._vertices.keys())).map(id => this.getNodeById(id));
    }

    select(step) {
        return new Selector(this, step);
    }

    query(q) {
        return Array.from(this.queryIter(q));
    }

    queryIter(q) {
        const graph = this.graph;
        return new Iterator(function* () {
            let count = 0;
            for (let nodeV of graph.verticesByType(q.factory.type)) {
                const node = q.factory(nodeV, nodeV.id);
                if (q.query(node)) {
                    count++;
                    yield node;
                    if (count === q.limit) return;
                }
            }
            return;
        }());
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
                      for (let edge of action.payload.edges) this.makeEdge(edge.src, edge.dest, edge.type);
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