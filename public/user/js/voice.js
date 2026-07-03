// ==================== VOICE RECORDING PAGE ====================
const VOICE_API = 'https://yutube-com-pcu9.onrender.com';
let voiceRecMediaRecorder = null;
let voiceRecChunks = [];
let voiceRecStartTime = null;
let voiceRecTimer = null;
let voiceRecBlob = null;
let voiceRecDuration = 0;
let voiceRecPreviewAudio = null;
let voiceRecPlaying = false;
let voiceCardAudio = null;
let voiceCardInterval = null;
let voiceCardPlayEl = null;

function showVoiceSheet(id) {
  document.getElementById(id).style.display = 'block';
  document.querySelector('.bottom-nav').style.display = 'none';
}
function hideVoiceSheet(id) {
  document.getElementById(id).style.display = 'none';
  document.querySelector('.bottom-nav').style.display = 'flex';
}

function openVoiceRecorder() {
  switchTab('voice');
}

function startVoiceRec() {
  if (!myId) return;
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    voiceRecChunks = [];
    voiceRecBlob = null;
    voiceRecDuration = 0;
    const opts = { mimeType: 'audio/webm' };
    try {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) opts.mimeType = 'audio/webm;codecs=opus';
      opts.audioBitsPerSecond = 24000;
    } catch(e) {}
    voiceRecMediaRecorder = new MediaRecorder(stream, opts);
    voiceRecMediaRecorder.ondataavailable = e => { if (e.data.size > 0) voiceRecChunks.push(e.data); };
    voiceRecMediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      voiceRecDuration = Math.floor((Date.now() - voiceRecStartTime) / 1000);
      voiceRecBlob = new Blob(voiceRecChunks, { type: 'audio/webm' });
      setRecordingStatus(false);
      showVoicePreview();
    };
    voiceRecMediaRecorder.start();
    voiceRecStartTime = Date.now();
    setRecordingStatus(true);
    hideVoiceSheet('voicePreviewUI');
    showVoiceSheet('voiceRecordingUI');
    document.getElementById('voiceFabBtn').style.display = 'none';
    startVoiceRecTimer();
  }).catch(() => {
    alert('Microphone access is required.');
  });
}

function startVoiceRecTimer() {
  const el = document.getElementById('voiceRecTimer');
  if (voiceRecTimer) clearInterval(voiceRecTimer);
  voiceRecTimer = setInterval(() => {
    const sec = Math.floor((Date.now() - voiceRecStartTime) / 1000);
    if (sec >= 60) stopVoiceRec();
    el.textContent = formatDuration(sec);
  }, 200);
}

function stopVoiceRec() {
  if (voiceRecMediaRecorder && voiceRecMediaRecorder.state === 'recording') {
    voiceRecMediaRecorder.stop();
    if (voiceRecTimer) clearInterval(voiceRecTimer);
    hideVoiceSheet('voiceRecordingUI');
  }
}

function cancelVoiceRec() {
  if (voiceRecMediaRecorder && voiceRecMediaRecorder.state === 'recording') {
    voiceRecMediaRecorder.stream.getTracks().forEach(t => t.stop());
    voiceRecMediaRecorder = null;
  }
  if (voiceRecTimer) clearInterval(voiceRecTimer);
  voiceRecChunks = [];
  voiceRecBlob = null;
  setRecordingStatus(false);
  hideVoiceSheet('voiceRecordingUI');
  document.getElementById('voiceFabBtn').style.display = 'flex';
}

function showVoicePreview() {
  showVoiceSheet('voicePreviewUI');
  hideVoiceSheet('voiceRecordingUI');
  document.getElementById('voiceFabBtn').style.display = 'none';
  document.getElementById('voicePreviewDur').textContent = formatDuration(voiceRecDuration);
  document.getElementById('voiceUploadProgress').style.display = 'none';
  document.getElementById('voiceUploadBtn').disabled = false;
}

