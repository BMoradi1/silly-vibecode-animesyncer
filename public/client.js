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
const videoListSection = document.getElementById('videoListSection');
const videoListClient = document.getElementById('videoListClient');
const syncStatus = document.getElementById('syncStatus');

let isSeeking = false;
let nickname = localStorage.getItem('nickname') || `User${Math.floor(Math.random() * 1000)}`;
let lastSyncTime = Date.now();
let syncEnabled = true; // Track if sync mode is enabled
let adminOnline = false; // Track if admin is online

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

// Watch progress tracking
let currentVideoFilename = null;

// Video changed
socket.on('video-changed', (video) => {
  if (video) {
    videoPlayer.src = video.path;
    videoPlayer.classList.add('active');
    noVideoDiv.style.display = 'none';
    videoTitle.textContent = video.originalname || video.filename;
    currentVideoFilename = video.filename; // Track for watch progress
    addSystemMessage(`New video loaded: ${video.originalname || video.filename}`);
  }
});

// Sync state
socket.on('sync-state', (state) => {
  if (!videoPlayer.src || !syncEnabled || !adminOnline) return; // Only sync when enabled and admin online

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
  if (!videoPlayer.src || !syncEnabled || !adminOnline) return;
  const timeDiff = (Date.now() - state.timestamp) / 1000;
  const expectedTime = state.currentTime + timeDiff;

  isSeeking = true;
  videoPlayer.currentTime = expectedTime;
  videoPlayer.play().catch(e => console.log('Play failed:', e));
  setTimeout(() => isSeeking = false, 1000);
});

// Pause command
socket.on('pause', (state) => {
  if (!videoPlayer.src || !syncEnabled || !adminOnline) return;
  isSeeking = true;
  videoPlayer.currentTime = state.currentTime;
  videoPlayer.pause();
  setTimeout(() => isSeeking = false, 1000);
});

// Seek command
socket.on('seek', (data) => {
  if (!videoPlayer.src || !syncEnabled || !adminOnline) return;
  isSeeking = true;
  videoPlayer.currentTime = data.time;
  setTimeout(() => isSeeking = false, 1000);
});

// Load video list for independent watching
function loadVideoList() {
  fetch('/videos')
    .then(response => response.json())
    .then(data => {
      videoListClient.innerHTML = '';
      if (data.videos.length === 0) {
        videoListClient.innerHTML = '<p style="color: #999; padding: 10px;">No videos available</p>';
        return;
      }
      data.videos.forEach(video => {
        const videoItem = document.createElement('div');
        videoItem.className = 'video-item-client';
        videoItem.textContent = video.filename;
        videoItem.addEventListener('click', () => {
          selectVideoIndependently(video);
        });
        videoListClient.appendChild(videoItem);
      });
    })
    .catch(error => {
      console.error('Error loading videos:', error);
    });
}

// Select video independently (when sync is disabled)
function selectVideoIndependently(video) {
  videoPlayer.src = video.path;
  videoPlayer.classList.add('active');
  noVideoDiv.style.display = 'none';
  videoTitle.textContent = video.filename;
  currentVideoFilename = video.filename;
  addSystemMessage(`Now watching: ${video.filename}`);

  // Highlight selected video
  document.querySelectorAll('.video-item-client').forEach(item => {
    item.classList.remove('active');
    if (item.textContent === video.filename) {
      item.classList.add('active');
    }
  });
}

// Functions to toggle sync mode
function enableSyncMode() {
  syncEnabled = true;
  videoPlayer.removeAttribute('controls');
  videoPlayer.style.pointerEvents = 'none';
  syncIndicator.style.display = 'block';
  videoListSection.style.display = 'none';
  syncStatus.textContent = '🔒 Admin-controlled playback';
  addSystemMessage('🔒 Sync mode enabled - following admin playback');
}

function disableSyncMode() {
  syncEnabled = false;
  videoPlayer.setAttribute('controls', 'controls');
  videoPlayer.style.pointerEvents = 'auto';
  syncIndicator.style.display = 'none';
  videoListSection.style.display = 'block';
  syncStatus.textContent = '🔓 Independent playback';
  loadVideoList(); // Load video list for selection
  addSystemMessage('🔓 Independent mode - you can select and watch videos');
}

