const express = require('express');
const router = express.Router({ mergeParams: true });
const mongoose = require('mongoose');
const Song = require('../models/Song');
const Trip = require('../models/Trip');
const User = require('../models/User');
const QueueService = require('../services/queueService');

const queueService = new QueueService();

const getIO = (req) => req.app.get('io');

const getUserForSession = async (userId, sessionId) => {
  if (!userId || !sessionId || !mongoose.Types.ObjectId.isValid(userId)) return null;
  return User.findOne({ _id: userId, sessionId, isActive: true });
};

// Robust helper to extract tripId from req.params, req.body, or URL path
const getTripId = (req) => {
  if (req.params.tripId && mongoose.Types.ObjectId.isValid(req.params.tripId)) {
    return req.params.tripId;
  }
  if (req.body.tripId && mongoose.Types.ObjectId.isValid(req.body.tripId)) {
    return req.body.tripId;
  }
  const match = req.originalUrl.match(/\/(?:trips|songs)\/([a-f0-9]{24})/i);
  return match ? match[1] : null;
};

// POST /api/trips/:tripId/songs (or POST /api/songs/:tripId or POST /api/songs)
router.post(['/', '/:tripId'], async (req, res) => {
  try {
    const tripId = getTripId(req);
    const { userId, sessionId, provider, providerId, title, artistOrChannel, thumbnail, duration } = req.body;

    if (!tripId || !mongoose.Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing Trip ID' });
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing User ID' });
    }

    const videoId = providerId || req.body.videoId;
    if (!videoId) {
      return res.status(400).json({ success: false, message: 'Missing song providerId/videoId' });
    }

    if (!await getUserForSession(userId, sessionId)) {
      return res.status(403).json({ success: false, message: 'Invalid user session' });
    }

    const videoData = {
      videoId,
      title: title || 'Untitled Song',
      channel: artistOrChannel || req.body.channel || 'Unknown Channel',
      thumbnail: thumbnail || '',
      duration: duration || 'N/A'
    };

    const result = await queueService.addSong(tripId, userId, videoData);

    // Broadcast real-time queue update via Socket.IO
    const io = getIO(req);
    if (io) {
      io.to(`trip:${tripId}`).emit('queueUpdated', result.queueState);
      io.to(`trip:${tripId}`).emit('songAdded', {
        song: result.song,
        isDuplicate: result.isDuplicate,
        queueState: result.queueState
      });
      io.to(`trip:${tripId}`).emit('playbackStateChanged', {
        isPlaying: Boolean(result.queueState.currentSong),
        currentSong: result.queueState.currentSong
      });
    }

    return res.status(201).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Add song error:', error);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to add song to queue'
    });
  }
});

// GET /api/trips/:tripId/songs (or /api/songs/:tripId) - Get queue state
router.get(['/', '/:tripId'], async (req, res) => {
  try {
    const tripId = getTripId(req);
    if (!tripId || !mongoose.Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({ success: false, message: 'Invalid Trip ID' });
    }

    const queueState = await queueService.getQueueState(tripId);
    return res.status(200).json({
      success: true,
      data: queueState
    });
  } catch (error) {
    console.error('Get queue error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch queue' });
  }
});

// GET /api/trips/:tripId/songs/my-requests
router.get(['/my-requests', '/:tripId/my-requests'], async (req, res) => {
  try {
    const tripId = getTripId(req);
    const userId = req.query.userId;
    const sessionId = req.query.sessionId;

    if (!tripId || !userId || !sessionId || !await getUserForSession(userId, sessionId)) {
      return res.status(400).json({ success: false, message: 'tripId and userId are required' });
    }

    const userRequests = await queueService.getUserRequests(tripId, userId);
    return res.status(200).json({
      success: true,
      data: userRequests
    });
  } catch (error) {
    console.error('Get user requests error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch user requests' });
  }
});

