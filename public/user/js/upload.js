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
