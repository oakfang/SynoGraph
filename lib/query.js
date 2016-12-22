const crypto = require('crypto');
const { test: jsonTest } = require('json-predicate');
const { _mbt } = require('./model');
const q = require('./q');

const objectSignature = (object, secret) =>
  crypto.createHmac('sha256', secret)
        .update(JSON.stringify(object))
        .digest('hex');

function tokenizedSchema(schema, secret) {
  const token = objectSignature(schema, secret);
  return Object.assign({ token }, schema);
}

function validateSignedSchema(schema, secret) {
  const copy = Object.assign({}, schema);
  const token = copy.token;
  delete copy.token;
  const expected = objectSignature(copy, secret);
  return token === expected;
}

const filterToPredicate = filter => {
  const filterArray = Object.keys(filter).map(prop => {
    if (!prop.startsWith('$')) return v => v[prop] === filter[prop];
    const op = prop.substr(1);
    const val = filter[prop];
    switch (op) {
      case 'and': return v => val.map(filterToPredicate).every(p => p(v));
      case 'or': return v => val.map(filterToPredicate).some(p => p(v));
      case 'not': return v => !val.map(filterToPredicate).some(p => p(v));
      default: {
        const props = Object.keys(val);
        return v => props.every(prop => jsonTest(v, {
          op,
          path: '/' + prop,
          value: val[prop],
        }));
      }
    }
  });
  return v => filterArray.every(p => p(v));
};

const findByType = (models, { type, filter, limit }) => {
  let iter = models[type].find(filter && filterToPredicate(filter));
  if (limit) {
    iter = iter.limit(limit);
  }
  return iter;
}

function _query(g, schema, source) {
  return Array.from(source.map(v => {
    const m = schema.select.properties.reduce((ps, prop) => {
      ps[prop] = v[prop];
      return ps;
    }, {});
    Object.keys(schema.select.connections || {}).forEach(con => {
      const conSchema = schema.select.connections[con];
      const { filter, limit } = conSchema;
      let conSource = g.outEdges(v.id)
                       .filter(({ type }) => type === con)
                       .map(({ target }) => g.vertex(target));
      if (filter) conSource = conSource.filter(filterToPredicate(filter));
      if (limit) conSource = conSource.limit(limit);
      m[con] = _query(g, conSchema, conSource);
    });
    return m;
  }));
}

function query(g, schema, secret) {
  if (!validateSignedSchema(schema, secret)) throw new Error('Invalid schema');
  const models = _mbt.get(g);
  const startingWith = schema.from.pop();
  const source = schema.from.reduce((rq, step, i) => {
    const what = typeof step === 'string' ? step : step.what;
    const { filter, limit } = typeof step === 'string' ? {} : step;
    rq = rq[what];
    if (filter || limit) {
      rq = rq.where(filter ? filterToPredicate(filter) : () => true, limit);
    }
    if (i !== schema.from.length - 1) {
      rq = rq.of;
    }
    return rq;
  }, q(g, false)).startingWith(
    typeof startingWith === 'string' ?
      g.vertex(startingWith) :
      findByType(models, startingWith)
  );
  return _query(g, schema, source);
}

const queryHandler = secret => ({
  query: (g, schema) => query(g, schema, secret),
  create: schema => tokenizedSchema(schema, secret),
});

module.exports = queryHandler;