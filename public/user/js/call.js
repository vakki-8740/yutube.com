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
