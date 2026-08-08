const Song = require('../models/Song');
const User = require('../models/User');
const Trip = require('../models/Trip');
const FairQueue = require('../algorithms/fairQueue');

class QueueService {
  constructor() {
    this.fairQueue = new FairQueue();
  }

  async addSong(tripId, userId, videoData) {
    // 1. Verify trip exists and is active
    const trip = await Trip.findById(tripId);
    if (!trip) {
      throw { status: 404, message: 'Trip not found' };
    }
    if (trip.status === 'ENDED') {
      throw { status: 403, message: 'Trip has ended' };
    }
    if (trip.queueLocked) {
      throw { status: 403, message: 'Queue is currently locked by host' };
    }

    // 2. Verify user belongs to trip
    const user = await User.findById(userId);
    if (!user || user.tripId.toString() !== tripId.toString()) {
      throw { status: 403, message: 'User does not belong to this trip' };
    }

    // 3. Enforce 3-pending-song limit per passenger
    const maxPending = parseInt(process.env.MAX_PENDING_SONGS) || 3;
    const pendingCount = await Song.countDocuments({
      tripId: tripId,
      userId: userId,
      status: 'QUEUED'
    });

    if (pendingCount >= maxPending) {
      throw {
        status: 400,
        message: `You already have ${maxPending} pending songs waiting in the queue. Please wait until one of your songs is played!`
      };
    }

    // 4. Duplicate song check (same videoId currently QUEUED or PLAYING)
    const existingSong = await Song.findOne({
      tripId: tripId,
      providerId: videoData.videoId,
      status: { $in: ['QUEUED', 'PLAYING'] }
    });

    if (existingSong) {
      const currentNames = existingSong.userDisplayName ? existingSong.userDisplayName.split(', ') : [];
      if (!currentNames.includes(user.displayName)) {
        currentNames.push(user.displayName);
        await Song.findByIdAndUpdate(existingSong._id, {
          userDisplayName: currentNames.join(', ')
        });
      }
      const updatedExisting = await Song.findById(existingSong._id);
      const queueState = await this.getQueueState(tripId);
      return {
        song: updatedExisting,
        isDuplicate: true,
        message: `Song is already in queue! Added ${user.displayName} to requesters.`,
        queueState
      };
    }

    // 5. Create new song record
    const newSong = new Song({
      tripId: tripId,
      userId: user._id,
      userDisplayName: user.displayName,
      provider: 'youtube',
      providerId: videoData.videoId,
      title: videoData.title || 'Untitled Video',
      artistOrChannel: videoData.channel || 'Unknown Channel',
      thumbnail: videoData.thumbnail || '',
      duration: videoData.duration || 'N/A',
      status: 'QUEUED',
      position: 0,
      requestedAt: new Date()
    });

    await newSong.save();

    await User.findByIdAndUpdate(user._id, {
      $inc: { songsRequested: 1 }
    });

    // Update queue ordering positions using Round-Robin Fair Queue algorithm
    await this.updateSongPositions(tripId);

    // If no song is currently playing in this trip, automatically advance top fair song to PLAYING!
    const currentPlaying = await Song.findOne({ tripId: tripId, status: 'PLAYING' });
    if (!currentPlaying) {
      await this.getNextSong(tripId);
      await Trip.findByIdAndUpdate(tripId, { isPlaying: true });
    }

    const queueState = await this.getQueueState(tripId);
    return {
      song: newSong,
      isDuplicate: false,
      message: 'Song added to queue & ready for playback!',
      queueState
    };
  }

  async getNextSong(tripId) {
    try {
      const queuedSongs = await Song.find({
        tripId: tripId,
        status: 'QUEUED'
      }).sort({ requestedAt: 1 });

      if (queuedSongs.length === 0) {
        return null;
      }

      const userIds = [...new Set(queuedSongs.map(s => s.userId.toString()))];
      const users = await User.find({
        _id: { $in: userIds },
        tripId: tripId
      });

      const userStats = {};
      users.forEach(u => {
        userStats[u._id.toString()] = {
          songsPlayed: u.songsPlayed || 0,
          lastPlayedAt: u.lastPlayedAt || null
        };
      });

      // Pass through Round-Robin fair queue algorithm
      const selectedSong = this.fairQueue.getNextSong(queuedSongs, userStats);
      if (!selectedSong) return null;

      // Mark current PLAYING song as PLAYED
      await Song.updateMany(
        { tripId: tripId, status: 'PLAYING' },
        { status: 'PLAYED', finishedAt: new Date() }
      );

      // Mark selected song as PLAYING
      const updatedSong = await Song.findByIdAndUpdate(
        selectedSong._id,
        {
          status: 'PLAYING',
          startedAt: new Date()
        },
        { new: true }
      );

      // Update requesting user stats
      if (selectedSong.userId) {
        await User.findByIdAndUpdate(selectedSong.userId, {
          $inc: { songsPlayed: 1 },
          lastPlayedAt: new Date()
        });
      }

      // Recalculate positions for remaining queued songs using Round-Robin
      await this.updateSongPositions(tripId);

      return updatedSong;
    } catch (error) {
      console.error('Error in getNextSong:', error);
      throw error;
    }
  }

  async songEnded(tripId, songId) {
    if (songId) {
      await Song.findByIdAndUpdate(songId, {
        status: 'PLAYED',
        finishedAt: new Date()
      });
    } else {
      await Song.updateMany(
        { tripId: tripId, status: 'PLAYING' },
        { status: 'PLAYED', finishedAt: new Date() }
      );
    }
    return await this.getNextSong(tripId);
  }

  async updateSongPositions(tripId) {
    try {
      const queuedSongs = await Song.find({
        tripId: tripId,
        status: 'QUEUED'
      }).sort({ requestedAt: 1 });

      if (queuedSongs.length === 0) return;

      const userIds = [...new Set(queuedSongs.map(s => s.userId.toString()))];
      const users = await User.find({ _id: { $in: userIds }, tripId });
      const userStats = {};
      users.forEach(u => {
        userStats[u._id.toString()] = {
          songsPlayed: u.songsPlayed || 0,
          lastPlayedAt: u.lastPlayedAt || null
        };
      });

      // Get exact Round-Robin fair sequence
      const fairOrderedSongs = this.fairQueue.getFairRoundRobinOrder(queuedSongs, userStats);

      // Update position numbers in database
      for (let i = 0; i < fairOrderedSongs.length; i++) {
        await Song.findByIdAndUpdate(fairOrderedSongs[i]._id, {
          position: i + 1
        });
      }
    } catch (error) {
      console.error('Error updating song positions:', error);
    }
  }

  async getQueueState(tripId) {
    const currentSong = await Song.findOne({
      tripId: tripId,
      status: 'PLAYING'
    });

    const queue = await Song.find({
      tripId: tripId,
      status: 'QUEUED'
    }).sort({ position: 1 });

    return {
      currentSong,
      queue
    };
  }

  async getUserRequests(tripId, userId) {
    return await Song.find({
      tripId: tripId,
      userId: userId
    }).sort({ requestedAt: -1 });
  }
}

module.exports = QueueService;
