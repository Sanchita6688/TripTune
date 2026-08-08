const express = require('express');
const router = express.Router();
const YouTubeService = require('../services/youtubeService');

const youtubeService = new YouTubeService();

// GET /api/youtube/search?q=query
router.get('/search', async (req, res) => {
  try {
    const { q, maxResults } = req.query;
    
    if (!q || typeof q !== 'string' || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query parameter q is required'
      });
    }

    const results = await youtubeService.searchVideos(q, maxResults);
    
    return res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('YouTube search error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to search YouTube right now. Please try again.'
    });
  }
});

module.exports = router;
