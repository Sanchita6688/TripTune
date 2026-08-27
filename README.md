# TripTune 🎵

**TripTune** is a real-time collaborative roadtrip music queue application designed to keep group trips fair and enjoyable. Passengers can search for YouTube songs and add them to a shared queue governed by a fair queuing algorithm that prevents any single user from dominating playback.

---

## 🌟 Key Features

- **Real-Time Collaborative Queue**: Socket.IO synchronization keeps all passengers and the host updated instantly without manual page refreshes.
- **Official YouTube Data API v3 Search**: Passengers search for tracks securely via the Express backend without exposing API keys.
- **Official YouTube IFrame Player API**: Host player loads the exact `videoId` selected by passengers and automatically triggers the next song upon completion.
- **Fair Queue Algorithm**: Prioritizes users with fewer played songs and prevents back-to-back plays from the same user when others are waiting.
- **Pending Song Limits**: Enforces a maximum of 3 pending songs per passenger (`MAX_PENDING_SONGS=3`).
- **Duplicate Prevention**: Intelligently handles duplicate song additions by listing multiple requesters without duplicating playback items.
- **My Requests Tracker**: Passengers can track their songs (Queued, Playing, Played, Skipped, Removed).
- **Host Control Master Panel**: Host controls for Play/Pause, Skip, Lock/Unlock Queue, and End Trip.
- **Session-Bound Access**: Host and passenger actions require a private session token, so a passenger cannot become host by changing a `userId` in the browser.
- **Pause and Resume**: Pausing the host player keeps the current YouTube position; resuming continues from that position.
- **Responsive Route Theme**: A route-map inspired interface with dark/light themes designed for desktop and mobile screens.

---

## 🎵 Song Search and Playback Workflow

1. **Passenger Searches for a Song**:
   Passenger types a search query (e.g. _Ilahi_) into the Add Song search interface and submits the form.
2. **Backend Queries YouTube Data API v3**:
   The Express backend receives `GET /api/youtube/search?q=Ilahi`, validates the request, and queries YouTube Data API v3 using `YOUTUBE_API_KEY`.
3. **Passenger Selects a Result**:
   Search results return clean structured data (thumbnail, title, channel name, duration). The passenger clicks **+ Add to Queue** on their chosen track.
4. **YouTube Video ID is Stored**:
   The backend stores the song record (`provider: "youtube"`, `providerId: "abc123"`, requester info, status: `"QUEUED"`) in MongoDB.
5. **Song Enters TripTune Queue**:
   The backend validates user trip membership, pending limits, and duplicate entries.
6. **Fair Queue Algorithm Determines Order**:
   `FairQueue` prioritizes users with fewer songs played, then uses request order to break ties.
7. **Host's YouTube IFrame Player Plays Video**:
   The host's browser loads the exact `videoId` into the YouTube IFrame player.
8. **Next Song Auto-Selection**:
   When YouTube's player fires the `ENDED` state (`0`), the client notifies the backend, marking the current track as `PLAYED` and transitioning automatically to the next fair queue selection.

When the host pauses playback, the YouTube iframe is kept mounted and controlled through the player API. This prevents a pause/resume action from reloading the video from the beginning.

---

## 🔑 Obtaining & Configuring YouTube API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., `TripTune`).
3. Navigate to **APIs & Services > Library** and search for **YouTube Data API v3**.
4. Click **Enable**.
5. Go to **APIs & Services > Credentials** and click **Create Credentials > API Key**.
6. Copy your generated API key.
7. Open `server/.env` (or copy from `server/.env.example`) and add your key:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/triptune
YOUTUBE_API_KEY=YOUR_ACTUAL_YOUTUBE_API_KEY
CLIENT_URL=http://localhost:3000
MAX_PENDING_SONGS=3
```

> **Security Note**: Never expose `YOUTUBE_API_KEY` on the frontend (`VITE_YOUTUBE_API_KEY`). All searches pass securely through the backend proxy route `GET /api/youtube/search`.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or newer
- MongoDB running locally, or a reachable MongoDB deployment
- A YouTube Data API v3 key for live search (the server has fallback demo results if the network/API is unavailable)

### 1. Backend Setup

```bash
cd server
npm install
npm run dev
```

### 2. Frontend Setup

```bash
cd client
npm install
npm run dev
```

### 3. Running Unit Tests

```bash
cd server
npm test
```

The frontend runs on `http://localhost:3000` by default. The backend runs on `http://localhost:5000`.

### Session and Host Security

TripTune creates a private session token for every host and passenger device. The server requires the matching token for queue changes, playback controls, trip ending, and request history.

- Do not share the host browser's local storage or session data with passengers.
- A join code is for joining a trip, not for obtaining host controls.
- Use a separate browser, incognito window, or device for each passenger during testing.
- If browser storage is cleared, join the trip again to create a new passenger session.

---

## 🧪 Testing Multi-User Workflow

1. **Host Device**: Open `http://localhost:3000` -> Click **Create New Trip** -> Enter "PICT Goa Trip" and Host "Alex". Copy the generated 6-character Join Code (for example, `GOA247`). Keep this browser private.
2. **Passenger Device 1**: On a different device or browser profile, open `http://localhost:3000` -> Click **Join Existing Trip** -> Enter `GOA247` and passenger name "Sanchita".
3. **Passenger Device 2**: On another device or browser profile, join the same trip as "Rahul".
4. **Search & Queue**: Sanchita searches "Ilahi" and clicks **+ Add to Queue**. Rahul immediately sees "Ilahi - Sanchita" in the live queue via Socket.IO without page refresh.
5. **Playback**: Alex (Host) starts the YouTube player. Pause it, wait, and resume to confirm it continues from the paused position. Upon song end, the player automatically advances to the next fair queue track.
