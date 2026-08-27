const mongoose = require('mongoose');
const Song = require('../models/Song');
const User = require('../models/User');
const Trip = require('../models/Trip');
const QueueService = require('../services/queueService');

jest.mock('mongoose', () => ({
  startSession: jest.fn()
}));

jest.mock('../models/Song', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  countDocuments: jest.fn()
}));

jest.mock('../models/User', () => ({
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findById: jest.fn()
}));

jest.mock('../models/Trip', () => ({
  findById: jest.fn().mockResolvedValue({ _id: 'trip-1', queueMutationVersion: 1 }),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn()
}));

const query = (value) => ({
  sort: jest.fn().mockReturnValue(Promise.resolve(value)),
  session: jest.fn().mockReturnValue(Promise.resolve(value)),
  select: jest.fn().mockReturnValue(Promise.resolve(value))
});

describe('Concurrent song addition safeguards', () => {
  let queueService;
  let session;

  beforeEach(() => {
    jest.clearAllMocks();
    Song.findOne.mockReturnValue(query(null));
    Song.find.mockReturnValue(query([]));
    User.find.mockReturnValue(query([]));
    session = {
      withTransaction: jest.fn(async callback => callback()),
      endSession: jest.fn().mockResolvedValue()
    };
    mongoose.startSession.mockResolvedValue(session);
    queueService = new QueueService();
  });

  test('each add operation runs inside a MongoDB transaction', async () => {
    queueService.addSongInTransaction = jest.fn().mockResolvedValue({ ok: true });

    await Promise.all([
      queueService.addSong('trip-1', 'user-1', { videoId: 'a' }),
      queueService.addSong('trip-1', 'user-2', { videoId: 'b' })
    ]);

    expect(session.withTransaction).toHaveBeenCalledTimes(2);
    expect(queueService.addSongInTransaction).toHaveBeenCalledTimes(2);
    expect(session.endSession).toHaveBeenCalledTimes(2);
  });

  test('duplicate-key recovery merges the requester into one playback item', async () => {
    const existingSong = { _id: 'song-a', userDisplayName: 'Alice' };
    User.findById.mockResolvedValue({ displayName: 'Bob' });
    Song.findOne.mockResolvedValue(existingSong);
    Song.findByIdAndUpdate.mockResolvedValue(existingSong);
    Song.findById.mockResolvedValue(existingSong);
    queueService.getQueueState = jest.fn().mockResolvedValue({ currentSong: existingSong, queue: [] });

    const result = await queueService.addDuplicateRequester('trip-1', 'user-2', { videoId: 'video-a' });

    expect(Song.findByIdAndUpdate).toHaveBeenCalledWith('song-a', {
      userDisplayName: 'Alice, Bob'
    });
    expect(result.isDuplicate).toBe(true);
    expect(result.song).toBe(existingSong);
  });

  test('first-song promotion uses a conditional QUEUED claim', async () => {
    const queuedSong = { _id: 'song-a', userId: 'user-1', userDisplayName: 'Alice' };
    const playingSong = { ...queuedSong, status: 'PLAYING' };
    Song.find.mockReturnValue(query([queuedSong]));
    User.find.mockResolvedValue([{ _id: 'user-1', songsPlayed: 0 }]);
    Song.findOneAndUpdate.mockResolvedValue(playingSong);
    User.findByIdAndUpdate.mockResolvedValue();
    Trip.findByIdAndUpdate.mockResolvedValue();
    queueService.updateSongPositions = jest.fn().mockResolvedValue();

    const result = await queueService.getNextSong('trip-1');

    expect(result).toBe(playingSong);
    expect(Song.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'song-a', tripId: 'trip-1', status: 'QUEUED' },
      { status: 'PLAYING', startedAt: expect.any(Date) },
      { new: true, session: null }
    );
  });
});
