import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import rsvpRoutes from './routes/rsvpRoutes';
import { errorHandler } from './middleware/errorHandler';
import { initializeDatabase } from './config/init-db';
import { connectRedis } from './config/redis';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3013;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP',
});


app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], 
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.NODE_ENV === 'production' 
        ? 'https://domain.com' 
        : 'http://localhost:3030'],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  frameguard: { action: 'deny' }, 
  crossOriginEmbedderPolicy: false, 
  crossOriginResourcePolicy: { policy: "cross-origin" }, 
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://domain.com'
    : 'http://localhost:3030',
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(limiter);

app.use('/api', rsvpRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

const startServer = async () => {
  try {
    await initializeDatabase();
    await connectRedis();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
