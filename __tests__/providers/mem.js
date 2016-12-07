import test from 'ava';
import { create } from '../..';

test('Make sure nothing breaks', async t => {
  const { graph } = await create();
  graph.setVertex('foo');
  t.truthy(graph.vertex('foo'));
});
