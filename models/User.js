const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },     // use 'name' for full name
    email: { type: String, required: true, unique: true },
    phone: { type: String },                     // optional, add if you need
    password: { type: String, required: true },
    enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }]
});

module.exports = mongoose.model('User', userSchema);
