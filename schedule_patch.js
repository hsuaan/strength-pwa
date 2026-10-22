(() => {
  if (window.__strengthFinalScheduleV17) return;
  window.__strengthFinalScheduleV17 = true;

  const VERSION = "1.7";
  const AUX_KEYS = new Set(["U"]);
  const ALL_KEYS = new Set(["A","B","U"]);

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

  // 週二：20 分鐘左右的輔助阻力訓練。
  // 使用獨立 ID，不會和 Full Body A/B 的正式進度混在一起。
  baseWorkouts.U = {
    name:"手臂＋核心｜短版",
    duration:"約 20 分",
    exercises:[
      cloneEx(findBase("curl"),"aux_curl",{weight:3,target:8,sets:2}),
      cloneEx(findBase("triceps"),"aux_triceps",{weight:3,target:8,sets:2}),
      cloneEx(findBase("deadbug"),"aux_deadbug",{target:8,sets:2}),
      cloneEx(findBase("sideplank"),"aux_sideplank",{target:20,sets:2})
    ]
  };

  bodyweightWorkouts.U = {
    name:"上半身＋核心｜徒手短版",
    duration:"約 20 分",
    exercises:[
      cloneEx(findBW("bw_triceps"),"aux_bw_triceps",{target:5,sets:2}),
      cloneEx(findBW("bw_back"),"aux_bw_back",{target:8,sets:2}),
      cloneEx(findBW("bw_deadbug"),"aux_bw_deadbug",{target:6,sets:2}),
      cloneEx(findBW("bw_sideplank"),"aux_bw_sideplank",{target:20,sets:2})
    ]
  };

  // 教學按鈕沿用來源動作的原教學。
  const originalTutorialKeyFor = tutorialKeyFor;
  tutorialKeyFor = function(ex){
    if(ex?.auxSourceId){
      return originalTutorialKeyFor({...ex,id:ex.auxSourceId});
    }
    return originalTutorialKeyFor(ex);
  };

  // 週五心肺：只有兩個使用者已會的低衝擊動作，完全不跳。
  cardioPrograms.indoor = {
    name:"原地快走＋抬膝",
    subtitle:"低衝擊・不跳・約 20 分鐘",
    emoji:"🚶",
    exercises:[
      {
        id:"march",
        zh:"原地快走",
        cue:"腳步持續、手臂自然擺動；速度快一點，但不用跑。"
      },
      {
        id:"march",
        zh:"原地抬膝",
        cue:"左右交替抬膝到舒服高度，身體保持直立，不需要跳。"
      }
    ]
  };

  // 每級總時間都約 20 分鐘，只逐步增加工作比例。
  cardioLevels.splice(0, cardioLevels.length,
    {work:40,rest:20,rounds:10,label:"Level 1"},
    {work:45,rest:15,rounds:10,label:"Level 2"},
    {work:50,rest:10,rounds:10,label:"Level 3"},
    {work:55,rest:5,rounds:10,label:"Level 4"}
  );
  settings.cardioType = "indoor";
  settings.cardioLevel = Math.max(0,Math.min(cardioLevels.length-1,Number(settings.cardioLevel)||0));
  storage.set("strengthSettings",settings);

  // 原版用固定 5 個動作估時間；現在改成依實際動作數。
  cardioMinutes = function(levelIndex=settings.cardioLevel){
    const l=cardioLevels[levelIndex]||cardioLevels[0];
    const count=cardioPrograms.indoor.exercises.length;
    return Math.round((l.work+l.rest)*count*l.rounds/60);
  };

  // 心肺首頁只留一個選項，不再顯示拳擊或戶外快走。
  renderCardioHome = function(done=null){
    if(done){
      const next=nextStrengthAfter(new Date(),false);
      $("#todayContent").innerHTML=`
       <div class="card status-card">
         <div class="status-main">
           <div class="status-icon">✓</div>
           <div class="status-copy">
             <div class="kicker">CARDIO COMPLETE</div>
             <h2>${done.workout}</h2>
             <p>${done.durationMin||"—"} 分鐘｜體感：${feedbackText(done.feedback)}。今天完成就夠了，不需要再補重訓。</p>
           </div>
         </div>
         ${nextWorkoutHTML(next)}
       </div>`;
      return;
    }

    settings.cardioType="indoor";
    const level=cardioLevels[settings.cardioLevel]||cardioLevels[0];
    $("#todayContent").innerHTML=`
      <div class="card" style="padding:16px">
        <div class="kicker">LOW IMPACT CARDIO</div>
        <div class="workout-title" style="margin-top:3px">原地快走＋抬膝</div>
        <div class="sub" style="margin-top:4px">只有這兩個動作，全程不跳。目標是微喘、身體暖起來，但仍能講完整句子。</div>

        <div class="cardio-picker">
          <div class="cardio-choice selected">
            <div class="cardio-emoji">🚶</div>
            <div>
              <strong>約 ${cardioMinutes()} 分鐘</strong>
              <small>${level.work} 秒動 / ${level.rest} 秒放慢・10 輪</small>
            </div>
          </div>
        </div>

        <div class="daily-context" style="margin-top:10px">
          <div class="context-row"><strong>① 原地快走</strong><span>不跑、不跳</span></div>
          <div class="context-row"><strong>② 原地抬膝</strong><span>舒服高度即可</span></div>
        </div>

        <button class="cardio-start" id="cardioStartBtn">開始 20 分鐘心肺</button>
        <div class="small-note">不用追求痠或喘爆。做完選「太輕 / 剛好 / 太累」，App 只會微調工作與休息比例。</div>
      </div>`;

    $("#cardioStartBtn").onclick=()=>startCardio("indoor");
  };

  // 進行中訓練允許週二 U，保留 iPhone 鎖屏/滑掉後的恢復。
  activeSessionIsToday = function(s){
    return !!s &&
      s.date===dateKey() &&
      ALL_KEYS.has(s.workoutKey) &&
      ["dumbbell","bodyweight"].includes(s.mode);
  };

  makeActiveSessionPayload = function(){
    if(!currentWorkoutKey || !ALL_KEYS.has(currentWorkoutKey)) return null;
    return {
      version:4,
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

  // 最終週安排：
  // 一主訓、二短版、三休、四主訓、五心肺、六主訓、日休。
  weekly[0]={name:"星期一",type:"main",label:"Full Body A/B｜主訓練"};
  weekly[1]={name:"星期二",type:"U",label:"手臂＋核心｜短版約 20 分"};
  weekly[2]={name:"星期三",type:"rest",label:"完整休息"};
  weekly[3]={name:"星期四",type:"main",label:"Full Body A/B｜主訓練"};
  weekly[4]={name:"星期五",type:"cardio",label:"原地快走＋抬膝｜約 20 分"};
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

  function auxEntryOn(date){
    const set=settings.mode==="bodyweight"?bodyweightWorkouts:baseWorkouts;
    const name=set.U?.name;
    return history.find(h=>sameLocalDay(h.date,date) && h.workout===name) || null;
  }

  // 「下一次重訓」會包含週二短版，但不把週五心肺算成重訓。
  nextStrengthAfter = function(fromDate=new Date(),skipToday=false){
    for(let i=skipToday?1:0;i<=14;i++){
      const d=new Date(fromDate.getFullYear(),fromDate.getMonth(),fromDate.getDate()+i);
      const p=planForDate(d);
      if(["A","B","U"].includes(p.type)) return {date:d,plan:p};
    }
    return null;
  };

  function renderAuxComplete(entry){
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
            <p>${modeLabel(entry.mode)}｜短版完成就夠了，今天不用再補 Full Body。</p>
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

    // 若正在進行週二短版，優先恢復。
    if(activeSessionIsToday(pending) && pending.workoutKey==="U"){
      loadActiveSession(pending);
      renderedDateKey=dateKey(now);
      $("#modeSwitch").style.display="";
      $("#todaySub").textContent=now.toLocaleDateString("zh-TW",{month:"long",day:"numeric",weekday:"long"});
      document.querySelectorAll(".mode-btn").forEach(b=>b.classList.toggle("active",b.dataset.mode===settings.mode));
      $("#todayTitle").textContent=currentWorkout().name;
      $("#todayPill").textContent=currentWorkout().duration;
      renderWorkout();
      return;
    }

    const plan=getTodayPlan();

    // 非阻力訓練日不顯示「有啞鈴 / 徒手」切換。
    $("#modeSwitch").style.display=(plan.type==="cardio" || plan.type==="rest")?"none":"";

    if(plan.type==="U"){
      currentWorkoutKey="U";
      renderedDateKey=dateKey(now);
      $("#todaySub").textContent=now.toLocaleDateString("zh-TW",{month:"long",day:"numeric",weekday:"long"});
      document.querySelectorAll(".mode-btn").forEach(b=>b.classList.toggle("active",b.dataset.mode===settings.mode));

      const done=auxEntryOn(now);
      if(done){
        renderAuxComplete(done);
        return;
      }

      if(Object.keys(sessionState).length===0) restoreActiveSessionForCurrentWorkout();
      $("#todayTitle").textContent=currentWorkout().name;
      $("#todayPill").textContent=currentWorkout().duration;
      renderWorkout();
      return;
    }

    if(plan.type==="cardio"){
      settings.cardioType="indoor";
      originalRenderToday();
      return;
    }

    originalRenderToday();
  };

  // 週二短版會記錄回饋，但不自動推高主課表/短版進度。
  const originalFinishWorkout=finishWorkout;
  finishWorkout=function(){
    if(currentWorkoutKey!=="U"){
      return originalFinishWorkout();
    }
    const before=JSON.parse(JSON.stringify(progress||{}));
    originalFinishWorkout();
    progress=before;
    storage.set("strengthProgress",progress);
  };

  renderPlan=function(){
    const now=new Date(), t=localDay(now);
    $("#planGrid").innerHTML=weekly.map((d,i)=>{
      let label=d.label;
      if(d.type==="main") label="Full Body A/B｜依實際完成順序";
      const right=i===t?"今天":"";
      return `<div class="day ${i===t?'today':''}"><div><strong>${d.name}</strong><br><span>${label}</span></div><div>${right}</div></div>`;
    }).join("");
  };

  // UI 文案。
  const brandVersion=document.querySelector(".brand span");
  if(brandVersion) brandVersion.textContent=`PWA ${VERSION}`;

  const planHero=document.querySelector("#planSection .hero");
  if(planHero){
    const sub=planHero.querySelector(".sub");
    const pill=planHero.querySelector(".pill");
    if(sub) sub.textContent="3 主重訓・1 短版輔助・1 低衝擊心肺・2 休息";
    if(pill) pill.textContent="5 天活動";
  }

  const planNote=document.querySelector("#planSection .small-note");
  if(planNote){
    planNote.textContent="主訓練控制在 30–45 分鐘；週二短版約 20 分鐘；週五只有原地快走＋抬膝約 20 分鐘，全程不跳。週三、週日完整休息。Full Body A/B 依實際完成順序輪替，漏練不會自動跳過。";
  }

  renderToday();
  if($("#planSection")?.classList.contains("active")) renderPlan();

  console.info("[Strength] final weekly schedule v1.7 active");
})();