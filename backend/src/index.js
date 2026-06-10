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
// Legacy/Redundant routes to handle stripped /api prefix in some production environments
app.get('/health', (req, res) => res.json({ status: 'ok', msg: 'Non-prefixed health check' }));
app.get('/test-route', (req, res) => res.json({ message: 'API is reachable (non-prefixed)' }));

// Standard /api routes
app.get('/api/health', (req, res) => res.json({ status: 'ok', msg: 'Prefixed health check' }));
app.get('/api/test-route', (req, res) => res.json({ message: 'API is reachable (prefixed)' }));

// Apply routes to BOTH prefixed and non-prefixed paths for maximum compatibility
const routeModules = [
  { path: 'auth', router: authRoutes },
  { path: 'events', router: eventsRoutes },
  { path: 'situational-reports', router: sitRepsRoutes },
  { path: 'users', router: usersRoutes },
  { path: 'notifications', router: notificationsRoutes },
  { path: 'reports', router: reportsRoutes },
  { path: 'lgu-submissions', router: lguSubmissionsRoutes },
  { path: 'signals', router: signalsRoutes },
  { path: 'deployments', router: deploymentsRoutes },
  { path: 'activity-logs', router: activityLogsRoutes },
  { path: 'settings', router: settingsRoutes }
];

routeModules.forEach(m => {
  app.use(`/${m.path}`, m.router);      // backup: /auth/login
  app.use(`/api/${m.path}`, m.router);  // standard: /api/auth/login
});

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
