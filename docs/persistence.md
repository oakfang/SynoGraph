# Persisting the Graph
### Note: PersistentGraph extends the SynoGraph

### Usage:

```js
const SynoGraph = require('synograph').PersistentGraph;
SynoGraph.start('/path/to/db').then(g => {
    const models = require('./models')(g); // load the models here!
    // ... use graph here :)
});
```

### Events
#### Event: `persist-end`
The PersistentGraph is an EventEmitter that emits `persist-end` every time the graph finishes a persist.

### Notes

- Every 3 seconds, all changes to the graph will be persisted to disc, unless SIGINT is captured, at which case it will force-persist and then exit.
- The compression of data is done using [lzma](https://github.com/nmrugg/LZMA-JS/) at the highest level (9) by default, but `start` can accept a second parameter which is a different compression level to use.