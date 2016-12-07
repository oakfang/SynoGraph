import test from 'ava';
import fs from 'fs';
import { fromFile } from '../..';

test('saving to file works', async t => {
  const { graph: g1, commit } = await fromFile(__dirname + '/data.g');
  g1.setVertex('foo', 'Meow');
  await commit();
  const { graph: g2 } = await fromFile(__dirname + '/data.g');
  t.truthy(g2.vertex('foo'));
  fs.unlinkSync(__dirname + '/data.g');
});
