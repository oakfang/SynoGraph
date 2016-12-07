import test from 'ava';
import Graph from '../lib/core';
import modeler from '../lib/model';
import q from '../lib/q';

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

  t.context = { g, Person, Place };
});

test('Simple query', t => {
  const { g, Person, Place } = t.context;
  const foo = Person.create({
    name: 'foo',
    age: 5,
  });

  const bar = Person.create({
    name: 'bar',
    age: 7,
  });

  const uk = Place.create({
    name: 'UK',
  });

  foo.visited.add(uk);
  foo.bffify(bar);
  bar.bffify(foo);
  foo.rulerOf = uk;
  const res = Array.from(q(g).bff.of.visited.of.ruledBy.startingWith(foo));
  t.is(res.length, 1);
  t.is(res[0].name, 'bar');
});

test('Complex query', t => {
  const { g, Person, Place } = t.context;
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
  const query = q(g).friends
                    .of
                    .friends
                    .where(({ name }) => name.includes('a'), 5)
                    .who
                    .visited;
  const res1 = Array.from(query.startingWith(Place.find(({ name }) => name.startsWith('u'))));
  t.is(res1.length, 4);
});
