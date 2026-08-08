const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  role: {
    type: String,
    enum: ['HOST', 'PASSENGER'],
    default: 'PASSENGER'
  },
  socketId: {
    type: String,
    default: null
  },
  sessionId: {
    type: String,
    required: true
  },
  songsPlayed: {
    type: Number,
    default: 0
  },
  songsRequested: {
    type: Number,
    default: 0
  },
  lastPlayedAt: {
    type: Date,
    default: null
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastSeenAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.model('User', userSchema);
