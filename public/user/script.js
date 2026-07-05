// Firebase SDK Script Tags (load externally before this file):
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js"></script>

document.addEventListener('contextmenu', function(e) {
  if (e.target.closest('.img-msg, .voice-msg, .voice-card, .vp-msg, #imgViewerOverlay, #voicePreviewUI')) {
    e.preventDefault();
    return false;
  }
});
document.addEventListener('dragstart', function(e) {
  if (e.target.closest('img, audio')) {
    e.preventDefault();
    return false;
  }
});

firebase.initializeApp({
  apiKey: "AIzaSyB2j604pnQWRzpu_yE0biwWktths5TxW38",
  authDomain: "own-chat-app-d5fd0.firebaseapp.com",
  projectId: "own-chat-app-d5fd0",
  storageBucket: "own-chat-app-d5fd0.firebasestorage.app",
  messagingSenderId: "191123388943",
  appId: "1:191123388943:web:2a352c0912c015e5e1017a"
});

const db = firebase.firestore();
const storage = firebase.storage();

const LOGO_URLS = [
  'https://i.ibb.co/PGtpdnv1/image.webp',
  'https://i.ibb.co/yvQtTPV/image.webp',
  'https://i.ibb.co/JWY0cwDM/image.webp',
  'https://i.ibb.co/MknvqPkq/image.webp',
  'https://i.ibb.co/cXwr7r4q/image.webp',
  'https://i.ibb.co/bg45Q6LH/image.webp',
  'https://i.ibb.co/YFstpKhC/image.webp',
  'https://i.ibb.co/zh2X13NY/image.webp',
  'https://i.ibb.co/67TkWJhv/image.webp',
  'https://i.ibb.co/NdV2Mbtm/image.webp',
  'https://i.ibb.co/vCwfWVTh/image.webp'
];

const STUN = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
  ]
};

const callsDb = db.collection('calls');


let myId = localStorage.getItem('chatUserId');
let myName = localStorage.getItem('chatUserName') || '';
let myPhotoURL = localStorage.getItem('chatUserPhoto') || '';
let selectedUserId = null;

let typingTimeout = null;
let lastTypingEmit = 0;
let unsubUsers = null;
let unsubMessages = null;
let unsubTyping = null;
let unsubRecording = null;
let unsubNewMsgNotif = null;
let newMsgNotifInit = false;
let loadedMsgIds = new Set();
let actionMsgId = null;
let editingMsgId = null;
let replyToMsg = null;
let allUsers = [];
let lastMsgDates = {};
let authMode = 'signup';

// Call feature state
let callLocalStream = null;
let callPeerConn = null;
let currentCallData = null;
let callTimerInt = null;
let iceFromCount = 0;
let iceToCount = 0;
let isMuted = false;
let isVideoOn = true;
let missedTimeout = null;
let callIncomingListener = null;
let callUpdateListener = null;
let ringCtx = null;
let ringInterval = null;
let slideState = null;
let telegramBotToken = '8829889871:AAElJEyBCXxXukO-OIYYB3dY44C6112M8vk';
let telegramChatId = '-1004299305991';
let broadcastMessages = [];
let unsubBroadcast = null;


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

function scrollToBottomSmooth() {
  const c = document.getElementById('messagesArea');
  if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' });
}

// ==================== FONT SIZE ====================
function initFontSize() {
  const saved = localStorage.getItem('chatFontSize') || '16';
  document.documentElement.style.setProperty('--msg-font-size', saved + 'px');
  const slider = document.getElementById('fontSizeSlider');
  if (slider) slider.value = saved;
  updateFontSizePreview(saved);
}

function changeFontSize(size) {
  document.documentElement.style.setProperty('--msg-font-size', size + 'px');
  localStorage.setItem('chatFontSize', size);
  updateFontSizePreview(size);
}

