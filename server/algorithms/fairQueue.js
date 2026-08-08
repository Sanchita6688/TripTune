class FairQueue {
  constructor(maxPendingSongs = 3) {
    this.maxPendingSongs = maxPendingSongs;
  }

  /**
   * Pure Round-Robin Fair Queue algorithm.
   * Interleaves songs across users so every passenger gets their 1st song played
   * before anyone gets their 2nd song played, prioritizing passengers with fewer played songs.
   */
  getFairRoundRobinOrder(queuedSongs, userStats = {}) {
    if (!queuedSongs || queuedSongs.length === 0) return [];

    // Group songs by user in arrival order
    const userMap = new Map();
    queuedSongs.forEach(song => {
      const uId = song.userId ? song.userId.toString() : song.userDisplayName;
      if (!userMap.has(uId)) {
        const stats = userStats[uId] || { songsPlayed: 0, lastPlayedAt: null };
        userMap.set(uId, {
          userId: uId,
          displayName: song.userDisplayName,
          songsPlayed: stats.songsPlayed || 0,
          songs: []
        });
      }
      userMap.get(uId).songs.push(song);
    });

    const userList = Array.from(userMap.values());
    const ordered = [];

    // Round-robin selection loop
    while (userList.some(u => u.songs.length > 0)) {
      // Filter active users who still have pending songs
      const activeUsers = userList.filter(u => u.songs.length > 0);

      // Sort active users by:
      // 1. Fewer total songsPlayed (including simulated plays)
      // 2. Earliest requestedAt time of their next pending song
      activeUsers.sort((a, b) => {
        if (a.songsPlayed !== b.songsPlayed) {
          return a.songsPlayed - b.songsPlayed;
        }
        const timeA = new Date(a.songs[0].requestedAt || 0).getTime();
        const timeB = new Date(b.songs[0].requestedAt || 0).getTime();
        return timeA - timeB;
      });

      // Pick top fair user's next song
      const topUser = activeUsers[0];
      const nextSong = topUser.songs.shift();
      ordered.push(nextSong);
      topUser.songsPlayed += 1;
    }

    return ordered;
  }

  /**
   * Get next song from queue using Round-Robin Fair Queue logic
   */
  getNextSong(queuedSongs, userStats = {}) {
    const ordered = this.getFairRoundRobinOrder(queuedSongs, userStats);
    return ordered.length > 0 ? ordered[0] : null;
  }

  /**
   * Get fairness metrics for a trip
   */
  getFairnessMetrics(users, songs) {
    const metrics = {
      totalUsers: users.length,
      totalSongs: songs.length,
      distribution: {},
      fairnessScore: 0
    };

    const userSongs = {};
    songs.forEach(song => {
      const userId = song.userId ? song.userId.toString() : song.userDisplayName;
      if (!userSongs[userId]) {
        const user = users.find(u => u._id.toString() === userId);
        userSongs[userId] = {
          displayName: user ? user.displayName : song.userDisplayName || 'Unknown',
          played: 0,
          requested: 0,
          pending: 0
        };
      }
      if (song.status === 'PLAYED') {
        userSongs[userId].played++;
      } else if (song.status === 'QUEUED') {
        userSongs[userId].pending++;
      }
      userSongs[userId].requested++;
    });

    metrics.distribution = userSongs;

    const playedCounts = Object.values(userSongs).map(u => u.played);
    if (playedCounts.length > 0) {
      const avg = playedCounts.reduce((a, b) => a + b, 0) / playedCounts.length;
      const variance = playedCounts.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / playedCounts.length;
      metrics.fairnessScore = Math.sqrt(variance);
    }

    return metrics;
  }
}

module.exports = FairQueue;
