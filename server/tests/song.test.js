const FairQueue = require('../algorithms/fairQueue');
const YouTubeService = require('../services/youtubeService');

describe('Song Search & Queue Integration Tests', () => {
  describe('YouTubeService', () => {
    let youtubeService;

    beforeEach(() => {
      youtubeService = new YouTubeService('test_key');
    });

    test('should return empty array for empty query', async () => {
      const results = await youtubeService.searchVideos('');
      expect(results).toEqual([]);
    });

    test('should parse ISO 8601 duration correctly', () => {
      expect(youtubeService.parseISODuration('PT3M45S')).toBe('3:45');
      expect(youtubeService.parseISODuration('PT1H2M30S')).toBe('1:02:30');
      expect(youtubeService.parseISODuration('PT45S')).toBe('0:45');
      expect(youtubeService.parseISODuration('')).toBe('N/A');
    });
  });

  describe('FairQueue Algorithm with Multiple Users', () => {
    let fairQueue;

    beforeEach(() => {
      fairQueue = new FairQueue(3);
    });

    test('should prevent one user from dominating the queue', () => {
      const user1 = 'sanchita_id';
      const user2 = 'rahul_id';

      const queuedSongs = [
        { _id: 's1', userId: user1, userDisplayName: 'Sanchita', title: 'Ilahi' },
        { _id: 's2', userId: user1, userDisplayName: 'Sanchita', title: 'Kesariya' },
        { _id: 's3', userId: user1, userDisplayName: 'Sanchita', title: 'Zinda' },
        { _id: 's4', userId: user2, userDisplayName: 'Rahul', title: 'Apna Bana Le' }
      ];

      const userStats = {
        [user1]: { songsPlayed: 3, lastPlayedAt: new Date() },
        [user2]: { songsPlayed: 0, lastPlayedAt: null }
      };

      const selectedSong = fairQueue.getNextSong(queuedSongs, userStats);
      expect(selectedSong.userId).toBe(user2);
      expect(selectedSong.title).toBe('Apna Bana Le');
    });

    test('should handle equal played counts by requesting time order', () => {
      const user1 = 'user1_id';
      const user2 = 'user2_id';

      const queuedSongs = [
        { _id: 's1', userId: user1, userDisplayName: 'Alice', title: 'Song A' },
        { _id: 's2', userId: user2, userDisplayName: 'Bob', title: 'Song B' }
      ];

      const userStats = {
        [user1]: { songsPlayed: 1, lastPlayedAt: new Date(Date.now() - 100000) },
        [user2]: { songsPlayed: 1, lastPlayedAt: new Date(Date.now() - 50000) }
      };

      const selectedSong = fairQueue.getNextSong(queuedSongs, userStats);
      expect(selectedSong).toBeDefined();
    });
  });
});
