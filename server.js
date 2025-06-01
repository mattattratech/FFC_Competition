const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Initialize SQLite database
let db;
try {
    db = new sqlite3.Database('./puzzle_scores.db', (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
            console.log('Database functionality will be disabled');
        } else {
            console.log('Connected to SQLite database');
            // Create scores table if it doesn't exist
            db.run(`CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                completion_time INTEGER NOT NULL,
                time_string TEXT NOT NULL,
                difficulty INTEGER NOT NULL,
                move_count INTEGER NOT NULL,
                accuracy INTEGER NOT NULL,
                completed_at TEXT NOT NULL,
                results_code TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) {
                    console.error('Error creating table:', err.message);
                } else {
                    console.log('Scores table ready');
                }
            });
        }
    });
} catch (error) {
    console.error('Failed to initialize database:', error.message);
    console.log('Running without database support');
}

// API Routes

// Database health check
app.get('/api/health', (req, res) => {
    console.log('🏥 Health check requested');
    
    if (!db) {
        return res.json({ 
            status: 'error', 
            database: 'not_available',
            message: 'Database connection failed'
        });
    }
    
    // Test database with a simple count query
    db.get('SELECT COUNT(*) as count FROM scores', [], (err, row) => {
        if (err) {
            console.error('❌ Health check failed:', err.message);
            res.json({ 
                status: 'error', 
                database: 'error',
                error: err.message
            });
        } else {
            console.log('✅ Health check passed - scores count:', row.count);
            res.json({ 
                status: 'healthy', 
                database: 'connected',
                scores_count: row.count,
                timestamp: new Date().toISOString()
            });
        }
    });
});

// Save a new score
app.post('/api/scores', (req, res) => {
    console.log('📥 Received POST /api/scores request');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    if (!db) {
        console.error('❌ Database not available');
        return res.status(503).json({ error: 'Database not available' });
    }
    
    const {
        sessionId,
        name,
        email,
        completionTime,
        timeString,
        difficulty,
        moveCount,
        accuracy,
        completedAt,
        resultsCode
    } = req.body;

    console.log('🔍 Validating fields...');
    console.log('sessionId:', sessionId);
    console.log('name:', name);
    console.log('email:', email);

    // Validate required fields
    if (!sessionId || !name || !email || !completionTime || !timeString || 
        !difficulty || !moveCount || accuracy === undefined || !completedAt || !resultsCode) {
        console.error('❌ Missing required fields');
        return res.status(400).json({ 
            error: 'Missing required fields',
            required: ['sessionId', 'name', 'email', 'completionTime', 'timeString', 'difficulty', 'moveCount', 'accuracy', 'completedAt', 'resultsCode'],
            received: req.body
        });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        console.error('❌ Invalid email format:', email);
        return res.status(400).json({ error: 'Invalid email format' });
    }

    console.log('✅ All validations passed, inserting into database...');

    const sql = `INSERT INTO scores (
        session_id, name, email, completion_time, time_string, 
        difficulty, move_count, accuracy, completed_at, results_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [
        sessionId, name, email, completionTime, timeString,
        difficulty, moveCount, accuracy, completedAt, resultsCode
    ], function(err) {
        if (err) {
            console.error('❌ Database error saving score:', err.message);
            console.error('SQL:', sql);
            console.error('Values:', [sessionId, name, email, completionTime, timeString, difficulty, moveCount, accuracy, completedAt, resultsCode]);
            res.status(500).json({ error: 'Failed to save score', details: err.message });
        } else {
            console.log(`✅ Score saved successfully with ID: ${this.lastID}`);
            console.log(`📊 Total changes: ${this.changes}`);
            res.json({ 
                id: this.lastID, 
                message: 'Score saved successfully',
                sessionId: sessionId
            });
        }
    });
});

// Get leaderboard (top scores)
app.get('/api/leaderboard', (req, res) => {
    console.log('📊 Received GET /api/leaderboard request');
    
    if (!db) {
        console.error('❌ Database not available for leaderboard');
        return res.status(503).json({ error: 'Database not available' });
    }
    
    const limit = req.query.limit || 10;
    const difficulty = req.query.difficulty;
    
    console.log('Query params - limit:', limit, 'difficulty:', difficulty);
    
    let sql = `SELECT 
        id, session_id, name, completion_time, time_string, 
        difficulty, move_count, accuracy, completed_at
    FROM scores`;
    
    let params = [];
    
    if (difficulty) {
        sql += ' WHERE difficulty = ?';
        params.push(difficulty);
    }
    
    sql += ' ORDER BY completion_time ASC LIMIT ?';
    params.push(limit);
    
    console.log('🔍 Executing SQL:', sql);
    console.log('Parameters:', params);

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('❌ Error fetching leaderboard:', err.message);
            res.status(500).json({ error: 'Failed to fetch leaderboard' });
        } else {
            console.log(`✅ Found ${rows.length} leaderboard entries`);
            console.log('First few entries:', rows.slice(0, 3));
            res.json(rows);
        }
    });
});

// Get all scores for export
app.get('/api/scores/export', (req, res) => {
    const sql = `SELECT * FROM scores ORDER BY completed_at DESC`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error exporting scores:', err.message);
            res.status(500).json({ error: 'Failed to export scores' });
        } else {
            res.json({
                total: rows.length,
                exported_at: new Date().toISOString(),
                scores: rows
            });
        }
    });
});

// Get statistics
app.get('/api/stats', (req, res) => {
    const sql = `SELECT 
        COUNT(*) as total_completions,
        AVG(completion_time) as avg_time,
        MIN(completion_time) as fastest_time,
        MAX(completion_time) as slowest_time,
        AVG(accuracy) as avg_accuracy,
        AVG(move_count) as avg_moves
    FROM scores`;
    
    db.get(sql, [], (err, row) => {
        if (err) {
            console.error('Error fetching stats:', err.message);
            res.status(500).json({ error: 'Failed to fetch statistics' });
        } else {
            res.json(row);
        }
    });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('API endpoints:');
    console.log('  GET /api/health - Database health check');
    console.log('  POST /api/scores - Save a new score');
    console.log('  GET /api/leaderboard - Get top scores');
    console.log('  GET /api/scores/export - Export all scores');
    console.log('  GET /api/stats - Get statistics');
});