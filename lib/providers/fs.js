const D = require('dumpjs');
const lzma = require('lzma');
const co = require('co');
const fs = require('then-fs');

const Graph = require('../core');

module.exports = (filePath, level=1) => co(function* () {
  const graph = new Graph();;

  const commit = () => new Promise((resolve, reject) => {
    const { _vertices, _edgesTo, _edgesFrom, _verticesTypes } = graph;
    lzma.compress(D.dump({
      _vertices,
      _edgesFrom,
      _edgesTo,
      _verticesTypes,
    }), level, (data, err) => {
      if (err) reject(err);
      fs.writeFile(filePath, new Buffer(data), { encoding: null }).then(resolve).catch(reject);
    });
  });

  try {
    const data = yield fs.readFile(filePath);
    const gdata = yield (new Promise((resolve, reject) =>
      lzma.decompress(data, (res, err) => err ? reject(err) : resolve(res)))
    );
    const gobj = D.restore(gdata);
    Object.assign(graph, gobj);
  } catch (e) {
    // this is fine
  }

  return { commit, graph };
});
