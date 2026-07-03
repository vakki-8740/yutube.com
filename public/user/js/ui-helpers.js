// ==================== UI HELPERS ====================
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  const v = el.value.trim();
  if (v) showSendBtn(); else hideSendBtn();
}

function showSendBtn() { document.getElementById('sendBtn').classList.add('show'); }
function hideSendBtn() { document.getElementById('sendBtn').classList.remove('show'); }

function scrollToBottom() {
  const c = document.getElementById('messagesArea');
  setTimeout(() => c.scrollTop = c.scrollHeight, 50);
}

function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

let voiceAudio = null;
let voicePlayingEl = null;
function playVoiceMsg(el, url) {
  if (voicePlayingEl && voicePlayingEl !== el) {
    voicePlayingEl.classList.remove('playing');
    if (voiceAudio) { voiceAudio.pause(); voiceAudio = null; }
  }
  if (voicePlayingEl === el && voiceAudio && !voiceAudio.paused) {
    voiceAudio.pause();
    el.classList.remove('playing');
    voicePlayingEl = null;
    return;
  }
  if (voiceAudio && voicePlayingEl === el) {
    voiceAudio.currentTime = 0;
    voiceAudio.play();
    el.classList.add('playing');
    return;
  }
  const audio = new Audio(url);
  audio.onended = () => { el.classList.remove('playing'); voicePlayingEl = null; voiceAudio = null; };
  audio.play();
  voiceAudio = audio;
  voicePlayingEl = el;
  el.classList.add('playing');
}

function showToast(title, msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastAvatar').textContent = title.charAt(0).toUpperCase();
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
