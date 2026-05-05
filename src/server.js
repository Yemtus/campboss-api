import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust Railway proxy
app.set('trust proxy', 1);

// Security
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(limiter);

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('dev'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Camp Boss API is running',
    timestamp: new Date(),
    db_url_set: !!process.env.DATABASE_URL,
    termii_set: !!process.env.TERMII_API_KEY,
    phones_set: !!process.env.ALERT_PHONE_NUMBERS,
    node_env: process.env.NODE_ENV,
  });
});

// Routes
import authRouter from './modules/auth/auth.routes.js';
import usersRouter from './modules/users/users.routes.js';
import haccpRouter from './modules/haccp/haccp.routes.js';
import inventoryRouter from './modules/inventory/inventory.routes.js';
import receivingRouter from './modules/receiving/receiving.routes.js';
import cleaningRouter from './modules/cleaning/cleaning.routes.js';
import handoverRouter from './modules/handover/handover.routes.js';
import inspectionsRouter from './modules/inspections/inspections.routes.js';
import attendanceRouter from './modules/attendance/attendance.routes.js';
import budgetRouter from './modules/budget/budget.routes.js';
import notificationsRouter from './modules/notifications/notifications.routes.js';
import settingsRouter from './modules/settings/settings.routes.js';
import auditRouter from './modules/audit/audit.routes.js';
import adminRouter from './modules/admin/admin.routes.js';
import financeRouter from './modules/finance/finance.routes.js';
import ratingsRouter from './modules/ratings/ratings.routes.js';
import equipmentRouter from './modules/equipment/equipment.routes.js';
import leadsRouter from './modules/leads/leads.routes.js';

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/haccp', haccpRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/receiving', receivingRouter);
app.use('/api/cleaning', cleaningRouter);
app.use('/api/handover', handoverRouter);
app.use('/api/inspections', inspectionsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/budget', budgetRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/admin', adminRouter);
app.use('/api/finance', financeRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/equipment', equipmentRouter);
app.use('/api/leads', leadsRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`✅ Camp Boss API running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});