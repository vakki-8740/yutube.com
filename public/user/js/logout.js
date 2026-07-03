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
