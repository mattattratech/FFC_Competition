# FFC Competition Jigsaw Puzzle

A competitive jigsaw puzzle application with database storage for tracking completion times and leaderboards.

## Features

- **8x8 Grid Puzzle**: Challenge mode with 64 pieces
- **Drag & Drop Interface**: Smooth piece movement between canvases
- **Smart Snap-back**: Incorrect placements return to original position
- **Competition Tracking**: Session IDs, timing, and accuracy metrics
- **Database Storage**: Persistent score storage with SQLite
- **User Registration**: Name and email collection on completion
- **Leaderboard System**: Track fastest completion times
- **Data Export**: Export all scores for analysis

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Server

```bash
npm start
```

### 3. Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

## API Endpoints

- `POST /api/scores` - Save a new score
- `GET /api/leaderboard` - Get top scores
- `GET /api/scores/export` - Export all scores
- `GET /api/stats` - Get statistics

## Database

Uses SQLite to store puzzle completion data including name, email, completion time, and session details.