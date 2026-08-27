const User = require('../models/User');
const Trip = require('../models/Trip');
const TripSocketHandler = require('../sockets/tripSocket');

jest.mock('../models/User', () => ({
  findOne: jest.fn()
}));

jest.mock('../models/Trip', () => ({
  findById: jest.fn()
}));

const tripId = '507f1f77bcf86cd799439011';
const userId = '507f1f77bcf86cd799439012';
const otherTripId = '507f1f77bcf86cd799439013';

const socketFor = (overrides = {}) => ({
  data: {
    tripId,
    userId,
    sessionId: 'session-secret',
    ...overrides
  }
});

describe('Socket mutation authorization', () => {
  let handler;
  const passenger = { _id: userId, tripId, role: 'PASSENGER', isActive: true };
  const trip = { _id: tripId, hostId: '507f1f77bcf86cd799439099', status: 'ACTIVE' };

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new TripSocketHandler({});
    User.findOne.mockResolvedValue(passenger);
    Trip.findById.mockResolvedValue(trip);
  });

  test('authorizes a valid passenger session for its trip', async () => {
    const result = await handler.authorizeSocketMutation(socketFor(), { tripId, userId });

    expect(result.user).toBe(passenger);
    expect(result.trip).toBe(trip);
    expect(User.findOne).toHaveBeenCalledWith({
      _id: userId,
      tripId,
      sessionId: 'session-secret',
      isActive: true
    });
  });

  test('rejects a missing session', async () => {
    const result = await handler.authorizeSocketMutation(
      socketFor({ sessionId: null }),
      { tripId, userId }
    );

    expect(result).toBeNull();
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test('rejects a payload targeting another trip', async () => {
    const result = await handler.authorizeSocketMutation(
      socketFor(),
      { tripId: otherTripId, userId }
    );

    expect(result).toBeNull();
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test('rejects a passenger from host-only actions', async () => {
    const result = await handler.authorizeSocketMutation(
      socketFor(),
      { tripId, userId, role: 'HOST' },
      { requireHost: true }
    );

    expect(result).toBeNull();
  });

  test('requires both HOST role and actual trip ownership', async () => {
    User.findOne.mockResolvedValue({ ...passenger, role: 'HOST' });

    const notOwner = await handler.authorizeSocketMutation(
      socketFor(),
      { tripId, userId },
      { requireHost: true }
    );
    expect(notOwner).toBeNull();

    Trip.findById.mockResolvedValue({ ...trip, hostId: userId });
    const owner = await handler.authorizeSocketMutation(
      socketFor(),
      { tripId, userId },
      { requireHost: true }
    );
    expect(owner.user.role).toBe('HOST');
  });
});
