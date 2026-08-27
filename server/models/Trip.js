const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  joinCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  hostId: {
    type: String,
    required: true
  },
  hostName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  status: {
    type: String,
    enum: ['WAITING', 'ACTIVE', 'ENDED'],
    default: 'WAITING'
  },
  queueLocked: {
    type: Boolean,
    default: false
  },
  currentSongId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song',
    default: null
  },
  isPlaying: {
    type: Boolean,
    default: false
  },
  queueMutationVersion: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  }
});

module.exports = mongoose.model('Trip', tripSchema);
