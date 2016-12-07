const { _mbt } = require('./model');
const iter = require('./iter');

function* flatMap(iters) {
  for (const it of iters) {
    yield* it;
  }
}

function* uniqueById(iterable) {
  const ids = new Set();
  for (const x of iterable) {
    if (!ids.has(x.id)) {
      ids.add(x.id);
      yield x;
    }
  }
}

function subQuery(graph, models, stack) {
  const base = {
    startingWith(m) {
      const stk = stack.slice();
      let it = iter(m[Symbol.iterator] ? m : [m]);
      while (stk.length) {
        const { name, filter, limit } = stk.pop();
        it = iter(uniqueById(flatMap(it.map(({ id }) => {
          let sub = graph.inEdges(id)
                         .filter(({ type }) => type === name)
                         .map(({ origin }) => graph.vertex(origin));
          if (filter) sub = sub.filter(filter);
          if (limit) sub = sub.limit(limit);
          return sub;
        }))));
      }

      if (models) {
        it = it.map(({ id, type }) => models[type](id));
      }

      return it;
    },

    where(filter, limit) {
      const { name } = stack[stack.length - 1];
      return subQuery(graph, models, stack.slice(0, -1).concat([{
          name,
          filter,
          limit,
        },
      ]));
    },
  };
  const props = ['of', 'that', 'who', 'which'].reduce((ps, n) => {
    ps[n] = {
      get: () => new Proxy({}, {
        get(t, name) {
          return subQuery(graph, models, stack.concat([{ name }]));
        },
      }),
    };
    return ps;
  }, {});
  return Object.defineProperties(base, props);
}

module.exports = graph => subQuery(graph, _mbt.get(graph), []).of;
