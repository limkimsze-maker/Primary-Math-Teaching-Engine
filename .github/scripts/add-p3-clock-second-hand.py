from pathlib import Path
import subprocess

BASE='9375959a378b54552bcff1a2674b92b714ceac58'

def git_show(path):
    return subprocess.check_output(['git','show',f'{BASE}:{path}'], text=True)

def replace_once(text, old, new, label):
    n=text.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, found {n}')
    return text.replace(old,new,1)

# Restore only the files touched by the earlier clock attempts.
# This removes the runaway global clock without changing any existing Time subtopic.
Path('engine-src/runtime.js').write_text(git_show('engine-src/runtime.js'))
Path('engine-src/theme.css').write_text(git_show('engine-src/theme.css'))
Path('public/time.html').write_text(git_show('public/time.html'))

old_tasks="time:grade===1?[['read','1 · Read clocks · 5-minute intervals'],['set','2 · Set clocks · 5-minute intervals'],['ampm','3 · Read clock · a.m. / p.m.'],['duration','4 · Find a 30 min / 1 h interval']]:grade===2?[['read','1 · Read clocks · 1-minute intervals'],['ampm','2 · Read clock · 1-minute intervals · a.m. / p.m.'],['set','3 · Set clocks · 1-minute intervals'],['duration','4 · Find duration · h and min'],['later','5 · Find the finishing time'],['convert-duration','6 · Convert h and min ↔ min']]:[['ampm','1 · Read clock · 1-minute intervals · a.m. / p.m.'],['seconds','2 · Measure duration · seconds'],['duration','3 · Find elapsed time · 24-hour timeline'],['endtime','4 · Find the finishing time · 24-hour'],['starttime','5 · Find the starting time · 24-hour'],['twentyfour','6 · 12-hour clock → 24-hour time'],['twelvehour','7 · 24-hour time → 12-hour time']],"
new_tasks="time:grade===1?[['read','1 · Read clocks · 5-minute intervals'],['set','2 · Set clocks · 5-minute intervals'],['ampm','3 · Read clock · a.m. / p.m.'],['duration','4 · Find a 30 min / 1 h interval']]:grade===2?[['read','1 · Read clocks · 1-minute intervals'],['ampm','2 · Read clock · 1-minute intervals · a.m. / p.m.'],['set','3 · Set clocks · 1-minute intervals'],['duration','4 · Find duration · h and min'],['later','5 · Find the finishing time'],['convert-duration','6 · Convert h and min ↔ min']]:[['ampm','1 · Read clock · 1-minute intervals · a.m. / p.m.'],['seconds','2 · Measure duration · seconds'],['duration','3 · Find elapsed time · 24-hour timeline'],['endtime','4 · Find the finishing time · 24-hour'],['starttime','5 · Find the starting time · 24-hour'],['twentyfour','6 · 12-hour clock → 24-hour time'],['twelvehour','7 · 24-hour time → 12-hour time'],['clock-seconds','8 · Clocks with Second hand']],"

fields_anchor="  if(c.grade===3&&c.task==='seconds')return c.secondsDirection==='from-seconds'?[pair('a','Seconds',1,599),select('secondsDirection','Conversion',[['to-seconds','Minutes and seconds → seconds'],['from-seconds','Seconds → minutes and seconds']])]:[pair('a','Minutes',0,5),pair('b','Seconds',0,59),select('secondsDirection','Conversion',[['to-seconds','Minutes and seconds → seconds'],['from-seconds','Seconds → minutes and seconds']])];"
fields_new="  if(c.grade===3&&c.task==='clock-seconds')return [];\n"+fields_anchor

gen_anchor="  }else if(c.grade===3&&t==='seconds'){"
gen_new="  }else if(c.grade===3&&t==='clock-seconds'){\n   type='number';answer=60;question='Watch the live second hand. How many seconds make 1 minute?';hint='Follow the thin red second hand as it moves around the clock face.';explanation='There are 60 seconds in 1 minute.';d.liveClockSeconds=true;\n"+gen_anchor

def patch_core(text):
    text=replace_once(text,old_tasks,new_tasks,'P3 Time task list')
    text=replace_once(text,fields_anchor,fields_new,'clock-seconds fields')
    text=replace_once(text,gen_anchor,gen_new,'clock-seconds generator')
    return text

