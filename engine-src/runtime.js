const $=id=>document.getElementById(id);
const E=x=>String(x).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const initialHTML='<!doctype html>'+document.documentElement.outerHTML;
const saved=JSON.parse($('saved-config').textContent||'null');
const requested=new URLSearchParams(location.search).get('engine');
let engine=saved?.engine||(Object.hasOwn(ENGINE_NAMES,requested)?requested:'place');
let config=defaults(engine),current,index=0,results=[],attempts=0,hints=0,solved=false,selected=null,interaction={},draft,mixedDigitPlan=[],mixedDigitKindPlan=[];
function digitPlacesForGrade(grade){return grade===1?[1,10]:grade===2?[1,10,100]:[1,10,100,1000];}
function shuffledDigitPlaces(grade){const a=[...digitPlacesForGrade(grade)];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function buildMixedDigitPlan(c){const plan=[];while(plan.length<Number(c.count||1))plan.push(...shuffledDigitPlaces(Number(c.grade)));return plan.slice(0,Number(c.count||1));}
function buildMixedDigitKindPlan(c){const count=Number(c.count||1),plan=Array.from({length:count},(_,i)=>i%2===0?'place':'value');for(let i=plan.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[plan[i],plan[j]]=[plan[j],plan[i]];}return plan;}
try{const s=saved||JSON.parse(localStorage.getItem('maths-studio-'+engine)||'null');if(s&&s.engine===engine)config=validate(s);}catch{}
function file(name,content,type){if(type==='text/html'&&window.SLSPackager){window.SLSPackager.downloadZip(content,name.replace(/\.html?$/i,'.zip'),{maxMarks:Number(config?.count)||1}).catch(e=>{console.error(e);alert(String(e?.message||'Could not build SLS ZIP. Please try again.'));});return;}const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function onlineDownload(c,format){return false;}
const teacherMoneyField=(c,f)=>c.engine==='money'&&['a','b'].includes(f.key)&&!(c.task==='convert'&&c.direction==='cents-to-money');
const teacherMoneyValue=cents=>`${Math.floor(Number(cents)/100)}.${String(Number(cents)%100).padStart(2,'0')}`;
function teacherMoneyCents(raw,label='Amount'){
 const cleaned=String(raw).trim().replace(/^\$/,'');
 if(!/^\d{1,3}(?:\.\d{1,2})?$/.test(cleaned))throw Error(`${label}: enter dollars and cents, for example $12.75.`);
 const [dollars,part='']=cleaned.split('.'),cents=Number(dollars)*100+Number(part.padEnd(2,'0'));
 if(cents%5!==0)throw Error(`${label}: use a 5-cent interval, for example $12.75 or $8.60.`);
 return cents;
}
function readForm(){const c={...draft,engine,grade:Number($('grade').value),task:$('task').value,mode:$('mode').value,count:Number($('count').value)};for(const f of fields(c)){const el=$('setting-'+f.key);if(el)c[f.key]=el.dataset.moneyDollars==='true'?teacherMoneyCents(el.value,f.label):el.value;}return validate(c);}

function p1OperationReference(c){
 if(c.engine!=='operations'||c.grade!==1)return null;
 if(c.task==='count-on-back')return {title:'Addition / subtraction within 10 · Count on / count back',kind:'count'};
 if(c.task==='fact-family')return {title:'Fact family',kind:'family'};
 if(c.task==='within-20')return {title:'Adding & subtracting within 20',kind:'within20'};
 return null;
}
function p1Speak(text){
 if(!text||!('speechSynthesis'in window))return;
 try{
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(String(text));u.lang='en-GB';u.rate=.72;u.pitch=1.03;
  const voices=speechSynthesis.getVoices?.()||[];
  u.voice=voices.find(v=>(v.lang||'').toLowerCase().startsWith('en-gb'))||voices.find(v=>(v.lang||'').toLowerCase().startsWith('en'))||null;
  speechSynthesis.speak(u);
 }catch{}
}
function p1CountQuestion(mode,within20=false){
 if(mode==='sub'){
  const a=within20?10+Math.floor(Math.random()*11):1+Math.floor(Math.random()*10);
  const b=within20?1+Math.floor(Math.random()*9):1+Math.floor(Math.random()*a);
  return{mode:'sub',a,b,headNum:a,fingerNum:b,start:a,steps:b,answer:a-b,original:a+' − '+b+' = ?',counted:Array.from({length:b},(_,i)=>a-i-1),tapeMax:within20?20:10,within20};
 }
 let a,b,headNum,fingerNum;
 if(within20){do{a=10+Math.floor(Math.random()*10);b=1+Math.floor(Math.random()*9);}while(a+b>20);headNum=a;fingerNum=b;}
 else{do{a=1+Math.floor(Math.random()*9);b=1+Math.floor(Math.random()*9);}while(a+b>10);headNum=Math.max(a,b);fingerNum=Math.min(a,b);}
 return{mode:'add',a,b,headNum,fingerNum,start:headNum,steps:fingerNum,answer:a+b,original:a+' + '+b+' = ?',counted:Array.from({length:fingerNum},(_,i)=>headNum+i+1),tapeMax:within20?20:10,within20};
}
function p1FingerMarks(total,used=0){
 return Array.from({length:total},(_,i)=>'<span class="p1-finger '+(i<used?'used':'')+'" aria-hidden="true"></span>').join('');
}
function p1NumberTape(q,step){
 return Array.from({length:(q.tapeMax||10)+1},(_,n)=>{
  const start=n===q.start,idx=q.counted.indexOf(n),visited=idx>=0&&idx<step,current=step>0&&idx===step-1;
  return '<span class="p1-tape-cell '+(start?'start ':'')+(visited?'visited ':'')+(current?'current':'')+'"><b>'+n+'</b></span>';
 }).join('');
}
function p1CountCoach(q,introDone,step){
 const all=q.mode==='add'
  ?['Look at '+q.a+' + '+q.b+'. Put the bigger number, '+q.headNum+', in your head.','Show '+q.fingerNum+' fingers.','Count on '+q.fingerNum+' times: '+q.counted.join(', ')+'.','Write the answer and press Check.']
  :['Look at '+q.a+' − '+q.b+'. Put '+q.headNum+' in your head.','Show '+q.fingerNum+' fingers.','Count back '+q.fingerNum+' times: '+q.counted.join(', ')+'.','Write the answer and press Check.'];
 let active=0;if(introDone)active=step<q.steps?(step===0?1:2):3;
 return '<div class="p1-teach-steps">'+all.map((t,i)=>'<div class="p1-teach-step '+(i<active?'done ':i===active?'active':'')+'"><span>'+(i<active?'✓':i+1)+'</span><p>'+E(t)+'</p></div>').join('')+'</div>';
}
function p1RenderCount(){
 const s=interaction.p1,q=s.question,host=$('diagram'),remaining=Math.max(0,q.fingerNum-s.step),current=s.step===0?q.start:q.counted[s.step-1];
 const finished=s.introDone&&s.step>=q.steps;
 const instruction=!s.introDone
  ?(q.mode==='add'?'Put the bigger number in your head.':'Put the starting number in your head.')
  :s.step===0
   ?'Show '+q.fingerNum+' fingers. Get ready to '+(q.mode==='add'?'count on.':'count back.')
   :s.step<q.steps
    ?'Say '+current+'. One finger has been used. Keep '+(q.mode==='add'?'counting on.':'counting back.')
    :'You reached '+q.answer+'. Now write the answer.';
 host.innerHTML='<div class="p1-native-wrap">'
  +(s.within20?p1Within20Nav('count'):'')
  +'<div class="p1-native-toolbar"><div class="p1-mode-tabs"><button type="button" id="p1AddMode" class="'+(q.mode==='add'?'selected':'')+'">Addition · Count on</button><button type="button" id="p1SubMode" class="'+(q.mode==='sub'?'selected':'')+'">Subtraction · Count back</button></div><button type="button" id="p1NewCount">New question</button></div>'
  +'<div class="p1-equation-card"><span class="p1-kicker">Question</span><strong>'+E(q.original)+'</strong><p>'+E(instruction)+'</p></div>'
  +'<div class="p1-count-model"><div class="p1-head-card"><span class="p1-model-label">'+(q.mode==='add'?'Bigger number in the head':'Start number in the head')+'</span><div class="p1-head-shape"><span>HEAD</span><b>'+q.headNum+'</b></div><small>Keep '+q.headNum+' in your head.</small></div>'
  +'<div class="p1-finger-card"><span class="p1-model-label">'+(q.mode==='add'?'Finger number':'Take away')+'</span><div class="p1-hand-row">'+p1FingerMarks(q.fingerNum,s.step)+'</div><strong>'+remaining+' '+(remaining===1?'finger':'fingers')+' still up</strong></div></div>'
  +'<div class="p1-tape-wrap"><div class="p1-tape-caption"><b>Number tape 0–10</b><span>'+(q.mode==='add'?'Count on →':'← Count back')+'</span></div><div class="p1-number-tape">'+p1NumberTape(q,s.step)+'</div></div>'
  +p1CountCoach(q,s.introDone,s.step)
  +'<div class="p1-native-controls"><button type="button" id="p1PrevCount" '+(!s.introDone?'disabled':'')+'>← Previous step</button><button type="button" class="primary" id="p1NextCount" '+(finished?'disabled':'')+'>'+(s.introDone?'Next step →':'Start teaching →')+'</button><button type="button" id="p1ReplayCount">🔊 Read step</button><button type="button" id="p1ResetCount">Restart steps</button></div>'
  +(finished?'<div class="p1-native-answer"><label><span>Your answer</span><input id="p1CountAnswer" type="number" min="0" max="10" inputmode="numeric" autocomplete="off"></label><button type="button" class="primary" id="p1CountCheck">Check</button><p id="p1CountFeedback" role="status">Type the answer, then press Check.</p></div>':'')
  +'</div>';
 if(s.within20)p1BindWithin20Nav();
 $('p1AddMode').onclick=()=>{s.mode='add';s.question=p1CountQuestion('add',s.within20);s.step=0;s.introDone=false;p1RenderCount();};
 $('p1SubMode').onclick=()=>{s.mode='sub';s.question=p1CountQuestion('sub',s.within20);s.step=0;s.introDone=false;p1RenderCount();};
 $('p1NewCount').onclick=()=>{s.question=p1CountQuestion(s.mode,s.within20);s.step=0;s.introDone=false;p1RenderCount();};
 $('p1ResetCount').onclick=()=>{s.step=0;s.introDone=false;p1RenderCount();};
 $('p1ReplayCount').onclick=()=>p1Speak(instruction);
 $('p1PrevCount').onclick=()=>{if(s.step>0)s.step--;else s.introDone=false;p1RenderCount();};
 $('p1NextCount').onclick=()=>{
  if(!s.introDone){s.introDone=true;p1Speak(q.mode==='add'?'Show '+q.fingerNum+' fingers.':'Show '+q.fingerNum+' fingers.');}
  else if(s.step<q.steps){s.step++;p1Speak(String(q.counted[s.step-1]));}
  p1RenderCount();
 };
 if(finished){
  $('p1CountCheck').onclick=()=>{const v=Number($('p1CountAnswer').value),f=$('p1CountFeedback');if(v===q.answer){f.textContent='Correct! '+q.original.replace('?',''+q.answer);f.className='ok';p1Speak('That answer is correct.');}else{f.textContent='Try again. Use the count on the number tape.';f.className='retry';}};
  $('p1CountAnswer').onkeydown=e=>{if(e.key==='Enter'){$('p1CountCheck').click();}};
 }
}

const P1_MAKE10_POOL=[[8,2],[8,3],[8,4],[8,5],[8,6],[8,7],[8,8],[8,9],[9,1],[9,2],[9,3],[9,4],[9,5],[9,6],[9,7],[9,8],[7,3],[7,4],[7,5],[7,6],[6,4],[6,5],[6,6],[6,7],[5,5],[5,6],[5,7],[5,8]];
function p1Make10Question(){
 const [a,b]=P1_MAKE10_POOL[Math.floor(Math.random()*P1_MAKE10_POOL.length)],bigger=Math.max(a,b),smaller=Math.min(a,b),toTen=10-bigger,remainder=smaller-toTen,total=a+b;
 return{a,b,bigger,smaller,toTen,remainder,total};
}
function p1Subtract10Question(){
 const pool=[];for(let a=11;a<=19;a++){const toTen=a-10;for(let b=toTen+1;b<=9;b++)pool.push([a,b]);}
 const [a,b]=pool[Math.floor(Math.random()*pool.length)],toTen=a-10,remainder=b-toTen,result=a-b;
 return{a,b,toTen,remainder,result};
}
function p1Within20Nav(active){
 return '<div class="p1-within20-nav"><button type="button" data-p1w="count" class="'+(active==='count'?'selected':'')+'">Count on / count back</button><button type="button" data-p1w="make10" class="'+(active==='make10'?'selected':'')+'">Making 10 for adding</button><button type="button" data-p1w="subtract10" class="'+(active==='subtract10'?'selected':'')+'">Subtract to get 10</button></div>';
}
function p1BindWithin20Nav(){
 document.querySelectorAll('[data-p1w]').forEach(btn=>btn.onclick=()=>{
  const s=interaction.p1;s.strategy=btn.dataset.p1w;
  if(s.strategy==='count'){s.mode='add';s.question=p1CountQuestion('add',true);s.step=0;s.introDone=false;p1RenderCount();}
  else if(s.strategy==='make10'){s.make10=p1Make10Question();s.step=0;s.demo=false;s.checked=false;s.correct=false;p1RenderMake10();}
  else{s.subtract10=p1Subtract10Question();s.step=0;s.demo=false;s.checked=false;s.correct=false;p1RenderSubtract10();}
 });
}
function p1TenFrame(count,crossed=0,accent='red'){
 const removed=new Set(Array.from({length:crossed},(_,i)=>Math.max(0,count-1-i)));
 return '<div class="p1-ten-frame">'+Array.from({length:10},(_,i)=>'<span class="p1-ten-cell">'+(i<count?'<i class="p1-counter '+accent+'"></i>':'')+(removed.has(i)?'<b class="p1-cross">×</b>':'')+'</span>').join('')+'</div>';
}
function p1BondSvg(top,left,right,op='+',answer='?'){
 return '<svg class="p1-bond-svg" viewBox="0 0 420 150" role="img" aria-label="Number bond"><text x="70" y="42">'+top+'</text><text x="130" y="42">'+op+'</text><text x="194" y="42">'+(left+right)+'</text><text x="260" y="42">=</text><text x="325" y="42">'+answer+'</text><line x1="175" y1="54" x2="142" y2="96"/><line x1="175" y1="54" x2="216" y2="96"/><text x="132" y="132">'+left+'</text><text x="226" y="132">'+right+'</text></svg>';
}
function p1Line20Svg(d,step,kind){
 const W=1080,H=190,left=44,right=1036,y=102,gap=(right-left)/20,x=n=>left+n*gap;
 const jump=(from,to,label,level=0)=>{
  const x1=x(from),x2=x(to),mid=(x1+x2)/2,cy=43-level*14;
  return '<path d="M '+x1+' '+(y-11)+' Q '+mid+' '+cy+' '+x2+' '+(y-11)+'" fill="none" stroke="#17211f" stroke-width="4.5" stroke-linecap="round"/><text x="'+mid+'" y="'+(cy-5)+'" text-anchor="middle" font-size="18" font-weight="900">'+label+'</text>';
 };
 let arcs='',markers='',labels='',start=0,target=0,current=null,showTen=false,showTarget=false;
 if(kind==='make10'){
  start=d.bigger;target=d.total;
  if(step===3)arcs+=jump(d.bigger,10,'+'+d.toTen);
  else if(step===4){arcs+=jump(d.bigger,10,'+'+d.toTen);if(d.remainder)arcs+=jump(10,d.total,'+'+d.remainder,1);}
  else if(step>=6){const shown=Math.min(step-5,d.smaller);for(let i=0;i<shown;i++)arcs+=jump(d.bigger+i,d.bigger+i+1,'+1',i%2);}
  if(step>=5){const shown=Math.max(0,Math.min(step-5,d.smaller));current=d.bigger+shown;showTen=current>=10&&current!==d.bigger;showTarget=current===d.total;}
  else{showTen=true;showTarget=step>=4;}
 }else{
  start=d.a;target=d.result;
  if(step===4)arcs+=jump(d.a,10,'−'+d.toTen);
  else if(step===5){arcs+=jump(d.a,10,'−'+d.toTen);if(d.remainder)arcs+=jump(10,d.result,'−'+d.remainder,1);}
  else if(step>=7){const shown=Math.min(step-6,d.b);for(let i=0;i<shown;i++)arcs+=jump(d.a-i,d.a-i-1,'−1',i%2);}
  if(step>=7){const shown=Math.min(step-6,d.b);current=d.a-shown;showTen=current<=10;showTarget=current===d.result;}
  else{showTen=step>=4;showTarget=step>=5;}
 }
 markers+='<circle cx="'+x(start)+'" cy="'+y+'" r="10" fill="#ef6b6b" stroke="#8d342d" stroke-width="2"/>';
 labels+='<text x="'+x(start)+'" y="181" text-anchor="middle" font-size="15" font-weight="900" fill="#a6372c">Start</text>';
 if(showTen){
  markers+='<circle cx="'+x(10)+'" cy="'+y+'" r="10" fill="#f4cc57" stroke="#9d7813" stroke-width="2"/>';
  labels+='<text x="'+x(10)+'" y="181" text-anchor="middle" font-size="15" font-weight="900" fill="#8a6500">'+((current===10)?'Now':kind==='make10'&&step<5?'Make 10':'10')+'</text>';
 }
 if(showTarget && target!==10){
  markers+='<circle cx="'+x(target)+'" cy="'+y+'" r="10" fill="#53b77a" stroke="#23784a" stroke-width="2"/>';
  labels+='<text x="'+x(target)+'" y="181" text-anchor="middle" font-size="15" font-weight="900" fill="#23784a">'+(current===target?'Now':'Answer')+'</text>';
 }else if(current!==null&&current!==start&&current!==10&&current!==target){
  markers+='<circle cx="'+x(current)+'" cy="'+y+'" r="10" fill="#53b77a" stroke="#23784a" stroke-width="2"/>';
  labels+='<text x="'+x(current)+'" y="181" text-anchor="middle" font-size="15" font-weight="900" fill="#23784a">Now</text>';
 }
 let ticks='',boxes='';
 for(let n=0;n<=20;n++){
  const xx=x(n);ticks+='<line x1="'+xx+'" y1="'+(y-11)+'" x2="'+xx+'" y2="'+(y+11)+'" stroke="#526d67" stroke-width="2.4"/>';
  let fill='#f5f8f7',stroke='#b9c9c5';
  if(n===start){fill='#fee8e6';stroke='#ef6b6b';}
  else if(showTen&&n===10){fill='#fff4c9';stroke='#e0b42e';}
  else if((showTarget&&n===target)||(current!==null&&n===current&&n!==start)){fill='#e4f6e9';stroke='#53b77a';}
  boxes+='<rect x="'+(xx-18)+'" y="132" rx="6" width="36" height="28" fill="'+fill+'" stroke="'+stroke+'" stroke-width="2"/><text x="'+xx+'" y="151" text-anchor="middle" font-size="15" font-weight="900">'+n+'</text>';
 }
 return '<svg class="p1-line20-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Number line from 0 to 20"><line x1="'+left+'" y1="'+y+'" x2="'+right+'" y2="'+y+'" stroke="#173b36" stroke-width="4"/>'+ticks+arcs+markers+boxes+labels+'</svg>';
}
function p1Make10Talk(d,step){
 if(step===0)return 'Build '+d.a+' and '+d.b+' on the ten-frames. Let us look at the bigger number first.';
 if(step===1)return 'Break '+d.smaller+' into '+d.toTen+' and '+d.remainder+'. '+d.toTen+' helps to make 10.';
 if(step===2)return 'Move '+d.toTen+' counter'+(d.toTen===1?'':'s')+' slowly to the bigger ten-frame to make 10.';
 if(step===3)return 'Now skip count by '+d.toTen+' from '+d.bigger+' to 10 on the number line.';
 if(step===4)return 'Next, skip count by '+d.remainder+' more from 10 to '+d.total+'. So '+d.a+' + '+d.b+' = '+d.total+'.';
 if(step===5)return 'Prove it by counting on in ones. Press Next Step to show the first +1 jump.';
 const shown=Math.min(step-5,d.smaller),target=d.bigger+shown;
 return 'Count on by 1. '+shown+' jump'+(shown===1?'':'s')+' of +1 shown, up to '+target+'.';
}
function p1SplitBondSvg(whole,left,right,label){
 return '<div class="p1-split-bond"><div class="p1-split-caption">'+label+'</div><svg class="p1-split-bond-svg" viewBox="0 0 360 132" role="img" aria-label="'+whole+' split into '+left+' and '+right+'"><circle cx="180" cy="31" r="25" fill="#fff" stroke="#315a52" stroke-width="3"/><text x="180" y="39" text-anchor="middle">'+whole+'</text><line x1="168" y1="55" x2="118" y2="91"/><line x1="192" y1="55" x2="242" y2="91"/><circle cx="105" cy="104" r="24" fill="#fff4c9" stroke="#d2a828" stroke-width="3"/><circle cx="255" cy="104" r="24" fill="#fff" stroke="#315a52" stroke-width="3"/><text x="105" y="112" text-anchor="middle">'+left+'</text><text x="255" y="112" text-anchor="middle">'+right+'</text></svg></div>';
}
function p1TenFrameMixed(baseCount,movedCount){
 const total=Math.min(10,baseCount+movedCount);
 return '<div class="p1-ten-frame">'+Array.from({length:10},(_,i)=>'<span class="p1-ten-cell">'+(i<total?'<i class="p1-counter '+(i<baseCount?'red':'gold')+(i>=baseCount?' transferred':'')+'"></i>':'')+'</span>').join('')+'</div>';
}
function p1Make10Visual(d,step){
 const moved=step>=2?d.toTen:0,remaining=d.smaller-moved;
 const leftFrame=step>=2?p1TenFrameMixed(d.bigger,d.toTen):p1TenFrame(d.bigger,0,'red');
 const rightFrame=p1TenFrame(remaining,0,'gold');
 const bond=step>=1?p1SplitBondSvg(d.smaller,d.toTen,d.remainder,'Split '+d.smaller+' to make 10'):'<div class="p1-visual-placeholder"><b>First:</b> build both numbers with counters.</div>';
 let action='';
 if(step===2)action='<div class="p1-transfer-band"><span>Move <b>'+d.toTen+'</b> counter'+(d.toTen===1?'':'s')+'</span><strong>→</strong><span><b>'+d.bigger+' + '+d.toTen+' = 10</b></span></div>';
 else if(step===3)action='<div class="p1-transfer-band"><span>Made a full ten</span><strong>✓</strong><span><b>'+d.bigger+' + '+d.toTen+' = 10</b></span></div>';
 else if(step===4)action='<div class="p1-transfer-band complete"><span>Then add the leftover <b>'+d.remainder+'</b></span><strong>→</strong><span><b>10 + '+d.remainder+' = '+d.total+'</b></span></div>';
 else if(step>=5)action='<div class="p1-transfer-band proof"><span>Proof by counting on</span><strong>→</strong><span><b>'+d.bigger+' + '+d.smaller+' = '+d.total+'</b></span></div>';
 const pathway=step===0?d.a+' + '+d.b+' = ?':step===1?d.smaller+' = '+d.toTen+' + '+d.remainder:step===2?d.bigger+' + '+d.toTen+' = 10':step===3?d.bigger+' → 10':step===4?d.a+' + '+d.b+' = 10 + '+d.remainder+' = '+d.total:'Count on from '+d.bigger+' to '+d.total;
 return '<div class="p1-visual-stack"><div class="p1-visual-heading"><b>Counters / ten-frames</b><span>See every change before using the number line.</span></div><div class="p1-frame-row"><div><strong>Bigger number: '+d.bigger+'</strong>'+leftFrame+'<small>'+(step>=2?'The gold counter'+(d.toTen===1?'':'s')+' came from the other frame.':'Keep the bigger number here.')+'</small></div><div><strong>Smaller number: '+d.smaller+'</strong>'+rightFrame+'<small>'+(step>=2?d.remainder+' counter'+(d.remainder===1?' remains':'s remain')+'.':'These counters will be split.')+'</small></div></div>'+bond+action+'<div class="p1-strategy-pathway">'+pathway+'</div><div class="p1-visual-heading line"><b>Number line 0–20</b><span>Follow the jumps one step at a time.</span></div><div class="p1-line-card">'+p1Line20Svg(d,step,'make10')+'</div></div>';
}
function p1RenderMake10(){
 const s=interaction.p1,d=s.make10,host=$('diagram'),last=5+d.smaller,talk=p1Make10Talk(d,s.step);
 host.innerHTML='<div class="p1-native-wrap">'+p1Within20Nav('make10')
 +'<div class="p1-equation-card"><span class="p1-kicker">Making 10 for adding to 20</span><strong>'+d.a+' + '+d.b+' = ?</strong><p>'+(s.demo?E(talk):'Solve it first, then press Check Answer.')+'</p></div>'
 +(s.demo?p1Make10Visual(d,s.step):'<div class="p1-pupil-try"><label><span>Your answer</span><input id="p1W20Answer" type="number" min="0" max="20" inputmode="numeric"></label><button type="button" class="primary" id="p1W20Check">Check Answer</button><p id="p1W20Feedback">'+(s.checked?(s.correct?'Correct! You can now show the teaching steps.':'Not quite. Show Making 10 to teach the strategy.'):'Try the question before the demonstration.')+'</p></div>')
 +(s.demo?'<div class="p1-step-talk"><span>Step '+(s.step+1)+' / '+(last+1)+'</span><strong>'+E(talk)+'</strong></div><div class="p1-native-controls"><button id="p1W20Prev" '+(s.step===0?'disabled':'')+'>← Previous step</button><button class="primary" id="p1W20Next" '+(s.step>=last?'disabled':'')+'>Next step →</button><button id="p1W20Speak">🔊 Read step</button><button id="p1W20New">New question</button></div>':'<div class="p1-native-controls"><button id="p1W20Show" '+(!s.checked?'disabled':'')+'>Show Making 10</button><button id="p1W20New">New question</button></div>')
 +'</div>';
 p1BindWithin20Nav();
 $('p1W20New').onclick=()=>{s.make10=p1Make10Question();s.step=0;s.demo=false;s.checked=false;s.correct=false;p1RenderMake10();};
 if(!s.demo){
  $('p1W20Check').onclick=()=>{const raw=$('p1W20Answer').value.trim();if(raw==='')return;const ok=Number(raw)===d.total;s.checked=true;s.correct=ok;if(ok)s.demo=true;p1RenderMake10();};
  $('p1W20Show').onclick=()=>{s.demo=true;s.step=0;p1RenderMake10();p1Speak(p1Make10Talk(d,0));};
 }else{
  $('p1W20Prev').onclick=()=>{if(s.step>0)s.step--;p1RenderMake10();};
  $('p1W20Next').onclick=()=>{if(s.step<last)s.step++;p1RenderMake10();p1Speak(p1Make10Talk(d,s.step));};
  $('p1W20Speak').onclick=()=>p1Speak(talk);
 }
}
function p1Subtract10Talk(d,step){
 if(step===0)return 'Build '+d.a+' counters on the ten-frames.';
 if(step===1)return 'Break '+d.b+' into '+d.toTen+' and '+d.remainder+'. '+d.toTen+' helps us get to 10.';
 if(step===2)return 'Take away '+d.toTen+' to get 10.';
 if(step===3)return 'Now take away '+d.remainder+' more from 10 to get '+d.result+'.';
 if(step===4)return 'On the number line, start at '+d.a+' and jump back '+d.toTen+' to 10.';
 if(step===5)return 'At 10, jump back '+d.remainder+' to '+d.result+'.';
 if(step===6)return 'Prove it by counting back in ones. Press Next Step to show the first −1 jump.';
 const shown=Math.min(step-6,d.b),target=d.a-shown;
 return 'Count back by 1. '+shown+' jump'+(shown===1?'':'s')+' of −1 shown, down to '+target+'.';
}
function p1Subtract10Visual(d,step){
 const ones=d.a-10,leftCross=step>=3?d.remainder:0,rightCross=step>=2?ones:0;
 const bond=step>=1?p1SplitBondSvg(d.b,d.toTen,d.remainder,'Split '+d.b+' so we can get to 10'):'<div class="p1-visual-placeholder"><b>First:</b> build '+d.a+' as one full ten and '+ones+' more.</div>';
 let action='';
 if(step===2)action='<div class="p1-transfer-band subtract"><span>Take away <b>'+d.toTen+'</b></span><strong>→</strong><span><b>'+d.a+' − '+d.toTen+' = 10</b></span></div>';
 else if(step===3)action='<div class="p1-transfer-band subtract complete"><span>Then take away <b>'+d.remainder+'</b> more</span><strong>→</strong><span><b>10 − '+d.remainder+' = '+d.result+'</b></span></div>';
 else if(step===4)action='<div class="p1-transfer-band subtract"><span>Jump back to 10</span><strong>←</strong><span><b>−'+d.toTen+'</b></span></div>';
 else if(step===5)action='<div class="p1-transfer-band subtract complete"><span>Jump back again</span><strong>←</strong><span><b>−'+d.remainder+' to '+d.result+'</b></span></div>';
 else if(step>=6)action='<div class="p1-transfer-band proof"><span>Proof by counting back</span><strong>←</strong><span><b>'+d.a+' − '+d.b+' = '+d.result+'</b></span></div>';
 const pathway=step===0?d.a+' − '+d.b+' = ?':step===1?d.b+' = '+d.toTen+' + '+d.remainder:step===2?d.a+' − '+d.toTen+' = 10':step===3?d.a+' − '+d.b+' = 10 − '+d.remainder+' = '+d.result:step===4?d.a+' → 10':step===5?'10 → '+d.result:'Count back from '+d.a+' to '+d.result;
 return '<div class="p1-visual-stack"><div class="p1-visual-heading"><b>Counters / ten-frames</b><span>Crossed counters are the counters being taken away.</span></div><div class="p1-frame-row"><div><strong>Full ten</strong>'+p1TenFrame(10,leftCross,'red')+'<small>'+(leftCross?leftCross+' more taken away after reaching 10.':'Keep this full ten intact first.')+'</small></div><div><strong>Ones: '+ones+'</strong>'+p1TenFrame(ones,rightCross,'gold')+'<small>'+(rightCross?ones+' taken away to reach 10.':'Take these away first to get to 10.')+'</small></div></div>'+bond+action+'<div class="p1-strategy-pathway">'+pathway+'</div><div class="p1-visual-heading line"><b>Number line 0–20</b><span>Start at '+d.a+' and follow each backward jump.</span></div><div class="p1-line-card">'+p1Line20Svg(d,step,'subtract10')+'</div></div>';
}
function p1RenderSubtract10(){
 const s=interaction.p1,d=s.subtract10,host=$('diagram'),last=6+d.b,talk=p1Subtract10Talk(d,s.step);
 host.innerHTML='<div class="p1-native-wrap">'+p1Within20Nav('subtract10')
 +'<div class="p1-equation-card"><span class="p1-kicker">Subtract to get 10</span><strong>'+d.a+' − '+d.b+' = ?</strong><p>'+(s.demo?E(talk):'Solve it first, then press Check Answer.')+'</p></div>'
 +(s.demo?p1Subtract10Visual(d,s.step):'<div class="p1-pupil-try"><label><span>Your answer</span><input id="p1W20Answer" type="number" min="0" max="20" inputmode="numeric"></label><button type="button" class="primary" id="p1W20Check">Check Answer</button><p id="p1W20Feedback">'+(s.checked?(s.correct?'Correct! You can now show the teaching steps.':'Not quite. Show Get 10 to teach the strategy.'):'Try the question before the demonstration.')+'</p></div>')
 +(s.demo?'<div class="p1-step-talk"><span>Step '+(s.step+1)+' / '+(last+1)+'</span><strong>'+E(talk)+'</strong></div><div class="p1-native-controls"><button id="p1W20Prev" '+(s.step===0?'disabled':'')+'>← Previous step</button><button class="primary" id="p1W20Next" '+(s.step>=last?'disabled':'')+'>Next step →</button><button id="p1W20Speak">🔊 Read step</button><button id="p1W20New">New question</button></div>':'<div class="p1-native-controls"><button id="p1W20Show" '+(!s.checked?'disabled':'')+'>Show Get 10</button><button id="p1W20New">New question</button></div>')
 +'</div>';
 p1BindWithin20Nav();
 $('p1W20New').onclick=()=>{s.subtract10=p1Subtract10Question();s.step=0;s.demo=false;s.checked=false;s.correct=false;p1RenderSubtract10();};
 if(!s.demo){
  $('p1W20Check').onclick=()=>{const raw=$('p1W20Answer').value.trim();if(raw==='')return;const ok=Number(raw)===d.result;s.checked=true;s.correct=ok;if(ok)s.demo=true;p1RenderSubtract10();};
  $('p1W20Show').onclick=()=>{s.demo=true;s.step=0;p1RenderSubtract10();p1Speak(p1Subtract10Talk(d,0));};
 }else{
  $('p1W20Prev').onclick=()=>{if(s.step>0)s.step--;p1RenderSubtract10();};
  $('p1W20Next').onclick=()=>{if(s.step<last)s.step++;p1RenderSubtract10();p1Speak(p1Subtract10Talk(d,s.step));};
  $('p1W20Speak').onclick=()=>p1Speak(talk);
 }
}

const P1_FAMILY_PHRASES=['Parts add up, make the whole!','Switch the parts, same whole!','Big number subtract, find the part!','Big number subtract, other part!'];
function p1NewFamily(){
 let a,b;do{a=1+Math.floor(Math.random()*9);b=1+Math.floor(Math.random()*(10-a));}while(a+b>10||a===b);
 return{a,b,whole:a+b,solved:[null,null,null,null]};
}
function p1FamilyValid(f,i,vals){
 const [x,y,z]=vals;
 if(i<2){
  const ok=z===f.whole&&((x===f.a&&y===f.b)||(x===f.b&&y===f.a));
  return ok&&(i!==1||!f.solved[0]||!f.solved[0].every((v,j)=>v===vals[j]));
 }
 const ok=x===f.whole&&((y===f.a&&z===f.b)||(y===f.b&&z===f.a));
 return ok&&(i!==3||!f.solved[2]||!f.solved[2].every((v,j)=>v===vals[j]));
}
function p1FamilyEquation(i,solved,active){
 const op=i<2?'+':'−';
 if(solved)return '<span class="p1-eq-fixed">'+solved[0]+'</span><b>'+op+'</b><span class="p1-eq-fixed">'+solved[1]+'</span><b>=</b><span class="p1-eq-fixed">'+solved[2]+'</span>';
 if(!active)return '<input disabled><b>'+op+'</b><input disabled><b>=</b><input disabled>';
 return '<input class="p1-family-input" inputmode="numeric" maxlength="2" aria-label="first number"><b>'+op+'</b><input class="p1-family-input" inputmode="numeric" maxlength="2" aria-label="second number"><b>=</b><input class="p1-family-input" inputmode="numeric" maxlength="2" aria-label="answer">';
}
function p1RenderFamily(){
 const s=interaction.p1,f=s.family,host=$('diagram'),done=s.familyIndex>=4;
 host.innerHTML='<div class="p1-native-wrap">'
  +'<div class="p1-native-toolbar"><div><span class="p1-kicker">Number bond</span><strong>Build all 4 equations from the same family</strong></div><button type="button" id="p1NewFamily">New fact family</button></div>'
  +'<div class="p1-bond"><div class="p1-bond-whole"><span>Whole</span><b>'+f.whole+'</b></div><div class="p1-bond-lines" aria-hidden="true"><i></i><i></i></div><div class="p1-bond-parts"><div><span>Part</span><b>'+f.a+'</b></div><div><span>Part</span><b>'+f.b+'</b></div></div></div>'
  +'<div class="p1-family-list">'+P1_FAMILY_PHRASES.map((phrase,i)=>{const solved=f.solved[i],active=i===s.familyIndex&&!done;return '<div class="p1-family-row '+(solved?'done ':active?'active':'locked')+'"><div class="p1-family-phrase"><span>'+(solved?'✓':i+1)+'</span><strong>'+E(phrase)+'</strong></div><div class="p1-family-equation">'+p1FamilyEquation(i,solved,active)+'</div>'+(active?'<button type="button" class="primary p1-family-check">Check</button><button type="button" class="p1-family-speak">🔊</button>':'')+'</div>';}).join('')+'</div>'
  +'<div class="p1-family-feedback '+(done?'ok':'')+'" id="p1FamilyFeedback">'+(done?'Wonderful! You made all four equations.':'Listen to the active phrase, then fill in the matching equation.')+'</div>'
  +'</div>';
 $('p1NewFamily').onclick=()=>{s.family=p1NewFamily();s.familyIndex=0;p1RenderFamily();p1Speak(P1_FAMILY_PHRASES[0]);};
 const row=host.querySelector('.p1-family-row.active');
 if(row){
  const inputs=[...row.querySelectorAll('.p1-family-input')];
  inputs.forEach(inp=>{inp.oninput=()=>inp.value=inp.value.replace(/\D/g,'').slice(0,2);inp.onkeydown=e=>{if(e.key==='Enter')row.querySelector('.p1-family-check').click();};});
  row.querySelector('.p1-family-speak').onclick=()=>p1Speak(P1_FAMILY_PHRASES[s.familyIndex]);
  row.querySelector('.p1-family-check').onclick=()=>{
   const vals=inputs.map(x=>x.value.trim()===''?NaN:Number(x.value)),fb=$('p1FamilyFeedback');
   if(vals.some(Number.isNaN)){fb.textContent='Please fill in all 3 boxes.';fb.className='p1-family-feedback retry';return;}
   if(!p1FamilyValid(f,s.familyIndex,vals)){fb.textContent='Try again! '+P1_FAMILY_PHRASES[s.familyIndex];fb.className='p1-family-feedback retry';p1Speak('Try again. '+P1_FAMILY_PHRASES[s.familyIndex]);return;}
   f.solved[s.familyIndex]=vals;s.familyIndex++;
   const next=P1_FAMILY_PHRASES[s.familyIndex];
   p1RenderFamily();
   if(next)p1Speak(next);else p1Speak('Wonderful! You made all four equations.');
  };
 }
}
function showP1OperationReference(c){
 const ref=p1OperationReference(c);if(!ref)return false;
 document.body.classList.add('p1-operation-reference');
 $('summary').hidden=true;$('questionView').hidden=false;
 $('question').textContent=ref.title;$('taskLabel').textContent='Primary 1 · Operations';$('questionMeta').textContent='';
 $('activityInstruction').textContent=ref.kind==='count'?'Teach one counting step at a time.':'Use the number bond, then unlock one related equation at a time.';
 $('feedback').textContent='';$('hint').hidden=true;$('answerForm').hidden=true;$('checkButton').hidden=true;$('hintButton').hidden=true;$('nextButton').hidden=true;
 interaction={p1:{kind:ref.kind}};
 if(ref.kind==='count'){interaction.p1.mode='add';interaction.p1.question=p1CountQuestion('add');interaction.p1.step=0;interaction.p1.introDone=false;p1RenderCount();}
 else if(ref.kind==='family'){
  if(parent!==window){parent.postMessage({type:'primary-maths-operations-activity',activity:'p1-fact-family'},'*');return true;}
  interaction.p1.family=p1NewFamily();interaction.p1.familyIndex=0;p1RenderFamily();setTimeout(()=>p1Speak(P1_FAMILY_PHRASES[0]),120);
 }
 else{interaction.p1.strategy='count';interaction.p1.within20=true;interaction.p1.mode='add';interaction.p1.question=p1CountQuestion('add',true);interaction.p1.step=0;interaction.p1.introDone=false;p1RenderCount();}
 return true;
}
function timeLevelSummary(grade){return grade===1?'P1: read and set clocks in five-minute intervals, distinguish a.m. / p.m., and work with 30 min and 1 h intervals.':grade===2?'P2: read and set clocks to the nearest minute, read a.m. / p.m. from picture clues, measure duration in h and min, and convert h and min ↔ min.':'P3: read clocks to the nearest minute with a.m. / p.m. picture clues, then work with seconds, elapsed / start / end time, and 12-hour / 24-hour time.';}
function populate(c){draft={...c};$('grade').replaceChildren();for(const g of engine==='area'?[3]:engine==='fraction'?[2,3]:[1,2,3]){const o=document.createElement('option');o.value=g;o.textContent='Primary '+g;$('grade').append(o);}$('grade').value=c.grade;$('task').replaceChildren();for(const [v,l]of tasks(engine,c.grade)){const o=document.createElement('option');o.value=v;o.textContent=l;$('task').append(o);}$('task').value=c.task;$('mode').value=c.mode;$('count').value=c.mode==='fixed'?8:c.count;populateFields();}
function populateFields(){draft.mode=$('mode').value;draft.grade=Number($('grade').value);draft.task=$('task').value;$('engineFields').replaceChildren();const exploring=engine==='place'&&draft.task==='hundred',mixedDigit=engine==='place'&&['digit-value-mixed','digit-place-mixed','digit-mixed'].includes(draft.task),referenceMoneyWord=engine==='money'&&draft.task==='word',referenceP1Operation=Boolean(p1OperationReference({...draft,engine})),mixedOperations=engine==='operations'&&draft.task==='mixed-add-sub';if(mixedDigit){draft.mode='random';$('mode').value='random';}const random=draft.mode==='random';$('mode').closest('.field').hidden=exploring||mixedDigit||referenceMoneyWord||referenceP1Operation||mixedOperations;$('countField').hidden=!random||exploring||referenceMoneyWord||referenceP1Operation;
 const kept={operations:['skill','multiplicationFocus','multiplicationColumnFocus','representation'],place:['place','b','representation'],numberline:draft.task==='pattern'?['patternType','b','b2','missing']:['b'],money:draft.task==='convert'?['direction']:draft.task==='word'?['wordType','format']:draft.task==='make'?['format']:['format'],fraction:['factor','orderMode'],bar:['context'],graph:['key','labels','graphType','category'],time:['durationDirection','secondsDirection']};
 for(const f of fields(draft)){if(random&&!(kept[engine]||[]).includes(f.key))continue;const wrap=document.createElement('div');wrap.className='field';const label=document.createElement('label');label.htmlFor='setting-'+f.key;label.textContent=f.label;const input=document.createElement(f.type==='select'?'select':'input');input.id=label.htmlFor;const currency=teacherMoneyField(draft,f);if(f.type==='select'){for(const [v,l]of f.options){const o=document.createElement('option');o.value=v;o.textContent=l;input.append(o);}}else if(currency){input.type='text';input.inputMode='decimal';input.dataset.moneyDollars='true';input.placeholder='12.75';input.autocomplete='off';}else if(f.type==='time24'){input.type='text';input.inputMode='numeric';input.pattern='[0-9]{4}';input.maxLength=4;input.placeholder='HHMM';input.autocomplete='off';input.addEventListener('input',()=>{input.value=input.value.replace(/\D/g,'').slice(0,4);draft[f.key]=input.value;});}else{input.type=f.type;if(f.type==='number'){input.min=f.min;input.max=f.max;input.step=f.step||1;}else input.maxLength=f.maxLength;}input.value=currency?teacherMoneyValue(draft[f.key]):draft[f.key];input.addEventListener('change',()=>{if(currency){try{draft[f.key]=teacherMoneyCents(input.value,f.label);}catch{}}else draft[f.key]=input.value;if(engine==='operations'&&f.key==='skill'){Object.assign(draft,operationSkillExample(draft.grade,draft.task,draft.skill));populateFields();}else if(engine==='operations'&&f.key==='multiplicationFocus'){Object.assign(draft,multiplicationFocusExample(draft.grade,draft.multiplicationFocus));populateFields();}else if(engine==='operations'&&f.key==='multiplicationColumnFocus'){Object.assign(draft,multiplicationColumnExample(draft.multiplicationColumnFocus));populateFields();}else if(engine==='numberline'&&f.key==='patternType'||engine==='money'&&f.key==='direction'||engine==='fraction'&&f.key==='orderMode'||engine==='time'&&['durationDirection','secondsDirection'].includes(f.key))populateFields();});wrap.append(label);if(currency){const moneyWrap=document.createElement('div');moneyWrap.className='currency-setting';const symbol=document.createElement('span');symbol.textContent='$';symbol.setAttribute('aria-hidden','true');moneyWrap.append(symbol,input);wrap.append(moneyWrap);}else if(f.type==='time24'){const timeWrap=document.createElement('div');timeWrap.className='time24-setting';const unit=document.createElement('span');unit.textContent='h';unit.setAttribute('aria-hidden','true');timeWrap.append(input,unit);wrap.append(timeWrap);}else wrap.append(input);$('engineFields').append(wrap);}
 const levelNote=engine==='time'?timeLevelSummary(draft.grade)+' ':'';$('randomNote').textContent=levelNote+(referenceP1Operation?'This follows your original P1 teaching sequence inside the Primary Maths Studio style, step by step.':exploring?'Explore numbers from 0 to 100. Generate restores your starting number and both button amounts.':random?'New questions use this grade’s preset ranges. The settings shown here stay fixed; other numbers or shapes vary. Generate again or reopen the downloaded file for a new practice set.':'Your chosen numbers make one fixed example. Reopening or restarting keeps that same example.');
}
function builderTab(which){const setup=which==='setup';$('setupPanel').hidden=!setup;$('examplePanel').hidden=setup;$('setupTab').setAttribute('aria-selected',setup);$('exampleTab').setAttribute('aria-selected',!setup);}
$('setupTab').onclick=()=>builderTab('setup');$('exampleTab').onclick=()=>builderTab('examples');
for(const [id,which] of [['setupTab','setup'],['exampleTab','examples']])$(id).onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const n=which==='setup'?'examples':'setup';builderTab(n);$(n==='setup'?'setupTab':'exampleTab').focus();}};
$('grade').onchange=()=>{populate(defaults(engine,Number($('grade').value)));setPresets();};$('task').onchange=()=>{populate(defaults(engine,Number($('grade').value),$('task').value));setPresets();};$('mode').onchange=()=>populateFields();
$('builderForm').onsubmit=e=>{e.preventDefault();try{start(readForm());$('teacherStatus').style.color='#24735e';$('teacherStatus').textContent='Activity ready. Settings applied.';}catch(err){$('teacherStatus').style.color='#a6372c';$('teacherStatus').textContent=err.message;}};
function setPresets(){$('presets').replaceChildren();const grade=Number($('grade').value);for(const [task,label]of tasks(engine,grade)){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{const c=validate(defaults(engine,grade,task));populate(c);start(c);builderTab('setup');$('teacherStatus').textContent=p1OperationReference(c)?'P1 activity loaded in the Studio.':'Example loaded. You can change the numbers.';};$('presets').append(b);}if(engine==='place'&&$('task').value==='hundred')return;const p=document.createElement('button');p.type='button';p.textContent='Random practice · 8 questions';p.onclick=()=>{const c={...defaults(engine,grade,$('task').value),mode:'random',count:8};populate(c);start(validate(c));builderTab('setup');};$('presets').append(p);}
$('saveButton').onclick=()=>{try{const c=readForm();if(!onlineDownload(c,'settings'))file(engine+'-settings.json',JSON.stringify(c,null,2),'application/json');$('teacherStatus').textContent='Settings saved. This JSON is a setup file.';}catch(e){$('teacherStatus').textContent=e.message;}};
$('loadButton').onclick=()=>$('loadFile').click();$('loadFile').onchange=async()=>{try{const f=$('loadFile').files[0];if(!f)return;const c=validate(JSON.parse(await f.text()));if(c.engine!==engine)throw Error('This file is for '+ENGINE_NAMES[c.engine]+'. Open that engine tab to load it.');populate(c);start(c);setPresets();$('teacherStatus').textContent='Settings loaded.';}catch(e){$('teacherStatus').textContent=e.message;}$('loadFile').value='';};
$('downloadButton').onclick=()=>{try{const c=readForm(),html=activityHTML(initialHTML,c);if(!onlineDownload(c,'activity'))file(engine+'-activity.html',html,'text/html');$('teacherStatus').textContent='HTML activity downloaded with these settings. '+(c.task==='hundred'?'Your starting number and both button amounts stay the same.':c.mode==='random'?'Questions vary each time it opens.':'Your fixed example stays the same.');}catch(e){$('teacherStatus').textContent=e.message;}};
function pupil(on){
 document.body.classList.toggle('pupil',on);
 $('viewButton').textContent=on?'Teacher view':'Pupil view';
 $('previewLabel').textContent=on?'Your activity':'Pupil activity preview';
 if(engine==='place'&&current&&!interaction.pvBusy){
  if(current.data.task==='hundred')drawHundredChart();
  else if(current.data.task==='ordinal')drawOrdinal();
  else if(current.data.task==='odd-even')drawOddEven();
  else drawCountingChart();
 }
 window.scrollTo(0,0);
 $('questionView').scrollTop=0;
 if(parent!==window)parent.postMessage({type:'primary-maths-pupil-view',on},'*');
 if(engine==='place')requestAnimationFrame(fitCountingPiles);
} $('viewButton').onclick=()=>pupil(!document.body.classList.contains('pupil'));
function start(c){config=validate(c);index=0;results=[];mixedDigitPlan=config.task==='digit-mixed'?buildMixedDigitPlan(config):[];mixedDigitKindPlan=config.task==='digit-mixed'?buildMixedDigitKindPlan(config):[];try{localStorage.setItem('maths-studio-'+engine,JSON.stringify(config));}catch{}document.body.classList.remove('p1-operation-reference');$('hintButton').hidden=false;$('checkButton').hidden=false;if(showP1OperationReference(config))return;$('summary').hidden=true;$('questionView').hidden=false;showQuestion();}
function showQuestion(){const questionConfig=config.task==='digit-mixed'?{...config,mixedDigitPlace:mixedDigitPlan[index],mixedDigitKind:mixedDigitKindPlan[index]}:config;current=lesson(questionConfig);attempts=0;hints=0;solved=false;selected=null;interaction={};document.body.classList.toggle('operations-engine',engine==='operations');document.body.classList.toggle('money-word-reference',engine==='money'&&config.task==='word');$('question').textContent=current.question;$('taskLabel').textContent=tasks(engine,config.grade).find(t=>t[0]===config.task)[1];$('questionMeta').textContent=`${index+1} / ${config.count}`;$('activityInstruction').textContent=current.type==='explore'?'Explore. Predict. Explain.':current.type==='sequence'?'Arrange. Explain. Check.':'Look at the model. Explain. Check.';$('feedback').textContent='';$('hint').hidden=true;$('nextButton').hidden=true;$('nextButton').textContent=index+1===config.count?'Finish activity →':'Next question →';$('checkButton').hidden=false;$('checkButton').disabled=false;$('hintButton').disabled=false;renderDiagram();renderAnswers();if(engine==='operations')lockOperationAnswer();progress();}
function resultTaskLabel(){return tasks(engine,config.grade).find(t=>t[0]===current?.data?.task)?.[1]||tasks(engine,config.grade).find(t=>t[0]===config.task)?.[1]||String(current?.data?.task||config.task||'Question');}
function feedbackTaskLabel(label){const raw=String(label||'Question');const pictorial=/^P1\s+Pictorial Model\s*·\s*/i.test(raw);const cleaned=raw.replace(/^P1\s+Pictorial Model\s*·\s*/i,'').replace(/^P[123]\s+/i,'').replace(/\s*·\s*/g,' — ').trim();return pictorial?'Pictorial Model — '+cleaned:cleaned;}
function scoreFeedbackDetails(){const lost=results.filter(r=>r.earned!==true),lostByType={};for(const r of lost){const k=feedbackTaskLabel(r.taskLabel||resultTaskLabel()),d=lostByType[k]||(lostByType[k]={wrongFirst:0,assisted:0,questions:[]});if(Number(r.hints||0)>0)d.assisted++;else d.wrongFirst++;if(Number.isInteger(Number(r.questionNumber)))d.questions.push(Number(r.questionNumber));}const needsReview=Object.entries(lostByType).map(([k,v])=>{const reasons=[];if(v.wrongFirst)reasons.push(v.wrongFirst+' wrong on first check');if(v.assisted)reasons.push(v.assisted+' used help/reveal');const qs=v.questions.length?' (Q'+v.questions.sort((a,b)=>a-b).join(', Q')+')':'';return k+': '+reasons.join(', ')+qs;}).join('; ');const byType={};for(const r of results){const k=feedbackTaskLabel(r.taskLabel||resultTaskLabel()),d=byType[k]||(byType[k]={done:0,earned:0});d.done++;if(r.earned===true)d.earned++;}const performance=Object.entries(byType).map(([k,v])=>k+': '+v.earned+'/'+v.done).join('; ');return {needsReview,performance};}
function reportSlsScore(completed=false){const max=Number(config?.count)||Number(document.getElementById('count')?.value)||1;const earned=results.filter(r=>r.earned===true).length;const firstTry=earned;const selfCorrected=results.filter(r=>Number(r.hints||0)===0&&Number(r.attempts||0)>1).length;const assisted=results.filter(r=>Number(r.hints||0)>0).length;const specific=scoreFeedbackDetails();const reviewText=specific.needsReview?' Needs review — '+specific.needsReview+'.':' No problem types need review.';const feedbackSummary='Score '+earned+'/'+max+'. First checked answer correct without help: '+firstTry+'. Self-corrected after a wrong first check: '+selfCorrected+'. Assisted: '+assisted+'.'+reviewText+(specific.performance?' By type — '+specific.performance+'.':'');const detail={score:earned,max,maxScore:max,completed:Boolean(completed),scoringRule:'first-checked-correct-no-help',feedbackSummary};try{if(window.SLSScore&&typeof window.SLSScore.send==='function')window.SLSScore.send(earned,max,detail);else document.dispatchEvent(new CustomEvent('sls-score',{detail}));}catch(err){try{document.dispatchEvent(new CustomEvent('sls-score',{detail}));}catch(_){}}}
function progress(){$('progress').replaceChildren();for(let n=0;n<config.count;n++){const s=document.createElement('span');s.className=n<results.length?'done':n===index?'current':'';$('progress').append(s);}$('progress').setAttribute('aria-label',`${results.length} of ${config.count} completed`);}
function inputBox(id,label,min=0,max){const w=document.createElement('label');w.innerHTML=`<span class="answer-label">${E(label)}</span>`;const i=document.createElement('input');i.id=id;i.type='number';i.inputMode='numeric';i.step=1;i.min=min;if(max!==undefined)i.max=max;i.className='answer-input';i.required=true;i.autocomplete='off';w.append(i);return w;}
function moneyAnswerEntry(){
 const wrap=document.createElement('div');wrap.className='money-answer-entry';wrap.setAttribute('aria-label','Enter the amount in dollars and cents');
 const symbol=document.createElement('span');symbol.className='money-answer-symbol';symbol.textContent='$';symbol.setAttribute('aria-hidden','true');
 const dollars=inputBox('answer1','Dollars',0),dot=document.createElement('span');dot.className='money-answer-dot';dot.textContent='.';dot.setAttribute('aria-hidden','true');
 const cents=document.createElement('label');cents.innerHTML='<span class="answer-label">Cents</span>';const centsInput=document.createElement('input');centsInput.id='answer2';centsInput.type='text';centsInput.inputMode='numeric';centsInput.pattern='[0-9]{2}';centsInput.maxLength=2;centsInput.placeholder='00';centsInput.className='answer-input money-cents-input';centsInput.required=true;centsInput.autocomplete='off';centsInput.setAttribute('aria-label','Cents, two digits');centsInput.addEventListener('input',()=>{centsInput.value=centsInput.value.replace(/\D/g,'').slice(0,2);});centsInput.addEventListener('blur',()=>{if(centsInput.value.length===1)centsInput.value='0'+centsInput.value;});cents.append(centsInput);
 wrap.append(symbol,dollars,dot,cents);return wrap;
}
function timeAnswerEntry(hourLabel='Hour',minHour=1,maxHour=12,minuteStep=1){
 const wrap=document.createElement('div');wrap.className='time-answer-entry';wrap.setAttribute('aria-label',`${hourLabel} and minute, separated by a colon`);
 const hour=inputBox('answer1',hourLabel,minHour,maxHour),colon=document.createElement('span'),minute=inputBox('answer2','Minute',0,59,minuteStep);colon.className='time-answer-colon';colon.textContent=':';colon.setAttribute('aria-hidden','true');
 wrap.append(hour,colon,minute);return wrap;
}
function timeAmPmAnswerEntry(minuteStep=1){
 const wrap=document.createElement('div');wrap.className='time-ampm-answer-entry';wrap.setAttribute('aria-label','Enter the 12-hour time and choose a.m. or p.m.');
 const meridiem=document.createElement('div');meridiem.className='ampm-choice';const label=document.createElement('span');label.className='answer-label';label.textContent='a.m. or p.m.';const choices=document.createElement('div');choices.className='ampm-choice-buttons';choices.setAttribute('role','group');choices.setAttribute('aria-label','Choose a.m. or p.m.');chooseButtons(choices,['a.m.','p.m.'],value=>selected=value);meridiem.append(label,choices);
 wrap.append(timeAnswerEntry('Hour',1,12,minuteStep),meridiem);return wrap;
}
function time24FourAnswerEntry(){
 const wrap=document.createElement('div');wrap.className='time24-four-entry';wrap.setAttribute('aria-label','Enter the four-digit 24-hour time followed by h');
 const label=document.createElement('label');label.innerHTML='<span class="answer-label">24-hour time</span>';const input=document.createElement('input');input.id='answer1';input.type='text';input.inputMode='numeric';input.pattern='[0-9]{4}';input.maxLength=4;input.placeholder='1809';input.className='answer-input';input.required=true;input.autocomplete='off';input.setAttribute('aria-label','Four-digit 24-hour time');input.addEventListener('input',()=>{input.value=input.value.replace(/\D/g,'').slice(0,4);});label.append(input);
 const word=document.createElement('span');word.className='time24-answer-word';word.textContent='h';wrap.append(label,word);return wrap;
}
function durationAnswerEntry(){
 const wrap=document.createElement('div');wrap.className='duration-answer-entry';wrap.setAttribute('aria-label','Enter the duration in hours and minutes');
 const hours=inputBox('answer1','Hours',0),minutes=inputBox('answer2','Minutes',0,59),hourWord=document.createElement('span'),minuteWord=document.createElement('span');hourWord.className='duration-answer-word';minuteWord.className='duration-answer-word';hourWord.textContent='h';minuteWord.textContent='min';
 wrap.append(hours,hourWord,minutes,minuteWord);return wrap;
}
function durationSecondsAnswerEntry(){
 const wrap=document.createElement('div');wrap.className='duration-answer-entry';wrap.setAttribute('aria-label','Enter the duration in minutes and seconds');
 const minutes=inputBox('answer1','Minutes',0),seconds=inputBox('answer2','Seconds',0,59),minuteWord=document.createElement('span'),secondWord=document.createElement('span');minuteWord.className='duration-answer-word';secondWord.className='duration-answer-word';minuteWord.textContent='min';secondWord.textContent='s';wrap.append(minutes,minuteWord,seconds,secondWord);return wrap;
}
function fractionAnswerEntry(){
 const wrap=document.createElement('div');wrap.className='fraction-answer-entry';wrap.setAttribute('aria-label','Enter the numerator above the fraction line and the denominator below it');
 const title=document.createElement('span');title.className='fraction-answer-title';title.textContent='Your answer';
 const numerator=inputBox('answer1','Numerator',0),line=document.createElement('span'),denominator=inputBox('answer2','Denominator',1);line.className='fraction-answer-line';line.setAttribute('aria-hidden','true');
 wrap.append(title,numerator,line,denominator);return wrap;
}
function chooseButtons(host,values,callback){for(const value of values){const b=document.createElement('button');b.type='button';b.className='choice';b.textContent=value;b.onclick=()=>{host.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');callback(value);};host.append(b);}}
function renderAnswers(){const host=$('answerFields');host.replaceChildren();const type=current.type;$('answerForm').hidden=type==='explore';if(type==='explore')return;
 if(engine==='error'){const box=document.createElement('div');box.className='error-reasons';box.style.width='100%';chooseButtons(box,[...current.data.errorChoices].sort(()=>Math.random()-.5),v=>interaction.errorReason=v);host.append(box);}
 if(type==='reason'){const p=document.createElement('p');p.className='helper';p.textContent='Use the statement cards above. Tap Undo to change the order.';host.append(p);return;}
 if(type==='sequence'){const p=document.createElement('p');p.className='helper';p.textContent='Place every number card in a blank box, then check the complete pattern.';host.append(p);return;}
 if(type==='choice'){chooseButtons(host,current.choices,v=>selected=v);return;}
 if(type==='number'){host.append(inputBox('answer1','Your answer'));if(current.unit){const u=document.createElement('span');u.className='answer-unit';u.textContent=current.unit;host.append(u);}}
 else if(type==='money'){host.append(moneyAnswerEntry());}
 else if(type==='time'){host.append(timeAnswerEntry('Hour',1,12,config.grade===1?5:1));}
 else if(type==='timeampm'){host.append(timeAmPmAnswerEntry(config.grade===1?5:1));}
 else if(type==='time24'){host.append(timeAnswerEntry('24-hour hour',0,23));}
 else if(type==='time24four'){host.append(time24FourAnswerEntry());}
 else if(type==='duration'){host.append(durationAnswerEntry());}
 else if(type==='durationseconds'){host.append(durationSecondsAnswerEntry());}
 else if(type==='quotient'){host.append(inputBox('answer1','Quotient',0),inputBox('answer2','Remainder',0,current.data.b-1));}
 else{const wholeAnswer=current.type==='fraction'&&current.answer?.[1]===1;host.append(fractionAnswerEntry(wholeAnswer));if(config.task==='equivalent')$('answer2').value=current.answer[1];}
}
function response(){return current.type==='choice'?selected:current.type==='reason'?interaction.reasons:current.type==='sequence'?interaction.sequenceValues:current.type==='timeampm'?[$('answer1').value,$('answer2').value,selected]:current.type==='time24four'?$('answer1').value:current.type==='number'?$('answer1').value:current.type==='fraction'&&current.answer?.[1]===1?[$('answer1').value,'1']:[$('answer1').value,$('answer2').value];}
$('answerForm').onsubmit=e=>{e.preventDefault();if(solved)return;attempts++;const ok=checkAnswer(current,response(),interaction);$('feedback').style.color=ok?'#24735e':'#a6372c';$('feedback').className=ok?'ok':'retry';if(ok){solved=true;$('feedback').textContent='Correct! '+current.explanation;results.push({first:attempts===1&&hints===0,firstAnswerCorrect:attempts===1&&hints===0,earned:attempts===1&&hints===0,attempts,hints,questionNumber:index+1,task:current?.data?.task,taskLabel:resultTaskLabel()});$('nextButton').hidden=false;$('checkButton').disabled=true;if(engine==='fraction')$('checkButton').hidden=true;$('hintButton').disabled=true;if(engine==='operations'){drawOperation();lockOperationAnswer();}if(engine==='place'){interaction.pvCards=true;interaction.pvExpanded=true;interaction.pvDigits=true;drawCountingChart();}if(engine==='numberline'&&config.task==='pattern'){interaction.sequenceRuleShown=true;renderSequencePattern();}progress();}else{$('feedback').textContent=engine==='error'?'Check your explanation of the error and your corrected answer.':engine==='fraction'&&config.task==='shade'?'Check both the shaded parts and your fraction.':engine==='money'&&config.task==='make'?'Check both the value tokens and your written amount.':engine==='money'&&config.task==='word'?'Check the model you chose and the amount you entered.':engine==='time'&&config.task==='set'?'Check both the clock hands and your written time.':engine==='numberline'&&config.task==='pattern'?'Fill every blank, then check the order of the number cards.':engine==='numberline'&&['add','subtract'].includes(config.task)?'Check both the blue marker and your written answer.':'Try again. Look at the model or tap Help me.';}};
$('hintButton').onclick=()=>{hints++;$('hint').hidden=false;const step=interaction.plan?.steps[interaction.step];$('hint').textContent=step?(hints===1?step.prompt:step.equation):hints===1?current.hint:current.hint+' '+current.explanation;};
$('nextButton').onclick=()=>{index++;if(index>=config.count)summary();else showQuestion();};
document.addEventListener('keydown',event=>{if(engine!=='fraction'||!['ArrowLeft','ArrowRight'].includes(event.key)||/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName))return;const target=$(event.key==='ArrowLeft'?'fractionBack':'fractionNext');if(!target||target.disabled)return;event.preventDefault();target.click();});
function summary(){reportSlsScore(true);$('questionView').hidden=true;$('summary').hidden=false;$('summary').innerHTML=`<h2 class="summary-title">Activity complete!</h2><p>You worked through ${config.count} ${config.count===1?'example':'questions'}.</p><div class="summary-stats"><div class="summary-stat"><strong>${results.filter(r=>r.first).length}</strong><span>First try, no hints</span></div><div class="summary-stat"><strong>${results.filter(r=>r.attempts>1).length}</strong><span>With a retry</span></div><div class="summary-stat"><strong>${results.filter(r=>r.hints>0).length}</strong><span>With help</span></div></div><p>A question may include a retry and help. This is feedback for this session, not a mastery grade.</p><button type="button" class="primary" id="restart">Practise again</button>`;$('restart').onclick=()=>start(config);$('questionMeta').textContent='Complete';progress();}
const svg=(content,view='0 0 600 250',cls='svg-wide')=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" class="${cls}" role="img" aria-label="Mathematical diagram"><g font-family="Arial,Helvetica,sans-serif" fill="#183c35">${content}</g></svg>`;
const text=(x,y,s,size=18,extra='')=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" ${extra}>${E(s)}</text>`;
const line=(x1,y1,x2,y2,color='#183c35',width=3)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"/>`;
const caption=s=>`<p class="diagram-caption">${E(s)}</p>`;
function placeCounts(n,ps){return ps.map((p,i)=>i===0?Math.floor(n/p):Math.floor(n/p)%10);}
function pvBoard(counts,ps){return `<div class="pv-board" style="--cols:${ps.length}">${ps.map((p,i)=>`<div class="pv-column"><div class="pv-label">${p===1?'Ones':p===10?'Tens':p===100?'Hundreds':'Thousands'}</div><div class="pv-discs">${Array.from({length:counts[i]>30?1:counts[i]},()=>`<span class="disc">${p}</span>`).join('')}${counts[i]>30?`<span>× ${counts[i]}</span>`:''}</div></div>`).join('')}</div>`;}
function renderDiagram(){const host=$('diagram'),c=current.data;multiplicationResizeWatcher?.disconnect();countingResizeWatcher?.disconnect();hundredResizeWatcher?.disconnect();host.replaceChildren();document.body.classList.toggle('place-engine',engine==='place');document.body.classList.toggle('hundred-engine',engine==='place'&&c.task==='hundred');document.body.classList.toggle('numberline-engine',engine==='numberline');document.body.classList.toggle('money-engine',engine==='money');document.body.classList.toggle('fraction-engine',engine==='fraction');document.body.classList.toggle('division-engine',engine==='operations'&&c.task==='divide-column');document.body.classList.toggle('addsub-engine',engine==='operations'&&['add','subtract'].includes(c.task));document.body.classList.toggle('multiplication-engine',engine==='operations'&&['multiply','multiply-column'].includes(c.task));
 if(engine==='place'){
  if(c.task==='hundred'){interaction.hundredValue=c.a;drawHundredChart();}else{const changing=['more','less'].includes(c.task);interaction.pvPlan=changing?placeChangePlan(c):null;interaction.ps=changing?interaction.pvPlan.ps:placePowers(c.grade,c.a);interaction.counts=placeCounts(c.a,interaction.ps);interaction.pvStep=0;interaction.pvCards=changing;interaction.pvTogether=true;interaction.pvExpanded=changing;interaction.pvChart=true;interaction.pvDigits=['digit','digit-value-mixed','digit-place','digit-place-mixed','digit-mixed'].includes(c.task)||changing;drawCountingChart();}}
 else if(engine==='operations'){
  interaction.plan=operationPlan(c);interaction.step=0;interaction.operationComplete=false;drawOperation();}
 else if(engine==='numberline')drawNumberline();
 else if(engine==='bar')drawBars();
 else if(engine==='money'){interaction.money=0;interaction.coins=[];interaction.moneyStep=0;interaction.moneyModel=null;interaction.moneySound=true;interaction.moneyAnimation=null;interaction.moneySettledStep=null;interaction.moneyBusy=false;drawMoney();}
 else if(engine==='fraction'){interaction.fractionStep=0;drawFractions();}
 else if(engine==='time'){interaction.clock=c.task==='set'?[12,0]:['read','later','duration','ampm'].includes(c.task)?[c.a,c.b]:c.time24!==undefined?clockPartsFrom24(c.time24):[12,0];drawClocks();}
 else if(engine==='geometry')drawGeometry();
 else if(engine==='area')drawArea();
 else if(engine==='graph')drawGraph();
 else if(engine==='explain'){interaction.reasons=[];interaction.cards=[...c.reasons,c.distractor].sort(()=>Math.random()-.5);drawReasons();}
 else if(engine==='error'){if(c.task==='place'){const ps=[10,1];host.innerHTML=pvBoard(placeCounts(c.a,ps),ps);}else if(c.task==='fraction'){interaction.shadedCells=Array.from({length:c.den},(_,i)=>i<c.a);drawFractions();}else if(c.task==='time'){interaction.clock=[c.a,c.b];drawClocks();}else if(c.task==='perimeter')drawArea();else host.innerHTML=svg(text(300,100,`${c.a} + ${c.b}`,40)+text(300,170,`Claim: ${c.wrong}`,28))+caption('Recompute the sum. Is the claim reasonable?');}
}
function operationDiscs(n,p,marked=0){
 const disc=(j,extra='')=>`<span class="operation-disc ${extra} ${j>=n-marked?'regrouped-disc':''}" data-place="${p}">${p}</span>`;
 const packs=Math.floor(n/10),loose=n%10;
 return `<div class="operation-discs">${Array.from({length:packs},(_,g)=>`<span class="ten-pack" aria-label="10 discs worth ${p} each"><span class="pack-dots">${Array.from({length:10},()=>'<i></i>').join('')}</span><b>10 × ${p}</b></span>`).join('')}${loose?`<span class="loose-discs">${Array.from({length:loose},(_,j)=>disc(packs*10+j)).join('')}</span>`:''}${n===0?'<span class="empty-place">0 discs</span>':''}</div>`;
}
function operationAlgorithm(state,step){
 const c=current.data,plan=interaction.plan,order=plan.ps.map((_,i)=>i).reverse(),division=plan.division;
 const digit=(n,i)=>plan.ps[i]>n?'':Math.floor(n/plan.ps[i])%10;
 const numberRow=(n,cls='')=>order.map(i=>`<span class="algorithm-cell ${cls} ${step?.focus===i?'active-cell':''}">${n===0&&i===0?0:digit(n,i)}</span>`).join('');
 const result=order.map(i=>{const n=state.result[i],value=plan.smallDiv?n:n===0&&plan.ps[i]>(Array.isArray(current.answer)?current.answer[0]:current.answer)?'':n;
  return `<span class="algorithm-cell result-cell ${step?.focus===i?'active-cell':''}">${['record','divide'].includes(step?.kind)&&step.focus===i?`<input id="operationInput" type="number" min="0" max="${plan.smallDiv?10:9}" step="1" inputmode="numeric" autocomplete="off" aria-label="${E(step.label)}" class="digit-entry">`:n===null?'·':value}</span>`;}).join('');
 if(plan.smallDiv)return `<div class="counter-algorithm">${c.a} ÷ ${c.b} = ${state.result[0]===null?'?':state.result[0]}</div>`;
 const carry=order.map(i=>`<span class="algorithm-cell carry-cell">${state.carry[i]?`<span class="carry-number">${state.carry[i]}</span>`:''}</span>`).join('');
 const revised=c.task==='subtract'?order.map(i=>`<span class="algorithm-cell revised-cell">${state.revised[i]===null?'':state.revised[i]}</span>`).join(''):carry;
 const regroupRow=(c.task==='subtract'?state.revised.some(v=>v!==null):state.carry.some(v=>v>0))?`<div class="algorithm-row regroup-row" aria-label="${c.task==='subtract'?'Exchanged amounts':'Regrouped digits'}">${revised}</div>`:'';
 const operand=division?c.a:['add','subtract'].includes(c.task)?c.a:plan.multiplicand;
 const work=division?state.work.at(-1):null;
 const working=work?`<div class="division-working"><strong>${E(placeName(work.place))}</strong><span>${work.available} ÷ ${c.b} → ${work.q}</span><span>${work.q} × ${c.b} = ${work.used===null?'?':work.used}</span><span>${work.available} − ${work.used===null?'?':work.used} = ${work.left===null?'?':work.left}</span></div>`:'';
 const original=order.map(i=>`<span class="algorithm-cell ${step?.focus===i?'active-cell':''} ${c.task==='subtract'&&state.revised[i]!==null?'old-digit':''}">${operand===0&&i===0?0:digit(operand,i)}</span>`).join('');
 return `<div class="written-algorithm ${division?'division-algorithm':''}" style="--places:${order.length}"><div class="algorithm-head">${order.map(i=>`<span>${plan.ps[i]===1?'O':plan.ps[i]===10?'T':plan.ps[i]===100?'H':plan.ps[i]===1000?'Th':'TTh'}</span>`).join('')}</div>${division?`<div class="algorithm-row quotient-row">${result}</div><div class="algorithm-row division-roof"><b class="algorithm-sign">${c.b}</b>${original}</div>${working}${state.remainder===null?'':`<p class="division-remainder">Remainder: ${state.remainder}</p>`}`:`${regroupRow}<div class="algorithm-row">${original}</div><div class="algorithm-row"><b class="algorithm-sign">${c.task==='add'?'+':c.task==='subtract'?'−':'×'}</b>${numberRow(['add','subtract'].includes(c.task)?c.b:plan.multiplier)}</div><div class="algorithm-row algorithm-answer">${result}</div>`}</div>`;
}
function lockOperationAnswer(){
 const conceptMultiply=engine==='operations'&&current?.data?.task==='multiply'&&current.data.grade<=2;
 const complete=conceptMultiply||interaction.operationComplete;
 document.body.classList.toggle('operation-complete',complete);
 $('answerForm').hidden=conceptMultiply||!complete;
 for(const input of $('answerFields').querySelectorAll('input'))input.disabled=!complete||solved;
 $('checkButton').disabled=!complete||solved;
}
function advanceOperation(reveal=false){
 const step=interaction.plan.steps[interaction.step];if(!step||solved)return;
 if(!reveal&&!checkOperationStep(step,$('operationInput').value)){attempts++;$('stepFeedback').textContent='Try this step again. Count the discs in the highlighted place.';$('stepFeedback').className='step-feedback retry';return;}
 if(reveal)hints++;interaction.step++;$('hint').hidden=true;drawOperation();lockOperationAnswer();
}
/* SMALL DIVISION CONCEPT ANIMATION v1 */
function smallDivisionCounterHTML(extra=''){return `<span class="small-div-counter ${extra}" aria-hidden="true"></span>`;}
function smallDivisionModel(c,plan,state){
 const sharing=c.task==='share',groupCount=sharing?c.b:c.a/c.b,targetSize=sharing?c.a/c.b:c.b;
 const counts=state.groups.length?state.groups.map(g=>g[0]):Array.from({length:groupCount},()=>0),remaining=state.top[0]??0;
 const cue=sharing?`Make ${groupCount} groups first. Then share one counter to Group 1, Group 2${groupCount>2?', Group 3 …':''}, and repeat.`:`Take ${targetSize} counters at a time. Every ${targetSize} counters form one complete group.`;
 return `<div class="small-div-concept">
  <div class="small-div-cue"><strong>${sharing?'Share equally':'Make equal groups'}</strong><span>${E(cue)}</span></div>
  <div class="small-div-stage">
   <div class="small-div-bank-wrap"><div class="small-div-bank-title">Counters to use <b id="smallDivRemaining">${remaining}</b></div><div class="small-div-bank" id="smallDivCounterBank">${Array.from({length:remaining},()=>smallDivisionCounterHTML()).join('')}${remaining?'':'<span class="small-div-empty">All counters have been grouped.</span>'}</div></div>
   <div class="small-div-flow" aria-hidden="true">→</div>
   <div class="small-div-groups" style="--small-div-groups:${Math.min(groupCount,4)}">${Array.from({length:groupCount},(_,i)=>`<div class="small-div-group ${!sharing&&counts[i]<targetSize?'small-div-group-pending ':''}${counts[i]===targetSize?'complete':''}" data-small-div-group="${i}"><div class="small-div-group-head"><strong>Group ${i+1}</strong></div><div class="small-div-group-counters">${Array.from({length:counts[i]},()=>smallDivisionCounterHTML('small-div-landed')).join('')}</div></div>`).join('')}</div>
  </div>
  <p class="small-div-live" id="smallDivLive" role="status" aria-live="polite">${sharing?`There are ${groupCount} groups. Share one counter into each group in turn.`:`${targetSize} counters will form each group. Finish one group before starting the next.`}</p>
 </div>`;
}
const smallDivWait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function animateSmallDivision(){
 if(interaction.smallDivisionBusy)return;
 const c=current.data,plan=interaction.plan,step=plan.steps[interaction.step];
 if(!plan.smallDiv||step?.kind!=='distribute')return;
 interaction.smallDivisionBusy=true;
 const input=$('operationInput'),next=$('operationNext'),teacher=$('teacherNext'),help=$('operationHelp'),back=$('operationBack'),reset=$('operationReset');
 [input,next,teacher,help,back,reset].forEach(el=>{if(el)el.disabled=true;});
 const source=Array.from(document.querySelectorAll('#smallDivCounterBank .small-div-counter'));
 const groups=Array.from(document.querySelectorAll('[data-small-div-group]'));
 const sharing=c.task==='share',targetSize=sharing?c.a/c.b:c.b,groupCount=groups.length;
 const order=source.map((_,i)=>sharing?i%groupCount:Math.floor(i/targetSize));
 const live=$('smallDivLive'),remaining=$('smallDivRemaining');
 const duration=Math.max(160,Math.min(520,Math.round(9000/Math.max(1,c.a))));
 const pause=Math.max(20,Math.min(100,Math.round(1800/Math.max(1,c.a))));
 try{
  for(let i=0;i<source.length;i++){
   const token=source[i],groupIndex=order[i],card=groups[groupIndex],target=card.querySelector('.small-div-group-counters');
   card.classList.add('active');
   if(live)live.textContent=sharing?`Counter ${i+1}: move to Group ${groupIndex+1}.`:`Group ${groupIndex+1}: place counter ${i%targetSize+1} of ${targetSize}.`;
   const placeholder=document.createElement('span');placeholder.className='small-div-counter small-div-placeholder';placeholder.setAttribute('aria-hidden','true');target.append(placeholder);
   const from=token.getBoundingClientRect(),to=placeholder.getBoundingClientRect(),flyer=token.cloneNode(true);
   flyer.classList.add('small-div-flyer');Object.assign(flyer.style,{position:'fixed',left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px',margin:'0',zIndex:'9999',pointerEvents:'none'});
   document.body.append(flyer);token.style.visibility='hidden';
   const dx=to.left-from.left,dy=to.top-from.top;
   const animation=flyer.animate([{transform:'translate(0,0) scale(1)'},{transform:`translate(${dx}px,${dy}px) scale(1.08)`}],{duration,easing:'cubic-bezier(.2,.75,.25,1)',fill:'forwards'});
   try{await animation.finished;}catch{}
   flyer.remove();placeholder.classList.remove('small-div-placeholder');placeholder.classList.add('small-div-landed');
   const count=target.querySelectorAll('.small-div-counter').length;
   if(remaining)remaining.textContent=String(source.length-i-1);
   if(count===targetSize){if(!sharing)card.classList.remove('small-div-group-pending');card.classList.add('complete');if(!sharing&&live)live.textContent=`${targetSize} counters form Group ${groupIndex+1}. Group ${groupIndex+1} is complete.`;await smallDivWait(280);}
   await smallDivWait(pause);
   card.classList.remove('active');
   if(sharing&&(i+1)%groupCount===0&&i<source.length-1){if(live)live.textContent=`One counter has been shared to every group. Start the next round.`;await smallDivWait(180);}
  }
  if(live)live.textContent=sharing?`All ${c.a} counters have been shared equally. Each group has ${c.a/c.b}.`:`All ${c.a} counters have been used. ${c.a/c.b} equal groups were formed.`;
  await smallDivWait(450);
 }finally{interaction.smallDivisionBusy=false;}
}
async function advanceSmallDivision(reveal=false){
 const run=interaction,step=run.plan.steps[run.step];if(!step||solved||run.smallDivisionBusy)return;
 if(!reveal&&!checkOperationStep(step,$('operationInput').value)){attempts++;$('stepFeedback').textContent=current.data.task==='share'?'Try again. Work out how many counters each group will receive.':'Try again. Work out how many complete groups can be made.';$('stepFeedback').className='step-feedback retry';return;}
 if(reveal)hints++;
 await animateSmallDivision();
 if(interaction!==run)return;
 run.step++;$('hint').hidden=true;
 if(run.step===run.plan.steps.length){
  run.operationComplete=true;
  attempts++;
  solved=true;
  results.push({first:attempts===1&&hints===0,firstAnswerCorrect:attempts===1&&hints===0,earned:attempts===1&&hints===0,attempts,hints,questionNumber:index+1,task:current?.data?.task,taskLabel:resultTaskLabel()});
  $('feedback').style.color='#24735e';
  $('feedback').textContent='Correct! '+current.explanation;
  $('nextButton').hidden=false;
  $('hintButton').disabled=true;
  progress();
 }
 drawOperation();lockOperationAnswer();
}
/* CONCEPT NUMBER SENTENCE v1 */
function conceptNumberSentence(c,step=null){
 const multiply=c.task==='multiply',symbol=multiply?'×':'÷',left=c.a,right=c.b;
 const answer=step&&!multiply?`<input id="operationInput" class="concept-answer-input" type="number" min="0" max="999" step="1" inputmode="numeric" autocomplete="off" aria-label="${E(step.label||'Answer')}">`:`<span class="concept-answer-box" aria-label="answer box" style="display:inline-block;flex:0 0 auto;width:64px;height:52px;border:3px solid #d6a144;border-radius:9px;background:#fffdf4;box-sizing:border-box">&nbsp;</span>`;
 return `<div class="concept-number-sentence" aria-label="${left} ${multiply?'times':'divided by'} ${right} equals answer"><span>${left}</span><span class="concept-operator">${symbol}</span><span>${right}</span><span>=</span>${answer}</div>`;
}

function drawSmallDivision(){
 const c=current.data,plan=interaction.plan,pos=interaction.step,step=plan.steps[pos],state=step?step.before:plan.final,previous=pos?plan.steps[pos-1]:null,host=$('diagram'),sharing=c.task==='share';
 interaction.operationComplete=!step;
 const intro=sharing?'The number of groups is fixed first. Share counters one at a time around the groups.':'The number in each group is fixed first. Complete one group, then form the next group.';
 host.innerHTML=`<div class="operation-workspace small-div-workspace"><div class="operation-top"><div class="step-heading"><span>${step?`Step ${pos+1} / ${plan.steps.length}`:'Completed'}</span><h3>${step?E(step.title):sharing?'Sharing complete':'Equal groups complete'}</h3></div><div class="small-div-key">${sharing?`${c.b} groups first`:`${c.b} in each group`}</div></div><div class="small-div-main"><div class="small-div-concept-column">${smallDivisionModel(c,plan,state)}${conceptNumberSentence(c,step)}</div><div class="operation-writing small-div-writing"><h4>Number sentence</h4>${operationAlgorithm(state,step)}<p class="small-div-meaning">${E(intro)}</p></div></div><div class="operation-controls small-div-controls">${previous?`<p class="last-step" role="status">✓ ${E(previous.equation)}</p>`:`<p class="last-step">${E(intro)}</p>`}${step?`<p>${E(step.prompt)}</p><div class="step-actions"><button type="button" class="primary" id="operationNext">${E(step.button)}</button><button type="button" class="teacher-only" id="teacherNext">Teacher: Next ▶</button><button type="button" id="operationHelp">Help me</button></div><p id="stepFeedback" class="step-feedback" role="status" aria-live="polite"></p>`:'<p class="operation-done">Now read the groups and write the whole answer below.</p>'}<div class="operation-rewind"><button type="button" id="operationBack" ${pos===0||solved?'disabled':''}>Previous step</button><button type="button" id="operationReset" ${pos===0||solved?'disabled':''}>Restart steps</button></div></div></div>`;
 if(step){
  $('operationNext').onclick=()=>step.kind==='distribute'?advanceSmallDivision(false):advanceOperation(false);
  $('teacherNext').onclick=()=>step.kind==='distribute'?advanceSmallDivision(true):advanceOperation(true);
  $('operationHelp').onclick=()=>{hints++;$('stepFeedback').className='step-feedback';$('stepFeedback').textContent=step.kind==='distribute'?intro:step.equation;};
  $('operationInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();step.kind==='distribute'?advanceSmallDivision(false):advanceOperation(false);}};
 }
 $('operationBack').onclick=()=>{if(pos>0&&!solved&&!interaction.smallDivisionBusy){interaction.step--;hints++;$('feedback').textContent='';drawOperation();lockOperationAnswer();}};
 $('operationReset').onclick=()=>{if(!solved&&!interaction.smallDivisionBusy){interaction.step=0;hints++;$('feedback').textContent='';drawOperation();lockOperationAnswer();}};
}

function drawOperation(){
 if(interaction.plan.division){drawDivision();return;}
 if(['add','subtract'].includes(current.data.task)){drawAddSub();return;}
 if(current.data.task==='multiply'&&current.data.grade<=2){drawConceptMultiplication();return;}
 if(['multiply','multiply-column'].includes(current.data.task)){drawMultiplication();return;}
 if(interaction.plan.smallDiv){drawSmallDivision();return;}
 const c=current.data,plan=interaction.plan,pos=interaction.step,step=plan.steps[pos],state=step?step.before:plan.final,previous=pos?plan.steps[pos-1]:null,host=$('diagram');interaction.operationComplete=!step;
 const order=plan.ps.map((_,i)=>i).reverse(),add=c.task==='add',sub=c.task==='subtract',mult=['multiply','multiply-column'].includes(c.task);
 const columns=order.map(i=>{
  const active=step?.focus===i,target=step?.target===i,n=state.top[i],received=add?state.carry[i]:0;
  let model=operationDiscs(n,plan.ps[i],received);
  if(mult&&active&&step.kind==='calculate'){const per=Math.floor(plan.multiplicand/plan.ps[i])%10;model=`<div class="multiplication-groups">${Array.from({length:plan.multiplier},(_,g)=>`<div class="multiply-group"><span>${per} × ${plan.ps[i]}</span><div class="group-dots">${Array.from({length:per},()=>'<i></i>').join('')}</div></div>`).join('')}</div>`;}
  const incoming=mult&&state.carry[i]?`<div class="disc-row regrouped-row"><span>${state.carry[i]} regrouped</span>${operationDiscs(state.carry[i],plan.ps[i],state.carry[i])}</div>`:'';
  return `<div class="operation-column ${active?'place-active':''} ${target?'exchange-target':''}" data-value="${plan.ps[i]}"><div class="operation-place">${plan.smallDiv?'Counters':E(placeName(plan.ps[i]))}</div><div class="disc-row"><span class="disc-row-label">${sub?'Available':add?'First / combined':plan.division?'Left to share':mult&&active&&step.kind==='calculate'?`${plan.multiplier} equal groups`:'Place-value discs'}</span>${model}${incoming}</div>${(add||sub)&&state.lower[i]>0?`<div class="disc-row second-number"><span class="disc-row-label">${add?'To add':'To take away'}</span>${operationDiscs(state.lower[i],plan.ps[i])}</div>`:''}</div>`;
 }).join('');
 const groups=state.groups.length?`<div class="shared-groups">${state.groups.map((g,j)=>`<div><strong>Group ${j+1}</strong>${plan.smallDiv?operationDiscs(g[0],1):`<span>${g.map((n,i)=>n?placeQuantity(n,plan.ps[i]):'').reverse().filter(Boolean).map(E).join(' + ')||'No discs yet'}</span><b>${g.reduce((v,n,i)=>v+n*plan.ps[i],0)}</b>`}</div>`).join('')}</div>`:'';
 const exchange=step&&['exchange','regroup'].includes(step.kind)?`<div class="exchange-preview"><span><b>${E(placeQuantity(step.amount,plan.ps[step.focus]))}</b><small>${step.kind==='regroup'?'groups of 10':'larger discs'}</small></span><span class="exchange-arrow" aria-hidden="true">→</span><span><b>${E(placeQuantity(step.received,plan.ps[step.target]))}</b><small>${step.kind==='regroup'?'move to the next place':'smaller discs'}</small></span><p>The value stays the same.</p></div>`:'';
 host.innerHTML=`<div class="operation-workspace"><div class="operation-top"><div class="step-heading"><span>Step ${Math.min(pos+1,plan.steps.length)} / ${plan.steps.length}</span><h3>${step?E(step.title):'All places complete!'}</h3></div><div class="place-progress">${order.map(i=>`<span class="${state.result[i]!==null?'finished':step?.focus===i?'current-place':''}">${plan.smallDiv?'Groups':E(placeName(plan.ps[i]))}</span>`).join('')}</div></div><div class="operation-main"><div class="operation-model"><div class="operation-board" style="--places:${order.length}">${columns}</div>${groups}</div><div class="operation-writing"><h4>${plan.smallDiv?'Number sentence':plan.division?'Division algorithm':'Written calculation'}</h4>${operationAlgorithm(state,step)}${exchange}</div></div><div class="operation-controls">${previous?`<p class="last-step" role="status">✓ ${E(previous.equation)}</p>`:'<p class="last-step">'+(plan.division?'Start at the largest place. Divide, multiply, subtract, exchange.':sub?'Start with ones. Exchange before taking away when needed.':'Start with ones. Calculate, regroup, record.')+'</p>'}${step?`<p>${E(step.prompt)}</p><div class="step-actions">${!['record','divide'].includes(step.kind)||plan.smallDiv?`<label><span>${E(step.label)}</span><input id="operationInput" type="number" min="0" max="999" step="1" inputmode="numeric" autocomplete="off" aria-label="${E(step.label)}"></label>`:''}<button type="button" class="primary" id="operationNext">${E(step.button)}</button><button type="button" class="teacher-only" id="teacherNext">Teacher: Next ▶</button><button type="button" id="operationHelp">Help me</button></div><p id="stepFeedback" class="step-feedback" role="status" aria-live="polite"></p>`:'<p class="operation-done">Now read your completed working and write the whole answer below.</p>'}<div class="operation-rewind"><button type="button" id="operationBack" ${pos===0||solved?'disabled':''}>Previous step</button><button type="button" id="operationReset" ${pos===0||solved?'disabled':''}>Restart steps</button></div></div></div>`;
 if(step){$('operationNext').onclick=()=>advanceOperation();$('teacherNext').onclick=()=>advanceOperation(true);$('operationHelp').onclick=()=>{hints++;$('stepFeedback').className='step-feedback';$('stepFeedback').textContent=hints===1?step.prompt:step.equation;};$('operationInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();advanceOperation();}};}
 $('operationBack').onclick=()=>{if(pos>0&&!solved){interaction.step--;hints++;$('feedback').textContent='';drawOperation();lockOperationAnswer();}};$('operationReset').onclick=()=>{if(!solved){interaction.step=0;hints++;$('feedback').textContent='';drawOperation();lockOperationAnswer();}};
}
let addSubSVGId=0;
function addSubToken(p,extra=''){
 const blocks=(interaction.representation||current.data.representation)==='blocks'&&!interaction.plan.ps.includes(10000);
 let content=String(p);
 if(blocks){
  const prefix='block-'+(++addSubSVGId)+'-';
  content=BASE_TEN_SVGS[p].replace(/id="([^"]+)"/g,(_m,id)=>`id="${prefix}${id}"`).replace(/url\(#([^)]*)\)/g,(_m,id)=>`url(#${prefix}${id})`);
 }
 return `<span class="addsub-token ${blocks?'addsub-block':'addsub-disc'} ${extra}" data-place="${p}">${content}</span>`;
}
function addSubPile(n,p,id,fresh=0){return `<div class="addsub-pile" id="${id}" aria-label="${placeQuantity(n,p)}">${Array.from({length:n},(_,i)=>addSubToken(p,i>=n-fresh?'addsub-regrouped-glow':'')).join('')}${n?'':'<span class="addsub-empty" aria-hidden="true">0</span>'}</div>`;}
function fitAddSubPiles(){
 document.querySelectorAll('.addsub-pile').forEach(pile=>{
  const tokens=Array.from(pile.querySelectorAll('.addsub-token')),n=tokens.length;if(!n)return;
  const cell=pile.parentElement,w=Math.max(20,cell.clientWidth-16),h=Math.max(20,cell.clientHeight-16),p=Number(tokens[0].dataset.place),blocks=tokens[0].classList.contains('addsub-block');
  const [nw,nh]=blocks?p===1?[28,32]:p===10?[19,96]:p===100?[68,45]:[58,66]:[44,44];
  let scale=0,cols=1;
  for(let k=1;k<=n;k++){const s=Math.min(1.25,(w-(k-1)*4)/(k*nw),(h-(Math.ceil(n/k)-1)*4)/(Math.ceil(n/k)*nh));if(s>scale){scale=s;cols=k;}}
  scale=Math.max(.25,scale);pile.style.setProperty('--pile-cols',cols);pile.style.setProperty('--token-width',nw*scale+'px');pile.style.setProperty('--token-height',nh*scale+'px');pile.style.setProperty('--token-font',Math.max(12,Math.min(17,17*scale))+'px');
 });
}
function addSubAlgorithm(state,step){
 const c=current.data,plan=interaction.plan,order=plan.ps.map((_,i)=>i).reverse(),sub=c.task==='subtract',focus=step?.kind==='exchange'?step.target:step?.focus;
 const row=(content,cls='',sign='')=>`<div class="addsub-algo-row ${cls}"><b class="addsub-sign">${sign}</b>${order.map(i=>`<span class="addsub-algo-cell ${i===focus?'addsub-focus':''}">${content(i)}</span>`).join('')}</div>`;
 const digits=(n,strike=false)=>i=>`<span class="${strike&&state.revised[i]!==null?'addsub-strike':''}">${plan.ps[i]>n&&!(n===0&&i===0)?'':Math.floor(n/plan.ps[i])%10}</span>`;
 const labels=order.map(i=>`<span>${plan.ps[i]===10000?'TTh':plan.ps[i]===1000?'Th':plan.ps[i]===100?'H':plan.ps[i]===10?'T':'O'}</span>`).join('');
 const renamed=state.revised.some(n=>n!==null)?row(i=>state.revised[i]===null?'':`<b class="${sub?'addsub-renamed':'addsub-carried'}">${state.revised[i]}</b>`,'addsub-annotation'):'';
 return `<div class="addsub-algorithm" style="--places:${order.length}"><div class="addsub-algo-head"><span></span>${labels}</div>${renamed}${row(digits(c.a,sub))}${row(digits(c.b),'',sub?'−':'+')}${row(i=>`<b class="addsub-result ${state.result[i]===null?'addsub-mystery':''}">${state.result[i]===null?'?':state.result[i]===0&&i>0&&plan.ps[i]>current.answer?'':state.result[i]}</b>`,'addsub-result-row')}</div>`;
}
function drawAddSub(){
 const c=current.data,plan=interaction.plan,pos=interaction.step,step=plan.steps[pos],previous=pos?plan.steps[pos-1]:null,state=step?step.before:plan.final,order=plan.ps.map((_,i)=>i).reverse(),add=c.task==='add',host=$('diagram');
 interaction.operationComplete=!step;const forced=plan.ps.includes(10000),blocks=(interaction.representation||c.representation)==='blocks'&&!forced;
 const focus=step?.kind==='exchange'?step.target:step?.focus;
 const headers=order.map(i=>`<div class="addsub-place ${i===focus?'addsub-active':''}" data-place="${plan.ps[i]}">${E(placeName(plan.ps[i]))}</div>`).join('');
 const cells=(counts,row)=>order.map(i=>{const fresh=row==='top'&&previous?.kind==='addition-place'&&previous.carryOut&&i===previous.focus+1?previous.carryOut:row==='top'&&previous?.kind==='exchange'&&i===previous.target?10:0;return `<div class="addsub-cell ${i===focus?'addsub-active':''}" data-place="${plan.ps[i]}">${addSubPile(counts[i],plan.ps[i],`addsub-${row}-${i}`,fresh)}</div>`;}).join('');
 host.innerHTML=`<div class="operation-workspace addsub-workspace"><div class="operation-top"><div class="step-heading"><span>${step?`Step ${pos+1} / ${plan.steps.length}`:'Completed'}</span><h3>${step?E(step.title):'All places complete!'}</h3></div><div class="addsub-model-options" role="group" aria-label="Model"><button type="button" id="addsubDiscs" aria-pressed="${!blocks}">Discs</button><button type="button" id="addsubBlocks" aria-pressed="${blocks}" ${forced?'disabled':''}>Base-ten blocks</button></div></div><div class="addsub-main"><div class="addsub-model"><p class="addsub-mat-label">${add?'First number / combined · second number below':'Working mat · start with the first number'}</p>${forced?'<p class="addsub-limit-note">Ten thousands are shown with place-value discs.</p>':''}<div class="addsub-mat ${add?'addsub-two-rows':'addsub-one-row'} ${!step&&add?'addsub-together':''}" style="--places:${order.length}">${headers}${cells(state.top,'top')}${add?cells(state.lower,'lower'):''}</div></div><div class="addsub-writing"><h4>Written ${add?'addition':'subtraction'}</h4>${addSubAlgorithm(state,step)}${step?`<div class="addsub-step-card"><p>${E(step.prompt)}</p></div>`:''}</div></div><div class="operation-controls addsub-controls">${pos&&step?`<p class="addsub-last-step" role="status">${E(plan.steps[pos-1].equation)}</p>`:''}${step?'<div class="step-actions"><button type="button" class="primary" id="operationNext">Next Step ▶</button><button type="button" id="operationHelp">Help me</button></div><p id="stepFeedback" class="step-feedback" role="status" aria-live="polite"></p>':'<p class="operation-done">Now enter the whole answer below.</p>'}<div class="operation-rewind"><button type="button" id="operationBack" ${pos===0||solved?'disabled':''}>Previous step</button><button type="button" id="operationReset" ${pos===0||solved?'disabled':''}>Restart steps</button></div></div></div>`;
 const model=which=>{if(interaction.addSubBusy)return;interaction.representation=which;c.representation=which;config.representation=which;draft.representation=which;if($('setting-representation'))$('setting-representation').value=which;drawAddSub();};
 $('addsubDiscs').onclick=()=>model('discs');$('addsubBlocks').onclick=()=>model('blocks');
 if(step){$('operationNext').onclick=()=>advanceAddSub();$('operationHelp').onclick=()=>{hints++;$('stepFeedback').textContent=step.equation;};}
 $('operationBack').onclick=()=>{if(pos>0&&!solved&&!interaction.addSubBusy){interaction.step--;hints++;drawOperation();lockOperationAnswer();}};
 $('operationReset').onclick=()=>{if(!solved&&!interaction.addSubBusy){interaction.step=0;hints++;drawOperation();lockOperationAnswer();}};
 requestAnimationFrame(fitAddSubPiles);
}
async function moveAddSubToken(source,target,p,duration=500){
 target.querySelector('.addsub-empty')?.remove();const from=source.getBoundingClientRect(),wrap=document.createElement('div');wrap.innerHTML=addSubToken(p);const token=wrap.firstElementChild;token.style.visibility='hidden';target.append(token);fitAddSubPiles();
 const to=token.getBoundingClientRect(),ghost=token.cloneNode(true);ghost.classList.add('addsub-ghost');ghost.style.cssText=`position:fixed;left:0;top:0;width:${to.width}px;height:${to.height}px;font-size:${getComputedStyle(token).fontSize};visibility:visible;z-index:9999`;document.body.append(ghost);
 try{await ghost.animate([{transform:`translate(${from.left}px,${from.top}px) scale(.8)`},{transform:`translate(${to.left}px,${to.top}px) scale(1)`}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:duration,easing:'ease-in-out',fill:'forwards'}).finished;}catch{}finally{ghost.remove();token.style.visibility='';}
}
function addSubPause(ms){
 return new Promise(resolve=>setTimeout(resolve,matchMedia('(prefers-reduced-motion: reduce)').matches?0:ms));
}
async function addSubPulse(tokens,duration=900){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 await Promise.all(tokens.map((token,index)=>{
  try{return token.animate(
   [{transform:'scale(1)',filter:'brightness(1)'},{transform:'scale(1.13)',filter:'brightness(1.18)',offset:.5},{transform:'scale(1)',filter:'brightness(1)'}],
   {duration,delay:index*35,easing:'ease-in-out'}
  ).finished;}catch{return Promise.resolve();}
 }));
}
async function advanceAddSub(){
 const run=interaction,step=run.plan.steps[run.step];if(!step||solved||run.addSubBusy)return;
 run.addSubBusy=true;$('diagram').querySelectorAll('button').forEach(b=>b.disabled=true);$('hint').hidden=true;
 try{
  const i=step.focus,p=run.plan.ps[i],top=$(`addsub-top-${i}`),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(step.kind==='addition-place'){
   const lower=$(`addsub-lower-${i}`),pieces=Array.from(lower.querySelectorAll('.addsub-token'));
   if(pieces.length)$('stepFeedback').textContent='Move the second number into the working column, one counter at a time.';
   for(let j=0;j<pieces.length;j++){
    const token=pieces[j];
    await moveAddSubToken(token,top,p,reduced?0:520);
    if(interaction!==run)return;
    token.remove();
    $('stepFeedback').textContent=`Combined ${j+1} of ${pieces.length} ${placeName(p)}.`;
    await addSubPause(110);
   }
   if(step.carryOut){
    const ten=Array.from(top.querySelectorAll('.addsub-token')).slice(-10);
    ten.forEach(t=>t.classList.add('addsub-bundled'));
    $('stepFeedback').textContent=`There are 10 ${placeName(p)}. Group these 10 together before regrouping.`;
    await addSubPulse(ten,1050);
    await addSubPause(350);
    if(interaction!==run)return;
    const next=$(`addsub-top-${i+1}`),nextPlace=run.plan.ps[i+1];
    $('stepFeedback').textContent=`10 ${placeName(p)} become 1 ${placeName(nextPlace).replace(/s$/,'')}. Watch the new counter move to the next column.`;
    const movePromise=moveAddSubToken(ten[0],next,nextPlace,reduced?0:2200);
    const collapsePromises=ten.map((t,index)=>{
     if(reduced)return Promise.resolve();
     try{return t.animate(
      [{opacity:1,transform:'scale(1)'},{opacity:.9,transform:'scale(1.08)',offset:.25},{opacity:.22,transform:'scale(.72)'}],
      {duration:1750,delay:index*35,easing:'ease-in-out',fill:'forwards'}
     ).finished;}catch{return Promise.resolve();}
    });
    await Promise.all([movePromise,...collapsePromises]);
    if(interaction!==run)return;
    ten.forEach(t=>t.remove());
    $('stepFeedback').textContent=`Regrouped: 10 ${placeName(p)} → 1 ${placeName(nextPlace).replace(/s$/,'')}.`;
    await addSubPause(650);
   }
  }else if(step.kind==='exchange'){
   const donor=top.querySelector('.addsub-token'),target=$(`addsub-top-${step.target}`),targetPlace=run.plan.ps[step.target],sourceName=placeName(p).replace(/s$/,''),targetName=placeName(targetPlace);
   if(!donor)return;
   donor.classList.add('addsub-bundled');
   $('stepFeedback').textContent=`Exchange 1 ${sourceName} for 10 ${targetName}. First, focus on the ${sourceName} being exchanged.`;
   await addSubPulse([donor],1100);
   await addSubPause(350);
   for(let j=1;j<=10;j++){
    if(interaction!==run)return;
    $('stepFeedback').textContent=`1 ${sourceName} → ${j} of 10 ${targetName}. Watch each new counter appear.`;
    await moveAddSubToken(donor,target,targetPlace,reduced?0:430);
    await addSubPause(75);
   }
   if(!reduced){
    try{await donor.animate(
     [{opacity:1,transform:'scale(1)'},{opacity:.3,transform:'scale(.65)'}],
     {duration:700,easing:'ease-in',fill:'forwards'}
    ).finished;}catch{}
   }
   donor.remove();
   $('stepFeedback').textContent=`Exchange complete: 1 ${sourceName} = 10 ${targetName}. The total value has not changed.`;
   await addSubPause(700);
  }else{
   const pieces=Array.from(top.querySelectorAll('.addsub-token')).slice(-step.amount);
   if(step.amount)$('stepFeedback').textContent=`Take away ${step.amount} ${placeName(p)} one at a time.`;
   for(let j=0;j<pieces.length;j++){
    const t=pieces[j];t.classList.add('addsub-crossed');
    if(!reduced){
     try{await t.animate(
      [{opacity:1,transform:'scale(1)'},{opacity:1,transform:'scale(1.08)',offset:.45},{opacity:0,transform:'scale(.78)'}],
      {duration:520,easing:'ease-in-out',fill:'forwards'}
     ).finished;}catch{}
    }
    t.remove();
    $('stepFeedback').textContent=`Taken away ${j+1} of ${pieces.length} ${placeName(p)}.`;
    await addSubPause(90);
   }
  }
  if(interaction!==run)return;
  run.step++;drawOperation();lockOperationAnswer();
 }finally{run.addSubBusy=false;}
}
window.addEventListener('resize',()=>{if(current&&['add','subtract'].includes(current.data.task)&&engine==='operations')requestAnimationFrame(fitAddSubPiles);});
// P1/P2 multiplication is model-first. The written algorithm is optional and hidden initially.
let multiplicationSVGId=0;
function multiplicationBlockPiece(p,cls=''){
 const svg=BASE_TEN_SVGS[p]||BASE_TEN_SVGS[1],prefix='mult-block-'+(++multiplicationSVGId)+'-';
 const content=svg.replace(/id="([^"]+)"/g,(_m,id)=>`id="${prefix}${id}"`).replace(/url\(#([^)]*)\)/g,(_m,id)=>`url(#${prefix}${id})`);
 return `<span class="multip-concept-piece multip-concept-block ${cls}" data-place="${p}">${content}</span>`;
}
function multiplicationDiscPiece(p,cls=''){return `<span class="multip-concept-piece multip-concept-disc ${cls}" data-place="${p}">${p}</span>`;}
function multiplicationConceptQuantity(value,representation){
 const tens=Math.floor(value/10),ones=value%10,piece=p=>representation==='blocks'?multiplicationBlockPiece(p):multiplicationDiscPiece(p);
 return `<div class="multip-concept-quantity" aria-label="${E(String(value))}">${Array.from({length:tens},()=>piece(10)).join('')}${Array.from({length:ones},()=>piece(1)).join('')}</div>`;
}
function multiplicationStaticAlgorithm(c){
 return `<div class="multip-static-algorithm" aria-label="${c.a} times ${c.b} equals ${c.a*c.b}"><div>${c.a}</div><div><span>×</span>${c.b}</div><div class="multip-static-line"></div><strong>${c.a*c.b}</strong></div>`;
}
function drawConceptMultiplication(){
 const c=current.data,host=$('diagram'),representation=interaction.multiplicationRepresentation||c.representation||'blocks';
 interaction.multiplicationRepresentation=representation;interaction.operationComplete=true;
 const showAlgorithm=Boolean(interaction.showMultiplicationAlgorithm),product=c.a*c.b;
 const state=interaction.conceptMultiplyState||(interaction.conceptMultiplyState={rep:'',mult:'',feedback:'',ok:false});
 const groups=Array.from({length:c.a},(_,i)=>`<div class="multip-concept-group"><strong>Group ${i+1}</strong>${multiplicationConceptQuantity(c.b,representation)}</div>`).join('');
 const repeated=Array.from({length:c.a},()=>c.b).join(' + ');
 const focusLabel=multiplicationFocusOptions(c.grade).find(([key])=>key===c.multiplicationFocus)?.[1]||'Multiplication';
 const emphasis=c.multiplicationFocus==='p1-repeated'
  ?'<strong>Repeated addition</strong>'
  :c.multiplicationFocus==='p1-equal'
    ?'<strong>Equal groups</strong>'
    :`<strong>${E(focusLabel)}</strong>`;
 const answerInput=(id,value,label)=>`<input id="${id}" class="multip-concept-answer ${state.ok?'is-correct':''}" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="${E(label)}" value="${E(value)}" ${state.ok?'disabled':''}>`;
 host.innerHTML=`<div class="operation-workspace multip-concept-workspace">
  <div class="operation-top">
   <div class="step-heading"><span>P${c.grade} multiplication</span><h3>${emphasis}</h3></div>
   <div class="multip-concept-options" role="group" aria-label="Multiplication display">
    <button type="button" id="multipConceptBlocks" aria-pressed="${representation==='blocks'}">Base-ten set</button>
    <button type="button" id="multipConceptDiscs" aria-pressed="${representation==='discs'}">Place-value discs</button>
    <button type="button" id="multipAlgorithmToggle" aria-pressed="${showAlgorithm}">${showAlgorithm?'Hide Algorithm':'Show Algorithm'}</button>
   </div>
  </div>
  <div class="multip-concept-main ${showAlgorithm?'algorithm-shown':''}">
   <div class="multip-concept-model">
    <p class="multip-concept-cue"><strong>${c.a} equal groups</strong> with <strong>${c.b}</strong> in each group.</p>
    <div class="multip-concept-groups" style="--groups:${Math.min(c.a,5)}">${groups}</div>
    <div class="multip-concept-bridge">
     <div><span>Repeated addition</span><strong class="multip-concept-equation">${E(repeated)} = ${answerInput('repAnswer',state.rep,'Repeated addition answer')}</strong></div>
     <div><span>Multiplication sentence</span><strong class="multip-concept-equation">${c.a} × ${c.b} = ${answerInput('multAnswer',state.mult,'Multiplication answer')}</strong></div>
    </div>
    <div class="multip-concept-check-row">
     <button type="button" class="primary" id="conceptMultiplyCheck" ${state.ok?'disabled':''}>Check</button>
     <p id="conceptMultiplyFeedback" class="multip-concept-feedback ${state.ok?'correct':state.feedback?'wrong':''}" role="status" aria-live="polite">${E(state.feedback)}</p>
     <button type="button" class="primary multip-concept-next" id="conceptMultiplyNext" ${state.ok?'':'hidden'}>${index+1===config.count?'Finish activity →':'Next question →'}</button>
    </div>
   </div>
   ${showAlgorithm?`<div class="multip-concept-algorithm"><h4>Written algorithm · optional preview</h4>${multiplicationStaticAlgorithm(c)}<p>P1 and P2 learn the multiplication concept and tables through models. The formal multiplication algorithm is taught from P3.</p></div>`:''}
  </div>
 </div>`;
 const setModel=which=>{interaction.multiplicationRepresentation=which;c.representation=which;config.representation=which;draft.representation=which;if($('setting-representation'))$('setting-representation').value=which;drawConceptMultiplication();};
 $('multipConceptBlocks').onclick=()=>setModel('blocks');
 $('multipConceptDiscs').onclick=()=>setModel('discs');
 $('multipAlgorithmToggle').onclick=()=>{interaction.showMultiplicationAlgorithm=!showAlgorithm;drawConceptMultiplication();};
 const rep=$('repAnswer'),mult=$('multAnswer'),check=$('conceptMultiplyCheck'),feedback=$('conceptMultiplyFeedback'),next=$('conceptMultiplyNext');
 const clean=input=>{input.value=input.value.replace(/\D/g,'').slice(0,4);};
 [rep,mult].forEach(input=>{input.oninput=()=>{clean(input);input.classList.remove('is-wrong');state[input===rep?'rep':'mult']=input.value;};input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();check.click();}};});
 check.onclick=()=>{
  if(state.ok||solved)return;
  state.rep=rep.value.trim();state.mult=mult.value.trim();attempts++;
  if(Number(state.rep)===product&&Number(state.mult)===product&&state.rep!==''&&state.mult!==''){
   state.ok=true;state.feedback='Correct!';solved=true;
   rep.classList.remove('is-wrong');mult.classList.remove('is-wrong');rep.classList.add('is-correct');mult.classList.add('is-correct');rep.disabled=true;mult.disabled=true;check.disabled=true;
   feedback.className='multip-concept-feedback correct';feedback.textContent='Correct!';
   results.push({first:attempts===1&&hints===0,firstAnswerCorrect:attempts===1&&hints===0,earned:attempts===1&&hints===0,attempts,hints,questionNumber:index+1,task:current?.data?.task,taskLabel:resultTaskLabel()});
   $('feedback').style.color='#24735e';$('feedback').textContent='Correct! '+current.explanation;
   $('nextButton').hidden=true;$('hintButton').disabled=true;if(next)next.hidden=false;progress();
  }else{
   state.ok=false;state.feedback='Try again.';
   rep.classList.toggle('is-wrong',state.rep!==''&&Number(state.rep)!==product);
   mult.classList.toggle('is-wrong',state.mult!==''&&Number(state.mult)!==product);
   feedback.className='multip-concept-feedback wrong';feedback.textContent='Try again.';
  }
 };
 if(next)next.onclick=()=>{index++;if(index>=config.count)summary();else showQuestion();};
 requestAnimationFrame(()=>{if(state.ok)next?.focus();else rep?.focus();});
}

// Uncle Joe and the Key of Product: grouped discs and paired digit/carry checking.
function multiplicationPile(n,p,label){
 const representation=interaction.multiplicationRepresentation||current.data.representation||'discs';
 const piece=()=>{
  if(representation!=='blocks')return `<span class="multip-disc" data-place="${p}">${p}</span>`;
  const svg=BASE_TEN_SVGS[p]||BASE_TEN_SVGS[1],prefix='multip-live-'+(++multiplicationSVGId)+'-';
  const content=svg.replace(/id="([^"]+)"/g,(_m,id)=>`id="${prefix}${id}"`).replace(/url\(#([^)]*)\)/g,(_m,id)=>`url(#${prefix}${id})`);
  return `<span class="multip-disc multip-block" data-place="${p}">${content}</span>`;
 };
 return `<div class="multip-pile" data-place="${p}" aria-label="${E(label||placeQuantity(n,p))}">${Array.from({length:n},piece).join('')}${n?'':'<span class="multip-empty" aria-hidden="true">0</span>'}</div>`;
}
function fitMultiplicationPiles(){
 $('diagram').querySelectorAll('.multip-pile').forEach(pile=>{
  const n=pile.querySelectorAll('.multip-disc').length;if(!n)return;
  const cell=pile.parentElement,w=Math.max(12,cell.clientWidth-8),h=Math.max(12,cell.clientHeight-8),gap=3;
  let best={size:0,cols:1};
  const fixed=cell.classList.contains('multip-group')?n:cell.classList.contains('multip-leftovers')?(Number(pile.dataset.place)===1?2:1):null;
  for(const cols of fixed?[fixed]:Array.from({length:n},(_,i)=>i+1)){
   const rows=Math.ceil(n/cols),size=Math.min(document.body.classList.contains('pupil')?42:36,(w-(cols-1)*gap)/cols,(h-(rows-1)*gap)/rows);
   if(size>best.size)best={size,cols};
  }
  const size=Math.max(10,Math.floor(best.size)),digits=String(pile.dataset.place).length;
  pile.style.setProperty('--multip-cols',best.cols);pile.style.setProperty('--multip-size',size+'px');pile.style.setProperty('--multip-font',Math.max(5,Math.min(16,Math.floor((size-3)/(digits*.65))))+'px');
 });
}
function multiplicationAlgorithm(state,step){
 const plan=interaction.plan,order=plan.ps.map((_,i)=>i).reverse(),focus=step?.focus;
 const entry=f=>`<input type="text" inputmode="numeric" maxlength="1" autocomplete="off" class="multip-entry ${f.key.startsWith('carry')?'multip-carry-input':'multip-result-input'}" data-field="${f.key}" aria-label="${E(f.label)}">`;
 const row=(content,cls='',sign='')=>`<div class="multip-algo-row ${cls}"><b class="multip-sign">${sign}</b>${order.map(i=>`<span class="multip-algo-cell ${i===focus?'multip-focus':''}">${content(i)}</span>`).join('')}</div>`;
 const digit=(n,i)=>plan.ps[i]>n&&!(n===0&&i===0)?'':Math.floor(n/plan.ps[i])%10;
 const carries=row(i=>{const f=step?.inputs.find(f=>f.key===`carry-${i}`);return state.carry[i]?`<b class="multip-carry-chip">${state.carry[i]}</b>`:f?entry(f):'';},'multip-carry-row');
 const results=row(i=>state.result[i]!==null?`<b class="multip-result">${state.result[i]}</b>`:step?.focus===i?entry(step.inputs[0]):'<b class="multip-result multip-mystery">?</b>','multip-result-row');
 return `<div class="multip-algorithm" style="--places:${order.length}"><div class="multip-algo-head"><span></span>${order.map(i=>`<span>${plan.ps[i]===1000?'Th':plan.ps[i]===100?'H':plan.ps[i]===10?'T':'O'}</span>`).join('')}</div>${carries}${row(i=>digit(plan.multiplicand,i))}${row(i=>i===0?plan.multiplier:'','','×')}${results}</div>`;
}
function drawMultiplication(){
 const plan=interaction.plan,pos=interaction.step,step=plan.steps[pos],state=step?step.before:plan.final,order=plan.ps.map((_,i)=>i).reverse(),host=$('diagram');
 interaction.operationComplete=!step;
 const columns=order.map(i=>{
  const p=plan.ps[i],done=state.result[i]!==null,base=Math.floor(plan.multiplicand/p)%10;
  const rows=done?`<div class="multip-leftovers">${multiplicationPile(state.result[i],p)}</div>`:`<div class="multip-groups" style="--groups:${plan.multiplier}">${Array.from({length:plan.multiplier},(_,g)=>`<div class="multip-group">${multiplicationPile(base,p,`Group ${g+1}: ${placeQuantity(base,p)}`)}</div>`).join('')}</div>`;
  return `<div class="multip-column ${step?.focus===i?'multip-active':''}" data-place="${p}"><div class="multip-place">${E(placeName(p))}</div><div class="multip-carry-slot" aria-label="Regrouped ${E(placeName(p))}">${state.carry[i]?multiplicationPile(state.carry[i],p):''}</div>${rows}</div>`;
 }).join('');
 const representation=interaction.multiplicationRepresentation||current.data.representation||'discs';interaction.multiplicationRepresentation=representation;
 host.innerHTML=`<div class="operation-workspace multip-workspace"><div class="operation-top"><div class="step-heading"><span>${step?`Step ${pos+1} / ${plan.steps.length}`:'Completed'}</span><h3>${step?E(step.title):'Product complete!'}</h3></div><div class="multip-model-options" role="group" aria-label="Multiplication model"><button type="button" id="multipBlocks" aria-pressed="${representation==='blocks'}">Base-ten set</button><button type="button" id="multipDiscs" aria-pressed="${representation==='discs'}">Place-value discs</button><button type="button" id="multipMatToggle">${interaction.hideMultiplicationMat?'Show':'Hide'} place-value mat</button></div></div><div class="multip-main ${interaction.hideMultiplicationMat?'multip-mat-hidden':''}"><div class="multip-model"><p class="multip-caption">${plan.multiplier} equal groups · each row starts with ${plan.multiplicand}</p><div class="multip-mat" style="--places:${order.length}">${columns}</div>${current.data.task==='multiply'?conceptNumberSentence(current.data):''}</div><div class="multip-writing"><h4>Multiplication algorithm</h4>${multiplicationAlgorithm(state,step)}${step?'<p class="multip-entry-note">Enter the highlighted answer digit and carry digit, when shown.</p>':''}</div></div><div class="operation-controls multip-controls">${step?`<p class="multip-prompt">${E(step.prompt)}</p><div class="multip-controls-layout"><div class="multip-keypad-panel"><div class="multip-keypad-help">Tap a highlighted box, then a number</div><div class="multip-keypad" role="group" aria-label="Number keypad">${[1,2,3,4,5,6,7,8,9,0].map(n=>`<button type="button" data-multip-digit="${n}">${n}</button>`).join('')}<button type="button" id="multipErase" aria-label="Erase digit">⌫</button><button type="button" id="multipClear">Del</button></div></div><div class="step-actions"><button type="button" class="primary" id="operationNext">Check Digit</button><button type="button" class="teacher-only" id="teacherNext">Teacher: Next ▶</button><button type="button" id="operationHelp">Help me</button></div></div><p id="stepFeedback" class="step-feedback" role="status" aria-live="polite"></p>`:''}<div class="operation-rewind"><button type="button" id="operationBack" ${pos===0||solved?'disabled':''}>Previous step</button><button type="button" id="operationReset" ${pos===0||solved?'disabled':''}>Restart steps</button></div></div></div>`;
 if(step){
  const inputs=step.inputs.map(f=>host.querySelector(`[data-field="${f.key}"]`));let active=inputs[0];
  const select=input=>{inputs.forEach(i=>i.classList.remove('multip-selected'));active=input;if(active)active.classList.add('multip-selected');};
  inputs.forEach(input=>{input.onfocus=()=>select(input);input.onclick=()=>select(input);input.oninput=()=>{input.value=input.value.replace(/\D/g,'').slice(-1);};input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();advanceMultiplication();}};});
  select(active);
  host.querySelectorAll('[data-multip-digit]').forEach(b=>{b.onpointerdown=e=>e.preventDefault();b.onclick=()=>{if(active&&!active.disabled){active.value=b.dataset.multipDigit;select(inputs[Math.min(inputs.length-1,inputs.indexOf(active)+1)]);}};});
  $('multipClear').onpointerdown=$('multipErase').onpointerdown=e=>e.preventDefault();
  $('multipClear').onclick=()=>{if(active&&!active.disabled)active.value='';};
  $('multipErase').onclick=()=>{if(!active||active.disabled)return;if(!active.value)select(inputs[Math.max(0,inputs.indexOf(active)-1)]);active.value='';};
  $('operationNext').onclick=()=>advanceMultiplication();$('teacherNext').onclick=()=>advanceMultiplication(true);$('operationHelp').onclick=()=>{hints++;$('stepFeedback').className='step-feedback';$('stepFeedback').textContent=step.equation;};
 }
 const setMultipModel=which=>{if(interaction.multiplicationBusy)return;interaction.multiplicationRepresentation=which;current.data.representation=which;config.representation=which;draft.representation=which;if($('setting-representation'))$('setting-representation').value=which;drawMultiplication();};
 $('multipBlocks').onclick=()=>setMultipModel('blocks');$('multipDiscs').onclick=()=>setMultipModel('discs');
 $('multipMatToggle').onclick=()=>{interaction.hideMultiplicationMat=!interaction.hideMultiplicationMat;host.querySelector('.multip-main').classList.toggle('multip-mat-hidden',interaction.hideMultiplicationMat);$('multipMatToggle').textContent=(interaction.hideMultiplicationMat?'Show':'Hide')+' place-value mat';requestAnimationFrame(fitMultiplicationPiles);};
 $('operationBack').onclick=()=>{if(pos>0&&!solved){interaction.step--;hints++;drawOperation();lockOperationAnswer();}};
 $('operationReset').onclick=()=>{if(!solved){interaction.step=0;hints++;drawOperation();lockOperationAnswer();}};
 multiplicationResizeWatcher?.disconnect();multiplicationResizeWatcher?.observe(host.querySelector('.multip-mat'));requestAnimationFrame(fitMultiplicationPiles);
}

