const Song = require('../models/Song');
const User = require('../models/User');
const Trip = require('../models/Trip');
const QueueService = require('../services/queueService');

jest.mock('../models/Song', () => ({
  findOne: jest.fn(),
  find: jest.fn()
}));

jest.mock('../models/User', () => ({
  find: jest.fn()
}));

jest.mock('../models/Trip', () => ({
  findById: jest.fn(),
  findOneAndUpdate: jest.fn()
}));

const query = (value) => ({
  sort: jest.fn(),
  select: jest.fn(),
  session: jest.fn()
});

const awaitableQuery = (value) => {
  const result = Promise.resolve(value);
  result.sort = jest.fn().mockReturnValue(result);
  result.select = jest.fn().mockReturnValue(result);
  result.session = jest.fn().mockReturnValue(result);
  return result;
};

describe('Canonical trip state', () => {
  let queueService;

  beforeEach(() => {
    jest.clearAllMocks();
    queueService = new QueueService();
  });

  test('contains the complete authoritative state shape and version', async () => {
    const trip = {
      _id: 'trip-1',
      queueMutationVersion: 12,
      queueLocked: true,
      isPlaying: true,
      status: 'ACTIVE'
    };
    const currentSong = { _id: 'song-playing', status: 'PLAYING' };
    const queue = [{ _id: 'song-queued', status: 'QUEUED' }];
    const members = [{ _id: 'user-1', displayName: 'Alex' }];

    Trip.findById.mockResolvedValue(trip);
    Song.findOne.mockReturnValue(awaitableQuery(currentSong));
    Song.find.mockReturnValue(awaitableQuery(queue));
    User.find.mockReturnValue(awaitableQuery(members));

    const state = await queueService.getCanonicalTripState('trip-1');

    expect(state).toEqual({
      version: 12,
      trip,
      currentSong,
      queue,
      queueLocked: true,
      isPlaying: true,
      members,
      status: 'ACTIVE'
    });
  });

  test('committing a mutation increments the trip version once', async () => {
    const trip = { _id: 'trip-1', queueMutationVersion: 13 };
    Trip.findOneAndUpdate.mockResolvedValue(trip);
    Trip.findById.mockResolvedValue(trip);
    Song.findOne.mockReturnValue(awaitableQuery(null));
    Song.find.mockReturnValue(awaitableQuery([]));
    User.find.mockReturnValue(awaitableQuery([]));

    const state = await queueService.commitTripMutation('trip-1');

    expect(Trip.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'trip-1' },
      { $inc: { queueMutationVersion: 1 } },
      { new: true }
    );
    expect(state.version).toBe(13);
  });

  test('failed validation does not increment the version', async () => {
    const session = {};
    Trip.findById.mockReturnValue(awaitableQuery({ _id: 'trip-1', status: 'ENDED' }));

    await expect(queueService.addSongInTransaction('trip-1', 'user-1', { videoId: 'video-1' }, session))
      .rejects.toMatchObject({ status: 403 });
    expect(Trip.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