clock_funcs=r'''function p3SecondClockSvg(){let s='<circle cx="150" cy="150" r="127" fill="#fff" stroke="#315a46" stroke-width="4"/>';for(let i=0;i<60;i++){const a=i*Math.PI/30,x1=150+Math.sin(a)*(i%5===0?110:119),y1=150-Math.cos(a)*(i%5===0?110:119);s+=line(x1,y1,150+Math.sin(a)*125,150-Math.cos(a)*125,'#315a46',i%5===0?3:1);if(i%5===0)s+=text(150+Math.sin(a)*93,156-Math.cos(a)*93,i===0?12:i/5,18);}s+='<line id="p3SecondHourHand" x1="150" y1="150" x2="150" y2="86" stroke="#183c35" stroke-width="7" stroke-linecap="round"/><line id="p3SecondMinuteHand" x1="150" y1="150" x2="150" y2="52" stroke="#bc8c26" stroke-width="4" stroke-linecap="round"/><line id="p3SecondSecondHand" x1="150" y1="164" x2="150" y2="38" stroke="#b43b32" stroke-width="2.5" stroke-linecap="round"/><circle cx="150" cy="150" r="7" fill="#183c35"/><circle cx="150" cy="150" r="3" fill="#b43b32"/>';return svg(s,'0 0 300 300','svg-clock');}
function drawP3ClockSeconds(){
 const host=$('diagram'),aKey='p3-clock-seconds-show-analogue',dKey='p3-clock-seconds-show-digital';
 let showA=true,showD=true;try{showA=localStorage.getItem(aKey)!=='0';showD=localStorage.getItem(dKey)!=='0';}catch{}if(!showA&&!showD){showA=true;showD=true;}
 host.innerHTML=`<div class="p3-second-clock-workspace"><div class="p3-second-clock-toolbar"><button type="button" id="p3SecondToggleAnalogue"></button><button type="button" id="p3SecondToggleDigital"></button></div><div class="p3-second-clock-grid" id="p3SecondClockGrid"><div class="p3-second-clock-card" id="p3SecondAnalogue"><strong>Analogue clock</strong>${p3SecondClockSvg()}</div><div class="p3-second-clock-card p3-second-digital-card" id="p3SecondDigital"><strong>Digital clock</strong><div class="p3-second-digital-main" id="p3SecondDigitalMain">--:--:--</div><div class="p3-second-digital-period" id="p3SecondDigitalPeriod"></div><div class="p3-second-digital-24" id="p3SecondDigital24"></div><small>hour : minute : second</small></div></div></div>`+caption('Thin red hand: second. Long gold hand: minute. Short dark hand: hour.');
 const analogue=$('p3SecondAnalogue'),digital=$('p3SecondDigital'),grid=$('p3SecondClockGrid'),ba=$('p3SecondToggleAnalogue'),bd=$('p3SecondToggleDigital');
 const save=()=>{try{localStorage.setItem(aKey,showA?'1':'0');localStorage.setItem(dKey,showD?'1':'0');}catch{}};
 const sync=()=>{analogue.hidden=!showA;digital.hidden=!showD;grid.classList.toggle('one-clock',showA!==showD);ba.textContent=showA?'Hide analogue':'Show analogue';bd.textContent=showD?'Hide digital':'Show digital';};
 ba.onclick=()=>{if(showA&&!showD)showD=true;showA=!showA;save();sync();};
 bd.onclick=()=>{if(showD&&!showA)showA=true;showD=!showD;save();sync();};
 const tick=()=>{
  if(!document.body.contains(host)||current?.data?.task!=='clock-seconds'){if(p3ClockSecondsTimer){clearInterval(p3ClockSecondsTimer);p3ClockSecondsTimer=null;}return;}
  const now=new Date(),hour=now.getHours(),minute=now.getMinutes(),second=now.getSeconds(),h12=hour%12||12,pad=n=>String(n).padStart(2,'0');
  const hDeg=(hour%12)*30+minute*.5+second/120,mDeg=minute*6+second*.1,sDeg=second*6;
  const hh=$('p3SecondHourHand'),mh=$('p3SecondMinuteHand'),sh=$('p3SecondSecondHand');if(hh)hh.setAttribute('transform',`rotate(${hDeg} 150 150)`);if(mh)mh.setAttribute('transform',`rotate(${mDeg} 150 150)`);if(sh)sh.setAttribute('transform',`rotate(${sDeg} 150 150)`);
  const main=$('p3SecondDigitalMain'),period=$('p3SecondDigitalPeriod'),clock24=$('p3SecondDigital24');if(main)main.textContent=`${h12}:${pad(minute)}:${pad(second)}`;if(period)period.textContent=hour<12?'a.m.':'p.m.';if(clock24)clock24.textContent=`${pad(hour)}:${pad(minute)}:${pad(second)} · 24-hour`;
 };
 sync();tick();p3ClockSecondsTimer=setInterval(tick,1000);
}
'''

