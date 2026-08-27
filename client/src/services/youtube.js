import api from './api'

export const searchYouTube = async (query) => {
  const response = await api.get('/youtube/search', { params: { q: query } })
  if (response.data && Array.isArray(response.data.data)) {
    return response.data.data
  }
  if (Array.isArray(response.data)) return response.data
  return []
}

export const addSongToQueue = async (tripId, userId, sessionId, songData) => {
  const response = await api.post(`/trips/${tripId}/songs`, {
    userId,
    sessionId,
    provider: 'youtube',
    providerId: songData.videoId,
    title: songData.title,
    artistOrChannel: songData.channel,
    thumbnail: songData.thumbnail,
    duration: songData.duration
  })
  return response.data
}

export const removeSongFromQueue = async (tripId, songId, userId, sessionId) => {
  const response = await api.delete(`/trips/${tripId}/songs/${songId}`, {
    data: { userId, sessionId }
  })
  return response.data
}

export const skipCurrentSong = async (tripId, userId, sessionId) => {
  const response = await api.post(`/songs/${tripId}/skip`, { userId, sessionId })
  return response.data
}

export const notifySongEnded = async (tripId, songId, userId, sessionId) => {
  const response = await api.post(`/songs/${tripId}/ended`, { songId, userId, sessionId })
  return response.data
}

export const getUserRequests = async (tripId, userId, sessionId) => {
  try {
    const response = await api.get(`/trips/${tripId}/songs/my-requests`, { params: { userId, sessionId } })
    if (response.data && Array.isArray(response.data.data)) {
      return response.data.data
    }
    if (Array.isArray(response.data)) {
      return response.data
    }
    return []
  } catch (err) {
    console.error('getUserRequests service error:', err)
    return []
  }
}
