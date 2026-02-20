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
                recipient_id VARCHAR(255),
                timestamp TIMESTAMP DEFAULT NOW()
            );

            -- Add recipient_id if it doesn't exist
             DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='recipient_id') THEN
                    ALTER TABLE messages ADD COLUMN recipient_id VARCHAR(255);
                END IF;
            END $$;

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
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meetings' AND column_name='end_timestamp') THEN
                    ALTER TABLE meetings ADD COLUMN end_timestamp BIGINT;
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
const rooms = new Map(); // meetingId -> Map of socketId -> participantData
const waitingRooms = new Map(); // meetingId -> Map of socketId -> participantData
const whiteboardInitiators = new Map(); // meetingId -> userId

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join_meeting', async (data) => {
        const { meetingId, user, initialState } = typeof data === 'string' ? { meetingId: data, user: null, initialState: {} } : data;

        let meeting;
        try {
            // Check meeting start time enforcement
            const meetingResult = await db.query(
                'SELECT host_id, start_timestamp, settings, end_timestamp, status FROM meetings WHERE id = $1',
                [meetingId]
            );

            meeting = meetingResult.rows[0];

            if (meeting) {
                const meetingSettings = typeof meeting.settings === 'string' ? JSON.parse(meeting.settings) : (meeting.settings || {});
                const isHost = user?.id && (user.id === meeting.host_id || user.id === 'host'); // Basic check, ideally verify auth
                const now = Date.now();
                const startTime = Number(meeting.start_timestamp);

                // Check for strict start time
                if (!isHost && startTime && now < startTime) {
                    // It's too early
                    console.log(`User ${user?.name} blocked from joining meeting ${meetingId} (Starts at ${new Date(startTime).toISOString()})`);
                    socket.emit('join_error', {
                        code: 'MEETING_NOT_STARTED',
                        message: 'This meeting has not started yet. Please join at the scheduled time.',
                        startTime: startTime
                    });
                    return;
                }

                // Check for ended meeting
                const endTime = meeting.end_timestamp ? Number(meeting.end_timestamp) : null;
                const isEnded = meeting.status === 'ended' || (endTime && now > endTime);

                if (isEnded && !isHost) {
                    console.log(`User ${user?.name} blocked from joining ended meeting ${meetingId}`);
                    socket.emit('join_error', {
                        code: 'MEETING_ENDED',
                        message: 'This meeting has already ended.',
                        endTime: endTime
                    });
                    return;
                }

                // --- WAITING ROOM LOGIC ---
                const enableWaitingRoom = meetingSettings.enableWaitingRoom === true;

                if (enableWaitingRoom && !isHost) {
                    console.log(`User ${user?.name} placed in waiting room for meeting ${meetingId}`);

                    if (!waitingRooms.has(meetingId)) {
                        waitingRooms.set(meetingId, new Map());
                    }
                    const waitingRoom = waitingRooms.get(meetingId);

                    const participantData = {
                        id: user?.id || `guest-${socket.id}`,
                        name: user?.name || 'Guest',
                        role: 'participant',
                        socketId: socket.id,
                        joinedAt: new Date(),
                        isWaiting: true,
                        isAudioMuted: initialState?.isAudioMuted ?? true,
                        isVideoOff: initialState?.isVideoOff ?? true,
                    };

                    waitingRoom.set(socket.id, participantData);
                    socket.join(meetingId); // Join the meeting room so host can see them, but they are in 'waiting' state

                    socket.emit('waiting_room_status', {
                        status: 'waiting',
                        message: 'Wait for the host to let you in.'
                    });

                    // Notify host about the new waiting participant
                    const waitingParticipants = Array.from(waitingRoom.values());
                    io.to(meetingId).emit('waiting_room_update', waitingParticipants);
                    return;
                }
            }
        } catch (err) {
            console.error('Error validating meeting enrollment:', err);
        }

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

        const isHost = user?.id && (user.id === meeting?.host_id || user.id === 'host');

        const participantData = {
            id: userId,
            name: user?.name || 'Guest',
            role: isHost ? 'host' : (user?.role || 'participant'),
            socketId: socket.id,
            joinedAt: new Date(),
            // Capture initial state or default to OFF (safe default)
            isAudioMuted: initialState?.isAudioMuted ?? true,
            isVideoOff: initialState?.isVideoOff ?? true,
            isHandRaised: initialState?.isHandRaised ?? false
        };

        room.set(socket.id, participantData);

        console.log(`User ${participantData.name} (${socket.id}) joined meeting: ${meetingId}`);

        // Broadcast updated participant list to everyone in the room
        const roomParticipants = Array.from(room.values());
        io.to(meetingId).emit('participants_update', roomParticipants);

        // Also send waiting room status OK to this user
        socket.emit('waiting_room_status', { status: 'admitted' });

        // Let host know the waiting room changed if they were in it
        if (waitingRooms.has(meetingId)) {
            const waitingRoom = waitingRooms.get(meetingId);
            if (waitingRoom.has(socket.id)) {
                waitingRoom.delete(socket.id);
                io.to(meetingId).emit('waiting_room_update', Array.from(waitingRoom.values()));
            }
        }
    });

    socket.on('send_message', async (data) => {
        const { sender_id, sender_name, content, type, meeting_id, recipientId } = data;
        const recipient_id = recipientId || data.recipient_id;

        try {
            const query = `
        INSERT INTO messages (sender_id, sender_name, content, type, meeting_id, recipient_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
            const result = await db.query(query, [sender_id, sender_name, content, type, meeting_id, recipient_id]);
            const savedMessage = result.rows[0];

            console.log(`Message saved for meeting ${meeting_id}:`, { id: savedMessage.id, sender: sender_name, type, recipient: recipient_id });

            if (type === 'private' && recipient_id) {
                // Find recipient socket(s) in the meeting room
                const room = rooms.get(meeting_id);
                let sentToRecipient = false;

                if (room) {
                    for (const [sId, p] of room.entries()) {
                        if (p.id === recipient_id) {
                            io.to(sId).emit('receive_message', savedMessage);
                            sentToRecipient = true;
                        }
                    }
                }

                // Always send back to sender so it appears on their screen
                // We do this by emitting to the sender's socket directly.
                // If sender has multiple tabs (same user ID), ideally we'd emit to all their sockets too.
                // For now, emitting to current socket + ensuring we broadcast to all sockets of that user if we could.
                // Simpler: iterate room again for sender
                if (room) {
                    for (const [sId, p] of room.entries()) {
                        if (p.id === sender_id) {
                            io.to(sId).emit('receive_message', savedMessage);
                        }
                    }
                }

            } else {
                // Broadcast to everyone in the meeting room (public)
                io.to(meeting_id).emit('receive_message', savedMessage);
            }
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

    socket.on('mute_all', (data) => {
        const { meeting_id } = data;
        // Broadcast to everyone in the meeting
        io.to(meeting_id).emit('mute_all');
    });

    socket.on('unmute_all', (data) => {
        const { meeting_id } = data;
        // Broadcast to everyone in the meeting
        io.to(meeting_id).emit('unmute_all');
    });

    socket.on('stop_video_all', (data) => {
        const { meeting_id } = data;
        io.to(meeting_id).emit('stop_video_all');
    });

    socket.on('allow_video_all', (data) => {
        const { meeting_id } = data;
        io.to(meeting_id).emit('allow_video_all');
    });

    // --- Waiting Room Controls ---
    socket.on('admit_participant', (data) => {
        const { meetingId, socketId } = data;
        const waitingRoom = waitingRooms.get(meetingId);

        if (waitingRoom && waitingRoom.has(socketId)) {
            const p = waitingRoom.get(socketId);
            waitingRoom.delete(socketId);

            // Move to main room
            if (!rooms.has(meetingId)) rooms.set(meetingId, new Map());
            const room = rooms.get(meetingId);

            const participantData = {
                ...p,
                isWaiting: false,
                joinedAt: new Date()
            };

            room.set(socketId, participantData);

            // Notify the admitted user
            io.to(socketId).emit('waiting_room_status', { status: 'admitted' });

            // Broadcast updates
            io.to(meetingId).emit('participants_update', Array.from(room.values()));
            io.to(meetingId).emit('waiting_room_update', Array.from(waitingRoom.values()));

            console.log(`User ${p.name} admitted to meeting ${meetingId}`);
        }
    });

    socket.on('reject_participant', (data) => {
        const { meetingId, socketId } = data;
        const waitingRoom = waitingRooms.get(meetingId);

        if (waitingRoom && waitingRoom.has(socketId)) {
            const p = waitingRoom.get(socketId);
            waitingRoom.delete(socketId);

            // Notify the rejected user
            io.to(socketId).emit('waiting_room_status', { status: 'rejected', message: 'The host has denied your entry.' });

            // Broadcast waiting room update
            io.to(meetingId).emit('waiting_room_update', Array.from(waitingRoom.values()));

            console.log(`User ${p.name} rejected from meeting ${meetingId}`);
        }
    });

    socket.on('toggle_waiting_room', async (data) => {
        const { meetingId, enabled } = data;
        try {
            // Update meeting settings in DB
            const result = await db.query('SELECT settings FROM meetings WHERE id = $1', [meetingId]);
            if (result.rows.length > 0) {
                const settings = typeof result.rows[0].settings === 'string' ? JSON.parse(result.rows[0].settings) : (result.rows[0].settings || {});
                settings.enableWaitingRoom = enabled;
                await db.query('UPDATE meetings SET settings = $1 WHERE id = $2', [JSON.stringify(settings), meetingId]);

                // Broadcast setting change
                io.to(meetingId).emit('waiting_room_setting_updated', { enabled });

                // If disabling, admit everyone currently waiting
                if (!enabled && waitingRooms.has(meetingId)) {
                    const waitingRoom = waitingRooms.get(meetingId);
                    if (waitingRoom.size > 0) {
                        if (!rooms.has(meetingId)) rooms.set(meetingId, new Map());
                        const room = rooms.get(meetingId);

                        waitingRoom.forEach((p, sId) => {
                            const participantData = {
                                ...p,
                                isWaiting: false,
                                joinedAt: new Date()
                            };
                            room.set(sId, participantData);
                            io.to(sId).emit('waiting_room_status', { status: 'admitted' });
                        });

                        waitingRoom.clear();
                        io.to(meetingId).emit('participants_update', Array.from(room.values()));
                        io.to(meetingId).emit('waiting_room_update', []);
                        console.log(`Waiting room disabled for ${meetingId}, admitted all waiting participants.`);
                    }
                }
            }
        } catch (err) {
            console.error('Error toggling waiting room:', err);
        }
    });

    socket.on('end_meeting', (data) => {
        const { meetingId } = data;
        console.log(`Meeting ${meetingId} ended by host`);
        io.to(meetingId).emit('meeting_ended', { meetingId });
    });

    // --- Whiteboard Sync ---
    socket.on('whiteboard_draw', (data) => {
        const { meeting_id, stroke } = data;

        // Ensure initiator is set if not already
        if (!whiteboardInitiators.has(meeting_id)) {
            // Find user ID from the room
            const room = rooms.get(meeting_id);
            if (room && room.has(socket.id)) {
                whiteboardInitiators.set(meeting_id, room.get(socket.id).id);
            }
        }

        const initiatorId = whiteboardInitiators.get(meeting_id);

        // Broadcast stroke to everyone else in the room, including metadata
        socket.to(meeting_id).emit('whiteboard_draw', { ...stroke, initiatorId });
    });

    socket.on('whiteboard_clear', (data) => {
        const { meeting_id } = data;
        // Broadcast clear signal to everyone else in the room
        socket.to(meeting_id).emit('whiteboard_clear');
    });

    socket.on('whiteboard_toggle', (data) => {
        const { meeting_id, isOpen, userId } = data;

        if (isOpen) {
            // Set initiator if not set
            if (!whiteboardInitiators.has(meeting_id)) {
                whiteboardInitiators.set(meeting_id, userId);
            }
            const initiatorId = whiteboardInitiators.get(meeting_id);
            // Broadcast toggle signal to everyone else in the room
            socket.to(meeting_id).emit('whiteboard_toggle', { isOpen, initiatorId });
        } else {
            // ONLY ALLOW GLOBAL CLOSE IF SENDER IS THE INITIATOR
            const currentInitiator = whiteboardInitiators.get(meeting_id);
            if (currentInitiator === userId) {
                console.log(`Global whiteboard close triggered by initiator ${userId} for meeting ${meeting_id}`);
                whiteboardInitiators.delete(meeting_id);
                socket.to(meeting_id).emit('whiteboard_toggle', { isOpen: false });
            } else {
                console.log(`Whiteboard local close by ${userId} (not initiator) for meeting ${meeting_id}`);
                // No broadcast - other users keep the board open
            }
        }
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

        // Also remove from waiting rooms
        waitingRooms.forEach((participants, meetingId) => {
            if (participants.has(socket.id)) {
                const p = participants.get(socket.id);
                participants.delete(socket.id);
                console.log(`User ${p.name} left waiting room: ${meetingId}`);

                // Broadcast update
                const waitingParticipants = Array.from(participants.values());
                io.to(meetingId).emit('waiting_room_update', waitingParticipants);

                if (participants.size === 0) {
                    waitingRooms.delete(meetingId);
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
    const userId = req.headers['x-user-id']; // Optional but strictly recommended for privacy

    try {
        let query;
        let params;

        if (userId) {
            // Filter: Public messages OR (Private messages where user is sender OR recipient)
            query = `
                SELECT * FROM messages 
                WHERE meeting_id = $1 
                AND (
                    type = 'public' 
                    OR (type = 'private' AND (sender_id = $2 OR recipient_id = $2))
                )
                ORDER BY timestamp ASC
            `;
            params = [meetingId, userId];
        } else {
            // Only public if no user ID
            query = 'SELECT * FROM messages WHERE meeting_id = $1 AND type = $2 ORDER BY timestamp ASC';
            params = [meetingId, 'public'];
        }

        const result = await db.query(query, params);
        console.log(`Fetched ${result.rows.length} messages for meeting ${meetingId} (User: ${userId || 'None'})`);
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
        const startTimeMs = req.body.start_timestamp || new Date(start_time).getTime();
        const endTimeMs = startTimeMs + (duration * 60 * 1000);

        const result = await db.query(
            `INSERT INTO meetings (id, title, host_id, start_time, start_timestamp, end_timestamp, duration, settings, password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
            [id, title, host_id, start_time, startTimeMs, endTimeMs, duration, JSON.stringify(settings || {}), password]
        );
        const meeting = result.rows[0];
        meeting.endTime = Number(meeting.end_timestamp);
        res.json(meeting);
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

        // Ensure endTime is populated
        if (meeting.end_timestamp) {
            meeting.endTime = Number(meeting.end_timestamp);
        } else if (meeting.start_timestamp && meeting.duration) {
            meeting.endTime = Number(meeting.start_timestamp) + (meeting.duration * 60 * 1000);
        }

        res.json(meeting);
    } catch (err) {
        console.error('Error fetching meeting:', err);
        res.status(500).json({ error: 'Failed to fetch meeting' });
    }
});

