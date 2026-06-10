const state={
  rawFiles:[],
  fileMaps:[],
  submissions:[],
  selectedId:null,
  activeTab:'overview',
  quickFilter:'',
  filters:{},
saved:{},
actionLog:[],
programSkeleton:[],
datasetKey:'GlobalGatheringDecisionHub_v5',
sheetSort:{col:null,dir:1},
skeletonEditMode:false,
skeletonEditOriginalRows:null,
skeletonTimezone:'',
sheetScheduleMode:false,
taskStatus:{},
scheduleViewTimezones:{},
scheduleAidOpenSlots:{}
};

const CONFERENCE_TIMEZONE = 'America/Denver';
const CONFERENCE_TIMEZONE_LABEL = 'MT';
const GEMINI_API_KEY = 'PASTE_YOUR_GEMINI_API_KEY_HERE';
const GEMINI_MODEL = 'gemini-2.5-flash';

const GROQ_API_KEY = 'PASTE_YOUR_GROQ_API_KEY_HERE';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

let aiConversation = [];

const $=id=>document.getElementById(id);
const els={uploadBtn:$('uploadBtn'),addSessionBtn:$('addSessionBtn'),aiAssistantBtn:$('aiAssistantBtn'),
tasksBtn:$('tasksBtn'),uploadModal:$('uploadModal'),closeUpload:$('closeUpload'),dropZone:$('dropZone'),fileInput:$('fileInput'),fileRows:$('fileRows'),buildBtn:$('buildBtn'),clearFilesBtn:$('clearFilesBtn'),uploadFeedback:$('uploadFeedback'),sourceStatus:$('sourceStatus'),scoreNotes:$('scoreNotes'),exportActionLogBtn:$('exportActionLogBtn'),actionLogMini:$('actionLogMini'),kpis:$('kpis'),list:$('list'),visibleCardCount:$('visibleCardCount'),detail:$('detail'),search:$('search'),typeFilter:$('typeFilter'),themeFilter:$('themeFilter'),bandFilter:$('bandFilter'),decisionFilter:$('decisionFilter'),historyFilter:$('historyFilter'),timeZoneFilter:$('timeZoneFilter'),outsideHoursFilter:$('outsideHoursFilter'),cannotDaysFilter:$('cannotDaysFilter'),durationFilter:$('durationFilter'),opsFilter:$('opsFilter'),sortBy:$('sortBy'),
exportBtn:$('exportBtn'),
agendaPdfBtn:$('agendaPdfBtn'),
exportDataBtn:$('exportDataBtn'),
mailMergeExportBtn:$('mailMergeExportBtn'),
cventSpeakerBtn:$('cventSpeakerBtn'),
autoBackupBtn:$('autoBackupBtn'),
importStateBtn:$('importStateBtn'),
importStateInput:$('importStateInput'),
summaryBtn:$('summaryBtn'),
sheetModeBtn:$('sheetModeBtn'),
sheetExpandBtn:$('sheetExpandBtn'),
sheetRows:$('sheetRows'),
uploadSkeletonBtn:$('uploadSkeletonBtn'),
exportSkeletonBtn:$('exportSkeletonBtn'),
skeletonInput:$('skeletonInput'),
resetBtn:$('resetBtn'),
modal:$('modal'),
modalTitle:$('modalTitle'),
modalContent:$('modalContent'),
closeModal:$('closeModal'),
scheduleSummaryBtn:$('scheduleSummaryBtn'),
programSkeletonBtn:$('programSkeletonBtn'),
schedulingStatusFilter:$('schedulingStatusFilter')
};
const decisionOptions=['Unreviewed','Accept – Priority','Accept – If Space','Hold for Balance','Merge / Reframe','Invite to Panel / Strategy Space','Decline','Needs Follow-Up'];
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function norm(s){return String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}

function isYesish(v){
  const x = norm(v);
  if(!x) return false;

  if(
    x.includes('not requesting') ||
    x.includes('not request') ||
    x.includes('prefer not') ||
    x.includes('no ') ||
    x === 'no'
  ){
    return false;
  }

  return (
    x === 'yes' ||
    x.startsWith('yes ') ||
    x.includes('requesting a scholarship') ||
    x.includes('request scholarship')
  );
}
function clean(v){
  if(v==null || Number.isNaN(v)) return '';
  return String(v).trim();
}

function isDateLike(v){
  return v instanceof Date && !Number.isNaN(v.getTime());
}

function formatSkeletonDay(value){
  if(isDateLike(value)){
    return value.toLocaleDateString('en-US', {
      weekday:'long',
      month:'short',
      day:'numeric',
      timeZone:'UTC'
    });
  }

  const raw = clean(value);
  const parsed = new Date(raw);

  if(raw && !Number.isNaN(parsed.getTime()) && /20\d{2}/.test(raw)){
    return parsed.toLocaleDateString('en-US', {
      weekday:'long',
      month:'short',
      day:'numeric',
      timeZone:'UTC'
    });
  }

  const n = norm(raw);

  if(n.includes('oct 6') || n.includes('6 oct') || n === '6') return 'Tuesday, Oct 6';
  if(n.includes('oct 7') || n.includes('7 oct') || n === '7') return 'Wednesday, Oct 7';
  if(n.includes('oct 8') || n.includes('8 oct') || n === '8') return 'Thursday, Oct 8';

  return raw;
}

function excelDateTimeToTimeLabel(value){
  if(!isDateLike(value)) return '';

  let h = value.getHours();
  const m = value.getMinutes();

  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if(h === 0) h = 12;

  return `${h}:${String(m).padStart(2,'0')} ${ap}`;
}

function formatSkeletonTime(value){
  if(isDateLike(value)){
    return excelDateTimeToTimeLabel(value);
  }

  let raw = clean(value).replace(/\s+/g,' ');

  const parsed = new Date(raw);
  if(raw && !Number.isNaN(parsed.getTime()) && raw.includes('GMT')){
    return excelDateTimeToTimeLabel(parsed);
  }

  raw = raw
    .replace(/(\d)(am|pm)/ig,'$1 $2')
    .replace(/am/ig,'AM')
    .replace(/pm/ig,'PM')
    .replace(/\s*(ET|MT|CT|PT)$/i,'')
    .trim();

  return raw;
}

function canonicalSkeletonTime(value){
  return formatSkeletonTime(value);
}

function num(v){const n=parseFloat(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:null;}
function email(v){return clean(v).toLowerCase();}

function pill(t,c='gray'){return `<span class="pill ${c}">${esc(t)}</span>`}
function typeColor(t){
  t=String(t||'').toLowerCase();
  if(t.includes('strategy'))return'teal';
  if(t.includes('creative'))return'red';
  if(t.includes('skill'))return'sage';
  if(t.includes('keynote'))return'navy';
  return'amber';
}
function themeColor(t){t=String(t||'').toLowerCase(); if(t.includes('truth')||t.includes('rights'))return'red'; if(t.includes('communities')||t.includes('workforce'))return'teal'; if(t.includes('systems'))return'navy'; if(t.includes('inner'))return'sage'; if(t.includes('reimagining'))return'amber'; return'sage'}
function bandColor(b){return b==='Strong'?'teal':b==='Middle'?'amber':'bad'}
function storeLoad(){
  try{
    state.saved=JSON.parse(localStorage.getItem(state.datasetKey)||'{}');
  }catch{
    state.saved={};
  }
  loadTaskStatus();
}
function storeSave(){localStorage.setItem(state.datasetKey,JSON.stringify(state.saved));}
function getScoreNotes(){
  return state.saved.__scoreNotes?.text || '';
}

function setScoreNotes(value){
  state.saved.__scoreNotes = {
    text:value || '',
    updatedAt:new Date().toISOString()
  };
  storeSave();
}
function actionLogKey(){
  return `${state.datasetKey}_actionLog`;
}

function loadActionLog(){
  try{
    state.actionLog = JSON.parse(localStorage.getItem(actionLogKey()) || '[]');
    if(!Array.isArray(state.actionLog)) state.actionLog = [];
  }catch{
    state.actionLog = [];
  }
}

function saveActionLog(){
  localStorage.setItem(actionLogKey(), JSON.stringify(state.actionLog || []));
  updateActionLogDisplay();
}

function getSessionForLog(id){
  return state.submissions.find(s=>s.id === id) || {};
}

function actionValueForLog(value){
  if(value == null) return '';
  if(typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function logUserAction({id='', action='', field='', oldValue='', newValue='', details='' } = {}){
  const s = getSessionForLog(id);

  state.actionLog = Array.isArray(state.actionLog) ? state.actionLog : [];

  state.actionLog.push({
    timestamp:new Date().toISOString(),
    localTime:new Date().toLocaleString(),
    action,
    confirmation:s.confirmation || id || '',
    sessionId:id || '',
    title:s.title || '',
    type:s.type || '',
    theme:s.theme || '',
    primaryPresenter:s.presenters?.[0]?.name || '',
    field,
    oldValue:actionValueForLog(oldValue),
    newValue:actionValueForLog(newValue),
    details:actionValueForLog(details)
  });

  saveActionLog();
}

function updateActionLogDisplay(){
  const count = Array.isArray(state.actionLog) ? state.actionLog.length : 0;

  if(els.actionLogMini){
    els.actionLogMini.textContent = `Action log: ${count} recorded action${count === 1 ? '' : 's'}`;
  }

  if(els.exportActionLogBtn){
    els.exportActionLogBtn.disabled = !count;
  }
}

function exportActionLogCSV(){
  const headers=[
    'Timestamp ISO',
    'Local Time',
    'Action',
    'Confirmation Number',
    'Session ID',
    'Session Title',
    'Session Type',
    'Theme',
    'Primary Presenter',
    'Field',
    'Old Value',
    'New Value',
    'Details'
  ];

  const rows=(state.actionLog || []).map(x=>[
    x.timestamp,
    x.localTime,
    x.action,
    x.confirmation,
    x.sessionId,
    x.title,
    x.type,
    x.theme,
    x.primaryPresenter,
    x.field,
    x.oldValue,
    x.newValue,
    x.details
  ]);

  downloadCSV('global-gathering-2026-action-log.csv',[headers,...rows]);
}
function saveProgramSkeletonBrowser(){
  const payload={
    programSkeleton:skeletonRows(),
    skeletonTimezone:state.skeletonTimezone || '',
    savedAt:new Date().toISOString()
  };

  localStorage.setItem(`${state.datasetKey}_programSkeleton`, JSON.stringify(payload));
  persistBuiltDataset();
}

function restoreProgramSkeletonBrowser(){
  try{
    const raw=localStorage.getItem(`${state.datasetKey}_programSkeleton`);
    if(!raw) return false;

    const data=JSON.parse(raw);

    if(Array.isArray(data.programSkeleton) && data.programSkeleton.length){
      state.programSkeleton=data.programSkeleton;
state.skeletonTimezone =
  localStorage.getItem(`${state.datasetKey}_skeletonTimezone`) ||
  data.skeletonTimezone ||
  state.skeletonTimezone ||
  CONFERENCE_TIMEZONE;
        return true;
    }
  }catch(e){
    console.warn('Could not restore program skeleton from browser storage',e);
  }

  return false;
}
function canonicalDecision(value){
  const v=clean(value);
  if(!v || v==='Unreviewed') return 'Unreviewed';
  if(v==='Accept' || v==='Accept – Priority') return 'Accept';
  if(v==='Conditional accept' || v==='Accept – If Space' || v==='Merge / Reframe' || v==='Invite to Panel / Strategy Space' || v==='Needs Follow-Up') return 'Conditional accept';
  if(v==='Hold / unsure' || v==='Hold for Balance') return 'Hold / unsure';
  if(v==='Decline' || v==='Reject') return 'Decline';
  return v;
}
function decisionColor(value){const v=canonicalDecision(value); return v==='Accept'?'green':v==='Conditional accept'?'teal':v==='Hold / unsure'?'amber':v==='Decline'?'bad':'gray'}
function getDecision(id){return canonicalDecision(state.saved[id]?.decision||'Unreviewed')}
function getNotes(id){return state.saved[id]?.notes||''}
function taskStatusKey(){
  return `${state.datasetKey}_taskStatus`;
}

function loadTaskStatus(){
  try{
    state.taskStatus = JSON.parse(localStorage.getItem(taskStatusKey()) || '{}');
    if(!state.taskStatus || typeof state.taskStatus !== 'object') state.taskStatus = {};
  }catch{
    state.taskStatus = {};
  }
}

function saveTaskStatus(){
  state.taskStatus = state.taskStatus || {};
  localStorage.setItem(taskStatusKey(), JSON.stringify(state.taskStatus));
  persistBuiltDataset();
}

function extractTaskLines(text){
  return String(text || '')
    .split(/\r?\n/)
    .map(line=>{
      const match = line.match(/^\s*tag_task\s+(.+?)\s*$/i);
      return match ? match[1].trim() : '';
    })
    .filter(Boolean);
}

function taskKey(sessionId, source, text){
  return `${sessionId}|${source}|${norm(text)}`;
}

function getAllTaggedTasks(){
  const tasks = [];

  state.submissions.forEach(s=>{
    const decisionTasks = extractTaskLines(getNotes(s.id));
    const scheduleTasks = extractTaskLines(getSchedule(s.id).notes || '');

    decisionTasks.forEach(text=>{
      tasks.push({
        key:taskKey(s.id,'decision',text),
        sessionId:s.id,
        confirmation:s.confirmation || '',
        title:s.title || 'Untitled session',
        source:'Decision notes',
        text
      });
    });

    scheduleTasks.forEach(text=>{
      tasks.push({
        key:taskKey(s.id,'schedule',text),
        sessionId:s.id,
        confirmation:s.confirmation || '',
        title:s.title || 'Untitled session',
        source:'Scheduling notes',
        text
      });
    });
  });

  return tasks;
}

function showTasksModal(){
  const tasks = getAllTaggedTasks();
  const doneCount = tasks.filter(t=>state.taskStatus?.[t.key]).length;
  const openCount = tasks.length - doneCount;

  els.modalTitle.innerHTML = `
    <h2>Tasks</h2>
    <div class="micro">Pulled from lines in decision notes and scheduling notes that start with <b>tag_task</b>.</div>
  `;

  els.modalContent.innerHTML = `
    <div class="taskSummary">
      <div class="taskMetric">${tasks.length} total</div>
      <div class="taskMetric">${openCount} open</div>
      <div class="taskMetric">${doneCount} completed</div>
    </div>

    ${tasks.length ? `
      <div class="taskList">
        ${tasks.map(t=>{
          const done = !!state.taskStatus?.[t.key];

          return `
            <div class="taskItem ${done ? 'done' : ''}">
              <button type="button" class="taskCheck" data-task-key="${esc(t.key)}" title="Mark task complete">${done ? '✓' : ''}</button>
              <div>
                <div class="taskText">${esc(t.text)}</div>
                <div class="taskMeta">
                  ${esc(t.source)} • ${esc(t.confirmation || 'No confirmation')} • 
                  <button type="button" data-open-task-session="${esc(t.sessionId)}">${esc(t.title)}</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : `
      <div class="taskEmpty">
        No tasks found yet.<br><br>
        Add a line like <b>tag_task Follow up with presenter</b> in decision notes or scheduling notes.
      </div>
    `}
  `;

  els.modal.classList.add('active');

  document.querySelectorAll('[data-task-key]').forEach(btn=>{
    btn.onclick = ()=>{
      const key = btn.dataset.taskKey;
      state.taskStatus = state.taskStatus || {};

      if(state.taskStatus[key]){
        delete state.taskStatus[key];
      }else{
        state.taskStatus[key] = {
          completed:true,
          completedAt:new Date().toISOString()
        };
      }

      saveTaskStatus();
      showTasksModal();
    };
  });

  document.querySelectorAll('[data-open-task-session]').forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.openTaskSession;
      if(state.submissions.find(s=>s.id === id)){
        state.selectedId = id;
        els.modal.classList.remove('active');
        renderAll();
      }
    };
  });
}
function saveDecision(id,decision,notes){
  const current = state.saved[id] || {};
  const oldDecision = canonicalDecision(current.decision || 'Unreviewed');
  const newDecision = canonicalDecision(decision);
  const oldNotes = current.notes || '';
  const newNotes = notes || '';

  state.saved[id] = {
    ...current,
    decision: newDecision,
    notes: newNotes,
    updatedAt: new Date().toISOString()
  };

  if(oldDecision !== newDecision){
    logUserAction({
      id,
      action:'Decision changed',
      field:'decision',
      oldValue:oldDecision,
      newValue:newDecision
    });
  }

// Notes autosave frequently while typing.
// Do not log every notes change because it bloats the action log and slows typing.

  storeSave();
  persistBuiltDataset();
  renderKpis();
  renderList();
  updateDecisionDisplay(id);
}
function decisionPill(value){return `<span class="pill ${decisionColor(value)}" data-decision-pill>${esc(canonicalDecision(value))}</span>`}
const DEFAULT_PROGRAM_SKELETON = [];

const SCHEDULE_TYPE_ORDER=[
  'Skill Building Institutes',
  'Workshops',
  'Strategy Sessions',
  'Creative Space',
  'International Exchange',
  'Keynote'
];

const SCHEDULE_THEME_ORDER=[
  'Reimagining Child, Youth, and Family Well-Being',
  'Truth, Justice, and Healing Systems',
  'Communities as Catalysts for Well-Being',
  'Rights, Advocacy, and Family Power',
  'Systems Innovation and the Architecture of Change',
  'Inner Restoration and Reflective Leadership',
  'The Future Workforce: Thriving, Connected, Equipped'
];

const SCHEDULE_ABBREVIATIONS={
  'Skill Building Institutes':'SBI',
  'Workshops':'WS',
  'Strategy Sessions':'SS',
  'Creative Space':'CS',
  'International Exchange':'IE',
  'Keynote':'KN',

  'Reimagining Child, Youth, and Family Well-Being':'CYF WB',
  'Truth, Justice, and Healing Systems':'TJH',
  'Communities as Catalysts for Well-Being':'COM',
  'Rights, Advocacy, and Family Power':'RAF',
  'Systems Innovation and the Architecture of Change':'SYS',
  'Inner Restoration and Reflective Leadership':'IRL',
  'The Future Workforce: Thriving, Connected, Equipped':'FW'
};

function scheduleAbbrev(value){
  return SCHEDULE_ABBREVIATIONS[clean(value)] || clean(value);
}

function scheduleLegendHTML(values){
  return `
    <div class="scheduleLegend">
      ${values.map(v=>`
        <span><b>${esc(scheduleAbbrev(v))}</b> = ${esc(v)}</span>
      `).join('')}
    </div>
  `;
}

function makeSkeletonId(){
  if(window.crypto && crypto.randomUUID){
    return `slot-${crypto.randomUUID()}`;
  }

  return `slot-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
}

function skeletonRows(){
  if(!Array.isArray(state.programSkeleton)){
    state.programSkeleton = [];
  }

  state.programSkeleton = state.programSkeleton.map((x,i)=>({
    id:x.id || makeSkeletonId(),
    day:formatSkeletonDay(x.day),
    start:canonicalSkeletonTime(x.start),
    end:canonicalSkeletonTime(x.end),
    type:clean(x.type || x.presentationType || x['Presentation Type'])
  })).filter(x=>x.day && x.start && x.end && x.type);

  return state.programSkeleton;
}

function skeletonKey(day,start){
  return `${norm(day)}|${norm(start)}`;
}

function findSkeletonSlot(day,start){
  const key=skeletonKey(day,start);
  return skeletonRows().find(slot=>skeletonKey(slot.day,slot.start)===key) || null;
}

function getSchedule(id){
  return state.saved[id]?.schedule || {};
}

function saveSchedule(id,patch){
  const current=state.saved[id] || {};
  const before=current.schedule || {};
  const schedule={...before,...patch};

  state.saved[id]={
    ...current,
    schedule,
    updatedAt:new Date().toISOString()
  };

  Object.keys(patch || {}).forEach(field=>{
    const oldValue = before[field] ?? '';
    const newValue = schedule[field] ?? '';

    if(actionValueForLog(oldValue) !== actionValueForLog(newValue)){
      logUserAction({
        id,
        action:'Scheduling changed',
        field:`schedule.${field}`,
        oldValue,
        newValue,
        details:schedule
      });
    }
  });

  storeSave();
  persistBuiltDataset();
}

function syncSchedulesAfterSkeletonEdit(oldRows, newRows){
  const moved = [];
  const oldById = new Map(oldRows.map(row=>[row.id,row]));

  newRows.forEach(newSlot=>{
    if(!newSlot?.id) return;

    const oldSlot = oldById.get(newSlot.id);
    if(!oldSlot) return; // new row added anywhere = do not move anything

    const oldKey = skeletonKey(oldSlot.day, oldSlot.start);
    const newKey = skeletonKey(newSlot.day, newSlot.start);

    if(oldKey === newKey) return;

    state.submissions.forEach(s=>{
      const sch = getSchedule(s.id);
      if(!sch.day || !sch.start) return;
      if((sch.status || 'Unscheduled') === 'Unscheduled') return;

      const sessionKey = skeletonKey(sch.day, sch.start);
      if(sessionKey !== oldKey) return;

      const duration =
        Number(sch.durationMinutes) ||
        minutesBetweenTimes(newSlot.start, newSlot.end) ||
        '';

      saveSchedule(s.id,{
        day:newSlot.day,
        start:newSlot.start,
        end:duration
          ? addMinutesToTimeLabel(newSlot.start, duration)
          : newSlot.end || '',
        durationMinutes:duration || sch.durationMinutes || '',
        skeletonSlotId:newSlot.id,
        skeletonType:newSlot.type || sch.skeletonType || '',
        status:sch.status || 'Scheduled',
        skeletonAutoMoved:true,
        skeletonAutoMovedAt:new Date().toISOString(),
        skeletonAutoMoveFrom:`${oldSlot.day} ${oldSlot.start}`,
        skeletonAutoMoveTo:`${newSlot.day} ${newSlot.start}`
      });

      moved.push(s.id);
    });
  });

  return moved;
}

function getProposedDurationMinutes(s){
  const raw=clean(s.duration || s.type || '');
  const direct=raw.match(/(\d+)\s*(minutes|min)/i);
  if(direct) return Number(direct[1]);

  const type=clean(s.type).toLowerCase();
  if(type.includes('skill')) return 210;
  if(type.includes('strategy')) return 90;
if(type.includes('creative')) return 90;
if(type.includes('international exchange')) return 90;
if(type.includes('keynote')) return 60;
if(type.includes('workshop')) return 75;

  return '';
}

function slotLabel(slot){
  if(!slot) return '';
  return `${slot.day} • ${formatTimeLabel(slot.start)}–${formatTimeLabel(slot.end)} • ${slot.type}`;
}
const SKELETON_EVENT_DATE_MAP = {
  'Tuesday, Oct 6':'2026-10-06',
  'Wednesday, Oct 7':'2026-10-07',
  'Thursday, Oct 8':'2026-10-08',
  'Oct 6':'2026-10-06',
  'Oct 7':'2026-10-07',
  'Oct 8':'2026-10-08'
};

const SKELETON_DAY_OPTIONS = [
  'Tuesday, Oct 6',
  'Wednesday, Oct 7',
  'Thursday, Oct 8'
];

const SKELETON_TYPE_OPTIONS = [
  'Skill Building Institutes',
  'Workshops',
  'Strategy Sessions',
  'Creative Space',
  'International Exchange',
  'Keynote'
];

function getSkeletonEventDate(day){
  const cleanDay = clean(day);
  if(SKELETON_EVENT_DATE_MAP[cleanDay]) return SKELETON_EVENT_DATE_MAP[cleanDay];

  const n = norm(cleanDay);
  if(n.includes('oct 6')) return '2026-10-06';
  if(n.includes('oct 7')) return '2026-10-07';
  if(n.includes('oct 8')) return '2026-10-08';

  return '2026-10-06';
}

function stripTimeZoneLabel(value){
  return clean(value).replace(/\s*(ET|MT|CT|PT)$/i,'').trim();
}

function parseSkeletonTimeToMinutes(value){
  const raw = stripTimeZoneLabel(value).toLowerCase();
  const m = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if(!m) return null;

  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const ap = m[3].toLowerCase();

  if(ap === 'pm' && h !== 12) h += 12;
  if(ap === 'am' && h === 12) h = 0;

  return h * 60 + min;
}

function getTimeZoneOffsetMs(date, timeZone){
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
    hour:'2-digit',
    minute:'2-digit',
    second:'2-digit',
    hour12:false
  }).formatToParts(date);

  const map = {};
  parts.forEach(p=>map[p.type]=p.value);

  const h = Number(map.hour) === 24 ? 0 : Number(map.hour);

  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    h,
    Number(map.minute),
    Number(map.second)
  );

  return asUTC - date.getTime();
}

function zonedTimeToUtc(year, month, day, hour, minute, timeZone){
  const guessedUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let date = new Date(guessedUtc);

  let offset = getTimeZoneOffsetMs(date, timeZone);
  date = new Date(guessedUtc - offset);

  offset = getTimeZoneOffsetMs(date, timeZone);
  return new Date(guessedUtc - offset);
}

function skeletonStoredToUtc(day, timeValue, isEnd=false, startValue=''){
  const dateStr = getSkeletonEventDate(day);
  const minutes = parseSkeletonTimeToMinutes(timeValue);
  if(minutes == null) return null;

  const startMinutes = parseSkeletonTimeToMinutes(startValue);
  let addDay = 0;

  if(clean(timeValue).toLowerCase().includes('next day')){
    addDay = 1;
  }else if(isEnd && startMinutes != null && minutes <= startMinutes){
    addDay = 1;
  }

  const [year, month, date] = dateStr.split('-').map(Number);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return zonedTimeToUtc(year, month, date + addDay, h, m, CONFERENCE_TIMEZONE);
}

function getSkeletonLocalDateString(dateObj, timezone){
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year:'numeric',
    month:'2-digit',
    day:'2-digit'
  }).format(dateObj);
}

function formatSkeletonDateInZone(dateObj, timezone){
  return new Intl.DateTimeFormat('en-US', {
    weekday:'long',
    month:'short',
    day:'numeric',
    timeZone: timezone
  }).format(dateObj);
}

function formatSkeletonTimeInZone(dateObj, timezone){
  return new Intl.DateTimeFormat('en-US', {
    hour:'numeric',
    minute:'2-digit',
    hour12:true,
    timeZone: timezone
  }).format(dateObj);
}

function getSkeletonTzAbbreviation(timezone, dateObj=null){
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName:'short',
    month:'short',
    day:'numeric',
    hour:'numeric'
  }).formatToParts(dateObj || new Date(Date.UTC(2026,9,6,12,0)));

  return parts.find(p=>p.type === 'timeZoneName')?.value || timezone.split('/').pop().replaceAll('_',' ');
}

function buildSkeletonDisplaySlot(slot, timezone){
  const startUtc = skeletonStoredToUtc(slot.day, slot.start, false);
  const endUtc = skeletonStoredToUtc(slot.day, slot.end, true, slot.start);

  if(!startUtc || !endUtc){
    return {
      day: slot.day,
      start: formatTimeLabel(slot.start),
      end: formatTimeLabel(slot.end),
      type: slot.type
    };
  }

  const startDate = getSkeletonLocalDateString(startUtc, timezone);
  const endDate = getSkeletonLocalDateString(endUtc, timezone);
  const abbr = getSkeletonTzAbbreviation(timezone, startUtc);

  let dayLabel = formatSkeletonDateInZone(startUtc, timezone);
  let startLabel = formatSkeletonTimeInZone(startUtc, timezone);
  let endLabel = formatSkeletonTimeInZone(endUtc, timezone);

  if(endDate > startDate) endLabel += ' next day';
  if(endDate < startDate) endLabel += ' previous day';

  return {
    day: dayLabel,
    start: `${startLabel} ${abbr}`,
    end: `${endLabel} ${abbr}`,
    type: slot.type
  };
}

function getSkeletonTimezoneOptions(){
  const preferred = [
    'America/Denver',
    'America/New_York',
    'America/Chicago',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'America/Toronto',
    'America/Vancouver',
    'America/Mexico_City',
    'America/Bogota',
    'America/Lima',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Paris',
    'Europe/Madrid',
    'Europe/Rome',
    'Africa/Johannesburg',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Pacific/Auckland'
  ];

  const supported = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : preferred;

  const ordered = [...new Set([...preferred, ...supported])];

  return ordered.map(zone=>{
    const city = zone.split('/').pop().replaceAll('_',' ');
    const abbr = getSkeletonTzAbbreviation(zone);
    const label = zone === CONFERENCE_TIMEZONE
      ? `${city} (${abbr}) — conference base`
      : `${city} (${abbr})`;

    return {zone,label};
  });
}

function skeletonDayOptionsHTML(selected){
  return SKELETON_DAY_OPTIONS.map(day=>optionHTML(day, day, day === selected)).join('');
}

function skeletonTypeOptionsHTML(selected){
  const options = [...new Set([...SKELETON_TYPE_OPTIONS, clean(selected)].filter(Boolean))];
  return options.map(type=>optionHTML(type, type, type === selected)).join('');
}

function skeletonTypeMultiSelectHTML(selectedText){
  const selected = new Set(splitScheduleTypes(selectedText).map(normalizeScheduleType));

  return `
    <div class="multiFilter skeletonTypePicker">
      <button type="button" class="multiFilterBtn skeletonTypePickerBtn">
        <span>${esc(selectedText || 'Select type(s)')}</span>
        <span class="count">${splitScheduleTypes(selectedText).length || 0}</span>
      </button>
      <div class="multiFilterPanel skeletonTypePickerPanel">
        ${SKELETON_TYPE_OPTIONS.map(type=>`
          <label class="multiFilterOption">
            <input
              type="checkbox"
              value="${esc(type)}"
              ${selected.has(normalizeScheduleType(type)) ? 'checked' : ''}
            >
            <span>${esc(type)}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `;
}

function getSkeletonModalTimezone(){
  return state.skeletonTimezone || CONFERENCE_TIMEZONE;
}
function syncSkeletonTimezoneDropdown(){
  const tzSelect = $('skeletonTimezoneSelect');
  if(!tzSelect) return;

  const timezone = getSkeletonModalTimezone();
  const hasOption = [...tzSelect.options].some(opt=>opt.value === timezone);

  if(hasOption){
    tzSelect.value = timezone;
  }else{
    state.skeletonTimezone = CONFERENCE_TIMEZONE;
    tzSelect.value = CONFERENCE_TIMEZONE;
  }
}

function optionHTML(value,label,selected){
  const isSelected = selected === true || value === selected;
  return `<option value="${esc(value)}" ${isSelected ? 'selected' : ''}>${esc(label)}</option>`;
}
function scheduleConflictCount(currentId,day,start){
  if(!day || !start) return 0;
  return state.submissions.filter(s=>{
    if(s.id===currentId) return false;
    const sch=getSchedule(s.id);
    return sch.day===day && sch.start===start && getDecision(s.id)!=='Decline';
  }).length;
}
function presenterKey(p){
  const e = email(p.email);
  if(e) return `email:${e}`;
  const n = norm(p.name);
  if(n) return `name:${n}`;
  return '';
}
function presenterKeys(p){
  const keys = new Set();

  const e = email(p.email);
  if(e) keys.add(`email:${e}`);

  const rawName = clean(p.name || '');
  const first = clean(p.firstName || '');
  const last = clean(p.lastName || '');

  const possibleNames = [
    rawName,
    `${first} ${last}`,
    `${last} ${first}`,
    rawName.replace(/\s+/g,' '),
    rawName.replace(/\b(dr|mr|mrs|ms|prof|professor)\.?\b/gi,''),
    rawName.replace(/\([^)]*\)/g,''),
    rawName.replace(/,/g,' ')
  ];

  possibleNames.forEach(n=>{
    const normalized = norm(n);
    if(!normalized) return;

    keys.add(`name:${normalized}`);

    const parts = normalized.split(' ').filter(Boolean);

    // first + last only, ignoring middle initials/titles
    if(parts.length >= 2){
      keys.add(`name:${parts[0]} ${parts[parts.length - 1]}`);
      keys.add(`name:${parts[parts.length - 1]} ${parts[0]}`);
    }
  });

  return [...keys].filter(Boolean);
}

function presenterKeySet(session){
  const set = new Set();

  (session.presenters || []).forEach(p => {
    presenterKeys(p).forEach(k => set.add(k));
  });

  return set;
}

function presenterOverlapNames(a,b){
  const bKeys = presenterKeySet(b);
  const hits = [];

  (a.presenters || []).forEach(ap => {
    const apKeys = presenterKeys(ap);
    const hasHit = apKeys.some(k => bKeys.has(k));

    if(hasHit){
      hits.push(clean(ap.name) || clean(ap.email) || 'Matched presenter');
    }
  });

  return [...new Set(hits)];
}
function loosePresenterOverlapNames(a,b){
  const currentNames = (a.presenters || [])
    .map(p => clean(p.name) || clean(p.email))
    .filter(Boolean);

  const otherNames = (b.presenters || [])
    .map(p => clean(p.name) || clean(p.email))
    .filter(Boolean);

  const hits = [];

  currentNames.forEach(cn => {
    const cnNorm = norm(cn);

    otherNames.forEach(on => {
      const onNorm = norm(on);

      if(!cnNorm || !onNorm) return;

      if(cnNorm === onNorm){
        hits.push(cn);
        return;
      }

      const cnParts = cnNorm.split(' ').filter(Boolean);
      const onParts = onNorm.split(' ').filter(Boolean);

      if(cnParts.length >= 2 && onParts.length >= 2){
        const cnSimple = `${cnParts[0]} ${cnParts[cnParts.length - 1]}`;
        const onSimple = `${onParts[0]} ${onParts[onParts.length - 1]}`;

        if(cnSimple === onSimple){
          hits.push(cn);
        }
      }
    });
  });

  return [...new Set(hits)];
}
function getSharedAuthorMatches(sessionId){
  const current = state.submissions.find(s=>s.id===sessionId);
  if(!current) return [];

  const currentPresenters = (current.presenters || [])
    .map(p=>({ name: clean(p.name), key: presenterKey(p) }))
    .filter(p=>p.key);

  const matches = [];

  currentPresenters.forEach(author=>{
    const otherSessions = state.submissions
      .filter(s=>s.id !== sessionId)
      .filter(s=> (s.presenters || []).some(p=>presenterKey(p) === author.key))
      .map(s=>({ id: s.id, title: s.title || 'Untitled', type: s.type || '—', score: s.reviewAvg ?? '—', decision: getDecision(s.id) }));

    if(otherSessions.length){
      matches.push({ author: author.name || 'Unnamed presenter', sessions: otherSessions });
    }
  });

  return matches;
}

function presenterIsShared(p, sessionId){
  const key = presenterKey(p);
  if(!key) return false;
  return state.submissions.some(s=> s.id !== sessionId && (s.presenters||[]).some(op=> presenterKey(op) === key));
}

function sharedAuthorPill(sessionId){
  const matches = getSharedAuthorMatches(sessionId);
  if(!matches.length) return '';
  const count = matches.reduce((sum,m)=>sum + m.sessions.length,0);
  return `<button type="button" class="pill purple" data-open-shared-authors="${esc(sessionId)}">Shared author on ${count} other proposal${count===1?'':'s'}</button>`;
}

function openSharedAuthorModal(sessionId){
  const matches = getSharedAuthorMatches(sessionId);

  els.modalTitle.innerHTML = `\n    <h2>Shared author on other proposal(s)</h2>\n    <div class="micro">These author matches are based on presenter email first, then presenter name when email is unavailable.</div>\n  `;

  if(!matches.length){
    els.modalContent.innerHTML = `<div class="empty">No shared authors found for this proposal.</div>`;
    els.modal.classList.add('active');
    return;
  }

  els.modalContent.innerHTML = matches.map(group=>`\n    <div class="sharedAuthorGroup">\n      <h4>${esc(group.author)}</h4>\n      ${group.sessions.map(other=>`\n        <div class="sharedAuthorSession decision-${decisionColor(other.decision)}">\n          <div>\n            <strong>${esc(other.title)}</strong>\n            <div class="micro">${esc(other.type)} • Score ${esc(other.score)} • ${esc(other.decision)}</div>\n          </div>\n          <button type="button" class="btn teal" data-jump-shared-session="${esc(other.id)}">Open</button>\n        </div>\n      `).join('')}\n    </div>\n  `).join('');

  els.modal.classList.add('active');

  document.querySelectorAll('[data-jump-shared-session]').forEach(btn=>{ btn.onclick=()=>{ state.selectedId = btn.dataset.jumpSharedSession; els.modal.classList.remove('active'); document.body.classList.remove('sheet-view','sheet-fullscreen'); if(els.sheetModeBtn) els.sheetModeBtn.classList.remove('sage'); if(els.sheetExpandBtn) els.sheetExpandBtn.classList.remove('active'); renderAll(); scrollSelectedLeftCardToTop(); }; });
}
function updateDecisionDisplay(id){
  if(id!==state.selectedId) return;
  const cur=getDecision(id);
  document.querySelectorAll('[data-current-decision]').forEach(el=>el.textContent=cur);
  document.querySelectorAll('[data-current-status]').forEach(el=>el.textContent=cur);
  document.querySelectorAll('[data-decision-pill]').forEach(el=>{el.textContent=cur; el.className='pill '+decisionColor(cur); el.setAttribute('data-decision-pill','');});
  document.querySelectorAll('.quickDecBtn[data-decision]').forEach(btn=>btn.classList.toggle('active', btn.dataset.decision===cur));
}

const DB_NAME='GlobalGatheringDecisionHubDB'; const STORE_NAME='hub';
function idbOpen(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE_NAME);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function idbSet(key,value){const db=await idbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,'readwrite');tx.objectStore(STORE_NAME).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
async function idbGet(key){const db=await idbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,'readonly');const req=tx.objectStore(STORE_NAME).get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function serializableFileMaps(){
  return state.fileMaps.map(m=>({
    name:m.name,
    rows:m.rows || [],
    category:m.category,
    year:m.year || '',
    useAs:m.useAs || 'ignore',
    error:m.error || ''
  }));
}

async function persistBuiltDataset(){
  try{
    await idbSet('builtDataset',{
      submissions:state.submissions,
      fileMaps:state.fileMaps.map(m=>({
        name:m.name,
        rows:m.rows || [],
        category:m.category,
        year:m.year || '',
        useAs:m.useAs || 'ignore',
        error:m.error || ''
      })),
saved:state.saved,
taskStatus:state.taskStatus || {},
actionLog:state.actionLog || [],
scheduleAssignments:getScheduleAssignmentsExport(),
programSkeleton:skeletonRows(),
skeletonTimezone:state.skeletonTimezone,
selectedId:state.selectedId,
uiState:{
  sheetScheduleMode:!!state.sheetScheduleMode,
  sheetSort:state.sheetSort || {},
  filters:state.filters || {},
  quickFilter:state.quickFilter || '',
  activeTab:state.activeTab || ''
},
sourceStatusHTML:els.sourceStatus.innerHTML,
      savedAt:new Date().toISOString()
    });
  }catch(e){
    console.warn('Could not persist built dataset',e);
  }
}
async function restoreBuiltDataset(){
  try{
    const data=await idbGet('builtDataset');
if(!data || !Array.isArray(data.submissions) || !data.submissions.length){
  if(!restoreProgramSkeletonBrowser()){
    state.programSkeleton = [];
    state.skeletonTimezone = state.skeletonTimezone || '';
  }
  return;
}
    state.submissions=data.submissions;
    state.fileMaps=Array.isArray(data.fileMaps)?data.fileMaps:[];
state.saved=data.saved && typeof data.saved==='object' ? data.saved : state.saved;
state.taskStatus=data.taskStatus && typeof data.taskStatus==='object' ? data.taskStatus : state.taskStatus || {};
saveTaskStatus();
state.actionLog=Array.isArray(data.actionLog) ? data.actionLog : state.actionLog || [];
saveActionLog();
state.programSkeleton=Array.isArray(data.programSkeleton)&&data.programSkeleton.length
  ? data.programSkeleton
  : [];

state.skeletonTimezone = data.skeletonTimezone || state.skeletonTimezone || '';

restoreProgramSkeletonBrowser();
applyScheduleAssignmentsExport(data.scheduleAssignments);
state.sheetScheduleMode = !!data.uiState?.sheetScheduleMode;
state.sheetSort = data.uiState?.sheetSort || state.sheetSort || {col:null,dir:1};

    state.selectedId=state.submissions.find(x=>x.id===data.selectedId)?.id||state.submissions[0].id;

    storeSave();

    els.sourceStatus.innerHTML=(data.sourceStatusHTML||'')+`<div class="micro" style="margin-top:8px"><b>Restored locally:</b> dataset restored from this browser storage. Last saved ${data.savedAt ? new Date(data.savedAt).toLocaleString() : 'unknown'}.</div>`;
    if($('sourceMini')) $('sourceMini').textContent=`Restored ${state.submissions.length} submissions`;

    renderFileRows();
    initFilters();
    setEnabled(true);
    renderAll();
  }catch(e){
    console.warn('Could not restore local dataset',e);
  }
}
function selectedValues(id){return new Set(state.filters[id]||[])}

function sheetColToFilterId(col){
  return {
    status:'decisionFilter',
    type:'typeFilter',
    theme:'themeFilter'
  }[col] || null;
}

function getSheetColValues(col){
  const filterId = sheetColToFilterId(col);
  return filterId ? (state.filters[filterId] || []) : [];
}

function setSheetColValues(col, values){
  const filterId = sheetColToFilterId(col);
  if(!filterId) return;

  if(values.length){
    state.filters[filterId] = values;
  }else{
    delete state.filters[filterId];
  }

  renderFilterWidgets();
  renderAll(false);
}

function hasAny(id){return selectedValues(id).size>0}
function matchesAny(id,value){const vals=selectedValues(id); return !vals.size || vals.has(value)}
function resetAllFilters(){
  state.quickFilter='';
  state.filters={};
  state.sheetSort={col:null,dir:1};
  els.search.value='';
  els.sortBy.value='scoreDesc';
  document.querySelectorAll('.sheetMultiFilter.open').forEach(x=>x.classList.remove('open'));
  renderFilterWidgets();
  renderAll();
}function scoreExplainer(s){return `<div class="panel scoreRecipe"><h4>Decision score recipe</h4><div class="micro">Reviewer average drives this score; Lisa, historical attendance, and repeat presenter history are modest secondary signals only.</div></div>`;}
function setEnabled(on){
  [
    els.search,
    els.sortBy,
els.exportBtn,
els.agendaPdfBtn,
els.exportDataBtn,
els.mailMergeExportBtn,
els.cventSpeakerBtn,
    els.autoBackupBtn,
    els.summaryBtn,
    els.scheduleSummaryBtn,
els.programSkeletonBtn,
els.exportSkeletonBtn,
els.sheetModeBtn,
    els.aiAssistantBtn,
        els.tasksBtn
  ].filter(Boolean).forEach(x=>x.disabled=!on);

  document.querySelectorAll('[data-quick]').forEach(x=>x.disabled=!on);
  document.querySelectorAll('.multiFilter').forEach(x=>x.classList.toggle('disabled',!on));
}
function readFileAsArrayBuffer(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsArrayBuffer(file)})}
function readFileAsText(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsText(file)})}
async function parseFile(file){const lower=file.name.toLowerCase(); if(lower.endsWith('.xlsx')||lower.endsWith('.xls')){const buf=await readFileAsArrayBuffer(file);const wb=XLSX.read(buf,{type:'array',cellDates:true});const sheet=wb.Sheets[wb.SheetNames[0]];return XLSX.utils.sheet_to_json(sheet,{defval:''});} const text=await readFileAsText(file);return Papa.parse(text,{header:true,skipEmptyLines:true,dynamicTyping:false}).data;}

