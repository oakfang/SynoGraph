# Core Graph
### A core graph data structure: multiedged, directed and cyclic

## API
### class:Graph()
Create a new instance of a Graph.

### Graph::setVertex(id, type, props={})
Set a vertex (create or update) with an `id` and a `type`.

```js
g.setVertex('foo', 'Person', {name: 'Foo Bar', age: 23});
```

### Graph::vertex(id)
Get a vertex by its `id`.

```js
g.vertex('foo').name === 'Foo Bar';
```

### Graph::hasVertex(id)
Check if a vertex exists by its `id`.

```js
g.hasVertex('foo') === true;
```

### Graph::removeVertex(id)
Remove a vertex by its `id` and all of its edges.
Returns all of the discarded edges.

```js
g.removeVertex('foo');
```

### Graph::setEdge(src, dest, type)
Ensure an edge of type `type` from vertex `src` to vertex `dest`.

```js
g.setEdge('foo', 'bar', 'friendOf');
```

### Graph::edge(src, dest, type)
Get the `type` edge from `src` to `dest` if exists, `null` otherwise.

```js
g.edge('foo', 'bar', 'friendOf').type === 'friends';
g.edge('foo', 'bar', 'father') === null;
```

### Graph::hasEdge(src, dest, type)
Check if a `type` edge from `src` to `dest` exists.

```js
g.hasEdge('foo', 'bar', 'friendOf') === true;
```

### Graph::removeEdge(src, dest, type)
Remove a `type` edge from `src` to `dest`.

```js
g.removeEdge('foo', 'bar', 'friendOf');
```

### Graph::inEdges(dest), Graph::outEdges(src), Graph::interEdges(src, dest), Graph::allEdges(vertexId)
Get all edges to `dest`, all edges from `src`, all edges from `src` to `dest`, all edges involving `vertexId` - respectively.

### Graph::vertices()
An `iterator` over all the graph's vertices.

### Graph::verticesByType(type)
An iterator over all the vertices of a given `type`.


## Usage
```js
'use strict';

const Graph = require('synograph/core');
const g = new Graph();

g.setVertex('foo', 'Person', {name: 'Foo Bar', age: 23});
g.setVertex('bar', 'Person', {name: 'Bar Bar', age: 22});
g.setEdge('foo', 'bar', 'friendOf');
g.outEdge('foo')
 .filter(({type}) => type === 'friendsOf')
 .map(({dest}) => g.vertex(dest).age); // [22]
```