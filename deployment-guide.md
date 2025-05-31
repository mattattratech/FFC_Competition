# Deployment Guide for FFC Competition Puzzle

## Option 1: GitHub Pages (Static - No Database)

### Pros:
- ✅ Free hosting
- ✅ Easy setup
- ✅ Automatic SSL
- ✅ Custom domain support

### Cons:
- ❌ No database storage
- ❌ Manual result collection

### Setup:
1. Push code to GitHub repository
2. Go to repository Settings → Pages
3. Select "Deploy from a branch" → main
4. URL: `https://yourusername.github.io/repository-name`

### Result Collection:
- Users copy their results code
- Email results to competition organizer
- Manual leaderboard management

## Option 2: Heroku (Full Database Support)

### Pros:
- ✅ Full Node.js support
- ✅ Database storage
- ✅ Automatic leaderboards
- ✅ Real-time data collection

### Setup:
1. Create Heroku account
2. Install Heroku CLI
3. Deploy with these commands:

```bash
# Initialize git and Heroku
git init
heroku create your-puzzle-app-name

# Add Heroku buildpack
heroku buildpacks:add heroku/nodejs

# Deploy
git add .
git commit -m "Deploy puzzle app"
git push heroku main
```

4. Your app: `https://your-puzzle-app-name.herokuapp.com`

## Option 3: Railway (Modern Alternative)

### Setup:
1. Go to railway.app
2. Connect GitHub repository
3. Deploy automatically
4. Custom domain available

## Option 4: Render (Free Tier)

### Setup:
1. Go to render.com
2. Connect GitHub
3. Choose "Web Service"
4. Auto-deploy from repository

## Recommended Approach

For a **competition**, I recommend:

### 🏆 **Heroku/Railway/Render** (if you want automatic data collection)
- Real-time leaderboard
- Automatic score validation
- Export functionality for results
- Professional setup

### 📝 **GitHub Pages** (if you want simple setup)
- Participants email results codes
- Manual leaderboard creation
- Lower hosting complexity
- Still fully functional puzzle

## Files Needed for Each Option

### GitHub Pages:
- `index.html` (modified for static hosting)
- `smarty.jpg`
- `README.md`

### Full Server Deployment:
- `index.html`
- `server.js`
- `package.json`
- `smarty.jpg`
- `README.md`

## Environment Variables (Server Deployment)

```bash
# Optional - defaults shown
PORT=3001
DATABASE_FILE=puzzle_scores.db
```

## Competition Management

### With Database:
- Access `/api/leaderboard` for real-time standings
- Export data via `/api/scores/export`
- View statistics at `/api/stats`

### Without Database:
- Collect emailed results codes
- Parse codes to extract: time, accuracy, session ID
- Create leaderboard manually

## Security Considerations

- No sensitive data stored
- Session IDs prevent result tampering
- Email validation included
- Results codes are timestamped