function resolveSkeletonImportTimezone(value){
  const raw = clean(value);
  const n = norm(raw);

  if(!raw) return '';

  if(n === 'mt' || n.includes('mountain') || n.includes('denver')) return 'America/Denver';
  if(n === 'et' || n.includes('eastern') || n.includes('new york')) return 'America/New_York';
  if(n === 'ct' || n.includes('central') || n.includes('chicago')) return 'America/Chicago';
  if(n === 'pt' || n.includes('pacific') || n.includes('los angeles')) return 'America/Los_Angeles';

  try{
    new Intl.DateTimeFormat('en-US', {timeZone:raw}).format(new Date());
    return raw;
  }catch(e){
    return '';
  }
}

function getSkeletonImportTimezone(){
  const answer = prompt(
    'What time zone is this skeleton file in? Use MT, ET, CT, PT, or an IANA zone like America/Denver.',
    'MT'
  );

  const zone = resolveSkeletonImportTimezone(answer);

  if(!zone){
    alert('Time zone not recognized. Import cancelled. Try MT, ET, CT, PT, or America/Denver.');
    return '';
  }

  return zone;
}

function convertImportedSlotToMountain(slot, sourceTimezone){
  if(!slot || !sourceTimezone || sourceTimezone === CONFERENCE_TIMEZONE) return slot;

  const dateStr = getSkeletonEventDate(slot.day);
  const startMinutes = parseSkeletonTimeToMinutes(slot.start);
  const endMinutesRaw = parseSkeletonTimeToMinutes(slot.end);

  if(startMinutes == null || endMinutesRaw == null) return slot;

  let endMinutes = endMinutesRaw;
  let endAddDay = 0;

  if(endMinutes <= startMinutes){
    endMinutes += 1440;
    endAddDay = 1;
  }

  const [year, month, day] = dateStr.split('-').map(Number);

  const startUtc = zonedTimeToUtc(
    year,
    month,
    day,
    Math.floor(startMinutes / 60),
    startMinutes % 60,
    sourceTimezone
  );

  const endUtc = zonedTimeToUtc(
    year,
    month,
    day + endAddDay,
    Math.floor((endMinutes % 1440) / 60),
    endMinutes % 60,
    sourceTimezone
  );

  const startDay = formatSkeletonDateInZone(startUtc, CONFERENCE_TIMEZONE);
  const startTime = formatSkeletonTimeInZone(startUtc, CONFERENCE_TIMEZONE);
  let endTime = formatSkeletonTimeInZone(endUtc, CONFERENCE_TIMEZONE);

  const startLocalDate = getSkeletonLocalDateString(startUtc, CONFERENCE_TIMEZONE);
  const endLocalDate = getSkeletonLocalDateString(endUtc, CONFERENCE_TIMEZONE);

  if(endLocalDate > startLocalDate) endTime += ' next day';

  return {
    ...slot,
    day:startDay,
    start:startTime,
    end:endTime
  };
}

function parseProgramSkeletonRows(rows, sourceTimezone=CONFERENCE_TIMEZONE){
  return rows.map((r,i)=>{
    const rawDay = col(r,['Day','Date']);
    const rawStart = col(r,['Start','Start Time','Time']);
    const rawEnd = col(r,['End','End Time']);
    const rawType = col(r,['Presentation Type','Type','Session Type']);

    const day = formatSkeletonDay(rawDay);
    const start = canonicalSkeletonTime(rawStart);
    const end = canonicalSkeletonTime(rawEnd);
    const type = clean(rawType);

    if(!day || !start || !end || !type) return null;

    const slot = {
      id:`slot-${i+1}`,
      day,
      start,
      end,
      type
    };

    return convertImportedSlotToMountain(slot, sourceTimezone);
  }).filter(Boolean);
}

async function importProgramSkeleton(file){
  try{
    const sourceTimezone = getSkeletonImportTimezone();
    if(!sourceTimezone) return;

    const rows = await parseFile(file);
    const parsed = parseProgramSkeletonRows(rows, sourceTimezone);

    if(!parsed.length){
      throw new Error('No valid skeleton rows found. Expected columns like Day, Start, End, and Presentation Type.');
    }

    state.programSkeleton = parsed;
    state.skeletonTimezone = CONFERENCE_TIMEZONE;

    saveProgramSkeletonBrowser();
    await persistBuiltDataset();

    alert(`Program skeleton imported: ${parsed.length} time slots loaded. Source timezone: ${sourceTimezone}. Scheduling values are now stored in Mountain Time.`);
    renderAll();
  }catch(e){
    alert('Could not import program skeleton: '+e.message);
  }
}

function exportProgramSkeletonCSV(){
  const rows = skeletonRows();

  if(!rows.length){
    alert('No program skeleton rows to export.');
    return;
  }

  const csvRows = [
    ['Day','Start','End','Presentation Type'],
    ...rows.map(slot=>[
      slot.day || '',
      stripTimeZoneLabel(slot.start || ''),
      stripTimeZoneLabel(slot.end || ''),
      slot.type || ''
    ])
  ];

  downloadCSV('global-gathering-program-skeleton.csv', csvRows);
}

function detectYear(name,rows){const n=name.match(/20(23|24|25|26)/); if(n)return '20'+n[1]; const cols=Object.keys(rows[0]||{}); const dateCol=cols.find(c=>/start date|submitted date/i.test(c)); const sample=clean(rows[0]?.[dateCol]); const y=sample.match(/20(23|24|25|26)/); return y?'20'+y[1]:'';}
function classify(file,rows){const cols=Object.keys(rows[0]||{}).map(c=>c.toLowerCase()); const has=s=>cols.some(c=>c.includes(s.toLowerCase())); const year=detectYear(file.name,rows); let category='unknown'; if(has('reviewer') && has('average grade') && has('submission')) category='reviews'; else if(has('session title') && has('primary theme') && has('confirmation number')) category='submissions'; else if(has('attendance type') && has('session name') && has('duration')) category='attendance'; else if(has('speaker category') && has('session name') && has('email address')) category='speakers'; return {file,rows,name:file.name,category,year:year||'',useAs:category==='unknown'?'ignore':category};}
function sourceMatchKey(m){
  const useAs = clean(m.useAs || m.category || 'ignore');
  const year = clean(m.year || '');
  return `${useAs}|${year}`;
}

function upsertFileMap(nextMap){
  const nextKey = sourceMatchKey(nextMap);

  // Do not auto-replace unknown/error/ignore files because those may be intentionally separate.
  if(nextMap.useAs === 'ignore' || nextMap.category === 'unknown' || nextMap.category === 'error'){
    state.fileMaps.push(nextMap);
    return;
  }

  const existingIndex = state.fileMaps.findIndex(m=>{
    if(m.useAs === 'ignore' || m.category === 'unknown' || m.category === 'error') return false;
    return sourceMatchKey(m) === nextKey;
  });

  if(existingIndex >= 0){
    state.fileMaps[existingIndex] = nextMap;
  }else{
    state.fileMaps.push(nextMap);
  }
}

async function addFiles(files){
  els.uploadFeedback.innerHTML='<div class="warnBox">Reading files...</div>';

  let added = 0;
  let replacedOrAdded = 0;

  for(const file of files){
    try{
      const rows = await parseFile(file);
      const map = classify(file,rows);
      upsertFileMap(map);
      added++;
      replacedOrAdded++;
    }catch(e){
      state.fileMaps.push({file,rows:[],name:file.name,category:'error',year:'',useAs:'ignore',error:e.message});
      added++;
    }
  }

  renderFileRows();

  els.uploadFeedback.innerHTML += `<div class="micro" style="margin-top:8px">${added} file(s) read. If a file matched an existing source type/year, it replaced the old one. Click <b>Build dashboard from uploads</b> to refresh the review tool.</div>`;
}
function renderFileRows(){const maps=state.fileMaps; if(!maps.length){els.fileRows.innerHTML='';els.buildBtn.disabled=true;els.uploadFeedback.innerHTML='';return;} els.fileRows.innerHTML=maps.map((m,i)=>`<div class="fileRow"><div class="fileName" title="${esc(m.name)}">${esc(m.name)}<br><span class="micro">${m.rows.length.toLocaleString()} rows${m.error?' • ERROR: '+esc(m.error):''}</span></div><select class="select fileCat" data-i="${i}"><option value="submissions">2026 submissions</option><option value="reviews">2026 reviews</option><option value="speakers">Historical speaker report</option><option value="attendance">Historical attendance report</option><option value="ignore">Ignore</option></select><select class="select fileYear" data-i="${i}"><option value="">No year</option><option>2026</option><option>2025</option><option>2024</option><option>2023</option></select><div class="micro">Detected: <b>${esc(m.category)}</b>${m.year?' • '+esc(m.year):''}</div></div>`).join(''); document.querySelectorAll('.fileCat').forEach(sel=>{
  sel.value=maps[+sel.dataset.i].useAs;
  sel.onchange=e=>{
    maps[+e.target.dataset.i].useAs=e.target.value;
    renderFileRows();
  };
});

document.querySelectorAll('.fileYear').forEach(sel=>{
  sel.value=maps[+sel.dataset.i].year;
  sel.onchange=e=>{
    maps[+e.target.dataset.i].year=e.target.value;
    renderFileRows();
  };
}); const counts=requiredCounts(); const ok=counts.submissions>=1&&counts.reviews>=1&&counts.speakers>=3&&counts.attendance>=3; els.buildBtn.disabled=!ok; els.uploadFeedback.innerHTML=`<div class="${ok?'successBox':'warnBox'}">Found ${counts.submissions} submissions, ${counts.reviews} reviews, ${counts.speakers} speaker reports, ${counts.attendance} attendance reports. ${ok?'Ready to build.':'Need 1 submissions file, 1 reviews file, 3 speaker reports, and 3 attendance reports.'}</div>`;}
function requiredCounts(){return state.fileMaps.reduce((a,m)=>{if(a[m.useAs]!=null)a[m.useAs]++;return a},{submissions:0,reviews:0,speakers:0,attendance:0,ignore:0})}
function col(row,patterns){const keys=Object.keys(row||{}); for(const p of patterns){const found=keys.find(k=>k.toLowerCase().includes(p.toLowerCase())); if(found)return row[found];} return ''}
function colAll(row,terms){
  const keys=Object.keys(row||{});
  const found=keys.find(k=>terms.every(t=>norm(k).includes(norm(t))));
  return found ? row[found] : '';
}
function colAll(row,terms){
  const keys=Object.keys(row||{});
  const found=keys.find(k=>terms.every(t=>norm(k).includes(norm(t))));
  return found ? row[found] : '';
}
function colName(row,patterns){const keys=Object.keys(row||{}); for(const p of patterns){const found=keys.find(k=>k.toLowerCase().includes(p.toLowerCase())); if(found)return found;} return ''}
function colSmartMatch(row, includeTerms, excludeTerms=[]){
  const keys = Object.keys(row || {});

  const found = keys.find(k => {
    const nk = norm(k);
    return includeTerms.every(t => nk.includes(norm(t))) &&
      !excludeTerms.some(t => nk.includes(norm(t)));
  });

  return {
    found: !!found,
    key: found || '',
    value: found ? row[found] : ''
  };
}

function colSmart(row, includeTerms, excludeTerms=[]){
  return colSmartMatch(row, includeTerms, excludeTerms).value;
}

function colSmartAny(row, configs){
  for(const cfg of configs){
    const hit = colSmartMatch(row, cfg.include || [], cfg.exclude || []);
    if(hit.found) return hit.value;
  }
  return '';
}
function buildAttendanceIndex(files){const byYearSession={}; for(const f of files){const year=f.year||detectYear(f.name,f.rows); for(const r of f.rows){const session=clean(col(r,['Session Name'])); if(!session||norm(session).startsWith('test '))continue; const key=year+'|'+norm(session); const e=email(col(r,['Email Address'])); byYearSession[key] ||= {year,sessionName:session,rows:0,unique:new Set(),liveRows:0,onDemandRows:0,registered:0,checkedIn:0}; const obj=byYearSession[key]; obj.rows++; if(e)obj.unique.add(e); const att=clean(col(r,['Attendance Type'])).toLowerCase(); const check=clean(col(r,['Check-in Type'])).toLowerCase(); if(att.includes('on-demand')||check.includes('demand'))obj.onDemandRows++; else obj.liveRows++; }
  }
  const out={}; Object.values(byYearSession).forEach(o=>{out[o.year+'|'+norm(o.sessionName)]={year:o.year,sessionName:o.sessionName,attendanceRows:o.rows,attendanceUnique:o.unique.size,liveRows:o.liveRows,onDemandRows:o.onDemandRows}}); return out;
}
function buildSpeakerHistory(files,attendanceIndex){const byEmail={}, byName={}; for(const f of files){const year=f.year||detectYear(f.name,f.rows); for(const r of f.rows){const session=clean(col(r,['Session Name'])); const first=clean(col(r,['First Name'])); const last=clean(col(r,['Last Name'])); const full=clean(col(r,['Full Name'])) || [first,last].filter(Boolean).join(' '); const em=email(col(r,['Email Address'])); if(!session||(!em&&!full))continue; const a=attendanceIndex[year+'|'+norm(session)]||{}; const rec={year,sessionName:session,speakerName:full,email:em,company:clean(col(r,['Company Name'])),speakerCategory:clean(col(r,['Speaker Category'])),registered:num(col(r,['Registered']))??'',checkedIn:num(col(r,['Checked In']))??'',attendanceRows:a.attendanceRows??'',attendanceUnique:a.attendanceUnique??'',liveRows:a.liveRows??'',onDemandRows:a.onDemandRows??''}; if(em)(byEmail[em] ||= []).push(rec); const nk=norm(full); if(nk)(byName[nk] ||= []).push(rec); }} return {byEmail,byName};}


function presenterScholarshipValue(row, i=null){
  if(i == null){
    return clean(col(row,['financial scholarship']));
  }

  return clean(colSmartAny(row,[
    {include:[`co author ${i}`,'financial','challenge']},
    {include:[`co-author ${i}`,'financial','challenge']},
    {include:[`co presenter ${i}`,'financial','challenge']},
    {include:[`co-presenter ${i}`,'financial','challenge']},
    {include:[`co author ${i}`,'scholarship']},
    {include:[`co-author ${i}`,'scholarship']},
    {include:[`co presenter ${i}`,'scholarship']},
    {include:[`co-presenter ${i}`,'scholarship']}
  ])) || colAll(row,[`co author ${i}`,'financial scholarship']);
}

function presenterLocation(city,country){
  return [clean(city),clean(country)].filter(Boolean).join(', ');
}

function presenterScholarshipValue(row, i=null){
  if(i == null){
    return clean(col(row,['financial scholarship']));
  }

  return clean(colSmartAny(row,[
    {include:[`co author ${i}`,'financial','challenge']},
    {include:[`co-author ${i}`,'financial','challenge']},
    {include:[`co presenter ${i}`,'financial','challenge']},
    {include:[`co-presenter ${i}`,'financial','challenge']},
    {include:[`co author ${i}`,'scholarship']},
    {include:[`co-author ${i}`,'scholarship']},
    {include:[`co presenter ${i}`,'scholarship']},
    {include:[`co-presenter ${i}`,'scholarship']}
  ])) || colAll(row,[`co author ${i}`,'financial scholarship']);
}

function presenterList(row){
  const list=[];

  function add(role,first,last,em,org,title,bio,scholarship,city='',country=''){
    const name=[clean(first),clean(last)].filter(Boolean).join(' ').trim();
    if(!name&&!clean(em))return;

    list.push({
      role,
      name:name||clean(em),
      firstName:clean(first),
      lastName:clean(last),
      email:email(em),
      organization:clean(org),
      title:clean(title),
      bio:clean(bio),
      scholarship:clean(scholarship),
      city:clean(city),
      country:clean(country),
      location:presenterLocation(city,country)
    });
  }

  add(
    'Primary',
    col(row,['First Name']),
    col(row,['Last Name']),
    col(row,['Email Address']),
    col(row,['Organization/Agency']),
    col(row,['Position/Title']),
    col(row,['Biography']),
    presenterScholarshipValue(row),
colSmartAny(row,[
  {include:['primary','city']},
  {include:['presenter','city'], exclude:['co-author','co author','co presenter','co-presenter']},
  {include:['work','city'], exclude:['co-author','co author','co presenter','co-presenter']},
  {include:['city'], exclude:['co-author','co author','co presenter','co-presenter']}
]),
colSmartAny(row,[
  {include:['primary','country']},
  {include:['presenter','country'], exclude:['co-author','co author','co presenter','co-presenter']},
  {include:['work','country'], exclude:['co-author','co author','co presenter','co-presenter']},
  {include:['country'], exclude:['co-author','co author','co presenter','co-presenter']}
])
  );

  for(let i=1;i<=6;i++){
    add(
      'Co-presenter '+i,
      col(row,[`Co-Author ${i} First Name`]),
      col(row,[`Co-Author ${i} Last Name`]),
      col(row,[`Co-Author ${i} Email Address`]),
      col(row,[`Co-Author ${i} Organization/Agency`]),
      col(row,[`Co-Author ${i} Position/Title`]),
      col(row,[`Co-Author ${i} Biography`]),
      presenterScholarshipValue(row,i),
colSmartAny(row,[
  {include:[`co author ${i}`,'city']},
  {include:[`co-author ${i}`,'city']},
  {include:[`co presenter ${i}`,'city']},
  {include:[`co-presenter ${i}`,'city']}
]),
colSmartAny(row,[
  {include:[`co author ${i}`,'country']},
  {include:[`co-author ${i}`,'country']},
  {include:[`co presenter ${i}`,'country']},
  {include:[`co-presenter ${i}`,'country']}
])
    );
  }

  return list;
}

function buildReviews(rows){const byConf={}; for(const r of rows){const conf=clean(col(r,['Confirmation Number'])); if(!conf)continue; const avg=num(col(r,['Average Grade'])); const reviewed=clean(col(r,['Reviewed Date'])); const hasCompleted=avg!=null && reviewed; if(!hasCompleted) continue; const rec={reviewer:clean(col(r,["Reviewer's Name"])),reviewerEmail:email(col(r,["Reviewer's Email Address"])),averageGrade:avg,newThinking:num(col(r,['provoke new ways'])),spreadScope:num(col(r,['breadth, depth, and scope'])),usefulDiverse:num(col(r,['useful would you rate'])),transformative:num(col(r,['How transformative'])),comments:clean(col(r,['Comments'])),reviewedDate:reviewed}; (byConf[conf] ||= []).push(rec);} return byConf;}

function reviewedBy(s, reviewerName){
  const target = norm(reviewerName);
  if(!target) return false;

  return (s.reviews || []).some(r =>
    norm(r.reviewer).includes(target) ||
    norm(r.reviewerEmail).includes(target)
  );
}

function truthyYes(v){
  const x=norm(v);
  return x==='yes' || x.startsWith('yes ') || x.includes('agree') || x.includes('willing');
}

function truthyNo(v){
  const x=norm(v);
  return x==='no' || x.startsWith('no ') || x.includes('not willing') || x.includes('cannot') || x.includes('do not');
}

function opsText(v){
  return norm(v);
}

function opsIsBlank(v){
  return !opsText(v);
}

function opsIsNo(v){
  const x=opsText(v);
  if(!x) return false;

  return (
    x==='no' ||
    x.startsWith('no ') ||
    x.includes(' no ') ||
    x.includes('not necessarily') ||
    x.includes('not recorded') ||
    x.includes('not applicable') ||
    x.includes('n a') ||
    x.includes('opt out') ||
    x.includes('optout') ||
    x.includes('not requesting') ||
    x.includes('prefer not')
  );
}

function opsIsYes(v){
  const x=opsText(v);
  if(!x || opsIsNo(v)) return false;

  return (
    x==='yes' ||
    x.startsWith('yes ') ||
    x.includes('yes most likely') ||
    x.includes('i prefer that this session is recorded') ||
    x.includes('recorded and made available') ||
    x.includes('requesting a scholarship')
  );
}

function recordingAllowed(v){
  const x=opsText(v);
  return !!x && x.includes('recorded') && x.includes('made available') && !x.includes('not recorded');
}

function recordingNotAllowed(v){
  const x=opsText(v);
  return !!x && x.includes('not recorded');
}

function preRecordInterested(v){
  return opsText(v)==='yes';
}

function techSupportNeeded(v){
  const x=opsText(v);
  return x==='yes most likely' || x==='yes';
}

function interpretationNeeded(v){
  return opsText(v)==='yes';
}

function interpreterSupportNeeded(v){
  const x=opsText(v);
  return !!x && !opsIsNo(x);
}

function ceuRelevant(v){
  return opsText(v)==='yes';
}

function featureHas(v, feature){
  const x=opsText(v);
  const f=opsText(feature);
  return !!x && x.includes(f);
}

function scholarshipRequested(v){
  return isYesish(v);
}

function opsHasNeed(v){
  const x=opsText(v);
  return !!x && !opsIsNo(v);
}
function extractOps(row){
  const important=/time|zone|day|date|avail|business|record|pre.record|moderation|tech|feature|interpret|language|ceu|credit|duration|length|scholarship|financial|access|accommod|caption|translation|virtual|platform|support|conflict|cannot/i;
  const out=[];
  Object.keys(row||{}).forEach(k=>{const v=clean(row[k]); if(v && important.test(k)) out.push({field:k,value:v});});
  return out;
}
function quickDecisionButtons(id){
  const cur=getDecision(id);
  const btns=[
    ['Accept','accept','Accept'],
    ['Conditional accept','conditional','Conditional'],
    ['Hold / unsure','hold','Hold / unsure'],
    ['Decline','decline','Decline']
  ];

  return `
    <div class="quickDecisionBar">
      <span class="label">Status</span>
      <div class="quickDecisionButtons">
        ${btns.map(([val,cls,label])=>`
          <button class="quickDecBtn ${cls} ${cur===val?'active':''}" data-decision="${esc(val)}">
            ${esc(label)}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}
