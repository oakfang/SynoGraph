# SynoGraph
### A Graph DB for humans, via NodeJS

SynoGraph is a feature-packed GDB for use with NodeJS, natively.

### SynoGraph basic API

#### SynoGraph(graph:optional[graphlib.Graph], persistTo:optional[String])
```js
var g = new SynoGraph(null, 'data.bson');
```
Create a new graph object.
Passing no params to constructor will result in a new, in memory, graph.
The first parameter is reserved for a `graphlib` graph, so pass a `null` if you don't know what that is. The second parameter is the file the SG should persist itself to after every change and before exit.

#### SynoGraph.load(path:String, callback)
```js
SynoGraph.load('data.bson', g => {
  // use graph here
});
```
Load the SynoGraph from file.

#### SynoGraph.loadSync(path:String)
```js
var g = SynoGraph.loadSync('data.bson');
// use graph object here
```
Load the SynoGraph from file, syncly.

#### SynoGraph::save(path:optional[String])
```js
g.save().then(() =] console.log('Data saved'));
```
Persist the graph manually to a path (defaults to the `persistTo` path).
Returns a Promise.

#### SynoGraph::createNode(type:String, props:Object)
Create a graph node of type `type` with properties `props`, extended with type.
Returns the node's ID.

#### SynoGraph::updateNode(id:String, props:Object)
Update a node's properties (merged, not replaced).
`id` is the node's ID.

#### SynoGraph::deleteNode(id:String)
Delete a node from the graph.
`id` is the node's ID.

#### SynoGraph::makeEdge(source:String, dest:String, type:String, props:optional[Object])
Create an edge of type `type` from nodeId `source` to nodeId `dest`, with optional `props` as properties.

#### SynoGraph::makeEdge(source:String, dest:String, type:String)
Delete an edge of type `type` from nodeId `source` to nodeId `dest`.

#### SynoGraph::getNodeById(id:String)
Get node's properties by its `id`.

#### SynoGraph::getEdge(source:String, dest:String, type:String)
Get props of edge of type `type` from nodeId `source` to nodeId `dest`.

#### SynoGraph::getAllEdges(source:String, dest:String)
Get props of all edges from nodeId `source` to nodeId `dest`, including their type.


### SynoModel API
```js
// models.js
const Model = require('synograph').SynoModel;

module.exports = function (g) {
  const Person = Model(g, 'Person', {
    properties: 'name age'.split(' ')
    connections: [
      {name: 'friends', type: 'Person', collection: true, mutual: true}
    ],
    hasFriends: {
      return this.friends.get().length > 0;
    }
  });
  return {Person};
};

// app.js
const SynoGraph = require('synograph').SynoGraph;
SynoGraph.load('data.bson', g => {
  const models = require('./models')(g);

  let person1 = models.Person({name: 'A', age: 3});
  let person2 = models.Person({name: 'B', age: 6});

  expect(!person1.hasFriends);
  person1.friends.add(person2);
  expect(person1.hasFriends);
  expect(person2.friends.has(person1));

});
```

#### SynoModel(graph:SynoGrpah, modelType:String, properties:PropertiesObject)
The `PropertiesObject` parameter is composed of 4 optional keys:

`properties`: A list of properties every node of this type has.

`connections`: A list of `ConnectionObject` instances (see below).

`dynamicProperties`: A map of dynamic getters name=>function (bound to model instance).

`mixins`: A list of functions that mutate the properties object in order,
where `properties.properties` is a Set instead of an Array.


**ConnectionObject**

Has these keys:

`name`(required[`String`]): name of connection.

`type`(optional[`String`]): model type of connection's other side. Can be `null` and will be found dynamically.

`collection`(optional[`Boolean`]): `true` if there are multiple connections of this type from one instance.

`mutual`(optional[`Boolean`]): `true` if both ends of the connection are the same type, create every connection both ways.

`reverse`(optional[`String`]): the connection of target to update on creation of this connection (e.g. `Person.father` is reverse to `Person.son`).

A model non-collection connections can be accessed and set by name.
All collection connections have the methods `add(node:SynoModel)`, `has(node:SynoModel)` and `remove(node:SynoModel)`.


### Querying API & Advanced Usage
For this section, assume `g` is a SynoGraph instance, and some various models in `models`.

#### SynoGraph::iterNodes()
Returns a generator nodes.

#### Basic Query
```js
g.query(models.Person.find(person => person.name.startsWith('A'))) // get all Person instances with a name that starts with 'A'
```

#### Advanced Querying
```js
/*
Get the name of the preferred drink of all friends of all visitors
of placed affected by disasters witnessed by people that are
 over 50 years old, before year 2000.
*/

g
.select('name')
.of('preferredDrink')
.of('friends')
.of('visitors')
.of('affectedPlace')
.of('disastersWinessed', disaster => disaster.moment.year < 2000)
.ofAny(models.Person.find(person => person.age > 50))
.get();
```

`g.select(prop:String)....of(step:String, filter:optional[function[Model->Boolean]])...of(instance:Model).get(nonUnique:optional[Boolean])`

or

`g.select(prop:String)....of(step:String, filter:optional[function[Model->Boolean]])...ofAny(query:Model.find...|Array[Model]).get(nonUnique:optional[Boolean])`

`prop` can be the name of either a property or a connection. `step` is always a connection name, with `filter` to exclude some targets. `instance` is a specific model instance,
while `query` can either be q `Model.find(...)` call, or an Array of `Model` instances. The results are unique by default (using values for properties and id for nodes), unless passed `nonUnique` of `true`.

#### Atomic Operations
```js
let err = g.atom(() => {
  let user = models.Person(...)
  let post = models.Post(...)
  post.poster = user;
});
if (err) console.error('There was an error in the middle of an atomic procedure. All scoped changes were rolled back.');
throw err;
```

#### Event: `change`
The SynoGraph is an EventEmitter that emits `change` for every changes to the graph.

#### Event: `persist-end`
The SynoGraph is an EventEmitter that emits `persist-end` every time the graph finishes a persist.
