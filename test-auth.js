// Simple authentication test without queues
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Import auth routes (compiled)
const authRoutes = require('./dist/routes/auth.js').default;

// Routes  
app.use('/auth', authRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Auth test server running' });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Auth Test Server running on port ${PORT}`);
  console.log(`Test with: curl -X POST http://localhost:${PORT}/auth/signup-request`);
});