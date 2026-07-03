// ==================== START CALL ====================
async function startCall(userId, type) {
  if (currentCallData) return;
  if (!userId) return;

  try {
    callLocalStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video'
    });
  } catch (err) {
    alert('Cannot access microphone/camera. Please allow permissions.');
    return;
  }

  const callId = 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const name = getUserName(userId);
  const init = getInitial(userId);

  document.getElementById('outgoingAvatar').textContent = init;
  document.getElementById('outgoingName').textContent = name;
  document.getElementById('outgoingStatus').textContent = 'Calling...';
  document.getElementById('outgoingCall').classList.add('show');

  currentCallData = { callId, userId, type, role: 'caller' };
  iceFromCount = 0;
  iceToCount = 0;
  isMuted = false;
  isVideoOn = (type === 'video');

  try {
    await callsDb.doc(callId).set({
      from: myId,
      to: userId,
      type: type,
      status: 'ringing',
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      answered_at: null,
      ended_at: null,
      offer: '',
      answer: '',
      ice_from: [],
      ice_to: []
    });

    setupPeerConn(true);

    const offer = await callPeerConn.createOffer();
    await callPeerConn.setLocalDescription(offer);
    await callsDb.doc(callId).update({ offer: JSON.stringify(offer) });

    listenCallUpdates(callId);

    missedTimeout = setTimeout(() => {
      callsDb.doc(callId).get().then(d => {
        if (d.exists && d.data().status === 'ringing') {
          callsDb.doc(callId).update({ status: 'missed' });
          cleanupCall();
        }
      });
    }, 30000);
  } catch (err) {
    console.error('Start call error:', err);
    cleanupCall();
  }
}

// ==================== LISTEN FOR INCOMING CALLS ====================
function listenForIncomingCalls() {
  if (callIncomingListener) callIncomingListener();
  if (!myId) return;
  callIncomingListener = callsDb
    .where('to', '==', myId)
    .onSnapshot((snap) => {
      snap.docChanges().forEach(ch => {
        if (ch.type === 'added' || ch.type === 'modified') {
          const d = ch.doc.data();
          if (d.from === myId) return;
          if (d.status === 'ringing' && !currentCallData) {
            showIncomingCall(ch.doc.id, d);
          }
        }
      });
    });
}

// ==================== MESSAGE NOTIFICATIONS ====================
function listenNewMsgNotifications() {
  if (unsubNewMsgNotif) unsubNewMsgNotif();
  if (!myId) return;
  newMsgNotifInit = false;
  unsubNewMsgNotif = db.collection('messages')
    .where('to', '==', myId)
    .onSnapshot((snap) => {
      if (!newMsgNotifInit) { newMsgNotifInit = true; return; }
      snap.docChanges().forEach(ch => {
        if (ch.type === 'added') {
          const d = ch.doc.data();
          if (d.from === myId) return;
          if (selectedUserId === d.from) return;
          showNewMsgNotif(d);
        }
      });
    });
}

