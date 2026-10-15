from pathlib import Path

root = Path(__file__).resolve().parents[1]


def replace_once(path, old, new, label):
    p = root / path
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"{label}: pattern not found in {path}")
    p.write_text(text.replace(old, new, 1))


for path in ['engine-src/core.mjs', 'public/time.html']:
    replace_once(
        path,
        "function isTimeDayTimeline(c){return c.engine==='time'&&(c.grade===3&&c.task==='duration'||c.grade===1&&c.task==='timeofday');}",
        "function isTimeDayTimeline(c){return c.engine==='time'&&c.grade===3&&c.task==='duration';}\nfunction isP1TimeOfDay(c){return c.engine==='time'&&c.grade===1&&c.task==='timeofday';}",
        'split P1 and P3 timeline helpers',
    )
    replace_once(
        path,
        "  if(isTimeDayTimeline(c))return [time24Field('startTime','Start time (24-hour, h)'),time24Field('endTime','End time (24-hour, h)'),select('clock24','24-hour clock labels',[['show','Show'],['hide','Hide']]),select('clock12','12-hour clock labels',[['show','Show'],['hide','Hide']])];",
        "  if(isP1TimeOfDay(c))return [time24Field('startTime','Time to show on the day timeline (24-hour, h)'),select('clock24','24-hour clock labels',[['show','Show'],['hide','Hide']]),select('clock12','12-hour clock labels',[['show','Show'],['hide','Hide']])];\n  if(isTimeDayTimeline(c))return [time24Field('startTime','Start time (24-hour, h)'),time24Field('endTime','End time (24-hour, h)'),select('clock24','24-hour clock labels',[['show','Show'],['hide','Hide']]),select('clock12','12-hour clock labels',[['show','Show'],['hide','Hide']])];",
        'P1 Time of Day fields',
    )
    replace_once(
        path,
        "  if(isTimeDayTimeline(c)){c.startTime='0535';c.endTime='1635';c.clock24=grade===1?'hide':'show';c.clock12=grade===1?'show':'hide';}",
        "  if(isP1TimeOfDay(c)){c.startTime='0735';c.clock24='hide';c.clock12='show';}\n  if(isTimeDayTimeline(c)){c.startTime='0535';c.endTime='1635';c.clock24='show';c.clock12='hide';}",
        'P1 Time of Day defaults',
    )
    replace_once(
        path,
        " if(c.engine==='time'&&g===1&&c.task==='duration'&&![30,60].includes(c.duration))throw Error('P1 duration presets use half an hour or one hour.');",
        " if(c.engine==='time'&&g===1&&c.task==='duration'&&![30,60].includes(c.duration))throw Error('P1 duration presets use half an hour or one hour.');\n if(isP1TimeOfDay(c)&&time24Minutes(c.startTime)%5!==0)throw Error('P1 Time of the Day uses five-minute intervals.');",
        'P1 five-minute validation',
    )
    replace_once(
        path,
        " case 'time':{\n if(isTimeDayTimeline(c)){\n   const start=int(r,0,287)*5,friendly=[10,15,20,25,30,35,40,45,50,55,60,75,90,105,120,150,180,210,240,300,360,420,480,540,600,660,720],duration=choose(r,friendly);\n   p.startTime=formatTime24(start);p.endTime=formatTime24(start+duration);break;\n  }",
        " case 'time':{\n if(isP1TimeOfDay(c)){\n   const morning=r()<.5,start=morning?int(r,60,143)*5:int(r,144,287)*5;\n   p.startTime=formatTime24(start);break;\n  }\n if(isTimeDayTimeline(c)){\n   const start=int(r,0,287)*5,friendly=[10,15,20,25,30,35,40,45,50,55,60,75,90,105,120,150,180,210,240,300,360,420,480,540,600,660,720],duration=choose(r,friendly);\n   p.startTime=formatTime24(start);p.endTime=formatTime24(start+duration);break;\n  }",
        'P1 random five-minute times',
    )
    replace_once(
        path,
        " case 'time':{\n if(isTimeDayTimeline(c)){\n   const start=time24Minutes(c.startTime),end=time24Minutes(c.endTime),elapsed=(end-start+1440)%1440;\n   type='duration';answer=[Math.floor(elapsed/60),elapsed%60];d.start24=start;d.end24=end;d.time24=start;d.elapsed=elapsed;d.overnight=end<start;\n  question=`From ${formatTime24H(start)} to ${formatTime24H(end)}, how long?`;\n  hint='Use the day timeline. Add a period from the start time to the end time, then count the hours and minutes.';\n  explanation=`${formatTime24H(start)} to ${formatTime24H(end)} is ${formatDuration(elapsed)}.`;\n  }else if(c.grade===3&&['endtime','starttime'].includes(t)){",
        " case 'time':{\n if(isP1TimeOfDay(c)){\n   const target=time24Minutes(c.startTime),time12=clockPartsFrom24(target),meridiem=target<720?'a.m.':'p.m.';\n   type='timeampm';answer=[time12[0],time12[1],meridiem];d.time24=target;d.target24=target;d.time12=time12;d.meridiem=meridiem;d.dayPart=target<360?'early morning':target<720?'morning':target<1080?'afternoon':target<1260?'evening':'night';\n   question='What time is shown on the analogue clock? Write the time and choose a.m. or p.m.';\n   hint='Read the analogue clock in 5-minute steps. Then use the highlighted point on the day timeline to decide whether it is a.m. or p.m.';\n   explanation=`The clock shows ${formatTime(...time12)}. The highlighted point is in the ${d.dayPart}, so the time is ${formatTime(...time12)} ${meridiem}.`;\n  }else if(isTimeDayTimeline(c)){\n   const start=time24Minutes(c.startTime),end=time24Minutes(c.endTime),elapsed=(end-start+1440)%1440;\n   type='duration';answer=[Math.floor(elapsed/60),elapsed%60];d.start24=start;d.end24=end;d.time24=start;d.elapsed=elapsed;d.overnight=end<start;\n   question=`From ${formatTime24H(start)} to ${formatTime24H(end)}, how long?`;\n   hint='Use the day timeline. Add a period from the start time to the end time, then count the hours and minutes.';\n   explanation=`${formatTime24H(start)} to ${formatTime24H(end)} is ${formatDuration(elapsed)}.`;\n  }else if(c.grade===3&&['endtime','starttime'].includes(t)){",
        'P1 Time of Day lesson',
    )

