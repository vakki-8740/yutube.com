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

  // Heartbeat - update last_active every 30 sec
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    db.collection('users').doc(myId).update({ last_active: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
  }, 30000);

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
          db.collection('users').doc(myId).update({ last_active: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
        }, 30000);
      }
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  listenUsers();
  loadProfile();
  listenForIncomingCalls();
  listenNewMsgNotifications();
  listenBroadcast();
  initDarkMode();
}

function setAvatarImg(elId, url) {
  const el = document.getElementById(elId);
  el.innerHTML = '<img src="' + url + '" alt="" loading="lazy" onerror="this.parentElement.innerHTML=this.parentElement.getAttribute(\'data-fallback\')||\'U\'">';
}