function showNewMsgNotif(data) {
  const user = allUsers.find(u => u.id === data.from);
  const name = user ? user.name : 'Unknown';
  const initial = (user ? user.name : 'U').charAt(0).toUpperCase();
  const text = data.message || (data.voice ? 'Voice message' : (data.image ? '🖼️ Image' : 'New message'));
  const t = document.getElementById('toast');
  document.getElementById('toastAvatar').textContent = initial;
  document.getElementById('toastTitle').textContent = name;
  document.getElementById('toastMsg').textContent = text;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

// ==================== BROADCAST VOICE ====================
function listenBroadcast() {
  if (unsubBroadcast) unsubBroadcast();
  if (!myId) return;
  unsubBroadcast = db.collection('messages')
    .where('to', '==', '__broadcast__')
    .orderBy('created_at', 'asc')
    .onSnapshot((snap) => {
      snap.docChanges().forEach(ch => {
        if (ch.type === 'added') {
          const d = ch.doc.data();
          const msg = { id: ch.doc.id, ...d, created_at: d.created_at?.toDate?.()?.toISOString() || d.created_at };
          broadcastMessages.push(msg);
          appendBroadcastMessage(msg);
          // Show toast if not in this tab or no chat selected
          if (!selectedUserId) {
            showNewMsgNotif(d);
          }
        }
      });
    });
}

function appendBroadcastMessage(msg) {
  const area = document.getElementById('messagesArea');
  const typingEl = document.getElementById('typingIndicator');
  const user = allUsers.find(u => u.id === msg.from);
  const name = user ? user.name : 'Unknown';
  const time = new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dur = msg.voice_duration ? formatDuration(msg.voice_duration) : '0:00';

  const el = document.createElement('div');
  el.className = 'broadcast-msg';
  el.dataset.bcId = msg.id;
  el.innerHTML = `
    <div class="bc-badge">Broadcast</div>
    <div class="bc-sender">${escapeHtml(name)}</div>
    <div class="message-bubble voice-msg">
      <div class="voice-msg-inner" onclick="playVoiceMsg(this,'${msg.voice}')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        <span class="voice-dur">${dur}</span>
      </div>
    </div>
    <div class="bc-time">${time}</div>
  `;
  area.insertBefore(el, typingEl);
  scrollToBottom();
}

function renderBroadcastMessages() {
  const area = document.getElementById('messagesArea');
  const typingEl = document.getElementById('typingIndicator');
  document.querySelectorAll('.broadcast-msg').forEach(el => el.remove());
  broadcastMessages.forEach(msg => {
    const user = allUsers.find(u => u.id === msg.from);
    const name = user ? user.name : 'Unknown';
    const time = new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const dur = msg.voice_duration ? formatDuration(msg.voice_duration) : '0:00';
    const el = document.createElement('div');
    el.className = 'broadcast-msg';
    el.dataset.bcId = msg.id;
    el.innerHTML = `
      <div class="bc-badge">Broadcast</div>
      <div class="bc-sender">${escapeHtml(name)}</div>
      <div class="message-bubble voice-msg">
        <div class="voice-msg-inner" onclick="playVoiceMsg(this,'${msg.voice}')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          <span class="voice-dur">${dur}</span>
        </div>
      </div>
      <div class="bc-time">${time}</div>
    `;
    area.insertBefore(el, typingEl);
  });
}

// ==================== SHOW INCOMING CALL ====================
function showIncomingCall(callId, data) {
  if (currentCallData) {
    callsDb.doc(callId).update({ status: 'declined' });
    return;
  }

  currentCallData = { callId, userId: data.from, type: data.type, role: 'callee' };
  iceFromCount = 0;
  iceToCount = 0;
  isVideoOn = (data.type === 'video');
  isMuted = false;

  const name = getUserName(data.from);
  const init = getInitial(data.from);
  document.getElementById('incomingAvatar').textContent = init;
  document.getElementById('incomingName').textContent = name;
  document.getElementById('incomingType').textContent = data.type === 'video' ? 'Video Call' : 'Audio Call';

  resetSlide();
  document.getElementById('incomingCall').classList.add('show');
  setTimeout(initSlide, 100);

  playRingtone();

  missedTimeout = setTimeout(() => {
    document.getElementById('incomingCall').classList.remove('show');
    stopRingtone();
    if (currentCallData && currentCallData.callId === callId) {
      callsDb.doc(callId).update({ status: 'missed' });
      currentCallData = null;
    }
  }, 30000);
}

// ==================== ACCEPT CALL ====================
async function acceptCall() {
  if (!currentCallData) return;
  document.getElementById('incomingCall').classList.remove('show');
  stopRingtone();
  clearTimeout(missedTimeout);

  const { callId, userId, type } = currentCallData;

  try {
    callLocalStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video'
    });
  } catch (err) {
    alert('Cannot access microphone/camera');
    callsDb.doc(callId).update({ status: 'declined' });
    currentCallData = null;
    return;
  }

  const name = getUserName(userId);
  showActiveCallUI(name, type);

  try {
    const doc = await callsDb.doc(callId).get();
    if (!doc.exists || !doc.data().offer) { cleanupCall(); return; }
    let offer;
    try { offer = JSON.parse(doc.data().offer); } catch (e) { cleanupCall(); return; }

    setupPeerConn(false);

    await callPeerConn.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await callPeerConn.createAnswer();
    await callPeerConn.setLocalDescription(answer);
    await callsDb.doc(callId).update({
      answer: JSON.stringify(answer),
      status: 'ongoing',
      answered_at: firebase.firestore.FieldValue.serverTimestamp()
    });

    currentCallData.role = 'callee';
    listenCallUpdates(callId);
    startCallTimer();
  } catch (err) {
    console.error('Accept call error:', err);
    cleanupCall();
  }
}

// ==================== DECLINE CALL ====================
function declineCall() {
  if (!currentCallData) return;
  document.getElementById('incomingCall').classList.remove('show');
  stopRingtone();
  clearTimeout(missedTimeout);
  callsDb.doc(currentCallData.callId).update({ status: 'declined' }).catch(() => {});
  currentCallData = null;
}

// ==================== END CALL ====================
async function endCall() {
  if (currentCallData) {
    try {
      await callsDb.doc(currentCallData.callId).update({ status: 'ended', ended_at: firebase.firestore.FieldValue.serverTimestamp() });
    } catch (e) {}
  }
  cleanupCall();
}

