const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
        } else {
            next();
        }
    });
}

app.use(express.static('.')); // Serve static files from current directory

// Initialize SQLite database
let db;
const fs = require('fs');

console.log('🗄️ Initializing database...');
console.log('Current working directory:', process.cwd());
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Platform:', process.platform);

// Check if we can write to the current directory
try {
    fs.writeFileSync('./test-write.tmp', 'test');
    fs.unlinkSync('./test-write.tmp');
    console.log('✅ File system write access confirmed');
} catch (err) {
    console.error('❌ Cannot write to file system:', err.message);
}

try {
    // Use absolute path for Railway
    const dbPath = process.env.NODE_ENV === 'production' ? '/tmp/puzzle_scores.db' : './puzzle_scores.db';
    console.log('📁 Database path:', dbPath);
    
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('❌ Error opening database:', err.message);
            console.log('🚨 Database functionality will be disabled');
        } else {
            console.log('✅ Connected to SQLite database at:', dbPath);
            
            // Create scores table if it doesn't exist
            const createTableSQL = `CREATE TABLE IF NOT EXISTS scores (
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
            )`;
            
            // Create quiz_answers table if it doesn't exist
            const createQuizTableSQL = `CREATE TABLE IF NOT EXISTS quiz_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                participant_name TEXT NOT NULL,
                participant_email TEXT NOT NULL,
                participant_mobile TEXT NOT NULL,
                question1_part1 TEXT,
                question1_part2 TEXT,
                question2 TEXT,
                question3_part1 TEXT,
                question3_part2 TEXT,
                question4_part1 TEXT,
                question4_part2 TEXT,
                question5_part1 TEXT,
                question5_part2 TEXT,
                question6 TEXT,
                recipient1_name TEXT,
                recipient1_role TEXT,
                recipient2_name TEXT,
                recipient2_position TEXT,
                question7 TEXT,
                additional_comments TEXT,
                submitted_at TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`;
            
            console.log('🔨 Creating scores table...');
            db.run(createTableSQL, (err) => {
                if (err) {
                    console.error('❌ Error creating scores table:', err.message);
                    console.error('SQL:', createTableSQL);
                } else {
                    console.log('✅ Scores table ready');
                    
                    // Create quiz answers table
                    console.log('🔨 Creating quiz_answers table...');
                    db.run(createQuizTableSQL, (err) => {
                        if (err) {
                            console.error('❌ Error creating quiz_answers table:', err.message);
                            console.error('SQL:', createQuizTableSQL);
                        } else {
                            console.log('✅ Quiz answers table ready');
                        }
                    });
                    
                    // Test insert to verify everything works
                    db.run(`INSERT INTO scores (
                        session_id, name, email, completion_time, time_string,
                        difficulty, move_count, accuracy, completed_at, results_code
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                        'TEST-SESSION-123', 'Test User', 'test@example.com', 
                        60000, '01:00:00', 8, 100, 85, new Date().toISOString(),
                        'TEST-RESULT-CODE'
                    ], function(err) {
                        if (err) {
                            console.error('❌ Test insert failed:', err.message);
                        } else {
                            console.log('✅ Test record inserted with ID:', this.lastID);
                            // Clean up test record
                            db.run('DELETE FROM scores WHERE session_id = ?', ['TEST-SESSION-123'], (err) => {
                                if (!err) console.log('🧹 Test record cleaned up');
                            });
                        }
                    });
                }
            });
        }
    });
} catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
    console.log('🚨 Running without database support');
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
        id, session_id, name, email, completion_time, time_string, 
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

// Submit quiz answers
app.post('/api/quiz-answers', (req, res) => {
    console.log('📥 Received POST /api/quiz-answers request');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    if (!db) {
        console.error('❌ Database not available');
        return res.status(503).json({ error: 'Database not available' });
    }
    
    const {
        sessionId,
        participantName,
        participantEmail,
        participantMobile,
        question1Part1,
        question1Part2,
        question2,
        question3Part1,
        question3Part2,
        question4Part1,
        question4Part2,
        question5Part1,
        question5Part2,
        question6,
        recipient1Name,
        recipient1Role,
        recipient2Name,
        recipient2Position,
        question7,
        additionalComments,
        submittedAt
    } = req.body;

    console.log('🔍 Validating quiz submission fields...');
    console.log('sessionId:', sessionId);
    console.log('participantName:', participantName);
    console.log('participantEmail:', participantEmail);
    console.log('participantMobile:', participantMobile);

    // Validate required fields
    if (!sessionId || !participantName || !participantEmail || !participantMobile || !submittedAt) {
        console.error('❌ Missing required fields for quiz submission');
        return res.status(400).json({ 
            error: 'Missing required fields',
            required: ['sessionId', 'participantName', 'participantEmail', 'participantMobile', 'submittedAt'],
            received: req.body
        });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(participantEmail)) {
        console.error('❌ Invalid email format:', participantEmail);
        return res.status(400).json({ error: 'Invalid email format' });
    }

    console.log('✅ All validations passed, inserting quiz answers into database...');

    const sql = `INSERT INTO quiz_answers (
        session_id, participant_name, participant_email, participant_mobile,
        question1_part1, question1_part2, question2, question3_part1, question3_part2,
        question4_part1, question4_part2, question5_part1, question5_part2, question6,
        recipient1_name, recipient1_role, recipient2_name, recipient2_position,
        question7, additional_comments, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [
        sessionId, participantName, participantEmail, participantMobile,
        question1Part1, question1Part2, question2, question3Part1, question3Part2,
        question4Part1, question4Part2, question5Part1, question5Part2, question6,
        recipient1Name, recipient1Role, recipient2Name, recipient2Position,
        question7, additionalComments, submittedAt
    ], function(err) {
        if (err) {
            console.error('❌ Database error saving quiz answers:', err.message);
            console.error('SQL:', sql);
            res.status(500).json({ error: 'Failed to save quiz answers', details: err.message });
        } else {
            console.log(`✅ Quiz answers saved successfully with ID: ${this.lastID}`);
            console.log(`📊 Total changes: ${this.changes}`);
            res.json({ 
                id: this.lastID, 
                message: 'Quiz answers saved successfully',
                sessionId: sessionId
            });
        }
    });
});

// Get all quiz answers for export
app.get('/api/quiz-answers/export', (req, res) => {
    console.log('📊 Received GET /api/quiz-answers/export request');
    
    if (!db) {
        console.error('❌ Database not available for quiz export');
        return res.status(503).json({ error: 'Database not available' });
    }
    
    const sql = `SELECT * FROM quiz_answers ORDER BY submitted_at DESC`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('❌ Error exporting quiz answers:', err.message);
            res.status(500).json({ error: 'Failed to export quiz answers' });
        } else {
            console.log(`✅ Exported ${rows.length} quiz submissions`);
            res.json({
                total: rows.length,
                exported_at: new Date().toISOString(),
                quiz_answers: rows
            });
        }
    });
});

