/* Strength PWA v1.7.5 — completed-workout precedence and safer cloud reconciliation.
   Keep user data in local storage + authenticated Supabase only. */
(() => {
  if (window.__strengthSyncGuardV175) return;
  window.__strengthSyncGuardV175 = true;

  const VERSION = '1.7.5';
  const SESSION_KEY = 'strengthActiveSessionV1';
  const shortNames = new Set(['手臂＋核心｜短版', '上半身＋核心｜徒手短版']);

  const localDateOf = iso => {
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? dateKey(d) : null;
  };
  function completedForKey(entries, day, key) {
    if (!Array.isArray(entries) || !day || !key) return null;
    return entries.find(h => {
      if (!h || h.kind === 'cardio' || localDateOf(h.date) !== day) return false;
      if (key === 'U') return shortNames.has(h.workout);
      if (key === 'A' || key === 'B') return String(h.workout || '') === `Full Body ${key}`;
      return false;
    }) || null;
  }
  const stableJson = value => JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]]));
  });
  const isDoneSession = (s, entries=history) =>
    !!s && !!completedForKey(entries, s.date, s.workoutKey);

  // History wins. An unfinished session cannot outlive a finished workout
  // for the same local date and workout key (even if another device saved it later).
  const originalActiveSessionIsToday = activeSessionIsToday;
  activeSessionIsToday = function(s) {
    return originalActiveSessionIsToday(s) && !isDoneSession(s);
  };

  function retireCompletedLocalSession() {
    const s = readActiveSession();
    if (!isDoneSession(s)) return false;
    localStorage.removeItem(SESSION_KEY);
    idbClearActiveSession();
    activeIndex=0; sessionState={}; restEndsAt=null;
    return true;
  }

  const originalMergeStates = mergeStates;
  mergeStates = function(remote, local) {
    const result = originalMergeStates(remote, local);
    if (isDoneSession(result.activeSession, result.history)) result.activeSession = null;
    return result;
  };

  const originalCurrentState = currentState;
  currentState = function() {
    const state = originalCurrentState();
    if (isDoneSession(state.activeSession, state.history)) state.activeSession=null;
    return state;
  };

  // Avoid persisting an obsolete session when the page is closed after a finish.
  const originalSaveActiveSession = saveActiveSession;
  saveActiveSession = function() {
    if (completedForKey(history, dateKey(), currentWorkoutKey)) return;
    return originalSaveActiveSession();
  };

  const originalRenderToday = renderToday;
  renderToday = function() {
    retireCompletedLocalSession();
    const now = new Date();
    const plan = getTodayPlan();
    if (plan.type === 'U') {
      const done = completedForKey(history, dateKey(now), 'U');
      if (done) {
        renderedDateKey = dateKey(now);
        $('#modeSwitch').style.display='none';
        $('#todaySub').textContent=now.toLocaleDateString('zh-TW', {month:'long',day:'numeric',weekday:'long'});
        $('#todayTitle').textContent='今日已完成';
        $('#todayPill').textContent='✓ DONE';
        const next=nextStrengthAfter(now,true);
        $('#todayContent').innerHTML=`
          <div class="card status-card">
            <div class="status-main"><div class="status-icon">✓</div>
              <div class="status-copy">
                <div class="kicker">SHORT SESSION COMPLETE</div>
                <h2>${done.workout}</h2>
                <p>${modeLabel(done.mode)}｜已儲存完成紀錄，今天不用重做。</p>
              </div>
            </div>
            ${nextWorkoutHTML(next)}
            <div class="status-actions">
              <button class="primary" id="todaySummaryBtn">查看／複製摘要</button>
              <button class="secondary" id="todayHistoryBtn">查看紀錄</button>
            </div>
          </div>`;
        $('#todaySummaryBtn').onclick=()=>showSummary(makeSummary(done),'今天訓練摘要');
        $('#todayHistoryBtn').onclick=()=>activateTab('history');
        return;
      }
    }
    return originalRenderToday();
  };

  // Avoid the old "dirty and same cloud timestamp => overwrite whole cloud row"
  // path. Always read, union histories, then write only the merged result.
  // This protects completed sessions from a second device with stale state.
  let applyingCloud = false;
  let localChangeSerial = 0;
  const originalMarkDirty = window.__strengthCloudMarkDirty;
  window.__strengthCloudMarkDirty = function(...args) {
    if (applyingCloud || suppressCloudDirty) return;
    localChangeSerial++;
    return originalMarkDirty?.(...args);
  };

  syncCloud = async function(reason='manual') {
    if (!cloudClient || !cloudUser || cloudBusy || !navigator.onLine) {
      updateCloudUI();
      return;
    }
    cloudBusy=true; updateCloudUI();
    if (reason !== 'auto') cloudMessage('正在核對兩台裝置的紀錄…');
    const serialStart=localChangeSerial;
    try {
      const row=await getCloudRow();
      const local=currentState();
      const remote=row?.state || {};
      const merged=row ? mergeStates(remote,local) : local;
      const sameLocal=stableJson(merged)===stableJson(local);
      const sameCloud=row && stableJson(merged)===stableJson(remote);

      if (!sameLocal) {
        applyingCloud=true;
        try { applyState(merged); }
        finally { applyingCloud=false; }
      } else {
        retireCompletedLocalSession();
      }

      if (!sameCloud) {
        await pushCloud(merged);
      } else {
        syncMeta.dirty=false;
        syncMeta.lastCloudUpdatedAt=row.updated_at;
        syncMeta.lastSyncAt=new Date().toISOString();
        saveSyncMeta(); updateCloudUI();
      }
      cloudMessage('雲端與本機已核對完成。','ok');
    } catch(e) {
      syncMeta.dirty=true; saveSyncMeta(); updateCloudUI();
      cloudMessage('同步失敗：'+(e?.message||String(e)),'error');
    } finally {
      cloudBusy=false;
      if (localChangeSerial!==serialStart) {
        syncMeta.dirty=true; saveSyncMeta(); updateCloudUI();
        setTimeout(()=>{ if(cloudUser && navigator.onLine) syncCloud('auto'); },1200);
      }
      updateCloudUI();
    }
  };

  // On completion, do an extra sync attempt; local saving still works offline.
  const originalFinishWorkout=finishWorkout;
  finishWorkout=function() {
    const result=originalFinishWorkout();
    retireCompletedLocalSession();
    if (cloudUser && navigator.onLine) {
      setTimeout(()=>syncCloud('finish'),150);
    }
    return result;
  };

  // Label the real loaded version; do not change the training plan or progress.
  const versionNode=document.querySelector('.brand span');
  if (versionNode) versionNode.textContent=`PWA ${VERSION}`;
  renderToday();
  console.info('[Strength] completed-session sync guard v1.7.5 ready');
})();