function cleanupCall() {
  clearTimeout(missedTimeout);
  if (callTimerInt) { clearInterval(callTimerInt); callTimerInt = null; }
  if (callPeerConn) { callPeerConn.close(); callPeerConn = null; }
  if (callLocalStream) { callLocalStream.getTracks().forEach(t => t.stop()); callLocalStream = null; }
  if (callUpdateListener) { callUpdateListener(); callUpdateListener = null; }
  iceFromCount = 0;
  iceToCount = 0;
  document.getElementById('incomingCall').classList.remove('show');
  document.getElementById('outgoingCall').classList.remove('show');
  document.getElementById('activeCall').classList.remove('show');
  stopRingtone();
  resetSlide();
  currentCallData = null;
}

// ==================== WEBRTC SETUP ====================
function setupPeerConn(isCaller) {
  callPeerConn = new RTCPeerConnection(STUN);

  if (callLocalStream) {
    callLocalStream.getTracks().forEach(t => {
      callPeerConn.addTrack(t, callLocalStream);
    });
  }

  const remoteStream = new MediaStream();

  callPeerConn.ontrack = (event) => {
    event.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
    const rv = document.getElementById('remoteVideo');
    const nv = document.getElementById('noVideo');
    if (remoteStream.getVideoTracks().length > 0) {
      rv.srcObject = remoteStream;
      rv.style.display = 'block';
      nv.style.display = 'none';
      rv.play().catch(() => {});
    }
    const ra = document.getElementById('remoteAudio');
    if (remoteStream.getAudioTracks().length > 0) {
      ra.srcObject = remoteStream;
      ra.play().catch(() => {});
    }
  };

  callPeerConn.onicecandidate = (event) => {
    if (event.candidate && currentCallData) {
      const f = isCaller ? 'ice_from' : 'ice_to';
      callsDb.doc(currentCallData.callId).update({
        [f]: firebase.firestore.FieldValue.arrayUnion(JSON.stringify(event.candidate))
      }).catch(() => {});
    }
  };

  callPeerConn.onconnectionstatechange = () => {
    if (['disconnected', 'failed', 'closed'].includes(callPeerConn.connectionState)) {
      cleanupCall();
    }
  };

  const lv = document.getElementById('localVideo');
  if (lv && callLocalStream) {
    lv.srcObject = callLocalStream;
    lv.style.display = callLocalStream.getVideoTracks().length > 0 ? 'block' : 'none';
    lv.play().catch(() => {});
  }

  document.getElementById('muteBtn').className = 'ctrl-btn';
  document.getElementById('videoBtn').className = 'ctrl-btn';
}

// ==================== LISTEN CALL UPDATES ====================
function listenCallUpdates(callId) {
  if (callUpdateListener) callUpdateListener();

  callUpdateListener = callsDb.doc(callId).onSnapshot(async (snap) => {
    if (!snap.exists) { cleanupCall(); return; }
    const d = snap.data();

    if (!currentCallData) { cleanupCall(); return; }

    if (d.status === 'ended' || d.status === 'declined' || d.status === 'missed') {
      cleanupCall();
      return;
    }

    if (currentCallData.role === 'caller' && d.answer && callPeerConn && !callPeerConn.currentRemoteDescription) {
      try {
        const a = JSON.parse(d.answer);
        await callPeerConn.setRemoteDescription(new RTCSessionDescription(a));
        const name = getUserName(currentCallData.userId);
        showActiveCallUI(name, currentCallData.type);
        startCallTimer();
      } catch (e) {}
    }

    if (currentCallData.role === 'caller' && d.ice_to && callPeerConn) {
      while (iceToCount < d.ice_to.length) {
        try { callPeerConn.addIceCandidate(JSON.parse(d.ice_to[iceToCount])); } catch (e) {}
        iceToCount++;
      }
    }
    if (currentCallData.role === 'callee' && d.ice_from && callPeerConn) {
      while (iceFromCount < d.ice_from.length) {
        try { callPeerConn.addIceCandidate(JSON.parse(d.ice_from[iceFromCount])); } catch (e) {}
        iceFromCount++;
      }
    }
  });
}

// ==================== CALL UI ====================
function showActiveCallUI(name, type) {
  document.getElementById('outgoingCall').classList.remove('show');
  document.getElementById('activeCall').classList.add('show');
  const init = name.charAt(0).toUpperCase();
  document.getElementById('activeBigAvatar').textContent = init;
  document.getElementById('activeNameText').textContent = name;
  document.getElementById('activeName').textContent = name;
  const vBtn = document.getElementById('videoBtn');
  if (type === 'audio') {
    vBtn.style.opacity = '0.3';
    vBtn.style.pointerEvents = 'none';
  } else {
    vBtn.style.opacity = '1';
    vBtn.style.pointerEvents = 'auto';
  }
}

function startCallTimer() {
  const start = Date.now();
  callTimerInt = setInterval(() => {
    const e = Math.floor((Date.now() - start) / 1000);
    const m = String(Math.floor(e / 60)).padStart(2, '0');
    const s = String(e % 60).padStart(2, '0');
    document.getElementById('callTimer').textContent = m + ':' + s;
  }, 1000);
}

