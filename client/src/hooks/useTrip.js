import { useState, useEffect } from 'react'
import api from '../services/api'

export const useTrip = (tripId) => {
  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchTrip = async () => {
      try {
        setLoading(true)
        const response = await api.get(`/trips/${tripId}`)
        setTrip(response.data)
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to fetch trip')
      } finally {
        setLoading(false)
      }
    }

    if (tripId) {
      fetchTrip()
    }
  }, [tripId])

  return { trip, loading, error }
}