function toggleVoicePreview() {
  const audio = document.getElementById('voicePreviewAudio');
  const btn = document.getElementById('voicePreviewPlay');
  if (!voiceRecBlob) return;
  if (voiceRecPreviewAudio && !voiceRecPreviewAudio.paused) {
    voiceRecPreviewAudio.pause();
    btn.classList.remove('playing');
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>';
    return;
  }
  if (!voiceRecPreviewAudio) {
    voiceRecPreviewAudio = new Audio(URL.createObjectURL(voiceRecBlob));
    voiceRecPreviewAudio.onended = () => {
      btn.classList.remove('playing');
      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>';
      voiceRecPreviewAudio = null;
    };
  }
  voiceRecPreviewAudio.play();
  btn.classList.add('playing');
  btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
}

function deleteVoicePreview() {
  if (voiceRecPreviewAudio) { voiceRecPreviewAudio.pause(); voiceRecPreviewAudio = null; }
  voiceRecBlob = null;
  voiceRecDuration = 0;
  voiceRecChunks = [];
  hideVoiceSheet('voicePreviewUI');
  document.getElementById('voiceFabBtn').style.display = 'flex';
  document.getElementById('voicePreviewPlay').classList.remove('playing');
}

function reRecordVoice() {
  deleteVoicePreview();
  startVoiceRec();
}

function uploadVoiceRecording() {
  if (!voiceRecBlob || !myId) return;
  if (voiceRecPreviewAudio) { voiceRecPreviewAudio.pause(); voiceRecPreviewAudio = null; }
  const progress = document.getElementById('voiceUploadProgress');
  const fill = document.getElementById('voiceProgressFill');
  const label = document.getElementById('voiceProgressLabel');
  const btn = document.getElementById('voiceUploadBtn');
  progress.style.display = 'flex';
  btn.disabled = true;
  fill.style.width = '0%';
  label.textContent = 'Uploading...';

  const formData = new FormData();
  formData.append('audio', voiceRecBlob, 'recording.webm');
  formData.append('userId', myId);
  formData.append('duration', voiceRecDuration);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', VOICE_API + '/api/voices/upload');
  xhr.upload.onprogress = e => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      fill.style.width = pct + '%';
      label.textContent = 'Uploading... ' + pct + '%';
    }
  };
  xhr.onload = () => {
    if (xhr.status === 200) {
      label.textContent = 'Upload complete!';
      fill.style.width = '100%';
      voiceRecBlob = null;
      voiceRecChunks = [];
      voiceRecDuration = 0;
      setTimeout(() => {
        hideVoiceSheet('voicePreviewUI');
        document.getElementById('voiceFabBtn').style.display = 'flex';
        loadVoiceRecordings();
      }, 800);
    } else {
      label.textContent = 'Upload failed. Try again.';
      btn.disabled = false;
    }
  };
  xhr.onerror = () => {
    label.textContent = 'Network error. Try again.';
    btn.disabled = false;
  };
  xhr.send(formData);
}

