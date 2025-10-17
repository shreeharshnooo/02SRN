const express = require('express');
const router = express.Router();
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');

// Enroll user in course
router.post('/', async (req, res) => {
    const { userId, courseId } = req.body;
    const uid = userId || (req.session && req.session.userId);
    if (!uid || !courseId) return res.status(400).json({ error: 'Missing userId or courseId' });
    const enrollment = new Enrollment({ user: uid, course: courseId });
    await enrollment.save();

    await User.findByIdAndUpdate(uid, { $addToSet: { enrolledCourses: courseId } });

    res.json({ message: 'Enrollment successful', enrollment });
});

// Get all enrollments
router.get('/', async (req, res) => {
    const enrollments = await Enrollment.find().populate('user').populate('course');
    res.json(enrollments);
});

module.exports = router;
