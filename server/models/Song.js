const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userDisplayName: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    enum: ['youtube'],
    required: true,
    default: 'youtube'
  },
  providerId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  artistOrChannel: {
    type: String,
    required: true,
    trim: true
  },
  thumbnail: {
    type: String,
    required: true
  },
  duration: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['QUEUED', 'PLAYING', 'PLAYED', 'SKIPPED', 'REMOVED'],
    default: 'QUEUED'
  },
  position: {
    type: Number,
    default: 0
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  queuedAt: {
    type: Date,
    default: Date.now
  },
  startedAt: {
    type: Date,
    default: null
  },
  finishedAt: {
    type: Date,
    default: null
  }
});

// Compound index to prevent duplicate providerId among active (QUEUED/PLAYING) songs in same trip
songSchema.index(
  { tripId: 1, providerId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['QUEUED', 'PLAYING'] } } }
);

module.exports = mongoose.model('Song', songSchema);
