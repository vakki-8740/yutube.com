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

  if (window.innerWidth <= 768) {
    document.getElementById('userListArea').classList.add('hide');
  }

  listenMessages();
  listenTyping();
  listenRecording();
  renderBroadcastMessages();
}

function goBack() {
  document.getElementById('userListArea').classList.remove('hide');
  selectedUserId = null;
  document.getElementById('emptyState').style.display = 'flex';
  document.getElementById('chatView').classList.remove('show');
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  if (unsubTyping) { unsubTyping(); unsubTyping = null; }
  if (unsubRecording) { unsubRecording(); unsubRecording = null; }
  cancelReply();
}

// ==================== MESSAGES ====================
function listenMessages() {
  if (!selectedUserId) return;
  const convId = [myId, selectedUserId].sort().join('_');

  const area = document.getElementById('messagesArea');
  const typingEl = document.getElementById('typingIndicator');
  area.innerHTML = '';
  area.appendChild(typingEl);

  let lastDate = '';
  let isInitial = true;

  unsubMessages = db.collection('messages')
    .where('conversation', '==', convId)
    .orderBy('created_at', 'asc')
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' && !loadedMsgIds.has(change.doc.id)) {
          loadedMsgIds.add(change.doc.id);
          const data = change.doc.data();
          const msg = { id: change.doc.id, ...data, created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at };

          if (isInitial) {
            const msgDate = new Date(msg.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            if (msgDate !== lastDate) {
              const sep = document.createElement('div');
              sep.className = 'date-separator';
              sep.innerHTML = '<span>' + msgDate + '</span>';
              area.insertBefore(sep, typingEl);
              lastDate = msgDate;
            }
          }

          appendMessageToArea(msg, typingEl, !isInitial);
          if (!isInitial) {
            const a = document.getElementById('messagesArea');
            if (a && a.scrollHeight - a.scrollTop - a.clientHeight < 200) {
              scrollToBottom();
            }
          }
        } else if (change.type === 'modified') {
          const data = change.doc.data();
          const msg = { id: change.doc.id, ...data, created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at };
          updateMessageInDOM(msg);
        }
      });

      if (isInitial) {
        isInitial = false;
        scrollToBottom();
      }
    });
}

function appendMessageToArea(msg, insertBefore, animate) {
  const area = document.getElementById('messagesArea');
  const isOwn = msg.from === myId;
  const time = new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (msg.deleted && msg.from !== myId) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper ' + (isOwn ? 'own' : 'other');
  wrapper.dataset.msgId = msg.id;
  if (!animate) wrapper.style.animation = 'none';

  let content = '';
  let extraClass = '';

  if (msg.reply_to) {
    const rpName = msg.reply_to.from === myId ? 'You' : (allUsers.find(u => u.id === msg.reply_to.from)?.name || 'Unknown');
    content += '<div class="reply-preview"><div class="rp-name">' + escapeHtml(rpName) + '</div><div class="rp-text">' + escapeHtml(msg.reply_to.message || 'Image') + '</div></div>';
  }

  if (msg.deleted) {
    content += '<div class="message-bubble msg-deleted">You deleted this message</div>';
    extraClass = ' msg-deleted';
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

  if (!msg.deleted) {
    content += '<div class="message-time">' + time + '</div>';
    wrapper.innerHTML = content;
    wrapper.onclick = function() { showActionPopup(msg.id, this, isOwn); };
  } else {
    content += '<div class="message-time">' + time + '</div>';
    wrapper.innerHTML = content;
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
