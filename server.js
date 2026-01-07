const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|mkv|avi|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: Videos only (mp4, mkv, avi, webm)');
    }
  }
});

// Serve static files
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.json());

// State management
let adminSocketId = null;
let currentVideo = null;
let videoState = {
  playing: false,
  currentTime: 0,
  timestamp: Date.now()
};
let users = new Map();

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  currentVideo = {
    filename: req.file.filename,
    originalname: req.file.originalname,
    path: `/uploads/${req.file.filename}`
  };
  // Notify all clients about new video
  io.emit('video-changed', currentVideo);
  res.json({ success: true, video: currentVideo });
});

app.get('/current-video', (req, res) => {
  res.json({ video: currentVideo, state: videoState });
});

app.get('/videos', (req, res) => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to list videos' });
    }
    const videos = files.map(file => ({
      filename: file,
      path: `/uploads/${file}`
    }));
    res.json({ videos });
  });
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('register-admin', () => {
    adminSocketId = socket.id;
    socket.emit('admin-registered');
    users.set(socket.id, { id: socket.id, role: 'admin', nickname: 'Admin' });
    io.emit('user-list', Array.from(users.values()));
    console.log('Admin registered:', socket.id);
  });

  socket.on('register-user', (data) => {
    const nickname = data?.nickname || `User${Math.floor(Math.random() * 1000)}`;
    users.set(socket.id, { id: socket.id, role: 'user', nickname });
    io.emit('user-list', Array.from(users.values()));

    // Send current state to new user
    if (currentVideo) {
      socket.emit('video-changed', currentVideo);
      socket.emit('sync-state', videoState);
    }
  });

  // Admin controls
  socket.on('play', () => {
    if (socket.id === adminSocketId) {
      videoState.playing = true;
      videoState.timestamp = Date.now();
      io.emit('play', videoState);
    }
  });

  socket.on('pause', () => {
    if (socket.id === adminSocketId) {
      videoState.playing = false;
      videoState.timestamp = Date.now();
      io.emit('pause', videoState);
    }
  });

  socket.on('seek', (data) => {
    if (socket.id === adminSocketId) {
      videoState.currentTime = data.time;
      videoState.timestamp = Date.now();
      io.emit('seek', { time: data.time, state: videoState });
    }
  });

  socket.on('set-video', (data) => {
    if (socket.id === adminSocketId) {
      currentVideo = data.video;
      videoState = {
        playing: false,
        currentTime: 0,
        timestamp: Date.now()
      };
      io.emit('video-changed', currentVideo);
    }
  });

  socket.on('sync-request', () => {
    socket.emit('sync-state', videoState);
  });

  // Chat
  socket.on('chat-message', (data) => {
    const user = users.get(socket.id);
    const nickname = user ? user.nickname : 'Anonymous';
    io.emit('chat-message', {
      nickname,
      message: data.message,
      timestamp: Date.now()
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.id === adminSocketId) {
      adminSocketId = null;
      console.log('Admin disconnected');
    }
    users.delete(socket.id);
    io.emit('user-list', Array.from(users.values()));
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`Client view: http://localhost:${PORT}/`);
});
