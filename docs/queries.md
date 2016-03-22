# Querying API & Advanced Usage
For this section, assume `g` is a SynoGraph instance, and some various models in `models`.

## SynoGraph::iterNodes()
Returns a generator of nodes.

## Basic Query
```js
// get all Person instances with a name that starts with 'A'
g.query(models.Person.find(person => person.name.startsWith('A')));

// or, better yet, as an iterator (wrapped by synograph/gentools)
for (let person of g.queryIter(models.Person.find(person => person.name.startsWith('A')))) {
    // ...
}
```

## Advanced Querying
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