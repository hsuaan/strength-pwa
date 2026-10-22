(() => {
  if (window.__strengthFiveDayV16) return;
  window.__strengthFiveDayV16 = true;

  const VERSION = "1.6";
  const AUX_KEYS = new Set(["U","L"]);
  const ALL_KEYS = new Set(["A","B","U","L"]);

  const cloneEx = (src, id, extra={}) => ({
    ...src,
    id,
    auxSourceId: src.id,
    ...extra
  });

  const findBase = id => {
    for (const w of Object.values(baseWorkouts)) {
      const x = w.exercises.find(e=>e.id===id);
      if (x) return x;
    }
    return null;
  };
  const findBW = id => {
    for (const w of Object.values(bodyweightWorkouts)) {
      const x = w.exercises.find(e=>e.id===id);
      if (x) return x;
    }
    return null;
  };

  // 兩個短版輔助日。使用獨立 ID，不會和 Full Body A/B 的主進度混在一起。
  baseWorkouts.U = {
    name:"手臂＋核心｜短版",
    duration:"15–25 分",
    exercises:[
      cloneEx(findBase("curl"),"aux_curl",{weight:3,target:8,sets:2}),
      cloneEx(findBase("triceps"),"aux_triceps",{weight:3,target:8,sets:2}),
      cloneEx(findBase("deadbug"),"aux_deadbug",{target:8,sets:2}),
      cloneEx(findBase("sideplank"),"aux_sideplank",{target:20,sets:2})
    ]
  };
  baseWorkouts.L = {
    name:"腿＋核心｜短版",
    duration:"15–25 分",
    exercises:[
      cloneEx(findBase("lunge"),"aux_lunge",{target:8,sets:2}),
      cloneEx(findBase("calf"),"aux_calf",{target:15,sets:2}),
      cloneEx(findBase("deadbug"),"aux_deadbug_l",{target:8,sets:2}),
      cloneEx(findBase("sideplank"),"aux_sideplank_l",{target:20,sets:2})
    ]
  };

  bodyweightWorkouts.U = {
    name:"上半身＋核心｜徒手短版",
    duration:"15–25 分",
    exercises:[
      cloneEx(findBW("bw_triceps"),"aux_bw_triceps",{target:5,sets:2}),
      cloneEx(findBW("bw_back"),"aux_bw_back",{target:8,sets:2}),
      cloneEx(findBW("bw_deadbug"),"aux_bw_deadbug",{target:6,sets:2}),
      cloneEx(findBW("bw_sideplank"),"aux_bw_sideplank",{target:20,sets:2})
    ]
  };
  bodyweightWorkouts.L = {
    name:"腿＋核心｜徒手短版",
    duration:"15–25 分",
    exercises:[
      cloneEx(findBW("bw_squat"),"aux_bw_squat",{target:10,sets:2}),
      cloneEx(findBW("bw_calf"),"aux_bw_calf",{target:12,sets:2}),
      cloneEx(findBW("bw_deadbug"),"aux_bw_deadbug_l",{target:6,sets:2}),
      cloneEx(findBW("bw_sideplank"),"aux_bw_sideplank_l",{target:20,sets:2})
    ]
  };

  // 教學按鈕沿用原本動作教學。
  const originalTutorialKeyFor = tutorialKeyFor;
  tutorialKeyFor = function(ex){
    if(ex?.auxSourceId){
      return originalTutorialKeyFor({...ex,id:ex.auxSourceId});
    }
    return originalTutorialKeyFor(ex);
  };

  // 進行中訓練允許 U / L，讓 iPhone 鎖屏、滑掉再回來仍能恢復。
  activeSessionIsToday = function(s){
    return !!s &&
      s.date===dateKey() &&
      ALL_KEYS.has(s.workoutKey) &&
      ["dumbbell","bodyweight"].includes(s.mode);
  };

  makeActiveSessionPayload = function(){
    if(!currentWorkoutKey || !ALL_KEYS.has(currentWorkoutKey)) return null;
    return {
      version:3,
      date:dateKey(),
      workoutKey:currentWorkoutKey,
      mode:settings.mode,
      activeIndex,
      sessionState,
      restEndsAt:restEndsAt||null,
      savedAt:new Date().toISOString()
    };
  };

  function mainTypeFromEntry(entry){
    const m=String(entry?.workout||"").match(/^Full Body\s+([AB])/);
    return m?m[1]:null;
  }
  function startOfDay(d){
    return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
  }
  function lastCompletedMainBefore(date){
    const cutoff=startOfDay(date);
    let best=null, bestT=-Infinity;
    for(const h of history||[]){
      const type=mainTypeFromEntry(h);
      if(!type) continue;
      const t=Date.parse(h.date);
      if(Number.isFinite(t) && t<cutoff && t>bestT){
        bestT=t; best=type;
      }
    }
    return best;
  }
  function dueMain(date){
    const prev=lastCompletedMainBefore(date);
    if(prev==="A") return "B";
    if(prev==="B") return "A";
    return settings.strengthAnchorType==="B"?"B":"A";
  }

  // 正式週節奏：5 個阻力訓練日 + 2 個完整休息日。
  weekly[0]={name:"星期一",type:"main",label:"Full Body A/B｜主訓練"};
  weekly[1]={name:"星期二",type:"U",label:"手臂＋核心｜短版"};
  weekly[2]={name:"星期三",type:"rest",label:"完整休息"};
  weekly[3]={name:"星期四",type:"main",label:"Full Body A/B｜主訓練"};
  weekly[4]={name:"星期五",type:"L",label:"腿＋核心｜短版"};
  weekly[5]={name:"星期六",type:"main",label:"Full Body A/B｜主訓練"};
  weekly[6]={name:"星期日",type:"rest",label:"完整休息"};

  planForDate = function(date){
    const p=weekly[localDay(date)];
    if(p.type==="main"){
      const type=dueMain(date);
      return {...p,type,label:`Full Body ${type}`};
    }
    return {...p};
  };
  getTodayPlan = function(){ return planForDate(new Date()); };

  function auxEntryOn(date,key){
    const set=settings.mode==="bodyweight"?bodyweightWorkouts:baseWorkouts;
    const name=set[key]?.name;
    return history.find(h=>sameLocalDay(h.date,date) && h.workout===name) || null;
  }

  // 「下一次重訓」包含短版日，不再跳過週二/週五。
  nextStrengthAfter = function(fromDate=new Date(),skipToday=false){
    for(let i=skipToday?1:0;i<=14;i++){
      const d=new Date(fromDate.getFullYear(),fromDate.getMonth(),fromDate.getDate()+i);
      const p=planForDate(d);
      if(["A","B","U","L"].includes(p.type)) return {date:d,plan:p};
    }
    return null;
  };

  function renderAuxComplete(entry,key){
    const next=nextStrengthAfter(new Date(),true);
    $("#todayTitle").textContent="今日已完成";
    $("#todayPill").textContent="✓ DONE";
    $("#todayContent").innerHTML=`
      <div class="card status-card">
        <div class="status-main">
          <div class="status-icon">✓</div>
          <div class="status-copy">
            <div class="kicker">SHORT SESSION COMPLETE</div>
            <h2>${entry.workout}</h2>
            <p>${modeLabel(entry.mode)}｜今天是短版輔助日，完成就夠了，不需要再補 Full Body。</p>
          </div>
        </div>
        ${nextWorkoutHTML(next)}
        <div class="status-actions">
          <button class="primary" id="todaySummaryBtn">查看／複製摘要</button>
          <button class="secondary" id="todayHistoryBtn">查看紀錄</button>
        </div>
      </div>`;
    $("#todaySummaryBtn").onclick=()=>showSummary(makeSummary(entry),"今天訓練摘要");
    $("#todayHistoryBtn").onclick=()=>activateTab("history");
  }

  const originalRenderToday=renderToday;
  renderToday=function(){
    const now=new Date();
    const pending=readActiveSession();

    // 若有正在進行的短版訓練，優先恢復它。
    if(activeSessionIsToday(pending) && AUX_KEYS.has(pending.workoutKey)){
      loadActiveSession(pending);
      renderedDateKey=dateKey(now);
      $("#todaySub").textContent=now.toLocaleDateString("zh-TW",{month:"long",day:"numeric",weekday:"long"});
      document.querySelectorAll(".mode-btn").forEach(b=>b.classList.toggle("active",b.dataset.mode===settings.mode));
      $("#todayTitle").textContent=currentWorkout().name;
      $("#todayPill").textContent=currentWorkout().duration;
      renderWorkout();
      return;
    }

    const plan=getTodayPlan();
    if(AUX_KEYS.has(plan.type)){
      currentWorkoutKey=plan.type;
      renderedDateKey=dateKey(now);
      $("#todaySub").textContent=now.toLocaleDateString("zh-TW",{month:"long",day:"numeric",weekday:"long"});
      document.querySelectorAll(".mode-btn").forEach(b=>b.classList.toggle("active",b.dataset.mode===settings.mode));

      const done=auxEntryOn(now,plan.type);
      if(done){
        renderAuxComplete(done,plan.type);
        return;
      }

      if(Object.keys(sessionState).length===0) restoreActiveSessionForCurrentWorkout();
      $("#todayTitle").textContent=currentWorkout().name;
      $("#todayPill").textContent=currentWorkout().duration;
      renderWorkout();
      return;
    }

    originalRenderToday();
  };

  // 短版輔助日會記錄，但不自動推高主課表或自己的重量/次數。
  // 等你回報後再由教練判斷是否需要改短版。
  const originalFinishWorkout=finishWorkout;
  finishWorkout=function(){
    if(!AUX_KEYS.has(currentWorkoutKey)){
      return originalFinishWorkout();
    }
    const before=JSON.parse(JSON.stringify(progress||{}));
    originalFinishWorkout();
    progress=before;
    storage.set("strengthProgress",progress);
  };

  // 週計畫畫面直接顯示新的五天安排。
  renderPlan=function(){
    const now=new Date(), t=localDay(now);
    $("#planGrid").innerHTML=weekly.map((d,i)=>{
      let label=d.label;
      if(d.type==="main") label="Full Body A/B｜依實際完成順序";
      const right=i===t?"今天":"";
      return `<div class="day ${i===t?'today':''}"><div><strong>${d.name}</strong><br><span>${label}</span></div><div>${right}</div></div>`;
    }).join("");
  };

  // UI 文案與版本。
  const brandVersion=document.querySelector(".brand span");
  if(brandVersion) brandVersion.textContent=`PWA ${VERSION}`;

  const planHero=document.querySelector("#planSection .hero");
  if(planHero){
    const sub=planHero.querySelector(".sub");
    const pill=planHero.querySelector(".pill");
    if(sub) sub.textContent="3 主訓練・2 短版輔助・2 完整休息";
    if(pill) pill.textContent="5 天重訓";
  }

  const planNote=document.querySelector("#planSection .small-note");
  if(planNote){
    planNote.textContent="週二、週五是 15–25 分鐘短版輔助，不做到力竭；週三、週日完整休息。Full Body A/B 依實際完成順序輪替，漏掉主訓練不會自動跳過。";
  }

  renderToday();
  if($("#planSection")?.classList.contains("active")) renderPlan();

  console.info("[Strength] five-day resistance schedule v1.6 active");
})();