function bindQuickDecisionButtons(id){
  document.querySelectorAll('.quickDecBtn[data-decision]').forEach(btn=>{
    btn.onclick=()=>{
      const clicked=canonicalDecision(btn.dataset.decision);
      const current=getDecision(id);
      const next=current===clicked ? 'Unreviewed' : clicked;
      saveDecision(id,next,getNotes(id));
    };
  });
}
function opsRows(s){
  const base=[
    ['Time zone',s.timeZone],
    ['Cannot hold',s.cannotDays],
    ['Outside business hours',s.outsideBusinessHours],
    ['Preferred duration',s.duration],
    ['Recording',s.recording],
    ['Pre-record interest',s.preRecord],
    ['Tech support',s.techSupport],
    ['Virtual features',s.features],
    ['Interpretation',s.interpretation],
    ['Interpreter support',s.interpreterAssist],
    ['CEU',s.ceu],
    ['Scholarship',isYesish(s.scholarship) ? 'Yes — at least one presenter is claiming a financial scholarship' : 'No / not indicated']
  ];

  const duplicateQuestion=/submitted date|financial scholarship|on-demand video archive|recording|time zone|outside of your normal business hours|preferred amount of time|tech or moderation support|virtual features|require interpretation|pre-recording|ceu credit/i;

  const extra=(s.opsExtra||[])
    .filter(x=>clean(x.value))
    .filter(x=>!duplicateQuestion.test(x.field))
    .slice(0,20)
    .map(x=>[x.field,x.value]);

  return [...base,...extra]
    .filter(x=>clean(x[1]))
    .map(([k,v])=>`<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join('') || '<tr><td colspan="2">No ops fields found.</td></tr>';
}

function buildData(){const submissionsFile=state.fileMaps.find(m=>m.useAs==='submissions'); const reviewFiles=state.fileMaps.filter(m=>m.useAs==='reviews'); const speakerFiles=state.fileMaps.filter(m=>m.useAs==='speakers'); const attendanceFiles=state.fileMaps.filter(m=>m.useAs==='attendance'); const reviews=buildReviews(reviewFiles.flatMap(f=>f.rows)); const attendanceIndex=buildAttendanceIndex(attendanceFiles); const history=buildSpeakerHistory(speakerFiles,attendanceIndex); const items=[]; for(const r of submissionsFile.rows){const conf=clean(col(r,['Confirmation Number'])); if(!conf)continue; const presenters=presenterList(r); const anyPresenterScholarship=presenters.some(p=>isYesish(p.scholarship)); const revs=reviews[conf]||[]; const avg=revs.length?+(revs.reduce((a,b)=>a+(b.averageGrade||0),0)/revs.length).toFixed(2):null; const spread=revs.length>1?+(Math.max(...revs.map(x=>x.averageGrade))-Math.min(...revs.map(x=>x.averageGrade))).toFixed(2):0; const dimVals=[]; revs.forEach(x=>['newThinking','spreadScope','usefulDiverse','transformative'].forEach(k=>{if(x[k]!=null)dimVals.push(x[k])})); const dimAvg=dimVals.length?+(dimVals.reduce((a,b)=>a+b,0)/dimVals.length).toFixed(2):null; const hist=[]; const seen=new Set(); presenters.forEach(p=>{if(p.email&&history.byEmail[p.email]) history.byEmail[p.email].forEach(h=>{const k='e|'+p.email+'|'+h.year+'|'+h.sessionName;if(!seen.has(k)){seen.add(k);hist.push({...h,currentPresenter:p.name,matchConfidence:'Exact email match'})}}); const nk=norm(p.name); if(nk&&history.byName[nk]) history.byName[nk].forEach(h=>{const k='n|'+nk+'|'+h.year+'|'+h.sessionName;if(!seen.has(k)&&!(p.email&&h.email===p.email)){seen.add(k);hist.push({...h,currentPresenter:p.name,matchConfidence:'Name-only match'})}});}); const histMax=Math.max(0,...hist.map(h=>Number(h.attendanceUnique||h.attendanceRows||h.checkedIn||h.registered||0))); const score=decisionScore(avg,dimAvg,histMax,revs.length,spread,clean(col(r,['Primary Theme'])),clean(col(r,['Session Type'])),revs,hist); const flags=[]; if(spread>=1.5)flags.push('Reviewer disagreement'); if(hist.length)flags.push('Returning presenter signal'); if(hist.some(h=>h.matchConfidence==='Name-only match'))flags.push('Name-only historical match: verify'); if(clean(col(r,['outside of your normal business hours'])).toLowerCase()==='no')flags.push('Not willing outside business hours'); items.push({id:conf,confirmation:conf,status:clean(col(r,['Submission Status'])),submittedDate:clean(col(r,['Submitted Date'])),title:clean(col(r,['Session Title'])),description:clean(col(r,['Session Description'])),abstract:clean(col(r,['Use this box'])),type:clean(col(r,['Session Type'])),theme:clean(col(r,['Primary Theme'])),tags:[1,2,3,4,5,6].map(i=>clean(col(r,[`Tag ${i}`]))).filter(Boolean),
recording:clean(col(r,[
  'on-demand video archive',
  'preference regarding recording'
])),

timeZone:clean(col(r,[
  'In what time zone will you reside'
])),

cannotDays:clean(col(r,[
  'days that you CANNOT hold your session'
])),

outsideBusinessHours:clean(col(r,[
  'outside of your normal business hours'
])),

duration:clean(col(r,[
  'preferred amount of time'
])),

techSupport:clean(col(r,[
  'needing tech or moderation support'
])),

features:clean(col(r,[
  'virtual features are most important'
])),

interpretation:clean(col(r,[
  'require interpretation into English'
])),

interpreterAssist:clean(col(r,[
  'assistance finding or paying for an interpreter'
])),

preRecord:clean(col(r,[
  'interest in pre-recording'
])),

ceu:clean(col(r,[
  'eligible to grant CEU credit'
])),
scholarship:anyPresenterScholarship ? 'Yes' : clean(col(r,['financial scholarship'])),livedExperience:anyPresenterScholarship ? 'Yes' : clean(col(r,['What lived experience'])),opsExtra:extractOps(r),presenters,reviews:revs,reviewAvg:avg,reviewSpread:spread,completedReviews:revs.length,numberReviewers:num(col(r,['Number of Reviewers']))||'',dimensionAvg:dimAvg,historicalMatches:hist.sort((a,b)=>b.year-a.year),historicalCount:hist.length,maxHistoricalAttendance:histMax,decisionScore:score,band:score>=70?'Strong':score>=55?'Middle':'Low Score',flags}); } state.submissions=items; state.selectedId=items[0]?.id||null; const loaded={submissions:submissionsFile?.name,reviews:reviewFiles.map(f=>f.name),speakers:speakerFiles.map(f=>f.year+': '+f.name),attendance:attendanceFiles.map(f=>f.year+': '+f.name)}; els.sourceStatus.innerHTML=`<div class="sourceGrid"><div class="srcPill"><b>2026 submissions</b><span>${esc(loaded.submissions||'Missing')}</span></div><div class="srcPill"><b>2026 reviews</b><span>${reviewFiles.length} file(s)</span></div><div class="srcPill"><b>Speaker history</b><span>${speakerFiles.map(f=>f.year).sort().join(', ')}</span></div><div class="srcPill"><b>Attendance history</b><span>${attendanceFiles.map(f=>f.year).sort().join(', ')}</span></div></div><div class="micro" style="margin-top:8px">Built ${items.length} submissions from uploads at ${new Date().toLocaleString()}. Decisions/notes are saved separately in this browser by confirmation number.</div>`; if($('sourceMini')) $('sourceMini').textContent=`Built ${items.length} submissions`;  initFilters(); setEnabled(true); renderAll(); persistBuiltDataset(); els.uploadModal.classList.remove('active');}
function decisionScore(avg,dimAvg,histMax,reviewCount,spread,theme,type,revs=[],hist=[]){
  const base=((avg??0)/5)*82;
  const lisa=revs.find(r=>/lisa/i.test(clean(r.reviewer)));
  const lisaAdj=lisa && avg!=null ? Math.max(-6,Math.min(6,(lisa.averageGrade-avg)*3)) : 0;
  const attendanceBoost=Math.min(Number(histMax||0),160)/160*7;
  const years=new Set((hist||[]).map(h=>String(h.year)).filter(Boolean));
  const repeatBoost=years.size>=3?4:years.size===2?2.5:years.size===1?1:0;
  const disagreementPenalty=Math.min(Number(spread||0),2)*2.5;
  const score=base+lisaAdj+attendanceBoost+repeatBoost-disagreementPenalty;
  return Math.max(0,Math.min(100,+score.toFixed(1)));
}
function filterOption(value,label){return {value,label:label||value}}
function renderMultiFilter(el, label, options){
  const id=el.id; const vals=selectedValues(id); const count=vals.size;
  el.innerHTML=`<button type="button" class="multiFilterBtn"><span>${esc(count?label+': '+count:label)}</span><span class="count">${count?'selected':'all'}</span></button><div class="multiFilterPanel">${options.map(o=>`<label class="multiFilterOption"><input type="checkbox" value="${esc(o.value)}" ${vals.has(o.value)?'checked':''}> <span>${esc(o.label)}</span></label>`).join('')}</div>`;
  el.querySelector('.multiFilterBtn').onclick=e=>{e.stopPropagation(); document.querySelectorAll('.multiFilter.open').forEach(x=>{if(x!==el)x.classList.remove('open')}); el.classList.toggle('open');};
  el.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.onchange=()=>{const next=new Set(state.filters[id]||[]); cb.checked?next.add(cb.value):next.delete(cb.value); state.filters[id]=[...next]; renderFilterWidgets(); renderAll(false);});
}
function renderFilterWidgets(){
  if(!state.submissions.length) return;
  const types=[...new Set(state.submissions.map(s=>s.type).filter(Boolean))].sort().map(x=>filterOption(x));
  const themes=[...new Set(state.submissions.map(s=>s.theme).filter(Boolean))].sort().map(x=>filterOption(x));
  const zones=[...new Set(state.submissions.map(s=>s.timeZone).filter(Boolean))].sort().map(x=>filterOption(x));
  const durations=[...new Set(state.submissions.map(s=>s.duration).filter(Boolean))]
  .sort((a,b)=>(parseInt(a,10)||999)-(parseInt(b,10)||999) || String(a).localeCompare(String(b)))
  .map(x=>filterOption(x));
  renderMultiFilter(els.typeFilter,'Types',types);
  renderMultiFilter(els.themeFilter,'Themes',themes);
  state.filters.bandFilter = (state.filters.bandFilter || []).filter(v => v !== 'Priority Review');
renderMultiFilter(els.bandFilter,'Score bands',['Strong','Middle','Low Score'].map(x=>filterOption(x)));
  renderMultiFilter(els.decisionFilter,'Decisions',['Unreviewed','Accept','Conditional accept','Hold / unsure','Decline'].map(x=>filterOption(x)));
  renderMultiFilter(els.historyFilter,'History',[filterOption('history','Returning presenter'),filterOption('new','New / no history'),filterOption('email','Exact email match'),filterOption('name','Name-only match'),filterOption('2025','History in 2025'),filterOption('2024','History in 2024'),filterOption('2023','History in 2023'),filterOption('highAttendance','High historical attendance')]);
  renderMultiFilter(els.timeZoneFilter,'Time zones',zones);
  renderMultiFilter(els.outsideHoursFilter,'Outside hours',[filterOption('yes','Willing outside business hours'),filterOption('no','Not willing outside business hours'),filterOption('blank','No outside-hours answer')]);
renderMultiFilter(els.cannotDaysFilter,'Day constraints',[filterOption('none','No cannot-days listed'),filterOption('has','Has cannot-days listed'),filterOption('oct6','Cannot Oct 6'),filterOption('oct7','Cannot Oct 7'),filterOption('oct8','Cannot Oct 8')]);
renderMultiFilter(els.durationFilter,'Preferred duration',durations);
renderMultiFilter(els.opsFilter,'Ops factors',[
  filterOption('recordYes','Recording allowed'),
  filterOption('recordNo','Recording not allowed'),
  filterOption('preRecordYes','Interested in pre-recording'),
  filterOption('techSupport','Needs tech/moderation support'),

  filterOption('featureBreakout','Feature: Breakout rooms'),
  filterOption('featurePolls','Feature: Polls'),
  filterOption('featureChat','Feature: Chat'),
  filterOption('featureQA','Feature: Q&A'),
  filterOption('featureScreen','Feature: Screen sharing'),
  filterOption('featureCaptions','Feature: Captions'),
  filterOption('featureTranscripts','Feature: Transcripts'),
  filterOption('featureVideoAudio','Feature: Share video/audio'),
  filterOption('featureParticipantMgmt','Feature: Participant management'),
  filterOption('featureParticipantVideo','Feature: Participants video/mute'),

  filterOption('interpretation','Requires interpretation into English'),
  filterOption('interpreterAssist','Needs interpreter assistance'),
  filterOption('ceuYes','Agrees to CEU requirements'),
  filterOption('ceuOptOut','CEU opt-out'),
  filterOption('ceuNA','CEU N/A Creative Space'),
  filterOption('scholarship','Scholarship requested')
]);
  renderMultiFilter(
  els.schedulingStatusFilter,
  'Scheduling',
  ['Unscheduled','Tentative','Scheduled','Conflict / revisit'].map(x=>filterOption(x))
);
}
function initFilters(){state.filters=state.filters||{}; renderFilterWidgets();}
function filterByAny(arr,id,predicate){const vals=selectedValues(id); if(!vals.size)return arr; return arr.filter(s=>[...vals].some(v=>predicate(s,v)));}
function hasScheduleErrorMessages(s){
  const sch = getSchedule(s.id);
  const selectedDay = sch.day || '';
  const selectedStart = sch.start || '';

  const matchedSlot = findSkeletonSlot(selectedDay, selectedStart);
  const durationMinutes = getSchedulingDisplayDuration(s, sch, matchedSlot);
  const displayEnd = matchedSlot ? getSchedulingDisplayEnd(s, sch, matchedSlot) : '';

  const displaySlot = matchedSlot
    ? {
        ...matchedSlot,
        end: displayEnd || matchedSlot.end
      }
    : null;

  const alerts = getSchedulingMismatchAlerts(
    s,
    sch,
    displaySlot || matchedSlot,
    durationMinutes
  );

  const conflicts = selectedDay && selectedStart
    ? getScheduleConflictList(s, selectedDay, selectedStart)
    : [];

  return alerts.length > 0 || conflicts.length > 0;
}
function hasMeaningfulNoteText(text){
  const stripped = String(text || '')
    .replace(/\btag_[A-Za-z0-9_-]+\b/gi, ' ')
    .trim();

  // Ignore leftover punctuation/separators from tag-only notes.
  return /[^\s,.;:|/\\\-–—()[\]{}"'`]+/.test(stripped);
}
function filtered(){let arr=[...state.submissions]; const q=norm(els.search.value); if(q)arr=arr.filter(s=>norm([s.title,s.description,s.abstract,s.theme,s.type,s.timeZone,s.cannotDays,s.outsideBusinessHours,s.recording,s.preRecord,s.techSupport,s.features,s.interpretation,s.interpreterAssist,s.ceu,s.scholarship,getNotes(s.id),
getSchedule(s.id).notes,
...(s.opsExtra||[]).map(o=>o.field+' '+o.value),...s.presenters.map(p=>[p.name,p.email,p.organization,p.title].join(' ')),...s.reviews.map(r=>r.comments)].join(' ')).includes(q));
  arr=filterByAny(arr,'typeFilter',(s,v)=>s.type===v);
  arr=filterByAny(arr,'themeFilter',(s,v)=>s.theme===v);
  arr=filterByAny(arr,'bandFilter',(s,v)=>s.band===v);
  arr=filterByAny(arr,'decisionFilter',(s,v)=>getDecision(s.id)===v);
  arr=filterByAny(arr,'historyFilter',(s,v)=> v==='history'?s.historicalCount>0:v==='new'?!s.historicalCount:v==='email'?s.historicalMatches.some(h=>h.matchConfidence==='Exact email match'):v==='name'?s.historicalMatches.some(h=>h.matchConfidence==='Name-only match'):['2025','2024','2023'].includes(v)?s.historicalMatches.some(h=>String(h.year)===v):v==='highAttendance'?s.maxHistoricalAttendance>=75:true);
  arr=filterByAny(arr,'timeZoneFilter',(s,v)=>s.timeZone===v);
  arr=filterByAny(arr,'outsideHoursFilter',(s,v)=> v==='yes'?truthyYes(s.outsideBusinessHours):v==='no'?truthyNo(s.outsideBusinessHours):v==='blank'?!clean(s.outsideBusinessHours):true);
arr=filterByAny(arr,'cannotDaysFilter',(s,v)=> v==='none'?!clean(s.cannotDays)||norm(s.cannotDays).includes('none'):v==='has'?clean(s.cannotDays)&&!norm(s.cannotDays).includes('none'):v==='oct6'?/oct(ober)?\s*6|10\/6|day\s*1/i.test(s.cannotDays):v==='oct7'?/oct(ober)?\s*7|10\/7|day\s*2/i.test(s.cannotDays):v==='oct8'?/oct(ober)?\s*8|10\/8|day\s*3/i.test(s.cannotDays):true);
arr=filterByAny(arr,'durationFilter',(s,v)=>s.duration===v);
arr=filterByAny(arr,'opsFilter',(s,v)=>
  v==='recordYes' ? recordingAllowed(s.recording) :
  v==='recordNo' ? recordingNotAllowed(s.recording) :
  v==='preRecordYes' ? preRecordInterested(s.preRecord) :
  v==='techSupport' ? techSupportNeeded(s.techSupport) :

  v==='featureBreakout' ? featureHas(s.features,'Breakout Rooms') :
  v==='featurePolls' ? featureHas(s.features,'Polls') :
  v==='featureChat' ? featureHas(s.features,'Chat') :
  v==='featureQA' ? featureHas(s.features,'Q&A') :
  v==='featureScreen' ? featureHas(s.features,'Screen sharing') :
  v==='featureCaptions' ? featureHas(s.features,'Captions') :
  v==='featureTranscripts' ? featureHas(s.features,'Transcripts') :
  v==='featureVideoAudio' ? featureHas(s.features,'Ability to share video or audio') :
  v==='featureParticipantMgmt' ? featureHas(s.features,'Participant management') :
  v==='featureParticipantVideo' ? featureHas(s.features,'Ability of participants to show their video and come off mute') :

  v==='interpretation' ? interpretationNeeded(s.interpretation) :
  v==='interpreterAssist' ? interpreterSupportNeeded(s.interpreterAssist) :
  v==='ceuYes' ? ceuRelevant(s.ceu) :
  v==='ceuOptOut' ? opsText(s.ceu).includes('opt out') :
  v==='ceuNA' ? opsText(s.ceu).includes('creative space') :
  v==='scholarship' ? scholarshipRequested(s.scholarship) :
  true
);
  arr=filterByAny(arr,'schedulingStatusFilter',(s,v)=>(getSchedule(s.id).status||'Unscheduled')===v);
if(state.quickFilter==='undecided')arr=arr.filter(s=>getDecision(s.id)==='Unreviewed');
if(state.quickFilter==='unscheduled')arr=arr.filter(s=>{
  const d = getDecision(s.id);
  const isAccepted = d === 'Accept' || d === 'Conditional accept';
  const isUnscheduled = (getSchedule(s.id).status || 'Unscheduled') === 'Unscheduled';
  return isAccepted && isUnscheduled;
});
if(state.quickFilter==='scheduleErrors')arr=arr.filter(s=>hasScheduleErrorMessages(s));
if(state.quickFilter==='coaching')arr=arr.filter(s=>{
  const notes = String(getNotes(s.id) || '').toLowerCase();
  return notes.includes('tag_coaching');
});
if(state.quickFilter==='notReviewedLisa')arr=arr.filter(s=>!reviewedBy(s,'lisa'));
if(state.quickFilter==='disagree')arr=arr.filter(s=>s.reviewSpread>=1.5);
if(state.quickFilter==='sharedAuthor')arr=arr.filter(s=>getSharedAuthorMatches(s.id).length>0);
if(state.quickFilter==='hasNotes')arr=arr.filter(s=>{
  const decisionNotes = getNotes(s.id);
  const schedulingNotes = getSchedule(s.id).notes || '';
  return hasMeaningfulNoteText(decisionNotes) || hasMeaningfulNoteText(schedulingNotes);
});
if(state.quickFilter==='flag')arr=arr.filter(s=>{
  const decisionNotes = getNotes(s.id) || '';
  const schedulingNotes = getSchedule(s.id).notes || '';
  return /\btag_flag\b/i.test(decisionNotes) || /\btag_flag\b/i.test(schedulingNotes);
});
  const sort=els.sortBy.value; arr.sort((a,b)=> sort==='reviewDesc'?(b.reviewAvg??-1)-(a.reviewAvg??-1):sort==='titleAsc'?a.title.localeCompare(b.title):sort==='historyDesc'?b.historicalCount-a.historicalCount||b.maxHistoricalAttendance-a.maxHistoricalAttendance:sort==='reviewsAsc'?a.completedReviews-b.completedReviews:sort==='submittedAsc'?String(a.submittedDate).localeCompare(String(b.submittedDate)):sort==='timeZoneAsc'?String(a.timeZone).localeCompare(String(b.timeZone)):(b.decisionScore-a.decisionScore)); return arr;}

  function renderKpis(){
  if(!state.submissions.length){
    els.kpis.innerHTML='';
    return;
  }

  const s = state.submissions;

  const acceptedItems = s.filter(x=>getDecision(x.id)==='Accept'||getDecision(x.id)==='Conditional accept');
  const accepted = acceptedItems.length;
  const declined = s.filter(x=>getDecision(x.id)==='Decline').length;
  const undecided = s.filter(x=>{
  const d = getDecision(x.id);
  return d === 'Unreviewed' || d === 'Hold / unsure';
}).length;
  const unscheduled = s.filter(x=>(getSchedule(x.id).status||'Unscheduled')==='Unscheduled').length;

  const returningPresenterMap = new Map();

  s.forEach(sub=>{
    (sub.historicalMatches||[]).forEach(h=>{
      const key = norm(h.currentPresenter || h.speakerName || h.name || '');
      if(!key) return;

      if(!returningPresenterMap.has(key)){
        returningPresenterMap.set(key,{
          accepted:false,
          declined:false,
          other:false
        });
      }

      const bucket = returningPresenterMap.get(key);
      const d = getDecision(sub.id);

      if(d === 'Accept' || d === 'Conditional accept'){
        bucket.accepted = true;
      }else if(d === 'Decline'){
        bucket.declined = true;
      }else{
        bucket.other = true;
      }
    });
  });

  let returningAccepted = 0;
  let returningDeclined = 0;
  let returningUndecided = 0;

  returningPresenterMap.forEach(bucket=>{
    if(bucket.accepted){
      returningAccepted++;
    }else if(bucket.declined){
      returningDeclined++;
    }else{
      returningUndecided++;
    }
  });

  const returningPresenters = returningPresenterMap.size;
  const totalPresenterSlots = s.reduce((sum,x)=>sum+(x.presenters?.length||0),0);

  const scored = s.filter(x=>x.reviewAvg!=null);
  const avg = scored.reduce((a,b)=>a+b.reviewAvg,0)/(scored.length||1);

  const acceptedScored = acceptedItems.filter(x=>x.reviewAvg!=null);
  const acceptedAvg = acceptedScored.length
    ? acceptedScored.reduce((a,b)=>a+b.reviewAvg,0)/acceptedScored.length
    : null;

  const data = [
    ['Submissions',s.length,s.length],
    ['Undecided',undecided,s.length],
    ['Declined',declined,s.length],
    ['Accepted',accepted,s.length],
    ['Unscheduled',unscheduled,s.length],
    ['Overall avg review',avg.toFixed(2),5],
    ['Accepted avg review',acceptedAvg==null?'—':acceptedAvg.toFixed(2),5]
  ];

  const normalKpis = data.map(([l,v,max],i)=>{
    const n = Number(v)||0;
    const isReviewAvg = l === 'Overall avg review' || l === 'Accepted avg review';
    const pct = isReviewAvg ? (n/5*100) : (n/(max||1)*100);
    return `<div class="kpi"><b>${v}</b><span>${l}</span><div class="kpiBar"><i style="width:${Math.max(3,Math.min(100,pct))}%"></i></div></div>`;
  }).join('');

  const acceptedPct = totalPresenterSlots ? returningAccepted / totalPresenterSlots * 100 : 0;
  const declinedPct = totalPresenterSlots ? returningDeclined / totalPresenterSlots * 100 : 0;
  const undecidedPct = totalPresenterSlots ? returningUndecided / totalPresenterSlots * 100 : 0;

  const returningKpi = `
    <div class="kpi">
      <b>${returningPresenters}</b>
      <span>Returning presenters</span>
      <div class="kpiBar stacked" title="Returning accepted: ${returningAccepted} • Returning declined: ${returningDeclined} • Returning not accepted/declined yet: ${returningUndecided} • Non-returning presenter slots: ${Math.max(0,totalPresenterSlots-returningPresenters)}">
        <span class="returnAccepted" style="width:${Math.max(0,Math.min(100,acceptedPct))}%"></span>
        <span class="returnDeclined" style="width:${Math.max(0,Math.min(100,declinedPct))}%"></span>
        <span class="returnUndecided" style="width:${Math.max(0,Math.min(100,undecidedPct))}%"></span>
      </div>
    </div>
  `;

  els.kpis.innerHTML = normalKpis + returningKpi;
}

function renderList(){
  const arr=filtered();
  if(els.visibleCardCount) els.visibleCardCount.textContent=arr.length;

  if(!arr.length){
    if(els.visibleCardCount) els.visibleCardCount.textContent=0;
    els.list.innerHTML='<div class="empty">No submissions match the current filters.</div>';
    return;
  }

  els.list.innerHTML=arr.map(s=>{
    const presenterName = s.presenters[0]?.name || 'No presenter listed';
    const presentationType = s.type || 'No type listed';
    const score = s.reviewAvg ?? '—';

const sch = getSchedule(s.id);
const scheduledClass = sch.status === 'Scheduled' ? 'schedule-status-scheduled' : '';

return `
  <div class="item ${s.id===state.selectedId?'active':''} ${scheduledClass} decision-${decisionColor(getDecision(s.id))}" data-id="${esc(s.id)}">
        <h3>${esc(s.title)}</h3>
        <div class="cardMetaLine">
          <span>${esc(presenterName)}</span>
          <span>${esc(presentationType)}</span>
          <span>Score ${esc(score)}</span>
        </div>
      </div>
    `;
  }).join('');

  // Delegated click/keyboard handlers are attached once during initialization.
  // Make items focusable for keyboard interaction
  els.list.querySelectorAll('.item').forEach(el=>el.tabIndex = 0);
}
function scrollSelectedLeftCardToTop(){
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      const list = els.list;
      if(!list || !state.selectedId) return;

      const selected = list.querySelector(`.item[data-id="${CSS.escape(state.selectedId)}"]`);
      if(!selected) return;

      const listRect = list.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();

      list.scrollTop += selectedRect.top - listRect.top;
    });
  });
}
function scheduleDayOptionsForSheet(selectedDay){
  selectedDay = clean(selectedDay || '');
  const days = [...new Set(skeletonRows().map(r=>r.day).filter(Boolean))];

  return `
    <option value="">—</option>
    ${days.map(day=>optionHTML(day, day, selectedDay)).join('')}
  `;
}
function skeletonSlotDurationLabel(slot){
  if(!slot) return '';

  const start = parseSkeletonTimeToMinutes(stripTimeZoneLabel(slot.start));
  let end = parseSkeletonTimeToMinutes(stripTimeZoneLabel(slot.end));

  if(start == null || end == null) return '';

  if(end <= start){
    end += 1440;
  }

  const mins = end - start;

  return mins > 0 ? ` (${mins} mins)` : '';
}
function scheduleStartOptionsForSheet(selectedDay, selectedStart){
  selectedDay = clean(selectedDay || '');
  selectedStart = clean(selectedStart || '');

  const rows = skeletonRows().filter(r=>!selectedDay || r.day === selectedDay);

  return `
    <option value="">—</option>
${rows.map(slot=>optionHTML(
  slot.start,
  `${scheduleRangeDisplay(slot)} — ${slot.type}${skeletonSlotDurationLabel(slot)}`,
  selectedStart
)).join('')}
  `;
}

function saveSheetScheduleChange(id, patch){
  const current = getSchedule(id);
  const next = {
    ...current,
    ...patch
  };

  next.day = clean(next.day || '');
  next.start = clean(next.start || '');
  next.status = clean(next.status || 'Unscheduled');

  // If user chooses Unscheduled anywhere, fully clear schedule assignment.
  if(next.status === 'Unscheduled'){
    next.day = '';
    next.start = '';
    next.end = '';
    next.skeletonType = '';
  }

  // If day is cleared, fully unschedule.
  if(!next.day){
    next.start = '';
    next.end = '';
    next.skeletonType = '';
    next.status = 'Unscheduled';
  }

  // If start is cleared but day remains, keep as Tentative.
  if(next.day && !next.start){
    next.end = '';
    next.skeletonType = '';

    if(next.status === 'Scheduled'){
      next.status = 'Tentative';
    }
  }

  const slot = findSkeletonSlot(next.day, next.start);
  const duration = Number(next.durationMinutes) || '';

  if(slot){
    next.end = duration
      ? addMinutesToTimeLabel(next.start, duration)
      : slot.end || '';

    next.skeletonType = slot.type || '';

    if(!next.status || next.status === 'Unscheduled'){
      next.status = 'Scheduled';
    }
  }

  saveSchedule(id,next);

  state.selectedId = id;

  return next;
}
function scheduleStatusOptions(selectedStatus){
  const statuses = ['Unscheduled','Tentative','Scheduled'];
  return statuses.map(status=>`
    <option value="${esc(status)}" ${(selectedStatus || 'Unscheduled') === status ? 'selected' : ''}>${esc(status)}</option>
  `).join('');
}
function updateSheetScheduleRowUI(id){
  const row = document.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
  if(!row) return;

  const sch = getSchedule(id);

  const daySelect = row.querySelector('[data-sheet-schedule-day]');
  const startSelect = row.querySelector('[data-sheet-schedule-start]');
  const statusSelect = row.querySelector('[data-sheet-schedule-status]');

  if(daySelect){
    daySelect.value = sch.day || '';
  }

  if(startSelect){
    startSelect.disabled = !sch.day;
    startSelect.innerHTML = scheduleStartOptionsForSheet(sch.day || '', sch.start || '');
    startSelect.value = sch.start || '';
  }

  if(statusSelect){
    statusSelect.value = sch.status || 'Unscheduled';
    statusSelect.classList.toggle('scheduleStatusScheduled', sch.status === 'Scheduled');
  }

  row.classList.toggle('schedule-row-scheduled', sch.status === 'Scheduled');
}

