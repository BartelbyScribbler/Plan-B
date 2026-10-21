"use strict";

const KEY = "plan-b-data-v1";
const DRAFT_KEY = "plan-b-draft-v1";
const DEFAULT_EXERCISES = [
  {id:"pushup",name:"Push-up / incline push-up",target:"6–12",weight:0,cue:"Keep a straight body line. Use a countertop or wall if floor push-ups are too difficult."},
  {id:"row",name:"One-arm dumbbell row",target:"10–15 / side",weight:20,cue:"Support your free hand, hinge at the hips, pull your elbow toward your back pocket. No twisting."},
  {id:"split-squat",name:"Split squat",target:"8–12 / side",weight:0,cue:"Keep balance with a support as needed. Lower under control, then push through the front foot."},
  {id:"rdl",name:"Single-leg Romanian deadlift",target:"8–12 / side",weight:0,cue:"Hinge from the hip with a soft knee, keep your back neutral, use a support for balance."},
  {id:"press",name:"One-arm overhead press",target:"8–12 / side",weight:0,cue:"Brace your midsection; press only through a comfortable range. Use a lighter object if 20 lb is too much."},
  {id:"curl",name:"Dumbbell curl",target:"10–15 / side",weight:0,cue:"Elbows mostly still, no swinging. Use a lighter object if you cannot control 20 lb."}
];
const HABITS = [
  {id:"protein",name:"Protein at meals",detail:"A protein source with each main meal"},
  {id:"walk",name:"Move a little",detail:"Walk or do easy cardio for about 20 minutes"},
  {id:"sleep",name:"Protect sleep",detail:"Give yourself a real chance at 7+ hours"}
];
const $ = (id) => document.getElementById(id);
const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const numberOrNull = (v) => v === "" || v === null || v === undefined ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
const uid = () => String(Date.now()) + "-" + Math.random().toString(36).slice(2,9);
const localDay = (d = new Date()) => [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const localDate = (day) => new Date(day + "T12:00:00");
const humanDate = (day, opts = {month:"short",day:"numeric"}) => {
  const d = localDate(day);
  return Number.isNaN(d.getTime()) ? String(day) : d.toLocaleDateString(undefined,opts);
};
const weekStart = (day) => {
  const d = typeof day === "string" ? localDate(day) : new Date(day);
  d.setHours(12,0,0,0);
  d.setDate(d.getDate() - ((d.getDay()+6)%7));
  return localDay(d);
};
function readJSON(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; }
  catch { return fallback; }
}
const stored = readJSON(KEY, {});
let state = {
  sessions:Array.isArray(stored.sessions) ? stored.sessions : [],
  measurements:Array.isArray(stored.measurements) ? stored.measurements : [],
  habits:stored.habits && typeof stored.habits === "object" && !Array.isArray(stored.habits) ? stored.habits : {},
  customExercises:Array.isArray(stored.customExercises) ? stored.customExercises : []
};
const loadedDraft = readJSON(DRAFT_KEY, {});
let draft = {started:loadedDraft.started || new Date().toISOString(),sets:Array.isArray(loadedDraft.sets) ? loadedDraft.sets : [],note:typeof loadedDraft.note === "string" ? loadedDraft.note : ""};
let activeMetric = "waist";
let toastTimer;
const exercises = () => DEFAULT_EXERCISES.concat(state.customExercises.filter(e => e && e.id && e.name));
const exById = (id) => exercises().find(e => e.id === id);
const exName = (set) => set.name || (exById(set.exerciseId) || {}).name || "Exercise";
const sortedSessions = () => state.sessions.filter(s => s && Array.isArray(s.sets)).slice().sort((a,b) => String(b.at || b.date).localeCompare(String(a.at || a.date)));
const sortedMeasurements = () => state.measurements.filter(m => m && typeof m.date === "string").slice().sort((a,b) => a.date.localeCompare(b.date));
function toast(message) {
  const t = $("toast");
  t.textContent = message;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2900);
}
function saveState() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch { toast("Storage unavailable. Export a backup."); return false; }
}
function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); return true; }
  catch { toast("Could not save workout draft."); return false; }
}
function navigate(view) {
  document.querySelectorAll(".view").forEach(el => el.classList.toggle("active", el.id === "view-"+view));
  document.querySelectorAll(".tab").forEach(el => {
    const active = el.dataset.nav === view;
    el.classList.toggle("active", active);
    if (active) el.setAttribute("aria-current","page");
    else el.removeAttribute("aria-current");
  });
  window.scrollTo({top:0,behavior:"instant"});
}
function formatValue(n, digits=1) { return n === null || n === undefined ? "—" : Number(n).toFixed(digits).replace(/\.0$/,""); }
function weeklyData() {
  const now = localDate(weekStart(new Date()));
  return Array.from({length:8},(_,i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (7-i)*7);
    const key = localDay(d);
    return {week:key, count:state.sessions.filter(s => s && s.date && weekStart(s.date) === key).length};
  });
}
function renderStats() {
  const weekly = weeklyData();
  const last = sortedMeasurements().at(-1);
  const stats = [
    {label:"This week",value:weekly.at(-1).count+"/3",detail:"Strength sessions"},
    {label:"Sessions",value:state.sessions.length,detail:"All-time logged"},
    {label:"Latest waist",value:last && last.waist != null ? formatValue(last.waist)+"″":"—",detail:"Measured at navel"},
    {label:"Latest weight",value:last && last.weight != null ? formatValue(last.weight)+" lb":"—",detail:"Scale is only one signal"}
  ];
  $("stats").innerHTML = stats.map(s => `<div class="stat"><div class="stat-label">${escapeHTML(s.label)}</div><div class="stat-number">${escapeHTML(s.value)}</div><div class="stat-caption">${escapeHTML(s.detail)}</div></div>`).join("");
}
function renderWeeklyChart() {
  const weeks = weeklyData();
  const max = Math.max(4,...weeks.map(w=>w.count));
  const w=640,h=164, baseline=129, chartHeight=105, barWidth=44, gap=32;
  const grid = [0,1,2,3].map(n => {
    const y = baseline - (n/max)*chartHeight;
    return `<line x1="30" x2="637" y1="${y}" y2="${y}" stroke="#3b4e57" stroke-width="1" ${n===3?'stroke-dasharray="4 4"':''}/><text x="20" y="${y+4}" fill="#9bb0b9" font-size="12" text-anchor="end">${n}</text>`;
  }).join("");
  const bars = weeks.map((v,i) => {
    const x=49+i*(barWidth+gap), ht=v.count/max*chartHeight, y=baseline-ht;
    return `<rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(1,ht)}" rx="6" fill="${i===7?'#b5eb72':'#537f78'}"/><text x="${x+barWidth/2}" y="${Math.max(13,y-5)}" fill="#d9e7e0" font-size="13" font-weight="700" text-anchor="middle">${v.count||""}</text><text x="${x+barWidth/2}" y="152" fill="#a1b1b9" font-size="12" text-anchor="middle">${humanDate(v.week,{month:"short",day:"numeric"})}</text>`;
  }).join("");
  $("weekly-chart").innerHTML = `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Workouts per week for the last eight weeks">${grid}${bars}</svg>`;
}
function renderHabits() {
  const day = state.habits[localDay()] || {};
  $("habits").innerHTML = HABITS.map(h => `<label class="habit"><input type="checkbox" data-habit="${h.id}" ${day[h.id]?"checked":""}><span><strong>${escapeHTML(h.name)}</strong><small>${escapeHTML(h.detail)}</small></span></label>`).join("");
}
function previousSet(id) {
  const current = draft.sets.filter(s => s.exerciseId === id).at(-1);
  if (current) return current;
  for (const session of sortedSessions()) {
    const result = session.sets.filter(s => s.exerciseId === id).at(-1);
    if (result) return result;
  }
  return null;
}
function renderWorkout() {
  $("exercise-list").innerHTML = exercises().map(e => {
    const logged = draft.sets.filter(s => s.exerciseId === e.id);
    const prev = previousSet(e.id);
    const reps = prev ? prev.reps : "";
    const weight = prev ? prev.weight : e.weight || 0;
    return `<article class="exercise">
      <div class="ex-head"><div><h3>${escapeHTML(e.name)}</h3></div><span class="target">${escapeHTML(e.target || "6–12")} reps</span></div>
      <p>${escapeHTML(e.cue || "Use a controlled tempo and a comfortable range of motion.")}</p>
      <div class="inputs">
        <label class="field">Reps / side*<input id="reps-${escapeHTML(e.id)}" type="number" inputmode="numeric" min="1" max="100" step="1" value="${escapeHTML(reps)}" placeholder="10" aria-label="Repetitions for ${escapeHTML(e.name)}"></label>
        <label class="field">Weight, lb<input id="weight-${escapeHTML(e.id)}" type="number" inputmode="decimal" min="0" max="2000" step=".5" value="${escapeHTML(weight)}" aria-label="Weight for ${escapeHTML(e.name)}"></label>
        <button class="btn" data-action="add-set" data-ex="${escapeHTML(e.id)}">+ Set</button>
      </div>
      <div class="sets">${logged.map((set,i) => `<span class="set-pill">#${i+1} · ${escapeHTML(set.reps)} × ${escapeHTML(set.weight ? formatValue(set.weight)+" lb":"BW")}<button type="button" data-action="remove-set" data-id="${escapeHTML(set.id)}" aria-label="Remove logged set">×</button></span>`).join("")}</div>
    </article>`;
  }).join("");
  $("session-note").value = draft.note;
  const n = draft.sets.length;
  const movements = new Set(draft.sets.map(s=>s.exerciseId)).size;
  $("draft-status").textContent = n ? `${n} set${n===1?"":"s"} logged across ${movements} exercise${movements===1?"":"s"}. Draft autosaved.` : "Nothing logged yet. Log your first set above.";
  $("finish-workout").disabled = n===0;
  $("discard-workout").disabled = n===0 && !draft.note;
}
function renderMeasurementChart() {
  const label = {weight:"Weight (lb)",waist:"Waist (in)",chest:"Chest (in)",arm:"Upper arm (in)"}[activeMetric];
  const points = sortedMeasurements().filter(m => typeof m[activeMetric] === "number" && Number.isFinite(m[activeMetric])).slice(-12);
  if (!points.length) {
    $("measure-chart").innerHTML = `<div class="chart-empty">Log a check-in to see your ${escapeHTML(label.toLowerCase())} trend.</div>`;
    return;
  }
  const minValue=Math.min(...points.map(p=>p[activeMetric])), maxValue=Math.max(...points.map(p=>p[activeMetric]));
  const spread=Math.max(1,(maxValue-minValue)*1.4), mid=(maxValue+minValue)/2;
  const min=mid-spread/2,max=mid+spread/2;
  const left=49,right=610,top=27,bottom=160;
  const xy=points.map((p,i) => ({
    x:points.length===1?(left+right)/2:left+i*(right-left)/(points.length-1),
    y:bottom-(p[activeMetric]-min)/(max-min)*(bottom-top),
    date:p.date,value:p[activeMetric]
  }));
  const guides=[0,1,2,3].map(i=>{
    const y=top+(bottom-top)*i/3, v=max-i*(max-min)/3;
    return `<line x1="${left}" x2="625" y1="${y}" y2="${y}" stroke="#344753" stroke-width="1"/><text x="43" y="${y+4}" text-anchor="end" font-size="12" fill="#a1b3ba">${formatValue(v)}</text>`;
  }).join("");
  const path=xy.map(p => `${p.x},${p.y}`).join(" ");
  const dots=xy.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="5.4" fill="#b5eb72" stroke="#183323" stroke-width="2"><title>${escapeHTML(humanDate(p.date))}: ${p.value}</title></circle>`).join("");
  const first=points[0].date,last=points.at(-1).date;
  $("measure-chart").innerHTML=`<svg class="chart-svg" viewBox="0 0 640 201" role="img" aria-label="${escapeHTML(label)} across ${points.length} check-ins">${guides}<polyline points="${path}" stroke="#b5eb72" fill="none" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${dots}<text x="${left}" y="187" font-size="12" fill="#a1b3ba">${escapeHTML(humanDate(first))}</text><text x="${right}" y="187" font-size="12" text-anchor="end" fill="#a1b3ba">${escapeHTML(humanDate(last))}</text></svg>`;
}
function renderMeasurementHistory() {
  const measurements=sortedMeasurements().reverse().slice(0,15);
  $("measurement-history").innerHTML=measurements.length? measurements.map(m => {
    const parts = [["weight","lb"],["waist","in waist"],["chest","in chest"],["arm","in arm"],["sleep","h sleep"]].filter(([k])=>m[k]!=null).map(([k,u])=>formatValue(m[k])+" "+u);
    if(m.energy!=null)parts.push("energy "+m.energy+"/5");
    return `<article class="history-item"><div class="history-title"><strong>${escapeHTML(humanDate(m.date,{month:"short",day:"numeric",year:"numeric"}))}</strong><button class="btn small ghost" data-action="delete-measure" data-id="${escapeHTML(m.id)}">Delete</button></div><p>${escapeHTML(parts.join(" · ") || "Empty check-in")}</p></article>`;
  }).join("") : '<div class="empty">No measurements yet. One check-in a week is a great start.</div>';
}
function renderWorkoutHistory() {
  const sessions=sortedSessions().slice(0,30);
  $("workout-history").innerHTML=sessions.length ? sessions.map(s=>{
    const groups=new Map();
    s.sets.forEach(set=>{
      const name=exName(set);
      if(!groups.has(name))groups.set(name,[]);
      groups.get(name).push(`${formatValue(set.weight)} lb × ${set.reps}`);
    });
    const detail=[...groups].map(([n,sets])=>`${n}: ${sets.join(", ")}`).join(" • ");
    return `<article class="history-item"><div class="history-title"><strong>${escapeHTML(humanDate(s.date,{month:"short",day:"numeric",year:"numeric"}))} · ${s.sets.length} sets</strong><button class="btn small ghost" data-action="delete-session" data-id="${escapeHTML(s.id)}">Delete</button></div><p>${escapeHTML(detail)}</p>${s.note?`<div class="note tiny" style="margin-top:10px">${escapeHTML(s.note)}</div>`:""}</article>`;
  }).join("") : '<div class="empty">Your workout history starts with your first saved session.</div>';
}
function renderAll() {
  $("today").textContent=new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
  $("measure-date").value=localDay();
  renderStats(); renderWeeklyChart(); renderHabits(); renderWorkout(); renderMeasurementChart(); renderMeasurementHistory(); renderWorkoutHistory();
}
function addSet(id) {
  const e=exById(id);
  if(!e)return;
  const reps=numberOrNull($("reps-"+id)?.value), weight=numberOrNull($("weight-"+id)?.value);
  if(reps===null || !Number.isInteger(reps) || reps<1 || reps>100){toast("Enter 1–100 repetitions.");return;}
  if(weight===null || weight<0 || weight>2000){toast("Enter a valid weight (0 means bodyweight).");return;}
  draft.sets.push({id:uid(),exerciseId:id,name:e.name,reps,weight});
  saveDraft();renderWorkout();toast(e.name+": set logged");
}
function saveWorkout() {
  if(!draft.sets.length){toast("Log at least one set first.");return;}
  const now=new Date();
  state.sessions.push({id:uid(),date:localDay(now),at:now.toISOString(),sets:draft.sets.slice(),note:draft.note});
  if(!saveState()){state.sessions.pop();return;}
  draft={started:now.toISOString(),sets:[],note:""};
  saveDraft();renderAll();navigate("home");toast("Workout saved. Nice work.");
}
function saveMeasure(form) {
  const data=new FormData(form),date=String(data.get("date")||"");
  const values={};
  for(const k of ["weight","waist","chest","arm","sleep","energy"])values[k]=numberOrNull(data.get(k));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){toast("Choose a valid date.");return;}
  if(Object.values(values).every(v=>v===null)){toast("Enter at least one measurement.");return;}
  const existing=state.measurements.findIndex(m=>m.date===date);
  const m={id:existing>=0?state.measurements[existing].id:uid(),date,...values};
  const backup=state.measurements.slice();
  if(existing>=0)state.measurements[existing]=m;else state.measurements.push(m);
  if(!saveState()){state.measurements=backup;return;}
  form.reset();renderAll();toast(existing>=0?"Check-in updated.":"Check-in saved.");
}
function addExercise(form) {
  const d=new FormData(form);
  const name=String(d.get("name")||"").trim(),target=String(d.get("target")||"6–12").trim();
  const weight=numberOrNull(d.get("weight")) ?? 0;
  if(!name || weight<0 || weight>2000){toast("Enter a valid exercise.");return;}
  state.customExercises.push({id:"custom-"+uid().replace(/[^a-z0-9-]/gi,""),name:name.slice(0,80),target:target.slice(0,25)||"6–12",weight,cue:"Use controlled technique. Enter repetitions for each set."});
  if(!saveState()){state.customExercises.pop();return;}
  form.reset();renderWorkout();toast("Exercise added to routine.");
}
function downloadBackup() {
  const obj={app:"Plan B",version:1,exportedAt:new Date().toISOString(),data:state};
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="plan-b-backup-"+localDay()+".json";
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast("Backup exported. Keep it somewhere safe.");
}
function importBackup(file) {
  if(!file)return;
  if(file.size>5_000_000){toast("Backup file is too large.");return;}
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(String(reader.result)), incoming=parsed.data || parsed;
      if(!Array.isArray(incoming.sessions)||!Array.isArray(incoming.measurements)||!incoming.habits||typeof incoming.habits!=="object")throw Error("Not a Plan B backup.");
      if(incoming.sessions.length>10000||incoming.measurements.length>10000)throw Error("Too many records.");
      if(!incoming.sessions.every(s=>s&&Array.isArray(s.sets)&&typeof s.date==="string")||!incoming.measurements.every(m=>m&&typeof m.date==="string"))throw Error("Invalid records.");
      if(!confirm("Replace all workout, measurement, and habit records stored on this device with this backup? Export your current data first if you want to keep it."))return;
      const prev=state;
      state={sessions:incoming.sessions,measurements:incoming.measurements,habits:incoming.habits,customExercises:Array.isArray(incoming.customExercises)?incoming.customExercises:[]};
      if(!saveState()){state=prev;return;}
      renderAll();toast("Backup imported.");
    }catch(err){toast("Import failed: "+String(err.message||err));}
    finally{$("import-data").value="";}
  };
  reader.onerror=()=>toast("Could not read the backup file.");
  reader.readAsText(file);
}
document.addEventListener("click",e=>{
  const nav=e.target.closest("[data-nav]");
  if(nav){navigate(nav.dataset.nav);return;}
  const action=e.target.closest("[data-action]");
  if(!action)return;
  const id=action.dataset.id;
  switch(action.dataset.action){
    case "add-set":addSet(action.dataset.ex);break;
    case "remove-set":draft.sets=draft.sets.filter(s=>s.id!==id);saveDraft();renderWorkout();break;
    case "delete-session":
      if(confirm("Permanently delete this workout from this device?")){
        state.sessions=state.sessions.filter(s=>s.id!==id);saveState();renderAll();toast("Workout deleted.");
      }break;
    case "delete-measure":
      if(confirm("Permanently delete this check-in from this device?")){
        state.measurements=state.measurements.filter(m=>m.id!==id);saveState();renderAll();toast("Check-in deleted.");
      }break;
  }
});
document.addEventListener("change",e=>{
  if(e.target.matches("[data-habit]")){
    const day=localDay(),key=e.target.dataset.habit;
    if(!state.habits[day])state.habits[day]={};
    state.habits[day][key]=e.target.checked;
    saveState();
  }
  if(e.target.id==="metric-select"){activeMetric=e.target.value;renderMeasurementChart();}
});
$("session-note").addEventListener("input",e=>{draft.note=e.target.value;saveDraft();});
$("finish-workout").addEventListener("click",saveWorkout);
$("discard-workout").addEventListener("click",()=>{
  if(!draft.sets.length && !draft.note)return;
  if(confirm("Discard the entire unfinished workout?")){
    draft={started:new Date().toISOString(),sets:[],note:""};
    saveDraft();renderWorkout();toast("Draft discarded.");
  }
});
$("measure-form").addEventListener("submit",e=>{e.preventDefault();saveMeasure(e.currentTarget);});
$("add-exercise-form").addEventListener("submit",e=>{e.preventDefault();addExercise(e.currentTarget);});
$("export-data").addEventListener("click",downloadBackup);
$("import-data").addEventListener("change",e=>importBackup(e.target.files[0]));
renderAll();
