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
const deployed = vm.runInNewContext(`${core}\n${timeline}\n({tasks,defaults,fields,validate,lesson,checkAnswer,generatedConfig,p1TimeOfDayTimelineSvg,durationTimelineSvg})`);
const plain = value => JSON.parse(JSON.stringify(value));
let seed = 9367;
const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
let questions = 0;
for (const api of [source, deployed]) {
  assert.equal(api.tasks('time', 1).find(([id]) => id === 'timeofday')[1], '5 · Time of the Day');
  assert(api.tasks('time', 1).some(([id]) => id === 'duration'));
  assert(!api.tasks('time', 2).some(([id]) => id === 'timeofday'));
  assert(!api.tasks('time', 3).some(([id]) => id === 'timeofday'));
  const base = api.validate({ ...api.defaults('time', 1, 'timeofday'), mode: 'fixed', count: 1 });
  assert.equal(base.startTime, '0735');
  assert.equal(base.clock24, 'hide');
  assert.equal(base.clock12, 'show');
  assert(!api.fields(base).some(field => field.key === 'endTime'));
  for (const [startTime, answer] of [['0535',[5,35,'a.m.']],['0710',[7,10,'a.m.']],['1145',[11,45,'a.m.']],['1200',[12,0,'p.m.']],['1620',[4,20,'p.m.']],['2105',[9,5,'p.m.']],['2355',[11,55,'p.m.']]]) {
    const activity = api.lesson(api.validate({ ...base, startTime }));
    assert.equal(activity.type, 'timeampm');
    assert.deepEqual(plain(activity.answer), answer);
    assert.equal(activity.data.target24 % 5, 0);
    assert(api.checkAnswer(activity, answer, {}));
    assert(!api.checkAnswer(activity, [answer[0], (answer[1]+5)%60, answer[2]], {}));
    assert(!api.checkAnswer(activity, [answer[0], answer[1], answer[2] === 'a.m.' ? 'p.m.' : 'a.m.'], {}));
    questions++;
  }
  for (const bad of ['0732','1261','2400','abcd']) assert.throws(() => api.validate({ ...base, startTime: bad }));
  const random = api.validate({ ...api.defaults('time', 1, 'timeofday'), mode: 'random', count: 8 });
  for (let i=0;i<80;i++) {
    const generated = api.validate({ ...api.generatedConfig(random, rng), mode: 'fixed' });
    const activity = api.lesson(generated);
    assert.equal(activity.type, 'timeampm');
    assert.equal(activity.data.target24 % 5, 0);
    assert(api.checkAnswer(activity, plain(activity.answer), {}));
    questions++;
  }
  const p3 = api.validate({ ...api.defaults('time', 3, 'duration'), mode:'fixed', count:1, startTime:'2345', endTime:'0015' });
  const elapsed = api.lesson(p3);
  assert.equal(elapsed.type, 'duration');
  assert.deepEqual(plain(elapsed.answer), [0,30]);
}
for (const target of [335,430,720,980,1265,1435]) for (const show24 of [true,false]) for (const show12 of [true,false]) {
  const svg = deployed.p1TimeOfDayTimelineSvg(target, show12, show24);
  assert.equal(svg.includes('class="duration-clock24"'), show24);
  assert.equal(svg.includes('class="duration-clock12"'), show12);
  assert(svg.includes('This time'));
  assert(svg.includes('Morning') && svg.includes('Afternoon') && svg.includes('Evening') && svg.includes('Night'));
  assert(!/NaN|undefined/.test(svg));
}
console.log(`P1 Time of the Day checks passed: ${questions} analogue-clock questions, all on 5-minute intervals; P3 elapsed time unchanged.`);