async function loadVoiceRecordings() {
  const list = document.getElementById('voiceList');
  const empty = document.getElementById('voiceEmpty');
  try {
    const res = await fetch(VOICE_API + '/api/voices/list');
    const recordings = await res.json();
    if (recordings.length === 0) {
      list.innerHTML = '';
      list.appendChild(empty);
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    list.innerHTML = recordings.map(r => {
      const user = (typeof allUsers !== 'undefined' && allUsers.find) ? allUsers.find(u => u.id === r.user_id) : null;
      const name = user ? user.name : 'User';
      const initial = name.charAt(0).toUpperCase();
      const avatar = (user && user.photoURL) ? '<img src="' + user.photoURL + '">' : initial;
      const isOwner = r.user_id === myId;
      const timeAgo = r.created_at ? getTimeAgo(new Date(r.created_at + 'Z')) : '';
      const listened = getListenedVoices().includes(r.id);
      return '<div class="voice-card' + (!listened ? ' is-recent' : '') + '" data-id="' + r.id + '">' +
        '<div class="voice-card-header">' +
          '<div class="voice-card-avatar">' + avatar + '</div>' +
          '<div class="voice-card-info">' +
            '<div class="voice-card-name">' + escapeHtml(name) + (!listened ? '<span class="voice-new-badge">NEW</span>' : '') + '</div>' +
            '<div class="voice-card-time">' + timeAgo + '</div>' +
          '</div>' +
          (isOwner ? '<button class="voice-card-delete" onclick="deleteVoiceRecording(\'' + r.id + '\')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' : '') +
        '</div>' +
        '<div class="voice-card-player">' +
          '<button class="voice-card-play" onclick="playVoiceCard(this, \'' + VOICE_API + r.file_path + '\')">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>' +
          '</button>' +
          '<div class="voice-card-bar" onclick="seekVoiceCard(event, this)" data-dur="' + (r.duration || 0) + '">' +
            '<div class="voice-card-bar-fill"></div>' +
          '</div>' +
          '<span class="voice-card-dur">' + formatDuration(r.duration || 0) + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
  } catch (err) {
    list.innerHTML = '<div class="voice-empty">Failed to load recordings.</div>';
  }
}

function playVoiceCard(btn, url) {
  const card = btn.closest('.voice-card');
  const bar = card.querySelector('.voice-card-bar');
  const fill = card.querySelector('.voice-card-bar-fill');
  const dur = parseFloat(bar.dataset.dur) || 0;
  const recId = card.dataset.id;
  if (voiceCardAudio && voiceCardPlayEl === btn && !voiceCardAudio.paused) {
    voiceCardAudio.pause();
    btn.classList.remove('playing');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>';
    if (voiceCardInterval) clearInterval(voiceCardInterval);
    return;
  }
  if (voiceCardAudio && voiceCardPlayEl === btn && voiceCardAudio.paused) {
    voiceCardAudio.play();
    btn.classList.add('playing');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    startVoiceCardProgress(bar, fill, dur);
    return;
  }
  if (voiceCardAudio) {
    voiceCardAudio.pause();
    if (voiceCardInterval) clearInterval(voiceCardInterval);
    if (voiceCardPlayEl) {
      voiceCardPlayEl.classList.remove('playing');
      voiceCardPlayEl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>';
    }
    const prevFill = voiceCardPlayEl ? voiceCardPlayEl.closest('.voice-card').querySelector('.voice-card-bar-fill') : null;
    if (prevFill) prevFill.style.width = '0%';
  }
  voiceCardAudio = new Audio(url);
  voiceCardPlayEl = btn;
  voiceCardAudio.onended = () => {
    btn.classList.remove('playing');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>';
    fill.style.width = '0%';
    if (voiceCardInterval) clearInterval(voiceCardInterval);
    voiceCardAudio = null;
    voiceCardPlayEl = null;
  };
  voiceCardAudio.play();
  markVoiceListened(recId);
  btn.classList.add('playing');
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  startVoiceCardProgress(bar, fill, dur);
}

function startVoiceCardProgress(bar, fill, dur) {
  if (voiceCardInterval) clearInterval(voiceCardInterval);
  voiceCardInterval = setInterval(() => {
    if (voiceCardAudio && !voiceCardAudio.paused) {
      const pct = dur > 0 ? (voiceCardAudio.currentTime / dur) * 100 : 0;
      fill.style.width = Math.min(pct, 100) + '%';
    }
  }, 150);
}

function seekVoiceCard(event, bar) {
  if (!voiceCardAudio || voiceCardPlayEl.closest('.voice-card').querySelector('.voice-card-bar') !== bar) return;
  const rect = bar.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const pct = Math.max(0, Math.min(1, x / rect.width));
  const dur = parseFloat(bar.dataset.dur) || 0;
  voiceCardAudio.currentTime = pct * dur;
}

async function deleteVoiceRecording(id) {
  if (!confirm('Delete this recording?')) return;
  try {
    await fetch(VOICE_API + '/api/voices/' + id, { method: 'DELETE' });
    loadVoiceRecordings();
  } catch (err) {
    alert('Failed to delete.');
  }
}

function getTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + 'd ago';
  return date.toLocaleDateString();
}

function getListenedVoices() {
  try { return JSON.parse(localStorage.getItem('listenedVoices') || '[]'); } catch(e) { return []; }
}

function markVoiceListened(id) {
  const listened = getListenedVoices();
  if (!listened.includes(id)) {
    listened.push(id);
    localStorage.setItem('listenedVoices', JSON.stringify(listened));
  }
  const card = document.querySelector('.voice-card[data-id="' + id + '"]');
  if (card) {
    card.classList.remove('is-recent');
    const badge = card.querySelector('.voice-new-badge');
    if (badge) badge.remove();
  }
}
