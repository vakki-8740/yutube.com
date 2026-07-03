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

// Auto-login if name exists
if (myName) {
  window.addEventListener('beforeunload', handleBeforeUnload);
  showMainApp();
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
  });
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (unsubUsers) unsubUsers();
  if (unsubMessages) unsubMessages();
  if (unsubTyping) unsubTyping();
  if (unsubRecording) unsubRecording();
}

document.getElementById('nameInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('passInput').focus();
});
document.getElementById('passInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinChat();
});
