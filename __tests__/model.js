import test from 'ava';
import modeler from '../lib/model';
import Graph from '../lib/core';

test.beforeEach(t => {
  const g = new Graph();
  const model = modeler(g);

  const Person = model('Person', {
    [modeler.properties]: ['name', 'age'],
    [modeler.connections]: {
      friends: { mutual: true, collection: true },
      visited: { reverse: 'visitors', collection: true },
      bff: {},
      mayorOf: { reverse: 'mayor' },
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
      mayor: { reverse: 'mayorOf' },
    },
  });

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

  t.context.g = g;
  t.context.models = { Person, Place };
  Object.assign(t.context, { foo, bar, uk });
});

const validateModel = (t, scenario) => {
  try {
    scenario();
    t.fail('Should have failed');
  } catch (e) {
    t.pass();
  }
};

test('Check initial state', t => {
  const { foo, bar, uk } = t.context;
  t.is(Array.from(foo.friends.get()).length, 0);
  t.is(Array.from(bar.friends.get()).length, 0);
  t.is(Array.from(uk.visitors.get()).length, 0);
});

test('Invalid models', t => {
  const { foo } = t.context;
  validateModel(t, () => foo.visited.add({}));
  validateModel(t, () => foo.visited.has({}));
  validateModel(t, () => foo.visited.remove({}));
  validateModel(t, () => foo.bff = {});
});

test('Interactions', t => {
  const { foo, bar, uk } = t.context;
  foo.visited.add(uk);
  t.is(Array.from(uk.visitors.get()).length, 1);
  t.is(foo.hasBff, false);
  foo.bffify(bar);
  bar.bffify(foo);
  foo.mayorOf = uk;
  t.is(uk.mayor.name, 'foo');
  t.is(foo.hasBff, true);
  t.is(foo.bff.name, 'bar');
  bar.name = 'lolz';
  t.is(foo.bff.name, 'lolz');
});

test('Query', t => {
  const { Person } = t.context.models;
  for (const p of Person.find()) {
    t.is(p.name, Person.get(p.id).name);
  }

  t.is(Array.from(Person.find(({ age }) => age > 6)).length, 1);
  t.is(Array.from(Person.find()).length, 2);
});

test('Remove connections', t => {
  const { foo, bar, uk } = t.context;
  foo.visited.add(uk);
  foo.bffify(bar);
  foo.mayorOf = uk;
  foo.bff = null;
  foo.mayorOf = null;
  t.is(foo.hasBff, false);
  t.falsy(uk.mayor);
  foo.visited.remove(uk);
  t.is(uk.visitors.has(foo), false);
});

test('.toJS', t => {
  const { foo } = t.context;
  t.is(JSON.parse(JSON.stringify(foo.toJS())).name, 'foo');
});

test('.remove', t => {
  const { Person } = t.context.models;
  const { bar } = t.context;
  bar.remove();
  t.is(Array.from(Person.find(({ age }) => age > 6)).length, 0);
});
