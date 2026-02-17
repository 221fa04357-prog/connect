const express = require('express');
const cors = require('cors');
const db = require('./db');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL,
        methods: ["GET", "POST"],
        credentials: true
    }
});

const port = process.env.PORT || 5001;

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));

app.use(express.json());

// Socket.io Logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join_meeting', (meetingId) => {
        socket.join(meetingId);
        console.log(`User ${socket.id} joined meeting: ${meetingId}`);
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

            // Broadcast to everyone in the meeting room
            io.to(meeting_id).emit('receive_message', savedMessage);
        } catch (err) {
            console.error('Error saving message:', err);
        }
    });

    socket.on('typing_start', (data) => {
        socket.to(data.meeting_id).emit('user_typing', { userId: data.userId, userName: data.userName });
    });

    socket.on('typing_stop', (data) => {
        socket.to(data.meeting_id).emit('user_stopped_typing', { userId: data.userId });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
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
        res.json({ status: 'ok', time: result.rows[0].now, message: 'Backend connected to Database' });
    } catch (err) {
        console.error('Health check failed', err);
        res.status(500).json({ status: 'error', message: 'Database connection failed', error: err.message });
    }
});

// GET chat history
app.get('/api/messages/:meetingId', async (req, res) => {
    const { meetingId } = req.params;
    try {
        const result = await db.query('SELECT * FROM messages WHERE meeting_id = $1 ORDER BY timestamp ASC', [meetingId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching messages', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET all recaps
app.get('/api/recaps', async (req, res) => {
    try {
        const result = await db.query('SELECT id, title, date, timestamp, host FROM recaps ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching recaps', err);
        res.status(500).json({ error: 'Internal server error' });
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
            `INSERT INTO meetings (id, title, host_id, start_time, duration, settings, password)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
            [id, title, host_id, start_time, duration, JSON.stringify(settings || {}), password]
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

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