// Independent mode when no admin is online
function enableIndependentMode() {
  videoPlayer.setAttribute('controls', 'controls');
  videoPlayer.style.pointerEvents = 'auto';
  syncIndicator.style.display = 'none';
  videoListSection.style.display = 'block';
  syncStatus.textContent = '📺 No admin - Independent playback';
  loadVideoList();
}

// Initial state: start in independent mode, will sync when admin comes online
enableIndependentMode();
addSystemMessage('📺 Loading... checking for admin');

// Listen for sync mode changes (only apply if admin is online)
socket.on('sync-mode-changed', (data) => {
  syncEnabled = data.syncEnabled;
  if (!adminOnline) {
    // No admin - stay in independent mode regardless of sync setting
    return;
  }
  if (data.syncEnabled) {
    enableSyncMode();
  } else {
    disableSyncMode();
  }
});

// Prevent user from controlling video (only when sync is enabled AND admin is online)
videoPlayer.addEventListener('play', (e) => {
  if (syncEnabled && adminOnline && !isSeeking) {
    e.preventDefault();
    videoPlayer.pause();
    addSystemMessage('⚠️ Only the admin can control playback');
  }
});

videoPlayer.addEventListener('pause', (e) => {
  if (syncEnabled && adminOnline && !isSeeking && !videoPlayer.ended) {
    e.preventDefault();
    videoPlayer.play().catch(() => {});
    addSystemMessage('⚠️ Only the admin can control playback');
  }
});

videoPlayer.addEventListener('seeking', (e) => {
  if (syncEnabled && adminOnline && !isSeeking) {
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
  const wasAdminOnline = adminOnline;
  adminOnline = users.some(user => user.role === 'admin');

  users.forEach(user => {
    const userDiv = document.createElement('div');
    userDiv.className = `user-item ${user.role === 'admin' ? 'admin' : ''}`;
    userDiv.textContent = user.nickname + (user.role === 'admin' ? ' 👑' : '');
    usersListDiv.appendChild(userDiv);
  });

  // Auto-switch to independent mode when no admin is online
  if (!adminOnline && wasAdminOnline !== adminOnline) {
    enableIndependentMode();
    addSystemMessage('📺 No admin online - you can watch independently!');
  } else if (adminOnline && !wasAdminOnline && syncEnabled) {
    // Admin came online and sync is enabled, switch back to sync mode
    enableSyncMode();
    addSystemMessage('👑 Admin is online - synced playback enabled');
  }
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
  if (syncEnabled && adminOnline) {
    socket.emit('sync-request');
  }
}, 1000);

// Moderate sync checks - every 2 seconds for balanced synchronization
setInterval(() => {
  if (videoPlayer.src && syncEnabled && adminOnline) {
    socket.emit('sync-request');
  }
}, 2000);

// Sync watchdog - detect if sync stops
setInterval(() => {
  if (!syncEnabled || !adminOnline) return; // Skip watchdog when sync disabled or no admin

  const timeSinceLastSync = Date.now() - lastSyncTime;
  if (videoPlayer.src && timeSinceLastSync > 10000) {
    console.warn('Sync timeout - forcing re-sync');
    socket.emit('sync-request');
    addSystemMessage('⚠️ Connection issue detected, re-syncing...');
  }
}, 5000);

// Save watch progress every 30 seconds
setInterval(() => {
  if (videoPlayer.src && currentVideoFilename && videoPlayer.duration) {
    const watchPercentage = (videoPlayer.currentTime / videoPlayer.duration) * 100;
    const isSyncSession = syncEnabled;

    fetch('/watch-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoFilename: currentVideoFilename,
        watchPercentage: Math.round(watchPercentage),
        isSyncSession
      })
    }).catch(err => {
      // Silently fail - user might not be logged in
      console.log('Watch progress not saved (user not logged in?)');
    });
  }
}, 30000);

// Save progress when video ends
videoPlayer.addEventListener('ended', () => {
  if (currentVideoFilename) {
    fetch('/watch-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoFilename: currentVideoFilename,
        watchPercentage: 100,
        isSyncSession: syncEnabled
      })
    }).catch(err => {
      console.log('Watch progress not saved (user not logged in?)');
    });
  }
});
