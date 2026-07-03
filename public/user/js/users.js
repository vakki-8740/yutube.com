// ==================== USERS ====================
function listenUsers() {
  if (unsubUsers) unsubUsers();

  unsubUsers = db.collection('users').orderBy('name', 'asc').onSnapshot((snapshot) => {
    allUsers = [];
    snapshot.forEach(doc => {
      if (doc.id === myId) return;
      const data = doc.data();
      const isOnline = data.is_online && data.last_active?.toDate?.() ? (Date.now() - data.last_active.toDate().getTime() < 60000) : false;
      allUsers.push({ id: doc.id, name: data.name || 'User', photoURL: data.photoURL || '', is_online: isOnline, last_seen: data.last_seen?.toDate?.()?.toISOString() || data.last_seen || null, created_at: data.created_at?.toDate?.()?.toISOString() || '' });
    });
    renderUsers();
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
