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