// ==================== CALL CONTROLS ====================
function toggleMute() {
  isMuted = !isMuted;
  if (callLocalStream) {
    callLocalStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
  }
  document.getElementById('muteBtn').classList.toggle('off', isMuted);
}

function toggleVideo() {
  if (!callLocalStream || !currentCallData || currentCallData.type === 'audio') return;
  isVideoOn = !isVideoOn;
  callLocalStream.getVideoTracks().forEach(t => t.enabled = isVideoOn);
  document.getElementById('videoBtn').classList.toggle('off', !isVideoOn);
  document.getElementById('localVideo').style.display = isVideoOn ? 'block' : 'none';
}

function toggleSpeaker() {
  const ra = document.getElementById('remoteAudio');
  if (!ra) return;
  ra.muted = !ra.muted;
  document.getElementById('speakerBtn').classList.toggle('off', ra.muted);
}

// ==================== RINGTONE ====================
function playRingtone() {
  try {
    ringCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ringCtx.createOscillator();
    const gain = ringCtx.createGain();
    osc.connect(gain);
    gain.connect(ringCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = 440;
    gain.gain.value = 0.3;
    osc.start();
    let v = 0.3;
    ringInterval = setInterval(() => {
      v = v === 0.3 ? 0.1 : 0.3;
      gain.gain.value = v;
    }, 500);
    ringCtx._osc = osc;
    ringCtx._gain = gain;
  } catch (e) {}
}

// ==================== TELEGRAM ALERT ====================
function sendTelegramAlert(userName, message, timestamp, toUser) {
  if (!telegramBotToken || !telegramChatId) return;
  const text = encodeURIComponent(
    '👤 User: ' + userName + '\n💬 To: ' + toUser + '\n📝 Message: ' + (message || '[Image]') + '\n⏰ Time: ' + timestamp
  );
  fetch('https://api.telegram.org/bot' + telegramBotToken + '/sendMessage?chat_id=' + telegramChatId + '&text=' + text)
    .catch(function(err) { console.error('Telegram error:', err); });
}

function stopRingtone() {
  if (ringInterval) { clearInterval(ringInterval); ringInterval = null; }
  if (ringCtx) {
    try { ringCtx._osc.stop(); } catch (e) {}
    ringCtx.close().catch(() => {});
    ringCtx = null;
  }
}

// ==================== SLIDE TO ANSWER ====================
function initSlide() {
  const track = document.getElementById('slideTrack');
  const thumb = document.getElementById('slideThumb');
  const fill = document.getElementById('slideFill');
  const text = document.getElementById('slideText');
  if (!track || !thumb) return;

  slideState = { dragging: false };

  function getMax() { return track.offsetWidth - thumb.offsetWidth; }

  function onStart(cx) {
    if (!slideState) initSlide();
    slideState.dragging = true;
    slideState.sx = cx;
    slideState.sl = thumb.offsetLeft;
    slideState.mw = getMax();
    thumb.style.transition = 'none';
    fill.style.transition = 'none';
  }

  function onMove(cx) {
    if (!slideState?.dragging) return;
    const d = cx - slideState.sx;
    const p = Math.max(0, Math.min(d / slideState.mw, 1));
    thumb.style.left = (2 + p * slideState.mw) + 'px';
    fill.style.width = (p * 100) + '%';
    text.style.opacity = p > 0.1 ? '0' : '1';
    if (p >= 0.85) {
      slideState.dragging = false;
      resetSlide();
      acceptCall();
    }
  }

  function onEnd() {
    if (slideState?.dragging) { slideState.dragging = false; resetSlide(); initSlide(); }
  }

  thumb.onpointerdown = (e) => { e.preventDefault(); onStart(e.clientX); };
  thumb.ontouchstart = (e) => { e.preventDefault(); onStart(e.touches[0].clientX); };
  document.onpointermove = (e) => { if (slideState?.dragging) onMove(e.clientX); };
  document.ontouchmove = (e) => { if (slideState?.dragging) { e.preventDefault(); onMove(e.touches[0].clientX); } };
  document.onpointerup = onEnd;
  document.ontouchend = onEnd;
}

function resetSlide() {
  const thumb = document.getElementById('slideThumb');
  const fill = document.getElementById('slideFill');
  const text = document.getElementById('slideText');
  if (!thumb) return;
  thumb.style.transition = 'left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
  fill.style.transition = 'width 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
  thumb.style.left = '2px';
  fill.style.width = '0%';
  text.style.opacity = '1';
  slideState = null;
  document.onpointermove = null;
  document.ontouchmove = null;
  document.onpointerup = null;
  document.ontouchend = null;
}