// DELETE /api/trips/:tripId/songs/:songId
router.delete(['/:songId', '/:tripId/:songId'], async (req, res) => {
  try {
    const tripId = getTripId(req);
    const songId = req.params.songId;
    const userId = req.body.userId || req.query.userId;
    const sessionId = req.body.sessionId || req.query.sessionId;

    if (!songId || !mongoose.Types.ObjectId.isValid(songId)) {
      return res.status(400).json({ success: false, message: 'Invalid Song ID' });
    }

    const user = await getUserForSession(userId, sessionId);
    if (!user || user.tripId.toString() !== tripId) {
      return res.status(403).json({ success: false, message: 'User not found' });
    }

    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({ success: false, message: 'Song not found' });
    }

    if (song.tripId.toString() !== tripId || (user.role !== 'HOST' && song.userId.toString() !== userId.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized to remove this song' });
    }

    song.status = 'REMOVED';
    await song.save();

    const targetTripId = tripId || song.tripId;
    await queueService.updateSongPositions(targetTripId);
    const queueState = await queueService.getQueueState(targetTripId);

    const io = getIO(req);
    if (io) {
      io.to(`trip:${targetTripId}`).emit('queueUpdated', queueState);
    }

    return res.status(200).json({
      success: true,
      message: 'Song removed from queue',
      data: queueState
    });
  } catch (error) {
    console.error('Remove song error:', error);
    return res.status(500).json({ success: false, message: 'Failed to remove song' });
  }
});

// POST /api/trips/:tripId/skip
router.post(['/skip', '/:tripId/skip'], async (req, res) => {
  try {
    const tripId = getTripId(req);
    const userId = req.body.userId;
    const sessionId = req.body.sessionId;

    const user = await getUserForSession(userId, sessionId);
    if (!user || user.role !== 'HOST' || user.tripId.toString() !== tripId) {
      return res.status(403).json({ success: false, message: 'Only the host can skip songs' });
    }

    const currentSong = await Song.findOne({ tripId, status: 'PLAYING' }).select('_id');
    const transition = await queueService.transitionCurrentSong(tripId, currentSong?._id, 'SKIPPED');
    if (!transition.claimed) {
      const queueState = await queueService.getQueueState(tripId);
      return res.status(200).json({
        success: true,
        alreadyHandled: true,
        message: 'The current song was already handled',
        data: { currentSong: queueState.currentSong, queueState }
      });
    }
    const nextSong = transition.nextSong;
    const queueState = await queueService.getQueueState(tripId);

    await Trip.findByIdAndUpdate(tripId, {
      currentSongId: nextSong ? nextSong._id : null,
      isPlaying: !!nextSong
    });

    const io = getIO(req);
    if (io) {
      io.to(`trip:${tripId}`).emit('queueUpdated', queueState);
      io.to(`trip:${tripId}`).emit('playbackStateChanged', { isPlaying: !!nextSong, currentSong: nextSong });
    }

    return res.status(200).json({
      success: true,
      message: nextSong ? 'Skipped to next song' : 'Queue is now empty',
      data: { currentSong: nextSong, queueState }
    });
  } catch (error) {
    console.error('Skip song error:', error);
    return res.status(500).json({ success: false, message: 'Failed to skip song' });
  }
});

// POST /api/trips/:tripId/ended
router.post(['/ended', '/:tripId/ended'], async (req, res) => {
  try {
    const tripId = getTripId(req);
    const songId = req.body.songId;
    const userId = req.body.userId;
    const sessionId = req.body.sessionId;

    const user = await getUserForSession(userId, sessionId);
    if (!user || user.role !== 'HOST' || user.tripId.toString() !== tripId) {
      return res.status(403).json({ success: false, message: 'Only the host can advance songs' });
    }

    const transition = await queueService.transitionCurrentSong(tripId, songId, 'PLAYED');
    if (!transition.claimed) {
      const queueState = await queueService.getQueueState(tripId);
      return res.status(200).json({
        success: true,
        alreadyHandled: true,
        message: 'That song was already handled',
        data: { currentSong: queueState.currentSong, queueState }
      });
    }
    const nextSong = transition.nextSong;
    const queueState = await queueService.getQueueState(tripId);

    await Trip.findByIdAndUpdate(tripId, {
      currentSongId: nextSong ? nextSong._id : null,
      isPlaying: !!nextSong
    });

    const io = getIO(req);
    if (io) {
      io.to(`trip:${tripId}`).emit('queueUpdated', queueState);
      io.to(`trip:${tripId}`).emit('playbackStateChanged', {
        isPlaying: Boolean(nextSong),
        currentSong: nextSong
      });
    }

    return res.status(200).json({
      success: true,
      data: { currentSong: nextSong, queueState }
    });
  } catch (error) {
    console.error('Song ended handler error:', error);
    return res.status(500).json({ success: false, message: 'Error processing song completion' });
  }
});

module.exports = router;
