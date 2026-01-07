const socket = io();

const videoPlayer = document.getElementById('videoPlayer');
const noVideoDiv = document.getElementById('noVideo');
const videoTitle = document.getElementById('videoTitle');
const videoFile = document.getElementById('videoFile');
const uploadBtn = document.getElementById('uploadBtn');
const uploadProgress = document.getElementById('uploadProgress');
const videoList = document.getElementById('videoList');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const syncBtn = document.getElementById('syncBtn');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessage');
const userCountSpan = document.getElementById('userCount');
const usersListDiv = document.getElementById('usersList');

let isAdmin = false;
let currentVideoState = {
  playing: false,
  currentTime: 0
};

// Register as admin
socket.emit('register-admin');

socket.on('admin-registered', () => {
  isAdmin = true;
  addSystemMessage('✅ You are now the admin');
  loadVideoList();
  loadCurrentVideo();
});

// Upload video
uploadBtn.addEventListener('click', () => {
  const file = videoFile.files[0];
  if (!file) {
    alert('Please select a video file');
    return;
  }

  const formData = new FormData();
  formData.append('video', file);

  uploadProgress.textContent = 'Uploading...';

  fetch('/upload', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      uploadProgress.textContent = '✅ Upload successful!';
      videoFile.value = '';
      loadVideoList();
      setTimeout(() => uploadProgress.textContent = '', 3000);
    } else {
      uploadProgress.textContent = '❌ Upload failed';
    }
  })
  .catch(error => {
    uploadProgress.textContent = '❌ Upload error: ' + error.message;
  });
});

// Load video list
function loadVideoList() {
  fetch('/videos')
    .then(response => response.json())
    .then(data => {
      videoList.innerHTML = '';
      if (data.videos.length === 0) {
        videoList.innerHTML = '<p style="color: #999;">No videos uploaded yet</p>';
        return;
      }
      data.videos.forEach(video => {
        const videoItem = document.createElement('div');
        videoItem.className = 'video-item';
        videoItem.textContent = video.filename;
        videoItem.addEventListener('click', () => selectVideo(video));
        videoList.appendChild(videoItem);
      });
    });
}

// Load current video
function loadCurrentVideo() {
  fetch('/current-video')
    .then(response => response.json())
    .then(data => {
      if (data.video) {
        loadVideo(data.video);
      }
    });
}

// Select video
function selectVideo(video) {
  socket.emit('set-video', { video });
  loadVideo(video);

  // Update active state in list
  document.querySelectorAll('.video-item').forEach(item => {
    item.classList.remove('active');
    if (item.textContent === video.filename) {
      item.classList.add('active');
    }
  });
}

// Load video
function loadVideo(video) {
  videoPlayer.src = video.path;
  videoPlayer.classList.add('active');
  noVideoDiv.style.display = 'none';
  videoTitle.textContent = video.originalname || video.filename;
  currentVideoState = {
    playing: false,
    currentTime: 0
  };
}

// Video changed
socket.on('video-changed', (video) => {
  if (video) {
    loadVideo(video);
    addSystemMessage(`Video changed: ${video.originalname || video.filename}`);
  }
});

// Playback controls
playBtn.addEventListener('click', () => {
  if (!videoPlayer.src) {
    alert('Please select a video first');
    return;
  }
  currentVideoState.playing = true;
  currentVideoState.currentTime = videoPlayer.currentTime;
  socket.emit('play');
  videoPlayer.play();
});

pauseBtn.addEventListener('click', () => {
  if (!videoPlayer.src) return;
  currentVideoState.playing = false;
  currentVideoState.currentTime = videoPlayer.currentTime;
  socket.emit('pause');
  videoPlayer.pause();
});

syncBtn.addEventListener('click', () => {
  if (!videoPlayer.src) return;
  currentVideoState.currentTime = videoPlayer.currentTime;
  currentVideoState.playing = !videoPlayer.paused;
  socket.emit('seek', { time: videoPlayer.currentTime });
  addSystemMessage('🔄 Forced sync to all clients');
});

// Track video state changes
videoPlayer.addEventListener('play', () => {
  if (isAdmin) {
    currentVideoState.playing = true;
    currentVideoState.currentTime = videoPlayer.currentTime;
    socket.emit('play');
  }
});

videoPlayer.addEventListener('pause', () => {
  if (isAdmin && !videoPlayer.ended) {
    currentVideoState.playing = false;
    currentVideoState.currentTime = videoPlayer.currentTime;
    socket.emit('pause');
  }
});

videoPlayer.addEventListener('seeked', () => {
  if (isAdmin) {
    currentVideoState.currentTime = videoPlayer.currentTime;
    socket.emit('seek', { time: videoPlayer.currentTime });
  }
});

// Update current time periodically
setInterval(() => {
  if (isAdmin && videoPlayer.src && !videoPlayer.paused) {
    currentVideoState.currentTime = videoPlayer.currentTime;
  }
}, 1000);

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
