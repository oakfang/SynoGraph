import test from 'ava';
import iter from '../lib/iter';

const counter = function* () {
  let c = 0;
  while (true) yield c++;
};

test('iter.[iterator]', t => {
  const s = new Set([1, 2, 3, 4]);
  const it = iter(s);
  t.is(Array.from(it).length, 4);
});

test('iter.filter', t => {
  const s = new Set([1, 2, 3, 4]);
  const it = iter(s).filter(x => x % 2);
  t.is(Array.from(it).length, 2);
});

test('iter.map', t => {
  const s = new Set([1, 2, 3, 4]);
  const it = iter(s).map(x => x * 2);
  t.is(Array.from(it).reduce((y, x) => x + y, 0), 20);
});

test('iter.limit', t => {
  const it = iter(counter()).limit(6);
  t.is(Array.from(it).length, 6);
});

test('iter chaining', t => {
  const it = iter(counter()).map(x => x * 3).filter(x => x % 2 === 0).limit(3);
  const arr = Array.from(it);
  t.is(arr.length, 3);
  const [a, b, c] = arr;
  t.is(a, 0);
  t.is(b, 6);
  t.is(c, 12);
});
