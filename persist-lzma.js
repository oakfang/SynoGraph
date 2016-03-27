'use strict';

const fs = require('fs');
const process = require('process');
const lzma = require('lzma');
const D = require('dumpjs');
const _ = require('lodash');
const CoreGraph = require('./core');
const SynoGraph = require('./syno-graph');

const SAVE_INTERVAL = 3000;

module.exports = class PersistentGraph extends SynoGraph {
    constructor(modelsScheme, persistencePath, level) {
        super(modelsScheme);
        this._level = level || 9;
        this._persistPath = persistencePath;
        let waitForSave = null;
        const save = () => {
            if (waitForSave) waitForSave = waitForSave.then(this._persist);
            else waitForSave = this._persist().then(() => waitForSave = null);
        };
        process.on('SIGINT', () => {
            save();
            waitForSave.then(() => process.exit());
        });
        this.on('change', _.debounce(save, SAVE_INTERVAL));
    }

    _persist() {
        return new Promise((resolve, reject) => {
            lzma.compress(D.dump({
                _vertices: this.graph._vertices,
                _edgesFrom: this.graph._edgesFrom,
                _edgesTo: this.graph._edgesTo,
                _verticesTypes: this.graph._verticesTypes 
            }), this._level, (data, err) => {
                if (err) reject(err);
                fs.writeFile(this._persistPath, new Buffer(data), {encoding: null}, err => err ? reject(err) : resolve());
            });
        }).then(() => this.emit('persist-end')).catch(err => this.emit('error', err));
    }

    static start(modelsScheme, persistencePath, level) {
        return new Promise((resolve, reject) => {
            fs.access(persistencePath, err => {
                if (err) return resolve(new PersistentGraph(modelsScheme, persistencePath, level));
                fs.readFile(persistencePath, (err, dataBuffer) => {
                    if (err) reject(err);
                    lzma.decompress(dataBuffer, (result, err) => {
                        if (err) return reject(err);
                        const data = D.restore(result);
                        let cGraph = new CoreGraph();
                        cGraph._vertices = data._vertices;
                        cGraph._edgesTo = data._edgesTo;
                        cGraph._edgesFrom = data._edgesFrom;
                        cGraph._verticesTypes = data._verticesTypes;
                        let pGraph = new PersistentGraph(modelsScheme, persistencePath, level);
                        pGraph.graph = cGraph;
                        resolve(pGraph);
                    });
                });
            });            
        });
    }
}
