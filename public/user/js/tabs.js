// ==================== TAB SWITCHING ====================
function switchTab(tab) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  if (tab === 'chat') {
    document.getElementById('chatPage').classList.add('active');
    document.getElementById('navChat').classList.add('active');
    document.getElementById('appTitle').textContent = 'Chats';
  } else if (tab === 'profile') {
    document.getElementById('profilePage').classList.add('active');
    document.getElementById('navProfile').classList.add('active');
    document.getElementById('appTitle').textContent = 'Profile';
    loadProfile();
  } else if (tab === 'voice') {
    document.getElementById('voicePage').classList.add('active');
    document.getElementById('navVoice').classList.add('active');
    document.getElementById('appTitle').textContent = 'Voice';
    loadVoiceRecordings();
  }
}
