// ------------------ Imports ------------------
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');

// ------------------ Route Imports ------------------
const userRoutes = require('./routes/userRoutes');
const courseRoutes = require('./routes/courseRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const Course = require('./models/Course');

// ------------------ App Setup ------------------
const app = express();

// Middleware
// Allow credentials so session cookies are sent from the browser
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'student-portal-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 days
}));

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// ------------------ MongoDB Connection ------------------
mongoose.connect('mongodb://localhost:27017/student_portal', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('✅ MongoDB connected');
  try {
    const count = await Course.countDocuments();
    if (count === 0) {
      const sampleCourses = [
        { title: 'Intro to Computer Science', description: 'Basics of CS', instructor: 'Dr. Priya Rao' },
        { title: 'Calculus II', description: 'Integration and series', instructor: 'Prof. R. Menon' },
        { title: 'Physics for Engineers', description: 'Mechanics and thermodynamics', instructor: 'Dr. G. Sharma' },
        { title: 'Technical Communication', description: 'Writing for engineers', instructor: 'Ms. S. Iyer' }
      ];
      await Course.insertMany(sampleCourses);
      console.log('✅ Seeded sample courses');
    }
  } catch (seedErr) {
    console.warn('Could not seed courses:', seedErr && seedErr.message);
  }
})
.catch(err => console.error('❌ MongoDB connection error:', err));

// ------------------ Frontend Routes ------------------
// Home (login)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Registration
app.get(['/register', '/registration'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'registration.html'));
});

// Dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ------------------ API Routes ------------------
// Mount user routes under /api so frontend calls to /api/register and /api/login work
app.use('/api', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);

// ------------------ Fallback ------------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ------------------ Start Server ------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
