import express from 'express';
import cors from 'cors';
import path from 'path';
import ordersRouter from './routes/orders';
import { DbService } from './services/db.service';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/orders', ordersRouter);

// Serve Admin Dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.resolve('public/admin.html'));
});

app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  await DbService.initialize();
  app.listen(PORT, () => {
    console.log(`Cavali Backend running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start Cavali backend server:', err);
});