p1_runtime = r'''function p1TimeOfDayTimelineSvg(target,show12Hour=true,show24Hour=false){
 const width=1040,left=52,right=988,range=right-left,height=190,norm=value=>((Number(value)%1440)+1440)%1440,toX=value=>left+norm(value)/1440*range;
 const parts=[[0,360,'#223b63','🌙','Early morning','#fff'],[360,720,'#a9d4ed','🌅','Morning','#183c35'],[720,1080,'#e7f5d0','☀️','Afternoon','#183c35'],[1080,1260,'#f9dcaa','🌇','Evening','#183c35'],[1260,1440,'#263d62','🌙','Night','#fff']];
 const bands=parts.map(([from,to,fill,icon,label,ink])=>{const x1=toX(from),x2=to===1440?right:toX(to),mid=(x1+x2)/2,w=x2-x1;return `<rect x="${x1}" y="24" width="${w}" height="66" fill="${fill}"/>${w>95?`<text x="${mid}" y="49" text-anchor="middle" font-size="20">${icon}</text><text x="${mid}" y="75" text-anchor="middle" font-size="14" font-weight="900" fill="${ink}">${label}</text>`:''}`;}).join('');
 const tickValues=[0,180,360,540,720,900,1080,1260,1440],dual=show12Hour&&show24Hour;
 const ticks=tickValues.map(value=>{const x=value===1440?right:toX(value),n=value===1440?0:value;return `<line x1="${x}" y1="90" x2="${x}" y2="${dual?151:132}" stroke="#b7c9b4" stroke-width="1.5"/>${show24Hour?`<text class="duration-clock24" x="${x}" y="111" text-anchor="middle" font-size="13" font-weight="900" fill="#1e4f9a">${formatTime24H(n)}</text>`:''}${show12Hour?`<text class="duration-clock12" x="${x}" y="${show24Hour?133:111}" text-anchor="middle" font-size="13" font-weight="900" fill="#7b2f86">${durationTime12(n)}</text>`:''}`;}).join('');
 const tx=toX(target),labelX=Math.max(left+45,Math.min(right-45,tx)),markerBottom=dual?156:137;
 const marker=`<line x1="${tx}" y1="16" x2="${tx}" y2="${markerBottom}" stroke="#d24a3a" stroke-width="4"/><circle cx="${tx}" cy="20" r="8" fill="#fff" stroke="#d24a3a" stroke-width="4"/><path d="M${tx-7} ${markerBottom-8}L${tx} ${markerBottom}L${tx+7} ${markerBottom-8}Z" fill="#d24a3a"/><text x="${labelX}" y="${dual?177:158}" text-anchor="middle" font-size="14" font-weight="900" fill="#a6372c">This time</text>`;
 return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Day timeline with the question time highlighted"><rect x="${left}" y="24" width="${range}" height="66" rx="10" fill="#eef4e9"/>${bands}${ticks}${marker}<text x="${left}" y="184" font-size="12" font-weight="800" fill="#526d59">Use the highlighted part of the day to decide a.m. or p.m.</text></svg>`;
}
function drawP1TimeOfDay(){
 const c=current.data,host=$('diagram'),target=c.target24??c.time24,time12=c.time12||clockPartsFrom24(target);let show12Hour=c.clock12==='show',show24Hour=c.clock24!=='hide';
 host.innerHTML=`<div class="timeofday-workspace"><section class="timeofday-clock-card"><span class="timeofday-kicker">READ THE ANALOGUE CLOCK</span>${clock(...time12)}<p>Count the minute hand in <strong>5-minute steps</strong>.</p></section><section class="timeofday-timeline-card"><div class="timeofday-head"><div><strong>Time of the Day</strong><span>Use the highlighted point to decide a.m. or p.m.</span></div><div class="duration-clock-controls" role="group" aria-label="Clock labels"><button type="button" class="duration-clock-toggle duration-toggle-24" id="timeDayClock24Toggle" aria-pressed="${show24Hour}">${show24Hour?'Hide':'Show'} 24-hour clock</button><button type="button" class="duration-clock-toggle duration-toggle-12" id="timeDayClock12Toggle" aria-pressed="${show12Hour}">${show12Hour?'Hide':'Show'} 12-hour clock</button></div></div><div class="timeofday-timeline" id="timeDayTimeline"></div><p class="timeofday-cue">Read the clock first. Then find where <strong>This time</strong> sits in the day.</p></section></div>`;
 const timeline=$('timeDayTimeline'),toggle12=$('timeDayClock12Toggle'),toggle24=$('timeDayClock24Toggle');
 const repaint=()=>timeline.innerHTML=p1TimeOfDayTimelineSvg(target,show12Hour,show24Hour);
 const remember=(key,visible)=>{c[key]=visible?'show':'hide';config[key]=c[key];if(draft&&draft.task===c.task&&draft.grade===c.grade){draft[key]=c[key];const setting=$('setting-'+key);if(setting)setting.value=c[key];}};
 toggle12.onclick=()=>{show12Hour=!show12Hour;remember('clock12',show12Hour);toggle12.setAttribute('aria-pressed',String(show12Hour));toggle12.textContent=show12Hour?'Hide 12-hour clock':'Show 12-hour clock';repaint();};
 toggle24.onclick=()=>{show24Hour=!show24Hour;remember('clock24',show24Hour);toggle24.setAttribute('aria-pressed',String(show24Hour));toggle24.textContent=show24Hour?'Hide 24-hour clock':'Show 24-hour clock';repaint();};
 repaint();
}
'''

