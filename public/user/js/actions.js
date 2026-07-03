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
