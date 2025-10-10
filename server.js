const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const COURSES_FILE = path.join(DATA_DIR, 'courses.json');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'student-portal-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 4 } // 4 hours
}));

// Helpers
function readJSON(file) {
  try {
    const raw = fs.readFileSync(file);
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// API: Register user
app.post('/api/register', (req, res) => {
  const { fullName, email, phone, password } = req.body;
  if (!fullName || !email || !password) return res.status(400).json({ error: 'Missing fields' });

  const users = readJSON(USERS_FILE);
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const newUser = {
    id: uuidv4(),
    fullName,
    email: email.toLowerCase(),
    phone: phone || '',
    password, // NOTE: plain text for prototype only — hash in production
    registeredCourses: []
  };

  users.push(newUser);
  writeJSON(USERS_FILE, users);
  req.session.userId = newUser.id;
  res.json({ success: true, user: { id: newUser.id, fullName: newUser.fullName, email: newUser.email } });
});

// API: Login
app.post('/api/login', (req, res) => {
  const { email, password, remember } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  req.session.userId = user.id;
  if (remember) {
    req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 days
  }
  res.json({ success: true, user: { id: user.id, fullName: user.fullName, email: user.email } });
});

// API: Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// Auth middleware
function ensureAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

// API: Get current user
app.get('/api/me', (req, res) => {
  if (!req.session || !req.session.userId) return res.json({ user: null });
  const users = readJSON(USERS_FILE);
  const me = users.find(u => u.id === req.session.userId);
  if (!me) return res.json({ user: null });
  const safe = { id: me.id, fullName: me.fullName, email: me.email, phone: me.phone, registeredCourses: me.registeredCourses || [] };
  res.json({ user: safe });
});

// API: Get courses (available + search)
app.get('/api/courses', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const courses = readJSON(COURSES_FILE);
  if (q) {
    const filtered = courses.filter(c =>
      (c.title || '').toLowerCase().includes(q) ||
      (c.code || '').toLowerCase().includes(q) ||
      (c.instructor || '').toLowerCase().includes(q)
    );
    return res.json({ courses: filtered });
  }
  res.json({ courses });
});

// API: Register for a course
app.post('/api/courses/register', ensureAuth, (req, res) => {
  const { courseCode } = req.body;
  if (!courseCode) return res.status(400).json({ error: 'Missing course code' });

  const users = readJSON(USERS_FILE);
  const courses = readJSON(COURSES_FILE);
  const user = users.find(u => u.id === req.session.userId);
  const course = courses.find(c => c.code === courseCode);
  if (!user || !course) return res.status(404).json({ error: 'User or course not found' });
  if (course.availability <= 0) return res.status(409).json({ error: 'No seats available' });
  if (user.registeredCourses && user.registeredCourses.includes(courseCode)) return res.status(409).json({ error: 'Already registered' });

  // Update availability and user
  course.availability -= 1;
  user.registeredCourses = user.registeredCourses || [];
  user.registeredCourses.push(courseCode);

  writeJSON(COURSES_FILE, courses);
  writeJSON(USERS_FILE, users);

  res.json({ success: true, registeredCourses: user.registeredCourses });
});

// API: Get course details
app.get('/api/courses/:code', (req, res) => {
  const courses = readJSON(COURSES_FILE);
  const course = courses.find(c => c.code === req.params.code);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  res.json({ course });
});

// Serve frontend pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'registration.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

// Ensure data folder exists and seed sample courses and users if missing
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(USERS_FILE)) writeJSON(USERS_FILE, []);
if (!fs.existsSync(COURSES_FILE)) {
  const sampleCourses = [
    { code: 'CSE101', title: 'Intro to Computer Science', instructor: 'Dr. Priya Rao', schedule: 'Mon & Wed 10:00-11:30', credits: 3, availability: 20 },
    { code: 'MTH201', title: 'Calculus II', instructor: 'Prof. R. Menon', schedule: 'Tue & Thu 09:00-10:30', credits: 4, availability: 15 },
    { code: 'PHY150', title: 'Physics for Engineers', instructor: 'Dr. G. Sharma', schedule: 'Mon & Wed 14:00-15:30', credits: 3, availability: 10 },
    { code: 'ENG210', title: 'Technical Communication', instructor: 'Ms. S. Iyer', schedule: 'Fri 10:00-13:00', credits: 2, availability: 25 }
  ];
  writeJSON(COURSES_FILE, sampleCourses);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Student Portal prototype running on http://localhost:${PORT}`));