for path in ['engine-src/runtime.js', 'public/time.html']:
    replace_once(
        path,
        "function durationTimelineSvg(start,end,periods,show12Hour=false,useZoom=true,show24Hour=true){",
        p1_runtime + "function durationTimelineSvg(start,end,periods,show12Hour=false,useZoom=true,show24Hour=true){",
        'insert P1 Time of Day renderer',
    )
    replace_once(
        path,
        " if(isTimeDayTimeline(c)){drawDayTimeline();return;}",
        " if(c.grade===1&&c.task==='timeofday'){drawP1TimeOfDay();return;}\n if(isTimeDayTimeline(c)){drawDayTimeline();return;}",
        'route P1 Time of Day drawing',
    )

css = r'''

/* P1 Time of the Day: analogue clock first, day timeline second. */
.timeofday-workspace{width:100%;display:flex;flex-direction:column;gap:12px;align-items:stretch;justify-content:flex-start}.timeofday-clock-card,.timeofday-timeline-card{background:#fff;border:1px solid #d9e3d6;border-radius:12px}.timeofday-clock-card{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 14px 8px;min-height:230px}.timeofday-clock-card .svg-clock{width:min(240px,42vh);height:min(240px,42vh);max-height:240px;flex:none}.timeofday-kicker{font-size:10px;letter-spacing:1.25px;font-weight:900;color:#627566;margin-bottom:2px}.timeofday-clock-card p{margin:4px 0 0;font-size:12px;color:#526d59}.timeofday-timeline-card{padding:10px 12px}.timeofday-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:7px}.timeofday-head>div:first-child{display:flex;flex-direction:column;gap:2px}.timeofday-head strong{font-size:15px}.timeofday-head span{font-size:11px;color:#627566}.timeofday-timeline{width:100%;overflow:hidden}.timeofday-timeline svg{width:100%;height:auto;max-height:190px}.timeofday-cue{margin:4px 0 0;text-align:center;font-size:12px;color:#526d59}.pupil .timeofday-workspace{gap:10px}.pupil .timeofday-clock-card{min-height:210px;padding:8px 12px}.pupil .timeofday-clock-card .svg-clock{width:min(270px,37vh);height:min(270px,37vh);max-height:270px}.pupil .timeofday-timeline-card{padding:8px 10px}@media(max-width:700px){.timeofday-head{align-items:flex-start;flex-direction:column}.timeofday-clock-card .svg-clock{width:min(220px,58vw);height:min(220px,58vw)}.timeofday-timeline{overflow-x:auto}.timeofday-timeline svg{min-width:760px}}
'''

