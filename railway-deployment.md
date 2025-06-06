# Railway.app Deployment Guide

## 🚀 Production Deployment Checklist

### 1. Pre-Deployment Setup

#### Environment Variables (Set in Railway Dashboard):
```
NODE_ENV=production
PORT=3001 (Railway sets this automatically)
```

#### Files Required:
- ✅ `railway.json` - Railway configuration with health checks
- ✅ `Procfile` - Process definition for Railway
- ✅ `package.json` - Dependencies and Node.js version
- ✅ `server.js` - Main application with production optimizations

### 2. Railway Configuration Features

#### `railway.json` includes:
- **Health Check**: `/api/health` endpoint monitoring
- **Auto Restart**: On failure with 10 retry limit
- **Graceful Shutdown**: Handles SIGTERM/SIGUSR2 signals

#### Production Optimizations:
- **Database**: Uses `/tmp/puzzle_scores.db` in production (ephemeral but suitable for competition)
- **Error Handling**: Comprehensive uncaught exception handling
- **Graceful Shutdown**: 10-second timeout for clean shutdowns
- **HTTPS Redirect**: Automatic in production environment

### 3. Deployment Steps

1. **Connect Repository**: Link your GitHub repo to Railway
2. **Configure Build**: Railway auto-detects Node.js and uses `npm start`
3. **Set Environment**: Railway sets `NODE_ENV=production` automatically
4. **Deploy**: Push to main branch triggers automatic deployment

### 4. Monitoring & Health Checks

#### Health Check Endpoint: `/api/health`
Returns:
```json
{
  "status": "healthy",
  "database": "connected", 
  "scores_count": 123,
  "timestamp": "2025-06-06T15:00:00.000Z"
}
```

#### Server Logs Include:
- Database connection status
- API endpoint listings
- Request/response logging
- Error tracking with stack traces

### 5. Production Database

#### SQLite Configuration:
- **Development**: `./puzzle_scores.db` (persistent)
- **Production**: `/tmp/puzzle_scores.db` (ephemeral - resets on restart)

#### Tables Created Automatically:
- `scores` - Puzzle completion data
- `quiz_answers` - Competition quiz submissions

### 6. API Endpoints Available

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Health check |
| POST | `/api/scores` | Save puzzle completion |
| GET | `/api/leaderboard` | Get top scores |
| GET | `/api/scores/export` | Export all scores |
| POST | `/api/quiz-answers/check-duplicate` | Check duplicates |
| POST | `/api/quiz-answers` | Submit quiz answers |
| GET | `/api/quiz-answers/export` | Export quiz data |
| GET | `/api/leaderboard-with-quiz` | Combined data |
| GET | `/api/stats` | Statistics |

### 7. Troubleshooting

#### Common Issues:
1. **Build Fails**: Check Node.js version in `package.json`
2. **Health Check Fails**: Verify `/api/health` endpoint
3. **Database Issues**: Check production logs for SQLite errors
4. **CORS Issues**: Enabled for all origins in production

#### Debug Commands:
```bash
# Check Railway logs
railway logs

# Check service status  
railway status

# Restart service
railway restart
```

### 8. Backup & Data Export

#### Export Competition Data:
- `GET /api/scores/export` - All puzzle completions
- `GET /api/quiz-answers/export` - All quiz submissions
- `GET /api/leaderboard-with-quiz` - Combined results

#### Important Notes:
- **Database is ephemeral** - export data before Railway restarts
- **Consider PostgreSQL** for permanent storage if needed
- **Regular exports** recommended during competition period

### 9. Security Features

- ✅ HTTPS enforcement in production
- ✅ CORS enabled for cross-origin requests  
- ✅ Input validation on all endpoints
- ✅ SQL injection protection with parameterized queries
- ✅ Error handling without sensitive data exposure

### 10. Performance Optimizations

- ✅ Express.js static file serving
- ✅ SQLite with optimized queries
- ✅ Graceful connection handling
- ✅ Memory-efficient JSON parsing
- ✅ Proper HTTP status codes

## 🎯 Ready for Production!

Your Railway deployment is configured for:
- **High Availability**: Auto-restart on failures
- **Monitoring**: Health checks and logging
- **Security**: HTTPS and input validation
- **Performance**: Optimized database and serving
- **Reliability**: Graceful shutdowns and error handling

Deploy with confidence! 🚀