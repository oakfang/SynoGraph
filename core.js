'use strict';

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
        this._vertices.set(id, props || id);
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
        let type = this._vertices.get(id).type;
        this._verticesTypes[type].delete(id);
        let deletedEdges = new Set();
        for (let dest in this._edgesFrom.get(id)) {
            for (let type of this._edgesFrom.get(id)[dest]) {                
                deletedEdges.add({src: id, dest, type});
            }
            delete this._edgesTo.get(dest)[id];
        }
        this._edgesFrom.delete(id);
        for (let src in this._edgesTo.get(id)) {
            for (let type of this._edgesTo.get(id)[src]) {                
                deletedEdges.add({src, dest: id, type});
            }
            delete this._edgesFrom.get(src)[id];
        }
        this._edgesTo.delete(id);
        this._vertices.delete(id);
        return deletedEdges;
    }

    setEdge(src, dest, type) {
        this._edgesFrom.get(src)[dest] = (this._edgesFrom.get(src)[dest] || new Set()).add(type);
        this._edgesTo.get(dest)[src] = (this._edgesTo.get(dest)[src] || new Set()).add(type);
    }

    removeEdge(src, dest, type) {
        if (this._edgesFrom.get(src)[dest]) {
            this._edgesFrom.get(src)[dest].delete(type);
            this._edgesTo.get(dest)[src].delete(type);

            if (!this._edgesFrom.get(src)[dest].size) {
                delete this._edgesFrom.get(src)[dest];
                delete this._edgesTo.get(dest)[src];
            }
        }
    }

    hasEdge(src, dest, type) {
        return this._edgesFrom.get(src)[dest] && this._edgesFrom.get(src)[dest].has(type);
    }

    edge(src, dest, type) {
        return this.hasEdge(src, dest, type) ? {src, dest, type} : null;
    }

    outEdges(src) {
        return Object.keys(this._edgesFrom.get(src)).reduce((edges, dest) => {
            for (let type of this._edgesFrom.get(src)[dest]) edges.push({src, dest, type});
            return edges;
        }, []);
    }

    inEdges(dest) {
        return Object.keys(this._edgesTo.get(dest)).reduce((edges, src) => {
            for (let type of this._edgesTo.get(dest)[src]) edges.push({src, dest, type});
            return edges;
        }, []);
    }

    interEdges(src, dest) {
        return Array.from(this._edgesFrom.get(src)[dest] || []).map(type => ({src, dest, type}));
    }

    allEdges(id) {
        return this.inEdges(id).concat(this.outEdges(id));
    }

    vertices() {
        return this._vertices.values();
    }

    *verticesByType(type) {
        const vids = this._verticesTypes[type];
        if (!vids) return;
        for (let vid of vids) {
            yield this.vertex(vid);
        }
    }
}

module.exports = Graph;