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
const queueList = document.getElementById('queueList');
const emptyQueue = document.getElementById('emptyQueue');
const playNextBtn = document.getElementById('playNextBtn');
const clearQueueBtn = document.getElementById('clearQueueBtn');

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
  formData.append('socketId', socket.id);

  uploadProgress.innerHTML = '<div style="color: #667eea;">📤 Uploading...</div>';

  fetch('/upload', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      if (data.transcoding) {
        uploadProgress.innerHTML = '<div style="color: #f093fb;">🔄 Transcoding to MP4...</div>';
        addSystemMessage('🔄 Video is being transcoded to MP4 format...');
      } else {
        uploadProgress.innerHTML = '<div style="color: #4facfe;">✅ Upload successful!</div>';
        videoFile.value = '';
        loadVideoList();
        setTimeout(() => uploadProgress.innerHTML = '', 3000);
      }
    } else {
      uploadProgress.innerHTML = '<div style="color: #ff6b6b;">❌ Upload failed</div>';
    }
  })
  .catch(error => {
    uploadProgress.innerHTML = '<div style="color: #ff6b6b;">❌ ' + error.message + '</div>';
  });
});

// Transcoding events
socket.on('transcode-started', (data) => {
  uploadProgress.innerHTML = `<div style="color: #f093fb;">🔄 Transcoding ${data.filename}...</div>`;
  addSystemMessage(`🔄 Started transcoding: ${data.filename}`);
});

socket.on('transcode-progress', (data) => {
  uploadProgress.innerHTML = `
    <div style="color: #f093fb;">🔄 Transcoding: ${data.percent}%</div>
    <div style="background: #f0f0f0; height: 8px; border-radius: 4px; margin-top: 5px; overflow: hidden;">
      <div style="background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: ${data.percent}%; transition: width 0.3s;"></div>
    </div>
  `;
});

socket.on('transcode-complete', (data) => {
  uploadProgress.innerHTML = '<div style="color: #4facfe;">✅ Transcoding complete!</div>';
  addSystemMessage(`✅ Transcoding complete: ${data.filename}`);
  videoFile.value = '';
  loadVideoList();
  setTimeout(() => uploadProgress.innerHTML = '', 3000);
});

socket.on('transcode-error', (data) => {
  uploadProgress.innerHTML = `<div style="color: #ff6b6b;">❌ Transcoding failed: ${data.error}</div>`;
  addSystemMessage(`❌ Transcoding error: ${data.error}`);
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

        const nameSpan = document.createElement('span');
        nameSpan.textContent = video.filename;
        nameSpan.style.flex = '1';
        nameSpan.style.cursor = 'pointer';
        nameSpan.addEventListener('click', () => selectVideo(video));

        const queueBtn = document.createElement('button');
        queueBtn.textContent = '+';
        queueBtn.className = 'queue-add-btn';
        queueBtn.title = 'Add to queue';
        queueBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          addToQueue(video);
        });

        videoItem.appendChild(nameSpan);
        videoItem.appendChild(queueBtn);
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

// Queue management
function addToQueue(video) {
  socket.emit('queue-add', { video });
  addSystemMessage(`➕ Added to queue: ${video.filename}`);
}

function updateQueueDisplay(queue) {
  if (queue.length === 0) {
    queueList.style.display = 'none';
    emptyQueue.style.display = 'block';
  } else {
    queueList.style.display = 'block';
    emptyQueue.style.display = 'none';
    queueList.innerHTML = '';

    queue.forEach((item, index) => {
      const queueItem = document.createElement('div');
      queueItem.className = 'queue-item';

      const position = document.createElement('span');
      position.className = 'queue-position';
      position.textContent = `#${index + 1}`;

      const name = document.createElement('span');
      name.className = 'queue-name';
      name.textContent = item.originalname || item.filename;

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.className = 'queue-remove-btn';
      removeBtn.title = 'Remove from queue';
      removeBtn.addEventListener('click', () => {
        socket.emit('queue-remove', { id: item.id });
      });

      queueItem.appendChild(position);
      queueItem.appendChild(name);
      queueItem.appendChild(removeBtn);
      queueList.appendChild(queueItem);
    });
  }
}

socket.on('queue-updated', (queue) => {
  updateQueueDisplay(queue);
});

playNextBtn.addEventListener('click', () => {
  socket.emit('play-next');
});

clearQueueBtn.addEventListener('click', () => {
  if (confirm('Clear the entire queue?')) {
    socket.emit('queue-clear');
  }
});

// Handle video ended event for auto-advance
videoPlayer.addEventListener('ended', () => {
  if (isAdmin) {
    socket.emit('video-ended');
  }
});
