import api from './api'

export const searchYouTube = async (query) => {
  try {
    const response = await api.get(`/youtube/search?q=${encodeURIComponent(query)}`)
    if (response.data && Array.isArray(response.data.data)) {
      return response.data.data
    }
    if (Array.isArray(response.data)) {
      return response.data
    }
    return []
  } catch (err) {
    console.error('searchYouTube service error:', err)
    return []
  }
}

export const addSongToQueue = async (tripId, userId, songData) => {
  const response = await api.post(`/trips/${tripId}/songs`, {
    userId,
    provider: 'youtube',
    providerId: songData.videoId,
    title: songData.title,
    artistOrChannel: songData.channel,
    thumbnail: songData.thumbnail,
    duration: songData.duration
  })
  return response.data
}

export const removeSongFromQueue = async (tripId, songId, userId) => {
  const response = await api.delete(`/trips/${tripId}/songs/${songId}`, {
    data: { userId }
  })
  return response.data
}

export const skipCurrentSong = async (tripId, userId) => {
  const response = await api.post(`/trips/${tripId}/skip`, { userId })
  return response.data
}

export const notifySongEnded = async (tripId, songId) => {
  const response = await api.post(`/trips/${tripId}/ended`, { songId })
  return response.data
}

export const getUserRequests = async (tripId, userId) => {
  try {
    const response = await api.get(`/trips/${tripId}/songs/my-requests?userId=${userId}`)
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
