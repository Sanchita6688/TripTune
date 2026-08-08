const axios = require('axios');

class YouTubeService {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.YOUTUBE_API_KEY;
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
  }

  // Dynamic live search parser fallback when YOUTUBE_API_KEY is not set or quota exceeded
  async searchDynamicFallback(query, maxResults = 15) {
    try {
      const response = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 6000
      });

      const html = response.data;
      const match = html.match(/ytInitialData\s*=\s*({.+?});\s*<\/script>/);
      
      if (match) {
        const data = JSON.parse(match[1]);
        const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
        
        const videos = [];
        for (const item of contents) {
          if (item.videoRenderer) {
            const v = item.videoRenderer;
            const videoId = v.videoId;
            if (!videoId) continue;

            const title = v.title?.runs?.[0]?.text || 'Untitled Video';
            const channel = v.ownerText?.runs?.[0]?.text || v.longBylineText?.runs?.[0]?.text || 'Unknown Artist';
            const duration = v.lengthText?.simpleText || '3:45';
            
            const thumbUrl = v.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

            videos.push({
              videoId,
              title,
              channel,
              thumbnail: thumbUrl,
              description: title,
              duration
            });

            if (videos.length >= maxResults) break;
          }
        }

        if (videos.length > 0) {
          return videos;
        }
      }
    } catch (err) {
      console.error('Dynamic search error:', err.message);
    }

    // Ultimate fallback demo tracks if network completely fails
    return this.getStaticFallback(query);
  }

  getStaticFallback(query) {
    const q = (query || '').toLowerCase();
    const demos = [
      {
        videoId: 'Vz7522XhL_Y',
        title: 'Ilahi - Yeh Jawaani Hai Deewani | Arijit Singh',
        channel: 'T-Series',
        thumbnail: 'https://i.ytimg.com/vi/Vz7522XhL_Y/hqdefault.jpg',
        description: 'Ilahi from Yeh Jawaani Hai Deewani.',
        duration: '3:49'
      },
      {
        videoId: 'BddP6PYo2gs',
        title: 'Kesariya - Brahmāstra | Arijit Singh',
        channel: 'Sony Music India',
        thumbnail: 'https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg',
        description: 'Kesariya from Brahmastra.',
        duration: '4:28'
      },
      {
        videoId: '4NRXx6U8ABQ',
        title: 'The Weeknd - Blinding Lights (Official Video)',
        channel: 'The Weeknd',
        thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
        description: 'Blinding Lights by The Weeknd.',
        duration: '4:23'
      },
      {
        videoId: 'nn_0zPAfyo8',
        title: 'Taylor Swift – august (Official Lyric Video)',
        channel: 'Taylor Swift',
        thumbnail: 'https://i.ytimg.com/vi/nn_0zPAfyo8/hqdefault.jpg',
        description: 'August by Taylor Swift.',
        duration: '4:24'
      },
      {
        videoId: 'Ax0G_P2dSB8',
        title: 'Zinda - Bhaag Milkha Bhaag | Siddharth Mahadevan',
        channel: 'Sony Music India',
        thumbnail: 'https://i.ytimg.com/vi/Ax0G_P2dSB8/hqdefault.jpg',
        description: 'Zinda rock track.',
        duration: '3:31'
      }
    ];

    const filtered = demos.filter(d => 
      d.title.toLowerCase().includes(q) || 
      d.channel.toLowerCase().includes(q)
    );

    return filtered.length > 0 ? filtered : demos;
  }

  async searchVideos(query, maxResults = 15) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return [];
    }

    const cleanQuery = query.trim();

    // If API Key is not set or default, use dynamic search fallback immediately
    if (!this.apiKey || this.apiKey === 'YOUR_YOUTUBE_API_KEY_HERE' || this.apiKey === 'your_youtube_api_key_here') {
      return await this.searchDynamicFallback(cleanQuery, maxResults);
    }

    try {
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: {
          part: 'snippet',
          q: cleanQuery,
          maxResults: Math.min(Math.max(parseInt(maxResults) || 15, 1), 25),
          type: 'video',
          videoEmbeddable: 'true',
          key: this.apiKey
        },
        timeout: 8000
      });

      if (!response.data || !response.data.items || response.data.items.length === 0) {
        return await this.searchDynamicFallback(cleanQuery, maxResults);
      }

      const videoItems = response.data.items.filter(item => item.id && item.id.videoId);
      if (videoItems.length === 0) {
        return await this.searchDynamicFallback(cleanQuery, maxResults);
      }

      const videoIds = videoItems.map(item => item.id.videoId);
      const durationsMap = await this.getVideoDurations(videoIds);

      return videoItems.map(item => {
        const videoId = item.id.videoId;
        const snippet = item.snippet || {};
        const thumbnails = snippet.thumbnails || {};
        const bestThumbnail = (thumbnails.medium || thumbnails.high || thumbnails.default || {}).url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        return {
          videoId,
          title: snippet.title || 'Untitled Song',
          channel: snippet.channelTitle || 'Unknown Channel',
          thumbnail: bestThumbnail,
          description: snippet.description || '',
          duration: durationsMap[videoId] || '3:45'
        };
      });
    } catch (error) {
      console.error('YouTube Official API Search error (falling back to dynamic search):', error.message);
      return await this.searchDynamicFallback(cleanQuery, maxResults);
    }
  }

  async getVideoDurations(videoIds) {
    if (!videoIds || videoIds.length === 0) return {};

    try {
      const response = await axios.get(`${this.baseUrl}/videos`, {
        params: {
          part: 'contentDetails',
          id: videoIds.join(','),
          key: this.apiKey
        },
        timeout: 5000
      });

      const durationsMap = {};
      if (response.data && response.data.items) {
        response.data.items.forEach(item => {
          const id = item.id;
          const isoDuration = item.contentDetails?.duration || '';
          durationsMap[id] = this.parseISODuration(isoDuration);
        });
      }
      return durationsMap;
    } catch (error) {
      return {};
    }
  }

  parseISODuration(duration) {
    if (!duration) return 'N/A';
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 'N/A';
    
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
}

module.exports = YouTubeService;
