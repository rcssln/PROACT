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
const settingsRoutes = require('./routes/settings');
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
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(uploadDir));
app.use('/api/uploads', express.static(uploadDir));

// POST /upload
const uploadHandler = (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  // Force HTTPS for production links to avoid Mixed Content errors
  let baseUrl = process.env.VITE_API_URL ? process.env.VITE_API_URL.replace(/\/api$/, '') : '';
  
  if (!baseUrl) {
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    baseUrl = `${protocol}://${host}`;
  } else {
    // Only force https if not on localhost
    const host = req.get('host') || '';
    if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
      baseUrl = baseUrl.replace(/^http:/, 'https');
    }
  }
  
  const url = `${baseUrl}/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
};
app.post('/api/upload', upload.single('file'), uploadHandler);
app.post('/upload', upload.single('file'), uploadHandler);

// --- Routes ---
// Legacy/Redundant routes to handle stripped /api prefix in some production environments
app.get('/health', (req, res) => res.json({ status: 'ok', msg: 'Non-prefixed health check' }));
app.get('/test-route', (req, res) => res.json({ message: 'API is reachable (non-prefixed)' }));

// Standard /api routes
app.get('/api/health', (req, res) => res.json({ status: 'ok', msg: 'Prefixed health check' }));
app.get('/api/test-route', (req, res) => res.json({ message: 'API is reachable (prefixed)' }));

// Standard API Routes
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
app.use('/api/settings', settingsRoutes);

// Backup Routes (non-prefixed)
app.use('/auth', authRoutes);
app.use('/events', eventsRoutes);
app.use('/situational-reports', sitRepsRoutes);
app.use('/users', usersRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/reports', reportsRoutes);
app.use('/lgu-submissions', lguSubmissionsRoutes);
app.use('/signals', signalsRoutes);
app.use('/deployments', deploymentsRoutes);
app.use('/activity-logs', activityLogsRoutes);
app.use('/settings', settingsRoutes);

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
