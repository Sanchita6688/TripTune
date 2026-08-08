const FairQueue = require('./fairQueue');

class FairnessMetrics {
  constructor() {
    this.fairQueue = new FairQueue();
  }

  calculateFairnessMetrics(trip, users, songs) {
    const metrics = {
      tripId: trip._id,
      tripName: trip.name,
      totalUsers: users.length,
      totalSongs: songs.length,
      userMetrics: {},
      overallFairness: 0,
      averageWaitTime: 0,
      queueDistribution: {}
    };

    // Calculate per-user metrics
    const activeUsers = users.filter(u => u.isActive);
    const playedSongs = songs.filter(s => s.status === 'PLAYED');
    const queuedSongs = songs.filter(s => s.status === 'QUEUED');

    activeUsers.forEach(user => {
      const userPlayed = playedSongs.filter(s => s.userId.toString() === user._id.toString());
      const userQueued = queuedSongs.filter(s => s.userId.toString() === user._id.toString());
      
      metrics.userMetrics[user.displayName] = {
        songsRequested: user.songsRequested || 0,
        songsPlayed: user.songsPlayed || 0,
        pendingCount: userQueued.length,
        lastPlayedAt: user.lastPlayedAt
      };
    });

    // Calculate overall fairness (standard deviation of played songs)
    const playedCounts = activeUsers.map(u => u.songsPlayed || 0);
    if (playedCounts.length > 0) {
      const avg = playedCounts.reduce((a, b) => a + b, 0) / playedCounts.length;
      const variance = playedCounts.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / playedCounts.length;
      metrics.overallFairness = Math.sqrt(variance);
    }

    // Calculate average wait time for played songs
    if (playedSongs.length > 0) {
      const waitTimes = playedSongs.map(song => {
        if (song.requestedAt && song.startedAt) {
          return (song.startedAt - song.requestedAt) / (1000 * 60); // in minutes
        }
        return 0;
      }).filter(t => t > 0);
      
      if (waitTimes.length > 0) {
        metrics.averageWaitTime = waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length;
      }
    }

    return metrics;
  }

  generateReport(metrics) {
    const report = {
      summary: {
        totalUsers: metrics.totalUsers,
        totalSongs: metrics.totalSongs,
        fairnessScore: metrics.overallFairness,
        averageWaitTime: `${Math.round(metrics.averageWaitTime)} minutes`
      },
      userDetails: {}
    };

    // Add user details
    Object.entries(metrics.userMetrics).forEach(([name, data]) => {
      report.userDetails[name] = {
        requested: data.songsRequested,
        played: data.songsPlayed,
        pending: data.pendingCount,
        ratio: data.songsPlayed > 0 ? 
          (data.songsRequested / data.songsPlayed).toFixed(2) : 
          'N/A'
      };
    });

    return report;
  }
}

module.exports = FairnessMetrics;