function renderSheetMode(){
  if(!els.sheetRows) return;

  const sheetTable = document.querySelector('.sheetTable');
  if(sheetTable){
    sheetTable.classList.toggle('schedule-visible', !!state.sheetScheduleMode);
  }

  const scheduleToggle = $('sheetScheduleToggle');
  if(scheduleToggle){
    scheduleToggle.classList.toggle('active', !!state.sheetScheduleMode);
    scheduleToggle.textContent = state.sheetScheduleMode ? 'Hide schedule' : 'Schedule';
scheduleToggle.onclick = ()=>{
  state.sheetScheduleMode = !state.sheetScheduleMode;

  const sheetTable = document.querySelector('.sheetTable');
  if(sheetTable){
    sheetTable.classList.toggle('schedule-visible', !!state.sheetScheduleMode);
  }

  scheduleToggle.classList.toggle('active', !!state.sheetScheduleMode);
  scheduleToggle.textContent = state.sheetScheduleMode ? 'Hide schedule' : 'Schedule';

  persistBuiltDataset();
};
  }

  let arr = filtered();
const ss = state.sheetSort || {};

function sheetSortValue(s, col){
  switch(col){
    case 'status':
      return (getDecision(s.id)||'').toLowerCase();

    case 'title':
      return (s.title||'').toLowerCase();

    case 'type':
      return (s.type||'').toLowerCase();

    case 'theme':
      return (s.theme||'').toLowerCase();

    case 'score':
      return Number(s.reviewAvg)||0;

    case 'speakers':
      return ((s.presenters||[]).map(p=>p.name).join(' ')||'').toLowerCase();

    case 'scheduleDay': {
      const day = (getSchedule(s.id).day || '').toLowerCase();

      // Keeps blank/unscheduled days at the bottom.
      if(!day) return 999;

      if(day.includes('oct 6') || day.includes('october 6')) return 1;
      if(day.includes('oct 7') || day.includes('october 7')) return 2;
      if(day.includes('oct 8') || day.includes('october 8')) return 3;

      return day;
    }

    case 'scheduleStart':
      return parseSkeletonTimeToMinutes(getSchedule(s.id).start || '') ?? 99999;

    case 'scheduleStatus':
      return (getSchedule(s.id).status || 'Unscheduled').toLowerCase();

    default:
      return '';
  }
}

function compareSheetValues(a,b,col,dir=1){
  const va = sheetSortValue(a,col);
  const vb = sheetSortValue(b,col);

  if(va<vb) return -1*dir;
  if(va>vb) return 1*dir;
  return 0;
}

if(ss.col){
  arr = arr.slice().sort((a,b)=>{
    const dir = ss.dir || 1;

    // Special scheduling sort:
    // Clicking Schedule Day gives Day first, Start Time second.
    if(ss.col === 'scheduleDay'){
      return (
        compareSheetValues(a,b,'scheduleDay',dir) ||
        compareSheetValues(a,b,'scheduleStart',1) ||
        compareSheetValues(a,b,'title',1)
      );
    }

    // Clicking Start Time gives Start Time first, Day second.
    // Useful if you want to see all 5:00 blocks together across days.
    if(ss.col === 'scheduleStart'){
      return (
        compareSheetValues(a,b,'scheduleStart',dir) ||
        compareSheetValues(a,b,'scheduleDay',1) ||
        compareSheetValues(a,b,'title',1)
      );
    }

    // Normal one-column sort for everything else.
    return (
      compareSheetValues(a,b,ss.col,dir) ||
      compareSheetValues(a,b,'title',1)
    );
  });
}

  if(!arr.length){
    els.sheetRows.innerHTML = `<tr><td colspan="${state.sheetScheduleMode ? 9 : 6}">No submissions match the current filters.</td></tr>`;
    return;
  }

  els.sheetRows.innerHTML = arr.map(s=>{
    const currentDecision = getDecision(s.id);
    const decisionClass = `decision-${decisionColor(currentDecision)}`;
    const sch = getSchedule(s.id);
    const scheduledClass = sch.status === 'Scheduled' ? 'schedule-row-scheduled' : '';

    const speakerNames = (s.presenters||[])
      .map(p=>p.name)
      .filter(Boolean)
      .join(', ') || '—';

    return `
      <tr data-id="${esc(s.id)}" class="${decisionClass} ${scheduledClass}">
        <td>
          <select class="sheetStatusSelect ${decisionClass}" data-sheet-decision="${esc(s.id)}">
            ${['Unreviewed','Accept','Conditional accept','Hold / unsure','Decline'].map(status=>`
              <option value="${esc(status)}" ${currentDecision===status?'selected':''}>${esc(status)}</option>
            `).join('')}
          </select>
        </td>

        <td class="sheetTitle" data-open-sheet-record="${esc(s.id)}">${esc(s.title||'Untitled')}</td>
        <td class="sheetSmall">${esc(s.type||'—')}</td>
        <td class="sheetSmall">${esc(s.theme||'—')}</td>
        <td>${esc(s.reviewAvg??'—')}</td>
        <td class="sheetSmall sheetSpeakers">${esc(speakerNames)}</td>

        <td class="sheetScheduleCol">
          <select class="sheetScheduleSelect" data-sheet-schedule-day="${esc(s.id)}">
            ${scheduleDayOptionsForSheet(sch.day || '')}
          </select>
        </td>

        <td class="sheetScheduleCol">
          <select class="sheetScheduleSelect" data-sheet-schedule-start="${esc(s.id)}" ${sch.day ? '' : 'disabled'}>
            ${scheduleStartOptionsForSheet(sch.day || '', sch.start || '')}
          </select>
        </td>

        <td class="sheetScheduleCol">
<select class="sheetScheduleSelect ${(sch.status || 'Unscheduled') === 'Scheduled' ? 'scheduleStatusScheduled' : ''}" data-sheet-schedule-status="${esc(s.id)}">
${scheduleStatusOptions(sch.status || 'Unscheduled')}
          </select>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll('[data-sheet-decision]').forEach(sel=>{
    sel.onchange=()=>{
      saveDecision(sel.dataset.sheetDecision,sel.value,getNotes(sel.dataset.sheetDecision));
      renderAll(false);
    };
  });

els.sheetRows.onchange = e=>{
  const sel = e.target;
  if(!sel) return;

  let id = '';

  if(sel.matches('[data-sheet-schedule-day]')){
    id = sel.dataset.sheetScheduleDay;

    saveSheetScheduleChange(id,{
      day:sel.value,
      start:'',
      end:'',
      skeletonType:'',
      status:sel.value ? 'Tentative' : 'Unscheduled'
    });

    updateSheetScheduleRowUI(id);
    renderKpis();
    renderList();
    renderDetail();
    return;
  }

  if(sel.matches('[data-sheet-schedule-start]')){
    id = sel.dataset.sheetScheduleStart;

    const current = getSchedule(id);
    const slot = findSkeletonSlot(current.day, sel.value);

    saveSheetScheduleChange(id,{
      start:sel.value,
      end:slot?.end || '',
      skeletonType:slot?.type || '',
status: sel.value
  ? 'Scheduled'
  : (current.day ? 'Tentative' : 'Unscheduled')
    });

    updateSheetScheduleRowUI(id);
    renderKpis();
    renderList();
    renderDetail();
    return;
  }
if(sel.matches('[data-sheet-schedule-status]')){
  id = sel.dataset.sheetScheduleStatus;

  if(sel.value === 'Unscheduled'){
    saveSheetScheduleChange(id,{
      day:'',
      start:'',
      end:'',
      skeletonType:'',
      status:'Unscheduled'
    });
  }else{
    saveSheetScheduleChange(id,{
      status:sel.value
    });
  }

  updateSheetScheduleRowUI(id);
  renderKpis();
  renderList();
  renderDetail();
  return;
}
};

  document.querySelectorAll('[data-open-sheet-record]').forEach(cell=>{
    cell.onclick=()=>{
      state.selectedId=cell.dataset.openSheetRecord;

      document.body.classList.remove('sheet-view','sheet-fullscreen');

      if(els.sheetModeBtn) els.sheetModeBtn.classList.remove('sage');
      if(els.sheetExpandBtn) els.sheetExpandBtn.classList.remove('active');

      renderAll();
      scrollSelectedLeftCardToTop();
    };
  });

  document.querySelectorAll('.sheetSortBtn').forEach(btn=>{
    btn.onclick=()=>{
      const col=btn.dataset.col;

      if(state.sheetSort.col===col){
        state.sheetSort.dir = -state.sheetSort.dir;
      }else{
        state.sheetSort.col = col;
        state.sheetSort.dir = 1;
      }

      document.querySelectorAll('.sheetSortBtn').forEach(b=>{
        b.classList.toggle('active', b.dataset.col===state.sheetSort.col && state.sheetSort.dir===-1);
      });

      renderSheetMode();
    };
  });

  const allTypes = Array.from(new Set(state.submissions.map(s=>String(s.type||'').trim()).filter(Boolean))).sort();
  const allThemes = Array.from(new Set(state.submissions.map(s=>String(s.theme||'').trim()).filter(Boolean))).sort();
  const allStatuses = ['Unreviewed','Accept','Conditional accept','Hold / unsure','Decline'];

  const typePanel = document.querySelector('.sheetMultiFilter[data-col="type"] .sheetMultiPanel');
  const themePanel = document.querySelector('.sheetMultiFilter[data-col="theme"] .sheetMultiPanel');
  const statusPanel = document.querySelector('.sheetMultiFilter[data-col="status"] .sheetMultiPanel');

  if(typePanel){
    const vals = getSheetColValues('type');
    typePanel.innerHTML = allTypes.map(t=>`<label><input type="checkbox" value="${esc(t)}" ${vals.includes(t)?'checked':''}> ${esc(t)}</label>`).join('');
  }

  if(themePanel){
    const vals = getSheetColValues('theme');
    themePanel.innerHTML = allThemes.map(t=>`<label><input type="checkbox" value="${esc(t)}" ${vals.includes(t)?'checked':''}> ${esc(t)}</label>`).join('');
  }

  if(statusPanel){
    const vals = getSheetColValues('status');
    statusPanel.innerHTML = allStatuses.map(sv=>`<label><input type="checkbox" value="${esc(sv)}" ${vals.includes(sv)?'checked':''}> ${esc(sv)}</label>`).join('');
  }

  document.querySelectorAll('.sheetMultiPanel input[type="checkbox"]').forEach(cb=>{
    cb.onchange = ()=>{
      const panel = cb.closest('.sheetMultiPanel');
      const col = cb.closest('.sheetMultiFilter').dataset.col;
      const checked = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked')).map(i=>i.value);
      setSheetColValues(col, checked);
    };
  });

  document.querySelectorAll('.sheetMultiFilter').forEach(f=>{
    const col = f.dataset.col;
    const btn = f.querySelector('.sheetMultiBtn');
    const vals = getSheetColValues(col);
    if(btn) btn.textContent = vals.length ? `${vals.length} selected` : 'All';
  });

  function resetSheetPanel(panel){
    if(!panel) return;
    panel.style.position = '';
    panel.style.left = '';
    panel.style.right = '';
    panel.style.top = '';
    panel.style.width = '';
    panel.style.maxHeight = '';
  }

  document.querySelectorAll('.sheetMultiBtn').forEach(btn=>{
    btn.onclick = ()=>{
      const filter = btn.closest('.sheetMultiFilter');
      const isOpen = filter.classList.contains('open');

      document.querySelectorAll('.sheetMultiFilter.open').forEach(f=>{
        if(f!==filter){
          f.classList.remove('open');
          resetSheetPanel(f.querySelector('.sheetMultiPanel'));
        }
      });

      if(isOpen){
        filter.classList.remove('open');
        resetSheetPanel(filter.querySelector('.sheetMultiPanel'));
        return;
      }

      filter.classList.add('open');

      const panel = filter.querySelector('.sheetMultiPanel');
      if(document.body.classList.contains('sheet-fullscreen') && panel){
        const rect = btn.getBoundingClientRect();
        panel.style.position = 'fixed';
        panel.style.left = `${rect.left}px`;
        panel.style.right = 'auto';
        panel.style.top = `${rect.bottom + 6}px`;
        panel.style.width = `${Math.max(rect.width,240)}px`;
        panel.style.maxHeight = `${Math.max(180, window.innerHeight - rect.bottom - 24)}px`;
      }
    };
  });
  // Final hydration pass: makes spreadsheet schedule columns reflect existing saved schedule state immediately.
if(state.sheetScheduleMode){
  arr.forEach(s=>updateSheetScheduleRowUI(s.id));
}
}

function formatTimeLabel(t){
  return formatSkeletonTime(t);
}

function dayIndex(day){
  const d=norm(day);
  if(d.includes('oct 6')) return 0;
  if(d.includes('oct 7')) return 1;
  if(d.includes('oct 8')) return 2;
  return 0;
}

function timeMinutes(t){
  const raw=clean(t).toLowerCase();
  const m=raw.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if(!m) return null;
  let h=Number(m[1]);
  const min=Number(m[2]);
  const ap=m[3].toLowerCase();
  if(ap==='pm' && h!==12) h+=12;
  if(ap==='am' && h===12) h=0;
  return h*60+min+(raw.includes('next day')?1440:0);
}

function slotAbsRange(day,start,end){
  const base=dayIndex(day)*1440;
  const s=timeMinutes(start);
  let e=timeMinutes(end);
  if(s==null || e==null) return null;
  if(e<=s) e+=1440;
  return {start:base+s,end:base+e};
}

function sessionScheduleRange(s){
  const sch = getSchedule(s.id);
  if(!sch.day || !sch.start) return null;

  const slot = findSkeletonSlot(sch.day, sch.start);

  // Prefer saved end if available, otherwise use skeleton end.
  const end = clean(sch.end || slot?.end || '');
  const type = clean(sch.skeletonType || slot?.type || '');

  if(!end) return null;

  const range = slotAbsRange(sch.day, sch.start, end);
  if(!range) return null;

  return {
    ...range,
    day: clean(sch.day),
    start: clean(sch.start),
    end,
    type
  };
}
function rangesOverlap(a,b){
  return a && b && a.start < b.end && b.start < a.end;
}
function scheduleSpeakerConflicts(currentId, day, start){
  const current = state.submissions.find(s => s.id === currentId);
  if(!current || !day || !start) return [];

  const currentSlot = findSkeletonSlot(day, start);
  if(!currentSlot) return [];

  const currentRange = slotAbsRange(currentSlot.day, currentSlot.start, currentSlot.end);
  if(!currentRange) return [];

  const conflicts = [];

  state.submissions.forEach(other => {
    if(other.id === currentId) return;
    if(getDecision(other.id) === 'Decline') return;

    const os = getSchedule(other.id);
    if(!os.day || !os.start) return;

    const otherSlot = findSkeletonSlot(os.day, os.start);
    if(!otherSlot) return;

    const otherRange = slotAbsRange(otherSlot.day, otherSlot.start, otherSlot.end);
    if(!rangesOverlap(currentRange, otherRange)) return;

    const matchedNames = presenterOverlapNames(current, other);
    if(!matchedNames.length) return;

    matchedNames.forEach(name => {
      conflicts.push({
        author: name,
        title: other.title || 'Untitled session',
        day: otherSlot.day,
        time: `${formatTimeLabel(otherSlot.start)}–${formatTimeLabel(otherSlot.end)} ET`,
        otherId: other.id
      });
    });
  });

  return conflicts;
}

function scheduleSlotDisplay(slot){
  if(!slot) return '';
  return `${slot.day} • ${scheduleRangeDisplay(slot)} • ${slot.type}`;
}

function formatMinutesAsTimeLabel(totalMinutes){
  const normalized = ((Number(totalMinutes) % 1440) + 1440) % 1440;
  let h = Math.floor(normalized / 60);
  const m = normalized % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if(h === 0) h = 12;
  return `${h}:${String(m).padStart(2,'0')} ${ap}`;
}

function addMinutesToTimeLabel(startValue, durationMinutes){
  const startMinutes = parseSkeletonTimeToMinutes(startValue);
  const duration = Number(durationMinutes);
  if(startMinutes == null || !duration) return '';

  const endMinutes = startMinutes + duration;
  const nextDay = endMinutes >= 1440 ? ' next day' : '';

  return `${formatMinutesAsTimeLabel(endMinutes)}${nextDay}`;
}

function minutesBetweenTimes(startValue, endValue){
  const startMinutes = parseSkeletonTimeToMinutes(startValue);
  const endMinutes = parseSkeletonTimeToMinutes(endValue);

  if(startMinutes == null || endMinutes == null) return 0;

  let diff = endMinutes - startMinutes;

  // Handles blocks that cross midnight or end labels like "1:00 AM next day"
  if(diff <= 0 || /next day/i.test(String(endValue || ''))){
    diff += 1440;
  }

  return diff > 0 ? diff : 0;
}

function getScheduleDurationMinutes(s, sch){
  if(Number(sch.durationMinutes)) return Number(sch.durationMinutes);
  return Number(getProposedDurationMinutes(s)) || '';
}
function getSlotDurationMinutes(slot){
  if(!slot || !slot.start || !slot.end) return '';

  const start = parseSkeletonTimeToMinutes(slot.start);
  let end = parseSkeletonTimeToMinutes(slot.end);

  if(start == null || end == null) return '';

  if(end <= start) end += 1440;

  return end - start;
}

function getSchedulingDisplayDuration(s, sch, matchedSlot){
  if(Number(sch.durationMinutes)) return Number(sch.durationMinutes);

  const blockDuration = getSlotDurationMinutes(matchedSlot);
  if(blockDuration) return blockDuration;

  return Number(getProposedDurationMinutes(s)) || '';
}

function getSchedulingDisplayEnd(s, sch, matchedSlot){
  const duration = getSchedulingDisplayDuration(s, sch, matchedSlot);

  if(duration && (sch.durationEdited || !matchedSlot?.end)){
    return addMinutesToTimeLabel(sch.start || matchedSlot?.start || '', duration);
  }

  return matchedSlot?.end || sch.end || '';
}

function getScheduleEndForDisplay(s, sch, matchedSlot){
  if(Number(sch.durationMinutes)){
    return addMinutesToTimeLabel(sch.start || matchedSlot?.start || '', Number(sch.durationMinutes));
  }

  return sch.end || matchedSlot?.end || '';
}

function scheduleHeatStyle(count){
  const n = Math.max(0, Math.min(5, Number(count) || 0));
  if(!n) return '';

  // 1 = green, 5 = orange
  const hue = 145 - ((n - 1) / 4) * 115;
  return `background:hsl(${hue}, 68%, 86%); border-color:hsl(${hue}, 58%, 58%);`;
}

function cleanEtText(value){
  return clean(value)
    .replace(/\s*ET\s*ET\b/gi,' ET')
    .replace(/\s+/g,' ')
    .trim();
}

function scheduleRangeDisplay(slot){
  if(!slot) return '';
  return `${cleanEtText(formatTimeLabel(slot.start))}–${cleanEtText(formatTimeLabel(slot.end))}`;
}
function getScheduleTimezoneInfo(s){
  const rawTimezone = getScheduleSignalValue(s,'timezone');
  const resolvedTimezone = resolvePresenterTimezone(rawTimezone);

  return {
    raw:clean(rawTimezone || ''),
    timezone:resolvedTimezone || '',
    label:clean(rawTimezone || resolvedTimezone || '')
  };
}

function isScheduleTimezoneViewActive(sessionId){
  return !!state.scheduleViewTimezones?.[sessionId];
}

function getScheduleViewTimezone(s){
  return state.scheduleViewTimezones?.[s.id] || CONFERENCE_TIMEZONE;
}

function formatScheduleTimeInView(day, timeValue, timezone, isEnd=false, startValue='', forceZone=false){
  if(!timezone || (!forceZone && timezone === CONFERENCE_TIMEZONE)){
    return cleanEtText(formatTimeLabel(timeValue));
  }

  const utc = skeletonStoredToUtc(day, timeValue, isEnd, startValue);
  if(!utc) return cleanEtText(formatTimeLabel(timeValue));

  return `${formatSkeletonTimeInZone(utc, timezone)} ${getSkeletonTzAbbreviation(timezone, utc)}`;
}

function formatScheduleDayInView(day, timeValue, timezone, forceZone=false){
  if(!timezone || (!forceZone && timezone === CONFERENCE_TIMEZONE)){
    return day;
  }

  const utc = skeletonStoredToUtc(day, timeValue, false);
  if(!utc) return day;

  return formatSkeletonDateInZone(utc, timezone);
}

function scheduleRangeDisplayInView(slot, timezone, forceZone=false){
  if(!slot) return '';

  const start = formatScheduleTimeInView(slot.day, slot.start, timezone, false, '', forceZone);
  const end = formatScheduleTimeInView(slot.day, slot.end, timezone, true, slot.start, forceZone);

  return `${start}–${end}`;
}

function scheduleSlotDisplayInView(slot, timezone, forceZone=false){
  if(!slot) return '';

  const dayLabel = formatScheduleDayInView(slot.day, slot.start, timezone, forceZone);
  return `${dayLabel} • ${scheduleRangeDisplayInView(slot, timezone, forceZone)} • ${slot.type}`;
}

function compactScheduleSlotDisplayInView(slot, timezone, forceZone=false){
  if(!slot) return '';

  const dayLabel = forceZone
    ? compactScheduleDayLabel(formatScheduleDayInView(slot.day, slot.start, timezone, true))
    : compactScheduleDayLabel(slot.day);

  return `${dayLabel} • ${scheduleRangeDisplayInView(slot, timezone, forceZone)}`;
}

function compactScheduleDayLabel(day){
  return clean(day || '')
    .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*/i,'')
    .trim();
}

function skeletonDurationLabel(slot){
  if(!slot) return '—';

  const s = timeMinutes(slot.start);
  let e = timeMinutes(slot.end);

  if(s == null || e == null) return '—';
  if(e <= s) e += 1440;

  const mins = e - s;
  if(mins <= 0) return '—';

  const h = Math.floor(mins / 60);
  const m = mins % 60;

  if(h && m) return `${h}h ${m}m`;
  if(h) return `${h}h`;
  return `${m}m`;
}

function getScheduleConflictList(s, selectedDay, selectedStart){
  if(!s || !selectedDay || !selectedStart) return [];

  const conflicts = [];
  const seen = new Set();

  function addConflict(c){
    if(!c || !c.author || !c.title) return;

const cleanConflict = {
  author:clean(c.author),
  title:clean(c.title || 'Untitled session'),
  day:clean(c.day || selectedDay),
  time:cleanEtText(c.time || ''),
  otherId:c.otherId || '',
  source:c.source || 'conflict'
};

    const key = `${norm(cleanConflict.author)}|${norm(cleanConflict.title)}|${norm(cleanConflict.day)}|${norm(cleanConflict.time)}`;
    if(seen.has(key)) return;

    seen.add(key);
    conflicts.push(cleanConflict);
  }

  scheduleSpeakerConflicts(s.id, selectedDay, selectedStart).forEach(c=>{
    addConflict({
      ...c,
      source:'exact'
    });
  });

  const exactKeys = new Set(
    conflicts.map(c=>`${norm(c.author)}|${norm(c.title)}`)
  );

  const sameStartScheduled = state.submissions.filter(other=>{
    if(other.id === s.id) return false;
    const os = getSchedule(other.id);
    return os.day === selectedDay && os.start === selectedStart;
  });

  sameStartScheduled.forEach(other=>{
    const names = loosePresenterOverlapNames(s, other);
    if(!names.length) return;

    names.forEach(name=>{
      const possibleKey = `${norm(name)}|${norm(other.title || 'Untitled session')}`;

      // If exact conflict detection already found this same person/session, do not add fallback duplicate.
      if(exactKeys.has(possibleKey)) return;

      const os = getSchedule(other.id);
      const otherSlot = findSkeletonSlot(os.day, os.start);

      addConflict({
        author:name,
        title:other.title || 'Untitled session',
        day:otherSlot?.day || os.day || selectedDay,
        time:otherSlot ? scheduleRangeDisplay(otherSlot) : cleanEtText(formatTimeLabel(os.start)),
        source:'possible'
      });
    });
  });

  return conflicts;
}

function conflictScheduleDisplayInView(conflict, timezone, forceZone=false){
  if(conflict?.otherId){
    const other = state.submissions.find(x=>x.id === conflict.otherId);
    const os = other ? getSchedule(other.id) : null;
    const slot = os ? findSkeletonSlot(os.day, os.start) : null;

    if(slot){
      return `${formatScheduleDayInView(slot.day, slot.start, timezone, forceZone)} (${scheduleRangeDisplayInView(slot, timezone, forceZone)})`;
    }
  }

  return `${conflict.day} (${cleanEtText(conflict.time)})`;
}

function getPlacedSessions(){
  return state.submissions.filter(s=>{
    const sch = getSchedule(s.id);
    return sch.day && sch.start;
  });
}

function buildScheduleCounts(items, getKey){
  const counts = {};
  items.forEach(s=>{
    const key = getKey(s) || 'Unspecified';
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function renderScheduleBalanceRows(counts, maxCount){
  const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]));

  if(!entries.length){
    return `<div class="scheduleBalanceRow empty">No sessions scheduled yet.</div>`;
  }

  return entries.map(([label,count])=>`
    <div class="scheduleBalanceRow">
      <b title="${esc(label)}">${esc(label)}</b>
      <span>${count}</span>
      <div class="progress">
        <span style="width:${maxCount ? Math.round(count / maxCount * 100) : 0}%"></span>
      </div>
    </div>
  `).join('');
}

function renderScheduleSummaryPanel(){
  const placed = getPlacedSessions();
  const maxCount = Math.max(1, ...Object.values(buildScheduleCounts(placed, s=>s.type || 'Unspecified')));

  const byDay = buildScheduleCounts(placed, s=>getSchedule(s.id).day || 'Unspecified');

  const bySlot = buildScheduleCounts(placed, s=>{
    const sch = getSchedule(s.id);
    const slot = findSkeletonSlot(sch.day, sch.start);
    return slot ? `${slot.day} • ${scheduleRangeDisplay(slot)}` : `${sch.day || 'Unspecified'} • ${formatTimeLabel(sch.start || '')}`;
  });

  const byType = buildScheduleCounts(placed, s=>s.type || 'Unspecified');
  const byTheme = buildScheduleCounts(placed, s=>s.theme || 'Unspecified');

  const localMax = obj => Math.max(1, ...Object.values(obj));

  return `
    <div class="scheduleBalancePanel">
      <h4>Schedule summary</h4>
      <div class="micro">Counts update from sessions with a selected day and start time.</div>

      <div class="scheduleBalanceSection">
        <div class="scheduleBalanceTitle"><span>By day</span><span>${placed.length} placed</span></div>
        ${renderScheduleBalanceRows(byDay, localMax(byDay))}
      </div>

      <div class="scheduleBalanceSection">
        <div class="scheduleBalanceTitle"><span>By time block</span><span>Blocks</span></div>
        ${renderScheduleBalanceRows(bySlot, localMax(bySlot))}
      </div>

      <div class="scheduleBalanceSection">
        <div class="scheduleBalanceTitle"><span>By session type</span><span>Types</span></div>
        ${renderScheduleBalanceRows(byType, localMax(byType))}
      </div>

      <div class="scheduleBalanceSection">
        <div class="scheduleBalanceTitle"><span>By theme</span><span>Themes</span></div>
        ${renderScheduleBalanceRows(byTheme, localMax(byTheme))}
      </div>
    </div>
  `;
}
function getSubmissionFieldValue(s, possibleNames){
  const wanted = possibleNames.map(norm);

  function labelLooksRight(key){
    const nk = norm(key || '');
    if(!nk) return false;

return wanted.some(w =>
  nk === w ||
  nk.includes(w)
);
  }

  function scanValue(value, depth=0){
    if(value == null || depth > 4) return '';

    if(typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'){
      return clean(value);
    }

    if(Array.isArray(value)){
      for(const item of value){
        const found = scanObject(item, depth + 1);
        if(found) return found;
      }
      return '';
    }

    if(typeof value === 'object'){
      return scanObject(value, depth + 1);
    }

    return '';
  }

  function scanObject(obj, depth=0){
    if(!obj || typeof obj !== 'object' || depth > 4) return '';

    // Direct key match first.
    for(const [key,value] of Object.entries(obj)){
      if(value == null || value === '') continue;

      if(labelLooksRight(key)){
        const direct = scanValue(value, depth + 1);
        if(direct) return direct;
      }
    }

    // Cvent-style objects often store a question label separately from the answer.
    for(const value of Object.values(obj)){
      if(!value || typeof value !== 'object') continue;

      const possibleLabel =
        value.label ||
        value.question ||
        value.name ||
        value.title ||
        value.field ||
        value.header ||
        value.column ||
        value.key;

      if(possibleLabel && labelLooksRight(possibleLabel)){
        const answer =
          value.answer ??
          value.value ??
          value.response ??
          value.text ??
          value.selected ??
          value.displayValue ??
          value.rawValue;

        const found = scanValue(answer, depth + 1);
        if(found) return found;
      }
    }

// Recursive fallback: only search nested objects/arrays, never random primitive values.
for(const value of Object.values(obj)){
  if(!value || typeof value !== 'object') continue;

  const found = scanValue(value, depth + 1);
  if(found) return found;
}

return '';
  }

  const sources = [
    s,
    s.raw,
    s.original,
    s.source,
    s.data,
    s.meta,
    s.form,
    s.responses,
    s.fields,
    s.answers,
    s.customFields
  ].filter(Boolean);

  for(const source of sources){
    const found = scanObject(source);
    if(found) return found;
  }

  return '';
}

function cleanScheduleSignalAnswer(value){
  const v = clean(value || '');

  if(!v) return '';

  // Avoid Cvent/internal ID-looking values.
  if(/^[a-f0-9-]{16,}$/i.test(v)) return '';
  if(/^[A-Z0-9_:-]{10,}$/i.test(v) && !/\s/.test(v)) return '';
  if(/^choice[_-]?\d+/i.test(v)) return '';
  if(/^option[_-]?\d+/i.test(v)) return '';
  if(/^answer[_-]?\d+/i.test(v)) return '';
  if(/^field[_-]?\d+/i.test(v)) return '';

  return v;
}

function formatOutsideBusinessHoursSignal(s){
  const v = cleanScheduleSignalAnswer(s.outsideBusinessHours);

  if(v){
    const nv = norm(v);

    if(nv === 'yes' || nv.includes('willing') || nv.includes('available') || nv.includes('outside business')){
      return 'Willing outside business hours';
    }

    if(nv === 'no' || nv.includes('not willing') || nv.includes('not available') || nv.includes('cannot')){
      return 'Not willing outside business hours';
    }

    return v;
  }

  const raw = cleanScheduleSignalAnswer(getSubmissionFieldValue(s, [
    'Can Present Outside Business Hours',
    'Are you able to present outside business hours',
    'Are you willing to present outside business hours',
    'Are you available outside business hours',
    'Can you present outside of your regular business hours',
    'Availability Outside Business Hours'
  ]));

  if(!raw) return '—';

  const nr = norm(raw);
  if(nr === 'yes') return 'Willing outside business hours';
  if(nr === 'no') return 'Not willing outside business hours';

  return raw;
}

function formatDayConstraintsSignal(s){
  const v = cleanScheduleSignalAnswer(s.cannotDays);

  if(v){
    const nv = norm(v);

    if(nv === 'none' || nv === 'no' || nv === 'n/a' || nv === 'na'){
      return 'No cannot-days listed';
    }

    return v;
  }

  const raw = cleanScheduleSignalAnswer(getSubmissionFieldValue(s, [
    'Day Constraints',
    'Date Constraints',
    'Schedule Constraints',
    'Scheduling Constraints',
    'Availability Constraints',
    'Unavailable Days',
    'Unavailable Dates',
    'Cannot Present',
    'Cannot Attend',
    'Days Cannot Present',
    'Dates Cannot Present',
    'Are there any days you cannot present',
    'Are there any dates you cannot present',
    'Please note any scheduling constraints',
    'Please list any scheduling constraints',
    'Do you have any scheduling constraints'
  ]));

  if(!raw) return '—';

  const nr = norm(raw);
  if(nr === 'none' || nr === 'no' || nr === 'n/a' || nr === 'na'){
    return 'No cannot-days listed';
  }

  return raw;
}

function getScheduleSignalValue(s, kind){
  if(kind === 'presentationType'){
    return s.type || getSubmissionFieldValue(s, [
      'Session Type',
      'Presentation Type',
      'Chosen Presentation Type',
      'Selected Presentation Type',
      'Type',
      'What type of session are you proposing',
      'Which session type are you submitting'
    ]) || '—';
  }

  if(kind === 'duration'){
    return getSubmissionFieldValue(s, [
      'Preferred Duration',
      'Preferred Session Duration',
      'Presentation Duration',
      'Session Duration',
      'Requested Duration',
      'Duration',
      'How long would you like your session to be',
      'What is your preferred session length',
      'Preferred length'
    ]) || (getProposedDurationMinutes(s) ? `${getProposedDurationMinutes(s)} minutes` : '—');
  }

  if(kind === 'timezone'){
    return s.timeZone || getSubmissionFieldValue(s, [
      'Time Zone',
      'Timezone',
      'Presenter Time Zone',
      'Primary Presenter Time Zone',
      'Speaker Time Zone',
      'What time zone are you in',
      'What time zone will you be presenting from',
      'Time zone from which you will present'
    ]) || '—';
  }

  if(kind === 'outsideBusinessHours'){
    return formatOutsideBusinessHoursSignal(s);
  }

  if(kind === 'dayConstraints'){
    return formatDayConstraintsSignal(s);
  }

  return '—';
}

function renderSchedulingSignals(s){
  const timezoneInfo = getScheduleTimezoneInfo(s);
  const timezoneActive = isScheduleTimezoneViewActive(s.id);

  const signals = [
    ['Chosen type', getScheduleSignalValue(s,'presentationType')],
    ['Preferred duration', getScheduleSignalValue(s,'duration')],
    ['Time zone', getScheduleSignalValue(s,'timezone')],
    ['Outside business hours', getScheduleSignalValue(s,'outsideBusinessHours')],
    ['Day constraints', getScheduleSignalValue(s,'dayConstraints')]
  ];

  return `
    <div class="scheduleSignalsBox">
      <h4>Scheduling signals</h4>
      <div class="scheduleSignalList">
        ${signals.map(([label,value])=>{
          const isTimezone = label === 'Time zone';
          const canToggleTimezone = isTimezone && clean(value || '') && clean(value || '') !== '—';
          const activeClass = isTimezone && timezoneActive ? 'scheduleTimezoneActive' : '';

          return `
            <div class="scheduleSignalLine ${activeClass}">
              <span>
                ${canToggleTimezone
                  ? `<button type="button" class="scheduleTzToggle" data-toggle-schedule-tz="${esc(s.id)}">${esc(label)}</button>`
                  : esc(label)
                }
              </span>
              <b>
                ${canToggleTimezone
                  ? `<button type="button" class="scheduleTzToggle" data-toggle-schedule-tz="${esc(s.id)}">${esc(value || '—')}</button>`
                  : esc(value || '—')
                }
              </b>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function getScheduledCountForSkeletonSlot(slot){
  if(!slot) return 0;

  const key = skeletonKey(slot.day, slot.start);

  return state.submissions.filter(session=>{
    const sch = getSchedule(session.id);
    if((sch.status || 'Unscheduled') !== 'Scheduled') return false;
    return skeletonKey(sch.day, sch.start) === key;
  }).length;
}

function getMatchingScheduleAidSlots(s, sch){
  const preferredDuration = Number(getPreferredDurationMinutes(s)) || '';
  const chosenType = getChosenPresentationType(s);
  const selectedDay = clean(sch?.day || '');

  return skeletonRows()
    .filter(slot=>{
      if(selectedDay && slot.day !== selectedDay) return false;

      const slotDuration = Number(getSlotDurationMinutes(slot)) || '';
      const typeMatches = scheduleTypeMatchesAllowed(chosenType, slot.type);
      const durationMatches = preferredDuration && slotDuration
        ? slotDuration === preferredDuration
        : true;

      return typeMatches && durationMatches;
    })
    .map(slot=>({
      ...slot,
      scheduledCount:getScheduledCountForSkeletonSlot(slot),
      duration:getSlotDurationMinutes(slot)
    }));
}

function getMatchingScheduleAidStartSet(s, sch){
  return new Set(
    getMatchingScheduleAidSlots(s, sch)
      .map(slot=>skeletonKey(slot.day, slot.start))
  );
}
function slotIsWithinPresenterNormalHours(s, slot){
  if(!s || !slot) return false;

  const rawTimezone = getScheduleSignalValue(s,'timezone');
  const presenterTimezone = resolvePresenterTimezone(rawTimezone);

  if(!presenterTimezone) return false;

  return !scheduledTimeOutsidePresenterWorkday(s, slot);
}

function getSessionsScheduledInSkeletonSlot(slot){
  if(!slot) return [];

  const key = skeletonKey(slot.day, slot.start);

  return state.submissions.filter(session=>{
    const sch = getSchedule(session.id);
    if((sch.status || 'Unscheduled') !== 'Scheduled') return false;
    return skeletonKey(sch.day, sch.start) === key;
  });
}

function renderScheduleAidSlotDetails(slot){
  const scheduled = getSessionsScheduledInSkeletonSlot(slot);

  if(!scheduled.length){
    return `
      <div class="scheduleAidDetails">
        <div class="scheduleAidDetailsTitle">Scheduled in this block</div>
        <div class="scheduleAidEmptyMini">No sessions currently scheduled in this block.</div>
      </div>
    `;
  }

  return `
    <div class="scheduleAidDetails">
      <div class="scheduleAidDetailsTitle">Scheduled in this block</div>
      <ul class="scheduleAidSessionList">
        ${scheduled.map(session=>{
          const authors = (session.presenters || [])
            .map(p=>clean(p.name))
            .filter(Boolean)
            .join(', ');

          return `
            <li>
              <b>${esc(session.title || 'Untitled session')}</b>
              ${authors ? `<br>${esc(authors)}` : ''}
            </li>
          `;
        }).join('')}
      </ul>
    </div>
  `;
}

function renderScheduleAid(s, sch){
  const chosenType = getChosenPresentationType(s);
  const preferredDuration = Number(getPreferredDurationMinutes(s)) || '';
  const selectedDay = clean(sch?.day || '');
  const selectedStart = clean(sch?.start || '');
    const viewTimezone = getScheduleViewTimezone(s);
  const forceViewTimezone = isScheduleTimezoneViewActive(s.id);
  const slots = getMatchingScheduleAidSlots(s, sch);

  const scopeText = selectedDay
    ? `Showing matching blocks for ${selectedDay}.`
    : 'Showing matching blocks across all days.';

  const criteriaText = [
    chosenType ? `Type: ${chosenType}` : '',
    preferredDuration ? `Duration: ${preferredDuration} min` : ''
  ].filter(Boolean).join(' • ') || 'No type/duration criteria detected.';

  return `
    <div class="scheduleAidBox">
      <h4>Matching blocks</h4>
      <div class="micro">${esc(scopeText)} ${esc(criteriaText)}</div>

      <div class="scheduleAidList">
${slots.length ? slots.map(slot=>{
  const key = skeletonKey(slot.day, slot.start);
  const active = selectedDay && selectedStart && skeletonKey(selectedDay, selectedStart) === key;
  const normalHours = slotIsWithinPresenterNormalHours(s, slot);
  const open = state.scheduleAidOpenSlots?.[s.id] === key;

  const rowClasses = [
    'scheduleAidRow',
    normalHours ? 'normalHours' : '',
    active ? 'active' : ''
  ].filter(Boolean).join(' ');

  return `
    <div class="${rowClasses}" data-schedule-aid-slot="${esc(key)}">
      <div class="scheduleAidMain">
        <div class="scheduleAidTime">
          ${esc(compactScheduleSlotDisplayInView(slot, viewTimezone, forceViewTimezone))}${slot.duration ? ` (${esc(slot.duration)} min)` : ''}
        </div>
      </div>
      <div class="scheduleAidCount" title="Sessions currently scheduled in this block">${slot.scheduledCount}</div>
      ${open ? renderScheduleAidSlotDetails(slot) : ''}
    </div>
  `;
}).join('') : `
          <div class="scheduleAidEmpty">
            No skeleton blocks match this session’s chosen type and preferred duration${selectedDay ? ' for the selected day' : ''}.
          </div>
        `}
      </div>
    </div>
  `;
}

function extractFirstNumber(value){
  const match = clean(value || '').match(/\d+/);
  return match ? Number(match[0]) : '';
}

function getPreferredDurationMinutes(s){
  const direct = Number(getProposedDurationMinutes(s)) || '';

  if(direct) return direct;

  const signal = getScheduleSignalValue(s,'duration');
  return extractFirstNumber(signal);
}

function normalizeScheduleType(value){
  const v = norm(value || '');

  if(!v) return '';

  if(v.includes('skill') || v.includes('institute')) return 'skill building institutes';
  if(v.includes('strategy')) return 'solution oriented strategy sessions';
  if(v.includes('creative') || v.includes('poetry') || v.includes('story') || v.includes('film')) return 'creative spaces';
  if(v.includes('international exchange') || v.includes('exchange')) return 'international exchange';
  if(v.includes('workshop')) return 'workshops';
  if(v.includes('keynote')) return 'keynote sessions';

  return v;
}
function splitScheduleTypes(value){
  return clean(value || '')
    .split(/\s*;\s*/g)
    .map(v=>clean(v))
    .filter(Boolean);
}

function scheduleTypeMatchesAllowed(chosenType, allowedTypesText){
  const chosen = normalizeScheduleType(chosenType);
  const allowed = splitScheduleTypes(allowedTypesText).map(normalizeScheduleType).filter(Boolean);

  if(!chosen || !allowed.length) return true;

  return allowed.includes(chosen);
}

function getChosenPresentationType(s){
  return cleanScheduleSignalAnswer(
    s.type ||
    getScheduleSignalValue(s,'presentationType') ||
    ''
  );
}

function dayNameFromScheduleDay(day){
  const d = clean(day || '').toLowerCase();

  if(d.includes('tuesday')) return 'tuesday';
  if(d.includes('wednesday')) return 'wednesday';
  if(d.includes('thursday')) return 'thursday';

  return '';
}

function monthDayFromScheduleDay(day){
  const d = clean(day || '').toLowerCase();

  if(d.includes('oct') && d.includes('6')) return 'october 6';
  if(d.includes('oct') && d.includes('7')) return 'october 7';
  if(d.includes('oct') && d.includes('8')) return 'october 8';

  return '';
}

function scheduledDayMatchesConstraint(selectedDay, constraints){
  const raw = cleanScheduleSignalAnswer(constraints || '');
  if(!raw || raw === '—') return null;

  const c = norm(raw);
  const dayName = dayNameFromScheduleDay(selectedDay);
  const monthDay = monthDayFromScheduleDay(selectedDay);

  if(!dayName && !monthDay) return null;

  const selectedDatePatterns = {
    'october 6':['october 6','oct 6','10/6','10-6','10.6','6 october','6 oct','october 06','oct 06','10/06','10-06'],
    'october 7':['october 7','oct 7','10/7','10-7','10.7','7 october','7 oct','october 07','oct 07','10/07','10-07'],
    'october 8':['october 8','oct 8','10/8','10-8','10.8','8 october','8 oct','october 08','oct 08','10/08','10-08']
  };

  const negativeSignals = [
    'cannot',
    'can not',
    "can't",
    'unavailable',
    'not available',
    'unable',
    'not able',
    'no availability',
    'conflict',
    'not possible'
  ];

  const hasNegativeSignal = negativeSignals.some(term=>c.includes(term));

  const dayHit = dayName && c.includes(dayName);
  const dateHit = monthDay && selectedDatePatterns[monthDay]?.some(pattern=>c.includes(pattern));

  if((dayHit || dateHit) && hasNegativeSignal){
    return {
      selectedDay,
      raw
    };
  }

  // Conservative fallback: if their entire cannot-days field is just "Tuesday" or "Oct 6",
  // treat it as a constraint even without words like "cannot."
  if(dayHit || dateHit){
    const shortAnswer = c.length <= 40;
    if(shortAnswer){
      return {
        selectedDay,
        raw
      };
    }
  }

  return null;
}
function resolvePresenterTimezone(value){
  const raw = clean(value);
  const n = norm(raw);

  if(!raw || raw === '—') return '';

  // If the field already contains a valid IANA timezone, use it directly.
  try{
    new Intl.DateTimeFormat('en-US', {timeZone:raw}).format(new Date());
    return raw;
  }catch(e){}

  const primaryTimezoneAbbreviations = {
    adt:'America/Halifax',
    aedt:'Australia/Sydney',
    akdt:'America/Anchorage',
    bst:'Europe/London',
    cdt:'America/Chicago',
    cest:'Europe/Paris',
    cst:'America/Chicago',
    edt:'America/New_York',
    eest:'Europe/Helsinki',
    jst:'Asia/Tokyo',
    mdt:'America/Denver',
    nzdt:'Pacific/Auckland',
    pdt:'America/Los_Angeles',
    pkt:'Asia/Karachi'
  };

  // Exact abbreviation match: "CDT"
  if(primaryTimezoneAbbreviations[n]){
    return primaryTimezoneAbbreviations[n];
  }

  // Token abbreviation match: "CDT - Central Daylight Time", "UTC-05:00 CDT", etc.
  const tokens = n.split(' ').filter(Boolean);
  for(const token of tokens){
    if(primaryTimezoneAbbreviations[token]){
      return primaryTimezoneAbbreviations[token];
    }
  }

  // Australia / New Zealand first so AEDT never gets mistaken for EDT.
  if(n.includes('sydney') || n.includes('melbourne') || n.includes('canberra') || n.includes('australia eastern') || n.includes('australian eastern') || n.includes('australian eastern daylight') || n.includes('australian eastern standard')){
    return 'Australia/Sydney';
  }

  if(n.includes('adelaide') || n.includes('darwin') || n.includes('australia central') || n.includes('australian central') || n.includes('australian central daylight') || n.includes('australian central standard')){
    return 'Australia/Adelaide';
  }

  if(n.includes('perth') || n.includes('western australia')){
    return 'Australia/Perth';
  }

  if(n.includes('auckland') || n.includes('wellington') || n.includes('new zealand')){
    return 'Pacific/Auckland';
  }

  // Europe / Asia
  if(n.includes('london') || n.includes('united kingdom') || n.includes('british summer') || n === 'uk' || n === 'gmt'){
    return 'Europe/London';
  }

  if(n.includes('central european') || n.includes('paris') || n.includes('berlin') || n.includes('rome')){
    return 'Europe/Paris';
  }

  if(n.includes('eastern european') || n.includes('helsinki') || n.includes('athens')){
    return 'Europe/Helsinki';
  }

  if(n.includes('japan') || n.includes('tokyo')){
    return 'Asia/Tokyo';
  }

  if(n.includes('pakistan') || n.includes('karachi')){
    return 'Asia/Karachi';
  }

  // Americas
  if(n.includes('halifax') || n.includes('atlantic daylight') || n.includes('atlantic standard') || n.includes('atlantic time')){
    return 'America/Halifax';
  }

  if(n.includes('anchorage') || n.includes('alaska daylight') || n.includes('alaska standard') || n.includes('alaska time')){
    return 'America/Anchorage';
  }

  if(n.includes('bogota') || n.includes('colombia')){
    return 'America/Bogota';
  }

  if(n.includes('denver') || n.includes('mountain daylight') || n.includes('mountain standard') || n.includes('mountain time') || n.includes('us mountain') || n.includes('u s mountain') || n === 'mt'){
    return 'America/Denver';
  }

  if(n.includes('new york') || n.includes('eastern daylight') || n.includes('eastern standard') || n.includes('eastern time') || n.includes('us eastern') || n.includes('u s eastern') || n === 'et'){
    return 'America/New_York';
  }

  if(n.includes('chicago') || n.includes('central daylight') || n.includes('central standard') || n.includes('central time') || n.includes('us central') || n.includes('u s central') || n === 'ct'){
    return 'America/Chicago';
  }

  if(n.includes('los angeles') || n.includes('pacific daylight') || n.includes('pacific standard') || n.includes('pacific time') || n.includes('us pacific') || n.includes('u s pacific') || n === 'pt'){
    return 'America/Los_Angeles';
  }

  if(n.includes('hawaii')){
    return 'Pacific/Honolulu';
  }

  return '';
}

function getMinutesInTimezone(dateObj, timezone){
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone:timezone,
    hour:'2-digit',
    minute:'2-digit',
    hour12:false
  }).formatToParts(dateObj);

  const map = {};
  parts.forEach(p=>map[p.type]=p.value);

  let h = Number(map.hour);
  if(h === 24) h = 0;

  return h * 60 + Number(map.minute || 0);
}

function formatTimeInTimezone(dateObj, timezone, includeZone=true){
  return new Intl.DateTimeFormat('en-US', {
    timeZone:timezone,
    hour:'numeric',
    minute:'2-digit',
    hour12:true,
    ...(includeZone ? {timeZoneName:'shortOffset'} : {})
  }).format(dateObj);
}

function scheduledTimeOutsidePresenterWorkday(s, matchedSlot){
  if(!matchedSlot) return null;

  const rawTimezone = getScheduleSignalValue(s,'timezone');
  const presenterTimezone = resolvePresenterTimezone(rawTimezone);

  if(!presenterTimezone) return null;

  const startUtc = skeletonStoredToUtc(matchedSlot.day, matchedSlot.start, false);
  const endUtc = skeletonStoredToUtc(matchedSlot.day, matchedSlot.end, true, matchedSlot.start);

  if(!startUtc || !endUtc) return null;

  const startLocal = getMinutesInTimezone(startUtc, presenterTimezone);
  const endLocal = getMinutesInTimezone(endUtc, presenterTimezone);

  const workStart = 8 * 60;
  const workEnd = 17 * 60;

  const outside =
    startLocal < workStart ||
    startLocal >= workEnd ||
    endLocal <= workStart ||
    endLocal > workEnd ||
    getSkeletonLocalDateString(startUtc, presenterTimezone) !== getSkeletonLocalDateString(endUtc, presenterTimezone);

  if(!outside) return null;

  return {
    rawTimezone,
    presenterTimezone,
localStart:formatTimeInTimezone(startUtc, presenterTimezone, false),
localEnd:formatTimeInTimezone(endUtc, presenterTimezone, true)
  };
}
function getSchedulingMismatchAlerts(s, sch, matchedSlot, scheduledDurationMinutes){
  const alerts = [];

  const isScheduled = (sch.status || 'Unscheduled') === 'Scheduled';

  if(!isScheduled) return alerts;

  if(!sch.day || !sch.start){
    const missingParts = [
      !sch.day ? 'day' : '',
      !sch.start ? 'start time' : ''
    ].filter(Boolean).join(' and ');

    alerts.push({
      title:'Incomplete schedule alert',
      message:`This session is marked Scheduled, but ${missingParts} ${missingParts.includes(' and ') ? 'are' : 'is'} not selected. Choose both a day and start time or change the status back to Unscheduled.`
    });

    return alerts;
  }

  if(!matchedSlot) return alerts;

  const preferredDuration = getPreferredDurationMinutes(s);
  const scheduledDuration = Number(scheduledDurationMinutes) || getSlotDurationMinutes(matchedSlot);
  const blockDuration = getSlotDurationMinutes(findSkeletonSlot(sch.day, sch.start) || matchedSlot);

  if(preferredDuration && scheduledDuration && preferredDuration !== scheduledDuration){
    alerts.push({
      title:'Duration mismatch alert',
      message:`Preferred duration is ${preferredDuration} minutes, but the scheduled time is ${scheduledDuration} minutes.`
    });
  }

  if(blockDuration && scheduledDuration && scheduledDuration > blockDuration){
    alerts.push({
      title:'Scheduled time exceeds block alert',
      message:`This session is scheduled for ${scheduledDuration} minutes, but the selected program block is only ${blockDuration} minutes.`
    });
  }

const chosenType = getChosenPresentationType(s);
const scheduledType = clean(matchedSlot.type || '');

if(chosenType && scheduledType && !scheduleTypeMatchesAllowed(chosenType, scheduledType)){
  alerts.push({
    title:'Presentation type mismatch alert',
    message:`Chosen presentation type is “${chosenType},” but this block allows “${scheduledType}.”`
  });
}

  const dayConstraint = formatDayConstraintsSignal(s);
  const dayConflict = scheduledDayMatchesConstraint(matchedSlot.day || sch.day, dayConstraint);

  if(dayConflict){
    alerts.push({
      title:'Day constraint alert',
      message:`This session is scheduled on ${dayConflict.selectedDay}, but the presenter listed a possible day/date constraint: “${dayConflict.raw}.”`
    });
  }

  const timezoneConflict = scheduledTimeOutsidePresenterWorkday(s, matchedSlot);

if(timezoneConflict){
  alerts.push({
    title:'Presenter timezone alert',
    message:`This session falls partly outside the presenter’s normal workday. Presenter timezone field: “${timezoneConflict.rawTimezone}.” Interpreted as ${timezoneConflict.presenterTimezone}. Local session time would be approximately ${timezoneConflict.localStart}–${timezoneConflict.localEnd}.`
  });
}

  return alerts;
}

function renderSchedulingMismatchAlerts(alerts){
  if(!alerts || !alerts.length) return '';

  return alerts.map(alert=>`
    <div class="scheduleAlertBox warning">
      <b>${esc(alert.title)}</b>
      ${esc(alert.message)}
    </div>
  `).join('');
}

function renderSchedulingTab(s){
  const sch = getSchedule(s.id);
  const rows = skeletonRows();

  const selectedDay = sch.day || '';
  const selectedStart = sch.start || '';
  const matchedSlot = findSkeletonSlot(selectedDay, selectedStart);
    const viewTimezone = getScheduleViewTimezone(s);
  const forceViewTimezone = isScheduleTimezoneViewActive(s.id);

  const days = [...new Set(rows.map(r=>r.day).filter(Boolean))];
  const startsForDay = rows.filter(r=>!selectedDay || r.day === selectedDay);
const durationMinutes = getSchedulingDisplayDuration(s, sch, matchedSlot);
const durationEdited = !!sch.durationEdited;
const displayEnd = matchedSlot ? getSchedulingDisplayEnd(s, sch, matchedSlot) : '';

const displaySlot = matchedSlot
  ? {
      ...matchedSlot,
      end: displayEnd || matchedSlot.end
    }
  : null;

const conflicts = getScheduleConflictList(s, selectedDay, selectedStart);
const schedulingMismatchAlerts = getSchedulingMismatchAlerts(
  s,
  sch,
  displaySlot || matchedSlot,
  durationMinutes
);

const assignmentText = displaySlot
  ? scheduleSlotDisplayInView(displaySlot, viewTimezone, forceViewTimezone)
    : selectedDay || selectedStart
      ? 'Incomplete — choose both day and start time.'
      : 'Not scheduled yet.';

const slotHint = displaySlot
  ? `
      <div class="scheduleHint clean">
        <span class="scheduleHintLine"><b>Matched skeleton slot:</b> ${esc(scheduleSlotDisplayInView(displaySlot, viewTimezone, forceViewTimezone))}</span>

        <span class="scheduleHintLine scheduleDurationLine">
<b>Scheduled duration:</b>
          <span>
            ${durationMinutes ? esc(durationMinutes + ' minutes') : 'Not detected'}
            ${durationEdited ? '<span class="scheduleDurationEditedTag">(edited)</span>' : ''}
          </span>
          <button type="button" class="scheduleDurationEditBtn" id="scheduleDurationEditBtn">Edit</button>
        </span>

        <div class="scheduleDurationEdit" id="scheduleDurationEditWrap" style="display:none">
          <input id="scheduleDurationInput" type="number" min="15" step="15" value="${esc(durationMinutes || '')}">
          <button type="button" class="btn" id="scheduleDurationCancel">Cancel</button>
          <button type="button" class="btn primary" id="scheduleDurationSave">Save duration</button>
        </div>
      </div>
    `
  : `<div class="scheduleHint warn"><b>No full skeleton slot selected.</b> Choose a day and start time.</div>`;
  const conflictBox = conflicts.length
    ? `
      <div class="scheduleConflictBox">
        <b>Speaker conflict alert</b>
        <ul class="scheduleConflictList">
          ${conflicts.map(c=>`
            <li>${esc(c.author)} is already scheduled for “${esc(c.title)}” on ${esc(conflictScheduleDisplayInView(c, viewTimezone, forceViewTimezone))}</li>
          `).join('')}
        </ul>
      </div>
    `
    : '';

return `
  <div class="scheduleTabLayout">
    <div class="scheduleGrid">
      <div class="scheduleCard simpleScheduleCard">
        <h4>Schedule this session</h4>
        <div class="micro">Select the official program block. All times in Scheduling are reflected in MT.</div>

        <div class="schedulePlainStatus">
          <b>Current</b>
          <span>${esc(assignmentText)}</span>

          <b>Status</b>
          <span>${esc(sch.status || 'Unscheduled')}</span>
        </div>

        <div class="scheduleControls simple">
          <label>
            Day
            <select class="select" id="scheduleDay">
              <option value="">Select day</option>
              ${days.map(d=>optionHTML(d,d,selectedDay)).join('')}
            </select>
          </label>

          <label>
            Start time MT
            <select class="select" id="scheduleStart">
              <option value="">Select start</option>
${startsForDay.map(slot=>{
  const matchingStarts = getMatchingScheduleAidStartSet(s, sch);
  const isRecommended = matchingStarts.has(skeletonKey(slot.day, slot.start));
  const count = getScheduledCountForSkeletonSlot(slot);
  const duration = getSlotDurationMinutes(slot);
  const startLabel = formatScheduleTimeInView(slot.day, slot.start, viewTimezone, false, '', forceViewTimezone);

  const label = isRecommended
    ? `★ ${startLabel} — ${slot.type}${duration ? ` (${duration} min)` : ''} • ${count} scheduled`
    : `${startLabel} — ${slot.type}${skeletonSlotDurationLabel(slot)} • ${count} scheduled`;

  return optionHTML(slot.start, label, selectedStart);
}).join('')}
            </select>
          </label>

          <label>
            Status
            <select class="select" id="scheduleStatus">
${scheduleStatusOptions(sch.status || 'Unscheduled')}
            </select>
          </label>
        </div>

${slotHint}
${conflictBox}
${renderSchedulingMismatchAlerts(schedulingMismatchAlerts)}

        <div class="scheduleNotesAlways">
          <label for="scheduleNotes">Scheduling notes</label>
          <textarea class="notes" id="scheduleNotes" placeholder="Presenter constraints, conflict rationale, timezone considerations...">${esc(sch.notes||'')}</textarea>
        </div>
      </div>
    </div>

    <div>
      ${renderSchedulingSignals(s)}
      ${renderScheduleAid(s, sch)}
    </div>
  </div>
`;
}

function renderDetail(){
  const activeTab = state.activeTab || 'overview';
  const s=state.submissions.find(x=>x.id===state.selectedId);
  if(!s){els.detail.innerHTML='<div class="empty">No submission selected.</div>';return;}
const presenters=s.presenters.map(p=>{
  const shared = presenterIsShared(p, s.id);
  const rolePill = shared
    ? `<button type="button" class="pill purple" data-open-shared-authors="${esc(s.id)}">${esc(p.role || 'Presenter')}</button>`
    : pill(p.role || 'Presenter','gray');

return `<div class="historyItem">
  <h5>${esc(p.name)} ${rolePill}</h5>
  <div class="micro">
    ${esc(p.title)}${p.organization?' • '+esc(p.organization):''}
    <br>${esc(p.email)}
    ${p.location ? `<br>${esc(p.location)}` : ''}
  </div>
  ${p.bio?`<details><summary class="micro">Bio</summary><div class="textBlock">${esc(p.bio)}</div></details>`:''}
</div>`
}).join('');
  const reviews=s.reviews.length?s.reviews.map(r=>`<div class="review"><strong>${esc(r.reviewer||'Reviewer')}</strong> ${pill('Avg '+(r.averageGrade??'—'),'reviewScore')}<div class="reviewGrid"><div class="metric"><b>${r.newThinking??'—'}</b><span>New thinking</span></div><div class="metric"><b>${r.spreadScope??'—'}</b><span>Spread/scope</span></div><div class="metric"><b>${r.usefulDiverse??'—'}</b><span>Usefulness</span></div><div class="metric"><b>${r.transformative??'—'}</b><span>Transform</span></div><div class="metric"><b>${r.averageGrade??'—'}</b><span>Average</span></div></div><div class="textBlock">${esc(r.comments||'No comment entered.')}</div></div>`).join(''):'<div class="empty">No completed reviews found.</div>';
  const history=s.historicalMatches.length?[...s.historicalMatches]
    .sort((a,b)=>String(b.year).localeCompare(String(a.year))||String(a.sessionName).localeCompare(String(b.sessionName)))
.map(h=>`<div class="historyItem"><details><summary class="historySummary"><h5>${esc(h.year)} • ${esc(h.sessionName)}</h5><div class="micro">${esc(h.currentPresenter)} matched as ${esc(h.speakerName)} • ${esc(h.matchConfidence)} • Attendance ${h.attendanceUnique||h.attendanceRows||h.registered||'—'}</div></summary><div class="historyDetails micro">Speaker report: Registered ${h.registered||'—'}<br>Attendance detail: Unique attendees ${h.attendanceUnique||'—'} • Rows ${h.attendanceRows||'—'} • Live ${h.liveRows||'—'} • On-demand ${h.onDemandRows||'—'}<br>Organization/company: ${esc(h.company||'—')}<br><b>Match method:</b> ${esc(h.matchConfidence)}. Exact email matches are the strongest signal; name-only matches should be verified.</div></details></div>`).join('')    :'<div class="empty">No historical presenter match found.</div>';
  const presenterBefore=s.historicalCount>0
  ? `${s.historicalCount} match${s.historicalCount===1?'':'es'}`
  : 'No';

const livedExperienceSignal = isYesish(s.scholarship)
  ? 'Yes — scholarship claimed'
  : 'Not indicated';

const scoreSignal=s.reviewAvg??'—';
const sharedAuthorFlag = sharedAuthorPill(s.id);
  els.detail.innerHTML=`<div class="detailHeader">
  <button type="button" class="detailHeaderCircleBtn detailDeleteBtn" data-delete-session="${esc(s.id)}" aria-label="Delete session" title="Delete session">×</button>
  <button type="button" class="detailHeaderCircleBtn detailEditBtn" data-edit-session="${esc(s.id)}" aria-label="Edit session" title="Edit session">✎</button>
  <button type="button" class="detailHeaderCircleBtn detailExpandBtn" aria-label="Toggle full screen detail" title="Expand panel">⤢</button>
  <div class="flagline">${pill(s.type,typeColor(s.type))}${pill(s.theme,themeColor(s.theme))}${pill(s.band,bandColor(s.band))}${s.historicalCount?pill('Historical presenter signal','teal'):pill('New / no history','gray')}${sharedAuthorFlag}${decisionPill(getDecision(s.id))}</div><h2>${esc(s.title)}</h2><p>${esc(s.description)}</p>${quickDecisionButtons(s.id)}</div><div class="detailBody"><div class="tabs"><button class="tab ${activeTab==='overview'?'active':''}" data-tab="overview">Overview</button><button class="tab ${activeTab==='reviews'?'active':''}" data-tab="reviews">Reviews</button><button class="tab ${activeTab==='history'?'active':''}" data-tab="history">History</button><button class="tab ${activeTab==='ops'?'active':''}" data-tab="ops">Ops</button><button class="tab ${activeTab==='scheduling'?'active':''}" data-tab="scheduling">Scheduling</button><button class="tab ${activeTab==='decision'?'active':''}" data-tab="decision">Decision</button></div><section class="section ${activeTab==='overview'?'active':''}" id="tab-overview"><div class="twoCol"><div class="panel"><h4>Proposal details</h4><div class="textBlock">${esc(s.abstract||s.description)}</div></div><div class="panel"><h4>Presenters</h4>${presenters}<h4>Tags</h4><div class="flagline">${s.tags.map(t=>pill(t,'gray')).join('')||'—'}</div></div></div></section><section class="section ${activeTab==='reviews'?'active':''}" id="tab-reviews"><div class="reviewSummaryStrip"><div class="reviewSummaryItem"><b>${s.reviewAvg??'—'}</b><span>Average</span></div><div class="reviewSummaryItem"><b>${s.decisionScore}</b><span>Weighted sort score</span></div></div>${reviews}</section><section class="section ${activeTab==='history'?'active':''}" id="tab-history"><div class="micro" style="margin-bottom:10px">Sorted newest to oldest by year. Matching uses exact presenter signal when email is unavailable or different.</div>${history}</section><section class="section ${activeTab==='ops'?'active':''}" id="tab-ops"><div class="panel"><h4>Scheduling + delivery snapshot</h4><table class="opsTable">${opsRows(s)}</table></div></section><section class="section ${activeTab==='scheduling'?'active':''}" id="tab-scheduling">${renderSchedulingTab(s)}</section>
<section class="section ${activeTab==='decision'?'active':''}" id="tab-decision">
  <div class="decisionSimple">
    <div class="decisionNotesCard">
      <div class="decisionMiniHead">
        <h4>Notes</h4>
        <span class="autoSaveNote">Autosaves</span>
      </div>
      <textarea class="notes" id="decisionNotes" placeholder="Add internal notes related to decision-making and scheduling..."></textarea>
    </div>

    <div class="decisionSignalsBox">
      <div class="decisionMiniHead">
        <h4>Signals</h4>
      </div>

      <div class="signalList">
        <div class="signalLine">
          <span>Review score</span>
          <b>${scoreSignal}</b>
        </div>

        <div class="signalLine">
          <span>Presented before</span>
          <b>${presenterBefore}</b>
        </div>

        <div class="signalLine">
          <span>Lived experience</span>
          <b>${livedExperienceSignal}</b>
        </div>
      </div>
    </div>
  </div>
</section>
  </div>`;
  document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{
  state.activeTab = btn.dataset.tab || 'overview';
  document.querySelectorAll('.tab,.section').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  $('tab-'+state.activeTab)?.classList.add('active');
});
  bindQuickDecisionButtons(s.id);
  document.querySelectorAll('[data-schedule-aid-slot]').forEach(row=>{
  row.onclick = e=>{
    e.preventDefault();
    e.stopPropagation();

    const key = row.dataset.scheduleAidSlot;
    state.scheduleAidOpenSlots = state.scheduleAidOpenSlots || {};

    if(state.scheduleAidOpenSlots[s.id] === key){
      delete state.scheduleAidOpenSlots[s.id];
    }else{
      state.scheduleAidOpenSlots[s.id] = key;
    }

    renderAll();
  };
});

  document.querySelectorAll('[data-toggle-schedule-tz]').forEach(btn=>{
  btn.onclick = e=>{
    e.preventDefault();
    e.stopPropagation();

    const sessionId = btn.dataset.toggleScheduleTz;
    const session = state.submissions.find(x=>x.id === sessionId);
    if(!session) return;

    const info = getScheduleTimezoneInfo(session);
    if(!info.timezone){
      alert('No supported presenter timezone was detected for this session.');
      return;
    }

    state.scheduleViewTimezones = state.scheduleViewTimezones || {};

    if(state.scheduleViewTimezones[sessionId]){
      delete state.scheduleViewTimezones[sessionId];
    }else{
      state.scheduleViewTimezones[sessionId] = info.timezone;
    }

    renderAll();
  };
});

  document.querySelectorAll('[data-open-decision]').forEach(b=>b.onclick=()=>{
  state.activeTab = 'decision';
  document.querySelectorAll('.tab,.section').forEach(x=>x.classList.remove('active'));
  document.querySelector('.tab[data-tab="decision"]')?.classList.add('active');
  $('tab-decision')?.classList.add('active');
});
document.querySelectorAll('[data-open-shared-authors]').forEach(b=>{
  b.onclick=(e)=>{
    e.stopPropagation();
    openSharedAuthorModal(b.dataset.openSharedAuthors);
  };
});
document.querySelectorAll('[data-edit-session]').forEach(b=>{
  b.onclick=(e)=>{
    e.stopPropagation();
    showEditSessionModal(b.dataset.editSession);
  };
});

document.querySelectorAll('[data-delete-session]').forEach(b=>{
  b.onclick=(e)=>{
    e.stopPropagation();
    deleteSessionWithConfirm(b.dataset.deleteSession);
  };
});
  const notesEl=$('decisionNotes');
if(notesEl){
  notesEl.value=getNotes(s.id);
notesEl.addEventListener('input',()=>{
  const current = state.saved[s.id] || {};

  state.saved[s.id] = {
    ...current,
    decision:getDecision(s.id),
    notes:notesEl.value,
    updatedAt:new Date().toISOString()
  };

  storeSave();

  clearTimeout(state.notesPersistTimer);
  state.notesPersistTimer = setTimeout(()=>{
    persistBuiltDataset();
    updateDecisionDisplay(s.id);
  }, 600);
});
}
  const scheduleDay=$('scheduleDay');
  const scheduleStart=$('scheduleStart');
  const scheduleRoom=$('scheduleRoom');
  const scheduleStatus=$('scheduleStatus');
  const scheduleNotes=$('scheduleNotes');

if(scheduleDay){
  scheduleDay.onchange=e=>{
    saveSchedule(s.id,{
      day:e.target.value,
      start:'',
      end:'',
      skeletonType:'',
      status:e.target.value ? 'Tentative' : 'Unscheduled'
    });

    renderAll();
    updateSheetScheduleRowUI(s.id);
  };
}

if(scheduleStart){
  scheduleStart.onchange=e=>{
    const current = getSchedule(s.id);
    const slot = findSkeletonSlot(current.day,e.target.value);
    const duration = Number(current.durationMinutes) || '';

    saveSchedule(s.id,{
      start:e.target.value,
      end:duration ? addMinutesToTimeLabel(e.target.value,duration) : slot?.end || '',
      skeletonType:slot?.type || '',
status: e.target.value
  ? 'Scheduled'
  : (current.day ? 'Tentative' : 'Unscheduled')
    });

    renderAll();
    updateSheetScheduleRowUI(s.id);
  };
}
if(scheduleStatus){
  scheduleStatus.onchange=e=>{
    const nextStatus = e.target.value;

    if(nextStatus === 'Unscheduled'){
      saveSchedule(s.id,{
        day:'',
        start:'',
        end:'',
        skeletonType:'',
        status:'Unscheduled'
      });
    }else{
      saveSchedule(s.id,{status:nextStatus});
    }

    renderAll();
    updateSheetScheduleRowUI(s.id);
  };
}

if(scheduleNotes){
  scheduleNotes.oninput=e=>{
    const current = getSchedule(s.id);

    state.saved[s.id] = {
      ...(state.saved[s.id] || {}),
      schedule:{
        ...current,
        notes:e.target.value,
        updatedAt:new Date().toISOString()
      },
      updatedAt:new Date().toISOString()
    };

    storeSave();

    clearTimeout(state.scheduleNotesPersistTimer);
    state.scheduleNotesPersistTimer = setTimeout(()=>{
      persistBuiltDataset();
    }, 600);
  };
}

const durationEditBtn = $('scheduleDurationEditBtn');
const durationEditWrap = $('scheduleDurationEditWrap');
const durationInput = $('scheduleDurationInput');
const durationCancel = $('scheduleDurationCancel');
const durationSave = $('scheduleDurationSave');

if(durationEditBtn && durationEditWrap){
  durationEditBtn.onclick=()=>{
    durationEditWrap.style.display = 'flex';
    durationInput?.focus();
  };
}

if(durationCancel && durationEditWrap){
  durationCancel.onclick=()=>{
    durationEditWrap.style.display = 'none';
  };
}

if(durationSave && durationInput){
  durationSave.onclick=()=>{
    const current = getSchedule(s.id);
    const minutes = Number(durationInput.value);

    if(!minutes || minutes < 15){
      alert('Enter a valid duration in minutes.');
      return;
    }

saveSchedule(s.id,{
  durationMinutes:minutes,
  durationEdited:true,
  end:current.start ? addMinutesToTimeLabel(current.start, minutes) : current.end || ''
});

    renderAll();
  };
}
}
function toggleDetailFullScreen(){
  document.body.classList.toggle('detail-fullscreen');
}

function renderAll(){
  renderKpis();
  renderList();
  renderDetail();
  renderSheetMode();
  document.querySelectorAll('[data-quick]').forEach(b=>b.classList.toggle('activeQuick',!!state.quickFilter && b.dataset.quick===state.quickFilter));
}
function showProgramBalance(){
  const types = {};
  const themes = {};

  for(const s of state.submissions){
    const d = getDecision(s.id);
    const accepted = d.startsWith('Accept') ? 1 : 0;
    const declined = d === 'Decline' ? 1 : 0;

    types[s.type] ||= {submitted:0, accepted:0, declined:0};
    types[s.type].submitted++;
    types[s.type].accepted += accepted;
    types[s.type].declined += declined;

    themes[s.theme] ||= {submitted:0, accepted:0, declined:0};
    themes[s.theme].submitted++;
    themes[s.theme].accepted += accepted;
    themes[s.theme].declined += declined;
  }

  const rows = o => Object.entries(o)
    .sort((a,b)=>b[1].submitted-a[1].submitted)
    .map(([k,v])=>{
      const acceptedPct = v.submitted ? Math.round(v.accepted / v.submitted * 100) : 0;
      const declinedPct = v.submitted ? Math.round(v.declined / v.submitted * 100) : 0;

      return `
        <div class="balanceRow">
          <b>${esc(k)}</b>
          <span>${v.submitted}</span>
          <span>${v.accepted}</span>
          <div class="progress stacked" title="Accepted: ${v.accepted} • Declined: ${v.declined} • Other: ${v.submitted - v.accepted - v.declined}">
            <span class="acceptedPart" style="width:${acceptedPct}%"></span>
            <span class="declinedPart" style="width:${declinedPct}%"></span>
          </div>
        </div>
      `;
    }).join('');

  els.modalTitle.innerHTML = '<h2>Program Balance</h2><div class="micro">Submitted and accepted counts update from your saved decisions. Bars show accepted, declined, and remaining sessions.</div>';

  els.modalContent.innerHTML = `
    <div class="programGrid">
      <div class="panel">
        <h4>By session type</h4>
        <div class="balanceRow"><b>Type</b><b>Sub</b><b>Acc</b><b>Share</b></div>
        ${rows(types)}
      </div>
      <div class="panel">
        <h4>By theme</h4>
        <div class="balanceRow"><b>Theme</b><b>Sub</b><b>Acc</b><b>Share</b></div>
        ${rows(themes)}
      </div>
    </div>
  `;

  els.modal.classList.add('active');
}

function showProgramSkeleton(){
  state.skeletonEditMode = !!state.skeletonEditMode;
state.skeletonTimezone =
  localStorage.getItem(`${state.datasetKey}_skeletonTimezone`) ||
  state.skeletonTimezone ||
  CONFERENCE_TIMEZONE;
  renderProgramSkeletonModal();
  els.modal.classList.add('active');
}

function renderProgramSkeletonModal(){
  const rows = skeletonRows();
  const timezone = getSkeletonModalTimezone();
  const editMode = !!state.skeletonEditMode;

  const tzOptions = getSkeletonTimezoneOptions().map(({zone,label}) =>
    optionHTML(zone, label, zone === timezone)
  ).join('');

  els.modalTitle.innerHTML = `
    <div>
      <h2>Program Skeleton</h2>
      <div class="micro">Official working blocks saved in browser storage and included in the workspace JSON.</div>
    </div>
  `;

  const toolbar = `
    <div class="skeletonToolbar">
      <div class="skeletonToolbarLeft">
        <button class="btn ${editMode ? 'sage' : 'teal'}" id="skeletonEditToggle">
          ${editMode ? 'View Table' : 'Edit Skeleton'}
        </button>
        <button class="btn" id="skeletonAddRow">Add Row</button>
      </div>

      <div class="skeletonToolbarRight">
        <label class="skeletonTimezone">
          Time zone
          <select id="skeletonTimezoneSelect">${tzOptions}</select>
        </label>
      </div>
    </div>
  `;

  if(!editMode){
    els.modalContent.innerHTML = `
      ${toolbar}
      <div class="skeletonViewNote">
        Showing the program skeleton in <b>${esc(getSkeletonTzAbbreviation(timezone))}</b>. Scheduling values are stored in Mountain Time for conference consistency.
      </div>
      <div class="panel">
        <table class="skeletonTable">
          <thead>
<tr>
  <th>Day</th>
  <th>Start</th>
  <th>End</th>
  <th>Duration</th>
  <th>Type</th>
</tr>
          </thead>
          <tbody>
            ${rows.map(slot=>{
              const display = buildSkeletonDisplaySlot(slot, timezone);
return `
  <tr>
    <td>${esc(display.day)}</td>
    <td>${esc(display.start)}</td>
    <td>${esc(display.end)}</td>
    <td><span class="skeletonDurationPill">${esc(skeletonDurationLabel(slot))}</span></td>
    <td>${esc(display.type)}</td>
  </tr>
`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }else{
    els.modalContent.innerHTML = `
      ${toolbar}
      <div class="skeletonViewNote">
        Edit the official skeleton in Mountain Time. The timezone selector above only changes the preview display, not the saved scheduling values.
      </div>

      <div id="skeletonEditRows">
        ${rows.map((slot,i)=>`
<div class="skeletonEditGrid" data-skeleton-row="${i}" data-skeleton-id="${esc(slot.id)}">
              <label>
              Day
              <select data-skeleton-field="day">
                ${skeletonDayOptionsHTML(slot.day)}
              </select>
            </label>

            <label>
              Start MT
              <input data-skeleton-field="start" value="${esc(stripTimeZoneLabel(slot.start))}" placeholder="5:00 AM">
            </label>

<label>
  End MT
  <input data-skeleton-field="end" value="${esc(stripTimeZoneLabel(slot.end))}" placeholder="8:30 AM">
</label>

<label>
  Duration
  <div class="skeletonDurationPill skeletonDurationEditPill">${esc(skeletonDurationLabel(slot))}</div>
</label>

<label>
  Type(s)
  <input type="hidden" data-skeleton-field="type" value="${esc(slot.type)}">
  ${skeletonTypeMultiSelectHTML(slot.type)}
</label>

            <div class="skeletonRowActions">
  <button class="btn skeletonTinyBtn" data-move-skeleton-row-up="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
  <button class="btn skeletonTinyBtn" data-move-skeleton-row-down="${i}" ${i === rows.length - 1 ? 'disabled' : ''}>↓</button>
  <button class="btn skeletonTinyBtn teal" data-insert-skeleton-after="${i}">+ Below</button>
  <button class="btn skeletonTinyBtn red" data-remove-skeleton-row="${i}">Remove</button>
</div>
          </div>
        `).join('')}
      </div>

      <div class="skeletonModalFooter">
        <button class="btn" id="skeletonCancelEdit">Cancel</button>
        <button class="btn primary" id="skeletonSaveEdit">Save Skeleton</button>
      </div>
    `;
  }

  wireSkeletonModalEvents();
  syncSkeletonTimezoneDropdown();
}

function getSkeletonRowsFromEditDom(){
  const domRows = [...document.querySelectorAll('[data-skeleton-row]')];

  if(!domRows.length){
    return skeletonRows().map(x=>({...x}));
  }

  return domRows.map(row=>{
    const day = row.querySelector('[data-skeleton-field="day"]')?.value || '';
    const start = canonicalSkeletonTime(row.querySelector('[data-skeleton-field="start"]')?.value || '');
    const end = canonicalSkeletonTime(row.querySelector('[data-skeleton-field="end"]')?.value || '');
    const type = clean(row.querySelector('[data-skeleton-field="type"]')?.value || '');

    if(!day || !start || !end || !type) return null;

    return {
      id:row.dataset.skeletonId || makeSkeletonId(),
      day,
      start,
      end,
      type
    };
  }).filter(Boolean);
}

function makeNewSkeletonRowNear(slot){
  const day = slot?.day || 'Tuesday, Oct 6';
  const start = slot?.end || '5:00 AM';
  const duration = slot
  ? minutesBetweenTimes(slot.start, slot.end) || 60
  : 60;
  const end = addMinutesToTimeLabel(start, duration);

  return {
    id:makeSkeletonId(),
    day,
    start,
    end,
    type:slot?.type || 'Workshops'
  };
}

function wireSkeletonModalEvents(){
  const tzSelect = $('skeletonTimezoneSelect');
  const editToggle = $('skeletonEditToggle');
  const addRowBtn = $('skeletonAddRow');
  const cancelBtn = $('skeletonCancelEdit');
  const saveBtn = $('skeletonSaveEdit');

if(tzSelect){
  tzSelect.value = getSkeletonModalTimezone();

  tzSelect.onchange = e=>{
    const selectedZone = e.currentTarget.value || CONFERENCE_TIMEZONE;

    state.skeletonTimezone = selectedZone;
    localStorage.setItem(`${state.datasetKey}_skeletonTimezone`, selectedZone);

    renderProgramSkeletonModal();
    saveProgramSkeletonBrowser();
  };
}
if(editToggle){
  editToggle.onclick = ()=>{
    if(!state.skeletonEditMode){
      state.skeletonEditOriginalRows = skeletonRows().map(x=>({...x}));
      state.skeletonEditMode = true;
    }else{
      state.skeletonEditMode = false;
      state.skeletonEditOriginalRows = null;
    }

    renderProgramSkeletonModal();
  };
}

if(addRowBtn){
  addRowBtn.onclick = ()=>{
    if(!state.skeletonEditOriginalRows){
      state.skeletonEditOriginalRows = skeletonRows().map(x=>({...x}));
    }

    const currentRows = getSkeletonRowsFromEditDom();
    const lastSlot = currentRows[currentRows.length - 1];

    state.programSkeleton = [
      ...currentRows,
      makeNewSkeletonRowNear(lastSlot)
    ];

    state.skeletonEditMode = true;
    renderProgramSkeletonModal();
  };
}

document.querySelectorAll('[data-insert-skeleton-after]').forEach(btn=>{
  btn.onclick = ()=>{
    if(!state.skeletonEditOriginalRows){
  state.skeletonEditOriginalRows = skeletonRows().map(x=>({...x}));
}
    const idx = Number(btn.dataset.insertSkeletonAfter);
    const currentRows = getSkeletonRowsFromEditDom();
    const anchorSlot = currentRows[idx];

    currentRows.splice(idx + 1, 0, makeNewSkeletonRowNear(anchorSlot));

    state.programSkeleton = currentRows;
    state.skeletonEditMode = true;
    renderProgramSkeletonModal();
  };
});

document.querySelectorAll('[data-move-skeleton-row-up]').forEach(btn=>{
  btn.onclick = ()=>{
    if(!state.skeletonEditOriginalRows){
  state.skeletonEditOriginalRows = skeletonRows().map(x=>({...x}));
}
    const idx = Number(btn.dataset.moveSkeletonRowUp);
    if(idx <= 0) return;

    const currentRows = getSkeletonRowsFromEditDom();
    [currentRows[idx - 1], currentRows[idx]] = [currentRows[idx], currentRows[idx - 1]];

    state.programSkeleton = currentRows;
    state.skeletonEditMode = true;
    renderProgramSkeletonModal();
  };
});

document.querySelectorAll('[data-move-skeleton-row-down]').forEach(btn=>{
  btn.onclick = ()=>{
    if(!state.skeletonEditOriginalRows){
  state.skeletonEditOriginalRows = skeletonRows().map(x=>({...x}));
}
    const idx = Number(btn.dataset.moveSkeletonRowDown);
    const currentRows = getSkeletonRowsFromEditDom();
    if(idx >= currentRows.length - 1) return;

    [currentRows[idx], currentRows[idx + 1]] = [currentRows[idx + 1], currentRows[idx]];

    state.programSkeleton = currentRows;
    state.skeletonEditMode = true;
    renderProgramSkeletonModal();
  };
});

document.querySelectorAll('[data-remove-skeleton-row]').forEach(btn=>{

  btn.onclick = ()=>{
    if(!state.skeletonEditOriginalRows){
  state.skeletonEditOriginalRows = skeletonRows().map(x=>({...x}));
}
    const idx = Number(btn.dataset.removeSkeletonRow);
    state.programSkeleton = getSkeletonRowsFromEditDom().filter((_,i)=>i !== idx);
    state.skeletonEditMode = true;
    renderProgramSkeletonModal();
  };
});
if(cancelBtn){
  cancelBtn.onclick = ()=>{
    if(Array.isArray(state.skeletonEditOriginalRows)){
      state.programSkeleton = state.skeletonEditOriginalRows.map(x=>({...x}));
    }

    state.skeletonEditMode = false;
    state.skeletonEditOriginalRows = null;
    renderProgramSkeletonModal();
  };
}

  document.querySelectorAll('.skeletonTypePicker').forEach(picker=>{
  const btn = picker.querySelector('.skeletonTypePickerBtn');
  const hidden = picker.closest('label')?.querySelector('[data-skeleton-field="type"]');

  if(btn){
    btn.onclick = e=>{
      e.preventDefault();
      picker.classList.toggle('open');
    };
  }

  picker.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
    cb.onchange = ()=>{
      const selectedTypes = [...picker.querySelectorAll('input[type="checkbox"]:checked')]
        .map(input=>clean(input.value))
        .filter(Boolean);

      const value = selectedTypes.join('; ');

      if(hidden) hidden.value = value;

      const label = btn?.querySelector('span:first-child');
      const count = btn?.querySelector('.count');

      if(label) label.textContent = value || 'Select type(s)';
      if(count) count.textContent = selectedTypes.length;
    };
  });
});

  if(saveBtn){
    saveBtn.onclick = async ()=>{
      const nextRows = [...document.querySelectorAll('[data-skeleton-row]')].map((row,i)=>{
        const day = row.querySelector('[data-skeleton-field="day"]')?.value || '';
        const start = canonicalSkeletonTime(row.querySelector('[data-skeleton-field="start"]')?.value || '');
        const end = canonicalSkeletonTime(row.querySelector('[data-skeleton-field="end"]')?.value || '');
        const type = clean(row.querySelector('[data-skeleton-field="type"]')?.value || '');

        if(!day || !start || !end || !type) return null;

return {
  id:row.dataset.skeletonId || makeSkeletonId(),
  day,
  start,
  end,
  type
};
      }).filter(Boolean);

      if(!nextRows.length){
        alert('Add at least one valid program skeleton row before saving.');
        return;
      }

const oldRows = Array.isArray(state.skeletonEditOriginalRows)
  ? state.skeletonEditOriginalRows.map(x=>({...x}))
  : skeletonRows().map(x=>({...x}));

state.programSkeleton = nextRows;

const movedScheduleIds = syncSchedulesAfterSkeletonEdit(oldRows, nextRows);

state.skeletonEditMode = false;
state.skeletonEditOriginalRows = null;

saveProgramSkeletonBrowser();
await persistBuiltDataset();

renderAll();
renderProgramSkeletonModal();

if(movedScheduleIds.length){
  alert(`${movedScheduleIds.length} scheduled session(s) were moved to match the edited skeleton time block.`);
}
    };
  }
}
function getActiveScheduledSessions(){
  return state.submissions.filter(s=>{
    if(getDecision(s.id) === 'Decline') return false;

    const sch = getSchedule(s.id);
    if(!sch.day || !sch.start) return false;

    // Do not treat intentionally unscheduled items as placed.
    if((sch.status || 'Unscheduled') === 'Unscheduled') return false;

    return true;
  });
}

function getSlotKey(slot){
  return `${slot.day}|${slot.start}`;
}

function getSessionSlotKey(s){
  const sch = getSchedule(s.id);
  return `${sch.day}|${sch.start}`;
}

function getCleanScheduleLabel(slot){
  return `${slot.day} • ${scheduleRangeDisplay(slot)}`;
}

function getUniqueValuesForMatrix(items, getValue, forcedColumns=[]){
  const found=[...new Set(items.map(getValue).map(v=>clean(v) || 'Unspecified'))];

  const merged=[
    ...forcedColumns,
    ...found.filter(v=>!forcedColumns.includes(v))
  ];

  return merged.filter(Boolean);
}

function buildSlotMatrix(rows, sessions, getColumnValue, forcedColumns=[]){
  const columns = getUniqueValuesForMatrix(sessions, getColumnValue, forcedColumns);

  const matrixRows = rows.map(slot=>{
    const slotSessions = sessions.filter(s=>getSessionSlotKey(s) === getSlotKey(slot));

    const counts = {};
    columns.forEach(col=>counts[col] = 0);

    slotSessions.forEach(s=>{
      const col = clean(getColumnValue(s)) || 'Unspecified';
      counts[col] = (counts[col] || 0) + 1;
    });

    return {
      slot,
      total:slotSessions.length,
      counts
    };
  });

  return {columns,matrixRows};
}

function renderScheduleMatrix(title, helper, matrix, startOpen=true){
  let lastDay = '';
  const totalSessions = matrix.matrixRows.reduce((sum,row)=>sum + row.total, 0);

  return `
    <details class="scheduleMatrixPanel" ${startOpen ? 'open' : ''}>
      <summary>
        <div class="scheduleMatrixTitle">
          <h4>${esc(title)}</h4>
          <div class="micro">${esc(helper)}</div>
        </div>
        <div class="scheduleMatrixTotal">${totalSessions} scheduled</div>
      </summary>

      ${scheduleLegendHTML(matrix.columns)}

      <div class="scheduleMatrixWrap">
        <table class="scheduleMatrix compactScheduleMatrix">
          <thead>
<tr>
  <th>Block</th>
  <th>Dur</th>
  <th>Tot</th>
  ${matrix.columns.map(col=>`
                <th title="${esc(col)}">${esc(scheduleAbbrev(col))}</th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${matrix.matrixRows.map(row=>{
              const day = row.slot.day || 'Unspecified day';
              const dayDivider = day !== lastDay
                ? `<tr class="scheduleDayDivider"><td colspan="${matrix.columns.length + 3}">${esc(day)}</td></tr>`
                : '';

              lastDay = day;

              return `
                ${dayDivider}
<tr>
  <td>${esc(scheduleRangeDisplay(row.slot))}</td>
  <td><span class="scheduleDurationMini">${esc(skeletonDurationLabel(row.slot))}</span></td>
  <td>
<span class="scheduleMatrixCell scheduleMatrixTotalCell ${row.total ? 'hasSessions' : ''}" style="${scheduleHeatStyle(row.total)}">
  ${row.total || '0'}
</span>
  </td>
                  ${matrix.columns.map(col=>`
                    <td title="${esc(col)}">
                      <span class="scheduleMatrixCell ${row.counts[col] ? 'hasSessions' : ''}" style="${scheduleHeatStyle(row.counts[col])}">
                        ${row.counts[col] || '0'}
                      </span>
                    </td>
                  `).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </details>
  `;
}

function getGroupedScheduleConflicts(){
  const placed = getActiveScheduledSessions();
  const groups = new Map();

  for(let i = 0; i < placed.length; i++){
    for(let j = i + 1; j < placed.length; j++){
      const a = placed[i];
      const b = placed[j];

      const aSch = getSchedule(a.id);
      const bSch = getSchedule(b.id);

      if(!aSch.day || !aSch.start || !bSch.day || !bSch.start) continue;
      if(skeletonKey(aSch.day, aSch.start) !== skeletonKey(bSch.day, bSch.start)) continue;

      const names = loosePresenterOverlapNames(a,b);
      if(!names.length) continue;

      const key = [a.id,b.id].sort().join('|');

      groups.set(key,{
        titleA:a.title || 'Untitled session',
        titleB:b.title || 'Untitled session',
        day:aSch.day,
        time:scheduleRangeDisplay(findSkeletonSlot(aSch.day,aSch.start) || {start:aSch.start,end:aSch.end}),
        authors:names.sort((x,y)=>x.localeCompare(y))
      });
    }
  }

  return [...groups.values()];
}
function renderGroupedConflictSummary(groups){
  if(!groups.length) return '';

  return `
    <div class="scheduleConflictCompact">
      <h4>Conflict flags</h4>
      <div class="micro" style="color:#7f1d1d;margin-bottom:6px">
        Grouped by session pair so duplicates do not flood the popup.
      </div>
      <ul class="scheduleConflictList">
        ${groups.slice(0,10).map(g=>`
          <li>
            <b>${esc(g.authors.join(', '))}</b> appears in both
            “${esc(g.titleA)}” and “${esc(g.titleB)}”.
          </li>
        `).join('')}
      </ul>
      ${groups.length > 10 ? `<div style="margin-top:6px"><b>+ ${groups.length - 10} more grouped conflicts</b></div>` : ''}
    </div>
  `;
}

function showScheduleSummary(){
  const rows = skeletonRows();

  const activeSessions = state.submissions.filter(s=>getDecision(s.id) !== 'Decline');
  const placed = getActiveScheduledSessions();
  const unscheduled = activeSessions.length - placed.length;

const typeMatrix = buildSlotMatrix(
  rows,
  placed,
  s=>s.type || 'Unspecified',
  SCHEDULE_TYPE_ORDER
);

const themeMatrix = buildSlotMatrix(
  rows,
  placed,
  s=>s.theme || 'Unspecified',
  SCHEDULE_THEME_ORDER
);
  const conflictGroups = getGroupedScheduleConflicts();

  els.modalTitle.innerHTML = `
    <h2>Schedule Summary</h2>
    <div class="micro">Program balance by time block, session type, and theme.</div>
  `;

  els.modalContent.innerHTML = `
    <div class="scheduleSummaryTop">
      <div class="scheduleSummaryMetric">
        <b>${placed.length}</b>
        <span>Scheduled</span>
      </div>
      <div class="scheduleSummaryMetric">
        <b>${unscheduled}</b>
        <span>Unscheduled</span>
      </div>
      <div class="scheduleSummaryMetric">
        <b>${rows.length}</b>
        <span>Time blocks</span>
      </div>
      <div class="scheduleSummaryMetric">
        <b>${conflictGroups.length}</b>
        <span>Conflict groups</span>
      </div>
    </div>

${renderScheduleMatrix(
  'Time blocks by session type',
  'Counts by block. Color gets warmer as the block approaches 5 sessions.',
  typeMatrix,
  true
)}

${renderScheduleMatrix(
  'Time blocks by theme',
  'Counts by block. Color gets warmer as the block approaches 5 sessions.',
  themeMatrix,
  false
)}
    ${renderGroupedConflictSummary(conflictGroups)}
  `;

  els.modal.classList.add('active');
}

function focusSelected(){const arr=filtered(); const s=arr.find(x=>x.id===state.selectedId)||arr[0]; if(!s)return; state.selectedId=s.id; renderAll(); els.detail.scrollIntoView({behavior:'smooth',block:'start'});}
function nextUndecided(){const arr=filtered(); const start=Math.max(0,arr.findIndex(s=>s.id===state.selectedId)); const next=arr.slice(start+1).find(s=>getDecision(s.id)==='Unreviewed')||arr.find(s=>getDecision(s.id)==='Unreviewed'); if(next){state.selectedId=next.id; renderAll(); els.detail.scrollIntoView({behavior:'smooth',block:'start'});} }
function meetingMode(){focusSelected();}
window.quickDec=status=>{if(state.selectedId){saveDecision(state.selectedId,status,getNotes(state.selectedId));}}
window.nextItem=()=>{const arr=filtered(); const i=arr.findIndex(s=>s.id===state.selectedId); if(arr[i+1])state.selectedId=arr[i+1].id; renderAll();focusSelected();}

function exportCSV(){
  function exportScheduleDate(day){
    const d = clean(day || '');

    if(!d) return '';

    if(norm(d).includes('tuesday') || d.includes('Oct 6') || d.includes('October 6')){
      return 'Tuesday, Oct 6, 2026';
    }

    if(norm(d).includes('wednesday') || d.includes('Oct 7') || d.includes('October 7')){
      return 'Wednesday, Oct 7, 2026';
    }

    if(norm(d).includes('thursday') || d.includes('Oct 8') || d.includes('October 8')){
      return 'Thursday, Oct 8, 2026';
    }

    return d;
  }

  function exportScheduleTime(value){
    return clean(value || '').replace(/\s*ET\s*$/i,'');
  }

  const headers=[
    'Confirmation Number',
    'Session Title',
    'Session Type',
    'Theme',
    'Primary Presenter',
    'Primary Email',
    'Review Average',
    'Completed Reviews',
    'Review Spread',
    'Decision Score',
    'Band',
    'Historical Matches',
    'Max Historical Attendance',
    'Final Decision',
    'Decision Notes',

    'Scheduled Start Date',
    'Scheduled Start Time ET',
    'Scheduled End Time ET',
    'Scheduling Status',
    'Scheduled Block Type',
    'Scheduled Duration Minutes',
    'Scheduled Duration Edited',
    'Scheduling Notes',

    'Flags',
    'Time Zone',
    'Cannot Days',
    'Outside Business Hours',
    'Recording',
    'Pre-record',
    'Tech Support',
    'Virtual Features',
    'CEU',
    'Scholarship'
  ];

  const rows=state.submissions.map(s=>{
    const sch=getSchedule(s.id);
    const slot=sch.day && sch.start ? findSkeletonSlot(sch.day, sch.start) : null;

    const scheduledDuration =
      Number(sch.durationMinutes) ||
      getSlotDurationMinutes(slot) ||
      '';

    return [
      s.confirmation,
      s.title,
      s.type,
      s.theme,
      s.presenters[0]?.name||'',
      s.presenters[0]?.email||'',
      s.reviewAvg??'',
      s.completedReviews,
      s.reviewSpread,
      s.decisionScore,
      s.band,
      s.historicalCount,
      s.maxHistoricalAttendance,
      getDecision(s.id),
      getNotes(s.id),

      exportScheduleDate(sch.day),
      exportScheduleTime(sch.start),
      exportScheduleTime(sch.end),
      sch.status || 'Unscheduled',
      sch.skeletonType || slot?.type || '',
      scheduledDuration,
      sch.durationEdited ? 'Yes' : 'No',
      sch.notes || '',

      s.flags.join('; '),
      s.timeZone,
      s.cannotDays,
      s.outsideBusinessHours,
      s.recording,
      s.preRecord,
      s.techSupport,
      s.features,
      s.ceu,
      s.scholarship
    ];
  });

downloadCSV('global-gathering-2026-session-decisions.csv',[headers,...rows]);
}

function exportMailMergeCSV(){
  function speakerFirstName(p){
    const direct = clean(p?.firstName || '');
    if(direct) return direct;

    const parts = clean(p?.name || '').split(/\s+/).filter(Boolean);
    return parts[0] || '';
  }

  function speakerLastName(p){
    const direct = clean(p?.lastName || '');
    if(direct) return direct;

    const parts = clean(p?.name || '').split(/\s+/).filter(Boolean);
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  }

  function normalizeMailMergeCEU(value){
    const raw = clean(value || '');
    const x = norm(raw);

    if(!x) return '';

    if(x === 'yes' || x.startsWith('yes ')){
      return 'Yes';
    }

    if(
      x.includes('opt-out') ||
      x.includes('opt out') ||
      x.includes('opting out') ||
      x.includes('i would like to opt')
    ){
      return 'Opt out';
    }

    if(
      x.includes('n/a') ||
      x.includes('n a') ||
      x.includes('creative space')
    ){
      return 'N/A - Creative Space';
    }

    return raw;
  }

  function scheduleStartUtc(sch, slot){
    const day = sch.day || slot?.day || '';
    const start = sch.start || slot?.start || '';
    if(!day || !start) return null;

    return skeletonStoredToUtc(day, start, false);
  }

  function scheduleEndUtc(sch, slot){
    const day = sch.day || slot?.day || '';
    const start = sch.start || slot?.start || '';
    const end = sch.end || slot?.end || '';
    if(!day || !end) return null;

    return skeletonStoredToUtc(day, end, true, start);
  }

  function getMountainParts(dateObj){
    if(!dateObj) return null;

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: CONFERENCE_TIMEZONE,
      year:'numeric',
      month:'numeric',
      day:'numeric',
      hour:'numeric',
      minute:'2-digit',
      hour12:false
    }).formatToParts(dateObj);

    const obj = {};
    parts.forEach(part=>{
      if(part.type !== 'literal') obj[part.type] = part.value;
    });

    return {
      year:Number(obj.year),
      month:Number(obj.month),
      day:Number(obj.day),
      hour:Number(obj.hour),
      minute:Number(obj.minute)
    };
  }

  function excelSerialFromMountainDate(dateObj){
    const p = getMountainParts(dateObj);
    if(!p) return '';

    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0) / 86400000 + 25569;
  }

  function formatMailMergeDateString(dateObj){
    const p = getMountainParts(dateObj);
    if(!p) return '';

    let hour = p.hour;
    const minute = String(p.minute).padStart(2, '0');
    const ampm = hour >= 12 ? 'pm' : 'am';

    hour = hour % 12;
    if(hour === 0) hour = 12;

    return `${p.month}/${p.day}/${p.year} ${hour}:${minute}${ampm} MDT`;
  }

  const headers = [
    'Session name',
    'Session type',
    'Session decision',
    'Speaker first name',
    'Speaker last name',
    'Speaker email',
    'Session start date/time',
    'Session end date/time',
    'Session start date/time string',
    'Session end date/time string',
    'CEU status'
  ];

  const rows = [headers];

  state.submissions.forEach(s=>{
    const sch = getSchedule(s.id);
    const slot = sch.day && sch.start ? findSkeletonSlot(sch.day, sch.start) : null;

    const startUtc = scheduleStartUtc(sch, slot);
    const endUtc = scheduleEndUtc(sch, slot);

    const speakers = Array.isArray(s.presenters) && s.presenters.length
      ? s.presenters
      : [{firstName:'', lastName:'', email:''}];

    speakers.forEach(p=>{
      rows.push([
        s.title || '',
        s.type || '',
        getDecision(s.id),
        speakerFirstName(p),
        speakerLastName(p),
        p?.email || '',
        excelSerialFromMountainDate(startUtc),
        excelSerialFromMountainDate(endUtc),
        formatMailMergeDateString(startUtc),
        formatMailMergeDateString(endUtc),
        normalizeMailMergeCEU(s.ceu)
      ]);
    });
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    {wch:42},
    {wch:22},
    {wch:22},
    {wch:20},
    {wch:24},
    {wch:34},
    {wch:22},
    {wch:22},
    {wch:26},
    {wch:26},
    {wch:22}
  ];

  const dateFormat = 'm/d/yyyy h:mm AM/PM';

  for(let r = 2; r <= rows.length; r++){
    const startCell = ws[`G${r}`];
    const endCell = ws[`H${r}`];

    if(startCell && startCell.v !== ''){
      startCell.t = 'n';
      startCell.z = dateFormat;
    }

    if(endCell && endCell.v !== ''){
      endCell.t = 'n';
      endCell.z = dateFormat;
    }
  }

  ws['!autofilter'] = {
    ref: `A1:K${rows.length}`
  };

  XLSX.utils.book_append_sheet(wb, ws, 'Mail Merge Export');
  XLSX.writeFile(wb, 'global-gathering-2026-mail-merge-export.xlsx');
}
function showCventSpeakerExport(){
  els.modalTitle.innerHTML='<h2>Cvent Speaker Import File</h2>';
  els.modalContent.innerHTML=`
    <div style="padding:8px 0">
      <p style="margin:0 0 14px;color:#334155;font-size:.9rem;line-height:1.5">
        Optionally upload your social media handles file to match Facebook, LinkedIn, and X URLs to speakers. Or skip to export without them.
      </p>
      <input type="file" id="cventSocialInput" accept=".xlsx,.xls,.csv" style="display:none">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button class="btn primary" id="cventUploadSocialBtn">Upload Social Media File</button>
        <button class="btn" id="cventSkipSocialBtn">Skip — no social URLs</button>
      </div>
      <div id="cventSocialFeedback" style="margin-top:10px;font-size:.82rem;color:#475569"></div>
    </div>`;
  els.modal.classList.add('active');
  $('cventUploadSocialBtn').onclick=()=>$('cventSocialInput').click();
  $('cventSocialInput').onchange=async e=>{
    const file=e.target.files[0];
    if(!file)return;
    $('cventSocialFeedback').textContent='Reading file…';
    try{
      const rows=await parseFile(file);
      processCventSpeakerExport(rows);
    }catch(err){
      $('cventSocialFeedback').textContent='Error reading file: '+err.message;
    }
  };
  $('cventSkipSocialBtn').onclick=()=>processCventSpeakerExport([]);
}

function processCventSpeakerExport(socialRows){
  const socialMap={};
  for(const row of socialRows){
    const e=email(row['Email Address']||'');
    if(!e)continue;
    socialMap[e]={
      facebook:clean(row['Facebook URL']||''),
      linkedin:clean(row['LinkedIn URL']||''),
      x:clean(row['Twitter/X URL']||'')
    };
  }

  const acceptedSessions=state.submissions.filter(s=>getDecision(s.id)==='Accept');

  const emailMap={};
  for(const session of acceptedSessions){
    for(const p of(session.presenters||[])){
      const e=email(p.email||'');
      if(!e)continue;
      const rec={
        firstName:clean(p.firstName||''),
        lastName:clean(p.lastName||''),
        email:e,
        organization:clean(p.organization||p.company||p.affiliation||''),
        title:clean(p.title||''),
        bio:clean(p.bio||'')
      };
      if(!emailMap[e]){
        emailMap[e]=rec;
      }else{
        const ex=emailMap[e];
        const score=r=>[r.firstName,r.lastName,r.organization,r.title,r.bio].filter(Boolean).length;
        if(score(rec)>score(ex)) emailMap[e]=rec;
      }
    }
  }

  function speakerCode(firstName,lastName,emailAddr){
    let h=0;
    const e=(emailAddr||'').toLowerCase().trim();
    for(let i=0;i<e.length;i++)h=Math.imul(31,h)+e.charCodeAt(i)|0;
    const num=(Math.abs(h)%900)+100;
    return `${firstName.replace(/[^a-zA-Z]/g,'')}${lastName.replace(/[^a-zA-Z]/g,'')}${num}`;
  }

  const sessionCountMap={};
  for(const session of acceptedSessions){
    for(const p of(session.presenters||[])){
      const e=email(p.email||'');
      if(!e)continue;
      sessionCountMap[e]=(sessionCountMap[e]||0)+1;
    }
  }

  const speakers=Object.values(emailMap).map(sp=>({
    ...sp,
    sessionCount:sessionCountMap[sp.email]||1,
    social:socialMap[sp.email]||{facebook:'',linkedin:'',x:''}
  }));

  const nameGroups={};
  for(const sp of speakers){
    const key=(norm(sp.firstName)+' '+norm(sp.lastName)).trim();
    if(!key)continue;
    if(!nameGroups[key])nameGroups[key]=[];
    nameGroups[key].push(sp);
  }
  const duplicatePairs=Object.values(nameGroups).filter(g=>g.length>1);

  const totalSpeakers=speakers.length;
  const withFB=speakers.filter(s=>s.social.facebook).length;
  const withLI=speakers.filter(s=>s.social.linkedin).length;
  const withX=speakers.filter(s=>s.social.x).length;
  const withNoSocial=speakers.filter(s=>!s.social.facebook&&!s.social.linkedin&&!s.social.x).length;
  const socialEmailsNotMatched=Object.keys(socialMap).filter(e=>!emailMap[e]);
  const multiSessionSpeakers=speakers.filter(s=>s.sessionCount>1).length;

  window._cventState={
    speakers,
    duplicatePairs,
    mergeDecisions:{},
    speakerCode,
    stats:{totalSpeakers,withFB,withLI,withX,withNoSocial,socialEmailsNotMatched,multiSessionSpeakers}
  };

  renderCventReview();
}

function renderCventReview(){
  const{speakers,duplicatePairs,mergeDecisions,speakerCode,stats}=window._cventState;
  const{totalSpeakers,withFB,withLI,withX,withNoSocial,socialEmailsNotMatched,multiSessionSpeakers}=stats;
  const resolvedCount=Object.keys(mergeDecisions).length;

  const unresolvedCount=duplicatePairs.filter(g=>{
    const key=g.map(s=>s.email).join('|');
    return!mergeDecisions[key];
  }).length;

  const dupHtml=duplicatePairs.length===0
    ?'<p style="color:#0f766e;font-weight:700;margin:0;font-size:.85rem">✓ No potential duplicate speakers found.</p>'
    :duplicatePairs.map((group,gi)=>{
        const key=group.map(s=>s.email).join('|');
        const decision=mergeDecisions[key];
        return`<div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin-bottom:10px;background:#fafafa">
          <div style="font-weight:800;color:#122345;margin-bottom:8px;font-size:.85rem">"${esc([group[0].firstName,group[0].lastName].filter(Boolean).join(` `))||esc(group[0].email)}" — same name, different emails. Same person?</div>
          ${group.map((sp,si)=>`
            <div style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:5px;background:#fff;font-size:.79rem;color:#334155">
              <b>${esc(sp.email)}</b>${sp.organization?' · '+esc(sp.organization):''}${sp.title?' · '+esc(sp.title):''}
            </div>`).join('')}
          <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:8px;align-items:center">
            <span style="font-size:.75rem;color:#64748b;font-weight:700">Resolve:</span>
            ${group.map((_,si)=>`<button class="btn${mergeDecisions[key]===group[si].email?' primary':''}" style="font-size:.74rem;padding:5px 9px" data-cvent-gi="${gi}" data-cvent-pick="${si}" onclick="cventMergePick(this)">Use ${esc(group[si].email)}</button>`).join('')}
            <button class="btn${decision==='separate'?' teal':''}" style="font-size:.74rem;padding:5px 9px" data-cvent-gi="${gi}" data-cvent-pick="separate" onclick="cventMergePick(this)">Keep separate</button>
          </div>
        </div>`;
      }).join('');

  els.modalTitle.innerHTML='<h2>Cvent Speaker Import — Review</h2>';
  els.modalContent.innerHTML=`
    <div style="max-height:72vh;overflow-y:auto;padding-right:6px">
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:14px">
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:10px 12px;text-align:center">
          <div style="font-size:1.5rem;font-weight:900;color:#122345">${totalSpeakers}</div>
          <div style="font-size:.7rem;color:#475569;font-weight:700;line-height:1.3">Total unique<br>speakers</div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:10px 12px;text-align:center">
          <div style="font-size:1.5rem;font-weight:900;color:#0f766e">${withLI}</div>
          <div style="font-size:.7rem;color:#475569;font-weight:700;line-height:1.3">LinkedIn<br>matched</div>
        </div>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:10px 12px;text-align:center">
          <div style="font-size:1.5rem;font-weight:900;color:#b45309">${withFB}</div>
          <div style="font-size:.7rem;color:#475569;font-weight:700;line-height:1.3">Facebook<br>matched</div>
        </div>
        <div style="background:#fdf4ff;border:1px solid #e9d5ff;border-radius:12px;padding:10px 12px;text-align:center">
          <div style="font-size:1.5rem;font-weight:900;color:#7c3aed">${withX}</div>
          <div style="font-size:.7rem;color:#475569;font-weight:700;line-height:1.3">X / Twitter<br>matched</div>
        </div>
        <div style="background:#f0f9ff;border:1px solid #93c5fd;border-radius:12px;padding:10px 12px;text-align:center">
          <div style="font-size:1.5rem;font-weight:900;color:#1d4ed8">${multiSessionSpeakers}</div>
          <div style="font-size:.7rem;color:#475569;font-weight:700;line-height:1.3">On multiple<br>accepted sessions</div>
        </div>
        <div style="background:${resolvedCount===duplicatePairs.length&&duplicatePairs.length>0?`#f0fdf4`:`#f8fafc`};border:1px solid ${resolvedCount===duplicatePairs.length&&duplicatePairs.length>0?`#bbf7d0`:`#e2e8f0`};border-radius:12px;padding:10px 12px;text-align:center">
          <div style="font-size:1.5rem;font-weight:900;color:${duplicatePairs.length===0?`#94a3b8`:resolvedCount===duplicatePairs.length?`#0f766e`:`#b45309`}">${resolvedCount}/${duplicatePairs.length}</div>
          <div style="font-size:.7rem;color:#475569;font-weight:700;line-height:1.3">Duplicate pairs<br>resolved</div>
        </div>
      </div>
      ${withNoSocial>0?`<div style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:8px 13px;margin-bottom:10px;font-size:.8rem;color:#713f12;font-weight:700">⚠ ${withNoSocial} speaker${withNoSocial>1?'s':''} will export with no social media URLs.</div>`:''}
      ${socialEmailsNotMatched.length>0?`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 13px;margin-bottom:10px;font-size:.8rem;color:#991b1b"><b>${socialEmailsNotMatched.length} email${socialEmailsNotMatched.length>1?'s':''} in social media file not matched to any accepted speaker:</b><div style="margin-top:4px;font-weight:400">${socialEmailsNotMatched.map(e=>`<span style="font-family:monospace;font-size:.75rem">${esc(e)}</span>`).join(', ')}</div></div>`:''}
      ${duplicatePairs.length>0?`<div style="margin-bottom:14px"><div style="font-weight:800;color:#122345;margin-bottom:8px;font-size:.9rem">⚠ ${duplicatePairs.length} potential duplicate${duplicatePairs.length>1?'s':''} — review before downloading</div><div>${dupHtml}</div></div>`:`<div style="margin-bottom:14px">${dupHtml}</div>`}
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid #e5e7eb;gap:10px;flex-wrap:wrap">
        ${unresolvedCount>0?`<span style="font-size:.78rem;color:#b45309;font-weight:700">⚠ ${unresolvedCount} duplicate${unresolvedCount>1?'s':''} unresolved — will be kept as separate records</span>`:'<span></span>'}
        <button class="btn primary" onclick="downloadCventFile()">⬇ Download Cvent Speaker Import File</button>
      </div>
    </div>`;
}

window.cventMergePick=function(btn){
  if(!window._cventState)return;
  const gi=parseInt(btn.dataset.cventGi);
  const pick=btn.dataset.cventPick;
  const group=window._cventState.duplicatePairs[gi];
  const key=group.map(s=>s.email).join('|');
  window._cventState.mergeDecisions[key]=pick==='separate'?'separate':group[parseInt(pick)].email;
  renderCventReview();
};

function downloadCventFile(){
  const{speakers,mergeDecisions,speakerCode}=window._cventState;
  const removedEmails=new Set();
  for(const[key,decision]of Object.entries(mergeDecisions)){
    if(decision!=='separate'){
      key.split('|').filter(e=>e!==decision).forEach(e=>removedEmails.add(e));
    }
  }
  const finalSpeakers=speakers.filter(sp=>!removedEmails.has(sp.email));
  const rows=[['Speaker Code','First Name','Last Name','Email Address','Company','Title','Facebook URL','LinkedIn URL','X URL','Biography']];
  for(const sp of finalSpeakers){
    rows.push([
      speakerCode(sp.firstName,sp.lastName,sp.email),
      sp.firstName,
      sp.lastName,
      sp.email,
      sp.organization,
      sp.title,
      sp.social.facebook,
      sp.social.linkedin,
      sp.social.x,
      sp.bio
    ]);
  }
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws['!cols']=[{wch:22},{wch:16},{wch:20},{wch:34},{wch:30},{wch:28},{wch:38},{wch:42},{wch:36},{wch:20}];
  XLSX.utils.book_append_sheet(wb,ws,'Speaker Import');
  XLSX.writeFile(wb,'global-gathering-2026-cvent-speaker-import.xlsx');
}

function downloadCSV(name,rows){const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n'); downloadBlob(name,csv,'text/csv');}
function downloadBlob(name,content,type){const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);}

function exportAcceptedAgendaPDF(){
  function agendaDecisionIncluded(s){
    const d = getDecision(s.id);
    return d === 'Accept' || d === 'Conditional accept';
  }
function agendaExcludedByScheduleNote(s){
  const sch = getSchedule(s.id) || {};
  const raw = String(sch.notes || '');

  const compact = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

  return compact.includes('tagexcludefrompdf');
}

  function agendaDaySortValue(day){
    const d = norm(day || '');
    if(d.includes('oct 6') || d.includes('october 6') || d.includes('tuesday')) return 1;
    if(d.includes('oct 7') || d.includes('october 7') || d.includes('wednesday')) return 2;
    if(d.includes('oct 8') || d.includes('october 8') || d.includes('thursday')) return 3;
    return 99;
  }

  function agendaDayLabel(day){
    const d = norm(day || '');
    if(d.includes('oct 6') || d.includes('october 6') || d.includes('tuesday')) return 'Tuesday, October 6, 2026';
    if(d.includes('oct 7') || d.includes('october 7') || d.includes('wednesday')) return 'Wednesday, October 7, 2026';
    if(d.includes('oct 8') || d.includes('october 8') || d.includes('thursday')) return 'Thursday, October 8, 2026';
    return clean(day || 'Unscheduled');
  }

  function agendaTimeSortValue(value){
    return parseSkeletonTimeToMinutes(value) ?? 99999;
  }

  function agendaTimeRangeFromItem(item){
    const start = clean(item.start || '');
    const end = clean(item.end || '');

    if(!start && !end) return 'Time to be confirmed';
    if(start && end) return `${start}–${end}`;
    return start || end;
  }

function agendaSpeakerLine(p){
  const name = clean(p?.name || [p?.firstName,p?.lastName].filter(Boolean).join(' '));
  const title = clean(p?.title || '');
  const org = clean(p?.organization || p?.company || p?.affiliation || '');

  const parts = [name, title, org].filter(Boolean);
  return parts.join(', ');
}

function agendaSpeakersHTML(s){
  const speakers = (s.presenters || [])
    .map(agendaSpeakerLine)
    .filter(Boolean);

  if(!speakers.length){
    return `<p class="agendaSpeakers agendaSpeakersMissing">Presenter information to be confirmed</p>`;
  }

  return `
    <div class="agendaSpeakers">
      ${speakers.map(line=>`<div class="agendaSpeakerLine">${esc(line)}</div>`).join('')}
    </div>
  `;
}

  function agendaDescription(s){
    const text = clean(s.description || s.abstract || '');
    if(!text) return '';

    return text.length > 900 ? text.slice(0, 900).trim() + '…' : text;
  }

  function agendaTypeLabel(type){
    const raw = clean(type || '');
    const x = norm(raw);

    if(x.includes('keynote')) return 'Keynote';
    if(x.includes('strategy')) return 'Strategy Session';
    if(x.includes('creative')) return 'Creative Space';
    if(x.includes('skill')) return 'Skill Building Institute';
    if(x.includes('workshop')) return 'Workshop';

    return raw || 'Session';
  }

  function agendaTypeClass(type){
    const x = norm(type);
    if(x.includes('keynote')) return 'agendaType keynote';
    if(x.includes('strategy')) return 'agendaType strategy';
    if(x.includes('creative')) return 'agendaType creative';
    if(x.includes('skill')) return 'agendaType skill';
    return 'agendaType workshop';
  }

  function agendaTypeIconUrl(type){
  const x = norm(type || '');

  const urls = {
    skill: 'https://custom.cvent.com/AE944F71438646268B70FF5BF3772347/files/event/e7d15afcf2b14901ab0272ce8a401899/8230f92e454c40c49550e623915ee73e.png',
    workshop: 'https://custom.cvent.com/AE944F71438646268B70FF5BF3772347/files/event/e7d15afcf2b14901ab0272ce8a401899/7fa5436c0536426fa7e85842cf7aad5d.png',
    strategy: 'https://custom.cvent.com/AE944F71438646268B70FF5BF3772347/files/event/e7d15afcf2b14901ab0272ce8a401899/bdcbe9d6fe544ef4a202b854ca33e3f6.png',
    creative: 'https://custom.cvent.com/AE944F71438646268B70FF5BF3772347/files/event/e7d15afcf2b14901ab0272ce8a401899/3a8caa515267422f9438e166ed096908.png',
    keynote: 'https://custom.cvent.com/AE944F71438646268B70FF5BF3772347/files/event/e7d15afcf2b14901ab0272ce8a401899/70e651e949504943907244bd4cfef35e.png'
  };

  if(x.includes('skill') || x.includes('institute')) return urls.skill;
  if(x.includes('keynote')) return urls.keynote;
  if(x.includes('strategy')) return urls.strategy;
  if(x.includes('creative') || x.includes('poetry') || x.includes('testimony') || x.includes('film')) return urls.creative;
  return urls.workshop;
}

function agendaTypePillHTML(type, label){
  const iconUrl = agendaTypeIconUrl(type);

  return `
    <span class="${agendaTypeClass(type)}">
      <span class="agendaTypeIconWrap">
        <img class="agendaTypeIconImg" src="${iconUrl}" crossorigin="anonymous" alt="">
      </span>
      <span>${esc(label)}</span>
    </span>
  `;
}

const accepted = state.submissions
  .filter(s=>agendaDecisionIncluded(s) && !agendaExcludedByScheduleNote(s))
  .map(s=>{
      const sch = getSchedule(s.id);
      const slot = sch.day && sch.start ? findSkeletonSlot(sch.day, sch.start) : null;

      return {
        session:s,
        day:sch.day || slot?.day || '',
        start:sch.start || slot?.start || '',
        end:sch.end || slot?.end || '',
        blockType:sch.skeletonType || slot?.type || s.type || ''
      };
    })
    .sort((a,b)=>{
      const dayDiff = agendaDaySortValue(a.day) - agendaDaySortValue(b.day);
      if(dayDiff) return dayDiff;

      const timeDiff = agendaTimeSortValue(a.start) - agendaTimeSortValue(b.start);
      if(timeDiff) return timeDiff;

      return clean(a.session.title).localeCompare(clean(b.session.title));
    });

  if(!accepted.length){
    alert('No accepted sessions found. Mark sessions as Accept or Conditional accept first.');
    return;
  }

  const grouped = accepted.reduce((acc,item)=>{
    const label = agendaDayLabel(item.day);
    if(!acc[label]) acc[label] = [];
    acc[label].push(item);
    return acc;
  }, {});

const generatedDate = new Date().toLocaleDateString('en-US', {
  month:'long',
  day:'numeric',
  year:'numeric'
});

const allAgendaEligible = state.submissions.filter(agendaDecisionIncluded);
const excludedFromPdf = allAgendaEligible.filter(agendaExcludedByScheduleNote);

const excludedGrouped = excludedFromPdf.reduce((acc,s)=>{
  const sch = getSchedule(s.id);
  const slot = sch.day && sch.start ? findSkeletonSlot(sch.day, sch.start) : null;
  const day = agendaDayLabel(sch.day || slot?.day || '');

  if(!acc[day]) acc[day] = [];
  acc[day].push(s);
  return acc;
}, {});

const agendaSummaryLines = Object.entries(grouped)
  .map(([day,items])=>`${day}: ${items.length} session${items.length === 1 ? '' : 's'} included`)
  .join('\n');

const excludedSummaryLines = excludedFromPdf.length
  ? Object.entries(excludedGrouped)
      .map(([day,items])=>`${day}: ${items.length} session${items.length === 1 ? '' : 's'} excluded`)
      .join('\n')
  : 'None';

alert(
  `Agenda PDF Export Summary\n\n` +
  `Total sessions included: ${accepted.length}\n` +
  `Total sessions excluded: ${excludedFromPdf.length}\n\n` +
  `Included by day:\n${agendaSummaryLines}\n\n` +
  `Excluded by day:\n${excludedSummaryLines}`
);

const agendaLogoSrc = document.querySelector('.logo')?.getAttribute('src') || '';

  const agendaHTML = `
  <div class="agendaPdf">
    <style>

      .agendaPdf{
  width:816px;
  color:#172033;
  background:#ffffff;
  font-family:Montserrat,Arial,sans-serif;
  letter-spacing:-.01em;
  margin:0;
  padding:0;
  overflow:visible;
  display:block;
}

.agendaCoverPage{
  width:816px;
  height:1056px;
  box-sizing:border-box;
  display:flex;
  flex-direction:column;
  justify-content:center;
  position:relative;
  overflow:hidden;
  background:linear-gradient(135deg,#122345 0%,#1b3d68 58%,#187089 100%);
  color:#fff;
  padding:67px;
  margin:0;
}

.agendaContent{
  width:816px;
  box-sizing:border-box;
  padding:60px 65px;
  background:#ffffff;
  margin:0;
}

      .agendaCoverPage:before{
        content:"";
        position:absolute;
        width:3.4in;
        height:3.4in;
        border-radius:999px;
        right:-1.15in;
        top:-1.1in;
        background:rgba(254,227,183,.18);
      }

      .agendaCoverPage:after{
        content:"";
        position:absolute;
        width:2.1in;
        height:2.1in;
        border-radius:999px;
        left:-.75in;
        bottom:-.65in;
        background:rgba(190,190,123,.22);
      }

      .agendaCoverInner{
        position:relative;
        z-index:1;
        max-width:6.25in;
      }

.agendaCoverLogo{
  width:1.55in;
  height:1.55in;
  object-fit:contain;
  border-radius:10px;
  margin-bottom:.42in;
}

      .agendaCoverKicker{
        color:#fee3b7;
        font-size:11px;
        line-height:1.35;
        font-weight:900;
        text-transform:uppercase;
        letter-spacing:.13em;
        margin-bottom:14px;
      }

      .agendaCoverPage h1{
        margin:0;
        color:#fff;
        font-size:42px;
        line-height:1.02;
        font-weight:950;
        letter-spacing:-.04em;
        max-width:6.1in;
      }

      .agendaCoverTitle{
        margin-top:18px;
        padding-top:18px;
        border-top:4px solid rgba(254,227,183,.88);
        color:#ffffff;
        font-size:22px;
        line-height:1.15;
        font-weight:900;
      }

      .agendaCoverDate{
        margin-top:24px;
        display:inline-flex;
        width:max-content;
        background:rgba(255,255,255,.12);
        border:1px solid rgba(255,255,255,.22);
        border-radius:999px;
        padding:9px 14px;
        color:#fff;
        font-size:10px;
        font-weight:900;
        text-transform:uppercase;
        letter-spacing:.06em;
      }

      .agendaDayBlock{
        margin-top:18px;
        page-break-inside:auto;
      }

      .agendaDayBlock:first-of-type{
        margin-top:0;
      }

.agendaDayHeader{
  page-break-after:avoid;
  display:block;
  margin:0 0 8px;
  padding-bottom:7px;
  border-bottom:2px solid #dbe3ee;
}

      .agendaDayHeader h2{
        margin:0;
        color:#122345;
        font-size:18px;
        line-height:1.1;
        font-weight:900;
      }

      .agendaDayHeader span{
        color:#64748b;
        font-size:8px;
        font-weight:900;
        text-transform:uppercase;
        letter-spacing:.08em;
        white-space:nowrap;
      }

      .agendaRows{
        width:100%;
      }

      .agendaRow{
        page-break-inside:avoid;
        display:grid;
        grid-template-columns:.95in minmax(0,1fr);
        gap:16px;
        padding:13px 0 14px;
        border-bottom:1px solid #e6edf3;
      }

      .agendaRow:last-child{
        border-bottom:0;
      }

      .agendaTime{
        color:#122345;
        font-size:10.5px;
        font-weight:950;
        line-height:1.25;
        padding-top:2px;
      }

      .agendaSessionMain{
        min-width:0;
      }

      .agendaSessionHead{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
        margin-bottom:5px;
      }

      .agendaSessionHead h3{
        margin:0;
        color:#122345;
        font-size:13.2px;
        line-height:1.25;
        font-weight:900;
      }

.agendaType{
  flex:0 0 auto;
  border-radius:999px;
  padding:3px 8px 3px 4px;
  font-size:7.2px;
  line-height:1;
  font-weight:950;
  text-transform:uppercase;
  letter-spacing:.04em;
  white-space:nowrap;
  border:1px solid transparent;
  display:inline-flex;
  align-items:center;
  gap:5px;
  min-height:22px;
}

.agendaTypeIconWrap{
  width:16px;
  height:16px;
  border-radius:999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  flex:0 0 16px;
  background:rgba(255,255,255,.78);
  border:1px solid rgba(18,35,69,.08);
  overflow:hidden;
}

.agendaTypeIconImg{
  width:12px;
  height:12px;
  object-fit:contain;
  display:block;
}

      .agendaType.workshop{
        background:#eaf4f7;
        color:#187089;
        border-color:#b9dce5;
      }

      .agendaType.strategy{
        background:#fff1df;
        color:#8a4307;
        border-color:#fed7aa;
      }

      .agendaType.creative{
        background:#f4eeee;
        color:#b04239;
        border-color:#e8c8c5;
      }

      .agendaType.keynote{
        background:#edf0f7;
        color:#122345;
        border-color:#cbd5e1;
      }

      .agendaType.skill{
        background:#f1f5d8;
        color:#4b5563;
        border-color:#d7d99c;
      }

      .agendaSpeakers{
        margin:0 0 6px;
        color:#187089;
        font-size:9.5px;
        line-height:1.35;
        font-weight:850;
      }
        .agendaSpeakerLine{
  margin:0 0 2px;
}

.agendaSpeakerLine:last-child{
  margin-bottom:0;
}

.agendaSpeakersMissing{
  color:#64748b;
  font-style:italic;
}

      .agendaDesc{
        margin:0;
        color:#334155;
        font-size:9.2px;
        line-height:1.48;
        font-weight:450;
      }

      .agendaFooter{
        margin-top:22px;
        padding-top:9px;
        border-top:1px solid #dbe3ee;
        display:flex;
        justify-content:space-between;
        gap:14px;
        color:#64748b;
        font-size:7.5px;
        font-weight:800;
      }
    </style>

    <section class="agendaCoverPage">
      <div class="agendaCoverInner">
        ${agendaLogoSrc ? `<img class="agendaCoverLogo" src="${agendaLogoSrc}" alt="Global Gathering logo">` : ''}

        <div class="agendaCoverKicker">A reimagined three-day virtual convening</div>

        <h1>A Global Gathering for the Future of Child Welfare</h1>

        <div class="agendaCoverTitle">October 6-8, 2026 | Program Agenda</div>
      </div>
</section>

<main class="agendaContent">
${Object.entries(grouped).map(([day,items])=>`
      <section class="agendaDayBlock">
<div class="agendaDayHeader">
  <h2>${esc(day)}</h2>
</div>
        <div class="agendaRows">
          ${items.map(item=>{
            const s = item.session;
            const desc = agendaDescription(s);
            const typeText = agendaTypeLabel(item.blockType || s.type);
            const typeClass = agendaTypeClass(item.blockType || s.type);

            return `
              <article class="agendaRow">
                <div class="agendaTime">
                  ${esc(agendaTimeRangeFromItem(item))}
                </div>

                <div class="agendaSessionMain">
                  <div class="agendaSessionHead">
                    <h3>${esc(s.title || 'Untitled session')}</h3>
                    ${agendaTypePillHTML(item.blockType || s.type, typeText)}
                  </div>

                  ${agendaSpeakersHTML(s)}

                  ${desc ? `<p class="agendaDesc">${esc(desc)}</p>` : ''}
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </section>
    `).join('')}

<div class="agendaFooter">
  <span>Global Gathering Agenda as of ${esc(generatedDate)}</span>
  <span>All times represented in Mountain Day Time (MDT)</span>
</div>
</main>
</div>
`;

const holder = document.createElement('div');
holder.style.position = 'absolute';
holder.style.left = '0';
holder.style.top = '0';
holder.style.width = '816px';
holder.style.margin = '0';
holder.style.padding = '0';
holder.style.background = '#ffffff';
holder.style.zIndex = '-1';
holder.style.pointerEvents = 'none';
holder.innerHTML = agendaHTML;
document.body.appendChild(holder);

const element = holder.querySelector('.agendaPdf');

html2pdf()
  .set({
    margin:[0,0,0,0],
    filename:'global-gathering-2026-accepted-sessions-agenda.pdf',
    image:{type:'jpeg', quality:0.98},
    html2canvas:{
      scale:2,
      useCORS:true,
      backgroundColor:'#ffffff',
      scrollX:0,
      scrollY:0,
      x:0,
      y:0,
      width:816,
      windowWidth:816
    },
    jsPDF:{
      unit:'pt',
      format:[612,792],
      orientation:'portrait',
      compress:true
    },
    pagebreak:{
      mode:['legacy'],
      avoid:['.agendaRow','.agendaDayHeader']
    }
  })
    .from(element)
    .save()
    .then(()=>{
      holder.remove();
    })
    .catch(err=>{
      holder.remove();
      console.error(err);
      alert('Could not export the agenda PDF. Check the browser console for details.');
    });
}

function getScheduleAssignmentsExport(){
  const out = {};

  state.submissions.forEach(s=>{
    const sch = getSchedule(s.id);
    if(!sch || !Object.keys(sch).length) return;

    out[s.id] = {
      confirmation:s.confirmation || '',
      title:s.title || '',

      day:sch.day || '',
      start:sch.start || '',
      end:sch.end || '',
      skeletonType:sch.skeletonType || '',

      status:sch.status || '',
      notes:sch.notes || '',

      durationMinutes:sch.durationMinutes || '',
      durationEdited:!!sch.durationEdited,

      room:sch.room || '',
      track:sch.track || '',
      updatedAt:state.saved[s.id]?.updatedAt || ''
    };
  });

  return out;
}

function applyScheduleAssignmentsExport(assignments){
  if(!assignments || typeof assignments !== 'object') return;

  Object.entries(assignments).forEach(([id,sch])=>{
    if(!sch || typeof sch !== 'object') return;

    const current = state.saved[id] || {};

    state.saved[id] = {
      ...current,
      schedule:{
        ...(current.schedule || {}),
        day:sch.day || '',
        start:sch.start || '',
        end:sch.end || '',
        skeletonType:sch.skeletonType || '',
        status:sch.status || '',
        notes:sch.notes || '',
        durationMinutes:sch.durationMinutes || '',
        durationEdited:!!sch.durationEdited,
        room:sch.room || '',
        track:sch.track || ''
      },
      updatedAt:sch.updatedAt || new Date().toISOString()
    };
  });
}

function manualSessionId(){
  return `manual-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
}

function manualSessionOptionsHTML(values, selected=''){
  return values.map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join('');
}

function getManualSessionFormOptions(){
  const typeOptions = [
    '',
    ...(typeof SCHEDULE_TYPE_ORDER !== 'undefined' ? SCHEDULE_TYPE_ORDER : []),
    ...[...new Set(state.submissions.map(s=>s.type).filter(Boolean))]
  ].filter((v,i,a)=>a.indexOf(v)===i);

  const themeOptions = [
    '',
    ...(typeof SCHEDULE_THEME_ORDER !== 'undefined' ? SCHEDULE_THEME_ORDER : []),
    ...[...new Set(state.submissions.map(s=>s.theme).filter(Boolean))]
  ].filter((v,i,a)=>a.indexOf(v)===i);

  return {typeOptions, themeOptions};
}

function primaryPresenterForManualForm(session){
  return session?.presenters?.[0] || {};
}

function manualPresenterRowsHTML(existingSession=null){
  const presenters = Array.isArray(existingSession?.presenters) && existingSession.presenters.length
    ? existingSession.presenters
    : [buildManualPresenter('', '', existingSession?.timeZone || '')];

  return presenters.map((p,i)=>`
    <div class="manualPresenterRow" data-manual-presenter-index="${i}">
      <label>
        Speaker name
        <input class="input manualPresenterName" value="${esc(p.name || [p.firstName,p.lastName].filter(Boolean).join(' ') || '')}">
      </label>

      <label>
        Title
        <input class="input manualPresenterTitle" value="${esc(p.title || '')}">
      </label>

      <label>
        Company / organization
        <input class="input manualPresenterOrg" value="${esc(p.organization || p.company || p.affiliation || '')}">
      </label>

      <label>
        Email
        <input class="input manualPresenterEmail" value="${esc(p.email || '')}">
      </label>

      <div class="manualPresenterActions">
        <button type="button" class="manualPresenterRemoveBtn">Remove</button>
      </div>
    </div>
  `).join('');
}

function addManualPresenterRow(){
  const rowsWrap = document.querySelector('.manualPresenterRows');
  if(!rowsWrap) return;

  const i = rowsWrap.querySelectorAll('.manualPresenterRow').length;

  rowsWrap.insertAdjacentHTML('beforeend', `
    <div class="manualPresenterRow" data-manual-presenter-index="${i}">
      <label>
        Speaker name
        <input class="input manualPresenterName" value="">
      </label>

      <label>
        Title
        <input class="input manualPresenterTitle" value="">
      </label>

      <label>
        Company / organization
        <input class="input manualPresenterOrg" value="">
      </label>

      <label>
        Email
        <input class="input manualPresenterEmail" value="">
      </label>

      <div class="manualPresenterActions">
        <button type="button" class="manualPresenterRemoveBtn">Remove</button>
      </div>
    </div>
  `);
}

function wireManualPresenterButtons(){
  const addBtn = document.getElementById('addManualPresenterBtn');
  if(addBtn){
    addBtn.onclick = addManualPresenterRow;
  }

  document.querySelectorAll('.manualPresenterRemoveBtn').forEach(btn=>{
    btn.onclick = ()=>{
      const rows = document.querySelectorAll('.manualPresenterRow');
      if(rows.length <= 1){
        alert('Keep at least one speaker row.');
        return;
      }
      btn.closest('.manualPresenterRow')?.remove();
    };
  });
}

function readManualPresentersFromModal(existingPresenters=[], fallbackTimeZone=''){
  const rows = [...document.querySelectorAll('.manualPresenterRow')];

  const presenters = rows.map((row,i)=>{
    const existing = existingPresenters[i] || {};
    const name = clean(row.querySelector('.manualPresenterName')?.value);
    const title = clean(row.querySelector('.manualPresenterTitle')?.value);
    const organization = clean(row.querySelector('.manualPresenterOrg')?.value);
    const emailValue = clean(row.querySelector('.manualPresenterEmail')?.value);

    return {
      ...existing,
      role: existing.role || (i === 0 ? 'Primary' : 'Co-presenter'),
      name: name || existing.name || emailValue || 'Presenter TBD',
      title,
      organization,
      company: organization,
      affiliation: organization,
      email: email(emailValue || existing.email || ''),
      timeZone: existing.timeZone || fallbackTimeZone || '',
      firstName: existing.firstName || '',
      lastName: existing.lastName || '',
      bio: existing.bio || '',
      scholarship: existing.scholarship || '',
      city: existing.city || '',
      country: existing.country || '',
      location: existing.location || ''
    };
  }).filter(p=>clean(p.name) || clean(p.email) || clean(p.title) || clean(p.organization));

  return presenters.length ? presenters : [buildManualPresenter('', '', fallbackTimeZone)];
}

function showAddSessionModal(){
  showManualSessionModal();
}

function showEditSessionModal(sessionId){
  const session = state.submissions.find(s=>s.id === sessionId);
  if(!session){
    alert('Could not find that session.');
    return;
  }

  showManualSessionModal(session);
}

function showManualSessionModal(existingSession=null){
  const isEdit = !!existingSession;
  const {typeOptions, themeOptions} = getManualSessionFormOptions();
  const presenter = primaryPresenterForManualForm(existingSession);
  const existingNotes = existingSession ? getNotes(existingSession.id) : '';

  els.modalTitle.innerHTML = `
    <h2>${isEdit ? 'Edit session' : 'Add session'}</h2>
    <div class="micro">Only the title is required. These fields save to browser storage and workspace JSON.</div>
  `;

  els.modalContent.innerHTML = `
    <div class="panel">
      <div class="scheduleControls simple">
        <label>
          Session title *
          <input class="input" id="manualTitle" placeholder="Required" value="${esc(existingSession?.title || '')}">
        </label>

        <label>
          Session type
          <select class="select" id="manualType">
            ${manualSessionOptionsHTML(typeOptions, existingSession?.type || '')}
          </select>
        </label>

        <label>
          Theme
          <select class="select" id="manualTheme">
            ${manualSessionOptionsHTML(themeOptions, existingSession?.theme || '')}
          </select>
        </label>

<label>
  Presenter/session timezone
  <input class="input" id="manualTimeZone" placeholder="Example: MDT, America/Denver, ET" value="${esc(existingSession?.timeZone || presenter.timeZone || '')}">
</label>
      </div>

      <div class="manualPresenterEditor">
<div class="manualPresenterEditorHead">
  <div>
    <h4>Speakers</h4>
    <span>Edit name, title, company/organization, and email</span>
  </div>
  <button type="button" class="manualPresenterAddBtn" id="addManualPresenterBtn">+ Add speaker</button>
</div>
  <div class="manualPresenterRows">
    ${manualPresenterRowsHTML(existingSession)}
  </div>
</div>

      <div class="scheduleNotesAlways">
        <label>Description / abstract</label>
        <textarea class="notes" id="manualDescription" placeholder="Optional">${esc(existingSession?.abstract || existingSession?.description || '')}</textarea>
      </div>

      <div class="scheduleNotesAlways">
        <label>Internal note</label>
        <textarea class="notes" id="manualNote" placeholder="Optional note saved with this session">${esc(existingNotes || '')}</textarea>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
        <button type="button" class="btn" id="cancelManualSessionBtn">Cancel</button>
        <button type="button" class="btn primary" id="saveManualSessionBtn">${isEdit ? 'Save changes' : 'Add session'}</button>
      </div>
    </div>
  `;

  els.modal.classList.add('active');

$('cancelManualSessionBtn').onclick = ()=>els.modal.classList.remove('active');
$('saveManualSessionBtn').onclick = ()=>saveManualSessionFromModal(existingSession?.id || '');
wireManualPresenterButtons();
}

function buildManualPresenter(name,emailValue,timeZone){
  return {
    role:'Primary',
    name:name || emailValue || 'Presenter TBD',
    firstName:'',
    lastName:'',
    email:email(emailValue),
    organization:'',
    title:'',
    bio:'',
    scholarship:'',
    timeZone,
    city:'',
    country:'',
    location:''
  };
}

function saveManualSessionFromModal(existingSessionId=''){
  const title = clean($('manualTitle')?.value);

  if(!title){
    alert('Session title is required.');
    return;
  }

  const type = clean($('manualType')?.value);
  const theme = clean($('manualTheme')?.value);
  const description = clean($('manualDescription')?.value);
const timeZone = clean($('manualTimeZone')?.value);
const note = clean($('manualNote')?.value);
const existingPresentersForEdit = existingSessionId
  ? (state.submissions.find(s=>s.id === existingSessionId)?.presenters || [])
  : [];

const presenters = readManualPresentersFromModal(existingPresentersForEdit, timeZone);
const primaryPresenter = presenters[0] || {};

  if(existingSessionId){
    const idx = state.submissions.findIndex(s=>s.id === existingSessionId);

    if(idx < 0){
      alert('Could not find that session.');
      return;
    }

const current = state.submissions[idx];
const oldType = clean(current.type || '');

const updatedSession = {
  ...current,
  title,
  type,
  theme,
  timeZone,
  presenters:presenters,
  flags:[...new Set([...(current.flags || []), 'Manually edited'])],
  updatedAt:new Date().toISOString()
};

const originalModalDescription = clean(current.abstract || current.description || '');

if(description !== originalModalDescription){
  if(clean(current.abstract)){
    updatedSession.abstract = description;
  }else{
    updatedSession.description = description;
  }
}

state.submissions[idx] = updatedSession;
if(oldType !== type){
  logUserAction({
    id: existingSessionId,
    action: 'Session edited',
    field: 'type',
    oldValue: oldType,
    newValue: type,
    details: 'Presentation type changed via edit session modal'
  });
}

if(note !== getNotes(existingSessionId)){
  saveDecision(existingSessionId, getDecision(existingSessionId), note);
}

state.selectedId = existingSessionId;
  }else{
    const id = manualSessionId();

    const session = {
      id,
      confirmation:id,
      status:'Manual add',
      submittedDate:new Date().toISOString(),
      title,
      description,
      abstract:description,
      type,
      theme,
      tags:[],
      duration:'',
      timeZone,
      cannotDays:'',
      outsideBusinessHours:'',
      recording:'',
      preRecord:'',
      techSupport:'',
      features:'',
      interpretation:'',
      interpreterAssist:'',
      ceu:'',
      scholarship:'',
      livedExperience:'',
      opsExtra:[],
      presenters:presenters,
      reviews:[],
      reviewAvg:null,
      reviewSpread:0,
      completedReviews:0,
      numberReviewers:'',
      dimensionAvg:null,
      historicalMatches:[],
      historicalCount:0,
      maxHistoricalAttendance:0,
      decisionScore:50,
      band:'Middle',
      flags:['Manually added'],
      updatedAt:new Date().toISOString()
    };

state.submissions.push(session);
state.selectedId = id;

logUserAction({
  id,
  action:'Session added',
  field:'session',
  oldValue:'',
  newValue:title,
  details:{
    source:'manual add modal',
    title,
    type,
    theme,
primaryPresenter:primaryPresenter.name || primaryPresenter.email || 'Presenter TBD',
presenterEmail:primaryPresenter.email || '',
    timeZone,
    noteAdded:!!note
  }
});

if(note){
  saveDecision(id, getDecision(id), note);
}
  }

  state.activeTab = 'overview';

  storeSave();
  initFilters();
  setEnabled(true);
  renderAll();
  persistBuiltDataset();

  els.modal.classList.remove('active');
}

function deleteSessionWithConfirm(sessionId){
  const session = state.submissions.find(s=>s.id === sessionId);

  if(!session){
    alert('Could not find that session.');
    return;
  }

  const savedBeforeDelete = state.saved?.[sessionId] || {};
  const scheduleBeforeDelete = savedBeforeDelete.schedule || {};

  const confirmed = confirm(`Delete this session?\n\n${session.title || 'Untitled session'}\n\nThis removes it from the dashboard, browser storage, schedules, decisions, and future JSON exports.`);

  if(!confirmed) return;

  logUserAction({
    id:sessionId,
    action:'Session deleted',
    field:'session',
    oldValue:session.title || '',
    newValue:'',
    details:{
      confirmation:session.confirmation || sessionId,
      title:session.title || '',
      type:session.type || '',
      theme:session.theme || '',
      primaryPresenter:session.presenters?.[0]?.name || '',
      presenterCount:Array.isArray(session.presenters) ? session.presenters.length : 0,
      decision:savedBeforeDelete.decision || '',
      hadDecisionNotes:!!savedBeforeDelete.notes,
      scheduleStatus:scheduleBeforeDelete.status || '',
      scheduleDay:scheduleBeforeDelete.day || '',
      scheduleStart:scheduleBeforeDelete.start || '',
      scheduleEnd:scheduleBeforeDelete.end || '',
      hadScheduleNotes:!!scheduleBeforeDelete.notes
    }
  });

  state.submissions = state.submissions.filter(s=>s.id !== sessionId);

  if(state.saved && state.saved[sessionId]){
    delete state.saved[sessionId];
  }

  if(state.selectedId === sessionId){
    state.selectedId = state.submissions[0]?.id || '';
  }

  state.activeTab = 'overview';

  storeSave();
  initFilters();
  renderAll();
  persistBuiltDataset();

  if(!state.submissions.length){
    setEnabled(false);
  }
}

function truncateText(value, max=900){
  const text = clean(value);
  if(text.length <= max) return text;
  return text.slice(0,max).trim() + '…';
}

function getAiScheduleSummaryForSession(s){
  const sch = getSchedule(s.id) || {};
  if(!sch.status || sch.status === 'Unscheduled'){
    return {status:'Unscheduled'};
  }

  return {
    status:sch.status || 'Unscheduled',
    day:sch.day || '',
    start:sch.start || '',
    end:sch.end || '',
    durationMinutes:sch.durationMinutes || '',
    durationEdited:!!sch.durationEdited,
    notes:truncateText(sch.notes || '', 300)
  };
}

function getAiReviewSummaryForSession(s){
  return {
    average:s.reviewAvg ?? null,
    spread:s.reviewSpread ?? null,
    completed:s.completedReviews ?? 0,
    reviewers:s.numberReviewers || ''
  };
}

function getAiDecisionSummaryForSession(s){
  return {
    decision:getDecision(s.id),
    notes:truncateText(getNotes(s.id), 600)
  };
}

function getAiPresenterSummaryForSession(s){
  return (s.presenters || []).slice(0,7).map(p=>({
    role:p.role || '',
    name:p.name || '',
    email:p.email || '',
    organization:p.organization || '',
    title:p.title || '',
    location:p.location || [p.city,p.country].filter(Boolean).join(', '),
    scholarship:p.scholarship || ''
  }));
}

function getAiRelevantSessions(submissions, prompt, limit=10){
  const q = norm(prompt || '');
  const words = q.split(/\s+/).filter(w=>w.length > 3);

  return [...submissions].map(s=>{
    const haystack = norm([
      s.title,
      s.type,
      s.theme,
      s.description,
      s.abstract,
      (s.presenters || []).map(p=>p.name).join(' '),
      getNotes(s.id),
      (s.flags || []).join(' '),
      (s.tags || []).join(' ')
    ].join(' '));

    let score = 0;
    words.forEach(w=>{
      if(haystack.includes(w)) score += 1;
      if(norm(s.title).includes(w)) score += 3;
      if(norm(s.theme).includes(w)) score += 2;
      if(norm(s.type).includes(w)) score += 2;
    });

    return {s,score};
  })
  .sort((a,b)=>b.score-a.score || ((b.s.reviewAvg || 0) - (a.s.reviewAvg || 0)))
  .slice(0,limit)
  .map(x=>x.s);
}

function getAiDashboardContext(mode='full', prompt=''){
  const submissions = state.submissions || [];
  const scheduled = submissions.filter(s=>(getSchedule(s.id).status || '') === 'Scheduled');

  const decisions = submissions.reduce((acc,s)=>{
    const d = getDecision(s.id);
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  },{});

  const byType = submissions.reduce((acc,s)=>{
    const key = s.type || 'Unspecified';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  },{});

  const byTheme = submissions.reduce((acc,s)=>{
    const key = s.theme || 'Unspecified';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  },{});

  const scheduledByDay = scheduled.reduce((acc,s)=>{
    const sch = getSchedule(s.id);
    const key = sch.day || 'Unspecified';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  },{});

  const base = {
    dashboard:'Global Gathering Session Decision Hub',
    conferenceTimeZone:'Mountain Time / America/Denver',
    totals:{
      submissions:submissions.length,
      scheduled:scheduled.length,
      unscheduled:submissions.length - scheduled.length,
      decisions,
      byType,
      byTheme,
      scheduledByDay
    },
    programSkeleton:skeletonRows().map(slot=>({
      day:slot.day,
      start:slot.start,
      end:slot.end,
      type:slot.type
    }))
  };

  if(mode === 'groq'){
    const relevant = getAiRelevantSessions(submissions, prompt, 10);

    return {
      ...base,

      // Tiny index of all sessions so Groq can still reason across the whole pool.
      sessionIndex:submissions.map(s=>({
        id:s.id,
        title:truncateText(s.title,90),
        type:truncateText(s.type,35),
        theme:truncateText(s.theme,45),
        duration:truncateText(s.duration,20),
        decision:getDecision(s.id),
        score:s.reviewAvg ?? null,
        scheduled:(getSchedule(s.id).status || 'Unscheduled')
      })),

      // More detail only for sessions likely relevant to the question.
      relevantSessions:relevant.map(s=>({
        id:s.id,
        title:s.title,
        type:s.type,
        theme:s.theme,
        duration:s.duration,
        description:truncateText(s.description || s.abstract, 300),
        presenters:(s.presenters || []).slice(0,7).map(p=>p.name).filter(Boolean),
        review:getAiReviewSummaryForSession(s),
        decision:{
          decision:getDecision(s.id),
          notes:truncateText(getNotes(s.id), 180)
        },
        schedule:getAiScheduleSummaryForSession(s),
        flags:(s.flags || []).slice(0,8),
        tags:(s.tags || []).slice(0,8),
        constraints:{
          cannotDays:truncateText(s.cannotDays || '',120),
          outsideBusinessHours:truncateText(s.outsideBusinessHours || '',120),
          timeZone:truncateText(s.timeZone || '',60)
        }
      }))
    };
  }

  return {
    ...base,
    sessions:submissions.map(s=>({
      id:s.id,
      title:s.title,
      type:s.type,
      theme:s.theme,
      duration:s.duration,
      description:truncateText(s.description || s.abstract, 900),
      presenters:getAiPresenterSummaryForSession(s),
      review:getAiReviewSummaryForSession(s),
      decision:getAiDecisionSummaryForSession(s),
      schedule:getAiScheduleSummaryForSession(s),
      flags:s.flags || [],
      tags:s.tags || [],
      constraints:{
        cannotDays:s.cannotDays || '',
        outsideBusinessHours:s.outsideBusinessHours || '',
        timeZone:s.timeZone || '',
        recording:s.recording || '',
        techSupport:s.techSupport || '',
        ceu:s.ceu || '',
        interpretation:s.interpretation || '',
        scholarship:s.scholarship || '',
        livedExperience:s.livedExperience || ''
      }
    }))
  };
}

function aiSystemInstruction(){
  return `
You are an embedded AI assistant inside the Global Gathering Session Decision Hub helping out. Be concise, direct, and useful. Use bullets when helpful.
`;
}

async function callGemini(prompt){
  if(!GEMINI_API_KEY || GEMINI_API_KEY === 'PASTE_YOUR_GEMINI_API_KEY_HERE'){
    throw new Error('Add your Gemini API key in GEMINI_API_KEY first.');
  }

  const context = getAiDashboardContext();

  const contents = [
    ...aiConversation.slice(-8),
    {
      role:'user',
      parts:[{
        text:`Dashboard data:\n${JSON.stringify(context)}\n\nUser request:\n${prompt}`
      }]
    }
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
    {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        systemInstruction:{
          parts:[{text:aiSystemInstruction()}]
        },
        contents,
        generationConfig:{
          temperature:0.25,
          maxOutputTokens:6000
        }
      })
    }
  );

  if(!response.ok){
    const errText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];

if(candidate?.finishReason === 'MAX_TOKENS'){
  throw new Error('Gemini stopped because it reached MAX_TOKENS.');
}
  const text =
    candidate?.content?.parts?.map(p=>p.text || '').join('\n').trim() ||
    'No response returned.';

  aiConversation.push(
    {role:'user',parts:[{text:prompt}]},
    {role:'model',parts:[{text}]}
  );

  return text;
}

function groqMessagesFromAiConversation(prompt){
  const context = getAiDashboardContext('groq', prompt);

  const history = aiConversation.slice(-4).map(m=>({
    role:m.role === 'model' ? 'assistant' : 'user',
    content:truncateText((m.parts || []).map(p=>p.text || '').join('\n'), 700)
  })).filter(m=>m.content);

  return [
    {
      role:'system',
      content:aiSystemInstruction()
    },
    ...history,
    {
      role:'user',
      content:`Compact dashboard data:\n${JSON.stringify(context)}\n\nUser request:\n${prompt}`
    }
  ];
}

async function callGroq(prompt, fallbackReason){
  if(!GROQ_API_KEY || GROQ_API_KEY === 'PASTE_YOUR_GROQ_API_KEY_HERE'){
    throw new Error(`Gemini failed, but Groq API key is missing. Gemini issue: ${fallbackReason}`);
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':`Bearer ${GROQ_API_KEY}`
    },
    body:JSON.stringify({
      model:GROQ_MODEL,
      messages:groqMessagesFromAiConversation(prompt),
      temperature:0.25,
      max_completion_tokens:6000
    })
  });

  if(!response.ok){
    const errText = await response.text();
    throw new Error(`Gemini failed, and Groq fallback also failed. Gemini issue: ${fallbackReason}. Groq issue: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if(choice?.finish_reason === 'length'){
    throw new Error(`Groq fallback also reached the response length limit. Gemini issue: ${fallbackReason}`);
  }

  const text = choice?.message?.content?.trim() || 'No response returned.';

  aiConversation.push(
    {role:'user',parts:[{text:prompt}]},
    {role:'model',parts:[{text}]}
  );

  return text;
}

async function callAiWithFallback(prompt){
  try{
    return await callGemini(prompt);
  }catch(geminiError){
    const groqText = await callGroq(prompt, geminiError.message);
    return `Used Groq fallback because Gemini failed or stopped early.\n\n${groqText}`;
  }
}

function showAiAssistantModal(){
  els.modalTitle.innerHTML = `
    <h2>AI Summary</h2>
    <div class="micro">Uses the current dashboard data, decisions, notes, schedules, presenters, review signals, and program skeleton.</div>
  `;

  els.modalContent.innerHTML = `
    <div class="aiModalGrid">
      <div>
<div id="aiAnswerBox" class="aiAnswerBox">
  <span class="aiLoading">Ask a question to start.</span>
</div>
      </div>

<aside class="aiChatPanel">
  <h4>Chat</h4>
  <div class="micro" style="margin-bottom:10px">
    Ask anything about the current dashboard data.
  </div>

  <textarea id="aiQuestionInput" class="aiQuestionInput" placeholder="Ask anything about the current dashboard..."></textarea>

  <div class="aiChatActions">
    <button type="button" class="btn" id="clearAiChatBtn">Clear chat</button>
    <button type="button" class="btn primary" id="sendAiQuestionBtn">Ask AI</button>
  </div>
</aside>
    </div>
  `;

  els.modal.classList.add('active');

  $('sendAiQuestionBtn').onclick = sendAiQuestion;
  $('clearAiChatBtn').onclick = ()=>{
    aiConversation = [];
    $('aiAnswerBox').textContent = 'Chat cleared. Ask a new question.';
  };

}

async function sendAiQuestion(){
  const input = $('aiQuestionInput');
  const box = $('aiAnswerBox');
  const question = clean(input?.value);

  if(!question){
    alert('Enter a question first.');
    return;
  }

  try{
    box.innerHTML = `<span class="aiLoading">Thinking…</span>`;
    const answer = await callAiWithFallback(question);
    box.textContent = answer;
    input.value = '';
  }catch(e){
    box.innerHTML = `<div class="errorBox">${esc(e.message)}</div>`;
  }
}

function getWorkspaceExportPayload(){
  const scheduleAssignments = getScheduleAssignmentsExport();

  return {
    schema:'GlobalGatheringDecisionHubWorkspace',
    version:3,
    exportedAt:new Date().toISOString(),

    submissions:state.submissions,

// Full saved review state: decisions, notes, schedule, duration edits, timestamps.
saved:state.saved,

// Global working notes from the Decision score notes drawer.
scoreNotes:getScoreNotes(),

// Completed/open state for tag_task items pulled from decision and scheduling notes.
taskStatus:state.taskStatus || {},

// Audit trail of decision and scheduling actions.
actionLog:state.actionLog || [],

    // Easy-to-audit scheduling export at top level.
    scheduleAssignments,

    // Easy-to-audit decision export at top level.
    decisionAssignments:state.submissions.reduce((out,s)=>{
      out[s.id] = {
        confirmation:s.confirmation || '',
        title:s.title || '',
        decision:getDecision(s.id),
        notes:getNotes(s.id),
        updatedAt:state.saved[s.id]?.updatedAt || ''
      };
      return out;
    },{}),

    programSkeleton:skeletonRows(),
    skeletonTimezone:state.skeletonTimezone || '',
    selectedId:state.selectedId || '',

    fileMaps:state.fileMaps.map(m=>({
      name:m.name,
      rows:m.rows || [],
      category:m.category,
      year:m.year || '',
      useAs:m.useAs || 'ignore',
      error:m.error || ''
    })),

    uiState:{
      sheetScheduleMode:!!state.sheetScheduleMode,
      sheetSort:state.sheetSort || {},
      filters:state.filters || {},
      quickFilter:state.quickFilter || '',
      activeTab:state.activeTab || ''
    }
  };
}

function exportMergedJSON(){
  downloadBlob(
    'global-gathering-review-workspace.json',
    JSON.stringify(getWorkspaceExportPayload(),null,2),
    'application/json'
  );
}

let autoBackupFileHandle = null;
let autoBackupTimer = null;
let autoBackupLastSavedAt = '';
const AUTO_BACKUP_HANDLE_KEY = 'autoBackupFileHandle';

async function chooseAutoBackupFile(){
  if(!('showSaveFilePicker' in window)){
    alert('Autosave backup needs Chrome or Edge. Firefox does not support the local file-writing method this uses.');
    return;
  }

  try{
    autoBackupFileHandle = await window.showSaveFilePicker({
      suggestedName:'global-gathering-autosave-workspace.json',
      types:[{
        description:'Workspace JSON',
        accept:{'application/json':['.json']}
      }]
    });

    await idbSet(AUTO_BACKUP_HANDLE_KEY, autoBackupFileHandle);
    await startAutoBackupFromHandle({showAlert:true});
  }catch(e){
    if(e.name !== 'AbortError'){
      alert('Could not start autosave backup: ' + e.message);
    }
  }
}

async function verifyAutoBackupPermission(fileHandle, withPrompt=false){
  if(!fileHandle) return false;

  const options = {mode:'readwrite'};

  if(typeof fileHandle.queryPermission === 'function'){
    const existing = await fileHandle.queryPermission(options);
    if(existing === 'granted') return true;
  }

  if(withPrompt && typeof fileHandle.requestPermission === 'function'){
    const requested = await fileHandle.requestPermission(options);
    return requested === 'granted';
  }

  return false;
}

async function startAutoBackupFromHandle({showAlert=false, withPrompt=true} = {}){
  if(!autoBackupFileHandle) return false;

  const hasPermission = await verifyAutoBackupPermission(autoBackupFileHandle, withPrompt);

  if(!hasPermission){
    if(els.autoBackupBtn){
      els.autoBackupBtn.textContent = 'Autosave backup paused — click to resume';
      els.autoBackupBtn.classList.remove('activeQuick');
    }
    return false;
  }

  await writeAutoBackupNow();

  if(autoBackupTimer){
    clearInterval(autoBackupTimer);
  }

  autoBackupTimer = setInterval(writeAutoBackupNow, 5 * 60 * 1000);

  if(els.autoBackupBtn){
els.autoBackupBtn.textContent = `Autosave on — last saved ${autoBackupLastSavedAt || 'just now'}`;
    els.autoBackupBtn.classList.add('activeQuick');
  }

  if(showAlert){
    alert('Autosave backup is on. Keep this page open. The selected JSON file will be updated every 5 minutes.');
  }

  return true;
}

async function restoreAutoBackupHandle(){
  try{
    const savedHandle = await idbGet(AUTO_BACKUP_HANDLE_KEY);

    if(!savedHandle){
      return;
    }

    autoBackupFileHandle = savedHandle;

    const resumed = await startAutoBackupFromHandle({showAlert:false, withPrompt:false});

    if(!resumed && els.autoBackupBtn){
      els.autoBackupBtn.textContent = 'Autosave backup paused — click to resume';
    }
  }catch(e){
    console.warn('Could not restore autosave backup handle', e);
  }
}

async function writeAutoBackupNow(){
  if(!autoBackupFileHandle) return;

  const payload = getWorkspaceExportPayload();
  payload.backupType = 'autosave';
  payload.autoBackupSavedAt = new Date().toISOString();

try{
  const writable = await autoBackupFileHandle.createWritable();
  await writable.write(JSON.stringify(payload,null,2));
  await writable.close();

  autoBackupLastSavedAt = new Date().toLocaleString();

  if(els.autoBackupBtn){
    els.autoBackupBtn.textContent = `Autosave on: ${autoBackupLastSavedAt}`;
    els.autoBackupBtn.classList.add('activeQuick');
  }
}catch(e){
  console.warn('Autosave backup failed', e);

  if(autoBackupTimer){
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }

  if(els.autoBackupBtn){
    els.autoBackupBtn.textContent = 'Autosave backup paused — click to resume';
    els.autoBackupBtn.classList.remove('activeQuick');
  }
}
}

async function importWorkspaceJSON(file){
  try{
    const text = await readFileAsText(file);
    const data = JSON.parse(text);

    const submissions = Array.isArray(data.submissions)
      ? data.submissions
      : Array.isArray(data.items)
        ? data.items
        : null;

    if(!submissions || !submissions.length){
      throw new Error('This JSON does not contain a valid submissions/workspace dataset.');
    }

    state.submissions = submissions;
state.saved = data.saved && typeof data.saved === 'object' ? data.saved : {};
if(typeof data.scoreNotes === 'string'){
  state.saved.__scoreNotes = {
    text:data.scoreNotes,
    updatedAt:data.scoreNotesUpdatedAt || new Date().toISOString()
  };
}
state.taskStatus = data.taskStatus && typeof data.taskStatus === 'object' ? data.taskStatus : {};
saveTaskStatus();
state.actionLog = Array.isArray(data.actionLog) ? data.actionLog : [];
saveActionLog();
state.fileMaps = Array.isArray(data.fileMaps) ? data.fileMaps : [];

    state.programSkeleton = Array.isArray(data.programSkeleton) && data.programSkeleton.length
      ? data.programSkeleton
      : [];

    state.skeletonTimezone = data.skeletonTimezone || state.skeletonTimezone || '';
    state.sheetScheduleMode = !!data.uiState?.sheetScheduleMode;
state.sheetSort = data.uiState?.sheetSort || state.sheetSort || {col:null,dir:1};

    // Restores explicit top-level scheduling assignments if present.
    applyScheduleAssignmentsExport(data.scheduleAssignments);

    state.selectedId =
      state.submissions.find(x=>x.id === data.selectedId)?.id ||
      state.submissions[0].id;

    storeSave();

    els.sourceStatus.innerHTML = `
      <div class="micro">
        <b>Workspace imported:</b> sessions, decisions, notes, scheduling assignments, source file rows, and program skeleton were restored from JSON.
      </div>
    `;

    if($('sourceMini')) $('sourceMini').textContent = `Imported ${state.submissions.length} submissions`;

    renderFileRows();
    initFilters();
    setEnabled(true);
renderAll();
if(els.scoreNotes) els.scoreNotes.value = getScoreNotes();
await persistBuiltDataset();

    alert('Workspace JSON imported. Sessions, decisions, notes, scheduling assignments, source file rows, and program skeleton were restored.');
  }catch(e){
    alert('Could not import workspace JSON: ' + e.message);
  }
}

els.uploadBtn.onclick=()=>els.uploadModal.classList.add('active');
els.addSessionBtn.onclick=showAddSessionModal;
els.aiAssistantBtn.onclick=showAiAssistantModal;
if(els.tasksBtn) els.tasksBtn.onclick=showTasksModal;els.closeUpload.onclick=()=>els.uploadModal.classList.remove('active');els.fileInput.onchange=e=>addFiles([...e.target.files]);['dragenter','dragover'].forEach(ev=>els.dropZone.addEventListener(ev,e=>{e.preventDefault();els.dropZone.classList.add('drag')}));['dragleave','drop'].forEach(ev=>els.dropZone.addEventListener(ev,e=>{e.preventDefault();els.dropZone.classList.remove('drag')}));els.dropZone.addEventListener('drop',e=>addFiles([...e.dataTransfer.files]));els.clearFilesBtn.onclick=()=>{state.fileMaps=[];renderFileRows();};els.buildBtn.onclick=buildData;for(const el of [els.search,els.sortBy])el.addEventListener('input',renderAll); document.addEventListener('click',e=>{if(!e.target.closest('.multiFilter'))document.querySelectorAll('.multiFilter.open').forEach(x=>x.classList.remove('open')); if(!e.target.closest('.sheetMultiFilter'))document.querySelectorAll('.sheetMultiFilter.open').forEach(x=>x.classList.remove('open'));});document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>{if(b.dataset.quick==='clear'){state.quickFilter='';renderAll();return;} if(b.dataset.quick==='clearAll'){resetAllFilters();return;} state.quickFilter=b.dataset.quick;renderAll();});
els.exportBtn.onclick=exportCSV;
els.agendaPdfBtn.onclick=exportAcceptedAgendaPDF;
els.exportDataBtn.onclick=exportMergedJSON;
els.mailMergeExportBtn.onclick=exportMailMergeCSV;
els.cventSpeakerBtn.onclick=showCventSpeakerExport;
if(els.scoreNotes){
  els.scoreNotes.value = getScoreNotes();
  els.scoreNotes.addEventListener('input', e=>{
    setScoreNotes(e.target.value);
  });
}
if(els.autoBackupBtn) els.autoBackupBtn.onclick=chooseAutoBackupFile;
if(els.exportActionLogBtn) els.exportActionLogBtn.onclick=exportActionLogCSV;

els.importStateBtn.onclick=()=>els.importStateInput.click();
els.importStateInput.onchange=e=>{
  const file=e.target.files?.[0];
  if(file) importWorkspaceJSON(file);
  e.target.value='';
};

els.uploadSkeletonBtn.onclick=()=>els.skeletonInput.click();
els.skeletonInput.onchange=e=>{
  const file=e.target.files?.[0];
  if(file) importProgramSkeleton(file);
  e.target.value='';
};

if(els.exportSkeletonBtn){
  els.exportSkeletonBtn.onclick=exportProgramSkeletonCSV;
}

els.summaryBtn.onclick=showProgramBalance;
els.scheduleSummaryBtn.onclick=showScheduleSummary;
els.programSkeletonBtn.onclick=showProgramSkeleton;
els.detail.addEventListener('click',e=>{
  if(e.target.closest('.detailExpandBtn')) toggleDetailFullScreen();
});
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(document.body.classList.contains('detail-fullscreen')) document.body.classList.remove('detail-fullscreen');
    if(document.body.classList.contains('sheet-fullscreen')) document.body.classList.remove('sheet-fullscreen');
  }
});

els.sheetModeBtn.onclick=()=>{
  if(document.body.classList.contains('sheet-view')){
    document.body.classList.remove('sheet-view','sheet-fullscreen');
    els.sheetModeBtn.classList.remove('sage');
    if(els.sheetExpandBtn) els.sheetExpandBtn.classList.remove('active');
    renderAll();
    return;
  }
  renderSheetMode();
  document.body.classList.add('sheet-view');
  els.sheetModeBtn.classList.add('sage');
};

els.sheetExpandBtn.onclick=()=>{
  document.body.classList.toggle('sheet-fullscreen');
  els.sheetExpandBtn.classList.toggle('active', document.body.classList.contains('sheet-fullscreen'));
};


els.resetBtn.onclick=()=>{
  if(confirm('Clear all saved decisions, notes, scheduling assignments, edited durations, and schedule notes in this browser?')){
state.saved = {};
state.taskStatus = {};
state.actionLog = [];
storeSave();
saveTaskStatus();
saveActionLog();
persistBuiltDataset();
renderAll();
  }
};

els.closeModal.onclick=()=>els.modal.classList.remove('active');els.modal.onclick=e=>{if(e.target===els.modal)els.modal.classList.remove('active')};
// Attach delegated list handlers once during initialization
els.list.onclick = (e) => {
  // Let the left-card Tags carrot open/close without selecting or re-rendering the card.
  if (e.target.closest?.('.itemTopPills summary') || e.target.closest?.('.pillSummary summary')) {
    e.stopPropagation();
    return;
  }

  const item = e.target.closest?.('.item');
  if (!item) return;

  state.selectedId = item.dataset.id;
  renderAll(false);
};
els.list.onkeydown = (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;

  // Let keyboard users open/close the Tags details without selecting/re-rendering.
  if (e.target.closest?.('.itemTopPills summary') || e.target.closest?.('.pillSummary summary')) {
    return;
  }

  const item = e.target.closest?.('.item');
  if (!item) return;

  e.preventDefault();
  state.selectedId = item.dataset.id;
  renderAll(false);
};
storeLoad();
loadActionLog();
updateActionLogDisplay();
setEnabled(false);
restoreBuiltDataset();
