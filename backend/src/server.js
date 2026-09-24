import 'dotenv/config';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { connectDatabase } from './db/connection.js';
import apiRouter, { setWssInstance, broadcastShipmentUpdate } from './routes/api.js';
import { startSimulationEngine } from './services/simulationEngine.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend client port (React default 5173 or preview 4173)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Main REST API Router
app.use('/api', apiRouter);

// Basic health check
app.get('/', (req, res) => {
  res.json({ message: 'TXL Express Logistics Portal Server running successfully.' });
});

// Construct HTTP Server
const server = http.createServer(app);

// Mount WebSocket Server
const wss = new WebSocketServer({ server });

// Bind WebSocket to API router broadcast functions
setWssInstance(wss);

wss.on('connection', (ws) => {
  console.log('New WebSocket Client connected.');

  // Handle incoming checks
  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
      }
    } catch (e) {
      console.warn('Invalid socket message parsed:', message.toString());
    }
  });

  ws.on('close', () => {
    console.log('WebSocket Client disconnected.');
  });
});

// Initialize Database connection then launch Listening Server
async function initializeServer() {
  await connectDatabase();
  
  // Launch autonomous 24/7 background simulation engine
  startSimulationEngine(broadcastShipmentUpdate);
  
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is occupied by another process. Freeing port...`);
      process.exit(1);
    } else {
      console.error('Server error:', e);
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(`TXL Express Logistics Portal Backend running at port ${PORT}`);
    console.log(`WebSocket server connected at ws://localhost:${PORT}`);
    console.log(`REST APIs available at http://localhost:${PORT}/api`);
    console.log(`===============================================`);
  });
}

initializeServer().catch(err => {
  console.error('Fatal: Server startup crashed', err);
  process.exit(1);
});
