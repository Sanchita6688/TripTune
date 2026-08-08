const mongoose = require('mongoose');
const Trip = require('../models/Trip');
const User = require('../models/User');
const Song = require('../models/Song');
const QueueService = require('../services/queueService');

class TripSocketHandler {
  constructor(io) {
    this.io = io;
    this.queueService = new QueueService();
  }

  handleConnection(socket) {
    console.log(`Socket connected: ${socket.id}`);

    // User joins trip room
    socket.on('joinTrip', async (data) => {
      try {
        const { tripId, userId, sessionId } = data || {};
        
        if (!tripId || !mongoose.Types.ObjectId.isValid(tripId)) {
          socket.emit('error', { message: 'Invalid Trip ID' });
          return;
        }

        let user = null;
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
          user = await User.findById(userId);
        }
        if (!user && sessionId) {
          user = await User.findOne({ tripId, sessionId });
        }

        if (!user) {
          socket.emit('error', { message: 'User not found for this trip' });
          return;
        }

        // Update user socket ID
        user.socketId = socket.id;
        user.lastSeenAt = new Date();
        await user.save();

        const roomName = `trip:${tripId}`;
        socket.join(roomName);

        // Store socket metadata
        socket.data.tripId = tripId;
        socket.data.userId = user._id.toString();
        socket.data.roomName = roomName;

        // Fetch latest state
        const trip = await Trip.findById(tripId);
        if (!trip) {
          socket.emit('error', { message: 'Trip not found or has ended' });
          return;
        }

        const queueState = await this.queueService.getQueueState(tripId);
        const members = await User.find({ tripId, isActive: true }).select('displayName role songsPlayed joinedAt');

        // Emit state to joined client
        socket.emit('tripState', {
          trip,
          currentSong: queueState.currentSong,
          queue: queueState.queue,
          playedHistory: queueState.playedHistory,
          members,
          queueLocked: trip ? trip.queueLocked : false,
          isPlaying: trip ? trip.isPlaying : false,
          status: trip ? trip.status : 'WAITING'
        });

        // Broadcast to other members in room
        socket.to(roomName).emit('memberJoined', {
          userId: user._id,
          displayName: user.displayName,
          role: user.role,
          members
        });

      } catch (error) {
        console.error('joinTrip socket error:', error);
        socket.emit('error', { message: 'Failed to join trip room' });
      }
    });

    // Add song via Socket
    socket.on('addSong', async (data) => {
      try {
        const { tripId, userId, videoData } = data || {};
        const roomName = `trip:${tripId}`;

        if (!tripId || !userId || !videoData || !videoData.videoId) {
          socket.emit('error', { message: 'Invalid song parameters' });
          return;
        }

        const result = await this.queueService.addSong(tripId, userId, videoData);

        // Broadcast updated queue state to room
        this.io.to(roomName).emit('queueUpdated', result.queueState);
        this.io.to(roomName).emit('songAdded', {
          song: result.song,
          isDuplicate: result.isDuplicate,
          message: result.message
        });

      } catch (error) {
        console.error('addSong socket error:', error);
        socket.emit('error', { message: error.message || 'Failed to add song' });
      }
    });

    // Skip song (Host only)
    socket.on('skipSong', async (data) => {
      try {
        const { tripId, userId } = data || {};
        const roomName = `trip:${tripId}`;

        const user = await User.findById(userId);
        if (!user || user.role !== 'HOST') {
          socket.emit('error', { message: 'Only the host can skip songs' });
          return;
        }

        const nextSong = await this.queueService.songEnded(tripId, null);
        const queueState = await this.queueService.getQueueState(tripId);

        await Trip.findByIdAndUpdate(tripId, {
          currentSongId: nextSong ? nextSong._id : null,
          isPlaying: !!nextSong
        });

        this.io.to(roomName).emit('queueUpdated', queueState);
        this.io.to(roomName).emit('playbackStateChanged', { isPlaying: !!nextSong, currentSong: nextSong });

      } catch (error) {
        console.error('skipSong socket error:', error);
        socket.emit('error', { message: 'Failed to skip song' });
      }
    });