theme = root / 'engine-src/theme.css'
if '/* P1 Time of the Day: analogue clock first, day timeline second. */' not in theme.read_text():
    theme.write_text(theme.read_text() + css)

time_html = root / 'public/time.html'
html = time_html.read_text()
marker = '</style><script src="https://cdn.counter.dev/script.js"'
if marker not in html:
    raise SystemExit('style close marker not found in public/time.html')
if '/* P1 Time of the Day: analogue clock first, day timeline second. */' not in html:
    time_html.write_text(html.replace(marker, css + marker, 1))

check = r'''import assert from 'node:assert/strict';
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
  for (const [startTime, answer] of [
    ['0535', [5,35,'a.m.']], ['0710', [7,10,'a.m.']], ['1145', [11,45,'a.m.']],
    ['1200', [12,0,'p.m.']], ['1620', [4,20,'p.m.']], ['2105', [9,5,'p.m.']], ['2355', [11,55,'p.m.']],
  ]) {
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
  const p3 = api.validate({ ...api.defaults('time', 3, 'duration'), startTime:'2345', endTime:'0015' });
  const elapsed = api.lesson(p3);
  assert.equal(elapsed.type, 'duration');
  assert.deepEqual(plain(elapsed.answer), [0,30]);
}
for (const target of [335,430,720,980,1265,1435]) {
  for (const show24 of [true,false]) for (const show12 of [true,false]) {
    const svg = deployed.p1TimeOfDayTimelineSvg(target, show12, show24);
    assert.equal(svg.includes('class="duration-clock24"'), show24);
    assert.equal(svg.includes('class="duration-clock12"'), show12);
    assert(svg.includes('This time'));
    assert(svg.includes('Morning') && svg.includes('Afternoon') && svg.includes('Evening') && svg.includes('Night'));
    assert(!/NaN|undefined/.test(svg));
  }
}
console.log(`P1 Time of the Day checks passed: ${questions} analogue-clock questions, all on 5-minute intervals; P3 elapsed time unchanged.`);
'''
(root / 'checks/check-time-day.mjs').write_text(check)
print('P1 Time of the Day patch applied.')
