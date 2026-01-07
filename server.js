const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

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
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5GB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|mkv|avi|webm|mov/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      return cb(null, true);
    } else {
      cb(new Error('Videos only (mp4, mkv, avi, webm, mov)'));
    }
  }
});

// Transcode video to MP4
function transcodeVideo(inputPath, outputPath, socketId, originalName) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        '-c:a aac',
        '-b:a 128k',
        '-movflags +faststart'
      ])
      .output(outputPath)
      .on('start', (cmd) => {
        console.log('FFmpeg started:', cmd);
        io.to(socketId).emit('transcode-started', { filename: originalName });
      })
      .on('progress', (progress) => {
        const percent = progress.percent || 0;
        console.log(`Transcoding ${originalName}: ${percent.toFixed(1)}%`);
        io.to(socketId).emit('transcode-progress', {
          filename: originalName,
          percent: percent.toFixed(1)
        });
      })
      .on('end', () => {
        console.log('Transcoding finished:', outputPath);
        // Delete original file if it was transcoded
        if (inputPath !== outputPath) {
          fs.unlink(inputPath, (err) => {
            if (err) console.error('Error deleting original:', err);
          });
        }
        io.to(socketId).emit('transcode-complete', { filename: originalName });
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        io.to(socketId).emit('transcode-error', {
          filename: originalName,
          error: err.message
        });
        reject(err);
      });

    command.run();
  });
}

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

// Watch queue (playlist)
let watchQueue = [];
let queueIdCounter = 0;

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const ext = path.extname(req.file.filename).toLowerCase();
    const needsTranscoding = ['.mkv', '.avi', '.mov'].includes(ext);
    const socketId = req.body.socketId || adminSocketId;

    let finalPath = req.file.path;
    let finalFilename = req.file.filename;

    if (needsTranscoding) {
      // Transcode to MP4
      const outputFilename = req.file.filename.replace(ext, '.mp4');
      const outputPath = path.join(uploadsDir, outputFilename);

      res.json({
        success: true,
        transcoding: true,
        message: 'Video is being transcoded to MP4...'
      });

      // Transcode in background
      transcodeVideo(req.file.path, outputPath, socketId, req.file.originalname)
        .then(() => {
          currentVideo = {
            filename: outputFilename,
            originalname: req.file.originalname.replace(ext, '.mp4'),
            path: `/uploads/${outputFilename}`
          };
          io.emit('video-changed', currentVideo);
        })
        .catch(err => {
          console.error('Transcoding failed:', err);
        });
    } else {
      // No transcoding needed
      currentVideo = {
        filename: req.file.filename,
        originalname: req.file.originalname,
        path: `/uploads/${req.file.filename}`
      };
      io.emit('video-changed', currentVideo);
      res.json({ success: true, video: currentVideo, transcoding: false });
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
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

// Queue endpoints
app.get('/queue', (req, res) => {
  res.json({ queue: watchQueue });
});

app.post('/queue/add', (req, res) => {
  const { video } = req.body;
  if (!video || !video.filename) {
    return res.status(400).json({ error: 'Video required' });
  }

  const queueItem = {
    id: ++queueIdCounter,
    ...video,
    addedAt: Date.now()
  };

  watchQueue.push(queueItem);
  io.emit('queue-updated', watchQueue);
  res.json({ success: true, queue: watchQueue });
});

app.post('/queue/remove', (req, res) => {
  const { id } = req.body;
  watchQueue = watchQueue.filter(item => item.id !== id);
  io.emit('queue-updated', watchQueue);
  res.json({ success: true, queue: watchQueue });
});

app.post('/queue/reorder', (req, res) => {
  const { queue } = req.body;
  if (!Array.isArray(queue)) {
    return res.status(400).json({ error: 'Queue must be an array' });
  }
  watchQueue = queue;
  io.emit('queue-updated', watchQueue);
  res.json({ success: true, queue: watchQueue });
});

app.post('/queue/clear', (req, res) => {
  watchQueue = [];
  io.emit('queue-updated', watchQueue);
  res.json({ success: true, queue: watchQueue });
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
    socket.emit('queue-updated', watchQueue);
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

  socket.on('state-update', (data) => {
    if (socket.id === adminSocketId) {
      videoState.currentTime = data.currentTime;
      videoState.playing = data.playing;
      videoState.timestamp = Date.now();
    }
  });

  // Queue management
  socket.on('queue-add', (data) => {
    if (socket.id === adminSocketId) {
      const queueItem = {
        id: ++queueIdCounter,
        ...data.video,
        addedAt: Date.now()
      };
      watchQueue.push(queueItem);
      io.emit('queue-updated', watchQueue);
    }
  });

  socket.on('queue-remove', (data) => {
    if (socket.id === adminSocketId) {
      watchQueue = watchQueue.filter(item => item.id !== data.id);
      io.emit('queue-updated', watchQueue);
    }
  });

  socket.on('queue-clear', () => {
    if (socket.id === adminSocketId) {
      watchQueue = [];
      io.emit('queue-updated', watchQueue);
    }
  });

  socket.on('play-next', () => {
    if (socket.id === adminSocketId && watchQueue.length > 0) {
      const nextVideo = watchQueue.shift();
      currentVideo = {
        filename: nextVideo.filename,
        originalname: nextVideo.originalname || nextVideo.filename,
        path: nextVideo.path
      };
      videoState = {
        playing: true,
        currentTime: 0,
        timestamp: Date.now()
      };
      io.emit('video-changed', currentVideo);
      io.emit('play', videoState);
      io.emit('queue-updated', watchQueue);
    }
  });

  socket.on('video-ended', () => {
    if (socket.id === adminSocketId) {
      // Auto-advance to next video in queue
      if (watchQueue.length > 0) {
        const nextVideo = watchQueue.shift();
        currentVideo = {
          filename: nextVideo.filename,
          originalname: nextVideo.originalname || nextVideo.filename,
          path: nextVideo.path
        };
        videoState = {
          playing: true,
          currentTime: 0,
          timestamp: Date.now()
        };
        io.emit('video-changed', currentVideo);
        io.emit('play', videoState);
        io.emit('queue-updated', watchQueue);
      } else {
        videoState.playing = false;
        io.emit('pause', videoState);
      }
    }
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

// Moderate sync broadcast to all clients - balanced synchronization
setInterval(() => {
  if (currentVideo && adminSocketId) {
    io.emit('sync-state', videoState);
  }
}, 2000);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`Client view: http://localhost:${PORT}/`);
});
