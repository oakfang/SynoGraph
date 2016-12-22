import test from 'ava';
import Graph from '../lib/core';
import modeler from '../lib/model';
import queryHandler from '../lib/query';

const query = queryHandler('foobar');
const falseQ = queryHandler('barfoo');

const schema = {
  select: {
    properties: ['name', 'id'],
    connections: {
      visited: {
        select: {
          properties: ['name'],
        },
        limit: 1,
      }
    },
  },
  from: [
    'friends',
    {
      what: 'friends',
      filter: {
        $contains: {
          name: 'a',
        },
      },
      limit: 5,
    },
    'visited',
    {
      type: 'Place',
      filter: {
        $starts: {
          name: 'u'
        },
      },
    },
  ],
};

test.beforeEach(t => {
  const g = new Graph();
  const model = modeler(g);

  const Person = model('Person', {
    [modeler.properties]: ['name', 'age'],
    [modeler.connections]: {
      friends: { mutual: true, collection: true },
      visited: { reverse: 'visitors', collection: true },
      bff: {},
      rulerOf: { reverse: 'ruledBy' },
    },
    get hasBff() {
      return !!this.bff;
    },

    bffify(person) {
      if (!this.friends.has(person)) {
        this.friends.add(person);
      }

      this.bff = person;
    },
  });

  const Place = model('Place', {
    [modeler.properties]: ['name'],
    [modeler.connections]: {
      visitors: { reverse: 'visited', collection: true },
      ruledBy: { reverse: 'rulerOf' },
    },
  });

  const people = [
    { name: 'foo', age: 5 },
    { name: 'bar', age: 6 },
    { name: 'spam', age: 7 },
    { name: 'buzz', age: 6 },
    { name: 'meow', age: 10 },
  ].reduce((pps, { name, age }) => {
    pps[name] = Person.create({ name, age });
    return pps;
  }, {});
  const places = ['uk', 'usa'].reduce((pls, name) => {
    pls[name] = Place.create({ name });
    return pls;
  }, {});
  people.foo.friends.add(people.bar);
  people.foo.friends.add(people.buzz);
  people.foo.friends.add(people.spam);

  people.bar.friends.add(people.spam);
  people.bar.friends.add(people.meow);

  people.spam.friends.add(people.meow);

  places.uk.visitors.add(people.foo);
  places.uk.visitors.add(people.bar);
  places.uk.visitors.add(people.spam);

  Object.keys(people)
        .map(name => people[name])
        .forEach(p => places.usa.visitors.add(p));

  t.context = g;
});

test('Apply schema to query', t => {
  const g = t.context;
  const results = query.query(g, query.create(schema));
  t.is(results.length, 4);
  t.falsy(results.find(({name}) => name === 'buzz'));
});

test('Fail to query bad token', t => {
  const g = t.context;
  const q = falseQ.create(schema);
  try {
    query.query(q);
    t.fail('Should have failed');
  } catch (e) {
    t.pass('Bad token failed');
  }
});
