const User = require('../models/User');
const TripSocketHandler = require('../sockets/tripSocket');

jest.mock('../models/User', () => ({
  findOneAndUpdate: jest.fn()
}));

describe('Socket disconnect cleanup', () => {
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new TripSocketHandler({});
    handler.queueService.commitTripMutation = jest.fn().mockResolvedValue({
      version: 4,
      trip: { _id: 'trip-a' },
      currentSong: null,
      queue: [],
      queueLocked: false,
      isPlaying: false,
      members: [],
      status: 'ACTIVE'
    });
    handler.io.to = jest.fn().mockReturnValue({ emit: jest.fn() });
  });

  test('marks the matching disconnected member inactive and clears socketId', async () => {
    User.findOneAndUpdate.mockResolvedValue({ _id: 'user-a', isActive: false });

    const cleaned = await handler.cleanupDisconnectedSocket('trip-a', 'user-a', 'socket-a');

    expect(cleaned).toBe(true);
    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'user-a', tripId: 'trip-a', socketId: 'socket-a', isActive: true },
      { isActive: false, socketId: null, lastSeenAt: expect.any(Date) },
      { new: true }
    );
    expect(handler.queueService.commitTripMutation).toHaveBeenCalledWith('trip-a');
  });

  test('old socket cleanup cannot deactivate a newer connection', async () => {
    User.findOneAndUpdate.mockResolvedValue(null);

    const cleaned = await handler.cleanupDisconnectedSocket('trip-a', 'user-a', 'old-socket');

    expect(cleaned).toBe(false);
    expect(handler.queueService.commitTripMutation).not.toHaveBeenCalled();
    expect(handler.io.to).not.toHaveBeenCalled();
  });

  test('cleanup is scoped to the disconnected trip', async () => {
    User.findOneAndUpdate.mockResolvedValue(null);

    await handler.cleanupDisconnectedSocket('trip-a', 'user-a', 'socket-a');

    expect(User.findOneAndUpdate.mock.calls[0][0].tripId).toBe('trip-a');
  });
});