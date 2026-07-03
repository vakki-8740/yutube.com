// Firebase SDK Script Tags (load externally before this file):
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js"></script>

document.addEventListener('contextmenu', function(e) {
  if (e.target.closest('.img-msg, .voice-msg, .voice-card, .vp-msg, #imgViewerOverlay, #voicePreviewUI')) {
    e.preventDefault();
    return false;
  }
});
document.addEventListener('dragstart', function(e) {
  if (e.target.closest('img, audio')) {
    e.preventDefault();
    return false;
  }
});

firebase.initializeApp({
  apiKey: "AIzaSyB2j604pnQWRzpu_yE0biwWktths5TxW38",
  authDomain: "own-chat-app-d5fd0.firebaseapp.com",
  projectId: "own-chat-app-d5fd0",
  storageBucket: "own-chat-app-d5fd0.firebasestorage.app",
  messagingSenderId: "191123388943",
  appId: "1:191123388943:web:2a352c0912c015e5e1017a"
});

initDarkMode();

const db = firebase.firestore();
const storage = firebase.storage();

const LOGO_URLS = [
  'https://i.ibb.co/PGtpdnv1/image.webp',
  'https://i.ibb.co/yvQtTPV/image.webp',
  'https://i.ibb.co/JWY0cwDM/image.webp',
  'https://i.ibb.co/MknvqPkq/image.webp',
  'https://i.ibb.co/cXwr7r4q/image.webp',
  'https://i.ibb.co/bg45Q6LH/image.webp',
  'https://i.ibb.co/YFstpKhC/image.webp',
  'https://i.ibb.co/zh2X13NY/image.webp',
  'https://i.ibb.co/67TkWJhv/image.webp',
  'https://i.ibb.co/NdV2Mbtm/image.webp',
  'https://i.ibb.co/vCwfWVTh/image.webp'
];

const STUN = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
  ]
};

const callsDb = db.collection('calls');
