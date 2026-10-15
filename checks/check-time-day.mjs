import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as source from '../engine-src/core.mjs';

const html = await readFile(new URL('../public/time.html', import.meta.url), 'utf8');
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (!/\b(?:src|type)=/.test(match[1])) new vm.Script(match[2]);
}
const core = html.slice(html.indexOf('const ENGINE_NAMES'), html.indexOf('const $=id=>'));
const timeline = html.slice(html.indexOf('function durationSegments('), html.indexOf('function drawDayTimeline('));
const deployed = vm.runInNewContext(`${core}\n${timeline}\n({tasks,defaults,validate,lesson,checkAnswer,generatedConfig,activityHTML,durationTimelineSvg})`);
const plain = value => JSON.parse(JSON.stringify(value));
let seed = 9367;
const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
let questions = 0;

for (const api of [source, deployed]) {
  assert.equal(api.tasks('time', 1).find(([id]) => id === 'timeofday')[1], '5 · Time of the Day');
  assert(api.tasks('time', 1).some(([id]) => id === 'duration'), 'Keep the original P1 interval activity');
  assert(!api.tasks('time', 2).some(([id]) => id === 'timeofday'));
  assert(!api.tasks('time', 3).some(([id]) => id === 'timeofday'));
  for (const [grade, task] of [[1, 'timeofday'], [3, 'duration']]) {
    const config = api.validate({ ...api.defaults('time', grade, task), mode: 'fixed', count: 1 });
    assert.equal(config.clock24, grade === 1 ? 'hide' : 'show');
    assert.equal(config.clock12, grade === 1 ? 'show' : 'hide');
    for (const [startTime, endTime, answer] of [
      ['0535', '1635', [11, 0]], ['1145', '1215', [0, 30]],
      ['2345', '0015', [0, 30]], ['0000', '1200', [12, 0]],
      ['1200', '0000', [12, 0]], ['2355', '0000', [0, 5]],
    ]) {
      const activity = api.lesson(api.validate({ ...config, startTime, endTime }));
      assert.equal(activity.type, 'duration');
      assert.deepEqual(plain(activity.answer), answer);
      assert(api.checkAnswer(activity, answer, {}));
      assert(!api.checkAnswer(activity, [answer[0], answer[1] + 1], {}));
      assert(!api.checkAnswer(activity, ['', ''], {}));
      questions++;
    }
    for (const startTime of ['2400', '1260', '535', 'abcd']) {
      assert.throws(() => api.validate({ ...config, startTime }));
    }
    assert.throws(() => api.validate({ ...config, startTime: '0700', endTime: '0700' }));
    assert.throws(() => api.validate({ ...config, clock24: 'invalid' }));
    for (const clock24 of ['show', 'hide']) for (const clock12 of ['show', 'hide']) {
      const settings = api.validate({ ...config, clock24, clock12 });
      const exported = api.activityHTML(html, settings);
      const saved = JSON.parse(exported.match(/<script id="saved-config" type="application\/json">(.*?)<\/script>/s)[1]);
      assert.equal(saved.task, task);
      assert.equal(saved.clock24, clock24);
      assert.equal(saved.clock12, clock12);
      assert.deepEqual(plain(api.lesson(api.validate(saved)).answer), [11, 0]);
    }
  }
  for (const grade of [1, 2, 3]) for (const [task] of api.tasks('time', grade)) {
    const config = api.validate({ ...api.defaults('time', grade, task), mode: 'random', count: 8 });
    for (let i = 0; i < 20; i++) {
      const generated = api.validate({ ...api.generatedConfig(config, rng), mode: 'fixed' });
      const activity = api.lesson(generated);
      assert(api.checkAnswer(activity, plain(activity.answer), { clock: [activity.data.a, activity.data.b] }), `P${grade} ${task}`);
      questions++;
    }
  }
}
for (const [start, end] of [[335, 995], [705, 735], [1425, 15], [0, 720]]) {
  for (const zoom of [true, false]) for (const show24 of [true, false]) for (const show12 of [true, false]) {
    const svg = deployed.durationTimelineSvg(start, end, [{ start, end, color: '#3f8865' }], show12, zoom, show24);
    assert.equal(svg.includes('class="duration-clock24"'), show24);
    assert.equal(svg.includes('class="duration-clock12"'), show12);
    assert(svg.includes('P1 · '), 'Clock visibility must not remove period durations');
    assert(!/NaN|undefined/.test(svg));
    if (!show24 && !show12) assert(svg.includes('clock labels hidden') && svg.includes('>Start</text>') && svg.includes('>End</text>'));
    if (show12 && !show24) assert(svg.includes('y="94"') && svg.includes('>Start '));
  }
}
console.log(`Time checks passed: ${questions} questions, both implementations, four clock states, noon/midnight and export round trips.`);
