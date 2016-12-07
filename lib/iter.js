function iter(iterable) {
  return {
    filter(predicate) {
      return iter((function* () {
        for (const x of iterable) {
          if (predicate(x)) yield x;
        }
      })());
    },

    map(mapper) {
      return iter((function* () {
        for (const x of iterable) {
          yield mapper(x);
        }
      })());
    },

    limit(lmt) {
      return iter((function* () {
        let count = 0;
        for (const x of iterable) {
          if (count++ === lmt) return;
          yield x;
        }
      })());
    },

    [Symbol.iterator]() {
      return iterable[Symbol.iterator]();
    },
  };
}

module.exports = iter;
