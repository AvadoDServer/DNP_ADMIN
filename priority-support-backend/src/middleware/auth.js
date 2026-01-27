const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

/**
 * Middleware to authenticate users
 * In production, this should validate JWT tokens or API keys
 */
function authenticateUser(req, res, next) {
  // For now, we'll use a simple API key authentication
  // In production, implement proper JWT token validation
  
  const apiKey = req.get('X-API-Key') || req.query.apiKey;
  const authHeader = req.get('Authorization');
  
  // Check for API key
  if (apiKey) {
    const validApiKey = process.env.API_KEY;
    if (validApiKey && apiKey === validApiKey) {
      req.user = { authenticated: true };
      return next();
    }
  }
  
  // Check for JWT token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }
  
  // In development mode, allow requests without authentication
  if (process.env.NODE_ENV === 'development') {
    console.warn('WARNING: Request allowed without authentication (development mode)');
    req.user = { authenticated: true, userId: req.params.userId || req.body.userId };
    return next();
  }
  
  return res.status(401).json({ error: 'Authentication required' });
}

/**
 * Generate a JWT token for a user
 */
function generateToken(userId, expiresIn = '7d') {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn });
}

module.exports = {
  authenticateUser,
  generateToken
};
