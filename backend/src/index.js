require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');
const sitRepsRoutes = require('./routes/situationalReports');
const usersRoutes = require('./routes/users');
const notificationsRoutes = require('./routes/notifications');
const reportsRoutes = require('./routes/reports');
const signalsRoutes = require('./routes/signals');
const deploymentsRoutes = require('./routes/deployments');
const activityLogsRoutes = require('./routes/activityLogs');
const lguSubmissionsRoutes = require('./routes/lguSubmissions');
const { seedAdmin } = require('./seed');

const app = express();
const httpServer = http.createServer(app);

// --- Socket.io for real-time updates ---
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Ensure uploads dir exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // Sanitize filename: replace spaces and unsafe chars with underscores
    const sanitized = file.originalname
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._\-]/g, '_');
    cb(null, Date.now() + '-' + sanitized);
  }
});
const upload = multer({ storage });

// Make io accessible in routes via app.locals
app.locals.io = io;

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(uploadDir));
app.use('/api/uploads', express.static(uploadDir));

// POST /upload
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `${process.env.VITE_API_URL || 'http://localhost:4000'}/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

// --- Routes ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/situational-reports', sitRepsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/lgu-submissions', lguSubmissionsRoutes);
app.use('/api/signals', signalsRoutes);
app.use('/api/deployments', deploymentsRoutes);
app.use('/api/activity-logs', activityLogsRoutes);

// --- Error Handler ---
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// --- Start ---
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, async () => {
  console.log(`[PROACT API] Running on port ${PORT}`);
  await seedAdmin();
});
