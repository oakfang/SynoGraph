function* ifilter(iterable, predicate) {
  for (const x of iterable) {
    if (predicate(x)) yield x;
  }
}

function* imap(iterable, mapper) {
  for (const x of iterable) {
    yield mapper(x);
  }
}

function* ilimit(iterable, lmt) {
  let count = 0;
  for (const x of iterable) {
    if (count++ === lmt) return;
    yield x;
  }
}

function* ijoin(iterables) {
  for (const it of iterables) {
    yield* it;
  }
}

function* iuniqueBy(iterable, prop) {
  const samples = new Set();
  for (const x of iterable) {
    if (!samples.has(x[prop])) {
      samples.add(x[prop]);
      yield x;
    }
  }
}

function iter(iterable) {
  return {
    filter(predicate) {
      return iter(ifilter(iterable, predicate));
    },

    map(mapper) {
      return iter(imap(iterable, mapper));
    },

    limit(lmt) {
      return iter(ilimit(iterable, lmt));
    },

    [Symbol.iterator]() {
      return iterable[Symbol.iterator]();
    },

    flatten() {
      return iter(ijoin(iterable));
    },

    first() {
      for (const r of iterable) return r;
    },

    uniqueBy(prop) {
      return iter(iuniqueBy(iterable, prop));
    },
  };
}

module.exports = iter;
