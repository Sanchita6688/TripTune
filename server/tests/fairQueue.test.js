const FairQueue = require('../algorithms/fairQueue');

describe('FairQueue Algorithm', () => {
  let fairQueue;

  beforeEach(() => {
    fairQueue = new FairQueue(3);
  });

  test('should return null when queue is empty', () => {
    const nextSong = fairQueue.getNextSong([], {});
    expect(nextSong).toBeNull();
  });

  test('should give priority to user with fewer played songs', () => {
    const user1Id = 'user1';
    const user2Id = 'user2';

    const queuedSongs = [
      {
        _id: 'song1',
        userId: user1Id,
        userDisplayName: 'Alice',
        title: 'Song 1'
      },
      {
        _id: 'song2',
        userId: user2Id,
        userDisplayName: 'Bob',
        title: 'Song 2'
      }
    ];

    const userStats = {
      [user1Id]: { songsPlayed: 3, lastPlayedAt: new Date(Date.now() - 1000 * 60 * 60) },
      [user2Id]: { songsPlayed: 0, lastPlayedAt: null }
    };

    const nextSong = fairQueue.getNextSong(queuedSongs, userStats);
    expect(nextSong.userId).toBe(user2Id);
  });
});
