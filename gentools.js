'use strict';


class Iterator {
    constructor(inner) {
        this._ = inner;
    }

    [Symbol.iterator]() {
        return this._[Symbol.iterator]();
    }

    invoke() {
        const args = Array.from(arguments);
        return this._[args[0]].apply(this._, args.slice(1));
    }

    filter(predicate) {
        let self = this;
        return new Iterator((function*() {
            for (let item of self._) {
                if (predicate(item)) yield item;
            }
        })());
    }

    map(mapper) {
        let self = this;
        return new Iterator((function*() {
            for (let item of self._) {
                yield mapper(item);
            }
        })());
    }

    reduce(reducer, accumolator) {
        for (let item of this._) {
            acc = reducer(acc, item);
        }
        return acc;
    }
}

module.exports = Iterator;