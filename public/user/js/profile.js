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

function initDarkMode() {
  const saved = localStorage.getItem('darkMode') === 'true';
  if (saved) {
    document.documentElement.setAttribute('data-theme', 'dark');
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.checked = true;
  }
}

function toggleDarkMode(enabled) {
  if (enabled) {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('darkMode', 'true');
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('darkMode', 'false');
  }
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