    // Song ended naturally (from player)
    socket.on('songEnded', async (data) => {
      try {
        const { tripId, songId } = data || {};
        const roomName = `trip:${tripId}`;

        const nextSong = await this.queueService.songEnded(tripId, songId);
        const queueState = await this.queueService.getQueueState(tripId);

        await Trip.findByIdAndUpdate(tripId, {
          currentSongId: nextSong ? nextSong._id : null,
          isPlaying: !!nextSong
        });

        this.io.to(roomName).emit('queueUpdated', queueState);
        this.io.to(roomName).emit('playbackStateChanged', { isPlaying: !!nextSong, currentSong: nextSong });

      } catch (error) {
        console.error('songEnded socket error:', error);
      }
    });

    // Play song (Host only)
    socket.on('playSong', async (data) => {
      try {
        const { tripId, userId } = data || {};
        const roomName = `trip:${tripId}`;

        const user = await User.findById(userId);
        if (!user || user.role !== 'HOST') {
          socket.emit('error', { message: 'Only host can control playback' });
          return;
        }

        await Trip.findByIdAndUpdate(tripId, { isPlaying: true });

        this.io.to(roomName).emit('playbackStateChanged', { isPlaying: true });

      } catch (error) {
        console.error('playSong socket error:', error);
      }
    });

    // Pause song (Host only)
    socket.on('pauseSong', async (data) => {
      try {
        const { tripId, userId } = data || {};
        const roomName = `trip:${tripId}`;

        const user = await User.findById(userId);
        if (!user || user.role !== 'HOST') {
          socket.emit('error', { message: 'Only host can control playback' });
          return;
        }

        await Trip.findByIdAndUpdate(tripId, { isPlaying: false });

        this.io.to(roomName).emit('playbackStateChanged', { isPlaying: false });

      } catch (error) {
        console.error('pauseSong socket error:', error);
      }
    });

    // Lock / Unlock queue (Host only)
    socket.on('lockQueue', async (data) => {
      try {
        const { tripId, userId } = data || {};
        const roomName = `trip:${tripId}`;

        const user = await User.findById(userId);
        if (!user || user.role !== 'HOST') {
          socket.emit('error', { message: 'Only host can lock/unlock queue' });
          return;
        }

        const trip = await Trip.findById(tripId);
        if (trip) {
          trip.queueLocked = !trip.queueLocked;
          await trip.save();
          this.io.to(roomName).emit('queueLocked', { queueLocked: trip.queueLocked });
        }
      } catch (error) {
        console.error('lockQueue socket error:', error);
      }
    });

    // End Trip (Host only) - Deletes Trip, Users, and Songs from database
    socket.on('endTrip', async (data) => {
      try {
        const { tripId, userId } = data || {};
        const roomName = `trip:${tripId}`;

        const user = await User.findById(userId);
        if (!user || user.role !== 'HOST') {
          socket.emit('error', { message: 'Only host can end the trip' });
          return;
        }

        // Delete from database permanently
        await Trip.findByIdAndDelete(tripId);
        await User.deleteMany({ tripId });
        await Song.deleteMany({ tripId });

        // Notify all clients in room
        this.io.to(roomName).emit('tripEnded', { message: 'Trip ended by host' });

      } catch (error) {
        console.error('endTrip socket error:', error);
      }
    });

    // Remove song
    socket.on('removeSong', async (data) => {
      try {
        const { tripId, songId, userId } = data || {};
        const roomName = `trip:${tripId}`;

        const user = await User.findById(userId);
        const song = await Song.findById(songId);

        if (!user || !song) {
          socket.emit('error', { message: 'Song or user not found' });
          return;
        }

        if (user.role !== 'HOST' && song.userId.toString() !== userId.toString()) {
          socket.emit('error', { message: 'Not authorized to remove this song' });
          return;
        }

        song.status = 'REMOVED';
        await song.save();

        await this.queueService.updateSongPositions(tripId);
        const queueState = await this.queueService.getQueueState(tripId);

        this.io.to(roomName).emit('queueUpdated', queueState);

      } catch (error) {
        console.error('removeSong socket error:', error);
      }
    });

    // Disconnect handler
    socket.on('disconnect', async () => {
      try {
        const { tripId, userId, roomName } = socket.data || {};
        if (tripId && userId) {
          await User.findByIdAndUpdate(userId, {
            lastSeenAt: new Date(),
            socketId: null
          });

          setTimeout(async () => {
            const members = await User.find({ tripId, isActive: true }).select('displayName role songsPlayed joinedAt');
            this.io.to(roomName).emit('memberLeft', { userId, members });
          }, 15000);
        }
      } catch (error) {
        console.error('disconnect socket error:', error);
      }
    });
  }
}

module.exports = TripSocketHandler;
