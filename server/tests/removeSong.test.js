const mongoose = require('mongoose');
const Song = require('../models/Song');
const Trip = require('../models/Trip');
const QueueService = require('../services/queueService');

jest.mock('../models/Song', () => ({
  findOneAndUpdate: jest.fn()
}));

jest.mock('../models/Trip', () => ({
  findOneAndUpdate: jest.fn()
}));

const tripState = (currentSong, queue, version = 1) => ({
  version,
  trip: { _id: 'trip-1' },
  currentSong,
  queue,
  queueLocked: false,
  isPlaying: Boolean(currentSong),
  members: [],
  status: 'ACTIVE'
});

describe('QueueService removeSong', () => {
  let queueService;
  let session;
  let canonicalState;

  beforeEach(() => {
    jest.clearAllMocks();
    canonicalState = tripState(null, [], 2);
    session = {
      withTransaction: jest.fn(async callback => callback()),
      endSession: jest.fn().mockResolvedValue()
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
    Trip.findOneAndUpdate.mockResolvedValue({ _id: 'trip-1' });
    queueService = new QueueService();
    queueService.updateSongPositions = jest.fn().mockResolvedValue();
    queueService.getCanonicalTripState = jest.fn().mockResolvedValue(canonicalState);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('removing the playing song promotes exactly one next song', async () => {
    const songA = { _id: 'song-a', status: 'REMOVED' };
    const songB = { _id: 'song-b', status: 'PLAYING' };
    Song.findOneAndUpdate.mockResolvedValueOnce(songA);
    queueService.getNextSong = jest.fn().mockResolvedValue(songB);
    canonicalState = tripState(songB, [], 3);
    queueService.getCanonicalTripState.mockResolvedValue(canonicalState);

    const result = await queueService.removeSong('trip-1', 'song-a');

    expect(result.changed).toBe(true);
    expect(result.removedSong).toBe(songA);
    expect(result.nextSong).toBe(songB);
    expect(queueService.getNextSong).toHaveBeenCalledWith('trip-1', session);
    expect(queueService.updateSongPositions).toHaveBeenCalledWith('trip-1', session);
    expect(result.tripState.currentSong).toBe(songB);
    expect(result.tripState.isPlaying).toBe(true);
    expect(Trip.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'trip-1' },
      { $inc: { queueMutationVersion: 1 } },
      { new: true, session }
    );
  });

  test('removing the playing song with an empty queue stops playback', async () => {
    const songA = { _id: 'song-a', status: 'REMOVED' };
    Song.findOneAndUpdate.mockResolvedValueOnce(songA);
    queueService.getNextSong = jest.fn().mockResolvedValue(null);
    canonicalState = tripState(null, [], 3);
    queueService.getCanonicalTripState.mockResolvedValue(canonicalState);

    const result = await queueService.removeSong('trip-1', 'song-a');

    expect(result.nextSong).toBeNull();
    expect(result.tripState.currentSong).toBeNull();
    expect(result.tripState.isPlaying).toBe(false);
    expect(Trip.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'trip-1' },
      { currentSongId: null, isPlaying: false },
      { new: true, session }
    );
  });

  test('removing a queued song does not promote another song', async () => {
    const songC = { _id: 'song-c', status: 'REMOVED' };
    Song.findOneAndUpdate
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(songC);
    queueService.getNextSong = jest.fn();
    canonicalState = tripState({ _id: 'song-a', status: 'PLAYING' }, [{ _id: 'song-b' }], 4);
    queueService.getCanonicalTripState.mockResolvedValue(canonicalState);

    const result = await queueService.removeSong('trip-1', 'song-c');

    expect(result.changed).toBe(true);
    expect(result.nextSong).toBeNull();
    expect(queueService.getNextSong).not.toHaveBeenCalled();
    expect(result.tripState.currentSong._id).toBe('song-a');
    expect(result.tripState.isPlaying).toBe(true);
  });

  test('repeated removal is an idempotent no-op without version increment', async () => {
    Song.findOneAndUpdate
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    queueService.getCanonicalTripState.mockResolvedValue(canonicalState);

    const result = await queueService.removeSong('trip-1', 'song-a');

    expect(result).toEqual({
      changed: false,
      alreadyHandled: true,
      tripState: canonicalState
    });
    expect(queueService.updateSongPositions).not.toHaveBeenCalled();
    expect(Trip.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});