/* MULTIPLICATION REGROUP ANIMATION v1 */
const multiplicationRegroupWait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function animateMultiplicationRegroup(run,step){
 if(!step?.carryOut||step.finalCarry||run.multiplicationBusy)return;
 const p=run.plan.ps[step.focus],nextP=run.plan.ps[step.focus+1];
 const host=$('diagram'),currentCol=host.querySelector(`.multip-column[data-place="${p}"]`),nextCol=host.querySelector(`.multip-column[data-place="${nextP}"]`);
 if(!currentCol||!nextCol||currentCol.offsetParent===null||nextCol.offsetParent===null)return;
 const source=Array.from(currentCol.querySelectorAll('.multip-disc')).filter(el=>el.getBoundingClientRect().width>0);
 const needed=step.carryOut*10;
 if(source.length<needed)return;
 run.multiplicationBusy=true;
 const controls=['operationNext','teacherNext','operationHelp','operationBack','operationReset','multipBlocks','multipDiscs','multipMatToggle','multipClear','multipErase'].map(id=>$(id)).filter(Boolean);
 controls.forEach(el=>el.disabled=true);
 host.querySelectorAll('[data-multip-digit],.multip-entry').forEach(el=>el.disabled=true);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,moveMs=reduced?0:340,betweenMs=reduced?0:70,convertMs=reduced?0:900,pauseMs=reduced?0:650;
 const feedback=$('stepFeedback'),singular=name=>name.replace(/s$/,'');
 let tray=null;
 try{
  const nextSlot=nextCol.querySelector('.multip-carry-slot');
  let destPile=nextSlot.querySelector('.multip-pile');
  if(!destPile){destPile=document.createElement('div');destPile.className='multip-pile multip-regroup-live';destPile.dataset.place=String(nextP);nextSlot.append(destPile);}
  for(let bundle=0;bundle<step.carryOut;bundle++){
   tray?.remove();tray=document.createElement('div');tray.className='multip-regroup-tray';tray.innerHTML=`<strong>Make a group of 10 ${E(placeName(p))}</strong><div class="multip-regroup-slots">${Array.from({length:10},()=>'<span class="multip-regroup-slot"></span>').join('')}</div><div class="multip-regroup-equation">10 ${E(placeName(p))}</div><div class="multip-regroup-convert"></div>`;document.body.append(tray);
   const colRect=currentCol.getBoundingClientRect(),trayRect=tray.getBoundingClientRect(),left=Math.max(6,Math.min(innerWidth-trayRect.width-6,colRect.left+(colRect.width-trayRect.width)/2)),top=Math.max(6,Math.min(innerHeight-trayRect.height-6,colRect.top+Math.max(52,(colRect.height-trayRect.height)/2)));
   Object.assign(tray.style,{left:left+'px',top:top+'px'});
   const slots=Array.from(tray.querySelectorAll('.multip-regroup-slot'));
   if(feedback)feedback.textContent=`Regrouping: move 10 ${placeName(p)} together to make 1 ${singular(placeName(nextP))}.`;
   for(let j=0;j<10;j++){
    const token=source[bundle*10+j],from=token.getBoundingClientRect(),slot=slots[j],to=slot.getBoundingClientRect();
    const flyer=token.cloneNode(true);flyer.classList.add('multip-regroup-flyer');Object.assign(flyer.style,{position:'fixed',left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px',margin:'0',zIndex:'10050',pointerEvents:'none'});
    document.body.append(flyer);token.style.visibility='hidden';
    try{await flyer.animate([{transform:'translate(0,0) scale(1)'},{transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(.78)`}],{duration:moveMs,easing:'cubic-bezier(.2,.72,.25,1)',fill:'forwards'}).finished;}catch{}
    flyer.remove();slot.classList.add('filled');slot.dataset.place=String(p);slot.textContent=String(p);
    await multiplicationRegroupWait(betweenMs);
   }
   tray.classList.add('complete');tray.querySelector('.multip-regroup-equation').textContent=`10 ${placeName(p)} = 1 ${singular(placeName(nextP))}`;
   if(feedback)feedback.textContent=`10 ${placeName(p)} make 1 ${singular(placeName(nextP))}.`;
   await multiplicationRegroupWait(pauseMs);
   const target=document.createElement('span');target.className='multip-disc multip-regroup-arrived';target.dataset.place=String(nextP);target.textContent=String(nextP);target.style.visibility='hidden';destPile.append(target);fitMultiplicationPiles();
   const convert=tray.querySelector('.multip-regroup-convert'),formed=document.createElement('span');formed.className='multip-disc multip-regroup-formed';formed.dataset.place=String(nextP);formed.textContent=String(nextP);convert.append(formed);
   const from=formed.getBoundingClientRect(),to=target.getBoundingClientRect(),flyer=formed.cloneNode(true);Object.assign(flyer.style,{position:'fixed',left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px',margin:'0',zIndex:'10060',pointerEvents:'none'});document.body.append(flyer);formed.style.visibility='hidden';
   try{await flyer.animate([{transform:'translate(0,0) scale(1.08)'},{transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(1)`}],{duration:convertMs,easing:'cubic-bezier(.2,.75,.2,1)',fill:'forwards'}).finished;}catch{}
   flyer.remove();target.style.visibility='visible';target.classList.add('multip-regroup-glow');
   if(feedback)feedback.textContent=`Group ${bundle+1}: 10 ${placeName(p)} became 1 ${singular(placeName(nextP))}.`;
   await multiplicationRegroupWait(pauseMs);
  }
  const remaining=step.digit;
  if(feedback)feedback.textContent=remaining?`${step.total} ${placeName(p)} regroup as ${step.carryOut} ${placeName(nextP)} and ${remaining} ${placeName(p)}.`:`${step.total} ${placeName(p)} regroup exactly as ${step.carryOut} ${placeName(nextP)}.`;
  await multiplicationRegroupWait(reduced?0:800);
 }catch(e){
  // If the visual animation is interrupted, still allow the checked arithmetic step to continue.
 }finally{
  tray?.remove();run.multiplicationBusy=false;
 }
}

async function advanceMultiplication(reveal=false){
 const run=interaction,step=run.plan.steps[run.step];if(!step||solved||run.multiplicationBusy)return;
 const typed=Object.fromEntries(Array.from($('diagram').querySelectorAll('.multip-entry')).map(i=>[i.dataset.field,i.value]));
 if(!reveal&&!checkOperationStep(step,typed)){
  attempts++;const wrong=step.inputs.find(f=>String(typed[f.key]??'')!==String(f.expected));$('stepFeedback').className='step-feedback retry';$('stepFeedback').textContent=wrong.key.startsWith('carry')?'Check the regrouping digit above the next column. Both highlighted boxes must be correct.':`Check the ${wrong.label}. Write one digit in each highlighted box.`;$('diagram').querySelector(`[data-field="${wrong.key}"]`).focus({preventScroll:true});return;
 }
 if(reveal)hints++;await animateMultiplicationRegroup(run,step);run.step++;$('hint').hidden=true;
 if(run.step===run.plan.steps.length){
  run.operationComplete=true;
  if(checkAnswer(current,current.answer,run)){attempts++;solved=true;results.push({first:attempts===1&&hints===0,firstAnswerCorrect:attempts===1&&hints===0,earned:attempts===1&&hints===0,attempts,hints,questionNumber:index+1,task:current?.data?.task,taskLabel:resultTaskLabel()});$('feedback').style.color='#24735e';$('feedback').textContent='Correct! '+current.explanation;$('nextButton').hidden=false;$('hintButton').disabled=true;progress();}
 }
 drawOperation();lockOperationAnswer();
}
const multiplicationResizeWatcher=typeof ResizeObserver==='function'?new ResizeObserver(()=>{if(engine==='operations'&&['multiply','multiply-column'].includes(current?.data.task))fitMultiplicationPiles();}):null;
window.addEventListener('resize',()=>{if(engine==='operations'&&['multiply','multiply-column'].includes(current?.data.task))requestAnimationFrame(fitMultiplicationPiles);});
// Animal Rescue's Exact Algorithm: one checked place, a bank and one mat row per group.
function divisionDisc(p){return `<span class="division-disc" data-place="${p}">${p}</span>`;}
function divisionPile(n,p,id){return `<div class="division-pile" id="${id}" data-count="${n}" aria-label="${placeQuantity(n,p)}">${Array.from({length:n},()=>divisionDisc(p)).join('')}</div>`;}
function fitDivisionPiles(){
 document.querySelectorAll('.division-pile').forEach(pile=>{
  const n=pile.children.length;if(!n)return;
  const box=pile.parentElement,w=Math.max(20,box.clientWidth-8),h=Math.max(20,box.clientHeight-8),max=pile.closest('.division-bank')?32:28;
  let size=max;while(size>12&&Math.ceil(n/Math.max(1,Math.floor((w+3)/(size+3))))*(size+3)>h)size--;
  pile.style.setProperty('--disc-size',size+'px');pile.style.setProperty('--disc-font',Math.min(13,Math.max(10,size-6))+'px');
 });
}
function divisionAlgorithm(pos){
 const plan=interaction.plan,c=current.data,order=plan.ps.map((_,i)=>i).reverse(),placeSteps=plan.steps.filter(s=>s.kind==='division-place'),rem=c.a%c.b!==0;
 const field=(s,key)=>{
  const f=s.inputs.find(x=>x.key===key),si=plan.steps.indexOf(s),active=si===pos,done=si<pos;
  if(!f)return '';
  const leading=key.startsWith('q-')&&done&&pos===plan.steps.length&&f.expected===0&&plan.ps[f.place]>Math.floor(c.a/c.b);
  return `<input type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="off" class="division-entry ${active?'division-current':''}" data-field="${E(key)}" aria-label="${E(f.label)}" value="${done&&!leading?f.expected:''}" ${active?'':'disabled'}>`;
 };
 const row=(content,cls='',sign='',extra='')=>`<div class="division-algo-row ${cls}"><span class="division-algo-sign">${sign}</span>${order.map(i=>`<span class="division-algo-cell" data-place="${plan.ps[i]}">${content(i)}</span>`).join('')}${rem?`<span class="division-algo-rem">${extra}</span>`:''}</div>`;
 const r=plan.steps.at(-1);
 const work=placeSteps.map(s=>row(i=>field(s,`product-${s.focus}-${i}`),'division-product','−')+row(i=>s.focus>0?field(s,`next-${s.focus}-${i}`):i===0?field(r,'remainder-bottom'):'','division-bring')).join('');
 return `<div class="division-full-algorithm" style="--places:${order.length};--rem:${rem?'54px':'0px'}"><div class="division-algo-head"><span></span>${order.map(i=>`<span>${plan.ps[i]===100?'H':plan.ps[i]===10?'T':'O'}</span>`).join('')}${rem?'<span></span>':''}</div>${row(i=>field(placeSteps.find(s=>s.focus===i),`q-${i}`),'division-quotient','','R '+field(r,'remainder-top'))}${row(i=>Math.floor(c.a/plan.ps[i])%10,'division-dividend',c.b)}${work}</div>`;
}
function drawDivision(){
 const c=current.data,plan=interaction.plan,pos=interaction.step,step=plan.steps[pos],state=step?step.before:plan.final,order=plan.ps.map((_,i)=>i).reverse(),host=$('diagram');
 interaction.operationComplete=!step;document.body.classList.add('division-engine');
 const bank=order.map(i=>`<div class="division-bank" data-place="${plan.ps[i]}"><div class="division-place-head">${E(placeName(plan.ps[i]))}<b id="division-count-${i}">${state.top[i]}</b></div><div class="division-bank-body">${divisionPile(state.top[i],plan.ps[i],`division-bank-${i}`)}</div></div>`).join('');
 const groups=state.groups.map((g,j)=>`<div class="division-group-label">${j+1}</div>${order.map(i=>`<div class="division-group-cell ${step?.focus===i?'division-active-place':''}" data-place="${plan.ps[i]}">${divisionPile(g[i],plan.ps[i],`division-group-${i}-${j}`)}</div>`).join('')}`).join('');
 host.innerHTML=`<div class="operation-workspace division-workspace"><div class="operation-top"><div class="step-heading"><span>${step?.kind==='remainder'?'Remainder':step?`Step ${pos+1} / ${plan.ps.length}`:'Completed'}</span><h3>${step?E(step.title):'All places complete!'}</h3></div><button type="button" id="divisionMatToggle">${interaction.hideDivisionMat?'Show':'Hide'} place-value mat</button></div><div class="division-main ${interaction.hideDivisionMat?'division-mat-hidden':''}"><div class="division-model"><h4>Disc bank · left to share</h4><div class="division-bank-row" style="--places:${order.length}">${bank}</div><h4>Equal groups · one row per group</h4><div class="division-group-mat" style="--places:${order.length};--groups:${c.b}"><div class="division-mat-head">Group</div>${order.map(i=>`<div class="division-mat-head" data-place="${plan.ps[i]}">${E(placeName(plan.ps[i]))}</div>`).join('')}${groups}</div></div><div class="division-writing"><h4>Division algorithm</h4>${divisionAlgorithm(pos)}${step?'':`<p class="division-answer">${c.a} ÷ ${c.b} = ${Math.floor(c.a/c.b)}${c.a%c.b?' R '+c.a%c.b:''}</p>`}</div></div><div class="operation-controls division-controls"><p>${step?E(step.prompt):'Read your completed working and enter the whole answer below.'}</p>${step?`<div class="division-controls-layout"><div class="division-keypad-panel"><div class="division-keypad-help">Tap a highlighted box, then a number</div><div class="division-keypad" role="group" aria-label="Number keypad">${[1,2,3,4,5,6,7,8,9,0].map(n=>`<button type="button" data-digit="${n}">${n}</button>`).join('')}<button type="button" id="divisionErase" aria-label="Erase digit">⌫</button><button type="button" id="divisionClear">Del</button></div></div><div class="step-actions"><button type="button" class="primary" id="operationNext">Check Step</button><button type="button" class="teacher-only" id="teacherNext">Teacher: Next ▶</button><button type="button" id="operationHelp">Help me</button></div></div><p id="stepFeedback" class="step-feedback" role="status" aria-live="polite"></p>`:''}<div class="operation-rewind"><button type="button" id="operationBack" ${pos===0||solved?'disabled':''}>Previous step</button><button type="button" id="operationReset" ${pos===0||solved?'disabled':''}>Restart steps</button></div></div></div>`;
 const inputs=Array.from(host.querySelectorAll('.division-current'));let active=inputs[0];
 const select=input=>{inputs.forEach(i=>i.classList.remove('division-selected'));active=input;if(active){active.classList.add('division-selected');active.focus({preventScroll:true});}};
 const nextInput=()=>select(inputs[Math.min(inputs.length-1,inputs.indexOf(active)+1)]);
 inputs.forEach(input=>{input.onfocus=()=>{inputs.forEach(i=>i.classList.remove('division-selected'));active=input;input.classList.add('division-selected');};input.oninput=()=>{input.value=input.value.replace(/\D/g,'').slice(-1);};input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();advanceDivision();}};});
 host.querySelectorAll('[data-digit]').forEach(b=>{b.onpointerdown=e=>e.preventDefault();b.onclick=()=>{if(active&&!active.disabled){active.value=b.dataset.digit;nextInput();}};});
 if(step){
  $('divisionClear').onpointerdown=$('divisionErase').onpointerdown=e=>e.preventDefault();
  $('divisionClear').onclick=()=>{if(active&&!active.disabled)active.value='';};
  $('divisionErase').onclick=()=>{if(!active||active.disabled)return;if(!active.value)select(inputs[Math.max(0,inputs.indexOf(active)-1)]);active.value='';};
  $('operationNext').onclick=()=>advanceDivision();$('teacherNext').onclick=()=>advanceDivision(true);$('operationHelp').onclick=()=>{hints++;$('stepFeedback').className='step-feedback';$('stepFeedback').textContent=step.equation;};
 }
 $('divisionMatToggle').onclick=()=>{interaction.hideDivisionMat=!interaction.hideDivisionMat;host.querySelector('.division-main').classList.toggle('division-mat-hidden',interaction.hideDivisionMat);$('divisionMatToggle').textContent=(interaction.hideDivisionMat?'Show':'Hide')+' place-value mat';requestAnimationFrame(fitDivisionPiles);};
 $('operationBack').onclick=()=>{if(pos>0&&!solved&&!interaction.divisionBusy){interaction.step--;hints++;drawOperation();lockOperationAnswer();}};
 $('operationReset').onclick=()=>{if(!solved&&!interaction.divisionBusy){interaction.step=0;hints++;drawOperation();lockOperationAnswer();}};
 requestAnimationFrame(fitDivisionPiles);
}
async function moveDivisionDisc(source,target,p,exchange=false){
 const from=source.getBoundingClientRect(),disc=document.createElement('span');disc.className='division-disc';disc.dataset.place=p;disc.textContent=p;disc.style.visibility='hidden';target.append(disc);fitDivisionPiles();
 const to=disc.getBoundingClientRect(),ghost=disc.cloneNode(true);ghost.classList.add('division-ghost');ghost.style.cssText=`position:fixed;left:0;top:0;width:${to.width}px;height:${to.height}px;visibility:visible;z-index:9999;font-size:${getComputedStyle(disc).fontSize}`;document.body.append(ghost);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 try{await ghost.animate([{transform:`translate(${from.left+(from.width-to.width)/2}px,${from.top+(from.height-to.height)/2}px) scale(${exchange?1.5:1})`},{transform:`translate(${to.left}px,${to.top}px) scale(1)`}],{duration:reduced?0:exchange?400:180,easing:'ease-in-out',fill:'forwards'}).finished;}catch{}finally{ghost.remove();disc.style.visibility='';}
}
async function advanceDivision(reveal=false){
 const run=interaction,step=run.plan.steps[run.step];if(!step||solved||run.divisionBusy)return;
 const typed=Object.fromEntries(Array.from($('diagram').querySelectorAll('.division-current')).map(i=>[i.dataset.field,i.value]));
 if(!reveal&&!checkOperationStep(step,typed)){
  attempts++;const wrong=step.inputs.find(f=>String(typed[f.key]??'')!==String(f.expected));$('stepFeedback').className='step-feedback retry';$('stepFeedback').textContent=`Check the ${wrong.label}. Fill every highlighted box with one digit.`;return;
 }
 if(reveal){hints++;for(const f of step.inputs)$('diagram').querySelector(`[data-field="${f.key}"]`).value=f.expected;}
 run.divisionBusy=true;const host=$('diagram');host.querySelectorAll('button,.division-current').forEach(b=>b.disabled=true);$('hint').hidden=true;
 try{
  if(step.kind==='division-place'){
   const i=step.focus,p=run.plan.ps[i],bank=$(`division-bank-${i}`);
   $('stepFeedback').textContent=`Sharing ${placeName(p)}: one disc to each group in each round.`;
   for(let round=0;round<step.q;round++){
    const discs=Array.from(bank.children).slice(0,current.data.b);
    await Promise.all(discs.map((d,j)=>moveDivisionDisc(d,$(`division-group-${i}-${j}`),p)));
    if(interaction!==run)return;discs.forEach(d=>d.remove());$(`division-count-${i}`).textContent=bank.children.length;fitDivisionPiles();
   }
   if(i>0&&step.left){
    $('stepFeedback').textContent=`Exchange ${placeQuantity(step.left,p)} for ${placeQuantity(step.left*10,run.plan.ps[i-1])}. Bring down the next digit.`;
    const remaining=Array.from(bank.children),target=$(`division-bank-${i-1}`);
    await Promise.all(remaining.flatMap(d=>Array.from({length:10},()=>moveDivisionDisc(d,target,run.plan.ps[i-1],true))));
    if(interaction!==run)return;remaining.forEach(d=>d.remove());
   }
  }
  if(interaction!==run)return;run.step++;
  if(run.step===run.plan.steps.length){
   run.operationComplete=true;
   if(checkAnswer(current,current.answer,run)){
    attempts++;solved=true;results.push({first:attempts===1&&hints===0,firstAnswerCorrect:attempts===1&&hints===0,earned:attempts===1&&hints===0,attempts,hints,questionNumber:index+1,task:current?.data?.task,taskLabel:resultTaskLabel()});
    $('feedback').style.color='#24735e';$('feedback').textContent='Correct! '+current.explanation;$('nextButton').hidden=false;$('hintButton').disabled=true;progress();
   }
  }
  drawOperation();lockOperationAnswer();
 }finally{run.divisionBusy=false;}
}
window.addEventListener('resize',()=>{if(current?.data.task==='divide-column')requestAnimationFrame(fitDivisionPiles);});
// Hundred chart and flip chart: the reference has larger numbers at the top.
const hundredDigits=n=>[n===100?'1':'',String(Math.floor(n%100/10)),String(n%10)];
function hundredCard(p,d){
 const half=(part,side,extra='')=>`<div class="hundred-half ${side} ${extra}" data-half="${part}"><span class="hundred-face" aria-hidden="true">${d}</span></div>`;
 return `<div class="hundred-card ${d===''?'hundred-blank':''}" data-place="${p}" data-digit="${d}" role="img" aria-label="${placeName(p)}: ${d||'blank'}">${half('static-top','top')}${half('static-bottom','bottom')}${half('out-top','top','hundred-flap')}${half('in-bottom','bottom','hundred-flap')}${half('out-bottom','bottom','hundred-flap')}${half('in-top','top','hundred-flap')}<span class="hundred-hinge" aria-hidden="true"></span></div>`;
}
function drawHundredChart(){
 const c=current.data,run=interaction,n=run.hundredValue,host=$('diagram'),digits=hundredDigits(n),places=[100,10,1];
 host.innerHTML=`<div class="hundred-workspace"><div class="hundred-main"><section class="hundred-panel" aria-label="Hundred chart"><div class="hundred-panel-heading"><h3>Hundred Chart</h3><span>Tap a number.</span></div><div class="hundred-grid" aria-label="Numbers 1 to 100, with 91 to 100 on the top row">${Array.from({length:10},(_,row)=>Array.from({length:10},(_,col)=>{const value=(9-row)*10+col+1;return `<button type="button" class="hundred-cell ${value%10===0?'hundred-tenth':''}" data-number="${value}" data-row="${row}" aria-label="Show ${value} on the flip chart" aria-pressed="${value===n}">${value}</button>`;}).join('')).join('')}<span class="hundred-counter" aria-hidden="true"></span></div><p class="hundred-zero-note" ${n===0?'':'hidden'}>0 is shown on the flip chart, outside the 1–100 chart.</p></section><section class="hundred-flip-panel" aria-label="Number flip chart"><h3>Number Flipchart</h3><div class="hundred-flip-digits">${places.map((p,i)=>`<div class="hundred-digit-unit"><button type="button" class="hundred-arrow" data-flip-place="${p}" data-direction="1" aria-label="${p===100?'Show 100':'Increase '+placeName(p)}">▲</button><span class="hundred-digit-label">${E(placeName(p))}</span>${hundredCard(p,digits[i])}<button type="button" class="hundred-arrow" data-flip-place="${p}" data-direction="-1" aria-label="${p===100?'Show 99':'Decrease '+placeName(p)}">▼</button></div>`).join('')}</div><p class="hundred-sentence" id="hundredSentence" role="status">Predict the new number before you press more or less.</p><div class="hundred-operation-buttons">${[['left',c.leftAmount],['right',c.rightAmount]].map(([side,amount])=>['less','more'].map(direction=>`<button type="button" class="hundred-${side}-button" data-move="${direction==='more'?amount:-amount}">${amount} ${direction}</button>`).join('')).join('')}</div><p class="hundred-readout" aria-live="polite">The number is <strong id="hundredReadout">${n}</strong>.</p></section></div><div class="hundred-footer"><p>10 more moves up a row. 1 more moves to the next number.</p><div><button type="button" id="hundredReset">Reset to start</button><button type="button" class="primary" id="hundredFinish">Finish exploring</button></div></div></div>`;
 host.querySelectorAll('.hundred-cell').forEach(button=>button.onclick=()=>moveHundredDirect(Number(button.dataset.number)));
 host.querySelectorAll('[data-move]').forEach(button=>button.onclick=()=>moveHundredSequence(Number(button.dataset.move)));
 host.querySelectorAll('[data-flip-place]').forEach(button=>button.onclick=()=>{const p=Number(button.dataset.flipPlace),direction=Number(button.dataset.direction);moveHundredDirect(p===100?direction===1?100:99:run.hundredValue+p*direction);});
 $('hundredReset').onclick=()=>moveHundredDirect(c.a,'Starting number restored.');$('hundredFinish').onclick=()=>{if(run.hundredBusy)return;$('questionView').hidden=true;$('summary').hidden=false;$('questionMeta').textContent='Complete';$('summary').innerHTML='<h2 class="summary-title">Exploration complete!</h2><p>You explored the numbers from 0 to 100 with the hundred chart and flip chart.</p><button type="button" class="primary" id="hundredRestart">Explore again</button>';$('hundredRestart').onclick=()=>start(config);};
 $('questionMeta').textContent='Explore · 0–100';updateHundredControls();requestAnimationFrame(fitHundredDisplay);hundredResizeWatcher?.observe(host);
}
function updateHundredControls(){
 const run=interaction,n=run.hundredValue,host=$('diagram');
 host.querySelectorAll('.hundred-cell').forEach(button=>{button.disabled=!!run.hundredBusy;button.setAttribute('aria-pressed',String(Number(button.dataset.number)===n));});
 host.querySelectorAll('[data-move]').forEach(button=>{const target=n+Number(button.dataset.move);button.disabled=!!run.hundredBusy||target<0||target>100;});
 host.querySelectorAll('[data-flip-place]').forEach(button=>{const p=Number(button.dataset.flipPlace),direction=Number(button.dataset.direction),target=p===100?direction===1?100:99:n+p*direction;button.disabled=!!run.hundredBusy||target<0||target>100||(p===100&&(direction===1?n===100:n!==100));});
 $('hundredReset').disabled=!!run.hundredBusy||n===current.data.a;$('hundredFinish').disabled=!!run.hundredBusy;
}
function hundredCounterTarget(n){
 const grid=$('diagram').querySelector('.hundred-grid'),cell=grid.querySelector(`[data-number="${n}"]`);if(!cell)return null;const box=grid.getBoundingClientRect(),rect=cell.getBoundingClientRect(),size=Math.min(rect.width,rect.height)*.94;return {x:rect.left-box.left+(rect.width-size)/2,y:rect.top-box.top+(rect.height-size)/2,size};
}
function fitHundredDisplay(){
 if(current?.data.task!=='hundred')return;const host=$('diagram');host.querySelectorAll('.hundred-card').forEach(card=>card.style.setProperty('--hundred-font',Math.min(150,card.clientHeight*.87,card.clientWidth*1.55)+'px'));
 if(interaction.hundredBusy)return;const counter=host.querySelector('.hundred-counter'),target=hundredCounterTarget(interaction.hundredValue);counter.hidden=!target;if(target){counter.style.width=counter.style.height=target.size+'px';counter.style.transform=`translate(${target.x}px,${target.y}px)`;}
}
async function flipHundredDigit(card,next,direction,duration){
 const old=card.dataset.digit;if(old===next)return;const text=(part,value)=>card.querySelector(`[data-half="${part}"] .hundred-face`).textContent=value;const forward=direction>=0,outPart=forward?'out-bottom':'out-top',inPart=forward?'in-top':'in-bottom',out=card.querySelector(`[data-half="${outPart}"]`),incoming=card.querySelector(`[data-half="${inPart}"]`);card.classList.remove('hundred-blank');
 text('static-top',forward?old:next);text('static-bottom',forward?next:old);text(outPart,old);text(inPart,next);out.style.display='block';
 try{await out.animate([{transform:'rotateX(0deg)'},{transform:`rotateX(${forward?180:-180}deg)`}],{duration:duration*.48,easing:'ease-in',fill:'forwards'}).finished;out.style.display='none';incoming.style.display='block';await incoming.animate([{transform:`rotateX(${forward?-180:180}deg)`},{transform:'rotateX(0deg)'}],{duration:duration*.52,easing:'ease-out',fill:'forwards'}).finished;}
 finally{card.querySelectorAll('.hundred-flap').forEach(part=>{part.style.display='none';part.getAnimations().forEach(animation=>animation.cancel());});text('static-top',next);text('static-bottom',next);card.dataset.digit=next;card.classList.toggle('hundred-blank',next==='');card.setAttribute('aria-label',placeName(Number(card.dataset.place))+': '+(next||'blank'));}
}
async function animateHundredValue(next,run){
 const old=run.hundredValue,direction=Math.sign(next-old),host=$('diagram'),digits=hundredDigits(next),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?1:560,counter=host.querySelector('.hundred-counter'),target=hundredCounterTarget(next),jobs=Array.from(host.querySelectorAll('.hundred-card')).map((card,i)=>flipHundredDigit(card,digits[i],direction,duration));
 if(target){const from=counter.style.transform||`translate(${target.x}px,${target.y}px)`;counter.hidden=false;counter.style.width=counter.style.height=target.size+'px';const to=`translate(${target.x}px,${target.y}px)`;counter.style.transform=to;const animation=counter.animate([{transform:from},{transform:to}],{duration,easing:'cubic-bezier(.22,.75,.22,1)',fill:'forwards'});jobs.push(animation.finished.finally(()=>animation.cancel()));}else counter.hidden=true;
 await Promise.all(jobs);if(interaction!==run)return;run.hundredValue=next;$('hundredReadout').textContent=next;host.querySelector('.hundred-zero-note').hidden=next!==0;updateHundredControls();
}
async function moveHundredDirect(next,message=''){
 const run=interaction;if(run.hundredBusy||next<0||next>100||next===run.hundredValue)return;run.hundredBusy=true;updateHundredControls();$('hundredSentence').textContent=message||`Show ${next} on both charts.`;
 try{await animateHundredValue(next,run);}finally{run.hundredBusy=false;if(interaction===run){updateHundredControls();fitHundredDisplay();}}
}
async function moveHundredSequence(delta){
 const run=interaction;if(run.hundredBusy)return;const start=run.hundredValue,moves=hundredMoves(start,delta);run.hundredBusy=true;updateHundredControls();const operation=`${Math.abs(delta)} ${delta>0?'more':'less'} than ${start}`;run.hundredTrail=[start];$('hundredSentence').textContent=operation+' is …';
 try{for(const next of moves){await animateHundredValue(next,run);if(interaction!==run)return;run.hundredTrail.push(next);$('hundredSentence').textContent=operation+' is … '+run.hundredTrail.join(' → ');if(next!==moves.at(-1)&&!matchMedia('(prefers-reduced-motion: reduce)').matches)await new Promise(resolve=>setTimeout(resolve,130));}if(interaction===run)$('hundredSentence').textContent=operation+' is '+run.hundredValue+'. '+run.hundredTrail.join(' → ');}
 finally{run.hundredBusy=false;if(interaction===run){updateHundredControls();fitHundredDisplay();}}
}
const hundredResizeWatcher=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>{if(current?.data.task==='hundred')fitHundredDisplay();});
window.addEventListener('resize',()=>{if(current?.data.task==='hundred')requestAnimationFrame(fitHundredDisplay);});
// Place Value Chart for Counting: linked models, cards, words and digit chart.
let countingSVGId=0;
const countingComma=n=>n.toLocaleString('en-SG');
const countingValue=()=>interaction.counts.reduce((sum,n,i)=>sum+n*interaction.ps[i],0);
function countingToken(p,fresh=false){
 const blocks=(interaction.representation||current.data.representation)==='blocks'&&countingValue()<10000&&p<10000;let content=String(p);
 if(blocks){const prefix='counting-'+(++countingSVGId)+'-';const colours=p===1?['#fde047','#a16207','#facc15']:p===10?['#93c5fd','#1d4ed8','#2563eb']:p===100?['#f9a8d4','#9d174d','#ec4899']:['#c4b5fd','#5b21b6','#8b5cf6'];content=BASE_TEN_SVGS[p].replace(/id="([^"]+)"/g,(_m,id)=>`id="${prefix}${id}"`).replace(/url\(#([^)]*)\)/g,(_m,id)=>`url(#${prefix}${id})`).replace(/#cca833|#e9bd45|#f6d666/g,x=>colours[x==='#f6d666'?0:x==='#cca833'?1:2]);}
 return `<span class="counting-token ${blocks?'counting-block':'counting-disc'} ${fresh?'counting-new':''}" data-place="${p}" aria-label="${p}">${content}</span>`;
}
function fitCountingPiles(){
 document.querySelectorAll('.counting-pile').forEach(pile=>{const tokens=Array.from(pile.querySelectorAll('.counting-token')),n=tokens.length;if(!n){pile.style.setProperty('--count-cols',1);return;}const cell=pile.parentElement,p=Number(tokens[0].dataset.place),blocks=tokens[0].classList.contains('counting-block'),w=Math.max(30,cell.clientWidth-12),h=Math.max(40,cell.clientHeight-12);const [nw,nh]=blocks?p===1?[30,34]:p===10?[22,108]:p===100?[76,50]:[60,70]:[48,48];let scale=0,cols=1;for(let k=1;k<=Math.min(5,n);k++){const s=Math.min(document.body.classList.contains('pupil')?(blocks?3.5:2.6):1.5,(w-(k-1)*5)/(k*nw),(h-(Math.ceil(n/k)-1)*5)/(Math.ceil(n/k)*nh));if(s>scale){scale=s;cols=k;}}scale=Math.max(.16,scale);pile.style.setProperty('--count-cols',cols);pile.style.setProperty('--count-w',nw*scale+'px');pile.style.setProperty('--count-h',nh*scale+'px');pile.style.setProperty('--count-font',Math.max(12,Math.min(document.body.classList.contains('pupil')?36:18,nw*scale/(String(p).length*.62)))+'px');});
}
function prepareCountingPupilControls(){
 if(!document.body.classList.contains('pupil'))return;
 const host=$('diagram'),top=host.querySelector('.counting-top');if(!top)return;
 const menu=document.createElement('details');menu.className='counting-tools';
 menu.innerHTML='<summary>Teaching tools</summary><div class="counting-tools-panel"><button type="button" class="counting-tools-close">Done ✓</button></div>';
 const panel=menu.querySelector('.counting-tools-panel'),close=panel.firstElementChild;
 for(const [selector,label]of [['.counting-model-options','Model'],['.counting-aid-tools','Show another representation'],['.counting-exchanges','Exchange pieces']]){
  const content=host.querySelector(selector);if(!content)continue;
  const group=document.createElement('section'),heading=document.createElement('h3');heading.textContent=label;group.append(heading,content);panel.insertBefore(group,close);
 }
 top.append(menu);
 menu.open=!!interaction.pvToolsOpen;
 menu.ontoggle=()=>{interaction.pvToolsOpen=menu.open;};
 close.onclick=()=>{menu.open=false;menu.querySelector('summary').focus();};
 menu.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.open=false;menu.querySelector('summary').focus();}});
 const aids=host.querySelector('.counting-aids'),workspace=host.querySelector('.counting-workspace');
 const revealed=aids.querySelectorAll('.counting-cards:not([hidden]),.counting-expanded:not([hidden]),.counting-chart:not([hidden])').length;
 workspace.classList.toggle('counting-content-scroll',revealed>1&&matchMedia('(max-height:740px), (max-width:700px)').matches);
}
function drawCountingChart(){
 const c=current.data,run=interaction,ps=run.ps,counts=run.counts,host=$('diagram'),n=countingValue(),changing=!!run.pvPlan,step=run.pvPlan?.steps[run.pvStep],forced=n>=10000,blocks=(run.representation||c.representation)==='blocks'&&!forced,details=false,highlight=['digit','digit-value-mixed','digit-place','digit-place-mixed','digit-mixed'].includes(c.task)?c.place:null,fresh=run.pvFresh;
 const digits=ps.map(p=>Math.floor(n/p)%10),cards=ps.flatMap((p,i)=>digits[i]?[{p,d:digits[i],value:digits[i]*p}]:[]),showDigits=details||run.pvDigits;
 host.innerHTML=`<div class="counting-workspace" style="--count-places:${ps.length}"><div class="counting-top"><p>${changing?`Starting number: <strong>${countingComma(c.a)}</strong>${run.pvStep?` · After step ${run.pvStep}: <strong>${countingComma(n)}</strong>`:''}`:['digit','digit-value-mixed','digit-place','digit-place-mixed','digit-mixed'].includes(c.task)?`<strong class="counting-number">${ps.map((p,i)=>`<span class="${p===highlight?'counting-highlight-digit':''}">${digits[i]}</span>`).join('')}</strong>`:'Count each place.'}</p><div class="counting-model-options" role="group" aria-label="Model"><button type="button" id="countingBlocks" aria-pressed="${blocks}" ${forced?'disabled':''}>Base-ten blocks</button><button type="button" id="countingDiscs" aria-pressed="${!blocks}">Discs</button></div></div>${forced?'<p class="counting-limit">10,000 is shown with discs.</p>':''}<div class="counting-panels">${ps.map((p,i)=>`<div class="counting-panel ${highlight===p?'counting-focused':''}" data-place="${p}"><div class="counting-place">${E(placeName(p))}</div><div class="counting-stage"><div class="counting-pile" id="counting-pile-${i}" aria-label="${E(placeQuantity(counts[i],p))}">${Array.from({length:counts[i]},(_,j)=>countingToken(p,fresh?.[i]&&j>=counts[i]-fresh[i])).join('')}${counts[i]?'':'<span class="counting-empty">0</span>'}</div></div><div class="counting-piece-count">${E(placeQuantity(counts[i],p))}</div></div>`).join('')}</div><div class="counting-aids ${run.pvCards||run.pvExpanded?'counting-aids-revealed':''}"><div class="counting-aid-tools"><button type="button" id="countingCardsToggle">${details||run.pvCards?'Hide':'Show'} cards</button><button type="button" id="countingApart" aria-pressed="${!run.pvTogether}">Put Apart</button><button type="button" id="countingTogether" aria-pressed="${!!run.pvTogether}">Placed Together</button><button type="button" id="countingExpandedToggle">${details||run.pvExpanded?'Hide':'Show'} expanded form</button><button type="button" id="countingChartToggle">${run.pvChart?'Hide':'Show'} chart</button>${c.task==='read'&&!details?`<button type="button" id="countingDigitsToggle">${run.pvDigits?'Hide':'Show'} chart digits</button>`:''}</div><div class="counting-cards ${run.pvTogether?'counting-joined':''}" ${details||run.pvCards?'':'hidden'}>${run.pvTogether?`<div class="counting-joined-number">${ps.flatMap((p,i)=>i>=(digits.findIndex(d=>d!==0)<0?ps.length-1:digits.findIndex(d=>d!==0))?[`<span class="counting-card-segment" data-place="${p}">${digits[i]}</span>`]:[]).join('')}</div>`:cards.length?cards.map(card=>`<div class="counting-card-part"><small>${E(placeQuantity(card.d,card.p))}</small><span class="counting-card" data-place="${card.p}">${card.value}</span></div>`).join(''):'<span class="counting-card" data-place="1">0</span>'}</div><div class="counting-expanded" ${details||run.pvExpanded?'':'hidden'}><p>${E(numberWords(n))}</p><p><strong>${cards.length?cards.map(card=>countingComma(card.value)).join(' + '):'0'} = ${countingComma(n)}</strong><small>Expanded form</small></p></div><div class="counting-chart" role="table" aria-label="Place-value digit chart" ${run.pvChart?'':'hidden'}><div role="row" class="counting-chart-head">${ps.map(p=>`<span role="columnheader" data-place="${p}">${E(placeName(p))}</span>`).join('')}</div><div role="row" class="counting-chart-digits">${ps.map((p,i)=>`<span role="cell" class="${highlight===p?'counting-highlight-digit':''}">${showDigits?digits[i]:'?'}</span>`).join('')}</div></div></div><div class="counting-controls">${changing?`<div class="counting-movement"><button type="button" class="primary" id="countingNext" ${!step?'disabled':''}>${step?'Next ▶':'Movement complete ✓'}</button><button type="button" id="countingAgain" ${run.pvStep?'':'disabled'}>Show Again</button><span>${run.pvStep} / ${run.pvPlan.steps.length} movements</span></div>`:`<div class="counting-exchanges"><label>Exchange <select id="countingExchange" aria-label="Places to exchange">${ps.slice(0,-1).map((p,i)=>`<option value="${i}" ${i===(run.pvExchange||0)?'selected':''}>${E(placeName(p))} ↔ ${E(placeName(ps[i+1]))}</option>`).join('')}</select></label><button type="button" id="countingSplit">Split 1 into 10</button><button type="button" id="countingGroup">Group 10 into 1</button><button type="button" id="countingReset">Reset model</button></div>`}<p class="counting-status" id="countingStatus" role="status">${E(run.pvStatus||(changing?'Write your answer first. Next shows the movement, then any regrouping.':'Ten smaller pieces have the same value as one piece in the next place.'))}</p></div></div>`;
 for(const [id,value]of [['countingBlocks','blocks'],['countingDiscs','discs']])$(id).onclick=()=>{run.representation=value;c.representation=config.representation=draft.representation=value;if($('setting-representation'))$('setting-representation').value=value;drawCountingChart();};
 const toggle=(id,key)=>$(id).onclick=()=>{const was=details||run[key];if(!was&&!solved)hints++;run[key]=!was;drawCountingChart();};
 toggle('countingCardsToggle','pvCards');toggle('countingExpandedToggle','pvExpanded');toggle('countingChartToggle','pvChart');if($('countingDigitsToggle'))toggle('countingDigitsToggle','pvDigits');
 $('countingApart').onclick=()=>{if(!run.pvCards&&!solved)hints++;run.pvCards=true;run.pvTogether=false;drawCountingChart();};$('countingTogether').onclick=()=>{if(!run.pvCards&&!solved)hints++;run.pvCards=true;run.pvTogether=true;drawCountingChart();};
 if(changing){$('countingNext').onclick=()=>animateCountingChange(step,true);$('countingAgain').onclick=()=>{hints++;run.counts=[...run.pvPlan.initial];run.pvStep=0;run.pvFresh=null;run.pvStatus='Starting model restored. Next shows the same change again.';drawCountingChart();};}
 else{const update=()=>{const i=run.pvExchange||0;$('countingSplit').disabled=counts[i]<1;$('countingGroup').disabled=counts[i+1]<10;};$('countingExchange').onchange=()=>{run.pvExchange=Number($('countingExchange').value);update();};update();$('countingSplit').onclick=()=>{const i=run.pvExchange||0,after=[...counts];after[i]--;after[i+1]+=10;animateCountingChange({kind:'split',from:i,to:i+1,before:[...counts],after,caption:`1 ${placeName(ps[i]).replace(/s$/,'')} = 10 ${placeName(ps[i+1])}. The value stays ${countingComma(n)}.`});};$('countingGroup').onclick=()=>{const i=run.pvExchange||0,after=[...counts];after[i]++;after[i+1]-=10;animateCountingChange({kind:'group',from:i+1,to:i,before:[...counts],after,caption:`10 ${placeName(ps[i+1])} = 1 ${placeName(ps[i]).replace(/s$/,'')}. The value stays ${countingComma(n)}.`});};$('countingReset').onclick=()=>{run.counts=placeCounts(c.a,ps);run.pvFresh=null;run.pvStatus='Original model restored.';drawCountingChart();};}
 run.pvFresh=null;prepareCountingPupilControls();requestAnimationFrame(fitCountingPiles);countingResizeWatcher?.disconnect();countingResizeWatcher?.observe(host);
}
async function animateCountingChange(step,advance=false){
 const run=interaction;if(!step||run.pvBusy)return;run.pvBusy=true;if(!solved)hints++;const host=$('diagram');host.querySelectorAll('button,select').forEach(el=>el.disabled=true);$('checkButton').disabled=true;$('countingStatus').textContent=step.caption;const animations=[],duration=matchMedia('(prefers-reduced-motion: reduce)').matches?1:['group','split'].includes(step.kind)?1800:900;
 try{
  if(step.kind==='add'){step.units.forEach((amount,i)=>{const pile=$('counting-pile-'+i);if(amount)pile.querySelector('.counting-empty')?.remove();for(let j=0;j<amount;j++){pile.insertAdjacentHTML('beforeend',countingToken(run.ps[i],true));const el=pile.lastElementChild;animations.push(el.animate([{opacity:0,transform:'translateY(-18px)'},{opacity:1,transform:'translateY(0)'}],{duration,fill:'forwards'}).finished);}});fitCountingPiles();}
  else{const pile=$('counting-pile-'+step.from),tokens=Array.from(pile.querySelectorAll('.counting-token')).slice(-(step.kind==='group'?10:step.kind==='take'?step.amount:1));tokens.forEach(el=>{el.classList.add(step.kind==='take'?'counting-taken':'counting-marked');animations.push(el.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:step.kind==='take'?'translateY(16px)':'scale(.15)'}],{duration,fill:'forwards'}).finished);});if(step.kind!=='take'){const from=pile.getBoundingClientRect(),to=$('counting-pile-'+step.to).getBoundingClientRect(),box=host.getBoundingClientRect(),ghost=document.createElement('div');ghost.className='counting-transfer';ghost.innerHTML=countingToken(step.kind==='group'?run.ps[step.to]:run.ps[step.from],true);ghost.style.left=from.left-box.left+from.width/2-22+'px';ghost.style.top=from.top-box.top+from.height/2-22+'px';host.append(ghost);animations.push(ghost.animate([{transform:'translate(0,0)',opacity:1},{transform:`translate(${to.left+to.width/2-from.left-from.width/2}px,${to.top+to.height/2-from.top-from.height/2}px)`,opacity:1}],{duration,fill:'forwards'}).finished.finally(()=>ghost.remove()));}}
  await Promise.all(animations);if(interaction!==run)return;run.counts=[...step.after];run.pvFresh=step.kind==='split'?{[step.to]:10}:step.kind==='group'?{[step.to]:1}:step.kind==='add'?Object.fromEntries(step.units.map((n,i)=>[i,n])):null;if(advance)run.pvStep++;run.pvStatus=step.caption+(advance&&run.pvStep===run.pvPlan.steps.length?` ${run.pvPlan.target} is ${current.data.b} ${current.data.task==='more'?'more':'less'} than ${current.data.a}.`:'');
 }finally{run.pvBusy=false;if(interaction===run){$('checkButton').disabled=solved;drawCountingChart();}}
}
const countingResizeWatcher=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>{if(engine==='place')fitCountingPiles();});
window.addEventListener('resize',()=>{if(engine==='place')requestAnimationFrame(fitCountingPiles);});
function drawPV(operations){const c=current.data,ps=interaction.ps,counts=interaction.counts,host=$('diagram');host.innerHTML=pvBoard(counts,ps);const tools=document.createElement('div');tools.className='diagram-toolbar';
 if(operations){const action=document.createElement('button');action.type='button';action.textContent=c.task==='add'?'Combine both numbers':'Take away '+c.b;action.disabled=interaction.combined;action.onclick=()=>{const bs=placeCounts(c.b,ps);if(c.task==='add'){interaction.counts=counts.map((v,i)=>v+bs[i]);interaction.combined=true;}else{if(bs.some((v,i)=>v>counts[i])){$('hint').hidden=false;$('hint').textContent='Exchange a larger disc for 10 smaller discs before taking away.';hints++;return;}interaction.counts=counts.map((v,i)=>v-bs[i]);interaction.combined=true;}drawPV(true);};tools.append(action);}
 for(let i=ps.length-1;i>0;i--){const pack=document.createElement('button');pack.type='button';pack.textContent=`10 × ${ps[i]} → 1 × ${ps[i-1]}`;pack.disabled=counts[i]<10;pack.onclick=()=>{interaction.counts[i]-=10;interaction.counts[i-1]++;drawPV(operations);};tools.append(pack);}
 if(!operations||c.task==='subtract'){for(let i=0;i<ps.length-1;i++){const split=document.createElement('button');split.type='button';split.textContent=`1 × ${ps[i]} → 10 × ${ps[i+1]}`;split.disabled=counts[i]<1;split.onclick=()=>{interaction.counts[i]--;interaction.counts[i+1]+=10;drawPV(operations);};tools.append(split);}}
 host.append(tools);const note=document.createElement('p');note.className='diagram-caption';note.textContent=operations?c.task==='add'?`First show ${c.a}, then combine ${c.b}. Regroup to keep fewer than 10 in each smaller place.`:`Show ${c.a}. Exchange where needed, then take away ${c.b}.`:'Exchange discs. The total value stays the same.';host.append(note);
}
function drawGroups(){const c=current.data,host=$('diagram');host.innerHTML=`<div class="unallocated">${c.task==='multiply'?`${c.a} equal groups`:interaction.remaining+' counters left to place'}</div><div class="group-board">${interaction.groups.map((n,i)=>`<button type="button" class="counter-group" data-group="${i}" aria-label="Group ${i+1}: ${n} counters">${Array.from({length:n},()=>'<span class="counter"></span>').join('')}</button>`).join('')}</div>`+caption(c.task==='share'?'Tap each group to share one counter. Make all groups equal.':c.task==='group'?`Tap each group to put in a counter. Make groups of ${c.b}.`:'Each dot is one counter. Count or multiply.');host.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.group);if(c.task==='multiply'||interaction.remaining<1)return;const size=c.task==='share'?c.a/c.b:c.b;if(interaction.groups[i]>=size)return;interaction.groups[i]++;interaction.remaining--;drawGroups();});if(c.task!=='multiply'){const b=document.createElement('button');b.type='button';b.textContent='Arrange equal groups';b.style.marginTop='8px';b.onclick=()=>{interaction.groups=interaction.groups.map(()=>c.task==='share'?c.a/c.b:c.b);interaction.remaining=0;hints++;drawGroups();};host.append(b);}}
function sequenceCardsFromLesson(){return current.data.blanks.map((index,id)=>({id:'number-card-'+id,value:current.data.sequence[index],placed:null})).reverse();}
function placeSequenceCard(cardId,index){
 const card=interaction.sequenceCards.find(item=>item.id===cardId);if(!card||solved)return;
 const occupying=interaction.sequenceCards.find(item=>item.placed===index);if(occupying)occupying.placed=null;
 if(card.placed!==null)interaction.sequenceValues[card.placed]=null;
 card.placed=index;interaction.sequenceValues[index]=card.value;interaction.sequenceSelected=null;renderSequencePattern();
}
function renderSequencePattern(){
 const host=$('diagram'),c=current.data,blankSet=new Set(c.blanks),shown=interaction.sequenceRuleShown;
 host.innerHTML=`<div class="sequence-workspace"><div class="sequence-instructions"><p>Tap a coloured number card, then tap a blank box. You can also drag a card.</p><button type="button" id="sequenceRuleButton" aria-pressed="${shown}">${shown?'Hide rule':'Reveal rule'}</button></div><div class="sequence-track" aria-label="Nine-term number pattern">${c.sequence.map((value,index)=>{const blank=blankSet.has(index),shownValue=blank?interaction.sequenceValues[index]:value;return `<button type="button" class="sequence-term ${blank?'sequence-blank':'sequence-locked'} ${blank&&shownValue!==null?'sequence-filled':''}" data-sequence-index="${index}" ${blank&&!solved?'':'disabled'} aria-label="Term ${index+1}${shownValue===null?', blank':`: ${shownValue}`}">${shownValue===null?'?':shownValue}<small>Term ${index+1}</small></button>`;}).join('')}</div><div class="sequence-bank" aria-label="Number cards"><span>Number cards</span>${interaction.sequenceCards.map((card,i)=>`<button type="button" class="sequence-card ${interaction.sequenceSelected===card.id?'selected':''} ${card.placed!==null?'placed':''}" draggable="${!solved}" data-sequence-card="${card.id}" aria-pressed="${interaction.sequenceSelected===card.id}" style="--sequence-hue:${(i*58+25)%360}" ${solved?'disabled':''}>${card.value}</button>`).join('')}</div><p class="sequence-rule" ${shown?'':'hidden'}><strong>Rule:</strong> ${E(c.ruleText)}</p></div>`;
 host.querySelectorAll('[data-sequence-card]').forEach(button=>{button.onclick=()=>{if(solved)return;interaction.sequenceSelected=interaction.sequenceSelected===button.dataset.sequenceCard?null:button.dataset.sequenceCard;renderSequencePattern();};button.ondragstart=event=>event.dataTransfer.setData('text/plain',button.dataset.sequenceCard);});
 host.querySelectorAll('[data-sequence-index]').forEach(button=>{const index=Number(button.dataset.sequenceIndex);button.onclick=()=>{if(interaction.sequenceSelected)placeSequenceCard(interaction.sequenceSelected,index);else{const card=interaction.sequenceCards.find(item=>item.placed===index);if(card){card.placed=null;interaction.sequenceValues[index]=null;renderSequencePattern();}}};button.ondragover=event=>event.preventDefault();button.ondrop=event=>{event.preventDefault();placeSequenceCard(event.dataTransfer.getData('text/plain'),index);};});
 $('sequenceRuleButton').onclick=()=>{interaction.sequenceRuleShown=!interaction.sequenceRuleShown;if(interaction.sequenceRuleShown&&!interaction.sequenceRuleUsed){interaction.sequenceRuleUsed=true;hints++;}renderSequencePattern();};
}
function numberlineJumpValues(c){
 const target=current.answer,step=c.b,cap=LIMITS[c.grade];let low=Math.min(c.a,target),high=Math.max(c.a,target);
 for(let i=0;i<4&&low-step>=0;i++)low-=step;for(let i=0;i<4&&high+step<=cap;i++)high+=step;
 const values=[];for(let value=low;value<=high;value+=step)values.push(value);return values;
}
function drawNumberline(){
 const c=current.data,host=$('diagram');
 if(c.task==='pattern'){
  interaction.sequenceValues=[...c.sequence];c.blanks.forEach(index=>interaction.sequenceValues[index]=null);interaction.sequenceCards=sequenceCardsFromLesson();interaction.sequenceSelected=null;interaction.sequenceRuleShown=false;interaction.sequenceRuleUsed=false;renderSequencePattern();return;
 }
 if(['add','subtract'].includes(c.task)){
  const values=numberlineJumpValues(c),startIndex=values.indexOf(c.a),targetIndex=values.indexOf(current.answer),ratio=i=>values.length===1?.5:i/(values.length-1),position=i=>6+ratio(i)*88,svgX=i=>60+ratio(i)*880,sign=c.task==='add'?'+':'−',relation=c.task==='add'?'more':'less',midPosition=(position(startIndex)+position(targetIndex))/2,midX=(svgX(startIndex)+svgX(targetIndex))/2;interaction.numberlineMarker=c.a;interaction.numberlineMarkerTouched=false;
  host.innerHTML=`<div class="numberline-workspace"><div class="numberline-cue"><span>Start at</span><strong>${wholeNumberText(c.a)}</strong><b>${wholeNumberText(c.b)} ${relation}</b></div><div class="numberline-slider" style="--start-pos:${position(startIndex)}%;--target-pos:${position(targetIndex)}%;--marker-pos:${position(startIndex)}%"><svg class="numberline-jump" viewBox="0 0 1000 112" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="jump-arrow" viewBox="0 0 20 20" refX="16" refY="10" markerWidth="18" markerHeight="18" markerUnits="userSpaceOnUse" orient="auto"><path class="numberline-jump-arrowhead" d="M2 2L18 10L2 18Z"/></marker></defs><path class="numberline-jump-arc" d="M${svgX(startIndex)} 94 Q${midX} 18 ${svgX(targetIndex)} 94" marker-end="url(#jump-arrow)"/></svg><span class="numberline-jump-label" style="left:${midPosition}%">${sign}${wholeNumberText(c.b)}</span><div class="numberline-axis">${values.map((value,i)=>`<span style="left:${ratio(i)*100}%" class="numberline-tick"><i></i></span>`).join('')}</div><span class="numberline-start" style="left:${position(startIndex)}%">${wholeNumberText(c.a)}</span><output id="numberlineMarkerLabel" class="numberline-marker-label">?</output><input id="numberlineMarker" type="range" min="0" max="${values.length-1}" step="1" value="${startIndex}" aria-label="Move the blue marker to the landing point"></div><p class="numberline-caption">Each space represents <strong>${wholeNumberText(c.b)}</strong>. Move the marker to the end of the jump, then write the landing number.</p></div>`;
  const slider=$('numberlineMarker'),label=$('numberlineMarkerLabel'),shell=host.querySelector('.numberline-slider');slider.oninput=()=>{const index=Number(slider.value),value=values[index];interaction.numberlineMarker=value;interaction.numberlineMarkerTouched=true;label.textContent=wholeNumberText(value);shell.style.setProperty('--marker-pos',position(index)+'%');slider.setAttribute('aria-valuetext',String(value));};return;
 }
 const interval=c.b,min=Math.max(0,Math.floor((c.a-interval*5)/interval)*interval),max=Math.min(LIMITS[c.grade],min+10*interval),n=(max-min)/interval;let s=`<path d="M38 145L562 145" stroke="#183c35" stroke-width="4" stroke-linecap="round"/><path d="M38 145l15-8v16zM562 145l-15-8v16z" fill="#183c35"/>`;
 for(let i=0;i<=n;i++){const value=min+i*interval,x=52+i/n*496,missing=value===c.a,showLabel=i%2===0||i===n;s+=line(x,133,x,157,'#183c35',i%5===0?4:3);if(missing)s+=`<rect x="${x-31}" y="173" width="62" height="38" rx="6" fill="#fff" stroke="#1682b6" stroke-width="3"/>`+text(x,200,'?',24,'font-weight="800" fill="#0a5d86"');else if(showLabel)s+=text(x,194,wholeNumberText(value),n>10?12:16,'font-weight="700"');}
 host.innerHTML=`<div class="numberline-point-workspace"><p>Each space represents <strong>${wholeNumberText(interval)}</strong>.</p>${svg(s,'0 0 600 235','svg-wide numberline-point-svg')}<p class="numberline-caption">Count equal spaces and fill in the blue box.</p></div>`;
}
function drawBars(){const c=current.data,host=$('diagram');const rect=(x,y,w,label,color='#acd1b5')=>`<rect x="${x}" y="${y}" width="${w}" height="55" rx="2" fill="${color}" stroke="#315a46" stroke-width="2"/>`+text(x+w/2,y+35,label,25);let s='';
 if(c.task==='groups'){const w=500/c.a;for(let i=0;i<c.a;i++)s+=rect(50+i*w,92,w,c.b);s+=text(300,65,'Whole = ?',22);}
 else if(c.task==='compare'){s+=text(40,84,'A',17)+rect(70,55,480,c.a)+text(40,175,'B',17)+rect(70,145,c.a?480*c.b/c.a:0,c.b);const start=70+480*c.b/c.a;s+=line(start,213,550,213,'#be9442',3)+text((start+550)/2,239,'Difference = ?',17);}
 else{const whole=c.task==='whole'?c.a+c.b:c.a,part=c.task==='whole'?c.a:c.b,w=whole?500*part/whole:250;s+=text(300,60,c.task==='whole'?'Whole = ?':'Whole = '+c.a,22)+rect(50,95,w,part)+rect(50+w,95,500-w,c.task==='whole'?c.b:'?','#fae2a0');}
 host.innerHTML=svg(s)+caption('Bars show the relationship between quantities. The unknown part is marked ?.');
}
const DENOMS=[5000,1000,500,200,100,50,20,10,5];
function pieces(n){const out=[];for(const v of DENOMS){while(n>=v){out.push(v);n-=v;}}return out;}
const denomination=v=>v>=100?'$'+v/100:v+'¢';
const moneyText=n=>`$${Math.floor(n/100)}.${String(n%100).padStart(2,'0')}`;
function moneyToken(v,interactive=false,disabled=false){
 const wrapper=interactive?'button':'span',attrs=interactive?` type="button" data-money="${v}" ${disabled?'disabled':''} aria-label="Add ${E(denomination(v))}"`:'';
 let drawing='';
 if(v<100)drawing=`<span class="money-coin-art coin-v${v}" aria-hidden="true"><span class="money-coin-ring"><b>${v}</b><small>cents</small></span></span>`;
 else if(v===100)drawing='<span class="money-dollar-coin-art" aria-hidden="true"><span><b>$1</b><small>coin</small></span></span>';
 else{const dollars=v/100;drawing=`<span class="money-note-art note-v${dollars}" aria-hidden="true"><span class="money-note-corner">$${dollars}</span><span class="money-note-centre"><b>$${dollars}</b><small>SGD</small></span><span class="money-note-corner right">$${dollars}</span></span>`;}
 return `<${wrapper} class="money-piece ${v>=200?'money-piece-note':'money-piece-coin'}"${attrs}>${drawing}<span class="sr-money-value">${E(denomination(v))}</span></${wrapper}>`;
}
function moneyPlaceCounts(value){
 const dollars=Math.floor(value/100),cents=value%100;
 return {d100:Math.floor(dollars/100)%10,d10:Math.floor(dollars/10)%10,d1:dollars%10,c10:Math.floor(cents/10),c5:Math.round(cents%10/5)};
}
const MONEY_DESC=['d100','d10','d1','c10','c5'];
const MONEY_ASC=[...MONEY_DESC].reverse();
const MONEY_BASE={c5:2,c10:10,d1:10,d10:10,d100:10};
const MONEY_LABEL={d100:'$100',d10:'$10',d1:'$1',c10:'10¢',c5:'5¢'};
const MONEY_PLACE_WORD={d100:'$100 place',d10:'$10 place',d1:'$1 place',c10:'10¢ place',c5:'5¢ place'};
const MONEY_ADD_TITLE={c5:'Add the ones of cents (0 or 5).',c10:'Add the tens of cents.',d1:'Add the dollars (ones).',d10:'Add the dollars (tens).',d100:'Add the dollars (hundreds).'};
const moneyCopy=o=>Object.fromEntries(MONEY_DESC.map(p=>[p,o[p]??null]));
const moneyShownDigit=(place,count)=>place==='c5'?count*5:count;
const moneyPlanAmount=value=>`$${Math.floor(value/100)}.${String(value%100).padStart(2,'0')}`;
function moneyMatToken(place,extra=''){
 const kind=place==='d1'?'one':place.startsWith('d')?'note':'cent';
 return `<span class="strict-money-token strict-money-${kind} strict-money-${place} ${extra}" aria-hidden="true"><b>${MONEY_LABEL[place]}</b></span>`;
}
function moneyMatPile(place,count,{marked=0,markClass='',ghosts=[]}={}){
 const label=place==='d100'?'hundred-dollar notes':place==='d10'?'ten-dollar notes':place==='d1'?'one-dollar coins':place==='c10'?'ten-cent coins':'five-cent coins';
 const safeCount=Math.max(0,count|0),markedCount=Math.min(safeCount,Math.max(0,marked|0)),plainCount=safeCount-markedCount;
 const tokens=Array.from({length:plainCount},()=>moneyMatToken(place)).join('')+Array.from({length:markedCount},()=>moneyMatToken(place,markClass)).join('');
 const ghostCounts=ghosts.map(ghost=>Math.max(0,ghost.count|0)),ghostMax=ghostCounts.length?Math.max(...ghostCounts):0;
 const ghostTokens=ghosts.map(ghost=>Array.from({length:Math.max(0,ghost.count|0)},()=>moneyMatToken(place,ghost.className||'')).join('')).join('');
 const density=safeCount>=15?' money-pile-very-dense':safeCount>=10?' money-pile-dense':'';
 const ghostDensity=ghostMax>=15?' money-pile-very-dense':ghostMax>=10?' money-pile-dense':'';
 return `<span class="strict-money-pile${density}" data-money-count="${safeCount}" role="img" aria-label="${safeCount} ${label}">${tokens}${safeCount===0?'<i class="strict-money-empty">0</i>':''}${ghostTokens?`<span class="strict-money-ghost-stack${ghostDensity}" aria-hidden="true">${ghostTokens}</span>`:''}</span>`;
}
function moneyAdditionPlan(c){
 const originalTop=moneyPlaceCounts(c.a),originalBottom=moneyPlaceCounts(c.b),top={...originalTop},bottom={...originalBottom};
 const result=Object.fromEntries(MONEY_DESC.map(p=>[p,null])),carries=Object.fromEntries(MONEY_DESC.map(p=>[p,0])),actions=[];
 for(let i=0;i<MONEY_ASC.length;i++){
  const place=MONEY_ASC[i],next=MONEY_ASC[i+1],first=originalTop[place],second=originalBottom[place],incoming=carries[place]||0,total=first+second+incoming,base=MONEY_BASE[place],carry=next?Math.floor(total/base):0,remainder=next?total%base:total;
  const beforeTop={...top},beforeBottom={...bottom},beforeResult={...result},beforeCarries={...carries};
  bottom[place]=0;top[place]=remainder;result[place]=remainder;
  if(next&&carry){top[next]+=carry;carries[next]=carry;}
  const equationLeft=place==='c5'?`${first*5}¢ + ${second*5}¢${incoming?' + '+incoming*5+'¢':''}`:place==='c10'?`${first} tens + ${second} tens${incoming?' + '+incoming+' ten':''}`:`${first} + ${second}${incoming?' + '+incoming:''}`;
  const equation=`${equationLeft} = ${place==='c5'?total*5+'¢':total}`;
  const exchange=carry?(place==='c5'?'2 × 5¢ → 1 × 10¢':`${base} × ${MONEY_LABEL[place]} → 1 × ${MONEY_LABEL[next]}`):'';
  const detail=carry?`${equation}. Regroup ${exchange}; record ${moneyShownDigit(place,remainder)} in this place.`:`${equation}. Record ${moneyShownDigit(place,remainder)} in this place.`;
  actions.push({type:'add',place,next,first,second,incoming,total,base,carry,remainder,title:MONEY_ADD_TITLE[place],equationLeft,equation,exchange,detail,beforeTop,beforeBottom,beforeResult,beforeCarries,top:{...top},bottom:{...bottom},result:{...result},carries:{...carries}});
 }
 return {adding:true,answer:c.a+c.b,actions,initial:{top:{...originalTop},bottom:{...originalBottom},result:Object.fromEntries(MONEY_DESC.map(p=>[p,null])),carries:Object.fromEntries(MONEY_DESC.map(p=>[p,0]))}};
}
function moneySubtractionPlan(c){
 const original=moneyPlaceCounts(c.a),lower=moneyPlaceCounts(c.b),work={...original},revised=Object.fromEntries(MONEY_DESC.map(p=>[p,null])),result=Object.fromEntries(MONEY_DESC.map(p=>[p,null])),actions=[];
 const snap=extra=>({...extra,work:{...work},revised:{...revised},result:{...result}});
 for(let i=0;i<MONEY_ASC.length;i++){
  const place=MONEY_ASC[i];
  if(work[place]<lower[place]){
   let donor=i+1;while(donor<MONEY_ASC.length&&work[MONEY_ASC[donor]]===0)donor++;
   for(let k=donor;k>i;k--){
    const from=MONEY_ASC[k],to=MONEY_ASC[k-1],factor=MONEY_BASE[to],beforeWork={...work},highBefore=work[from],lowBefore=work[to];work[from]-=1;work[to]+=factor;revised[from]=work[from];revised[to]=work[to];
    const highAfter=work[from],lowAfter=work[to],equation=`${moneyShownDigit(from,highBefore)} (${MONEY_LABEL[from]}) → ${moneyShownDigit(from,highAfter)} and ${moneyShownDigit(to,lowBefore)} (${MONEY_LABEL[to]}) → ${moneyShownDigit(to,lowAfter)}`;
    actions.push(snap({type:'borrow',place,from,to,factor,highBefore,lowBefore,highAfter,lowAfter,beforeWork,title:`Rename (borrow) from ${MONEY_LABEL[from]} to ${MONEY_LABEL[to]}.`,equation,detail:`One ${MONEY_LABEL[from]} becomes ${factor} ${MONEY_LABEL[to]} ${factor===1?'piece':'pieces'}. The value stays the same.`}));
   }
  }
  const beforeWork={...work},available=work[place],remove=lower[place];work[place]-=remove;result[place]=work[place];
  const equationLeft=`${moneyShownDigit(place,available)} − ${moneyShownDigit(place,remove)}`,equation=`${equationLeft} = ${moneyShownDigit(place,work[place])}`;
  actions.push(snap({type:'subtract',place,available,remove,beforeWork,title:`Subtract in the ${MONEY_PLACE_WORD[place]}.`,equationLeft,equation,detail:`${equation} in the ${MONEY_PLACE_WORD[place]}.`}));
 }
 return {adding:false,answer:c.a-c.b,actions,lower,original,initial:{work:{...original},revised:Object.fromEntries(MONEY_DESC.map(p=>[p,null])),result:Object.fromEntries(MONEY_DESC.map(p=>[p,null]))}};
}
function moneyPlanState(plan,step){return step?plan.actions[Math.min(step,plan.actions.length)-1]:plan.initial;}
function moneyAnimatedState(plan,step,phase){
 const action=plan.actions[step],before=moneyPlanState(plan,step);
 if(!action)return before;
 if(action.type==='add'){
  if(['move','group'].includes(phase))return {...before,top:{...before.top,[action.place]:action.total},bottom:{...before.bottom,[action.place]:0},result:{...before.result},carries:{...before.carries}};
  if(phase==='exchange')return {...action,result:{...before.result}};
  return action;
 }
 if(action.type==='borrow')return phase==='donor'?before:action;
 if(phase==='remove')return {...action,result:{...before.result}};
 return action;
}
function moneyAnimationText(action,phase){
 if(action.type==='add'){
  if(phase==='move')return {title:`Move the lower-row ${MONEY_LABEL[action.place]} tokens up.`,detail:'Watch the two rows come together in the highlighted column.'};
  if(phase==='group')return {title:`Circle a group of ${action.base}.`,detail:`Keep the group together: ${action.exchange}.`};
  if(phase==='exchange')return {title:`Exchange the group for 1 × ${MONEY_LABEL[action.next]}.`,detail:'Watch the new token move one column to the left.'};
  return {title:`Write ${moneyShownDigit(action.place,action.remainder)} in the answer.`,detail:`${action.equation}. The written digit now appears.`};
 }
 if(action.type==='borrow'){
  if(phase==='donor')return {title:`Borrow 1 × ${MONEY_LABEL[action.from]}.`,detail:'Cross out one token in the adjacent larger place.'};
  if(phase==='exchange')return {title:`Rename it as ${action.factor} × ${MONEY_LABEL[action.to]}.`,detail:`Move the equal-value smaller tokens one column to the right.`};
  return {title:'Update the renamed numbers.',detail:`${action.equation}. The total value has not changed.`};
 }
 if(phase==='remove')return action.remove?{title:`Take away ${moneyShownDigit(action.place,action.remove)} in the ${MONEY_PLACE_WORD[action.place]}.`,detail:'Temporary crosses identify the tokens being removed. They clear before the answer digit is written.'}:{title:`No tokens to take away in the ${MONEY_PLACE_WORD[action.place]}.`,detail:`${action.equation}. Nothing moves in this place.`};
 return {title:`Write ${moneyShownDigit(action.place,action.work[action.place])} in the answer.`,detail:`${action.equation}.`};
}
function moneyTransitionStrip(plan,last,animation){
 if(animation){const action=plan.actions[animation.step],copy=moneyAnimationText(action,animation.phase);return `<div class="strict-money-process watching" data-transition="${animation.phase}" role="status" aria-live="polite"><b>WATCH</b><span>${E(copy.title)}</span></div>`;}
 if(!last)return `<div class="strict-money-process ready" data-transition="ready"><b>Start</b><span>${plan.adding?'Align the decimal dots. Begin with 5¢.':'Begin with 5¢. Subtract if possible; otherwise rename first.'}</span></div>`;
 if(last.type==='add')return `<div class="strict-money-process" data-transition="${last.carry?'regroup':'combine'}"><b>Moved together</b><span>${E(last.equation)}</span><b>${last.carry?`Regroup ${E(last.exchange)}`:'No regrouping'}</b><span>Record ${moneyShownDigit(last.place,last.remainder)}.</span></div>`;
 if(last.type==='borrow')return `<div class="strict-money-process" data-transition="borrow"><b>Renamed</b><span>1 × ${E(MONEY_LABEL[last.from])} → ${last.factor} × ${E(MONEY_LABEL[last.to])}</span><b>Same value</b></div>`;
 return `<div class="strict-money-process" data-transition="subtract"><b>Subtracted</b><span>${E(last.equation)}</span><b>Record ${moneyShownDigit(last.place,last.work[last.place])}.</b></div>`;
}
function moneyOperationMat(plan,state,step,animation=null,settled=false){
 const next=plan.actions[step],last=!animation&&step?plan.actions[step-1]:null,activeAction=animation?plan.actions[animation.step]:next,active=new Set(activeAction?.type==='borrow'?[activeAction.from,activeAction.to]:activeAction?[activeAction.place]:[]),removed=!settled&&last?.type==='subtract'?last.remove:0,removedPlace=!settled&&last?.type==='subtract'?last.place:'';
 const recent=new Set(last?.type==='borrow'?[last.from,last.to]:last?[last.place]:[]);
 const columns=MONEY_DESC.map(place=>{
  const topOptions={};
  if(animation){
   const action=plan.actions[animation.step],phase=animation.phase;
   if(action.type==='add'&&place===action.place&&phase==='move'){topOptions.marked=Math.min(state.top[place],action.second);topOptions.markClass='money-move-up-token';}
   if(action.type==='add'&&place===action.place&&phase==='group'){topOptions.marked=action.base*action.carry;topOptions.markClass='money-group-token';}
   if(action.type==='add'&&place===action.next&&phase==='exchange'){topOptions.marked=action.carry;topOptions.markClass='money-carry-token';}
   if(action.type==='add'&&place===action.place&&phase==='record'){topOptions.marked=state.top[place];topOptions.markClass='money-record-token';}
   if(action.type==='borrow'&&place===action.from&&phase==='donor'){topOptions.marked=1;topOptions.markClass='money-donor-token';}
   if(action.type==='borrow'&&place===action.from&&phase==='exchange')topOptions.ghosts=[{count:1,className:'borrowed-token money-borrow-ghost'}];
   if(action.type==='borrow'&&place===action.to&&phase==='exchange'){topOptions.marked=action.factor;topOptions.markClass='money-borrow-new-token';}
   if(action.type==='subtract'&&place===action.place&&phase==='remove')topOptions.ghosts=[{count:action.remove,className:'removed-token money-remove-slow-token'}];
   if(action.type==='subtract'&&place===action.place&&phase==='record'){topOptions.marked=state.work[place];topOptions.markClass='money-record-token';}
  }else if(plan.adding&&!settled&&last?.type==='add'){
   if(place===last.place){topOptions.marked=state.top[place];topOptions.markClass='moved-token';if(last.carry)topOptions.ghosts=[{count:last.base*last.carry,className:'exchange-token'}];}
   if(place===last.next&&last.carry){topOptions.marked=last.carry;topOptions.markClass='renamed-token';}
  }
  if(!animation&&!settled&&!plan.adding&&last?.type==='borrow'){
   if(place===last.from)topOptions.ghosts=[{count:1,className:'borrowed-token'}];
   if(place===last.to){topOptions.marked=last.factor;topOptions.markClass='renamed-token';}
  }
  if(!animation&&settled&&last?.type==='add'&&last.carry&&place===last.next){topOptions.marked=last.carry;topOptions.markClass='money-regrouped-glow';}
  if(!animation&&settled&&last?.type==='borrow'&&place===last.to){topOptions.marked=last.factor;topOptions.markClass='money-regrouped-glow';}
  if(!plan.adding&&removedPlace===place)topOptions.ghosts=[{count:removed,className:'removed-token'}];
  return `<section class="strict-money-column strict-money-col-${place} ${active.has(place)?'active':''} ${recent.has(place)?'recent':''}"><strong>${MONEY_LABEL[place]}</strong><div class="strict-money-zone strict-money-top">${moneyMatPile(place,plan.adding?state.top[place]:state.work[place],topOptions)}</div>${plan.adding?`<div class="strict-money-zone strict-money-bottom">${moneyMatPile(place,state.bottom[place])}</div>`:''}</section>`;
 }).join('');
 const complete=step>=plan.actions.length;
 return `<div class="strict-money-model"><div class="strict-money-bands"><b>Dollars</b><b>Cents</b></div><div class="strict-money-mat ${plan.adding?'adding':'subtracting'} ${complete?'combined':''} ${animation?'money-animating phase-'+animation.phase:''}" data-money-phase="${animation?.phase||'settled'}" aria-label="${plan.adding?'Two-row addition':'One-row subtraction'} money place-value mat"><div class="strict-money-columns">${columns}</div><span class="strict-money-dot" aria-hidden="true">•</span></div>${moneyTransitionStrip(plan,last,animation)}<p class="strict-money-status">${E(animation?'Please watch the complete movement.':complete?(plan.adding?'The two amounts are together.':'The tokens left show the difference.'):`Next: ${next.title}`)}</p></div>`;
}
function moneyOriginalDigits(value){const counts=moneyPlaceCounts(value),dollars=Math.floor(value/100);return {...counts,d100:dollars>=100?counts.d100:'',d10:dollars>=10?counts.d10:'',d1:counts.d1,c10:counts.c10,c5:counts.c5*5};}
function moneyAlgorithmCell(place,value,classes=''){return `<span class="strict-money-algo-cell ${classes}" data-place="${place}">${value===null?(classes.includes('result-cell')?'?':''):E(value)}</span>`;}
function moneyAlgorithmRow(values,{sign='',cls='',active=[],crossed=[],result=false}={}){
 return `<div class="strict-money-algo-row ${cls}"><i>${E(sign)}</i><b class="strict-money-dollar">$</b>${MONEY_DESC.slice(0,3).map(p=>moneyAlgorithmCell(p,values[p],`${active.includes(p)?'active':''} ${crossed.includes(p)?'crossed-digit':''} ${result?'result-cell':''}`)).join('')}<b class="strict-money-decimal">.</b>${MONEY_DESC.slice(3).map(p=>moneyAlgorithmCell(p,values[p],`${active.includes(p)?'active':''} ${crossed.includes(p)?'crossed-digit':''} ${result?'result-cell':''}`)).join('')}</div>`;
}
function moneyWrittenAlgorithm(c,plan,state,step){
 const next=plan.actions[step],active=next?.type==='borrow'?[next.from,next.to]:next?[next.place]:[],top=moneyOriginalDigits(c.a),bottom=moneyOriginalDigits(c.b);
 const result=moneyCopy(state.result),answerDollars=Math.floor((plan.adding?c.a+c.b:c.a-c.b)/100);result.c5=result.c5===null?null:result.c5*5;if(result.d100!==null&&answerDollars<100)result.d100='';if(result.d10!==null&&answerDollars<10)result.d10='';
 let upper='';
 if(plan.adding){const carries=Object.fromEntries(MONEY_DESC.map(p=>[p,state.carries[p]||'']));carries.c5='';upper=moneyAlgorithmRow(carries,{cls:'strict-money-carry-row',active});}
 else{const revised=moneyCopy(state.revised),changed=MONEY_DESC.filter(p=>revised[p]!==null);revised.c5=revised.c5===null?null:revised.c5*5;upper=moneyAlgorithmRow(revised,{cls:'strict-money-rename-row',active});top.c5=moneyPlaceCounts(c.a).c5*5;return `<div class="strict-money-algorithm" aria-label="Written subtraction"><div class="strict-money-algo-bands"><b>Dollars</b><b>Cents</b></div><div class="strict-money-place-head"><span></span><span></span>${MONEY_DESC.slice(0,3).map(p=>`<span>${MONEY_LABEL[p]}</span>`).join('')}<span></span>${MONEY_DESC.slice(3).map(p=>`<span>${MONEY_LABEL[p]}</span>`).join('')}</div>${upper}${moneyAlgorithmRow(top,{active,crossed:changed})}${moneyAlgorithmRow(bottom,{sign:'−',active})}<div class="strict-money-rule"></div>${moneyAlgorithmRow(result,{active,result:true})}</div>`;}
 return `<div class="strict-money-algorithm" aria-label="Written addition"><div class="strict-money-algo-bands"><b>Dollars</b><b>Cents</b></div><div class="strict-money-place-head"><span></span><span></span>${MONEY_DESC.slice(0,3).map(p=>`<span>${MONEY_LABEL[p]}</span>`).join('')}<span></span>${MONEY_DESC.slice(3).map(p=>`<span>${MONEY_LABEL[p]}</span>`).join('')}</div>${upper}${moneyAlgorithmRow(top,{active})}${moneyAlgorithmRow(bottom,{sign:'+',active})}<div class="strict-money-rule"></div>${moneyAlgorithmRow(result,{active,result:true})}</div>`;
}
function moneyOperationStepPanel(plan,step){
 const action=plan.actions[step],complete=!action;
 const equation=complete?moneyPlanAmount(plan.answer):action.type==='borrow'?action.equation:`${action.equationLeft} = ?`;
 const instruction=complete?'Read the tokens and the written answer.':action.type==='add'?'Move the lower-row tokens up. Regroup if needed, then record this place.':action.type==='borrow'?'Rename one adjacent larger token before subtracting. The value stays the same.':'Take away the tokens, then record this place.';
 const marker=complete||action.type==='borrow'?'<b>✓</b>':'<b>?</b>';
 return `<div class="strict-money-step-card ${complete?'complete':''}"><span>${complete?'COMPLETE':`STEP ${step+1} OF ${plan.actions.length}`}</span><strong>${E(complete?'All places are complete.':action.title)}</strong><div class="strict-money-step-equation ${action?.type||''}">${E(equation)}${marker}</div><p>${E(instruction)}</p></div><div class="diagram-toolbar money-step-toolbar">${complete?'':`<button type="button" data-money-next>Next step →</button>`}<button type="button" data-money-restart ${step?'':'disabled'}>Restart steps</button></div>`;
}
function moneyActionPhases(action){
 if(action.type==='add')return action.carry?[['move',6000],['group',3200],['exchange',6000],['record',2000]]:[['move',6000],['record',1800]];
 if(action.type==='borrow')return [['donor',3600],['exchange',6000],['record',2000]];
 return [['remove',2900],['record',1800]];
}
function moneyOperationPanel(plan,step,animation){
 if(!animation)return moneyOperationStepPanel(plan,step).replace(/<\/div>$/,`<button type="button" data-money-sound aria-pressed="${interaction.moneySound!==false}">${interaction.moneySound===false?'Sound off':'Sound on'}</button></div>`);
 const action=plan.actions[animation.step],copy=moneyAnimationText(action,animation.phase),phases=moneyActionPhases(action).map(item=>item[0]),currentPhase=phases.indexOf(animation.phase);
 return `<div class="strict-money-step-card watching"><span>WATCH THE MOVEMENT</span><strong>${E(copy.title)}</strong><div class="strict-money-step-equation watch-copy">${E(copy.detail)}</div><div class="strict-money-watch-progress">${phases.map((phase,i)=>`<span class="${i<currentPhase?'done':i===currentPhase?'current':''}">${i+1}<b>${E(phase==='donor'?'Borrow':phase[0].toUpperCase()+phase.slice(1))}</b></span>`).join('')}</div></div><div class="diagram-toolbar money-step-toolbar"><button type="button" disabled>Next step →</button><button type="button" disabled>Restart steps</button><button type="button" data-money-sound aria-pressed="${interaction.moneySound!==false}">${interaction.moneySound===false?'Sound off':'Sound on'}</button></div>`;
}
let moneyAudioContext=null;
function moneyTone(frequency,start,duration,end=frequency,type='sine'){
 try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;moneyAudioContext??=new Audio();if(moneyAudioContext.state==='suspended')moneyAudioContext.resume();const now=moneyAudioContext.currentTime+start,osc=moneyAudioContext.createOscillator(),gain=moneyAudioContext.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,now);osc.frequency.linearRampToValueAtTime(end,now+duration);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.055,now+.035);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain).connect(moneyAudioContext.destination);osc.start(now);osc.stop(now+duration+.03);}catch{}
}
function playMoneySound(actionType,phase){
 if(interaction.moneySound===false)return;
 if(phase==='move'){moneyTone(300,0,.55,470);return;}
 if(phase==='group'){moneyTone(250,0,.15,220,'triangle');moneyTone(250,.28,.15,220,'triangle');return;}
 if(phase==='exchange'){const down=actionType==='borrow';moneyTone(down?520:330,0,.2,down?430:390);moneyTone(down?420:440,.24,.24,down?330:540);return;}
 if(phase==='donor'||phase==='remove'){moneyTone(290,0,.18,230,'triangle');moneyTone(230,.3,.18,190,'triangle');return;}
 moneyTone(600,0,.3,720);moneyTone(800,.16,.38,900);
}
const moneyWait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function moneyFloatBounds(items){
 const rects=(items||[]).map(item=>item?.getBoundingClientRect?.()).filter(r=>r&&r.width&&r.height);
 if(!rects.length)return null;
 const left=Math.min(...rects.map(r=>r.left)),top=Math.min(...rects.map(r=>r.top));
 const right=Math.max(...rects.map(r=>r.right)),bottom=Math.max(...rects.map(r=>r.bottom));
 return {left,top,right,bottom,width:right-left,height:bottom-top,cx:(left+right)/2,cy:(top+bottom)/2};
}
function moneyFloatingClone(source,extra=''){
 if(!source)return null;
 const rect=source.getBoundingClientRect(),clone=source.cloneNode(true);
 clone.classList.remove('money-group-token','money-donor-token','money-carry-token','money-borrow-new-token','money-regrouped-glow','borrowed-token','money-borrow-ghost','exchange-token','renamed-token','moved-token');
 clone.classList.add('money-floating-token');
 if(extra)clone.classList.add(extra);
 Object.assign(clone.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',margin:'0',animation:'none',transform:'none',opacity:'1',visibility:'visible'});
 document.body.append(clone);
 return {el:clone,rect};
}
function captureMoneyMoveUpFlight(action){
 if(action.type!=='add'||!action.second)return null;
 const sources=Array.from(document.querySelectorAll(`.strict-money-col-${action.place} .strict-money-bottom .strict-money-token`)).slice(-action.second);
 if(!sources.length)return null;
 const clones=sources.map(source=>moneyFloatingClone(source,'money-floating-source')).filter(Boolean);
 return {clones};
}
async function animateMoneyMoveUpFlight(action,snapshot,duration){
 if(!snapshot?.clones?.length){await moneyWait(duration);return;}
 const cleanup=snapshot.clones.map(item=>item.el);
 try{
  const targets=Array.from(document.querySelectorAll(`.strict-money-col-${action.place} .strict-money-top .money-move-up-token`));
  if(!targets.length){await moneyWait(duration);return;}
  targets.forEach(target=>{target.style.animation='none';target.style.transform='none';target.style.visibility='hidden';});
  const sourceItems=[...snapshot.clones].sort((a,b)=>b.rect.top-a.rect.top);
  const targetItems=targets.map(target=>({target,rect:target.getBoundingClientRect()})).sort((a,b)=>b.rect.top-a.rect.top);
  const count=Math.min(sourceItems.length,targetItems.length);
  const travel=count<=1?duration:Math.max(3000,Math.round(duration*.56));
  const delayStep=count<=1?0:Math.max(120,Math.round((duration-travel)/(count-1)));
  const jobs=[];
  for(let i=0;i<count;i++){
   const source=sourceItems[i],dest=targetItems[i],r=source.rect,tr=dest.rect;
   const dx=tr.left-r.left,dy=tr.top-r.top,delay=i*delayStep;
   const job=(async()=>{
    try{
     await source.el.animate([
      {transform:'translate(0,0) scale(1)',opacity:1,offset:0},
      {transform:'translate(0,0) scale(1.05)',opacity:1,offset:.16},
      {transform:`translate(${dx*.48}px,${dy*.48-20}px) scale(1.06)`,opacity:1,offset:.58},
      {transform:`translate(${dx}px,${dy}px) scale(1)`,opacity:1,offset:.9},
      {transform:`translate(${dx}px,${dy}px) scale(1)`,opacity:1,offset:1}
     ],{duration:travel,delay,easing:'cubic-bezier(.25,.72,.22,1)',fill:'forwards'}).finished;
    }catch{}
    dest.target.style.visibility='';
    dest.target.style.animation='none';
    try{dest.target.animate([{transform:'scale(.86)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:620,easing:'ease-out'});}catch{}
    source.el.remove();
   })();
   jobs.push(job);
  }
  await Promise.all(jobs);
 }finally{
  cleanup.forEach(node=>node?.remove?.());
  document.querySelectorAll(`.strict-money-col-${action.place} .money-move-up-token`).forEach(target=>{target.style.visibility='';target.style.animation='none';});
 }
}

function captureMoneyExchangeFlight(action){
 if(action.type==='add'&&action.carry){
  const sources=Array.from(document.querySelectorAll(`.strict-money-col-${action.place} .money-group-token`));
  const bounds=moneyFloatBounds(sources);
  if(!bounds)return null;
  const clones=sources.map(source=>moneyFloatingClone(source,'money-floating-source')).filter(Boolean);
  return {kind:'add',bounds,clones};
 }
 if(action.type==='borrow'){
  const source=document.querySelector(`.strict-money-col-${action.from} .money-donor-token`);
  const bounds=moneyFloatBounds(source?[source]:[]);
  if(!bounds)return null;
  const clone=moneyFloatingClone(source,'money-floating-donor');
  return {kind:'borrow',bounds,clones:clone?[clone]:[]};
 }
 return null;
}
function moneyFloatingEquation(action,bounds){
 if(!bounds)return null;
 const label=document.createElement('div');label.className='money-floating-equation';
 label.textContent=action.type==='add'?action.exchange:`1 × ${MONEY_LABEL[action.from]} → ${action.factor} × ${MONEY_LABEL[action.to]}`;
 label.style.left=bounds.cx+'px';label.style.top=Math.max(8,bounds.top-42)+'px';
 document.body.append(label);return label;
}
async function animateMoneyExchangeFlight(action,snapshot,duration){
 if(!snapshot){await moneyWait(duration);return;}
 const cleanup=[...snapshot.clones.map(item=>item.el)],label=moneyFloatingEquation(action,snapshot.bounds);
 if(label)cleanup.push(label);
 try{
  if(action.type==='add'){
   const targets=Array.from(document.querySelectorAll(`.strict-money-col-${action.next} .money-carry-token`));
   if(!targets.length){await moneyWait(duration);return;}
   targets.forEach(target=>{target.style.animation='none';target.style.transform='none';});
   const targetRects=targets.map(target=>target.getBoundingClientRect());
   targets.forEach(target=>target.style.visibility='hidden');
   const sourceJobs=snapshot.clones.map(item=>{
    const r=item.rect,tx=snapshot.bounds.cx-(r.left+r.width/2),ty=snapshot.bounds.cy-(r.top+r.height/2);
    try{return item.el.animate([
     {transform:'translate(0,0) scale(1)',opacity:1,offset:0},
     {transform:'translate(0,0) scale(1.08)',opacity:1,offset:.16},
     {transform:`translate(${tx}px,${ty}px) scale(.5)`,opacity:.18,offset:.38},
     {transform:`translate(${tx}px,${ty}px) scale(.35)`,opacity:0,offset:.44},
     {transform:`translate(${tx}px,${ty}px) scale(.35)`,opacity:0,offset:1}
    ],{duration,easing:'cubic-bezier(.3,.72,.2,1)',fill:'forwards'}).finished.catch(()=>{});}catch{return Promise.resolve();}
   });
   const flyers=targets.map((target,index)=>{
    const tr=targetRects[index],clone=target.cloneNode(true);
    clone.classList.remove('money-carry-token');clone.classList.add('money-floating-token');
    const left=snapshot.bounds.cx-tr.width/2,top=snapshot.bounds.cy-tr.height/2,dx=tr.left-left,dy=tr.top-top;
    Object.assign(clone.style,{position:'fixed',left:left+'px',top:top+'px',width:tr.width+'px',height:tr.height+'px',margin:'0',animation:'none',transform:'none',opacity:'0',visibility:'visible'});
    document.body.append(clone);cleanup.push(clone);
    try{return clone.animate([
     {transform:'translate(0,0) scale(.42)',opacity:0,offset:0},
     {transform:'translate(0,0) scale(.42)',opacity:0,offset:.28},
     {transform:'translate(0,0) scale(1.16)',opacity:1,offset:.38},
     {transform:'translate(0,0) scale(1)',opacity:1,offset:.53},
     {transform:`translate(${dx*.5}px,${dy*.5-34}px) scale(1.06)`,opacity:1,offset:.72},
     {transform:`translate(${dx}px,${dy}px) scale(1)`,opacity:1,offset:.9},
     {transform:`translate(${dx}px,${dy}px) scale(1)`,opacity:1,offset:1}
    ],{duration,easing:'cubic-bezier(.25,.72,.22,1)',fill:'forwards'}).finished.catch(()=>{});}catch{return Promise.resolve();}
   });
   if(label){try{label.animate([{opacity:0,transform:'translateX(-50%) translateY(7px)'},{opacity:1,transform:'translateX(-50%) translateY(0)',offset:.12},{opacity:1,offset:.62},{opacity:0,offset:.78},{opacity:0}],{duration,fill:'forwards'});}catch{}}
   await Promise.all([...sourceJobs,...flyers]);
   targets.forEach(target=>{target.style.visibility='';target.style.animation='none';try{target.animate([{transform:'scale(.82)'},{transform:'scale(1.14)'},{transform:'scale(1)'}],{duration:700,easing:'ease-out'});}catch{}});
   return;
  }
  const hiddenGhosts=Array.from(document.querySelectorAll(`.strict-money-col-${action.from} .money-borrow-ghost`));
  hiddenGhosts.forEach(token=>{token.style.animation='none';token.style.visibility='hidden';});
  const targets=Array.from(document.querySelectorAll(`.strict-money-col-${action.to} .money-borrow-new-token`));
  if(!targets.length){await moneyWait(duration);return;}
  targets.forEach(target=>{target.style.animation='none';target.style.transform='none';});
  const targetRects=targets.map(target=>target.getBoundingClientRect());
  targets.forEach(target=>target.style.visibility='hidden');
  const donor=snapshot.clones[0]?.el;
  const donorJob=donor?(()=>{try{return donor.animate([
   {transform:'scale(1)',opacity:1,offset:0},
   {transform:'scale(1.13)',opacity:1,offset:.16},
   {transform:'scale(.78)',opacity:.72,offset:.28},
   {transform:'scale(.48)',opacity:0,offset:.38},
   {transform:'scale(.48)',opacity:0,offset:1}
  ],{duration,easing:'cubic-bezier(.3,.72,.2,1)',fill:'forwards'}).finished.catch(()=>{});}catch{return Promise.resolve();}})():Promise.resolve();
  const flyers=targets.map((target,index)=>{
   const tr=targetRects[index],clone=target.cloneNode(true);
   clone.classList.remove('money-borrow-new-token');clone.classList.add('money-floating-token');
   const spreadX=((index%5)-2)*7,spreadY=(Math.floor(index/5)-.5)*7;
   const left=snapshot.bounds.cx-tr.width/2+spreadX,top=snapshot.bounds.cy-tr.height/2+spreadY,dx=tr.left-left,dy=tr.top-top;
   Object.assign(clone.style,{position:'fixed',left:left+'px',top:top+'px',width:tr.width+'px',height:tr.height+'px',margin:'0',animation:'none',transform:'none',opacity:'0',visibility:'visible'});
   document.body.append(clone);cleanup.push(clone);
   const delay=index*110,flyDuration=Math.max(3200,duration-delay);
   try{return clone.animate([
    {transform:'translate(0,0) scale(.4)',opacity:0,offset:0},
    {transform:'translate(0,0) scale(1.08)',opacity:1,offset:.2},
    {transform:'translate(0,0) scale(1)',opacity:1,offset:.36},
    {transform:`translate(${dx*.52}px,${dy*.52-32}px) scale(1.04)`,opacity:1,offset:.68},
    {transform:`translate(${dx}px,${dy}px) scale(1)`,opacity:1,offset:.9},
    {transform:`translate(${dx}px,${dy}px) scale(1)`,opacity:1,offset:1}
   ],{duration:flyDuration,delay,easing:'cubic-bezier(.25,.72,.22,1)',fill:'forwards'}).finished.catch(()=>{});}catch{return Promise.resolve();}
  });
  if(label){try{label.animate([{opacity:0,transform:'translateX(-50%) translateY(7px)'},{opacity:1,transform:'translateX(-50%) translateY(0)',offset:.1},{opacity:1,offset:.64},{opacity:0,offset:.82},{opacity:0}],{duration,fill:'forwards'});}catch{}}
  await Promise.all([donorJob,...flyers]);
  targets.forEach(target=>{target.style.visibility='';target.style.animation='none';try{target.animate([{transform:'scale(.82)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:700,easing:'ease-out'});}catch{}});
 }finally{
  cleanup.forEach(node=>node?.remove?.());
 }
}

async function playMoneyOperationStep(plan){
 const run=interaction,step=Math.min(run.moneyStep,plan.actions.length),action=plan.actions[step];if(!action||run.moneyBusy)return;
 run.moneyBusy=true;run.moneySettledStep=null;hints++;
 let completed=false;
 try{
  for(const [phase,duration] of moneyActionPhases(action)){
   if(interaction!==run)return;
   const moveSnapshot=phase==='move'&&action.type==='add'?captureMoneyMoveUpFlight(action):null;
   const exchangeSnapshot=phase==='exchange'?captureMoneyExchangeFlight(action):null;
   run.moneyAnimation={step,phase};drawMoney();playMoneySound(action.type,phase);
   if(phase==='move'&&action.type==='add'&&action.second)await animateMoneyMoveUpFlight(action,moveSnapshot,duration);
   else if(phase==='exchange'&&(action.type==='borrow'||(action.type==='add'&&action.carry)))await animateMoneyExchangeFlight(action,exchangeSnapshot,duration);
   else await moneyWait(duration);
  }
  if(interaction!==run)return;
  run.moneyStep=Math.min(plan.actions.length,step+1);run.moneyAnimation=null;run.moneySettledStep=run.moneyStep;completed=true;
 }finally{
  if(interaction===run){run.moneyBusy=false;if(!completed)run.moneyAnimation=null;drawMoney();}
 }
}
function wireMoneyOperationSteps(host,plan){
 const next=host.querySelector('[data-money-next]'),restart=host.querySelector('[data-money-restart]'),sound=host.querySelector('[data-money-sound]');
 if(next)next.onclick=()=>playMoneyOperationStep(plan);
 if(restart)restart.onclick=()=>{if(interaction.moneyBusy)return;interaction.moneyStep=0;interaction.moneyAnimation=null;interaction.moneySettledStep=null;hints++;drawMoney();};
 if(sound)sound.onclick=()=>{interaction.moneySound=interaction.moneySound===false;sound.textContent=interaction.moneySound?'Sound on':'Sound off';sound.setAttribute('aria-pressed',String(interaction.moneySound));};
}
function wireMoneySteps(host,max,label='Next step'){
 const next=host.querySelector('[data-money-next]'),restart=host.querySelector('[data-money-restart]');
 if(next)next.onclick=()=>{interaction.moneyStep=Math.min(max,interaction.moneyStep+1);hints++;drawMoney();};
 if(restart)restart.onclick=()=>{interaction.moneyStep=0;hints++;drawMoney();};
}
function moneyStepPanel(steps,max,label='Next step'){
 const shown=steps.slice(0,interaction.moneyStep).map((s,i)=>`<div class="money-teaching-step"><strong>STEP ${i+1}</strong><span>${E(s)}</span></div>`).join('');
 return `<div class="money-teaching">${shown||'<div class="money-step-ready">Predict the next step before revealing it.</div>'}</div><div class="diagram-toolbar">${interaction.moneyStep<max?`<button type="button" data-money-next>${E(label)} →</button>`:''}${interaction.moneyStep?'<button type="button" data-money-restart>Restart steps</button>':''}</div>`;
}
function drawMoneyConversion(c,host){
 const dollars=Math.floor(c.a/100),cents=c.a%100,fromCents=c.direction==='cents-to-money';
 const steps=fromCents?[`${c.a} cents has ${dollars} complete group${dollars===1?'':'s'} of 100 cents.`,`${c.a} cents = ${dollars} dollar${dollars===1?'':'s'} and ${cents} cents.`,`${c.a} cents = ${moneyText(c.a)}.`]:[`${dollars} dollar${dollars===1?'':'s'} = ${dollars} × 100 cents = ${dollars*100} cents.`,`Add the remaining ${cents} cents: ${dollars*100} + ${cents} = ${c.a} cents.`];
 const source=fromCents?`${c.a}¢`:moneyText(c.a),destination=fromCents?'$ __ . __':'__ ¢';
 host.innerHTML=`<div class="money-conversion"><div class="money-conversion-value">${E(source)}</div><div class="money-conversion-arrow">→</div><div class="money-conversion-value unknown-money">${E(destination)}</div></div>${moneyStepPanel(steps,steps.length,'Reveal next step')}${caption('Use 100 cents = 1 dollar. Revealed steps count as help.')}`;
 wireMoneySteps(host,steps.length,'Reveal next step');
}
function drawMoneyAlgorithm(c,host){
 const plan=c.task==='add'?moneyAdditionPlan(c):moneySubtractionPlan(c),step=Math.min(interaction.moneyStep,plan.actions.length),animation=interaction.moneyAnimation?.step===step?interaction.moneyAnimation:null,state=animation?moneyAnimatedState(plan,step,animation.phase):moneyPlanState(plan,step),settled=interaction.moneySettledStep===step;
 host.innerHTML=`<div class="strict-money-workspace">${moneyOperationMat(plan,state,step,animation,settled)}<div class="strict-money-symbolic">${moneyWrittenAlgorithm(c,plan,state,step)}${moneyOperationPanel(plan,step,animation)}</div></div>${caption(c.task==='add'?'Align the decimal dots. Add 5¢, 10¢, $1, $10 and $100 in that order.':'Start at 5¢. If a place can subtract, subtract immediately; if not, rename first.')}`;
 wireMoneyOperationSteps(host,plan);
}
function moneyBrace(direction='top'){
 const d=direction==='top'?'M3 20 V5 H97 V20':'M3 4 V19 H97 V4';
 return `<svg class='money-model-brace-svg' viewBox='0 0 100 24' preserveAspectRatio='none' aria-hidden='true'><path d='${d}'/></svg>`;
}
function moneyPartWhole(c){
 const findTotal=c.wordType==='total',total=findTotal?'?':moneyText(c.a),left=findTotal?moneyText(c.a):moneyText(c.b),right=findTotal?moneyText(c.b):'?';
 const leftLabel=findTotal?'Book':'Spent',rightLabel=findTotal?'Game':'Left';
 return `<div class='money-model reference-money-model part-whole-model'><div class='money-pw-stage'>
   <div class='money-brace-span money-brace-top money-pw-top-brace'>${moneyBrace('top')}<span class='money-brace-value money-brace-value-top'>${E(total)}</span></div>
   <div class='money-pw-bar'><div class='money-pw-part money-pw-left'><span class='money-model-part-label'>${E(leftLabel)}</span></div><div class='money-pw-part money-pw-right'><span class='money-model-part-label'>${E(rightLabel)}</span></div></div>
   <div class='money-pw-bottom'><div class='money-brace-segment'><div class='money-brace-span money-brace-bottom'>${moneyBrace('bottom')}<span class='money-brace-value money-brace-value-bottom'>${E(left)}</span></div></div><div class='money-brace-segment'><div class='money-brace-span money-brace-bottom'>${moneyBrace('bottom')}<span class='money-brace-value money-brace-value-bottom'>${E(right)}</span></div></div></div>
 </div></div>`;
}
function moneyComparison(c){
 const ratio=Math.max(32,Math.min(78,Math.round(c.b/c.a*100)));
 return `<div class='money-model reference-money-model comparison-model' style='--money-small-pct:${ratio}%'><div class='money-cmp-stage'>
   <div class='money-cmp-labels'><strong>School bag</strong><strong>Pencil case</strong></div>
   <div class='money-cmp-canvas'>
    <div class='money-brace-span money-brace-top money-cmp-top-brace'>${moneyBrace('top')}<span class='money-brace-value money-brace-value-top'>${E(moneyText(c.a))}</span></div>
    <div class='money-cmp-bar money-cmp-large'></div><div class='money-cmp-bar-row'><div class='money-cmp-bar money-cmp-small'></div></div>
    <span class='money-cmp-guide money-cmp-guide-boundary' aria-hidden='true'></span><span class='money-cmp-guide money-cmp-guide-end' aria-hidden='true'></span>
    <div class='money-cmp-bottom'><div class='money-brace-segment'><div class='money-brace-span money-brace-bottom'>${moneyBrace('bottom')}<span class='money-brace-value money-brace-value-bottom'>${E(moneyText(c.b))}</span></div></div><div class='money-brace-segment'><div class='money-brace-span money-brace-bottom'>${moneyBrace('bottom')}<span class='money-brace-value money-brace-value-bottom money-unknown-value'>?</span></div></div></div>
   </div>
  </div></div>`;
}
function drawMoneyWord(c,host){
 const source='https://limkimsze-maker.github.io/P3_Money_Word_Problems/?studio=primary-maths-studio';
 host.innerHTML=`<iframe id="moneyWordReferenceFrame" class="money-word-reference-frame" src="${source}" title="P3 Money Word Problems reference activity" loading="eager"></iframe>`;
 const frame=$('moneyWordReferenceFrame');
 const fit=()=>{
  try{
   const doc=frame.contentDocument;
   if(!doc)return;
   const height=Math.max(900,doc.documentElement?.scrollHeight||0,doc.body?.scrollHeight||0);
   frame.style.height=height+'px';
  }catch{}
 };
 frame.addEventListener('load',()=>{
  fit();
  try{
   const doc=frame.contentDocument;
   if(doc?.body&&'ResizeObserver' in window){
    const observer=new ResizeObserver(()=>requestAnimationFrame(fit));
    observer.observe(doc.body);
    frame._moneyReferenceObserver=observer;
   }
  }catch{}
  setTimeout(fit,120);
  setTimeout(fit,500);
 });
}
function drawMoney(){
 const c=current.data,host=$('diagram');
 if(c.task==='convert'){drawMoneyConversion(c,host);return;}
 if(['add','subtract'].includes(c.task)){drawMoneyAlgorithm(c,host);return;}
 if(c.task==='word'){drawMoneyWord(c,host);return;}
 if(c.task==='make'){
  const target=Number(c.target),vals=target===100?[50,20,10,5]:target===1000?[500,200,100,50,20,10,5]:[5000,1000,500,200,100,50,20,10,5];
  const cue=target===100?'Build one dollar using cents.':target===1000?'Make $1 first, then count on to $10.':'Reach a dollar, then ten dollars, then one hundred dollars.';
  host.innerHTML=`<div class="saving-levels"><span class="${target===100?'active':''}">$1</span><span class="${target===1000?'active':''}">$10</span><span class="${target===10000?'active':''}">$100</span></div><div class="money-board">${vals.map(v=>moneyToken(v,true,interaction.money+v>target)).join('')}</div><div class="wallet">Chosen: ${E(moneyText(interaction.money))} / ${E(moneyText(target))}</div><p class="diagram-caption">${E(interaction.coins.map(denomination).join(' + ')||cue)}</p><div class="diagram-toolbar"><button type="button" id="undoMoney" ${interaction.coins.length?'':'disabled'}>Undo last</button><button type="button" id="clearMoney" ${interaction.coins.length?'':'disabled'}>Clear</button></div>${caption('Original diagram drawings show each coin or note clearly; they are not reproductions of real currency.')}`;
  host.querySelectorAll('[data-money]').forEach(button=>button.onclick=()=>{if(interaction.coins.length>=60)return;const value=Number(button.dataset.money);interaction.money+=value;interaction.coins.push(value);drawMoney();});
  $('undoMoney').onclick=()=>{interaction.money-=interaction.coins.pop()||0;drawMoney();};$('clearMoney').onclick=()=>{interaction.money=0;interaction.coins=[];drawMoney();};return;
 }
 const vals=pieces(c.a);host.innerHTML=`<div class="money-order-labels"><span>Largest value</span><span>Smallest value</span></div><div class="money-board">${vals.map(v=>moneyToken(v)).join('')}</div>${caption('Count on from left to right. These are original coin and note diagrams, not reproductions of real currency.')}`;
}
function strip(n,den,interactive=false,second=false){return `<div class="fraction-strip" style="grid-template-columns:repeat(${den},1fr)">${Array.from({length:den},(_,i)=>`<${interactive?'button type="button"':'span'} class="fraction-cell ${i<n?'shaded':''} ${second?'second':''}" ${interactive?`data-cell="${i}" aria-label="Part ${i+1}"`:''}></${interactive?'button':'span'}>`).join('')}</div>`;}
function fractionSymbol([n,d],extra=''){return `<span class="fraction-symbol ${extra}" aria-label="${n} over ${d}"><b>${n}</b><i></i><b>${d}</b></span>`;}
function fractionModelCard(frac,label,index=0,extra=''){return `<div class="fraction-model-card ${extra}"><span>${E(label)}</span>${strip(frac[0],frac[1],false,index%2===1)}${fractionSymbol(frac)}</div>`;}
function fractionEquation(c,finalStep){
 const original=c.fractions||[[c.a,c.den]],symbols=original.map(frac=>fractionSymbol(frac));
 if(['unit-compare','like-compare','unlike-compare'].includes(c.task)){
  if(c.orderMode==='compare')return `${symbols[0]}<strong class="fraction-relation">${finalStep?E(current.answer):'?'}</strong>${symbols[1]}`;
  return `<span class="fraction-order-answer ${finalStep?'revealed':''}">${finalStep?E(current.answer):'Arrange the three fractions'}</span>`;
 }
 if(['like-add','like-subtract','unlike-add','unlike-subtract'].includes(c.task))return `${symbols[0]}<strong class="fraction-operation">${E(c.operation)}</strong>${symbols[1]}<strong class="fraction-operation">=</strong>${finalStep?fractionSymbol(c.resultFraction,'answer'):fractionSymbol(['?', '?'],'mystery')}`;
 if(c.task==='equivalent')return `${symbols[0]}<strong class="fraction-operation">=</strong>${finalStep?fractionSymbol(c.changedFractions[0],'answer'):fractionSymbol(['?',c.den*c.factor],'mystery')}`;
 if(c.task==='simplify')return `${symbols[0]}<strong class="fraction-operation">=</strong>${finalStep?fractionSymbol(c.changedFractions[0],'answer'):fractionSymbol(['?','?'],'mystery')}`;
 return finalStep?fractionSymbol(current.answer,'answer'):fractionSymbol(['?','?'],'mystery');
}
function drawFractions(){
 const c=current.data,host=$('diagram');
 if(engine!=='fraction'){host.innerHTML=`<div class="fraction-wrap">${strip(c.a,c.den)}</div>`+caption('The denominator counts all equal parts.');return;}
 const steps=c.steps||[],step=Math.min(interaction.fractionStep,Math.max(0,steps.length-1)),finalStep=step===steps.length-1,teaching=steps[step]||{title:'Look at the model',text:'Each strip is one whole.'};let shown=c.fractions||[[c.a,c.den]];
 if(['unlike-add','unlike-subtract'].includes(c.task)&&step>=1)shown=c.changedFractions;
 if(['equivalent','simplify'].includes(c.task)&&finalStep)shown=[c.fractions[0],c.changedFractions[0]];
 const labels=shown.length===1?['One whole']:shown.map((_,i)=>i===shown.length-1&&['equivalent','simplify'].includes(c.task)?'Same value':i===0?'First fraction':i===1?'Second fraction':'Third fraction');
 let models=shown.map((frac,i)=>fractionModelCard(frac,labels[i],i,i===shown.length-1&&['equivalent','simplify'].includes(c.task)?'fraction-equivalent-card':'')).join('');
 if(finalStep&&['like-add','like-subtract','unlike-add','unlike-subtract'].includes(c.task))models+=fractionModelCard(c.resultFraction,'Simplest answer',2,'fraction-result-card');
 host.innerHTML=`<div class="fraction-learning"><div class="fraction-model-grid" style="--fraction-models:${Math.min(3,shown.length+(finalStep&&['like-add','like-subtract','unlike-add','unlike-subtract'].includes(c.task)?1:0))}">${models}</div><div class="fraction-equation" aria-label="Fraction working">${fractionEquation(c,finalStep)}</div><div class="fraction-step-card" role="status"><span>STEP ${step+1} OF ${steps.length}</span><strong>${E(teaching.title)}</strong><p>${E(teaching.text)}</p></div><div class="fraction-step-controls" aria-label="Teaching steps"><button type="button" id="fractionBack" aria-keyshortcuts="ArrowLeft" ${step===0?'disabled':''}>← Previous</button><button type="button" class="primary" id="fractionNext" aria-keyshortcuts="ArrowRight" ${finalStep?'disabled':''}>${finalStep?'All steps shown ✓':'Next step →'}</button></div><p class="numberline-caption">Predict each step before revealing it. Use ← and → on the keyboard, or the fixed buttons.</p></div>`;
 $('fractionNext').onclick=()=>{if(finalStep)return;interaction.fractionStep=Math.min(steps.length-1,step+1);hints++;drawFractions();};
 $('fractionBack').onclick=()=>{if(step>0){interaction.fractionStep=step-1;hints++;drawFractions();}};
 const oldControls=$('answerForm').querySelector('.fraction-step-controls');if(oldControls)oldControls.remove();$('answerForm').insertBefore(host.querySelector('.fraction-step-controls'),$('answerFields'));
}
function clock(h,m){let s='<circle cx="150" cy="150" r="127" fill="#fff" stroke="#315a46" stroke-width="4"/>';for(let i=0;i<60;i++){const a=i*Math.PI/30,x1=150+Math.sin(a)*(i%5===0?110:119),y1=150-Math.cos(a)*(i%5===0?110:119);s+=line(x1,y1,150+Math.sin(a)*125,150-Math.cos(a)*125,'#315a46',i%5===0?3:1);if(i%5===0)s+=text(150+Math.sin(a)*93,156-Math.cos(a)*93,i===0?12:i/5,18);}
 const ha=(h%12+m/60)*Math.PI/6,ma=m*Math.PI/30;s+=line(150,150,150+Math.sin(ha)*65,150-Math.cos(ha)*65,'#183c35',7)+line(150,150,150+Math.sin(ma)*99,150-Math.cos(ma)*99,'#bc8c26',4)+'<circle cx="150" cy="150" r="7" fill="#183c35"/>';return svg(s,'0 0 300 300','svg-clock');}
function durationSegments(start,end){return end>=start?[[start,end]]:[[start,1440],[0,end]];}
function durationTime12(total){
 const minute=((Number(total)%1440)+1440)%1440;
 return `${formatTime(...clockPartsFrom24(minute))} ${minute<720?'a.m.':'p.m.'}`;
}
function durationTimelineSvg(start,end,periods,show12Hour=false){
 const width=1040,left=52,right=988,range=right-left,rows=Math.max(1,periods.length),clockGap=show12Hour?34:0,markerGap=show12Hour?24:0,height=230+rows*42+clockGap+markerGap,toX=value=>left+value/1440*range;
 const sky=[[0,300,'#223b63','🌙'],[300,420,'#a9d4ed','🌅'],[420,1020,'#e7f5d0','☀️'],[1020,1140,'#f9dcaa','🌇'],[1140,1440,'#263d62','🌙']];
 const blocks=sky.map(([from,to,fill,icon])=>`<rect x="${toX(from)}" y="26" width="${toX(to)-toX(from)}" height="48" fill="${fill}"/><text x="${(toX(from)+toX(to))/2}" y="57" text-anchor="middle" font-size="23">${icon}</text>`).join('');
 const ticks=Array.from({length:9},(_,i)=>i*180).map(value=>`<line x1="${toX(value)}" y1="26" x2="${toX(value)}" y2="${height-25}" stroke="#c5d6bf" stroke-width="1" stroke-dasharray="4 5"/><text class="duration-clock24" x="${toX(value)}" y="94" text-anchor="middle" font-size="15" font-weight="800" fill="#1e4f9a">${formatTime24H(value)}</text>${show12Hour?`<text class="duration-clock12" x="${toX(value)}" y="118" text-anchor="middle" font-size="15" font-weight="800" fill="#7b2f86">${durationTime12(value)}</text>`:''}`).join('');
 const questionBands=durationSegments(start,end).map(([from,to])=>`<rect x="${toX(from)}" y="${111+clockGap}" width="${Math.max(4,toX(to)-toX(from))}" height="17" rx="8" fill="#183c35"/><path d="M${toX(to)-9} ${111+clockGap}l9 8.5-9 8.5z" fill="#183c35"/>`).join('');
 const questionLabel=durationSegments(start,end).length===1?`<text x="${(toX(start)+toX(end))/2}" y="${106+clockGap}" text-anchor="middle" font-size="13" font-weight="900" fill="#183c35">? duration</text>`:`<text x="${(left+right)/2}" y="${106+clockGap}" text-anchor="middle" font-size="13" font-weight="900" fill="#183c35">? duration across midnight</text>`;
 const markers=`<line x1="${toX(start)}" y1="${105+clockGap}" x2="${toX(start)}" y2="${137+clockGap}" stroke="#183c35" stroke-width="3"/><line x1="${toX(end)}" y1="${105+clockGap}" x2="${toX(end)}" y2="${137+clockGap}" stroke="#183c35" stroke-width="3"/><text class="duration-clock24" x="${toX(start)}" y="${158+clockGap}" text-anchor="middle" font-size="16" font-weight="900" fill="#1e4f9a">Start ${formatTime24H(start)}</text><text class="duration-clock24" x="${toX(end)}" y="${158+clockGap}" text-anchor="middle" font-size="16" font-weight="900" fill="#1e4f9a">End ${formatTime24H(end)}</text>${show12Hour?`<text class="duration-clock12" x="${toX(start)}" y="${184+clockGap}" text-anchor="middle" font-size="16" font-weight="800" fill="#7b2f86">${durationTime12(start)}</text><text class="duration-clock12" x="${toX(end)}" y="${184+clockGap}" text-anchor="middle" font-size="16" font-weight="800" fill="#7b2f86">${durationTime12(end)}</text>`:''}`;
 const periodBands=periods.map((period,index)=>{const y=175+clockGap+markerGap+index*42,segments=durationSegments(period.start,period.end).map(([from,to])=>`<rect x="${toX(from)}" y="${y}" width="${Math.max(4,toX(to)-toX(from))}" height="22" rx="7" fill="${period.color}"/><path d="M${toX(to)-8} ${y}l8 11-8 11z" fill="${period.color}"/>`).join('');return `${segments}<text x="${left-9}" y="${y+16}" text-anchor="end" font-size="12" font-weight="900" fill="#385646">P${index+1}</text><text x="${right+8}" y="${y+16}" font-size="12" font-weight="900" fill="#385646">${formatDuration((period.end-period.start+1440)%1440)}</text>`;}).join('');
 return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="24-hour duration timeline${show12Hour?' with 12-hour times underneath':''}"><rect x="${left}" y="26" width="${range}" height="48" rx="9" fill="#eef4e9"/>${blocks}${ticks}${questionBands}${questionLabel}${markers}${periodBands}<text x="${left}" y="${height-7}" font-size="12" font-weight="800" fill="#526d59">Use the sun and moon timeline to read the 24-hour day.</text></svg>`;
}
function drawP3Duration(){
 const c=current.data,host=$('diagram'),start=c.start24,end=c.end24,colours=['#3f8865','#d88e27','#4b8fa8','#a8668d','#6366b8'];interaction.durationPeriods=[];interaction.durationPeriodId=0;let show12Hour=false;
 host.innerHTML=`<div class="duration-workspace"><div class="duration-head"><strong>24-hour duration timeline</strong><span>Build one or more periods with four digits and h, then find the total duration.</span><button type="button" class="duration-clock-toggle" id="durationClockToggle" aria-pressed="false" aria-controls="durationTimeline durationPeriods">Show 12-hour clock</button></div><div class="duration-timeline" id="durationTimeline"></div><div class="duration-period-panel"><div class="duration-period-panel-head"><span>Add / adjust your periods</span><button type="button" id="addDurationPeriod">+ Add period</button></div><div class="duration-periods" id="durationPeriods"></div></div></div>`;
 const timeline=$('durationTimeline'),rows=$('durationPeriods'),clockToggle=$('durationClockToggle'),workspace=host.querySelector('.duration-workspace');
 const repaint=()=>{timeline.innerHTML=durationTimelineSvg(start,end,interaction.durationPeriods,show12Hour);};
 clockToggle.onclick=()=>{show12Hour=!show12Hour;clockToggle.setAttribute('aria-pressed',String(show12Hour));clockToggle.textContent=show12Hour?'Hide 12-hour clock':'Show 12-hour clock';workspace.classList.toggle('duration-show-12-hour',show12Hour);repaint();};
 const addPeriod=(initialStart=start,initialEnd=start)=>{
  const item={id:++interaction.durationPeriodId,start:initialStart,end:initialEnd,color:colours[interaction.durationPeriods.length%colours.length]};interaction.durationPeriods.push(item);
  const row=document.createElement('div');row.className='duration-period-row';row.innerHTML=`<span class="duration-period-badge">Period ${interaction.durationPeriods.length}</span><label>Start time<span class="duration-time-input"><input type="text" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" aria-label="Start time for period ${item.id}" placeholder="HHMM" autocomplete="off"><b aria-hidden="true">h</b></span></label><label>End time<span class="duration-time-input"><input type="text" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" aria-label="End time for period ${item.id}" placeholder="HHMM" autocomplete="off"><b aria-hidden="true">h</b></span></label><div class="duration-period-readout"></div><button type="button" class="duration-period-remove" aria-label="Remove period ${item.id}">×</button>`;rows.append(row);
  const inputs=row.querySelectorAll('input'),startInput=inputs[0],endInput=inputs[1],readout=row.querySelector('.duration-period-readout'),remove=row.querySelector('button');
  const show=()=>{startInput.value=formatTime24(item.start);endInput.value=formatTime24(item.end);readout.innerHTML=`<div class="duration-period-times"><span class="duration-time-pair"><strong class="duration-clock24">${formatTime24H(item.start)}</strong><small class="duration-clock12">${durationTime12(item.start)}</small></span><span aria-hidden="true">→</span><span class="duration-time-pair"><strong class="duration-clock24">${formatTime24H(item.end)}</strong><small class="duration-clock12">${durationTime12(item.end)}</small></span></div>Duration: <strong>${formatDuration((item.end-item.start+1440)%1440)}</strong>`;};
  const update=()=>{const nextStart=time24Minutes(startInput.value),nextEnd=time24Minutes(endInput.value);if(nextStart===null||nextEnd===null){readout.textContent='Use four digits, for example 0535 h.';return;}item.start=nextStart;item.end=nextEnd;show();repaint();};
  for(const input of inputs)input.addEventListener('input',()=>{input.value=input.value.replace(/\D/g,'').slice(0,4);});
  startInput.addEventListener('change',update);endInput.addEventListener('change',update);startInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();endInput.focus();}});endInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();update();}});remove.onclick=()=>{interaction.durationPeriods=interaction.durationPeriods.filter(period=>period.id!==item.id);row.remove();repaint();};show();repaint();
 };
 $('addDurationPeriod').onclick=()=>addPeriod();repaint();addPeriod();
}
function timeSceneDescription(sky){return sky==='morning'?'A morning forest with a sun and white clouds.':sky==='afternoon'?'An afternoon forest with a sun and white clouds.':sky==='night'?'A night forest with a moon.':'An early-morning forest with a moon and owl.';}
function draw24HourClock(){
 const c=current.data,host=$('diagram'),source=c.task==='twelvehour'?`<p class="time24-source">24-hour time: <strong>${formatTime24H(c.source24)}</strong></p>`:'',note=c.task==='ampm'?'Read the analogue clock in 12-hour form, then use the clear forest sky clue to choose a.m. or p.m.':c.task==='twelvehour'?'Use the 24-hour time card, the analogue clock and the forest sky clue to write the ordinary 12-hour time.':'Read the analogue clock and the forest sky clue, then write four digits. The unit h is shown beside the answer.';
 host.innerHTML=`<div class="clock24-workspace">${source}<div class="time-scene ${c.sky}" role="group" aria-label="${E(timeSceneDescription(c.sky))}">${clock(...clockPartsFrom24(c.time24))}</div><p class="clock24-note">${note}</p></div>`;
}
function drawTimeConversion(){
 const c=current.data,host=$('diagram'),duration=c.task==='convert-duration',given=duration?(c.durationDirection==='to-minutes'?formatDuration(c.duration12[0]*60+c.duration12[1]):`${c.totalMinutes} min`):(c.secondsDirection==='to-seconds'?formatSeconds(c.seconds[0]*60+c.seconds[1]):`${c.secondsTotal} s`),target=duration?(c.durationDirection==='to-minutes'?'minutes':'hours and minutes'):(c.secondsDirection==='to-seconds'?'seconds':'minutes and seconds');
 host.innerHTML=`<div class="time-conversion-workspace"><div class="time-conversion-card">${E(given)}</div><div class="time-conversion-arrow" aria-hidden="true">→</div><div class="time-conversion-card question-mark">? ${E(target)}</div></div>`+caption(duration?'Remember: 1 h = 60 min.':'Remember: 1 min = 60 s.');
}
function drawP3MissingTime(){
 const c=current.data,host=$('diagram'),startText=c.missing==='start'?'? start':`Start ${formatTime24H(c.start24)}`,endText=c.missing==='end'?'? end':`End ${formatTime24H(c.end24)}`;
 host.innerHTML=`<div class="time-calculation-workspace"><div class="time-calculation-card">${E(startText)}</div><div class="time-calculation-arrow"><strong>${E(formatDuration(c.duration))}</strong><span>${c.missing==='end'?'move forwards →':'← move backwards'}</span></div><div class="time-calculation-card">${E(endText)}</div></div>`+caption('Keep every hour change in groups of 60 min.');
}
function drawClocks(){
 const c=current.data,host=$('diagram');
 if(engine==='time'&&c.grade===3&&c.task==='duration'){drawP3Duration();return;}
 if(engine==='time'&&c.grade===3&&['endtime','starttime'].includes(c.task)){drawP3MissingTime();return;}
 if(engine==='time'&&['convert-duration','seconds'].includes(c.task)){drawTimeConversion();return;}
 if(engine==='time'&&['twentyfour','twelvehour','ampm'].includes(c.task)){draw24HourClock();return;}
 if(engine==='time'&&c.task==='duration'){
  host.innerHTML=`<div class="clock-pair"><div>${clock(...c.start12)}${caption(`Start ${formatTime(...c.start12)}`)}</div><div>${clock(...c.end12)}${caption(`End ${formatTime(...c.end12)}`)}</div></div>`+caption('Move forwards from the start clock to the end clock. The short hand moves gradually as the minutes pass.');
  return;
 }
 host.innerHTML=clock(...interaction.clock);
 if(engine==='time'&&c.task==='set'){
  const tools=document.createElement('div');tools.className='clock-inputs';tools.innerHTML=`<label>Hour<input id="clockHour" type="range" min="1" max="12" step="1" value="${interaction.clock[0]}" aria-label="Set clock hour"></label><label>Minute<input id="clockMinute" type="range" min="0" max="${c.grade===1?55:59}" step="${c.grade===1?5:1}" value="${interaction.clock[1]}" aria-label="Set clock minute"></label>`;host.append(tools);
  for(const id of ['clockHour','clockMinute'])$(id).oninput=()=>{interaction.clock=[Number($('clockHour').value),Number($('clockMinute').value)];const old=host.querySelector('svg');const temp=document.createElement('div');temp.innerHTML=clock(...interaction.clock);old.replaceWith(temp.firstChild);};
  host.insertAdjacentHTML('beforeend',caption('Move both sliders. The short hand also moves between hours as the minutes change.'));
 }else host.insertAdjacentHTML('beforeend',caption('Short hand: hour. Long hand: minute.'));
}
function drawGeometry(){const c=current.data,host=$('diagram');let s='',stroke='fill="#d2e4ca" stroke="#315a46" stroke-width="4"';if(c.task==='angle'){const end=c.angle==='right'?[300,30]:c.angle==='less'?[395,55]:[200,40];s+=line(300,190,495,190)+line(300,190,...end);const dx=end[0]-300,dy=end[1]-190,mag=Math.hypot(dx,dy);s+=`<path d="M345 190 A45 45 0 0 0 ${300+dx/mag*45} ${190+dy/mag*45}" fill="none" stroke="#bc8c26" stroke-width="3"/>`;s+='<path d="M80 150v40h40v-40z" fill="none" stroke="#718c6b" stroke-width="2"/>'+text(100,222,'Right-angle reference',12);}else if(c.task==='lines'){if(c.lines==='parallel')s=line(120,75,480,75)+line(120,165,480,165);else if(c.lines==='perpendicular')s=line(120,130,480,130)+line(300,30,300,230)+'<path d="M300 130h22v22h-22" fill="none" stroke="#bc8c26" stroke-width="2"/>';else s=line(120,190,480,65)+line(130,65,490,210);}else if(c.task==='solid'){if(['cube','cuboid'].includes(c.solid)){const w=c.solid==='cube'?130:230;s=`<path d="M${260-w/2} 80h${w}v130h-${w}z m0 0l60-45h${w}v130l-60 45 M${260+w/2} 80l60-45" ${stroke}/>`;}else if(c.solid==='sphere')s=`<circle cx="300" cy="125" r="90" ${stroke}/><ellipse cx="300" cy="125" rx="90" ry="25" fill="none" stroke="#719b71" stroke-width="2"/><ellipse cx="300" cy="125" rx="32" ry="90" fill="none" stroke="#719b71" stroke-width="2"/>`;else if(c.solid==='cone')s=`<path d="M210 205L300 35l90 170" ${stroke}/><ellipse cx="300" cy="205" rx="90" ry="25" ${stroke}/>`;else s=`<path d="M215 55v140c0 45 170 45 170 0V55" ${stroke}/><ellipse cx="300" cy="55" rx="85" ry="25" ${stroke}/>`;}else{const k=c.shape;s=k==='triangle'?`<path d="M300 30L165 215h270z" ${stroke}/>`:k==='circle'?`<circle cx="300" cy="125" r="95" ${stroke}/>`:k==='semicircle'?`<path d="M180 185a120 120 0 0 1 240 0z" ${stroke}/>`:k==='quarter'?`<path d="M220 205V35a170 170 0 0 1 170 170z" ${stroke}/>`:`<rect x="${k==='square'?210:150}" y="35" width="${k==='square'?180:300}" height="180" ${stroke}/>`;}
 host.innerHTML=svg(s)+caption('Simple original diagram. Use its mathematical features to decide.');}
function grid(cols,rows,x,y,w=440){const size=Math.min(w/cols,175/rows);let s='';for(let r=0;r<rows;r++)for(let k=0;k<cols;k++)s+=`<rect x="${x+k*size}" y="${y+r*size}" width="${size}" height="${size}" fill="#d2e4ca" stroke="#71936f" stroke-width="1"/>`;s+=text(x+cols*size/2,y-10,cols+' cm',17)+`<text x="${x-8}" y="${y+rows*size/2+5}" text-anchor="end" font-size="15">${rows} cm</text>`;return s;}
function drawArea(){const c=current.data,host=$('diagram');host.innerHTML=svg(c.task==='compare'?grid(c.a,c.b,60,45,205)+grid(c.cols2,c.rows2,355,45,205):grid(c.a,c.b,100,45,400))+caption('Each small square has area 1 cm². Each small edge is 1 cm.');}
function drawGraph(){const c=current.data,host=$('diagram');host.innerHTML=`<div class="graph-key">${c.graphType==='picture'?'One picture':'One tick interval'} = ${c.key} items</div>`;if(c.graphType==='picture'){host.insertAdjacentHTML('beforeend',`<div class="picture-graph">${c.labels.map((label,i)=>`<div class="picture-row"><span class="picture-label">${E(label)}</span><div class="picture-items">${Array.from({length:c.values[i]/c.key},()=>'<span class="picture-icon"></span>').join('')}</div></div>`).join('')}</div>`);}else{let s='',mx=Math.max(c.key,...c.values),ticks=Math.ceil(mx/c.key);const base=205,h=170;for(let i=0;i<=ticks;i++){const y=base-i/ticks*h;s+=line(75,y,560,y,'#d5e1ce',1);if(ticks<=15||i%Math.ceil(ticks/15)===0)s+=text(49,y+5,i*c.key,13);}s+=line(75,25,75,205)+line(75,205,560,205);for(let i=0;i<3;i++){const ht=c.values[i]/(ticks*c.key)*h;s+=`<rect x="${120+i*150}" y="${base-ht}" width="75" height="${ht}" fill="${['#85b197','#efc66d','#acc8dc'][i]}" stroke="#315a46"/>`+text(158+i*150,235,c.labels[i],14);}host.insertAdjacentHTML('beforeend',svg(s));}host.insertAdjacentHTML('beforeend',caption('Read the key or scale first. Use it to count or compare.'));}
function drawReasons(){const c=current.data,host=$('diagram');host.innerHTML=`<div class="reason-board"><div class="reason-list">${interaction.cards.map((r,i)=>`<button type="button" data-reason="${i}" class="${interaction.reasons.includes(r)?'used':''}">${E(r)}</button>`).join('')}</div><div class="reason-steps">${[0,1,2].map(i=>`<div class="reason-step"><strong>STEP ${i+1}</strong> ${E(interaction.reasons[i]||'Choose a statement')}</div>`).join('')}<button type="button" id="undoReason">Undo last</button></div></div>`;host.querySelectorAll('[data-reason]').forEach(b=>b.onclick=()=>{const r=interaction.cards[Number(b.dataset.reason)];if(interaction.reasons.length<3&&!interaction.reasons.includes(r)){interaction.reasons.push(r);drawReasons();}});$('undoReason').onclick=()=>{interaction.reasons.pop();drawReasons();};}
const GUIDE={
 place:['Count with a place-value chart','This engine follows Lim Kim Sze’s Place Value Chart for Counting. Choose the grade, task and starting number. The coloured columns link base-ten blocks or labelled discs to place-value cards, number words, expanded form and a digit chart. Switch Model without changing the current working. Numbers of 10,000 use discs.\n\nRead blocks or discs starts with cards and expanded form hidden, and chart digits shown as question marks, so pupils can count first. Show cards or Show chart digits to model the answer. Put Apart separates the place-value cards; Placed Together aligns their digits to form the number, including zeros. Show expanded form adds the number words and sum of the non-zero place values. Hide chart removes the digit chart without changing the pieces. These answer aids count as help when revealed before a correct answer. A correct answer shows the aids automatically; you can hide them again.\n\nValue of a digit highlights the matching column and digit. Ask for its value, not just the digit itself. For example, the 3 in 2034 is worth 30. Mixed: Value of a digit keeps the same question type but varies the target place from question to question. Place of a digit uses the same highlighted number and place-value model, but asks pupils to name the place, for example, “What is the place of digit 2 in 932?” Mixed: Place of a digit varies the target place while always asking for the place. Mixed: Place or value of a digit varies both the target place and the question type. An empty column still has a zero digit.\n\nMore than a number and Less than a number let you enter the starting number and how much to add or take away. Pupils write an answer first. Each Next shows one movement: new pieces appear in green, ten smaller pieces group into one larger piece, a larger piece splits into ten smaller pieces, or the removed pieces are crossed out. Exchanges across zeros happen separately. The cards and digit chart follow the current total. Show Again restores the starting model and repeats the same question; it preserves your chosen display aids. Movement demonstrations count as help.\n\nFor reading or digit-value tasks, choose the two adjacent places in Exchange, then Split 1 into 10 or Group 10 into 1. Watch the highlighted pieces move. The total, cards and digit chart stay unchanged even if one model column now has ten or more pieces. Reset model restores the original pieces. P1 numbers and answers stay within 100, P2 within 1000, and P3 within 10000. In Random practice, the amount more/less and Model stay fixed while the starting number varies.\n\nHundred chart & flip chart is a separate exploration option for numbers from 0 to 100, available with every grade preset. Set Starting number, Yellow-button amount and Blue-button amount, then Generate activity. The defaults are 50, 10 and 1. You can choose other amounts, such as 33. Both charts always show the same number.\n\nAs in the reference activity, 91–100 is the top row and 1–10 the bottom row. Ten more moves up one row; ten less moves down. One more moves to the next number, continuing onto the next row when needed. Tap any chart number, or use the arrows above and below the flip cards to change a place. The hundreds card is blank below 100 and shows 1 at 100. Zero appears on the flip chart, outside the 1–100 chart.\n\nAsk pupils to predict before pressing more or less. Each move works through tens first, then ones, with the counter and digits moving together. For example, 33 more than 50 follows 50 → 60 → 70 → 80 → 81 → 82 → 83. The answer sentence appears when the movement finishes. Moves outside 0–100 are unavailable; the amount is never shortened to fit. Reset to start restores your chosen number. Finish exploring ends the activity; Explore again starts from your chosen number. This option is for demonstration and discussion, with no answer entry or marks.\n\nA downloaded hundred-chart activity opens at the saved starting number, with your two saved button amounts. It is the same exploration setup each time you reopen it. It does not save where a pupil last moved the counter. Generate, Reset to start or Explore again restores that starting number. Random practice applies to the other place-value tasks, not this exploration option.','P1: 34 = 30 + 4; 1 more than 29 = 30. P2: 1 less than 200 = 199. P3: 2034 has zero hundreds; 1 less than 1000 = 999; 100 more than 4250 = 4350.'],
 operations:['Teach one place at a time','Choose your task and enter the numbers. Addition and subtraction follow Lim Kim Sze’s linked place-value activities. Choose place-value discs or base-ten blocks in Model; the activity buttons can switch the display without changing the current step.\n\nAddition has two rows. Next Step moves the second number’s pieces into the first row for the active place, renames a group of ten when needed, writes the regrouped amount above the next column, then records the result digit. Work from ones upwards.\n\nSubtraction has one working row showing the first number. Next Step renames one larger piece into ten smaller pieces BEFORE subtracting when needed. Each exchange across zeros is separate: 1000 − 1 first changes a thousand into hundreds, then a hundred into tens, then a ten into ones. The written calculation crosses out the old digits and shows renamed amounts above them. Subtracting crosses out and removes the pieces being taken away, then records that place’s result.\n\nAfter the addition or subtraction demonstrations, pupils enter the whole answer and Check answer. A ten-thousands column uses discs.\n\nMultiplication follows the guided panel in Uncle Joe and the Key of Product. Each row starts with one copy of the number being multiplied. Start with ones. Enter the answer digit in the highlighted result box and the outgoing carry in the small box above the next column when it is shown. Check Digit checks BOTH entries together, records that place, and shows the pieces left and the regrouped pieces in the next place. Add the incoming carry once when working on that next place. A final carried digit has its own check. The product is complete when every place is correct; no repeated whole-answer entry is needed. P1 and P2 equal groups use this same grouped-disc model; P3 also offers 1-, 2- or 3-digit numbers × a 1-digit number.\n\nDivision: share equally and make equal groups use counters. P3 place-value division follows the Exact Algorithm guide in Animal Rescue. The disc bank sits above a single hundreds–tens–ones mat, with one row for each group. Start at the largest place. For each place, fill all highlighted boxes: the quotient digit, the product to subtract, and the next number after subtracting and bringing down. Check Step checks those boxes together, then moves one disc into each group per round and exchanges leftover discs into the next smaller place. After ones, complete the bottom remainder box and the top R box when shown. Division is complete once all place steps and the remainder boxes are correct; pupils do not enter the same answer again. Use 0 when there is no remainder. Leading zeros are left out of the final written answer; real internal zeros are kept.','28 + 17 = 45; 1000 − 1 = 999; 348 × 4 = 1392; 246 ÷ 2 = 123; 326 ÷ 3 = 108 remainder 2.'],
 numberline:['Move along a line and build the pattern','Find the missing number uses the familiar practice-book layout: an uncluttered line, equal tick intervals and one blue missing-number box. Ask pupils to count the spaces between labelled ticks before working out the missing value.\n\nFind a number more and Find a number less use practice-book wording such as “What is 200 more than 5 941?” A small, clean curved arrow shows one jump without covering the ticks. The dark marker shows the starting number. Pupils move the blue marker to the landing tick and write the same landing number below. Both the marker and written answer must be correct. The blue marker starts with a question mark so the diagram does not reveal the answer.\n\nComplete a number pattern uses a nine-term number train. Choose a constant change or alternating changes, enter positive numbers for more and negative numbers for less, then choose 2, 3 or 4 missing numbers. Pupils tap a coloured number card and then a blank box. On a computer, they may also drag the card. Tap a filled blank without selecting a card to clear it. Every card must be placed in the correct position before Check answer succeeds.\n\nReveal rule shows the constant or alternating changes and counts as help. Ask pupils to compare neighbouring terms and say each change before revealing it. Fixed downloads preserve the start, changes, pattern type and number of blanks. Random practice preserves those pattern settings but generates a new valid starting number.','Find a missing tick when counting in tens from 240; answer “What is 200 more than 5 941?”; complete 2400, 2500, 2510, 2610… using alternating +100 and +10.'],
 bar:['Show how the story quantities are connected','Select part–whole, comparison, change or equal groups. Enter the quantities and an object name such as stickers. The engine writes a short original story and draws its bar relationship. Have pupils identify the whole, known parts and unknown before choosing an operation.','24 stickers altogether, 8 red: find the blue stickers; 24 compared with 8: find how many more.'],
 money:['Follow the Money topics in teaching order',`The Money menu now follows the topics in Lim Kim Sze’s GitHub collection.

Count money · Big to small arranges original coin and note diagrams from the largest value to the smallest. They use the same clear, child-friendly convention as the linked GitHub activity: round labelled cent coins, an octagonal $1 coin and coloured rectangular notes. They are teaching diagrams, not reproductions or scans of real Singapore currency. Pupils count on and answer in cents, or in dollars and cents, according to the teacher setting.

Convert cents ↔ dollars lets the teacher choose either direction. Reveal next step first groups every 100 cents into 1 dollar, or changes each dollar into 100 cents. Pupils can answer before revealing the working.

Saving Quest · Make $1, $10 or $100 lets the teacher select one target. Pupils tap the coin and note diagrams, watch the running amount, and undo or clear choices. The built amount and written answer must both be correct. In Random practice, P1 uses $1, P2 varies between $1 and $10, and P3 varies among all three targets.

The written money format is always explicit: the dollar sign comes before the dollar digits, the decimal point separates dollars from cents, and the cents are shown with two digits. For example, five cents is written $0.05, while fifty cents is written $0.50. The pupil answer box is one aligned amount: $ [dollars] . [cents].

Add money · Step by step follows the Adding Money interactive. The concrete mat has five columns ($100, $10, $1, 10¢ and 5¢) and two rows. Every note or coin token is drawn separately. Before each click, the teaching card shows the active place and leaves its answer as ?. Press Next step in this order: 5¢, 10¢, $1, $10, $100. The second row’s tokens join the first row in the active column. When a column reaches its exchange value, the outlined group disappears and a highlighted token appears in the next column: two 5¢ become one 10¢; ten 10¢ become one $1; then groups of ten continue through $10 and $100. The completed-move strip states what moved, whether it regrouped and what digit was recorded. The written calculation reveals the matching result digit and carry at the same time.

Subtract money · Step by step follows the Subtracting Money interactive. It uses one working row showing only the first amount; it does not place a second “take away” row underneath. Work from 5¢ to $100. If a place can subtract, the next click subtracts immediately. If there are not enough tokens, Next step first renames one adjacent larger token: 10¢ becomes two 5¢, $1 becomes ten 10¢, $10 becomes ten $1, or $100 becomes ten $10. Borrowing across zero is shown one adjacent column at a time, never skipped. The donor is crossed out while the new smaller tokens appear highlighted. The written calculation crosses out the old digit and records the renamed amount above it. Only the following step crosses out and removes the required tokens, then reveals that result digit.

For classroom display, choose Pupil view. The money mat, written calculation and current instruction expand across the available projector width. One press of Next step now plays a slow sequence: move or identify the tokens, exchange or remove them, then write the digit. The button stays disabled until the full movement finishes. Gentle original sound cues distinguish movement, exchange or borrowing, and recording the digit; use Sound on or Sound off beside the step button. A cross on a note or coin appears only while that token is being borrowed or removed and disappears when the movement is complete. Crossed-out digits in the written subtraction remain because they record the renaming mathematically.

Pause before every Next step and ask pupils to predict the move. Keep the concrete mat and written calculation in view together. After all places are complete, pupils enter the whole answer and check it. They may also solve directly without revealing every step.

Money word problems · Choose the model asks pupils to select Comparison or Part–whole before entering an amount. The model and final answer must both match the story. Teachers can choose find the total, find what remains, or find the difference.

For counting, addition, subtraction and word problems, the teacher enters ordinary money notation in the field beside the visible dollar sign: type 12.75 for $12.75. Use two decimal places for clarity and 5-cent intervals. In Cents → dollars and cents conversion, the source field remains a whole-cent number such as 140. Fixed numbers preserve the exact amounts and selected settings. Random practice preserves the visible direction, problem structure and answer format while generating new valid amounts.`,`Count $8.50 from large to small; 140¢ = $1.40; make $1, $10 or $100; $12.75 + $8.60; $31.60 − $20.90; choose a comparison or part–whole model for a money story.`],
 fraction:['Follow the Space Max fraction learning sequence','The Fraction menu follows the ten subtopics in Space Max and the Lost Fraction Rocket Parts. P2 has Writing Fractions, Comparing Unit Fractions, Comparing Like Fractions, Adding Like Fractions and Subtracting Like Fractions. P3 keeps those foundations and adds Equivalent Fractions, Simplifying Fractions, Comparing & Ordering Unlike Fractions, Adding Unlike Fractions and Subtracting Unlike Fractions.\n\nWriting Fractions uses the same clear order: check for equal parts, count all equal parts for the denominator, count shaded parts for the numerator, then write shaded parts over total equal parts. Unit fractions compare one equal part: the larger denominator gives the smaller part. Like fractions have equal denominators, so compare, add or subtract the numerators while the denominator stays the same.\n\nFor equivalent fractions, split every part by the same factor and multiply both numerator and denominator. For simplifying, divide numerator and denominator by the same greatest common factor. For unlike fractions, first make equal-sized parts with a common denominator. Only one denominator needs changing in the addition and subtraction examples. Then work with the numerators, keep the common denominator and simplify the answer.\n\nEach question opens at Step 1. Ask pupils to predict, then press Next step →. ← Previous revisits the explanation. These two buttons, the answer blank, Check answer and Next question stay in one fixed control dock, so their mouse positions do not jump while teaching. Check answer changes to Next question in the same button position after a correct response. Revealing or revisiting steps counts as help. The last step displays the symbolic answer and matching strip; pupils must still enter the fraction themselves. The numerator is entered above a real fraction line and the denominator below it. Fraction answers must be written in the requested simplest or equivalent form, not merely as any fraction with the same value.\n\nComparing tasks can compare two fractions or order three from least to greatest / greatest to least. Fixed mode keeps the teacher’s exact fractions. Random practice keeps the selected subtopic, question form and equivalent-fraction factor while generating new valid examples.','Write 3/8; compare 1/3 and 1/5; order 2/8, 5/8, 7/8; 3/8 + 2/8; 2/3 = 4/6; simplify 4/8; 1/2 + 1/4 = 3/4.'],
 time:['Connect the hour hand and minute hand','P1 presets tell time to five minutes and practise half-hour / one-hour durations. P2 and P3 tell time to individual minutes. Set the clock lets pupils move separate hour and minute sliders, then enter the time. The short hand moves between hour marks as the minutes increase. Duration questions move forwards within one 12-hour cycle.','3:30; 3:15; 3:25; from 3:25 to 4:10 is 45 minutes. These diagrams do not assess a.m. / p.m. or the 24-hour clock.'],
 geometry:['Use the mathematical features','Choose a 2D shape, count its straight sides, or name a 3D solid. P3 also compares angles with a right angle and identifies parallel / perpendicular lines. The side-count task counts straight sides only; curves are not straight sides. Avoid relying on a shape’s colour or orientation.','A triangle has 3 straight sides. A semicircle has 1 straight side. Perpendicular lines meet at a right angle.'],
 area:['Separate inside squares from outside distance','This engine starts at P3. Set rectangle dimensions. Each small square represents 1 cm² and each edge 1 cm. Use Area, Perimeter or Same area, different perimeter. For the comparison task, both rectangles must have equal areas; their perimeters can differ.','6 cm × 4 cm: area 24 cm² and perimeter 20 cm. Compare with 8 cm × 3 cm: same area, perimeter 22 cm.'],
 graph:['Read the key before calculating','Enter exactly three category names and counts, separated by commas. Set what one picture or tick represents. Counts must be divisible by that key. P1 / P2 presets use picture graphs; P3 also offers bar graphs. Choose a category, total, or the difference between the first two categories.','Apples, Bananas, Pears with 12, 8, 16 and key 2: 6 apple pictures represent 12 apples.'],
 explain:['Build a mathematical explanation','Select an addition, equal-groups, fraction or perimeter context. Pupils choose three statement cards in model → operation → conclusion order. One card represents a misconception. Undo lets them revise their reasoning. This is a scaffold for discussion, not automatic grading of free writing.','There are 4 equal groups → each has 6 counters → 4 × 6 = 24.'],
 error:['Identify, explain and correct a misconception','Choose a believable place-value, addition, fraction, time or perimeter error. Pupils first select the reason the claim is wrong, then enter a corrected answer. Both must match. Ask pupils to justify the correction with the diagram. The chosen teacher numbers describe the correct mathematics; the engine constructs the wrong claim.','Read 34 as 43; count only unshaded parts in a fraction denominator; read 3:25 as 3:05; use area when asked for perimeter.'],
};
function guide(){const [title,steps,examples]=GUIDE[engine];$('guideContent').innerHTML=`<h3>${E(title)}</h3>${steps.split('\n\n').map(part=>`<p>${E(part)}</p>`).join('')}<p class="guide-note"><strong>Original classroom examples:</strong> ${E(examples)}</p>${engine==='place'?'<p>Interaction reference: <a href="https://limkimsze-maker.github.io/Place-Value-Chart-for-Counting/" target="_blank" rel="noreferrer">Lim Kim Sze’s Place Value Chart for Counting</a> and <a href="https://limkimsze-maker.github.io/P1-Hundred-Chart-and-Flip-Chart-More-Than-Less-Than/" target="_blank" rel="noreferrer">Hundred Chart and Flip Chart: More Than / Less Than</a>.</p>':''}${engine==='numberline'?'<p>Interaction reference: <a href="https://limkimsze-maker.github.io/P3_number_pattern/" target="_blank" rel="noreferrer">Lim Kim Sze’s P3 Number Pattern</a>.</p>':''}${engine==='operations'?'<h3>Pupil practice and teacher demonstration</h3><ol><li><strong>Addition and subtraction:</strong> press <strong>Next Step</strong> to follow the highlighted place and watch the pieces move, rename or cross out. The result digit appears with that same step. After all steps, enter the whole answer and press <strong>Check answer</strong>. A wrong whole answer can be retried. Pause before each step and ask pupils to predict what will happen.</li><li><strong>Multiplication:</strong> tap the highlighted answer box and enter one digit using the keyboard or number keypad. If a carry box is shown above the next column, fill it too. Press <strong>Check Digit</strong>. The current place advances only when both entries are correct. An empty or wrong carry stays on that place. The last check completes the product directly. <strong>Simple division grouping:</strong> type the current step’s value and check it.</li><li><strong>P3 division:</strong> follow the Animal Rescue layout. Enter one digit per highlighted box using the keyboard or the number keypad. Complete the quotient, product and next-number boxes for the current place, then press <strong>Check Step</strong>. The discs move from the bank into the matching group rows. Any leftover hundreds or tens become ten times as many smaller discs. Check Step advances one place at a time; the remainder is checked afterwards. Write 0 in the bottom remainder box if there is no remainder. Completed boxes are locked; future boxes wait until their place is highlighted.</li><li>In addition, ten smaller pieces are outlined before they become one larger piece in the next column. In subtraction, one larger piece becomes ten smaller pieces in the adjacent column. Watch the mat and the written regrouped or renamed amounts together.</li><li>Addition and subtraction reveal each result digit as its place is demonstrated. In multiplication, pupils fill the current result digit and outgoing carry together. Future result digits stay unknown. P3 division uses the highlighted quotient, product and next-number boxes.</li><li>For multiplication and P3 division, teachers can press <strong>Teacher: Next</strong> to reveal one step for demonstration. Addition and subtraction use <strong>Next Step</strong> in both views. In P3 division, this fills the current place’s boxes and demonstrates its sharing and exchange. Use <strong>Hide place-value mat</strong> when you want to focus on the written algorithm; showing it again keeps the working. This counts as help in the session summary. Pupil view hides this shortcut.</li><li><strong>Previous step</strong> revisits the working. <strong>Restart steps</strong> returns to the first model. These count as help; the question stays the same.</li><li>Addition and subtraction open a whole-answer check after the demonstrations. Multiplication finishes with its final digit check, as in Uncle Joe. P3 division finishes when the remainder boxes are checked, as in Animal Rescue. Ask pupils to explain why an exchange keeps the value the same.</li></ol><p>In multiplication, each dashed row starts with one copy of the number being multiplied. Future columns keep their rows of individual coloured discs. Completed columns show only the pieces left after regrouping. The carry slot shows pieces moved into the next place; they are added once and disappear from that slot when used. Use <strong>Hide place-value mat</strong> to focus on the written algorithm; show it again without losing entries.</p><p>Interaction references: Lim Kim Sze’s <a href="https://limkimsze-maker.github.io/P1_to_P3_Addition/" target="_blank" rel="noreferrer">addition mat</a>, <a href="https://limkimsze-maker.github.io/P1_to_P3_Subtraction/" target="_blank" rel="noreferrer">subtraction mat</a>, <a href="https://limkimsze-maker.github.io/P3-Uncle-Joe-and-the-Key-of-Product-desktop/" target="_blank" rel="noreferrer">Uncle Joe and the Key of Product</a> and <a href="https://limkimsze-maker.github.io/P3-Long-Division-3D-Animal-Rescue/" target="_blank" rel="noreferrer">Animal Rescue division guide</a>.</p>':''}<h3>Set up an activity</h3><ol><li>Choose the grade preset and task. Presets guide the starting point; follow your school’s scheme of work.</li><li>${engine==='place'&&config.task==='hundred'?'Set your starting number and two more/less amounts. This exploration option stays within 0–100.':'Choose <strong>Fixed numbers</strong> for one example using your exact values, or <strong>Random practice</strong> for 1–20 questions from grade preset ranges. In random mode, only the controls still shown remain fixed.'}</li><li>Press <strong>Generate activity</strong>. Check the preview, including units and question type.</li><li>Use <strong>Pupil view</strong> for a bigger model. In the toolkit, use Expand workspace to hide the engine tabs.</li><li>Model once, let pupils manipulate or inspect the model, and ask for an explanation before checking an answer.</li></ol><h3>Upload the activity to SLS</h3><ol><li>Set up your activity, then press <strong>Download activity</strong>.</li><li>A <strong>ZIP file</strong> will be downloaded. <strong>Do not unzip it.</strong></li><li>In SLS, add a question and choose <strong>Free-Response → Interactive Response</strong>.</li><li>Upload the ZIP file.</li><li>Set <strong>Maximum Marks</strong> to the same number as the questions in the activity. Example: 8 questions = 8 marks.</li><li>Save and assign the lesson as usual.</li></ol><p class="guide-note"><strong>Tell pupils:</strong> Complete the activity, then return to SLS and press <strong>Submit</strong>. This allows SLS to record the score and feedback. Pupils may use <strong>Practise again</strong> afterwards for extra practice.</p><h3>What is a downloaded activity?</h3><p>Download activity creates an SLS-ready ZIP package using the settings currently shown in the builder. Upload the ZIP directly to an SLS Interactive Response question. Do not unzip it first.</p><table><tr><th>Your choice</th><th>When opened or restarted</th></tr><tr><td>Fixed numbers</td><td>The same question and diagram values appear.</td></tr><tr><td>Random practice</td><td>The saved task, grade and visible settings stay the same. Fresh questions are generated within the grade preset ranges.</td></tr></table><p><strong>Is the activity the same regardless of when I download?</strong> If the engine version and settings are unchanged, you save the same type of activity. Fixed numbers give the same example. Random practice can produce different numbers each time, even in the same downloaded file. Changing the settings changes the saved activity.</p><p>Old downloaded files do not automatically update when the website improves. Download a fresh copy to get those improvements. The ZIP is intended for upload to SLS as an Interactive Response activity.</p><h3>Save settings and feedback</h3><p>Save settings downloads a JSON file containing the setup only. Load settings restores it in the matching engine. JSON is not a runnable activity and contains no pupil results. The session summary counts first-try answers, retries and hints; it is not a class report or a mastery grade. Settings are remembered on this browser when available.</p><h3>Textbook connection</h3><p>Choose the matching topic and enter the numbers from your lesson to create an original activity in the same mathematical style. No textbook pictures or question wording have been copied. Exact textbook-page alignment has not been verified. This is a toolkit of selected reusable tasks, not a complete P1–P3 course.</p><p>Reference: <a href="https://www.mceducation.com/primary/products/my-pals-are-here-maths-4th-edition" target="_blank" rel="noreferrer">My Pals Are Here! Maths publisher description</a>. Check the <a href="https://www.moe.gov.sg/media/files/primary/92bff26d-b2b4-4535-b868-b8415c744b91.pdf" target="_blank" rel="noreferrer">MOE syllabus</a> and your school’s lesson sequence. Grade ranges are teaching presets; not every syllabus objective is covered.</p><p class="guide-note">Created by Lim Kim Sze</p>`;}
function addMoneyGuideReferences(){if(engine!=='money')return;const note=document.createElement('p');note.className='guide-note';note.innerHTML='<strong>Projection cue:</strong> each $1 coin has a dark individual outline. Regrouping and borrowing move slowly; the newly renamed coin or note then glows gold so pupils can identify what changed.';const p=document.createElement('p');p.innerHTML='Interaction references: <a href="https://limkimsze-maker.github.io/P2_Counting_Money/" target="_blank" rel="noreferrer">Counting Money</a>, <a href="https://limkimsze-maker.github.io/P2_Money_Conversion/" target="_blank" rel="noreferrer">Money Conversion</a>, <a href="https://limkimsze-maker.github.io/P3_Saving_Quest_Making_Money_Up_To_100/" target="_blank" rel="noreferrer">Saving Quest</a>, <a href="https://limkimsze-maker.github.io/P1_to_P3_Adding_Money/" target="_blank" rel="noreferrer">Adding Money</a>, <a href="https://limkimsze-maker.github.io/P1_to_P3_Subtracting_Money/" target="_blank" rel="noreferrer">Subtracting Money</a> and <a href="https://limkimsze-maker.github.io/P3_Money_Word_Problems/" target="_blank" rel="noreferrer">Money Word Problems</a>.';const setup=[...$('guideContent').querySelectorAll('h3')].find(h=>h.textContent==='Set up an activity');setup?.before(note,p);}
function addFractionGuideReference(){if(engine!=='fraction')return;const p=document.createElement('p');p.innerHTML='Interaction reference: <a href="https://limkimsze-maker.github.io/P2-P3-Space-Max-and-the-Lost-Fraction-Rocket-Parts/" target="_blank" rel="noreferrer">Space Max and the Lost Fraction Rocket Parts</a>. The topic order and teaching sequence are adapted from Lim Kim Sze’s own interactives.';const setup=[...$('guideContent').querySelectorAll('h3')].find(h=>h.textContent==='Set up an activity');setup?.before(p);}
function addPlaceGuideNote(){if(engine!=='place')return;const p=document.createElement('p');p.className='guide-note';p.innerHTML='<strong>Starting display:</strong> the place-value cards are placed together first to show the complete number. Press <strong>Put Apart</strong> to separate them into expanded place values. Whenever ten pieces are regrouped, the new disc or base-ten block glows gold so pupils can identify what changed.';$('guideContent').querySelector('h3')?.after(p);}
function addOperationsGuideNote(){if(engine!=='operations')return;const p=document.createElement('p');p.className='guide-note';p.innerHTML='<strong>Regrouping cue:</strong> movement is deliberately slow. The newly regrouped place-value disc or base-ten block glows gold after it arrives, so pause and ask pupils what its value is.';$('guideContent').querySelector('h3')?.after(p);}
$('guideButton').onclick=()=>{guide();addMoneyGuideReferences();addFractionGuideReference();addPlaceGuideNote();addOperationsGuideNote();$('guide').showModal();};$('closeGuide').onclick=()=>$('guide').close();
$('engineTitle').textContent=ENGINE_NAMES[engine]+' Engine';document.title=ENGINE_NAMES[engine]+' Teaching Engine';populate(config);setPresets();start(config);if(saved)pupil(true);
// Same public actions as the interface; no pupil accounts or remote result storage.
window.engineAPI={getState:()=>({engine,config:{...config},question:current.question,lesson:structuredClone(current),index,solved,results:[...results],interaction:structuredClone(interaction)}),configure:input=>{const c=validate(input);if(c.engine!==engine)throw Error('Select the matching engine first.');populate(c);start(c);setPresets();return {engine,config:c};},pupil};
if(document.modelContext?.registerTool){const lifecycle=new AbortController();const ts=[{name:'read_engine_activity',description:'Read the selected engine settings and current question.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({engine,config:{...config},question:current.question,index:index+1})},{name:'configure_engine_activity',description:'Apply and generate a teacher-configured activity in the current engine.',inputSchema:{type:'object',properties:{settings:{type:'object'}},required:['settings'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>window.engineAPI.configure(input.settings)}];for(const t of ts){try{Promise.resolve(document.modelContext.registerTool(t,{signal:lifecycle.signal})).catch(()=>{});}catch{}}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
