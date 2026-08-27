const broadcastTripState = (io, tripState) => {
  if (!io || !tripState?.trip?._id) return;
  io.to(`trip:${tripState.trip._id}`).emit('tripState', tripState);
};

module.exports = broadcastTripState;
