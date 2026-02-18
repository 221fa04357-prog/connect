const express = require('express');
const cors = require('cors');
const db = require('./db');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const groqService = require('./groqService');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Sanitize FRONTEND_URL to remove trailing slash (CORS requires exact match)
const frontendOrigin = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, "") : "*";

// Database Initialization Logic
async function initializeDatabase() {
    try {
        console.log('Verifying/Creating database tables...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id VARCHAR(255) PRIMARY KEY,
                settings JSONB NOT NULL DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                sender_id VARCHAR(255) NOT NULL,
                sender_name VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                type VARCHAR(50) NOT NULL,
                meeting_id VARCHAR(255),
                timestamp TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS recaps (
                id VARCHAR(255) PRIMARY KEY,
                title TEXT NOT NULL,
                date VARCHAR(100),
                timestamp BIGINT,
                host VARCHAR(255),
                duration VARCHAR(50),
                participants JSONB DEFAULT '[]',
                summary JSONB DEFAULT '[]',
                action_items JSONB DEFAULT '[]',
                transcript JSONB DEFAULT '[]',
                time VARCHAR(50),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            -- Ensure updated_at exists for existing databases
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recaps' AND column_name='updated_at') THEN
                    ALTER TABLE recaps ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recaps' AND column_name='time') THEN
                    ALTER TABLE recaps ADD COLUMN time VARCHAR(50);
                END IF;
            END $$;

            CREATE TABLE IF NOT EXISTS meetings (
                id VARCHAR(255) PRIMARY KEY,
                title TEXT NOT NULL,
                host_id VARCHAR(255) NOT NULL,
                start_time TIMESTAMP NOT NULL,
                start_timestamp BIGINT,
                duration INTEGER DEFAULT 60,
                status VARCHAR(50) DEFAULT 'scheduled',
                settings JSONB DEFAULT '{}',
                password VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            -- Add start_timestamp if missing
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meetings' AND column_name='start_timestamp') THEN
                    ALTER TABLE meetings ADD COLUMN start_timestamp BIGINT;
                END IF;
            END $$;

            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                avatar TEXT,
                subscription_plan VARCHAR(50) DEFAULT 'free',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('Database initialization successful: all tables ready.');
    } catch (err) {
        console.error('Database initialization failed:', err);
    }
}

// Start database initialization
initializeDatabase();

const io = new Server(server, {
    cors: {
        origin: frontendOrigin,
        methods: ["GET", "POST"],
        credentials: true
    }
});

const port = process.env.PORT || 5001;

app.use(cors({
    origin: frontendOrigin,
    credentials: true
}));

app.use(express.json());

// Root route
app.get("/", (req, res) => {
    res.json({
        status: "ok",
        message: "Backend is running 🚀"
    });
});

// Socket.io Logic
const rooms = new Map(); // meetingId -> Set of {socketId, userId, name, role}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join_meeting', (data) => {
        const { meetingId, user } = typeof data === 'string' ? { meetingId: data, user: null } : data;
        socket.join(meetingId);

        // Track participant
        if (!rooms.has(meetingId)) {
            rooms.set(meetingId, new Map());
        }

        const room = rooms.get(meetingId);
        const userId = user?.id || `guest-${socket.id}`;

        // Cleanup: remove any existing entries for this user in this room (prevent duplicates on refresh)
        for (const [existingSocketId, existingParticipant] of room.entries()) {
            if (existingParticipant.id === userId && existingSocketId !== socket.id) {
                console.log(`Cleaning up old session for user ${userId} (socket ${existingSocketId})`);
                room.delete(existingSocketId);
            }
        }

        const participantData = {
            id: userId,
            name: user?.name || 'Guest',
            role: user?.role || 'participant',
            socketId: socket.id,
            joinedAt: new Date()
        };

        room.set(socket.id, participantData);

        console.log(`User ${participantData.name} (${socket.id}) joined meeting: ${meetingId}`);

        // Broadcast updated participant list to everyone in the room
        const roomParticipants = Array.from(room.values());
        io.to(meetingId).emit('participants_update', roomParticipants);
    });

    socket.on('send_message', async (data) => {
        const { sender_id, sender_name, content, type, meeting_id } = data;

        try {
            const query = `
        INSERT INTO messages (sender_id, sender_name, content, type, meeting_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
            const result = await db.query(query, [sender_id, sender_name, content, type, meeting_id]);
            const savedMessage = result.rows[0];

            console.log(`Message saved for meeting ${meeting_id}:`, { id: savedMessage.id, sender: sender_name });

            // Broadcast to everyone in the meeting room
            io.to(meeting_id).emit('receive_message', savedMessage);
        } catch (err) {
            console.error('Error saving message payload:', { sender_id, sender_name, meeting_id });
            console.error('Error details:', err);
        }
    });

    socket.on('typing_start', (data) => {
        socket.to(data.meeting_id).emit('user_typing', { userId: data.userId, userName: data.userName });
    });

    socket.on('typing_stop', (data) => {
        socket.to(data.meeting_id).emit('user_stopped_typing', { userId: data.userId });
    });

    // --- State Sync ---
    socket.on('update_participant', (data) => {
        const { meeting_id, userId, updates } = data;
        // Broadcast the update to everyone else
        socket.to(meeting_id).emit('participant_updated', { userId, updates });
    });

    socket.on('send_reaction', (data) => {
        const { meeting_id, reaction } = data;
        io.to(meeting_id).emit('receive_reaction', reaction);
    });

    // --- Signaling for WebRTC ---
    socket.on('signal_send', (data) => {
        const { to, signal, from } = data;
        io.to(to).emit('signal_receive', {
            from,
            signal
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Remove from all rooms
        rooms.forEach((participants, meetingId) => {
            if (participants.has(socket.id)) {
                const p = participants.get(socket.id);
                participants.delete(socket.id);
                console.log(`User ${p.name} left meeting: ${meetingId}`);

                // Broadcast update
                const roomParticipants = Array.from(participants.values());
                io.to(meetingId).emit('participants_update', roomParticipants);

                // Cleanup empty rooms
                if (participants.size === 0) {
                    rooms.delete(meetingId);
                }
            }
        });
    });
});

// Auth Endpoints
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    const normalizedEmail = email.toLowerCase();
    try {
        const userCheck = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
        if (userCheck.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const id = `user-${Date.now()}`;
        const passwordHash = await bcrypt.hash(password, 10);

        const result = await db.query(
            'INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, email, avatar, subscription_plan',
            [id, name, normalizedEmail, passwordHash]
        );

        console.log(`User registered: ${normalizedEmail}`);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();
    try {
        console.log(`Login attempt: ${normalizedEmail}`);
        const result = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);

        if (result.rows.length === 0) {
            console.log(`Login failed: Account not found for ${normalizedEmail}`);
            return res.status(404).json({ error: 'Account not found' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            console.log(`Login failed: Incorrect password for ${normalizedEmail}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log(`Login successful: ${normalizedEmail}`);
        const { password_hash, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Failed to login' });
    }
});

app.get('/api/auth/me', async (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const result = await db.query('SELECT id, name, email, avatar, subscription_plan FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Fetch user error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW()');
        // Check if users table exists
        const userTableCheck = await db.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')");

        res.json({
            status: 'ok',
            database: 'connected',
            users_table: userTableCheck.rows[0].exists,
            time: result.rows[0].now,
            message: 'Backend is fully operational'
        });
    } catch (err) {
        console.error('Health check failed', err);
        res.status(500).json({ status: 'error', message: 'Diagnostics failed', error: err.message });
    }
});

// GET chat history
app.get('/api/messages/:meetingId', async (req, res) => {
    const { meetingId } = req.params;
    try {
        const result = await db.query('SELECT * FROM messages WHERE meeting_id = $1 ORDER BY timestamp ASC', [meetingId]);
        console.log(`Fetched ${result.rows.length} messages for meeting ${meetingId}`);
        res.json(result.rows);
    } catch (err) {
        console.error(`Error fetching messages for meeting ${meetingId}:`, err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET all recaps
app.get('/api/recaps', async (req, res) => {
    try {
        const result = await db.query('SELECT id, title, date, timestamp, host, time FROM recaps ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching recaps', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST save meeting recap
app.post('/api/recaps', async (req, res) => {
    const { id, title, date, timestamp, host, duration, participants, summary, actionItems, transcript, time } = req.body;

    if (!id || !title) {
        return res.status(400).json({ error: 'Meeting ID and Title are required' });
    }

    try {
        const query = `
            INSERT INTO recaps (id, title, date, timestamp, host, duration, participants, summary, action_items, transcript, time)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                summary = EXCLUDED.summary,
                action_items = EXCLUDED.action_items,
                transcript = EXCLUDED.transcript,
                time = EXCLUDED.time,
                updated_at = NOW()
            RETURNING *;
        `;

        const values = [
            id,
            title,
            date,
            timestamp,
            host,
            duration,
            JSON.stringify(participants || []),
            JSON.stringify(summary || []),
            JSON.stringify(actionItems || []),
            JSON.stringify(transcript || []),
            time || null
        ];

        const result = await db.query(query, values);

        // BACKGROUND TASK: if summary and actionItems are empty, generate them automatically
        const isSummaryEmpty = !summary || (Array.isArray(summary) && summary.length === 0);
        const isActionsEmpty = !actionItems || (Array.isArray(actionItems) && actionItems.length === 0);
        const hasTranscript = transcript && Array.isArray(transcript) && transcript.length > 0;

        if (isSummaryEmpty && isActionsEmpty && hasTranscript) {
            console.log(`Triggering background auto-recap for meeting: ${id}`);
            // Fire and forget (don't await)
            (async () => {
                try {
                    const fullTranscriptText = transcript.map(m => `${m.speaker}: ${m.text}`).join('\n');
                    const aiRecap = await groqService.generateRecapContent(fullTranscriptText);

                    if (aiRecap && (aiRecap.summary?.length > 0 || aiRecap.actionItems?.length > 0)) {
                        console.log(`Auto-recap generated for ${id}. Updating database...`);
                        const updateQuery = `
                            UPDATE recaps 
                            SET summary = $1, action_items = $2, updated_at = NOW() 
                            WHERE id = $3
                        `;
                        const mappedActionItems = (aiRecap.actionItems || []).map(text => ({
                            id: Date.now().toString() + Math.random(),
                            text,
                            completed: false
                        }));

                        await db.query(updateQuery, [
                            JSON.stringify(aiRecap.summary || []),
                            JSON.stringify(mappedActionItems),
                            id
                        ]);
                        console.log(`Successfully updated recap ${id} with AI content`);
                    }
                } catch (autoErr) {
                    console.error(`Background auto-recap failed for meeting ${id}:`, autoErr);
                }
            })();
        }

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error saving meeting recap. Payload:', { id, title, host });
        console.error('Full Error:', err);
        res.status(500).json({
            error: 'Failed to save recap',
            details: err.message,
            code: err.code
        });
    }
});

// GET single recap details
app.get('/api/recaps/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('SELECT * FROM recaps WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Recap not found' });
        }
        // Parse JSONB fields back to objects
        const recap = result.rows[0];
        res.json({
            ...recap,
            participants: typeof recap.participants === 'string' ? JSON.parse(recap.participants) : recap.participants,
            summary: typeof recap.summary === 'string' ? JSON.parse(recap.summary) : recap.summary,
            actionItems: typeof recap.action_items === 'string' ? JSON.parse(recap.action_items) : (recap.action_items || recap.actionItems),
            transcript: typeof recap.transcript === 'string' ? JSON.parse(recap.transcript) : recap.transcript
        });
    } catch (err) {
        console.error('Error fetching recap details', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Meetings API
app.post('/api/meetings', async (req, res) => {
    const { id, title, host_id, start_time, duration, settings, password } = req.body;
    try {
        const result = await db.query(
            `INSERT INTO meetings (id, title, host_id, start_time, start_timestamp, duration, settings, password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
            [id, title, host_id, start_time, req.body.start_timestamp || null, duration, JSON.stringify(settings || {}), password]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error creating meeting:', err);
        res.status(500).json({ error: 'Failed to create meeting' });
    }
});

app.get('/api/meetings/:id', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Meeting not found' });
        }
        const meeting = result.rows[0];
        meeting.settings = typeof meeting.settings === 'string' ? JSON.parse(meeting.settings) : meeting.settings;
        res.json(meeting);
    } catch (err) {
        console.error('Error fetching meeting:', err);
        res.status(500).json({ error: 'Failed to fetch meeting' });
    }
});

app.patch('/api/meetings/:id', async (req, res) => {
    const { status, settings } = req.body;
    try {
        let query = 'UPDATE meetings SET updated_at = NOW()';
        const params = [req.params.id];
        let paramCount = 2;

        if (status) {
            query += `, status = $${paramCount++}`;
            params.push(status);
        }
        if (settings) {
            query += `, settings = $${paramCount++}`;
            params.push(JSON.stringify(settings));
        }

        query += ' WHERE id = $1 RETURNING *';
        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        const meeting = result.rows[0];
        meeting.settings = typeof meeting.settings === 'string' ? JSON.parse(meeting.settings) : meeting.settings;
        res.json(meeting);
    } catch (err) {
        console.error('Error updating meeting:', err);
        res.status(500).json({ error: 'Failed to update meeting' });
    }
});

// GET user settings
app.get('/api/user/settings', async (req, res) => {
    // Mock user ID - in a real app, this would come from auth middleware
    const userId = req.headers['x-user-id'] || 'default-user';

    try {
        const result = await db.query('SELECT settings FROM user_settings WHERE user_id = $1', [userId]);

        if (result.rows.length > 0) {
            res.json(result.rows[0].settings);
        } else {
            // Return default settings if none found
            res.json({});
        }
    } catch (err) {
        console.error('Error fetching settings', err);
        // If table doesn't exist yet, return empty object gracefully or 500
        if (err.code === '42P01') { // undefined_table
            res.json({});
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// PUT user settings
app.put('/api/user/settings', async (req, res) => {
    const userId = req.headers['x-user-id'] || 'default-user';
    const settings = req.body;

    try {
        // Upsert settings
        const query = `
      INSERT INTO user_settings (user_id, settings, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET settings = $2, updated_at = NOW()
      RETURNING *;
    `;
        const result = await db.query(query, [userId, settings]);
        res.json(result.rows[0].settings);
    } catch (err) {
        console.error('Error saving settings', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- AI Routes ---

// Chat with AI Companion
app.post('/api/ai/chat', async (req, res) => {
    const { messages, meetingId } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
    }

    try {
        const response = await groqService.getChatCompletion(messages);
        res.json({ content: response });
    } catch (err) {
        console.error('AI Chat Error:', err);
        res.status(500).json({ error: 'AI failed to respond' });
    }
});

// Summarize Meeting
app.post('/api/ai/summarize', async (req, res) => {
    const { transcript, meetingId } = req.body;

    if (!transcript) {
        return res.status(400).json({ error: 'Transcript text is required' });
    }

    try {
        const summary = await groqService.summarizeMeeting(transcript);
        res.json({ summary });
    } catch (err) {
        console.error('AI Summarization Error:', err);
        res.status(500).json({ error: 'AI failed to summarize' });
    }
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
