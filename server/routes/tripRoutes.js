const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Trip = require('../models/Trip');
const User = require('../models/User');
const Song = require('../models/Song');
const generateJoinCode = require('../utils/generateJoinCode');
const QueueService = require('../services/queueService');

const queueService = new QueueService();

const getIO = (req) => req.app.get('io');

// Create trip
router.post('/', async (req, res) => {
  try {
    const { name, hostName } = req.body;
    
    // Validate input
    if (!name || !hostName) {
      return res.status(400).json({ message: 'Trip name and host name are required' });
    }

    if (name.length > 100 || hostName.length > 50) {
      return res.status(400).json({ message: 'Invalid input length' });
    }

    // Generate unique join code
    let joinCode;
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      joinCode = generateJoinCode();
      const existingTrip = await Trip.findOne({ joinCode });
      if (!existingTrip) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ message: 'Failed to generate unique join code' });
    }

    // Generate host user ID beforehand
    const hostUserId = new mongoose.Types.ObjectId();

    // Create trip
    const trip = new Trip({
      name,
      joinCode,
      hostId: hostUserId.toString(),
      hostName,
      status: 'WAITING'
    });

    await trip.save();

    // Create host user
    const hostUser = new User({
      _id: hostUserId,
      tripId: trip._id,
      displayName: hostName,
      role: 'HOST',
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    await hostUser.save();

    res.status(201).json({
      tripId: trip._id,
      joinCode: trip.joinCode,
      hostUser: hostUser,
      message: 'Trip created successfully'
    });
  } catch (error) {
    console.error('Create trip error:', error);
    res.status(500).json({ message: 'Failed to create trip' });
  }
});

// Join trip - Non-hosts CANNOT join as host!
router.post('/join', async (req, res) => {
  try {
    const { joinCode, displayName } = req.body;

    // Validate input
    if (!joinCode || !displayName) {
      return res.status(400).json({ message: 'Join code and display name are required' });
    }

    if (displayName.length > 50) {
      return res.status(400).json({ message: 'Display name must be less than 50 characters' });
    }

    // Find trip
    const trip = await Trip.findOne({ joinCode: joinCode.toUpperCase() });
    if (!trip || trip.status === 'ENDED') {
      return res.status(404).json({ message: 'Trip not found or has ended' });
    }

    // Check if user already exists
    let user = await User.findOne({
      tripId: trip._id,
      displayName: displayName,
      isActive: true
    });

    if (user && user.role === 'HOST') {
      return res.status(403).json({ message: 'Cannot join as Host. Host privileges belong to trip creator.' });
    }

    if (!user) {
      // Create new passenger user (ALWAYS PASSENGER)
      user = new User({
        tripId: trip._id,
        displayName: displayName,
        role: 'PASSENGER',
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });
      await user.save();
    }

    // Get queue state
    const queueState = await queueService.getQueueState(trip._id);

    res.status(200).json({
      tripId: trip._id,
      user: user,
      trip: trip,
      currentSong: queueState.currentSong,
      queue: queueState.queue,
      totalSongs: queueState.totalSongs,
      queueLocked: trip.queueLocked,
      message: 'Joined trip successfully'
    });
  } catch (error) {
    console.error('Join trip error:', error);
    res.status(500).json({ message: 'Failed to join trip' });
  }
});

// Get trip details
router.get('/:tripId', async (req, res) => {
  try {
    const { tripId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({ message: 'Invalid Trip ID format' });
    }

    const trip = await Trip.findById(tripId);
    if (!trip || trip.status === 'ENDED') {
      return res.status(404).json({ message: 'Trip not found or has ended' });
    }

    const members = await User.find({
      tripId: tripId,
      isActive: true
    }).select('displayName role songsPlayed joinedAt');

    const queueState = await queueService.getQueueState(tripId);

    res.status(200).json({
      trip,
      members,
      currentSong: queueState.currentSong,
      queue: queueState.queue,
      totalSongs: queueState.totalSongs,
      queueLocked: trip.queueLocked
    });
  } catch (error) {
    console.error('Get trip error:', error);
    res.status(500).json({ message: 'Failed to get trip details' });
  }
});

// Get trip members
router.get('/:tripId/members', async (req, res) => {
  try {
    const { tripId } = req.params;

    const members = await User.find({
      tripId: tripId,
      isActive: true
    }).select('displayName role songsPlayed joinedAt');

    res.status(200).json({ members });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ message: 'Failed to get members' });
  }
});

// Get trip queue
router.get('/:tripId/queue', async (req, res) => {
  try {
    const { tripId } = req.params;

    const queueState = await queueService.getQueueState(tripId);

    res.status(200).json(queueState);
  } catch (error) {
    console.error('Get queue error:', error);
    res.status(500).json({ message: 'Failed to get queue' });
  }
});

// End trip - DELETES Trip, Users, and Songs from database permanently
router.post('/:tripId/end', async (req, res) => {
  try {
    const { tripId } = req.params;
    const { userId } = req.body;

    // Verify host
    const user = await User.findById(userId);
    if (!user || user.role !== 'HOST') {
      return res.status(403).json({ message: 'Only host can end the trip' });
    }

    // Delete trip, users, and songs from database
    await Trip.findByIdAndDelete(tripId);
    await User.deleteMany({ tripId });
    await Song.deleteMany({ tripId });

    // Emit real-time notification to all riders
    const io = getIO(req);
    if (io) {
      io.to(`trip:${tripId}`).emit('tripEnded', { message: 'Trip ended by host' });
    }

    res.status(200).json({ message: 'Trip ended and removed permanently' });
  } catch (error) {
    console.error('End trip error:', error);
    res.status(500).json({ message: 'Failed to end trip' });
  }
});

module.exports = router;
