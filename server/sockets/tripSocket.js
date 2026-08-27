const mongoose = require('mongoose');
const Trip = require('../models/Trip');
const User = require('../models/User');
const Song = require('../models/Song');
const QueueService = require('../services/queueService');
const broadcastTripState = require('../utils/tripState');

class TripSocketHandler {
  constructor(io) {
    this.io = io;
    this.queueService = new QueueService();
  }

  async getTripUser(tripId, userId, requireHost = false) {
    if (!mongoose.Types.ObjectId.isValid(tripId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return null;
    }
    const user = await User.findById(userId);
    if (!user || !user.isActive || user.tripId.toString() !== tripId.toString()) return null;
    if (requireHost && user.role !== 'HOST') return null;
    return user;
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
        if (userId && sessionId && mongoose.Types.ObjectId.isValid(userId)) {
          user = await User.findOne({ _id: userId, tripId, sessionId, isActive: true });
        }

        if (!user) {
          socket.emit('error', { message: 'User not found for this trip' });
          return;
        }
        if (user.tripId.toString() !== tripId) {
          socket.emit('error', { message: 'User does not belong to this trip' });
          return;
        }

        // Validate the trip before changing membership or joining its room.
        const trip = await Trip.findById(tripId);
        if (!trip || trip.status === 'ENDED' || (trip.expiresAt && trip.expiresAt <= new Date())) {
          socket.emit('error', { message: 'Trip not found or has ended' });
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
        socket.data.sessionId = user.sessionId;
        socket.data.roomName = roomName;

        user.isActive = true;
        await user.save();

        const tripState = await this.queueService.getCanonicalTripState(tripId);
        const members = await User.find({ tripId, isActive: true }).select('displayName role songsPlayed joinedAt');

        // Emit state to joined client
        socket.emit('tripState', tripState);

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

        if (!tripId || !userId || !videoData || !videoData.videoId || socket.data.userId !== userId || socket.data.tripId !== tripId) {
          socket.emit('error', { message: 'Invalid song parameters' });
          return;
        }

        const result = await this.queueService.addSong(tripId, userId, videoData);

        // Broadcast updated queue state to room
        broadcastTripState(this.io, result.tripState);
        this.io.to(roomName).emit('songAdded', {
          song: result.song,
          isDuplicate: result.isDuplicate,
          message: result.message,
          tripState: result.tripState
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

        const user = await this.getTripUser(tripId, userId, true);
        if (!user || socket.data.userId !== userId || socket.data.tripId !== tripId) {
          socket.emit('error', { message: 'Only the host can skip songs' });
          return;
        }

        const currentSong = await Song.findOne({ tripId, status: 'PLAYING' }).select('_id');
        const transition = await this.queueService.transitionCurrentSong(tripId, currentSong?._id, 'SKIPPED');
        if (!transition.claimed) return;
        const nextSong = transition.nextSong;
        const queueState = await this.queueService.getQueueState(tripId);

        await Trip.findByIdAndUpdate(tripId, {
          currentSongId: nextSong ? nextSong._id : null,
          isPlaying: !!nextSong
        });

        const tripState = await this.queueService.commitTripMutation(tripId);
        broadcastTripState(this.io, tripState);

      } catch (error) {
        console.error('skipSong socket error:', error);
        socket.emit('error', { message: 'Failed to skip song' });
      }
    });

    // Song ended naturally (from player)
    socket.on('songEnded', async (data) => {
      try {
        const { tripId, songId, userId } = data || {};
        const roomName = `trip:${tripId}`;

        const user = await this.getTripUser(tripId, userId, true);
        if (!user || socket.data.userId !== userId || socket.data.tripId !== tripId) {
          socket.emit('error', { message: 'Only the host can advance songs' });
          return;
        }

        const transition = await this.queueService.transitionCurrentSong(tripId, songId, 'PLAYED');
        if (!transition.claimed) return;
        const nextSong = transition.nextSong;
        const queueState = await this.queueService.getQueueState(tripId);

        await Trip.findByIdAndUpdate(tripId, {
          currentSongId: nextSong ? nextSong._id : null,
          isPlaying: !!nextSong
        });

        const tripState = await this.queueService.commitTripMutation(tripId);
        broadcastTripState(this.io, tripState);

      } catch (error) {
        console.error('songEnded socket error:', error);
      }
    });

    // Play song (Host only)
    socket.on('playSong', async (data) => {
      try {
        const { tripId, userId } = data || {};
        const roomName = `trip:${tripId}`;

        const user = await this.getTripUser(tripId, userId, true);
        if (!user || socket.data.userId !== userId || socket.data.tripId !== tripId) {
          socket.emit('error', { message: 'Only host can control playback' });
          return;
        }

        await Trip.findByIdAndUpdate(tripId, { isPlaying: true });

        const tripState = await this.queueService.commitTripMutation(tripId);
        broadcastTripState(this.io, tripState);

      } catch (error) {
        console.error('playSong socket error:', error);
      }
    });

    // Pause song (Host only)
    socket.on('pauseSong', async (data) => {
      try {
        const { tripId, userId } = data || {};
        const roomName = `trip:${tripId}`;

        const user = await this.getTripUser(tripId, userId, true);
        if (!user || socket.data.userId !== userId || socket.data.tripId !== tripId) {
          socket.emit('error', { message: 'Only host can control playback' });
          return;
        }

        await Trip.findByIdAndUpdate(tripId, { isPlaying: false });

        const tripState = await this.queueService.commitTripMutation(tripId);
        broadcastTripState(this.io, tripState);

      } catch (error) {
        console.error('pauseSong socket error:', error);
      }
    });

    // Lock / Unlock queue (Host only)
    socket.on('lockQueue', async (data) => {
      try {
        const { tripId, userId } = data || {};
        const roomName = `trip:${tripId}`;

        const user = await this.getTripUser(tripId, userId, true);
        if (!user || socket.data.userId !== userId || socket.data.tripId !== tripId) {
          socket.emit('error', { message: 'Only host can lock/unlock queue' });
          return;
        }

        const trip = await Trip.findById(tripId);
        if (trip) {
          trip.queueLocked = !trip.queueLocked;
          await trip.save();
          const tripState = await this.queueService.commitTripMutation(tripId);
          broadcastTripState(this.io, tripState);
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

        const user = await this.getTripUser(tripId, userId, true);
        if (!user || socket.data.userId !== userId || socket.data.tripId !== tripId) {
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

        const user = await this.getTripUser(tripId, userId);
        const song = await Song.findOne({ _id: songId, tripId });

        if (!user || !song || socket.data.userId !== userId || socket.data.tripId !== tripId) {
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

        const tripState = await this.queueService.commitTripMutation(tripId);
        broadcastTripState(this.io, tripState);

      } catch (error) {
        console.error('removeSong socket error:', error);
      }
    });

    socket.on('leaveTrip', async (data) => {
      try {
        const { tripId, userId } = data || {};
        const user = await this.getTripUser(tripId, userId);
        if (!user || socket.data.userId !== userId || socket.data.tripId !== tripId) return;

        user.isActive = false;
        user.socketId = null;
        user.lastSeenAt = new Date();
        await user.save();
        socket.leave(`trip:${tripId}`);

        const tripState = await this.queueService.commitTripMutation(tripId);
        broadcastTripState(this.io, tripState);
        this.io.to(`trip:${tripId}`).emit('memberLeft', { userId, members: tripState.members });
      } catch (error) {
        console.error('leaveTrip socket error:', error);
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
