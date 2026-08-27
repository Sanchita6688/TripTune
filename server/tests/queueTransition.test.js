const Song = require('../models/Song');
const QueueService = require('../services/queueService');

jest.mock('../models/Song', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn()
}));

jest.mock('../models/User', () => ({}));
jest.mock('../models/Trip', () => ({}));

describe('QueueService terminal transitions', () => {
  let queueService;

  beforeEach(() => {
    jest.clearAllMocks();
    queueService = new QueueService();
  });

  test('skip atomically changes PLAYING to SKIPPED and advances once', async () => {
    const songA = { _id: 'song-a', status: 'SKIPPED' };
    const songB = { _id: 'song-b', status: 'PLAYING' };
    Song.findOneAndUpdate.mockResolvedValue(songA);
    queueService.getNextSong = jest.fn().mockResolvedValue(songB);

    const result = await queueService.transitionCurrentSong('trip-1', 'song-a', 'SKIPPED');

    expect(result).toEqual({ claimed: true, transitionedSong: songA, nextSong: songB });
    expect(Song.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'song-a', tripId: 'trip-1', status: 'PLAYING' },
      { status: 'SKIPPED', finishedAt: expect.any(Date) },
      { new: true }
    );
    expect(queueService.getNextSong).toHaveBeenCalledTimes(1);
  });

  test('ended atomically changes PLAYING to PLAYED', async () => {
    const songA = { _id: 'song-a', status: 'PLAYED' };
    Song.findOneAndUpdate.mockResolvedValue(songA);
    queueService.getNextSong = jest.fn().mockResolvedValue(null);

    const result = await queueService.transitionCurrentSong('trip-1', 'song-a', 'PLAYED');

    expect(result.claimed).toBe(true);
    expect(result.transitionedSong).toBe(songA);
    expect(Song.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'song-a', tripId: 'trip-1', status: 'PLAYING' },
      { status: 'PLAYED', finishedAt: expect.any(Date) },
      { new: true }
    );
  });

  test('concurrent skip and ended allow only one claimant to advance', async () => {
    const songA = { _id: 'song-a' };
    const songB = { _id: 'song-b', status: 'PLAYING' };
    let claimCount = 0;
    Song.findOneAndUpdate.mockImplementation(async () => {
      claimCount += 1;
      return claimCount === 1 ? songA : null;
    });
    queueService.getNextSong = jest.fn().mockResolvedValue(songB);

    const results = await Promise.all([
      queueService.transitionCurrentSong('trip-1', 'song-a', 'SKIPPED'),
      queueService.transitionCurrentSong('trip-1', 'song-a', 'PLAYED')
    ]);

    expect(results.filter(result => result.claimed)).toHaveLength(1);
    expect(queueService.getNextSong).toHaveBeenCalledTimes(1);
  });

  test.each(['PLAYED', 'SKIPPED'])('repeated %s transition is an idempotent no-op', async (terminalStatus) => {
    Song.findOneAndUpdate.mockResolvedValue(null);
    queueService.getNextSong = jest.fn();

    const result = await queueService.transitionCurrentSong('trip-1', 'song-a', terminalStatus);

    expect(result).toEqual({ claimed: false, nextSong: null });
    expect(queueService.getNextSong).not.toHaveBeenCalled();
  });
});