app.patch('/api/meetings/:id', async (req, res) => {
    const { status, settings, duration } = req.body;
    try {
        // If duration is updated, we must update end_timestamp too
        let updateEndTime = false;
        let newEndTime = null;

        if (duration) {
            const current = await db.query('SELECT start_timestamp FROM meetings WHERE id = $1', [req.params.id]);
            if (current.rows.length > 0 && current.rows[0].start_timestamp) {
                const start = Number(current.rows[0].start_timestamp);
                newEndTime = start + (duration * 60 * 1000);
                updateEndTime = true;
            }
        }

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
        if (duration) {
            query += `, duration = $${paramCount++}`;
            params.push(duration);
        }
        if (updateEndTime) {
            query += `, end_timestamp = $${paramCount++}`;
            params.push(newEndTime);
        }

        query += ' WHERE id = $1 RETURNING *';
        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        const meeting = result.rows[0];
        meeting.settings = typeof meeting.settings === 'string' ? JSON.parse(meeting.settings) : meeting.settings;
        if (meeting.end_timestamp) meeting.endTime = Number(meeting.end_timestamp);

        // Broadcast extension if time changed
        if (updateEndTime) {
            console.log(`Broadcasting meeting extension for ${meeting.id} to ${meeting.endTime}`);
            io.to(meeting.id).emit('meeting_extended', meeting);
        }

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
