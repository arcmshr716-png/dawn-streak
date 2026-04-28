const ALARM_HOUR = 6;
const ALARM_MIN = 0;
const STORAGE_KEY = 'dawn-streak-records';

let alarmActive = false;
let alarmBeepInterval = null;
let audioCtx = null;

function getRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecord(dateStr) {
  const records = getRecords();
  if (!records.includes(dateStr)) {
    records.push(dateStr);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }
}

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function calculateStreak(records) {
  if (!records.length) return 0;
  const sorted = [...new Set(records)].sort().reverse();
  const today = toDateString(new Date());
  const yesterday = toDateString(new Date(Date.now() - 86400000));
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;
  let streak = 0;
  let cursor = new Date(sorted[0] + 'T12:00:00');
  for (const d of sorted) {
    if (d === toDateString(cursor)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function calculateBest(records) {
  if (!records.length) return 0;
  const sorted = [...new Set(records)].sort();
  let best = 1, current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000;
    if (diff === 1) {
      current++;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('clock').textContent = `${h}:${m}:${s}`;

  if (now.getHours() === ALARM_HOUR && now.getMinutes() === ALARM_MIN && !alarmActive) {
    if (!getRecords().includes(toDateString(now))) {
      triggerAlarm();
    }
  }
}

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playBeep() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.35, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.45);
}

function startAlarmSound() {
  playBeep();
  alarmBeepInterval = setInterval(playBeep, 1100);
}

function stopAlarmSound() {
  if (alarmBeepInterval) {
    clearInterval(alarmBeepInterval);
    alarmBeepInterval = null;
  }
}

function triggerAlarm() {
  alarmActive = true;
  document.getElementById('alarmScreen').classList.add('active');
  document.getElementById('alarmDot').style.background = 'var(--alarm)';
  startAlarmSound();
  if (Notification.permission === 'granted') {
    new Notification('Dawn Streak', { body: 'Time to rise! 🌅' });
  }
}

function stopAlarm() {
  alarmActive = false;
  document.getElementById('alarmScreen').classList.remove('active');
  document.getElementById('alarmDot').style.background = '';
  stopAlarmSound();
  const today = toDateString(new Date());
  saveRecord(today);
  updateUI();
}

function testAlarm() {
  triggerAlarm();
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function updateUI() {
  const records = getRecords();
  const streak = calculateStreak(records);
  const best = calculateBest(records);

  document.getElementById('streakNumber').textContent = streak;
  document.getElementById('bestNumber').textContent = best;
  document.getElementById('totalCount').textContent =
    `${records.length} day${records.length !== 1 ? 's' : ''} total`;

  const today = toDateString(new Date());
  const sorted = [...records].sort().reverse().slice(0, 10);
  const list = document.getElementById('historyList');

  if (!sorted.length) {
    list.innerHTML = '<div class="empty-state">No records yet.<br>Rise at 6AM to start your streak.</div>';
    return;
  }

  list.innerHTML = sorted.map((d, i) => {
    const isToday = d === today;
    const showBadge = i === 0 && streak > 0;
    return `
      <div class="history-item">
        <span class="history-date">
          ${formatDate(d)}${isToday ? ' <span class="history-today">— Today</span>' : ''}
        </span>
        <div class="history-right">
          ${showBadge ? `<span class="streak-badge">${streak} day streak</span>` : ''}
          <span class="check-mark">✓</span>
        </div>
      </div>`;
  }).join('');
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    document.getElementById('notifBanner').classList.remove('hidden');
  }
}

function enableNotifications() {
  Notification.requestPermission().then(() => {
    document.getElementById('notifBanner').classList.add('hidden');
  });
}

function checkMissedAlarm() {
  const now = new Date();
  const h = now.getHours();
  if (h === ALARM_HOUR || h === ALARM_HOUR + 1) {
    if (!getRecords().includes(toDateString(now))) {
      setTimeout(triggerAlarm, 600);
    }
  }
}

function init() {
  updateUI();
  setInterval(updateClock, 1000);
  updateClock();
  requestNotificationPermission();
  checkMissedAlarm();
}

document.addEventListener('DOMContentLoaded', init);
