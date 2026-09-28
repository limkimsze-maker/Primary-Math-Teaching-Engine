"use client";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowUpRight, Check, Maximize2, Minimize2, BookOpen, Blocks } from "lucide-react";
const engines = [
  ["place", "Place value"], ["operations", "Operations & grouping"], ["numberline", "Number line"],
  ["bar", "Bar models"], ["money", "Money"], ["fraction", "Fractions"], ["time", "Time"],
  ["length", "Length"], ["mass", "Mass"], ["volume", "Volume"], ["geometry", "Shapes, angles & lines"],
  ["area", "Area & perimeter"], ["graph", "Graphs"], ["explain", "Explain your thinking"], ["error", "Error analysis"],
];
function srcFor(id: string) { return ["length", "mass", "volume"].includes(id) ? `/measurement/${id}.html` : `/engines.html?engine=${id}`; }
export default function Home() {
  const [active, setActive] = useState("place");
  const [focus, setFocus] = useState(false);
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("engine"); if (engines.some(e => e[0] === id)) setActive(id!); }, []);
  function choose(id: string) { setActive(id); window.history.replaceState(null, "", `?engine=${id}`); }
  useEffect(() => {
    const ctx = (document as Document & {modelContext?: {registerTool: (tool: unknown, opts?: unknown) => unknown}}).modelContext;
    if (!ctx?.registerTool) return;
    const life = new AbortController();
    const ts = [
      {name:"list_teaching_engines",description:"Read the available engines and selected tab.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({engines:engines.map(e=>({id:e[0],name:e[1]})),selected:active})},
      {name:"select_teaching_engine",description:"Open an engine tab in the visible toolkit.",inputSchema:{type:"object",properties:{engine:{type:"string",enum:engines.map(e=>e[0])}},required:["engine"],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input:unknown)=>{const id=(input as {engine?:string})?.engine;if(!id||!engines.some(e=>e[0]===id))throw new Error("Choose an available engine.");choose(id);return {selected:id};}},
    ];
    for (const tool of ts) { try { void Promise.resolve(ctx.registerTool(tool, {signal:life.signal})).catch(()=>{}); } catch {} }
    return ()=>life.abort();
  }, [active]);
  const name = engines.find(e=>e[0]===active)![1];
  return <main className={`toolkit ${focus ? "focus-mode" : ""}`}>
    <header className="hub-header">
      <div className="hub-brand"><div className="brand-icon"><Blocks size={24}/></div><div><p>INTERACTIVE TEACHING ENGINES</p><h1>Primary Maths Studio <span>P1–P3</span></h1></div></div>
      <div className="hub-actions">
        <Dialog><DialogTrigger asChild><Button variant="outline" size="sm"><BookOpen size={16}/> Toolkit guide</Button></DialogTrigger>
          <DialogContent className="hub-guide"><DialogHeader><DialogTitle>One toolkit. A tab for each engine.</DialogTitle></DialogHeader>
            <p>Choose a tab. Use its teacher settings to select a task, numbers and number of questions. Generate the activity, check the preview, and switch to Pupil view. “Expand workspace” gives you the biggest display.</p>
            <h3>What does “Download activity” mean?</h3><p>It prepares an <strong>SLS-ready ZIP</strong> using your current settings. The ZIP contains the interactive <strong>index.html</strong> together with the SLS xAPI files needed for scoring and feedback. It is an interactive activity, not a PDF worksheet or a screenshot.</p><h3>Upload to SLS</h3><p>For a scored xAPI activity, add a <strong>Free-Response → Interactive Response</strong> question in SLS and upload the SLS-ready ZIP. Keep <strong>index.html</strong> at the ZIP root and set SLS Maximum Marks to the value shown by the engine. Preview the activity before assigning it. Each question is scored on its first submitted answer; retries can provide further feedback but do not replace the score already recorded for that question. See the <a href="https://www.learning.moe.edu.sg/teachers/teacher-user-guide/author/html5-content-development/" target="_blank" rel="noreferrer">official SLS HTML5 guide</a>.</p>
            <p><strong>The settings stay the same. The questions depend on your choice.</strong> Fixed-number activities keep the same question when reopened. Random practice creates new questions within your saved settings when opened or restarted. Two downloads with the same random settings can give different questions.</p>
            <p>Previously downloaded ZIPs do not receive later website improvements. Download a fresh ZIP after an update. “Save settings” saves a JSON setup file; it is not a runnable activity and contains no pupil results.</p>
            <h3>Teach with it</h3><p>Model an example together. Let pupils move, shade or count the diagrams. Ask them to explain the relationship before entering an answer. Use hints and retries for discussion. A summary describes this practice session; it is not a mastery grade or a class report.</p>
            <h3>Topic coverage and textbooks</h3><p>The 15 engines cover reusable activity types for P1–P3 number, measurement, geometry, data and reasoning. They are teaching tools, not a complete course or an official MOE resource. Grade presets are starting points; follow your school’s scheme of work. Every new question and diagram is original. Match a textbook topic and enter similar numbers without copying its artwork or wording.</p>
            <p>The <a href="https://www.moe.gov.sg/media/files/primary/92bff26d-b2b4-4535-b868-b8415c744b91.pdf" target="_blank" rel="noreferrer">MOE subjects and syllabuses page</a> is the curriculum reference. <a href="https://www.mceducation.com/primary/products/my-pals-are-here-maths-4th-edition" target="_blank" rel="noreferrer">My Pals Are Here! Maths publisher information</a> describes visual and concept-based teaching; exact textbook pages have not been reproduced.</p>
            <h3>Completion checklist</h3><p>This release includes all 15 engines. The website opens one engine workspace at a time. The 12 new engines passed 129 grade/task checks, 7,560 generated-question checks and 105 configured HTML checks. The guided operations passed 509 sequences, 2,124 teaching steps and 749 value-preserving exchanges. Pupil walkthroughs covered addition, subtraction across zeros, multiplication carries and division with an internal zero and remainder. Desktop workflows were checked in the browser. Phone layouts and actual SLS uploading still need classroom testing.</p><table className="completion-table"><thead><tr><th>Engine</th><th>Release</th></tr></thead><tbody>{engines.map(([id,label])=><tr key={id}><td>{label}</td><td>✓ Included</td></tr>)}</tbody></table><p>SLS ZIP structure, score/feedback hooks and JSON settings responses have been checked in the code. Preview a freshly downloaded ZIP in SLS before assigning it to pupils.</p><p className="guide-credit">Created by Lim Kim Sze</p>
          </DialogContent>
        </Dialog>
        <Button variant="outline" size="sm" onClick={()=>setFocus(!focus)}>{focus?<Minimize2 size={16}/>:<Maximize2 size={16}/>}<span>{focus?"Show engine tabs":"Expand workspace"}</span></Button>
      </div>
    </header>
    <Tabs orientation="vertical" value={active} onValueChange={choose} className="hub-body">
      <aside className="engine-rail"><div className="rail-title"><span>YOUR ENGINES</span><span className="engine-count">15</span></div>
        <TabsList className="engine-tabs" aria-label="Teaching engines">{engines.map(([id,label],i)=><TabsTrigger key={id} value={id} className="engine-tab"><span className="tab-number">{String(i+1).padStart(2,"0")}</span><span>{label}</span><ArrowUpRight size={13} className="tab-arrow"/></TabsTrigger>)}</TabsList>
        <div className="rail-note"><Check size={16}/><span>Original diagrams<br/>Offline activity downloads</span></div>
      </aside>
      <div className="workspace-frame"><div className="workspace-heading"><span>{name}</span><span>Set up · explore · explain</span></div>
        {engines.map(([id,label])=><TabsContent key={id} value={id} className="engine-content"><iframe src={srcFor(id)} title={`${label} teaching engine`} className="engine-frame"/></TabsContent>)}
      </div>
    </Tabs>
    <footer className="hub-footer"><strong>Created by Lim Kim Sze</strong><span>Built for classroom understanding</span></footer>
  </main>;
}