def patch_runtime(text):
    globals_anchor="let config=defaults(engine),current,index=0,results=[],attempts=0,hints=0,solved=false,selected=null,interaction={},draft,mixedDigitPlan=[],mixedDigitKindPlan=[];"
    globals_new=globals_anchor+"\nlet p3ClockSecondsTimer=null;"
    text=replace_once(text,globals_anchor,globals_new,'clock timer state')
    text=replace_once(text,"function durationSegments(start,end){",clock_funcs+"function durationSegments(start,end){",'live clock renderer')
    render_anchor="function renderDiagram(){const host=$('diagram'),c=current.data;"
    render_new="function renderDiagram(){const host=$('diagram'),c=current.data;if(p3ClockSecondsTimer){clearInterval(p3ClockSecondsTimer);p3ClockSecondsTimer=null;}"
    text=replace_once(text,render_anchor,render_new,'timer cleanup')
    draw_anchor="function drawClocks(){\n const c=current.data,host=$('diagram');"
    draw_new="function drawClocks(){\n const c=current.data,host=$('diagram');\n if(engine==='time'&&c.grade===3&&c.task==='clock-seconds'){drawP3ClockSeconds();return;}"
    text=replace_once(text,draw_anchor,draw_new,'drawClocks route')
    return text

css=r'''
/* P3_CLOCK_SECOND_HAND_LIVE_V4 */
.p3-second-clock-workspace{width:min(820px,100%);display:flex;flex-direction:column;gap:10px;align-items:center}.p3-second-clock-toolbar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}.p3-second-clock-grid{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:stretch}.p3-second-clock-grid.one-clock{grid-template-columns:1fr}.p3-second-clock-card{border:1px solid #d8e2d5;border-radius:10px;background:#fff;padding:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:210px}.p3-second-clock-card[hidden]{display:none!important}.p3-second-clock-card>strong{font-size:12px;color:#496454}.p3-second-clock-card .svg-clock{max-height:245px}.p3-second-digital-card{background:#fbfdf9}.p3-second-digital-main{font-size:clamp(34px,6vw,62px);line-height:1;font-weight:900;letter-spacing:.04em;color:#183c35;font-variant-numeric:tabular-nums;white-space:nowrap}.p3-second-digital-period{font-size:14px;font-weight:900;color:#24735e}.p3-second-digital-24{font-size:12px;font-weight:800;color:#687b6d;font-variant-numeric:tabular-nums}.p3-second-digital-card small{font-size:11px;color:#627566}@media(max-width:620px){.p3-second-clock-grid{grid-template-columns:minmax(120px,.9fr) minmax(145px,1.1fr);gap:7px}.p3-second-clock-card{min-height:155px;padding:7px}.p3-second-clock-card .svg-clock{max-height:170px}.p3-second-digital-main{font-size:clamp(26px,8vw,40px)}}
'''

core=Path('engine-src/core.mjs')
core.write_text(patch_core(core.read_text()))
runtime=Path('engine-src/runtime.js')
runtime.write_text(patch_runtime(runtime.read_text()))
theme=Path('engine-src/theme.css')
theme.write_text(theme.read_text()+css)

time=Path('public/time.html')
h=patch_core(time.read_text())
h=patch_runtime(h)
pos=h.find('</style>')
if pos<0:
    raise SystemExit('public/time.html: style block not found')
h=h[:pos]+css+h[pos:]
time.write_text(h)

index=Path('index.html')
i=index.read_text()
i=i.replace('fix=20261007-p3-dual-clock-seconds-2','fix=20261007-p3-clock-second-hand-live-4')
i=i.replace('fix=20261007-p3-dual-clock-seconds-1','fix=20261007-p3-clock-second-hand-live-4')
i=i.replace('fix=20261007-p3-clock-second-hand-3','fix=20261007-p3-clock-second-hand-live-4')
index.write_text(i)
