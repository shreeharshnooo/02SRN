const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const DATA_USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !phone || !password)
      return res.status(400).json({ error: 'All fields are required' });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, phone, password: hashedPassword });
    await newUser.save();

  // set session
  if (req && req.session) req.session.userId = newUser._id;

  res.json({ success: true, message: 'User registered successfully', user: { id: newUser._id, name: newUser.name } });
  } catch (err) {
    console.error('Register Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    // Try MongoDB first
    let user = null;
    try {
      user = await User.findOne({ email });
    } catch (dbErr) {
      console.warn('Mongo lookup failed:', dbErr && dbErr.message);
      user = null;
    }

    // If no user in Mongo, fallback to file-based users (prototype)
    if (!user) {
      try {
        if (fs.existsSync(DATA_USERS_FILE)) {
          const raw = fs.readFileSync(DATA_USERS_FILE, 'utf8') || '[]';
          const users = JSON.parse(raw);
          const found = users.find(u => (u.email || '').toLowerCase() === (email || '').toLowerCase());
          if (found) {
            // plaintext password proto
            const storedPass = found.password || found.pass || '';
            if (storedPass === password) {
              // successful fallback login - set session if available
              if (req && req.session) req.session.userId = found.id || null;
              return res.json({ success: true, message: 'Login successful (file fallback)', user: { id: found.id || null, name: found.name || found.Name || found.fullName || '' } });
            } else {
              return res.status(400).json({ error: 'Invalid email or password' });
            }
          }
        }
      } catch (fileErr) {
        console.warn('File-based user lookup failed:', fileErr && fileErr.message);
      }

      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid email or password' });

    // set session
    if (req && req.session) req.session.userId = user._id;

    res.json({
      success: true,
      message: 'Login successful',
      user: { id: user._id, name: user.name }
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

// Get current user
router.get('/me', async (req, res) => {
  try {
    if (!req || !req.session || !req.session.userId) return res.json({ user: null });
    const uid = req.session.userId;

    // Try Mongo
    try {
      const user = await User.findById(uid).select('-password').populate('enrolledCourses');
        if (user) return res.json({ user: { id: user._id, name: user.name, email: user.email, phone: user.phone, enrolledCourses: user.enrolledCourses || [] } });
    } catch (dbErr) {
      console.warn('Mongo lookup in /me failed:', dbErr && dbErr.message);
    }

    // Fallback to file
    try {
      if (fs.existsSync(DATA_USERS_FILE)) {
        const raw = fs.readFileSync(DATA_USERS_FILE, 'utf8') || '[]';
        const users = JSON.parse(raw);
        const found = users.find(u => (u.id || '').toString() === (uid || '').toString());
        if (found) return res.json({ user: { id: found.id || null, name: found.name || found.Name || found.fullName || '', email: found.email, phone: found.phone } });
      }
    } catch (fileErr) {
      console.warn('File lookup in /me failed:', fileErr && fileErr.message);
    }

    return res.json({ user: null });
  } catch (err) {
    console.error('/me Error:', err);
    return res.status(500).json({ user: null });
  }
});

