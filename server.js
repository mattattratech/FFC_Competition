const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Force HTTPS in production, but allow health checks over HTTP
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        // Allow health checks over HTTP for Railway health monitoring
        if (req.path === '/api/health' || req.path === '/api/ready') {
            return next();
        }
        
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
let dbReady = false;
let dbError = null;
const fs = require('fs');

// Async database initialization function
async function initializeDatabase() {
    console.log('🗄️ Initializing database...');
    console.log('Current working directory:', process.cwd());
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('Platform:', process.platform);
    console.log('PORT:', process.env.PORT);
    
    // Check if we can write to the current directory
    try {
        fs.writeFileSync('./test-write.tmp', 'test');
        fs.unlinkSync('./test-write.tmp');
        console.log('✅ File system write access confirmed');
    } catch (err) {
        console.error('❌ Cannot write to file system:', err.message);
    }
    
    return new Promise((resolve) => {
        try {
            // Use absolute path for Railway
            const dbPath = process.env.NODE_ENV === 'production' ? '/tmp/puzzle_scores.db' : './puzzle_scores.db';
            console.log('📁 Database path:', dbPath);
            
            db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('❌ Error opening database:', err.message);
                    console.log('🚨 Database functionality will be disabled');
                    dbError = err;
                    dbReady = false;
                    resolve(false);
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
                            dbError = err;
                            dbReady = false;
                            resolve(false);
                        } else {
                            console.log('✅ Scores table ready');
                            
                            // Create quiz answers table
                            console.log('🔨 Creating quiz_answers table...');
                            db.run(createQuizTableSQL, (err) => {
                                if (err) {
                                    console.error('❌ Error creating quiz_answers table:', err.message);
                                    console.error('SQL:', createQuizTableSQL);
                                    dbError = err;
                                    dbReady = false;
                                    resolve(false);
                                } else {
                                    console.log('✅ Quiz answers table ready');
                                    
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
                                            dbError = err;
                                            dbReady = false;
                                            resolve(false);
                                        } else {
                                            console.log('✅ Test record inserted with ID:', this.lastID);
                                            // Clean up test record
                                            db.run('DELETE FROM scores WHERE session_id = ?', ['TEST-SESSION-123'], (err) => {
                                                if (!err) console.log('🧹 Test record cleaned up');
                                                dbReady = true;
                                                dbError = null;
                                                console.log('✅ Database initialization complete');
                                                resolve(true);
                                            });
                                        }
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
            dbError = error;
            dbReady = false;
            resolve(false);
        }
    });
}

// Start database initialization (non-blocking)
initializeDatabase().then((success) => {
    if (success) {
        console.log('🎉 Database ready for connections');
    } else {
        console.log('⚠️ Continuing without database functionality');
    }
});

// API Routes

// Enhanced health check for Railway deployment
app.get('/api/health', (req, res) => {
    console.log('🏥 Health check requested');
    console.log('Database ready:', dbReady);
    console.log('Database error:', dbError ? dbError.message : 'none');
    
    // Always respond with 200 OK to pass Railway health checks
    // Include database status in response body instead
    const healthResponse = {
        status: 'ok',
        server: 'running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 3001
    };
    
    if (!db) {
        healthResponse.database = {
            status: 'initializing',
            ready: false,
            error: dbError ? dbError.message : 'Connection not established yet'
        };
        console.log('⚠️ Health check: database still initializing');
        return res.json(healthResponse);
    }
    
    if (!dbReady) {
        healthResponse.database = {
            status: 'not_ready',
            ready: false,
            error: dbError ? dbError.message : 'Database initialization in progress'
        };
        console.log('⚠️ Health check: database not ready yet');
        return res.json(healthResponse);
    }
    
    // Test database with a simple count query (with timeout)
    const queryTimeout = setTimeout(() => {
        healthResponse.database = {
            status: 'timeout',
            ready: false,
            error: 'Query timeout'
        };
        console.log('⚠️ Health check: database query timeout');
        res.json(healthResponse);
    }, 5000);
    
    db.get('SELECT COUNT(*) as count FROM scores', [], (err, row) => {
        clearTimeout(queryTimeout);
        
        if (err) {
            console.error('❌ Health check database query failed:', err.message);
            healthResponse.database = {
                status: 'error',
                ready: true,
                error: err.message
            };
        } else {
            console.log('✅ Health check passed - scores count:', row.count);
            healthResponse.database = {
                status: 'healthy',
                ready: true,
                scores_count: row.count
            };
        }
        
        res.json(healthResponse);
    });
});

// Save a new score
app.post('/api/scores', (req, res) => {
    console.log('📥 Received POST /api/scores request');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    if (!db || !dbReady) {
        console.error('❌ Database not available or not ready');
        return res.status(503).json({ 
            error: 'Database not available', 
            ready: dbReady,
            dbError: dbError ? dbError.message : null
        });
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
    
    if (!db || !dbReady) {
        console.error('❌ Database not available or not ready for leaderboard');
        return res.status(503).json({ 
            error: 'Database not available', 
            ready: dbReady,
            dbError: dbError ? dbError.message : null
        });
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
    if (!db || !dbReady) {
        console.error('❌ Database not available for scores export');
        return res.status(503).json({ 
            error: 'Database not available', 
            ready: dbReady,
            dbError: dbError ? dbError.message : null
        });
    }
    
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

// Check for duplicate quiz submissions
app.post('/api/quiz-answers/check-duplicate', (req, res) => {
    console.log('🔍 Received POST /api/quiz-answers/check-duplicate request');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    if (!db || !dbReady) {
        console.error('❌ Database not available or not ready');
        return res.status(503).json({ 
            error: 'Database not available', 
            ready: dbReady,
            dbError: dbError ? dbError.message : null
        });
    }
    
    const { participantEmail, participantName } = req.body;

    console.log('🔍 Checking for duplicates...');
    console.log('participantEmail:', participantEmail);
    console.log('participantName:', participantName);

    // Validate required fields
    if (!participantEmail || !participantName) {
        console.error('❌ Missing required fields for duplicate check');
        return res.status(400).json({ 
            error: 'Missing required fields',
            required: ['participantEmail', 'participantName'],
            received: req.body
        });
    }

    // Check for existing entries with same email or name
    const sql = `SELECT COUNT(*) as count FROM quiz_answers 
                 WHERE participant_email = ? OR participant_name = ?`;

    console.log('🔍 Executing duplicate check SQL:', sql);
    console.log('Parameters:', [participantEmail, participantName]);

    db.get(sql, [participantEmail, participantName], (err, row) => {
        if (err) {
            console.error('❌ Database error checking for duplicates:', err.message);
            res.status(500).json({ error: 'Failed to check for duplicates', details: err.message });
        } else {
            const isDuplicate = row.count > 0;
            console.log(`✅ Duplicate check complete - found ${row.count} existing entries`);
            console.log('isDuplicate:', isDuplicate);
            
            res.json({ 
                isDuplicate: isDuplicate,
                existingCount: row.count,
                message: isDuplicate ? 'Entry already exists for this email or name' : 'No duplicate found'
            });
        }
    });
});

// Check for duplicate email across both scores and quiz_answers tables
app.post('/api/check-duplicate-email', (req, res) => {
    console.log('🔍 Received POST /api/check-duplicate-email request');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    if (!db || !dbReady) {
        console.error('❌ Database not available or not ready');
        return res.status(503).json({ 
            error: 'Database not available', 
            ready: dbReady,
            dbError: dbError ? dbError.message : null
        });
    }
    
    const { email } = req.body;

    console.log('🔍 Checking for duplicate email across both tables...');
    console.log('email:', email);

    // Validate required fields
    if (!email) {
        console.error('❌ Missing required email field');
        return res.status(400).json({ 
            error: 'Missing required field',
            required: ['email'],
            received: req.body
        });
    }

    // Check for existing entries with same email in both tables
    const sql = `SELECT 
        (SELECT COUNT(*) FROM scores WHERE email = ?) as scores_count,
        (SELECT COUNT(*) FROM quiz_answers WHERE participant_email = ?) as quiz_count`;

    console.log('🔍 Executing cross-table duplicate check SQL:', sql);
    console.log('Parameters:', [email, email]);

    db.get(sql, [email, email], (err, row) => {
        if (err) {
            console.error('❌ Database error checking for duplicate email:', err.message);
            res.status(500).json({ error: 'Failed to check for duplicate email', details: err.message });
        } else {
            const totalCount = row.scores_count + row.quiz_count;
            const isDuplicate = totalCount > 0;
            console.log(`✅ Cross-table duplicate check complete - found ${row.scores_count} in scores, ${row.quiz_count} in quiz_answers`);
            console.log('isDuplicate:', isDuplicate);
            
            res.json({ 
                isDuplicate: isDuplicate,
                scoresCount: row.scores_count,
                quizCount: row.quiz_count,
                totalCount: totalCount,
                message: isDuplicate ? 'Email already exists in the system' : 'No duplicate email found'
            });
        }
    });
});

// Submit quiz answers
app.post('/api/quiz-answers', (req, res) => {
    console.log('📥 Received POST /api/quiz-answers request');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    if (!db || !dbReady) {
        console.error('❌ Database not available or not ready');
        return res.status(503).json({ 
            error: 'Database not available', 
            ready: dbReady,
            dbError: dbError ? dbError.message : null
        });
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
    
    if (!db || !dbReady) {
        console.error('❌ Database not available or not ready for quiz export');
        return res.status(503).json({ 
            error: 'Database not available', 
            ready: dbReady,
            dbError: dbError ? dbError.message : null
        });
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
    
    if (!db || !dbReady) {
        console.error('❌ Database not available or not ready for combined leaderboard');
        return res.status(503).json({ 
            error: 'Database not available', 
            ready: dbReady,
            dbError: dbError ? dbError.message : null
        });
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
    if (!db || !dbReady) {
        console.error('❌ Database not available or not ready for statistics');
        return res.status(503).json({ 
            error: 'Database not available', 
            ready: dbReady,
            dbError: dbError ? dbError.message : null
        });
    }
    
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

// Enhanced graceful shutdown for production
const gracefulShutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down server gracefully...`);
    
    // Stop accepting new connections
    server.close((err) => {
        if (err) {
            console.error('Error closing server:', err.message);
            process.exit(1);
        }
        
        console.log('Server closed');
        
        // Close database connection
        if (db) {
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                    process.exit(1);
                } else {
                    console.log('Database connection closed');
                    process.exit(0);
                }
            });
        } else {
            process.exit(0);
        }
    });
    
    // Force close after timeout
    setTimeout(() => {
        console.error('Forcefully shutting down after timeout');
        process.exit(1);
    }, 10000);
};

// Add readiness endpoint for Railway
app.get('/api/ready', (req, res) => {
    const ready = dbReady && db;
    console.log('🔍 Readiness check:', ready ? 'READY' : 'NOT READY');
    
    if (ready) {
        res.json({ 
            status: 'ready',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(503).json({
            status: 'not_ready',
            database: dbReady ? 'connected' : 'not_ready',
            error: dbError ? dbError.message : 'Initialization in progress',
            timestamp: new Date().toISOString()
        });
    }
});

// Handle multiple shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Railway uses this

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    console.error('Stack trace:', err.stack);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

// Start server with improved startup logging
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 =================================');
    console.log('🚀 SERVER STARTUP COMPLETE');
    console.log('🚀 =================================');
    console.log(`🌐 Server running on: http://0.0.0.0:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Database path: ${process.env.NODE_ENV === 'production' ? '/tmp/puzzle_scores.db' : './puzzle_scores.db'}`);
    console.log(`📊 Database ready: ${dbReady}`);
    console.log(`⚡ Uptime: ${process.uptime().toFixed(2)}s`);
    console.log('📡 API endpoints:');
    console.log('  GET /api/health - Enhanced health check');
    console.log('  POST /api/scores - Save a new score');
    console.log('  GET /api/leaderboard - Get top scores');
    console.log('  GET /api/scores/export - Export all scores');
    console.log('  POST /api/quiz-answers/check-duplicate - Check for duplicate quiz submissions');
    console.log('  POST /api/check-duplicate-email - Check for duplicate email across both tables');
    console.log('  POST /api/quiz-answers - Submit quiz answers');
    console.log('  GET /api/quiz-answers/export - Export all quiz answers');
    console.log('  GET /api/leaderboard-with-quiz - Get combined leaderboard with quiz data');
    console.log('  GET /api/stats - Get statistics');
    console.log('🚀 =================================');
    console.log('✅ Server ready to accept connections');
    console.log('🔗 Health check: http://0.0.0.0:' + PORT + '/api/health');
    console.log('🚀 =================================');
});