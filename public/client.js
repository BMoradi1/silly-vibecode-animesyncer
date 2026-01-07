const socket = io();

const videoPlayer = document.getElementById('videoPlayer');
const noVideoDiv = document.getElementById('noVideo');
const videoTitle = document.getElementById('videoTitle');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessage');
const nicknameInput = document.getElementById('nickname');
const setNicknameBtn = document.getElementById('setNickname');
const userCountSpan = document.getElementById('userCount');
const usersListDiv = document.getElementById('usersList');

let isSeeking = false;
let nickname = localStorage.getItem('nickname') || `User${Math.floor(Math.random() * 1000)}`;

// Set initial nickname
nicknameInput.value = nickname;

// Register as user
socket.emit('register-user', { nickname });

// Set nickname
setNicknameBtn.addEventListener('click', () => {
  nickname = nicknameInput.value || `User${Math.floor(Math.random() * 1000)}`;
  localStorage.setItem('nickname', nickname);
  socket.emit('register-user', { nickname });
  addSystemMessage(`You are now known as ${nickname}`);
});

// Video changed
socket.on('video-changed', (video) => {
  if (video) {
    videoPlayer.src = video.path;
    videoPlayer.classList.add('active');
    noVideoDiv.style.display = 'none';
    videoTitle.textContent = video.originalname || video.filename;
    addSystemMessage(`New video loaded: ${video.originalname || video.filename}`);
  }
});

// Sync state
socket.on('sync-state', (state) => {
  if (!videoPlayer.src) return;

  const timeDiff = (Date.now() - state.timestamp) / 1000;
  const expectedTime = state.playing ? state.currentTime + timeDiff : state.currentTime;

  // Sync if difference is more than 1 second
  if (Math.abs(videoPlayer.currentTime - expectedTime) > 1) {
    isSeeking = true;
    videoPlayer.currentTime = expectedTime;
    setTimeout(() => isSeeking = false, 500);
  }

  if (state.playing && videoPlayer.paused) {
    videoPlayer.play().catch(e => console.log('Play failed:', e));
  } else if (!state.playing && !videoPlayer.paused) {
    videoPlayer.pause();
  }
});

// Play command
socket.on('play', (state) => {
  if (!videoPlayer.src) return;
  const timeDiff = (Date.now() - state.timestamp) / 1000;
  const expectedTime = state.currentTime + timeDiff;

  isSeeking = true;
  videoPlayer.currentTime = expectedTime;
  videoPlayer.play().catch(e => console.log('Play failed:', e));
  setTimeout(() => isSeeking = false, 500);
});

// Pause command
socket.on('pause', (state) => {
  if (!videoPlayer.src) return;
  isSeeking = true;
  videoPlayer.currentTime = state.currentTime;
  videoPlayer.pause();
  setTimeout(() => isSeeking = false, 500);
});

// Seek command
socket.on('seek', (data) => {
  if (!videoPlayer.src) return;
  isSeeking = true;
  videoPlayer.currentTime = data.time;
  setTimeout(() => isSeeking = false, 500);
});

// Prevent user from controlling video
videoPlayer.addEventListener('play', (e) => {
  if (!isSeeking) {
    e.preventDefault();
    videoPlayer.pause();
    addSystemMessage('⚠️ Only the admin can control playback');
  }
});

videoPlayer.addEventListener('pause', (e) => {
  if (!isSeeking && !videoPlayer.ended) {
    e.preventDefault();
    videoPlayer.play().catch(() => {});
    addSystemMessage('⚠️ Only the admin can control playback');
  }
});

videoPlayer.addEventListener('seeking', (e) => {
  if (!isSeeking) {
    socket.emit('sync-request');
    addSystemMessage('⚠️ Only the admin can seek');
  }
});

// Chat
sendMessageBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const message = messageInput.value.trim();
  if (message) {
    socket.emit('chat-message', { message });
    messageInput.value = '';
  }
}

socket.on('chat-message', (data) => {
  addChatMessage(data.nickname, data.message, data.timestamp);
});

function addChatMessage(nickname, message, timestamp) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message';

  const time = new Date(timestamp).toLocaleTimeString();
  messageDiv.innerHTML = `
    <span class="nickname">${escapeHtml(nickname)}:</span>
    <span class="message">${escapeHtml(message)}</span>
    <span class="timestamp">${time}</span>
  `;

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message';
  messageDiv.style.background = '#e3f2fd';
  messageDiv.innerHTML = `<span style="color: #1976d2;">ℹ️ ${escapeHtml(message)}</span>`;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// User list
socket.on('user-list', (users) => {
  userCountSpan.textContent = `${users.length} user${users.length !== 1 ? 's' : ''} online`;

  usersListDiv.innerHTML = '';
  users.forEach(user => {
    const userDiv = document.createElement('div');
    userDiv.className = `user-item ${user.role === 'admin' ? 'admin' : ''}`;
    userDiv.textContent = user.nickname + (user.role === 'admin' ? ' 👑' : '');
    usersListDiv.appendChild(userDiv);
  });
});

// Request initial sync
setTimeout(() => {
  socket.emit('sync-request');
}, 1000);

// Periodic sync check
setInterval(() => {
  if (videoPlayer.src && !videoPlayer.paused) {
    socket.emit('sync-request');
  }
}, 5000);
