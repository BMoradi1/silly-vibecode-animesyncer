#  ⚠⚠⚠THIS IS AI SLOP⚠⚠⚠
#  I REPEAT. THIS IS A PURPOSE GENERATED AI SLOP PROJECT FOR A USE CASE
#  FULLY AI GENERATED. LIKELY INSECURE. USE AT OWN RISK

A synchronized video streaming web application that allows multiple users to watch anime episodes together in real-time. Perfect for anime clubs, watch parties, or async viewing during the week!

## Features

- **Synchronized Playback**: All users watch the video in perfect sync when admin is online
- **Independent Watching**: Users can watch on their own when no admin is present
- **Admin Controls**: Admin can select videos, play, pause, seek, and toggle sync mode
- **Video Queue**: Build a playlist of videos to watch in order
- **User Registration & Login**: Track individual watch progress
- **Watch Progress Tracking**: Automatically saves how much of each video users have watched
- **Admin Reports**: View statistics by video or by user (sync vs async watches, completion %)
- **Real-time Chat**: Built-in chat to discuss the episode
- **User Management**: See who's watching with you
- **Video Upload**: Upload your own video files (auto-transcodes MKV/AVI to MP4)
- **Responsive Design**: Works on desktop and mobile browsers

## Requirements

- Debian-based Linux server (Ubuntu, Debian, etc.)
- Node.js 18+ and npm
- nginx (for reverse proxy)
- At least 2GB RAM recommended
- Storage space for video files

## Quick Installation (Debian Server)

1. Clone or download this repository to your Debian server:
```bash
git clone <your-repo-url>
cd anime-syncer
```

2. Make the installation script executable:
```bash
chmod +x install.sh
```

3. Run the installation script as root:
```bash
sudo ./install.sh
```

4. Update nginx configuration with your domain:
```bash
sudo nano /etc/nginx/sites-available/anime-syncer
# Change 'your-domain.com' to your actual domain or server IP
sudo systemctl restart nginx
```

5. Access the application:
- Admin panel: `http://your-server-ip/admin`
- Client view: `http://your-server-ip/`

## Manual Installation

If you prefer to install manually:

### 1. Install Node.js and npm
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt-get install -y nodejs
```

### 2. Install nginx
```bash
sudo apt-get install -y nginx
```

### 3. Install application
```bash
# Copy files to /var/www/anime-syncer
sudo mkdir -p /var/www/anime-syncer
sudo cp -r ./* /var/www/anime-syncer/
cd /var/www/anime-syncer

# Install dependencies
npm install --production

# Create uploads directory
mkdir -p uploads
sudo chown -R www-data:www-data /var/www/anime-syncer
```

### 4. Setup systemd service
```bash
sudo cp anime-syncer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable anime-syncer
sudo systemctl start anime-syncer
```

### 5. Configure nginx
```bash
sudo cp nginx.conf /etc/nginx/sites-available/anime-syncer
sudo ln -s /etc/nginx/sites-available/anime-syncer /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## Local Development

For testing locally:

```bash
# Install dependencies
npm install

# Start the server
npm start
```

Then open:
- Admin: `http://localhost:3000/admin`
- Client: `http://localhost:3000/`

## Usage

### For Admin:

1. Go to `http://your-server/admin`
2. Upload a video file or select from existing videos
3. Use the playback controls to play, pause, or seek
4. The video will automatically sync to all connected clients
5. Use the sync toggle to allow/disallow independent watching
6. Add videos to the queue for continuous playback
7. View reports at `http://your-server/reports` (admin-only)

### For Users:

1. Go to `http://your-server/`
2. Register/login at `http://your-server/login` to track your watch progress
3. Enter a nickname for chat
4. **When admin is online**: Watch synced with everyone else
5. **When no admin is online**: Select any video and watch independently
6. Your watch progress is automatically saved (if logged in)

## Configuration

### Change Port

Edit the systemd service file:
```bash
sudo nano /etc/systemd/system/anime-syncer.service
```

Change `Environment=PORT=3000` to your desired port, then:
```bash
sudo systemctl daemon-reload
sudo systemctl restart anime-syncer
```

### Video Upload Size Limit

Edit nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/anime-syncer
```

Change `client_max_body_size 2G;` to your desired limit.

### SSL/HTTPS Setup (Recommended)

Install certbot for Let's Encrypt:
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Management Commands

```bash
# View logs
sudo journalctl -u anime-syncer -f

# Restart service
sudo systemctl restart anime-syncer

# Stop service
sudo systemctl stop anime-syncer

# Check status
sudo systemctl status anime-syncer

# Restart nginx
sudo systemctl restart nginx
```

## Troubleshooting

### Service won't start
```bash
sudo journalctl -u anime-syncer -n 50
```

### Port already in use
Change the port in `/etc/systemd/system/anime-syncer.service` and restart.

### Upload fails
- Check disk space: `df -h`
- Check permissions: `ls -la /var/www/anime-syncer/uploads`
- Check nginx upload limit in `/etc/nginx/sites-available/anime-syncer`

### Video won't play
- Ensure video format is supported (MP4, WebM recommended)
- Check browser console for errors
- Verify video file permissions

## Security Considerations

- User registration is available but not required to watch
- Admin panel has no password - anyone who accesses `/admin` becomes admin
- Reports are restricted to admin-only access
- Use HTTPS in production (certbot/Let's Encrypt)
- Restrict upload access if needed
- Keep Node.js and dependencies updated

## Supported Video Formats

- MP4 (recommended)
- WebM (recommended)
- MKV (may need conversion)
- AVI (may need conversion)

For best compatibility, use H.264/AAC encoded MP4 files.

## License

MIT License - feel free to use and modify!

## Credits

Built with:
- Node.js & Express
- Socket.IO for WebSocket communication
- SQLite (better-sqlite3) for database
- bcrypt for password hashing
- FFmpeg for video transcoding
- Vanilla JavaScript (no frameworks!)
