const Song = require('../models/Song');
const User = require('../models/User');
const Trip = require('../models/Trip');
const FairQueue = require('../algorithms/fairQueue');
const mongoose = require('mongoose');

class QueueService {
  constructor() {
    this.fairQueue = new FairQueue();
  }

  async addSong(tripId, userId, videoData) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await this.addSongInTransaction(tripId, userId, videoData, session);
      });
      result.tripState = await this.getCanonicalTripState(tripId);
      return result;
    } catch (error) {
      if (error?.code === 11000) {
        return this.addDuplicateRequester(tripId, userId, videoData);
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async addDuplicateRequester(tripId, userId, videoData) {
    const user = await User.findById(userId);
    const existingSong = await Song.findOne({
      tripId,
      providerId: videoData.videoId,
      status: { $in: ['QUEUED', 'PLAYING'] }
    });

    if (!user || !existingSong) {
      throw { status: 409, message: 'Song was added concurrently. Please try again.' };
    }

    const currentNames = existingSong.userDisplayName ? existingSong.userDisplayName.split(', ') : [];
    const requesterAdded = !currentNames.includes(user.displayName);
    if (requesterAdded) {
      currentNames.push(user.displayName);
      await Song.findByIdAndUpdate(existingSong._id, {
        userDisplayName: currentNames.join(', ')
      });
    }

    const tripState = requesterAdded
      ? await this.commitTripMutation(tripId)
      : await this.getCanonicalTripState(tripId);

    return {
      song: await Song.findById(existingSong._id),
      isDuplicate: true,
      message: `Song is already in queue! Added ${user.displayName} to requesters.`,
      queueState: await this.getQueueState(tripId),
      tripState
    };
  }

  async addSongInTransaction(tripId, userId, videoData, session) {
    // 1. Verify trip exists and is active
    // Writing the trip document serializes additions for the same trip.
    const trip = await Trip.findById(tripId).session(session);
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
    const user = await User.findOne({ _id: userId, tripId }).session(session);
    if (!user || user.tripId.toString() !== tripId.toString()) {
      throw { status: 403, message: 'User does not belong to this trip' };
    }

    // 3. Enforce 3-pending-song limit per passenger
    const maxPending = parseInt(process.env.MAX_PENDING_SONGS) || 3;
    const pendingCount = await Song.countDocuments({
      tripId: tripId,
      userId: userId,
      status: 'QUEUED'
    }).session(session);

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
    }).session(session);

    if (existingSong) {
      const currentNames = existingSong.userDisplayName ? existingSong.userDisplayName.split(', ') : [];
      const requesterAdded = !currentNames.includes(user.displayName);
      if (requesterAdded) {
        currentNames.push(user.displayName);
        await Song.findByIdAndUpdate(existingSong._id, {
          userDisplayName: currentNames.join(', ')
        }, { session });
        await Trip.findOneAndUpdate(
          { _id: tripId },
          { $inc: { queueMutationVersion: 1 } },
          { new: true, session }
        );
      }
      const updatedExisting = await Song.findById(existingSong._id).session(session);
      const queueState = await this.getQueueState(tripId, session);
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

    await newSong.save({ session });

    await User.findByIdAndUpdate(user._id, {
      $inc: { songsRequested: 1 }
    }, { session });

    // Update queue ordering positions using Round-Robin Fair Queue algorithm
    await this.updateSongPositions(tripId, session);

    // If no song is currently playing in this trip, automatically advance top fair song to PLAYING!
    const currentPlaying = await Song.findOne({ tripId: tripId, status: 'PLAYING' }).session(session);
    if (!currentPlaying) {
      await this.getNextSong(tripId, session);
    }

    await Trip.findOneAndUpdate(
      { _id: tripId },
      { $inc: { queueMutationVersion: 1 } },
      { new: true, session }
    );

    const queueState = await this.getQueueState(tripId, session);
    return {
      song: newSong,
      isDuplicate: false,
      message: 'Song added to queue & ready for playback!',
      queueState
    };
  }

  async getNextSong(tripId, session = null) {
    try {
      let queuedQuery = Song.find({
        tripId: tripId,
        status: 'QUEUED'
      }).sort({ requestedAt: 1 });
      if (session) queuedQuery = queuedQuery.session(session);
      const queuedSongs = await queuedQuery;

      if (queuedSongs.length === 0) {
        return null;
      }

      const userIds = [...new Set(queuedSongs.map(s => s.userId.toString()))];
      let usersQuery = User.find({
        _id: { $in: userIds },
        tripId: tripId
      });
      if (session) usersQuery = usersQuery.session(session);
      const users = await usersQuery;

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

      // Claim the next song only while it is still queued. Terminal transitions
      // are responsible for closing the previous PLAYING song atomically.
      const playingSong = await Song.findOneAndUpdate(
        { _id: selectedSong._id, tripId: tripId, status: 'QUEUED' },
        {
          status: 'PLAYING',
          startedAt: new Date()
        },
        { new: true, session }
      );

      if (!playingSong) {
        let currentQuery = Song.findOne({ tripId: tripId, status: 'PLAYING' });
        if (session) currentQuery = currentQuery.session(session);
        return currentQuery;
      }

      // Update requesting user stats
      if (playingSong.userId) {
        await User.findByIdAndUpdate(playingSong.userId, {
          $inc: { songsPlayed: 1 },
          lastPlayedAt: new Date()
        }, { session });
      }

      await Trip.findByIdAndUpdate(tripId, {
        currentSongId: playingSong._id,
        isPlaying: true
      }, { session });

      // Recalculate positions for remaining queued songs using Round-Robin
      await this.updateSongPositions(tripId, session);

      return playingSong;
    } catch (error) {
      console.error('Error in getNextSong:', error);
      throw error;
    }
  }

  async transitionCurrentSong(tripId, expectedSongId, terminalStatus) {
    let songId = expectedSongId;
    if (!songId) {
      const currentSong = await Song.findOne({ tripId, status: 'PLAYING' }).select('_id');
      songId = currentSong?._id;
    }

    if (!songId) {
      return { claimed: false, nextSong: null };
    }

    const transitionedSong = await Song.findOneAndUpdate(
      { _id: songId, tripId, status: 'PLAYING' },
      { status: terminalStatus, finishedAt: new Date() },
      { new: true }
    );

    if (!transitionedSong) {
      return { claimed: false, nextSong: null };
    }

    const nextSong = await this.getNextSong(tripId);
    return { claimed: true, transitionedSong, nextSong };
  }

  async songEnded(tripId, songId) {
    const result = await this.transitionCurrentSong(tripId, songId, 'PLAYED');
    return result.claimed ? result.nextSong : null;
  }

  async removeSong(tripId, songId) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const trip = await Trip.findOneAndUpdate(
          { _id: tripId },
          { $inc: { queueMutationVersion: 0 } },
          { new: true, session }
        );
        if (!trip) throw { status: 404, message: 'Trip not found' };

        const playingSong = await Song.findOneAndUpdate(
          { _id: songId, tripId, status: 'PLAYING' },
          { status: 'REMOVED', finishedAt: new Date() },
          { new: true, session }
        );

        let removedSong = playingSong;
        let nextSong = null;
        if (playingSong) {
          nextSong = await this.getNextSong(tripId, session);
          if (!nextSong) {
            await Trip.findOneAndUpdate(
              { _id: tripId },
              { currentSongId: null, isPlaying: false },
              { new: true, session }
            );
          }
        } else {
          removedSong = await Song.findOneAndUpdate(
            { _id: songId, tripId, status: 'QUEUED' },
            { status: 'REMOVED', finishedAt: new Date() },
            { new: true, session }
          );
        }

        if (!removedSong) {
          result = {
            changed: false,
            alreadyHandled: true,
            tripState: await this.getCanonicalTripState(tripId, session)
          };
          return;
        }

        await this.updateSongPositions(tripId, session);
        await Trip.findOneAndUpdate(
          { _id: tripId },
          { $inc: { queueMutationVersion: 1 } },
          { new: true, session }
        );

        result = {
          changed: true,
          alreadyHandled: false,
          removedSong,
          nextSong,
          tripState: await this.getCanonicalTripState(tripId, session)
        };
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async updateSongPositions(tripId, session = null) {
    try {
      let queuedQuery = Song.find({
        tripId: tripId,
        status: 'QUEUED'
      }).sort({ requestedAt: 1 });
      if (session) queuedQuery = queuedQuery.session(session);
      const queuedSongs = await queuedQuery;

      if (queuedSongs.length === 0) return;

      const userIds = [...new Set(queuedSongs.map(s => s.userId.toString()))];
      let usersQuery = User.find({ _id: { $in: userIds }, tripId });
      if (session) usersQuery = usersQuery.session(session);
      const users = await usersQuery;
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
        }, { session });
      }
    } catch (error) {
      console.error('Error updating song positions:', error);
    }
  }

  async getQueueState(tripId, session = null) {
    let currentQuery = Song.findOne({
      tripId: tripId,
      status: 'PLAYING'
    });
    let queueQuery = Song.find({
      tripId: tripId,
      status: 'QUEUED'
    }).sort({ position: 1 });
    if (session) {
      currentQuery = currentQuery.session(session);
      queueQuery = queueQuery.session(session);
    }

    const currentSong = await currentQuery;
    const queue = await queueQuery;

    return {
      currentSong,
      queue
    };
  }

  async getCanonicalTripState(tripId, session = null) {
    let tripQuery = Trip.findById(tripId);
    let membersQuery = User.find({ tripId, isActive: true })
      .select('displayName role songsPlayed joinedAt');
    if (session) {
      tripQuery = tripQuery.session(session);
      membersQuery = membersQuery.session(session);
    }

    const trip = await tripQuery;
    if (!trip) return null;

    const queueState = await this.getQueueState(tripId, session);
    const members = await membersQuery;

    return {
      version: trip.queueMutationVersion || 0,
      trip,
      currentSong: queueState.currentSong,
      queue: queueState.queue,
      queueLocked: trip.queueLocked,
      isPlaying: trip.isPlaying,
      members,
      status: trip.status
    };
  }

  async commitTripMutation(tripId) {
    const trip = await Trip.findOneAndUpdate(
      { _id: tripId },
      { $inc: { queueMutationVersion: 1 } },
      { new: true }
    );
    return trip ? this.getCanonicalTripState(tripId) : null;
  }

  async getUserRequests(tripId, userId) {
    return await Song.find({
      tripId: tripId,
      userId: userId
    }).sort({ requestedAt: -1 });
  }
}

module.exports = QueueService;