// Get combined leaderboard with quiz answers
app.get('/api/leaderboard-with-quiz', (req, res) => {
    console.log('📊 Received GET /api/leaderboard-with-quiz request');
    
    if (!db) {
        console.error('❌ Database not available for combined leaderboard');
        return res.status(503).json({ error: 'Database not available' });
    }
    
    const limit = req.query.limit || 10;
    const difficulty = req.query.difficulty;
    
    let sql = `SELECT 
        s.id, s.session_id, s.name, s.email, s.completion_time, s.time_string, 
        s.difficulty, s.move_count, s.accuracy, s.completed_at,
        qa.participant_name as quiz_name, qa.participant_email as quiz_email, 
        qa.participant_mobile, qa.submitted_at as quiz_submitted_at,
        qa.question1_part1, qa.question1_part2, qa.question2, qa.question3_part1, qa.question3_part2,
        qa.question4_part1, qa.question4_part2, qa.question5_part1, qa.question5_part2, qa.question6,
        qa.recipient1_name, qa.recipient1_role, qa.recipient2_name, qa.recipient2_position,
        qa.question7, qa.additional_comments
    FROM scores s
    LEFT JOIN quiz_answers qa ON s.session_id = qa.session_id`;
    
    let params = [];
    
    if (difficulty) {
        sql += ' WHERE s.difficulty = ?';
        params.push(difficulty);
    }
    
    sql += ' ORDER BY s.completion_time ASC LIMIT ?';
    params.push(limit);
    
    console.log('🔍 Executing combined SQL:', sql);
    console.log('Parameters:', params);

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('❌ Error fetching combined leaderboard:', err.message);
            res.status(500).json({ error: 'Failed to fetch combined leaderboard' });
        } else {
            console.log(`✅ Found ${rows.length} combined leaderboard entries`);
            res.json(rows);
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
    console.log('  POST /api/quiz-answers - Submit quiz answers');
    console.log('  GET /api/quiz-answers/export - Export all quiz answers');
    console.log('  GET /api/leaderboard-with-quiz - Get combined leaderboard with quiz data');
    console.log('  GET /api/stats - Get statistics');
});