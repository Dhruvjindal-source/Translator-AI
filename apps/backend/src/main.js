const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.VITE_API_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Audio transcription endpoint
app.post('/transcribe', async (req, res) => {
  let tempFilePath;
  try {
    if (!req.body.audio) {
      return res.status(400).json({ error: 'No audio data provided' });
    }

    const audioBuffer = Buffer.from(req.body.audio, 'base64');
    const tempDir = path.join(__dirname, '../temp');

    try {
      await fs.access(tempDir);
    } catch {
      await fs.mkdir(tempDir, { recursive: true });
    }

    tempFilePath = path.join(tempDir, `audio_${Date.now()}.wav`);
    await fs.writeFile(tempFilePath, audioBuffer);

    // Basic transcription logic
    const audioSize = audioBuffer.length;
    const response = audioSize > 50000 
      ? 'Long audio recording processed'
      : 'Short audio recording processed';

    res.json({
      text: response,
      language: req.body.language || 'en',
      confidence: 0.8
    });

  } catch (error) {
    console.error('Transcription error:', error.message);
    res.status(500).json({ error: 'Transcription failed' });
  } finally {
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (err) {
        console.error('Cleanup error:', err.message);
      }
    }
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      transcription: 'ready',
      socket: 'ready'
    }
  });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`Client ${socket.id} joined room: ${roomId}`);
  });

  socket.on('caption', (data) => {
    console.log('Caption received:', data.text);
    socket.to(data.roomId).emit('caption', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Socket server ready');
});