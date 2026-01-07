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
const queueDisplay = document.getElementById('queueDisplay');
const emptyQueueClient = document.getElementById('emptyQueueClient');
const syncIndicator = document.getElementById('syncIndicator');

let isSeeking = false;
let nickname = localStorage.getItem('nickname') || `User${Math.floor(Math.random() * 1000)}`;
let lastSyncTime = Date.now();

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

  lastSyncTime = Date.now();
  const timeDiff = (Date.now() - state.timestamp) / 1000;
  const expectedTime = state.playing ? state.currentTime + timeDiff : state.currentTime;

  // Balanced sync: sync if difference is more than 1 second
  const drift = Math.abs(videoPlayer.currentTime - expectedTime);
  if (drift > 1.0) {
    isSeeking = true;
    videoPlayer.currentTime = expectedTime;

    // Show sync indicator
    syncIndicator.classList.add('active');
    syncIndicator.textContent = `🔄 Synced (${drift.toFixed(2)}s)`;
    setTimeout(() => {
      syncIndicator.classList.remove('active');
      syncIndicator.textContent = '🔄 Synced';
    }, 1000);

    // Keep isSeeking true to prevent false warnings
    setTimeout(() => {
      isSeeking = false;
    }, 2000);
  }

  // Force playback state sync
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
  setTimeout(() => isSeeking = false, 1000);
});

// Pause command
socket.on('pause', (state) => {
  if (!videoPlayer.src) return;
  isSeeking = true;
  videoPlayer.currentTime = state.currentTime;
  videoPlayer.pause();
  setTimeout(() => isSeeking = false, 1000);
});

// Seek command
socket.on('seek', (data) => {
  if (!videoPlayer.src) return;
  isSeeking = true;
  videoPlayer.currentTime = data.time;
  setTimeout(() => isSeeking = false, 1000);
});

// Disable all controls for clients - only admin can control
videoPlayer.removeAttribute('controls');
videoPlayer.style.pointerEvents = 'none';

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
    // User tried to seek manually - prevent it
    e.preventDefault();
    socket.emit('sync-request');
    // Only show message occasionally to avoid spam
    if (!window.lastSeekWarning || Date.now() - window.lastSeekWarning > 3000) {
      addSystemMessage('⚠️ Only the admin can seek');
      window.lastSeekWarning = Date.now();
    }
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

// Queue display
function updateQueueDisplay(queue) {
  if (queue.length === 0) {
    queueDisplay.style.display = 'none';
    emptyQueueClient.style.display = 'block';
  } else {
    queueDisplay.style.display = 'block';
    emptyQueueClient.style.display = 'none';
    queueDisplay.innerHTML = '';

    queue.forEach((item, index) => {
      const queueItem = document.createElement('div');
      queueItem.className = 'queue-item-client';

      const position = document.createElement('span');
      position.className = 'queue-position';
      position.textContent = `#${index + 1}`;

      const name = document.createElement('span');
      name.className = 'queue-name';
      name.textContent = item.originalname || item.filename;

      queueItem.appendChild(position);
      queueItem.appendChild(name);
      queueDisplay.appendChild(queueItem);
    });
  }
}

socket.on('queue-updated', (queue) => {
  updateQueueDisplay(queue);
});

// Request initial sync
setTimeout(() => {
  socket.emit('sync-request');
}, 1000);

// Moderate sync checks - every 2 seconds for balanced synchronization
setInterval(() => {
  if (videoPlayer.src) {
    socket.emit('sync-request');
  }
}, 2000);

// Sync watchdog - detect if sync stops
setInterval(() => {
  const timeSinceLastSync = Date.now() - lastSyncTime;
  if (videoPlayer.src && timeSinceLastSync > 10000) {
    console.warn('Sync timeout - forcing re-sync');
    socket.emit('sync-request');
    addSystemMessage('⚠️ Connection issue detected, re-syncing...');
  }
}, 5000);
