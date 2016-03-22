'use strict';

const Syno = require('./');

const modelsFactory = Syno.modelsFactory({
  Person: {
    properties: 'name age'.split(' '),
    connections: [
      {name: 'friends', type: 'Person', collection: true, mutual: true}
    ],
    dynamicProperties: {
      hasFriends() {
        return this.friends.get().length > 0;
      }
    }
  }
});


const graph = new Syno.Graph();
const models = modelsFactory(graph);
let person1 = models.Person({name: 'A', age: 3});
let person2 = models.Person({name: 'B', age: 6});
person1.friends.add(person2);

console.log(graph.select('name').of('friends').ofAny(models.Person.find(p => p.name.startsWith('A'))).get())