function updateFontSizePreview(size) {
  const preview = document.getElementById('fontSizePreview');
  if (preview) preview.style.fontSize = size + 'px';
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


// ==================== PROFILE ====================
function loadProfile() {
  const initial = myName.charAt(0).toUpperCase();
  document.getElementById('profileNameDisplay').textContent = myName;
  document.getElementById('profileNameInput').value = myName;
  document.getElementById('profileUserId').textContent = myId;
  document.getElementById('profileId').textContent = 'ID: ' + myId.slice(0, 12) + '...';

  if (myPhotoURL) {
    document.getElementById('paInitial').style.display = 'none';
    document.getElementById('paImg').style.display = 'block';
    document.getElementById('paImg').innerHTML = '<img src="' + myPhotoURL + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
  } else {
    document.getElementById('paInitial').style.display = 'block';
    document.getElementById('paInitial').textContent = initial;
    document.getElementById('paImg').style.display = 'none';
  }

  db.collection('users').doc(myId).get().then((doc) => {
    if (doc.exists) {
      const data = doc.data();
      if (data.created_at) {
        const joined = data.created_at.toDate ? data.created_at.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown';
        document.getElementById('profileJoined').textContent = joined;
      }
      if (data.password) {
        document.getElementById('oldPassInput').value = data.password;
      }
    }
  });
}

function copyCurrentPass() {
  const pass = document.getElementById('oldPassInput').value;
  if (!pass) return;
  navigator.clipboard.writeText(pass).then(function() {
    const status = document.getElementById('passChangeStatus');
    status.textContent = 'Password copied to clipboard';
    status.style.color = 'var(--ios-green)';
    setTimeout(function() { status.textContent = ''; }, 2000);
  }).catch(function() {
    const status = document.getElementById('passChangeStatus');
    status.textContent = 'Failed to copy';
    status.style.color = 'var(--ios-red)';
  });
}

// ==================== LOGO / AVATAR ====================
let selectedLogoUrl = '';
let adjDragState = null;


function setMode(mode) {
  authMode = mode;
  document.getElementById('toggleSignup').classList.toggle('active', mode === 'signup');
  document.getElementById('toggleLogin').classList.toggle('active', mode === 'login');
  document.getElementById('authBtn').textContent = mode === 'signup' ? 'Sign Up' : 'Login';
  document.getElementById('nameSubText').textContent = mode === 'signup' ? 'Create an account to start chatting' : 'Login to your account';
  document.getElementById('nameError').style.display = 'none';
}

let visibilityHandler = null;
let heartbeatInterval = null;

// Auto-login if name exists (deferred so all scripts are loaded first)
if (myName) {
  setTimeout(function() {
    window.addEventListener('beforeunload', handleBeforeUnload);
    showMainApp();
  }, 0);
}

// ==================== JOIN / LOGIN / SIGNUP ====================
function showError(msg) {
  const el = document.getElementById('nameError');
  el.textContent = msg;
  el.style.display = 'block';
}

async function joinChat() {
  const name = document.getElementById('nameInput').value.trim();
  const pass = document.getElementById('passInput').value.trim();

  if (!name) { document.getElementById('nameInput').focus(); return; }
  if (!pass) { document.getElementById('passInput').focus(); return; }

  const btn = document.getElementById('authBtn');
  btn.textContent = 'Please wait...';
  btn.disabled = true;
  document.getElementById('nameError').style.display = 'none';

  try {
    if (authMode === 'signup') {
      // Check if username already exists
      const existing = await db.collection('users').where('username', '==', name).get();
      if (!existing.empty) {
        showError('Username already taken');
        btn.textContent = 'Sign Up';
        btn.disabled = false;
        return;
      }

      myId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
      myName = name;
      myPhotoURL = '';

      await db.collection('users').doc(myId).set({
        name: myName,
        username: name,
        password: pass,
    is_online: true,
    last_active: firebase.firestore.FieldValue.serverTimestamp(),
    created_at: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // Login - find user by username
      const existing = await db.collection('users').where('username', '==', name).get();
      if (existing.empty) {
        showError('Username not found');
        btn.textContent = 'Login';
        btn.disabled = false;
        return;
      }

      const doc = existing.docs[0];
      const data = doc.data();

      if (data.password !== pass) {
        showError('Wrong password');
        btn.textContent = 'Login';
        btn.disabled = false;
        return;
      }

      myId = doc.id;
      myName = data.name || name;
      myPhotoURL = data.photoURL || '';

      await db.collection('users').doc(myId).update({ is_online: true, last_active: firebase.firestore.FieldValue.serverTimestamp() });
    }

    localStorage.setItem('chatUserId', myId);
    localStorage.setItem('chatUserName', myName);
    if (myPhotoURL) localStorage.setItem('chatUserPhoto', myPhotoURL);

    // Remove old beforeunload if any, then add new one
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('pagehide', handlePageHide);
    window.addEventListener('pagehide', handlePageHide);

    showMainApp();
  } catch (err) {
    showError('Error: ' + err.message);
    console.error(err);
    btn.textContent = authMode === 'signup' ? 'Sign Up' : 'Login';
    btn.disabled = false;
  }
}

function handleBeforeUnload() {
  db.collection('users').doc(myId).update({
    is_online: false,
    last_seen: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(() => {});
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (unsubUsers) unsubUsers();
  if (unsubMessages) unsubMessages();
  if (unsubTyping) unsubTyping();
  if (unsubRecording) unsubRecording();
}

function handlePageHide() {
  if (myId) {
    db.collection('users').doc(myId).update({
      is_online: false,
      last_seen: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});
  }
}

document.getElementById('nameInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('passInput').focus();
});
document.getElementById('passInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinChat();
});


// ==================== SHOW MAIN APP ====================

function showMainApp() {
  document.getElementById('nameScreen').classList.add('hide');
  document.getElementById('mainApp').classList.add('show');

  const initial = myName.charAt(0).toUpperCase();
  if (myPhotoURL) {
    setAvatarImg('myAvatar', myPhotoURL);
  } else {
    document.getElementById('myAvatar').innerHTML = '<span class="my-av-initial">' + initial + '</span>';
  }

  db.collection('users').doc(myId).set({ is_online: true, last_active: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });

  // Heartbeat - update last_active every 15 sec
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    db.collection('users').doc(myId).update({ is_online: true, last_active: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
  }, 15000);

  // Tab visibility → online/offline
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
  visibilityHandler = function() {
    if (document.hidden) {
      db.collection('users').doc(myId).update({
        is_online: false,
        last_seen: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    } else {
      db.collection('users').doc(myId).set({ is_online: true, last_active: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      if (!heartbeatInterval) {
        heartbeatInterval = setInterval(() => {
          db.collection('users').doc(myId).update({ is_online: true, last_active: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
        }, 15000);
      }
      listenUsers();
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  listenUsers();
  loadProfile();
  initFontSize();
  listenForIncomingCalls();
  listenNewMsgNotifications();
  listenBroadcast();
}

function setAvatarImg(elId, url) {
  const el = document.getElementById(elId);
  el.innerHTML = '<img src="' + url + '" alt="" loading="lazy" onerror="this.parentElement.innerHTML=this.parentElement.getAttribute(\'data-fallback\')||\'U\'">';
}


// ==================== USERS ====================
function listenUsers() {
  if (unsubUsers) unsubUsers();

  unsubUsers = db.collection('users').orderBy('name', 'asc').onSnapshot((snapshot) => {
    allUsers = [];
    snapshot.forEach(doc => {
      if (doc.id === myId) return;
      const data = doc.data();
      const isOnline = data.last_active?.toDate?.() ? (Date.now() - data.last_active.toDate().getTime() < 60000) : false;
      allUsers.push({ id: doc.id, name: data.name || 'User', photoURL: data.photoURL || '', is_online: isOnline, last_seen: data.last_seen?.toDate?.()?.toISOString() || data.last_seen || null, created_at: data.created_at?.toDate?.()?.toISOString() || '' });
    });
    renderUsers();
  }, (error) => {
    console.error('listenUsers snapshot error:', error);
    unsubUsers = null;
    setTimeout(() => { if (myId) listenUsers(); }, 3000);
  });
}

function renderUsers() {
  const list = document.getElementById('userList');
  const onlineCount = allUsers.filter(u => u.is_online).length;
  document.getElementById('onlineCount').textContent = onlineCount;

  if (allUsers.length === 0) {
    list.innerHTML = '<div class="no-users-msg"><div class="icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ios-gray3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><div>No other users yet</div></div>';
    return;
  }

  list.innerHTML = allUsers.map(user => {
    const isActive = selectedUserId === user.id;
    const dotClass = user.is_online ? 'u-online-dot' : 'u-offline-dot';
    const initial = (user.name || 'U').charAt(0).toUpperCase();
    const avatarHtml = user.photoURL ? '<img src="' + user.photoURL + '" alt="" loading="lazy" onerror="this.outerHTML=\'<span class=\\\'u-av-initial\\\'>' + initial + '</span>\'">' : '<span class="u-av-initial">' + initial + '</span>';
    let statusText = user.is_online ? 'Online' : (user.last_seen ? 'Last seen ' + formatLastSeen(user.last_seen) : 'Offline');

    return `
      <div class="user-item ${isActive ? 'active' : ''}" onclick="selectUser('${user.id}')">
        <div class="u-avatar">
          ${avatarHtml}
          <div class="${dotClass}"></div>
        </div>
        <div class="u-info">
          <div class="u-name">${escapeHtml(user.name)}</div>
          <div class="u-status">${statusText}</div>
        </div>
      </div>
    `;
  }).join('');
}

function formatLastSeen(isoStr) {
  if (!isoStr) return 'Offline';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  return days + 'd ago';
}


// ==================== CHAT HEADS ROW ====================

// ==================== SELECT USER ====================
function selectUser(userId) {
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  if (unsubTyping) { unsubTyping(); unsubTyping = null; }
  if (unsubRecording) { unsubRecording(); unsubRecording = null; }
  loadedMsgIds.clear();

  selectedUserId = userId;
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('chatView').classList.add('show');

  // Mobile: hide user list, show chat
  if (window.innerWidth <= 768) {
    document.getElementById('userListArea').classList.add('hide');
    document.getElementById('chatArea').classList.add('show');
  }

  const initial = user.name.charAt(0).toUpperCase();
  const chatAv = document.getElementById('chatAvatar');
  if (user.photoURL) {
    chatAv.innerHTML = '<img src="' + user.photoURL + '" alt="" loading="lazy" onerror="this.outerHTML=\'<span class=\\\'ch-av-initial\\\'>' + initial + '</span>\'">';
  } else {
    chatAv.innerHTML = '<span class="ch-av-initial">' + initial + '</span>';
  }
  document.getElementById('chatName').textContent = user.name;

  const statusEl = document.getElementById('chatStatus');
  if (user.is_online) {
    statusEl.textContent = 'Online';
    statusEl.className = 'ch-status online';
  } else {
    statusEl.textContent = 'Offline';
    statusEl.className = 'ch-status';
  }

  renderUsers();

  listenMessages();
  listenTyping();
  listenRecording();
  renderBroadcastMessages();
}

function goBack() {
  selectedUserId = null;
  document.getElementById('emptyState').style.display = 'flex';
  document.getElementById('chatView').classList.remove('show');

  // Mobile: show user list, hide chat
  if (window.innerWidth <= 768) {
    document.getElementById('userListArea').classList.remove('hide');
    document.getElementById('chatArea').classList.remove('show');
  }

  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  if (unsubTyping) { unsubTyping(); unsubTyping = null; }
  if (unsubRecording) { unsubRecording(); unsubRecording = null; }
  cancelReply();
  messagePageLimit = 50;
  const sbtn = document.getElementById('scrollToBottomBtn');
  if (sbtn) sbtn.classList.remove('show');
}

// ==================== MESSAGES ====================
let hasMoreMessages = true;
let isLoadingMore = false;
let messagePageLimit = 50;

function listenMessages() {
  if (!selectedUserId) return;
  const convId = [myId, selectedUserId].sort().join('_');

  const area = document.getElementById('messagesArea');
  const typingEl = document.getElementById('typingIndicator');
  const recEl = document.getElementById('recordingIndicator');
  area.innerHTML = '';
  area.appendChild(typingEl);
  area.appendChild(recEl);

  loadedMsgIds.clear();
  hasMoreMessages = true;

  const loadMoreDiv = document.createElement('div');
  loadMoreDiv.className = 'load-more-msgs';
  loadMoreDiv.id = 'loadMoreDiv';
  loadMoreDiv.innerHTML = '<button onclick="loadMoreMessages()">Load earlier messages</button>';
  area.insertBefore(loadMoreDiv, typingEl);

  let isInitial = true;
  let msgCount = 0;

  unsubMessages = db.collection('messages')
    .where('conversation', '==', convId)
    .orderBy('created_at', 'asc')
    .limitToLast(messagePageLimit)
    .onSnapshot((snapshot) => {
      if (isInitial) {
        const msgs = [];
        snapshot.forEach((doc) => {
          if (!loadedMsgIds.has(doc.id)) {
            loadedMsgIds.add(doc.id);
            msgCount++;
            const data = doc.data();
            const ts = data.created_at;
            let timeVal;
            if (ts && typeof ts.toDate === 'function') {
              timeVal = ts.toDate().getTime();
            } else if (ts) {
              timeVal = new Date(ts).getTime();
            } else {
              timeVal = 0;
            }
            msgs.push({ id: doc.id, ...data, created_at: ts?.toDate?.()?.toISOString() || ts, _ts: timeVal });
          }
        });

        msgs.sort((a, b) => a._ts - b._ts);

        const frag = document.createDocumentFragment();
        let lastDate = '';
        msgs.forEach((msg, idx) => {
          const msgDate = new Date(msg._ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
          if (msgDate !== lastDate) {
            const sep = document.createElement('div');
            sep.className = 'date-separator';
            sep.innerHTML = '<span>' + msgDate + '</span>';
            frag.appendChild(sep);
            lastDate = msgDate;
          }
          const prevMsg = idx > 0 ? msgs[idx - 1] : null;
          const nextMsg = idx < msgs.length - 1 ? msgs[idx + 1] : null;
          const el = createMessageElement(msg, prevMsg, nextMsg);
          if (el) frag.appendChild(el);
        });
        area.insertBefore(frag, typingEl);

        if (msgCount >= messagePageLimit) {
          hasMoreMessages = true;
          loadMoreDiv.classList.add('show');
        } else {
          hasMoreMessages = false;
          loadMoreDiv.classList.remove('show');
        }
        isInitial = false;
        scrollToBottom();
      } else {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' && !loadedMsgIds.has(change.doc.id)) {
            loadedMsgIds.add(change.doc.id);
            const data = change.doc.data();
            const msg = { id: change.doc.id, ...data, created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at };
            appendMessageToArea(msg, typingEl, true);
            const a = document.getElementById('messagesArea');
            if (a && a.scrollHeight - a.scrollTop - a.clientHeight < 200) {
              scrollToBottom();
            }
          } else if (change.type === 'modified') {
            const data = change.doc.data();
            const msg = { id: change.doc.id, ...data, created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at };
            updateMessageInDOM(msg);
          }
        });
      }
    });

  setupScrollTracking();
}

function setupScrollTracking() {
  const area = document.getElementById('messagesArea');
  const btn = document.getElementById('scrollToBottomBtn');
  if (!area || !btn) return;

  area.onscroll = function() {
    const nearBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 200;
    if (nearBottom) {
      btn.classList.remove('show');
    } else {
      btn.classList.add('show');
    }
  };
}

async function loadMoreMessages() {
  if (isLoadingMore || !hasMoreMessages || !selectedUserId) return;
  isLoadingMore = true;

  const convId = [myId, selectedUserId].sort().join('_');
  const area = document.getElementById('messagesArea');
  const loadMoreDiv = document.getElementById('loadMoreDiv');
  const oldScrollHeight = area.scrollHeight;

  if (unsubMessages) { unsubMessages(); unsubMessages = null; }

  messagePageLimit += 50;

  let isInitialLoad = true;

  unsubMessages = db.collection('messages')
    .where('conversation', '==', convId)
    .orderBy('created_at', 'asc')
    .limitToLast(messagePageLimit)
    .onSnapshot((snapshot) => {
      if (isInitialLoad) {
        // Collect new messages only
        const newMsgs = [];
        snapshot.forEach((doc) => {
          if (!loadedMsgIds.has(doc.id)) {
            loadedMsgIds.add(doc.id);
            const data = doc.data();
            const ts = data.created_at;
            let timeVal;
            if (ts && typeof ts.toDate === 'function') {
              timeVal = ts.toDate().getTime();
            } else if (ts) {
              timeVal = new Date(ts).getTime();
            } else {
              timeVal = 0;
            }
            newMsgs.push({ id: doc.id, ...data, created_at: ts?.toDate?.()?.toISOString() || ts, _ts: timeVal });
          }
        });

        newMsgs.sort((a, b) => a._ts - b._ts);

        // Batch insert with DocumentFragment
        const frag = document.createDocumentFragment();
        let lastDate = '';
        newMsgs.forEach((msg, idx) => {
          const msgDate = new Date(msg._ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
          if (msgDate !== lastDate) {
            const sep = document.createElement('div');
            sep.className = 'date-separator';
            sep.innerHTML = '<span>' + msgDate + '</span>';
            frag.appendChild(sep);
            lastDate = msgDate;
          }
          const prevMsg = idx > 0 ? newMsgs[idx - 1] : null;
          const nextMsg = idx < newMsgs.length - 1 ? newMsgs[idx + 1] : null;
          const el = createMessageElement(msg, prevMsg, nextMsg);
          if (el) frag.appendChild(el);
        });
        area.insertBefore(frag, loadMoreDiv);

        // Maintain scroll position
        const newScrollHeight = area.scrollHeight;
        area.scrollTop = newScrollHeight - oldScrollHeight;

        const totalMsgs = area.querySelectorAll('.message-wrapper').length;
        if (totalMsgs < messagePageLimit) {
          hasMoreMessages = false;
          loadMoreDiv.classList.remove('show');
        }

        isInitialLoad = false;
        setupScrollTracking();
      } else {
        // Real-time updates
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' && !loadedMsgIds.has(change.doc.id)) {
            loadedMsgIds.add(change.doc.id);
            const data = change.doc.data();
            const msg = { id: change.doc.id, ...data, created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at };
            appendMessageToArea(msg, loadMoreDiv, true);
            const a = document.getElementById('messagesArea');
            if (a && a.scrollHeight - a.scrollTop - a.clientHeight < 200) {
              scrollToBottom();
            }
          } else if (change.type === 'modified') {
            const data = change.doc.data();
            const msg = { id: change.doc.id, ...data, created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at };
            updateMessageInDOM(msg);
          }
        });
      }
    });

  isLoadingMore = false;
}

function createMessageElement(msg, prevMsg, nextMsg) {
  const isOwn = msg.from === myId;
  const time = new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (msg.deleted && msg.from !== myId) return null;

  const wrapper = document.createElement('div');
  wrapper.dataset.msgId = msg.id;

  // Grouping detection
  const prevIsSame = prevMsg && prevMsg.from === msg.from;
  const nextIsSame = nextMsg && nextMsg.from === msg.from;
  let groupClass = 'msg-single';
  if (prevIsSame && nextIsSame) groupClass = 'msg-mid';
  else if (prevIsSame && !nextIsSame) groupClass = 'msg-last';
  else if (!prevIsSame && nextIsSame) groupClass = 'msg-first';

  wrapper.className = 'message-wrapper ' + (isOwn ? 'own' : 'other') + ' ' + groupClass;
  wrapper.style.animation = 'none';

  let content = '';

  // Avatar for other person's first message in group
  if (!isOwn && !prevIsSame) {
    const sender = allUsers.find(u => u.id === msg.from);
    const initial = (sender?.name || 'U').charAt(0).toUpperCase();
    if (sender?.photoURL) {
      content += '<div class="msg-avatar"><img src="' + sender.photoURL + '" alt="" loading="lazy" onerror="this.outerHTML=\'' + initial + '\'"></div>';
    } else {
      content += '<div class="msg-avatar">' + initial + '</div>';
    }
  } else if (!isOwn) {
    content += '<div class="msg-avatar-spacer"></div>';
  }

  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = 'msg-bubble-wrap';

  if (msg.reply_to) {
    const rpName = msg.reply_to.from === myId ? 'You' : (allUsers.find(u => u.id === msg.reply_to.from)?.name || 'Unknown');
    bubbleWrap.innerHTML += '<div class="reply-preview"><div class="rp-name">' + escapeHtml(rpName) + '</div><div class="rp-text">' + escapeHtml(msg.reply_to.message || 'Image') + '</div></div>';
  }

  if (msg.deleted) {
    bubbleWrap.innerHTML += '<div class="message-bubble msg-deleted">You deleted this message</div>';
  } else {
    if (msg.voice) {
      const dur = msg.voice_duration ? formatDuration(msg.voice_duration) : '0:00';
      bubbleWrap.innerHTML += '<div class="message-bubble voice-msg"><div class="voice-msg-inner" onclick="playVoiceMsg(this,\'' + msg.voice + '\')"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span class="voice-dur">' + dur + '</span></div></div>';
    }
    if (msg.image) {
      bubbleWrap.innerHTML += '<div class="message-bubble img-msg"><img src="' + msg.image.url + '" alt="" loading="lazy" draggable="false" oncontextmenu="return false;" onclick="openImgViewer(\'' + msg.image.url + '\')"></div>';
    }
    if (msg.message) {
      bubbleWrap.innerHTML += '<div class="message-bubble">' + escapeHtml(msg.message) + '</div>';
    }
    if (msg.edited) {
      bubbleWrap.innerHTML += '<div class="msg-edited">edited</div>';
    }
  }

  if (msg.reactions) {
    const emojis = Object.values(msg.reactions);
    const uniqueEmojis = [...new Set(emojis)];
    if (uniqueEmojis.length > 0) {
      bubbleWrap.innerHTML += '<div class="msg-reactions">';
      uniqueEmojis.forEach(emoji => {
        const count = emojis.filter(e => e === emoji).length;
        bubbleWrap.innerHTML += '<span class="msg-reaction">' + emoji + (count > 1 ? '<small>' + count + '</small>' : '') + '</span>';
      });
      bubbleWrap.innerHTML += '</div>';
    }
  }

  // Time only on last message in group
  const showTime = !nextIsSame;
  if (showTime) {
    bubbleWrap.innerHTML += '<div class="message-time">' + time + '</div>';
  }

  wrapper.appendChild(bubbleWrap);
  if (!msg.deleted) {
    wrapper.onclick = function() { showActionPopup(msg.id, this, isOwn); };
  }

  return wrapper;
}

function appendMessageToArea(msg, insertBefore, animate) {
  const area = document.getElementById('messagesArea');
  const isOwn = msg.from === myId;
  const time = new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (msg.deleted && msg.from !== myId) return;

  // Find previous message for grouping
  const allWrappers = area.querySelectorAll('.message-wrapper');
  const lastWrapper = allWrappers.length > 0 ? allWrappers[allWrappers.length - 1] : null;
  const prevMsg = lastWrapper ? { from: lastWrapper.classList.contains('own') ? myId : selectedUserId } : null;

  const wrapper = document.createElement('div');
  wrapper.dataset.msgId = msg.id;

  // Grouping detection
  const prevIsSame = prevMsg && prevMsg.from === msg.from;
  const groupClass = prevIsSame ? 'msg-mid' : 'msg-first';

  wrapper.className = 'message-wrapper ' + (isOwn ? 'own' : 'other') + ' ' + groupClass;
  if (!animate) wrapper.style.animation = 'none';

  let content = '';

  // Avatar for other person's first message in group
  if (!isOwn && !prevIsSame) {
    const sender = allUsers.find(u => u.id === msg.from);
    const initial = (sender?.name || 'U').charAt(0).toUpperCase();
    if (sender?.photoURL) {
      content += '<div class="msg-avatar"><img src="' + sender.photoURL + '" alt="" loading="lazy" onerror="this.outerHTML=\'' + initial + '\'"></div>';
    } else {
      content += '<div class="msg-avatar">' + initial + '</div>';
    }
  } else if (!isOwn) {
    content += '<div class="msg-avatar-spacer"></div>';
  }

  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = 'msg-bubble-wrap';

  if (msg.reply_to) {
    const rpName = msg.reply_to.from === myId ? 'You' : (allUsers.find(u => u.id === msg.reply_to.from)?.name || 'Unknown');
    bubbleWrap.innerHTML += '<div class="reply-preview"><div class="rp-name">' + escapeHtml(rpName) + '</div><div class="rp-text">' + escapeHtml(msg.reply_to.message || 'Image') + '</div></div>';
  }

  if (msg.deleted) {
    bubbleWrap.innerHTML += '<div class="message-bubble msg-deleted">You deleted this message</div>';
  } else {
    if (msg.voice) {
      const dur = msg.voice_duration ? formatDuration(msg.voice_duration) : '0:00';
      bubbleWrap.innerHTML += '<div class="message-bubble voice-msg"><div class="voice-msg-inner" onclick="playVoiceMsg(this,\'' + msg.voice + '\')"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span class="voice-dur">' + dur + '</span></div></div>';
    }
    if (msg.image) {
      bubbleWrap.innerHTML += '<div class="message-bubble img-msg"><img src="' + msg.image.url + '" alt="" loading="lazy" draggable="false" oncontextmenu="return false;" onclick="openImgViewer(\'' + msg.image.url + '\')"></div>';
    }
    if (msg.message) {
      bubbleWrap.innerHTML += '<div class="message-bubble">' + escapeHtml(msg.message) + '</div>';
    }
    if (msg.edited) {
      bubbleWrap.innerHTML += '<div class="msg-edited">edited</div>';
    }
  }

  if (msg.reactions) {
    const emojis = Object.values(msg.reactions);
    const uniqueEmojis = [...new Set(emojis)];
    if (uniqueEmojis.length > 0) {
      bubbleWrap.innerHTML += '<div class="msg-reactions">';
      uniqueEmojis.forEach(emoji => {
        const count = emojis.filter(e => e === emoji).length;
        bubbleWrap.innerHTML += '<span class="msg-reaction">' + emoji + (count > 1 ? '<small>' + count + '</small>' : '') + '</span>';
      });
      bubbleWrap.innerHTML += '</div>';
    }
  }

  // Real-time messages always show time (last in group)
  bubbleWrap.innerHTML += '<div class="message-time">' + time + '</div>';

  wrapper.appendChild(bubbleWrap);
  if (!msg.deleted) {
    wrapper.onclick = function() { showActionPopup(msg.id, this, isOwn); };
  }

  area.insertBefore(wrapper, insertBefore);
}

function updateMessageInDOM(msg) {
  const wrapper = document.querySelector('.message-wrapper[data-msg-id="' + msg.id + '"]');
  if (!wrapper) return;

  const isOwn = msg.from === myId;
  const time = new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  let content = '';

  if (msg.reply_to) {
    const rpName = msg.reply_to.from === myId ? 'You' : (allUsers.find(u => u.id === msg.reply_to.from)?.name || 'Unknown');
    content += '<div class="reply-preview"><div class="rp-name">' + escapeHtml(rpName) + '</div><div class="rp-text">' + escapeHtml(msg.reply_to.message || 'Image') + '</div></div>';
  }

  if (msg.deleted) {
    content += '<div class="message-bubble msg-deleted">You deleted this message</div>';
  } else {
    if (msg.voice) {
      const dur = msg.voice_duration ? formatDuration(msg.voice_duration) : '0:00';
      content += '<div class="message-bubble voice-msg"><div class="voice-msg-inner" onclick="playVoiceMsg(this,\'' + msg.voice + '\')"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span class="voice-dur">' + dur + '</span></div></div>';
    }
    if (msg.image) {
      content += '<div class="message-bubble img-msg"><img src="' + msg.image.url + '" alt="" loading="lazy" draggable="false" oncontextmenu="return false;" onclick="openImgViewer(\'' + msg.image.url + '\')"></div>';
    }
    if (msg.message) {
      content += '<div class="message-bubble">' + escapeHtml(msg.message) + '</div>';
    }
    if (msg.edited) {
      content += '<div class="msg-edited">edited</div>';
    }
  }

  // Reactions display
  if (msg.reactions) {
    const emojis = Object.values(msg.reactions);
    const uniqueEmojis = [...new Set(emojis)];
    if (uniqueEmojis.length > 0) {
      content += '<div class="msg-reactions">';
      uniqueEmojis.forEach(emoji => {
        const count = emojis.filter(e => e === emoji).length;
        content += '<span class="msg-reaction">' + emoji + (count > 1 ? '<small>' + count + '</small>' : '') + '</span>';
      });
      content += '</div>';
    }
  }

  content += '<div class="message-time">' + time + '</div>';
  wrapper.innerHTML = content;
  if (!msg.deleted) {
    wrapper.onclick = function() { showActionPopup(msg.id, this, isOwn); };
  }
}

// ==================== SEND MESSAGE ====================
async function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();

  if (!text) return;
  if (!selectedUserId) return;

  const convId = [myId, selectedUserId].sort().join('_');

  const msgData = {
    conversation: convId,
    from: myId,
    to: selectedUserId,
    created_at: firebase.firestore.FieldValue.serverTimestamp(),
    edited: false,
    deleted: false
  };

  if (text) msgData.message = text;
  if (replyToMsg) {
    msgData.reply_to = {
      id: replyToMsg.id,
      message: replyToMsg.message || 'Image',
      from: replyToMsg.from
    };
    cancelReply();
  }

  await db.collection('messages').add(msgData);

  // Telegram alert
  if (typeof sendTelegramAlert === 'function') {
    const toUser = allUsers.find(u => u.id === selectedUserId);
    const toName = toUser ? toUser.name : 'Admin';
    sendTelegramAlert(myName, text || '[Image]', new Date().toLocaleString('en-IN'), toName);
  }

  input.value = '';
  autoResize(input);
  hideSendBtn();
  clearTimeout(typingTimeout);
  db.collection('typing').doc(convId).set({ [myId]: false }, { merge: true });
  scrollToBottom();
}


// ==================== MESSAGE ACTIONS ====================
function showActionPopup(msgId, el, isOwn) {
  actionMsgId = msgId;
  // Show/hide edit/delete based on ownership
  document.getElementById('actEdit').style.display = isOwn ? 'flex' : 'none';
  document.getElementById('actEditSep').style.display = isOwn ? 'block' : 'none';
  document.getElementById('actDelete').style.display = isOwn ? 'flex' : 'none';
  document.getElementById('actDeleteSep').style.display = isOwn ? 'block' : 'none';
  document.getElementById('actionOverlay').classList.add('show');
  document.getElementById('actionPopup').classList.add('show');
}

function hideActionPopup() {
  document.getElementById('actionPopup').classList.remove('show');
  document.getElementById('actionOverlay').classList.remove('show');
  actionMsgId = null;
}

function toggleReaction(emoji) {
  const id = actionMsgId;
  hideActionPopup();
  if (!id) return;
  const ref = db.collection('messages').doc(id);
  ref.get().then(doc => {
    if (!doc.exists) return;
    const data = doc.data();
    const reactions = data.reactions || {};
    if (reactions[myId] === emoji) {
      delete reactions[myId];
      ref.update({ reactions: reactions });
    } else {
      ref.update({ ['reactions.' + myId]: emoji });
    }
  });
}

async function doDeleteMsg() {
  if (!actionMsgId) return;
  await db.collection('messages').doc(actionMsgId).update({
    deleted: true,
    message: ''
  });
  hideActionPopup();
}

function doEditMsg() {
  if (!actionMsgId) return;
  const id = actionMsgId;
  hideActionPopup();
  editingMsgId = id;

  db.collection('messages').doc(editingMsgId).get().then((doc) => {
    if (doc.exists) {
      const data = doc.data();
      document.getElementById('editInput').value = data.message || '';
      document.getElementById('editOverlay').classList.add('show');
      document.getElementById('editInput').focus();
    }
  });
}

function cancelEdit() {
  editingMsgId = null;
  document.getElementById('editOverlay').classList.remove('show');
}

async function saveEdit() {
  if (!editingMsgId) return;
  const newText = document.getElementById('editInput').value.trim();
  if (!newText) return;

  await db.collection('messages').doc(editingMsgId).update({
    message: newText,
    edited: true
  });

  editingMsgId = null;
  document.getElementById('editOverlay').classList.remove('show');
}

function doReplyMsg() {
  if (!actionMsgId) return;
  const id = actionMsgId;
  hideActionPopup();

  db.collection('messages').doc(id).get().then((doc) => {
    if (doc.exists) {
      const data = doc.data();
      replyToMsg = {
        id: id,
        message: data.message || 'Image',
        from: data.from
      };

      const rpName = replyToMsg.from === myId ? 'You' : (allUsers.find(u => u.id === replyToMsg.from)?.name || 'Unknown');
      document.getElementById('replyLabel').textContent = 'Replying to ' + rpName;
      document.getElementById('replyText').textContent = replyToMsg.message || 'Image';
      document.getElementById('replyPreviewBar').classList.add('show');
      document.getElementById('messageInput').focus();
    }
  });
}

function cancelReply() {
  replyToMsg = null;
  document.getElementById('replyPreviewBar').classList.remove('show');
}

// ==================== TYPING ====================
function listenTyping() {
  if (!selectedUserId) return;
  if (unsubTyping) unsubTyping();

  const convId = [myId, selectedUserId].sort().join('_');

  unsubTyping = db.collection('typing').doc(convId).onSnapshot((doc) => {
    const el = document.getElementById('typingIndicator');
    if (doc.exists && doc.data()[selectedUserId]) {
      el.classList.add('show');
      scrollToBottom();
    } else {
      el.classList.remove('show');
    }
  });
}

// ==================== RECORDING INDICATOR ====================
function listenRecording() {
  if (!selectedUserId) return;
  if (unsubRecording) unsubRecording();

  const convId = [myId, selectedUserId].sort().join('_');

  unsubRecording = db.collection('recording').doc(convId).onSnapshot((doc) => {
    const el = document.getElementById('recordingIndicator');
    if (doc.exists && doc.data()[selectedUserId]) {
      el.classList.add('show');
      document.getElementById('typingIndicator').classList.remove('show');
      scrollToBottom();
    } else {
      el.classList.remove('show');
    }
  });
}

function setRecordingStatus(isRecording) {
  if (!selectedUserId) return;
  const convId = [myId, selectedUserId].sort().join('_');
  if (isRecording) {
    db.collection('recording').doc(convId).set({ [myId]: true }, { merge: true });
  } else {
    db.collection('recording').doc(convId).set({ [myId]: false }, { merge: true });
  }
}

function handleTyping() {
  if (!selectedUserId) return;
  const convId = [myId, selectedUserId].sort().join('_');
  const now = Date.now();

  if (now - lastTypingEmit > 2000) {
    db.collection('typing').doc(convId).set({ [myId]: true }, { merge: true });
    lastTypingEmit = now;
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    db.collection('typing').doc(convId).set({ [myId]: false }, { merge: true });
  }, 2000);
}


// ==================== TAB SWITCHING ====================
function switchTab(tab) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Mobile: reset user list/chat visibility when switching tabs
  if (window.innerWidth <= 768) {
    document.getElementById('userListArea').classList.remove('hide');
    document.getElementById('chatArea').classList.remove('show');
  }

  if (tab === 'chat') {
    document.getElementById('chatPage').classList.add('active');
    document.getElementById('navChat').classList.add('active');
    document.getElementById('appTitle').textContent = 'Chats';
  } else if (tab === 'profile') {
    document.getElementById('profilePage').classList.add('active');
    document.getElementById('navProfile').classList.add('active');
    document.getElementById('appTitle').textContent = 'Profile';
    loadProfile();
  } else if (tab === 'voice') {
    document.getElementById('voicePage').classList.add('active');
    document.getElementById('navVoice').classList.add('active');
    document.getElementById('appTitle').textContent = 'Voice';
    loadVoiceRecordings();
  }
}


function openLogoPicker() {
  const grid = document.getElementById('logoGrid');
  grid.innerHTML = LOGO_URLS.map(function(url) {
    return '<div class="logo-grid-item" onclick="selectLogo(\'' + url + '\')"><img src="' + url + '" alt="Logo" loading="lazy"></div>';
  }).join('');
  document.getElementById('logoPickerOverlay').classList.add('show');
}

function closeLogoPicker() {
  document.getElementById('logoPickerOverlay').classList.remove('show');
}

function selectLogo(url) {
  closeLogoPicker();
  selectedLogoUrl = url;
  document.getElementById('adjImage').style.backgroundImage = 'url(' + url + ')';
  document.getElementById('adjImage').style.backgroundSize = 'cover';
  document.getElementById('adjImage').style.backgroundPosition = 'center';
  document.getElementById('adjZoom').value = '1.2';
  document.getElementById('logoAdjustOverlay').classList.add('show');
  initAdjDrag();
}

function closeLogoAdjuster() {
  document.getElementById('logoAdjustOverlay').classList.remove('show');
  adjDragState = null;
}

function adjustLogoZoom() {
  const zoom = parseFloat(document.getElementById('adjZoom').value);
  document.getElementById('adjImage').style.backgroundSize = (zoom * 100) + '%';
}

function initAdjDrag() {
  const el = document.getElementById('adjImage');
  adjDragState = null;

  function onStart(cx, cy) {
    adjDragState = { dragging: true, sx: cx, sy: cy, bx: parseFloat(el.style.backgroundPositionX || '50'), by: parseFloat(el.style.backgroundPositionY || '50') };
    el.style.transition = 'none';
  }

  function onMove(cx, cy) {
    if (!adjDragState?.dragging) return;
    const dx = cx - adjDragState.sx;
    const dy = cy - adjDragState.sy;
    el.style.backgroundPosition = (adjDragState.bx + dx) + 'px ' + (adjDragState.by + dy) + 'px';
  }

  function onEnd() {
    if (adjDragState?.dragging) {
      adjDragState.dragging = false;
      el.style.transition = '';
    }
  }

  el.onpointerdown = function(e) { e.preventDefault(); onStart(e.clientX, e.clientY); };
  el.ontouchstart = function(e) { e.preventDefault(); onStart(e.touches[0].clientX, e.touches[0].clientY); };
  document.onpointermove = function(e) { if (adjDragState?.dragging) onMove(e.clientX, e.clientY); };
  document.ontouchmove = function(e) { if (adjDragState?.dragging) { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); } };
  document.onpointerup = onEnd;
  document.ontouchend = onEnd;
}

async function saveLogo() {
  if (!selectedLogoUrl) return;
  closeLogoAdjuster();
  myPhotoURL = selectedLogoUrl;
  localStorage.setItem('chatUserPhoto', selectedLogoUrl);

  try {
    await db.collection('users').doc(myId).update({ photoURL: selectedLogoUrl });
  } catch (err) {
    console.error('Save logo error:', err);
  }

  updateAvatarUI(selectedLogoUrl);
  showToast('Profile', 'Logo updated successfully');
}

function updateAvatarUI(url) {
  const initial = myName.charAt(0).toUpperCase();
  document.getElementById('paInitial').style.display = 'none';
  document.getElementById('paImg').style.display = 'block';
  document.getElementById('paImg').innerHTML = '<img src="' + url + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
  document.getElementById('myAvatar').innerHTML = '<img src="' + url + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" loading="lazy">';
}

async function saveProfile() {
  const newName = document.getElementById('profileNameInput').value.trim();
  if (!newName) return;

  myName = newName;
  localStorage.setItem('chatUserName', newName);

  await db.collection('users').doc(myId).update({ name: newName });

  document.getElementById('profileNameDisplay').textContent = newName;
  if (myPhotoURL) {
    updateAvatarUI(myPhotoURL);
  } else {
    document.getElementById('paInitial').style.display = 'block';
    document.getElementById('paInitial').textContent = newName.charAt(0).toUpperCase();
    document.getElementById('paImg').style.display = 'none';
    document.getElementById('myAvatar').innerHTML = '<span class="my-av-initial">' + newName.charAt(0).toUpperCase() + '</span>';
  }
  document.getElementById('appTitle').textContent = 'Profile';

  showToast('Profile', 'Name updated successfully');
}

async function changePassword() {
  const oldPass = document.getElementById('oldPassInput').value.trim();
  const newPass = document.getElementById('newPassInput').value.trim();
  const status = document.getElementById('passChangeStatus');

  if (!oldPass || !newPass) {
    status.textContent = 'Fill both fields';
    status.style.color = 'var(--ios-red)';
    return;
  }
  if (newPass.length < 3) {
    status.textContent = 'New password must be at least 3 characters';
    status.style.color = 'var(--ios-red)';
    return;
  }

  status.textContent = 'Checking...';
  status.style.color = 'var(--ios-gray)';

  try {
    const doc = await db.collection('users').doc(myId).get();
    if (!doc.exists) { status.textContent = 'User not found'; status.style.color = 'var(--ios-red)'; return; }
    if (doc.data().password !== oldPass) {
      status.textContent = 'Current password is wrong';
      status.style.color = 'var(--ios-red)';
      return;
    }
    await db.collection('users').doc(myId).update({ password: newPass });
    status.textContent = 'Password changed successfully';
    status.style.color = 'var(--ios-green)';
    document.getElementById('oldPassInput').value = '';
    document.getElementById('newPassInput').value = '';
    setTimeout(() => { status.textContent = ''; }, 3000);
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
    status.style.color = 'var(--ios-red)';
  }
}


// ==================== LOGOUT ====================
function logout() {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  if (visibilityHandler) { document.removeEventListener('visibilitychange', visibilityHandler); visibilityHandler = null; }
  if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
  if (unsubUsers) unsubUsers();
  if (unsubMessages) unsubMessages();
  if (unsubTyping) unsubTyping();
  if (unsubRecording) unsubRecording();

  db.collection('users').doc(myId).update({ is_online: false, last_seen: firebase.firestore.FieldValue.serverTimestamp() });

  localStorage.removeItem('chatUserName');
  localStorage.removeItem('chatUserId');
  localStorage.removeItem('chatUserPhoto');

  myId = null;
  myName = '';
  myPhotoURL = '';
  selectedUserId = null;
  replyToMsg = null;
  loadedMsgIds.clear();
  allUsers = [];

  document.getElementById('mainApp').classList.remove('show');
  document.getElementById('nameScreen').classList.remove('hide');
  document.getElementById('nameInput').value = '';
  document.getElementById('passInput').value = '';
  document.getElementById('nameError').style.display = 'none';
  document.getElementById('nameInput').focus();
}

// Profile enter key
document.getElementById('profileNameInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveProfile();
});

// Enter to send
document.getElementById('messageInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});


// ==================== CALL FEATURE ====================
function updCallBtn() {
  const btns = document.querySelectorAll('.call-actions .call-btn');
  btns.forEach(b => { b.style.display = selectedUserId ? '' : 'none'; });
}

function getUserName(uid) {
  if (uid === myId) return myName;
  const u = allUsers.find(x => x.id === uid);
  return u ? u.name : 'Admin';
}

function getInitial(uid) {
  if (uid === myId) return myName.charAt(0).toUpperCase();
  const u = allUsers.find(x => x.id === uid);
  return u ? u.name.charAt(0).toUpperCase() : 'A';
}

// Override selectUser to show call buttons
const origUserSelect = selectUser;
selectUser = function(userId) {
  origUserSelect(userId);
  updCallBtn();
};


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


function showUploading(label) {
  document.getElementById('uploadingLabel').textContent = label || 'Uploading...';
  document.getElementById('uploadingOverlay').classList.add('show');
}
function hideUploading() {
  document.getElementById('uploadingOverlay').classList.remove('show');
}

function openImgViewer(url) {
  document.getElementById('imgViewerImg').src = url;
  document.getElementById('imgViewerOverlay').style.display = 'flex';
}
function closeImgViewer() {
  document.getElementById('imgViewerOverlay').style.display = 'none';
  document.getElementById('imgViewerImg').src = '';
}

async function sendImage(input) {
  const file = input.files[0];
  if (!file || !selectedUserId) { input.value = ''; return; }
  showUploading('Uploading image...');
  try {
    const formData = new FormData();
    formData.append('image', file);
    const SERVER_URL = 'https://yutube-com-pcu9.onrender.com';
    const res = await fetch(SERVER_URL + '/api/voice-packs/upload-image', { method: 'POST', body: formData });
    const data = await res.json();
    const convId = [myId, selectedUserId].sort().join('_');
    const msgData = {
      conversation: convId, from: myId, to: selectedUserId,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      edited: false, deleted: false,
      image: { url: SERVER_URL + data.url }
    };
    if (replyToMsg) {
      msgData.reply_to = { id: replyToMsg.id, message: replyToMsg.message || 'Image', from: replyToMsg.from };
      cancelReply();
    }
    await db.collection('messages').add(msgData);
    if (typeof sendTelegramAlert === 'function') {
      const toUser = allUsers.find(u => u.id === selectedUserId);
      const toName = toUser ? toUser.name : 'Admin';
      sendTelegramAlert(myName, '📷 Image', new Date().toLocaleString('en-IN'), toName);
    }
    scrollToBottom();
  } catch (err) {
    alert('Failed to send image. Check server connection.');
  }
  hideUploading();
  input.value = '';
}


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
let voicePackSendingAudioUrl = null;
let voicePackSendingDuration = 0;
let voicePackSendingId = null;
let voiceRecData = {};

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

const VOICE_EMPTY_HTML = '<div class="voice-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ios-gray3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg><div>No recordings yet</div><div style="font-size:13px;margin-top:4px;">Tap the mic button below to record</div></div>';

let _voiceLoadTimer = null;
async function loadVoiceRecordings() {
  if (_voiceLoadTimer) clearTimeout(_voiceLoadTimer);
  return new Promise(resolve => {
    _voiceLoadTimer = setTimeout(async () => {
      const list = document.getElementById('voiceList');
      voiceRecData = {};
      try {
        const res = await fetch(VOICE_API + '/api/voices/list?userId=' + encodeURIComponent(myId) + '&t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('Server error');
        const recordings = await res.json();
        if (recordings.length === 0) {
          list.innerHTML = VOICE_EMPTY_HTML;
          resolve();
          return;
        }
        list.innerHTML = recordings.map(r => {
          const user = (typeof allUsers !== 'undefined' && allUsers.find) ? allUsers.find(u => u.id === r.user_id) : null;
          const name = user ? user.name : 'User';
          const initial = name.charAt(0).toUpperCase();
          const avatar = (user && user.photoURL) ? '<img src="' + user.photoURL + '">' : initial;
          const isOwner = r.user_id === myId;
          const timeAgo = r.created_at ? getTimeAgo(new Date(r.created_at + 'Z')) : '';
          const listened = getListenedVoices().includes(r.id);
          voiceRecData[r.id] = r;
          return '<div class="voice-card' + (!listened ? ' is-recent' : '') + '" data-id="' + r.id + '">' +
            '<div class="voice-card-header">' +
              '<div class="voice-card-avatar">' + avatar + '</div>' +
              '<div class="voice-card-info">' +
                '<div class="voice-card-name">' + escapeHtml(name) + (!listened ? '<span class="voice-new-badge">NEW</span>' : '') + '</div>' +
                '<div class="voice-card-time">' + timeAgo + '</div>' +
              '</div>' +
              (isOwner ? '<button class="voice-card-delete" onclick="sendVoiceToUser(\'' + r.id + '\')" title="Send to user" style="color:var(--ios-blue);margin-right:6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg></button>' : '') +
              (isOwner ? '<button class="voice-card-delete" onclick="deleteVoiceRecording(\'' + r.id + '\')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' : '') +
            '</div>' +
            '<div class="voice-card-player">' +
              '<button class="voice-card-play" onclick="playVoiceCard(this, \'' + (r.audio_url || '') + '\')">' +
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>' +
              '</button>' +
              '<div class="voice-card-bar" onclick="seekVoiceCard(event, this)" data-dur="' + (r.duration || 0) + '">' +
                '<div class="voice-card-bar-fill"></div>' +
              '</div>' +
              '<span class="voice-card-dur">' + formatDuration(r.duration || 0) + '</span>' +
            '</div>' +
          '</div>';
        }).join('');
        resolve();
      } catch (err) {
        if (list.querySelector('.voice-card')) {
          resolve();
          return;
        }
        list.innerHTML = '<div class="voice-empty">Failed to load. Tap mic to try again.</div>';
        resolve();
      }
    }, 300);
  });
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

function sendVoiceToUser(recordingId) {
  const rec = voiceRecData[recordingId];
  if (!rec) return;
  voicePackSendingAudioUrl = rec.audio_url || '';
  voicePackSendingDuration = rec.duration || 0;
  voicePackSendingId = recordingId;
  showVoiceUserSelect();
}

function showVoiceUserSelect() {
  const list = document.getElementById('voiceUserSelectList');
  if (allUsers.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--ios-gray);padding:20px;">No users found</div>';
  } else {
    list.innerHTML = allUsers.map(function(user) {
      var initial = (user.name || 'U').charAt(0).toUpperCase();
      var avatar = user.photoURL ? '<img src="' + user.photoURL + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">' : '<div style="width:36px;height:36px;border-radius:50%;background:var(--ios-gray5);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px;color:var(--ios-gray);">' + initial + '</div>';
      return '<div onclick="selectVoicePackRecipient(\'' + user.id + '\')" style="display:flex;align-items:center;gap:12px;padding:10px 4px;cursor:pointer;border-bottom:0.5px solid var(--ios-separator);">' + avatar + '<div style="font-size:15px;font-weight:500;">' + escapeHtml(user.name) + '</div></div>';
    }).join('');
  }
  showVoiceSheet('voiceUserSelectUI');
}

function hideVoiceUserSelect() {
  hideVoiceSheet('voiceUserSelectUI');
  voicePackSendingAudioUrl = null;
  voicePackSendingDuration = 0;
  voicePackSendingId = null;
}

async function selectVoicePackRecipient(userId) {
  if (!voicePackSendingId || !myId) return;
  hideVoiceUserSelect();

  var user = allUsers.find(function(u) { return u.id === userId; });
  var recipientName = user ? user.name : 'User';

  showUploading('Sending voice pack...');

  try {
    var sendRes = await fetch(VOICE_API + '/api/voices/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recordingId: voicePackSendingId,
        senderId: myId,
        receiverId: userId
      })
    });

    var sendData = await sendRes.json();

    if (sendData.success) {
      showToast('Sent', 'Voice pack sent to ' + recipientName);
      loadVoiceRecordings();
    } else {
      throw new Error('Send failed');
    }
  } catch (err) {
    console.error('Send voice pack error:', err);
    alert('Failed to send voice pack.');
  }

  hideUploading();
  voicePackSendingAudioUrl = null;
  voicePackSendingDuration = 0;
  voicePackSendingId = null;
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

async function migrateToJasmine() {
  try {
    var jasmineUser = allUsers.find(function(u) { return (u.name || '').toUpperCase() === 'JASMINE'; });
    if (!jasmineUser) {
      alert('Jasmine user not found!');
      return;
    }

    var confirmSend = confirm('Send all your recordings to ' + jasmineUser.name + '?');
    if (!confirmSend) return;

    showUploading('Sending all recordings to Jasmine...');

    var res = await fetch(VOICE_API + '/api/voices/list?userId=' + encodeURIComponent(myId) + '&t=' + Date.now(), { cache: 'no-store' });
    var recordings = await res.json();
    var myRecordings = recordings.filter(function(r) { return r.user_id === myId && !r.receiver_id; });

    var sent = 0;
    for (var i = 0; i < myRecordings.length; i++) {
      try {
        var sendRes = await fetch(VOICE_API + '/api/voices/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordingId: myRecordings[i].id,
            senderId: myId,
            receiverId: jasmineUser.id
          })
        });
        var sendData = await sendRes.json();
        if (sendData.success) sent++;
      } catch (e) {}
    }

    hideUploading();
    alert('Done! Sent ' + sent + ' recordings to Jasmine.');
    loadVoiceRecordings();
  } catch (err) {
    hideUploading();
    alert('Migration failed: ' + err.message);
  }
}

