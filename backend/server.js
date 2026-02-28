const express = require('express');
const cors = require('cors');
const db = require('./db');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const groqService = require('./groqService');

const { spawn } = require("child_process"); 

const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();


// ================= WHISPER FUNCTION =================

function transcribeWithWhisper(audioPath) {

    return new Promise((resolve, reject) => {

        const pythonProcess = spawn("python", [
            path.join(__dirname, "transcribe.py"),
            audioPath
        ]);

        let result = "";

        pythonProcess.stdout.on("data", (data) => {
            result += data.toString();
        });

        pythonProcess.stderr.on("data", (data) => {
            console.error("Whisper error:", data.toString());
        });

        pythonProcess.on("close", (code) => {

            if (code !== 0)
                reject("Whisper failed");
            else
                resolve(result.trim());

        });

    });

}
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
                timestamp TIMESTAMP DEFAULT NOW(),
                reply_to JSONB,
                is_pinned BOOLEAN DEFAULT FALSE,
                reactions JSONB DEFAULT '[]'
            );

            -- Ensure columns exist for older databases
             DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='recipient_id') THEN
                    ALTER TABLE messages ADD COLUMN recipient_id VARCHAR(255);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='reply_to') THEN
                    ALTER TABLE messages ADD COLUMN reply_to JSONB;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='is_pinned') THEN
                    ALTER TABLE messages ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='reactions') THEN
                    ALTER TABLE messages ADD COLUMN reactions JSONB DEFAULT '[]';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='is_deleted_everyone') THEN
                    ALTER TABLE messages ADD COLUMN is_deleted_everyone BOOLEAN DEFAULT FALSE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='deleted_for') THEN
                    ALTER TABLE messages ADD COLUMN deleted_for JSONB DEFAULT '[]';
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

            CREATE TABLE IF NOT EXISTS meeting_participants (
                meeting_id VARCHAR(255) NOT NULL,
                user_id VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'admitted',
                mic_on BOOLEAN DEFAULT true,
                camera_on BOOLEAN DEFAULT true,
                joined_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                PRIMARY KEY (meeting_id, user_id)
            );

            -- Ensure mic_on and camera_on exist
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meeting_participants' AND column_name='mic_on') THEN
                    ALTER TABLE meeting_participants ADD COLUMN mic_on BOOLEAN DEFAULT true;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meeting_participants' AND column_name='camera_on') THEN
                    ALTER TABLE meeting_participants ADD COLUMN camera_on BOOLEAN DEFAULT true;
                END IF;
            END $$;
            CREATE TABLE IF NOT EXISTS meeting_analytics (
                meeting_id VARCHAR(255) PRIMARY KEY,
                total_joined INTEGER DEFAULT 0,
                left_early INTEGER DEFAULT 0,
                stayed_until_end INTEGER DEFAULT 0,
                participant_data JSONB DEFAULT '{}',
                calculated_at TIMESTAMP,
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

async function finalizeAnalytics(meetingId) {
    const stats = analyticsTracker.get(meetingId);
    if (!stats || stats.calculated) return;

    stats.calculated = true;
    const participants = stats.participants;
    const participantIds = Object.keys(participants);

    const totalJoined = participantIds.length;
    let stayedUntilEnd = 0;

    for (const userId of participantIds) {
        if (participants[userId].isPresent) {
            stayedUntilEnd++;
        }
    }

    const leftEarly = totalJoined - stayedUntilEnd;

    try {
        await db.query(
            `INSERT INTO meeting_analytics (meeting_id, total_joined, left_early, stayed_until_end, participant_data, calculated_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (meeting_id) DO UPDATE SET
                total_joined = EXCLUDED.total_joined,
                left_early = EXCLUDED.left_early,
                stayed_until_end = EXCLUDED.stayed_until_end,
                participant_data = EXCLUDED.participant_data,
                calculated_at = EXCLUDED.calculated_at,
                updated_at = NOW()`,
            [meetingId, totalJoined, leftEarly, stayedUntilEnd, JSON.stringify(participants)]
        );
        console.log(`Analytics finalized for meeting ${meetingId}:`, { totalJoined, leftEarly, stayedUntilEnd });

        // Notify host if they are still in the meeting
        io.to(meetingId).emit('analytics_updated', {
            totalJoined,
            leftEarly,
            stayedUntilEnd,
            isFinal: true
        });
    } catch (err) {
        console.error(`Error finalizing analytics for ${meetingId}:`, err);
    }
}

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
const analyticsTracker = new Map(); // meetingId -> { startTime, participants: { userId: { joinTime, leaveTime, isPresent } } }
const questionTracker = new Map(); // meetingId -> { participantId: { count, name } }
const meetingTranscripts = new Map(); // meetingId -> Array of transcription segments
const ANALYTICS_WINDOW_MS = 20 * 60 * 1000;

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
                    const userId = user?.id || `guest-${socket.id}`;

                    // Check if already admitted/rejected in DB
                    const participantCheck = await db.query(
                        'SELECT status FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2',
                        [meetingId, userId]
                    );

                    const existingStatus = participantCheck.rows[0]?.status;

                    if (existingStatus === 'admitted') {
                        console.log(`User ${user?.name} (${userId}) already admitted to meeting ${meetingId}. Skipping waiting room.`);
                        // Continue to join logic below
                    } else if (existingStatus === 'rejected') {
                        socket.emit('waiting_room_status', {
                            status: 'rejected',
                            message: 'The host has denied your entry.'
                        });
                        return;
                    } else {
                        // Not in DB or in 'waiting' state, place in memory waiting room
                        console.log(`User ${user?.name} placed in waiting room for meeting ${meetingId}`);

                        if (!waitingRooms.has(meetingId)) {
                            waitingRooms.set(meetingId, new Map());
                        }
                        const waitingRoom = waitingRooms.get(meetingId);

                        const participantData = {
                            id: userId,
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

        // --- Analytics Tracking ---
        if (!analyticsTracker.has(meetingId)) {
            const meetingStartTime = meeting?.start_timestamp ? Number(meeting.start_timestamp) : Date.now();
            analyticsTracker.set(meetingId, {
                startTime: meetingStartTime,
                participants: {}
            });

            // Set a timer to finalize analytics after 20 minutes from meeting start
            const timeElapsed = Date.now() - meetingStartTime;
            const timeRemaining = ANALYTICS_WINDOW_MS - timeElapsed;

            if (timeRemaining > 0) {
                setTimeout(() => finalizeAnalytics(meetingId), timeRemaining);
            } else {
                // If 20 mins already passed, define analytics as calculated or finalize
                finalizeAnalytics(meetingId);
            }
        }

        const analyticsStats = analyticsTracker.get(meetingId);
        if (analyticsStats && !analyticsStats.calculated) {
            if (!analyticsStats.participants[userId]) {
                analyticsStats.participants[userId] = {
                    joinTime: Date.now(),
                    isPresent: true
                };
            } else {
                analyticsStats.participants[userId].isPresent = true;
                analyticsStats.participants[userId].lastJoinTime = Date.now();
            }

            // Emit real-time update (not final)
            const pIds = Object.keys(analyticsStats.participants);
            const totalJ = pIds.length;
            let stayed = 0;
            pIds.forEach(id => { if (analyticsStats.participants[id].isPresent) stayed++; });
            io.to(meetingId).emit('analytics_updated', {
                totalJoined: totalJ,
                leftEarly: totalJ - stayed,
                stayedUntilEnd: stayed,
                isFinal: false
            });
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

        // Send current meeting settings to the user who just joined
        if (meeting && meeting.settings) {
            const currentSettings = typeof meeting.settings === 'string' ? JSON.parse(meeting.settings) : meeting.settings;
            socket.emit('meeting_controls_updated', currentSettings);
        }

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

        // Persist admission if not already there (for cases where WR is disabled)
        if (meetingId && userId) {
            db.query(
                'INSERT INTO meeting_participants (meeting_id, user_id, status) VALUES ($1, $2, $3) ON CONFLICT (meeting_id, user_id) DO NOTHING',
                [meetingId, userId, 'admitted']
            ).catch(err => console.error('Error persisting participant join:', err));
        }
    });

    socket.on('send_message', async (data) => {
        const { sender_id, sender_name, content, type, meeting_id, recipientId, reply_to } = data;
        const recipient_id = recipientId || data.recipient_id;

        try {
            const query = `
        INSERT INTO messages (sender_id, sender_name, content, type, meeting_id, recipient_id, reply_to)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
            const result = await db.query(query, [sender_id, sender_name, content, type, meeting_id, recipient_id, reply_to ? JSON.stringify(reply_to) : null]);
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

            // --- Question Tracking Logic ---
            if (meeting_id && sender_id && content && content.includes('?')) {
                if (!questionTracker.has(meeting_id)) {
                    questionTracker.set(meeting_id, {});
                }
                const meetingQuestions = questionTracker.get(meeting_id);
                if (!meetingQuestions[sender_id]) {
                    meetingQuestions[sender_id] = { count: 0, name: sender_name };
                }
                meetingQuestions[sender_id].count += 1;

                // Threshold: 3 questions
                const frequentUsers = Object.entries(meetingQuestions)
                    .filter(([_, data]) => data.count >= 3)
                    .map(([id, data]) => ({ participantId: id, name: data.name, count: data.count }));

                if (frequentUsers.length > 0) {
                    io.to(meeting_id).emit('frequent_question_users', frequentUsers);
                }
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

    socket.on('pin_message', async (data) => {
        const { meeting_id, messageId } = data;
        try {
            await db.query('UPDATE messages SET is_pinned = TRUE WHERE id = $1', [messageId]);
            io.to(meeting_id).emit('message_pinned', { messageId });
        } catch (err) {
            console.error('Error pinning message:', err);
        }
    });

    socket.on('unpin_message', async (data) => {
        const { meeting_id, messageId } = data;
        try {
            await db.query('UPDATE messages SET is_pinned = FALSE WHERE id = $1', [messageId]);
            io.to(meeting_id).emit('message_unpinned', { messageId });
        } catch (err) {
            console.error('Error unpinning message:', err);
        }
    });

    socket.on('react_to_message', async (data) => {
        const { meeting_id, messageId, emoji, userId } = data;
        try {
            const result = await db.query('SELECT reactions FROM messages WHERE id = $1', [messageId]);
            if (result.rows.length === 0) return;

            let reactions = result.rows[0].reactions;
            if (typeof reactions === 'string') reactions = JSON.parse(reactions);
            if (!Array.isArray(reactions)) reactions = [];

            const reactionIndex = reactions.findIndex(r => r.emoji === emoji);
            if (reactionIndex > -1) {
                const userIndex = reactions[reactionIndex].users.indexOf(userId);
                if (userIndex > -1) {
                    // Remove reaction (toggle off)
                    reactions[reactionIndex].users.splice(userIndex, 1);
                    // Remove emoji entry if no users left
                    if (reactions[reactionIndex].users.length === 0) {
                        reactions.splice(reactionIndex, 1);
                    }
                } else {
                    // Add reaction
                    reactions[reactionIndex].users.push(userId);
                }
            } else {
                // New emoji reaction
                reactions.push({ emoji, users: [userId] });
            }

            await db.query('UPDATE messages SET reactions = $1 WHERE id = $2', [JSON.stringify(reactions), messageId]);
            io.to(meeting_id).emit('message_reacted', { messageId, reactions });
        } catch (err) {
            console.error('Error reacting to message:', err);
        }
    });

    socket.on('delete_message_for_me', async (data) => {
        const { messageId, userId } = data;
        try {
            const result = await db.query('SELECT deleted_for FROM messages WHERE id = $1', [messageId]);
            if (result.rows.length === 0) return;

            let deletedFor = result.rows[0].deleted_for;
            if (typeof deletedFor === 'string') deletedFor = JSON.parse(deletedFor);
            if (!Array.isArray(deletedFor)) deletedFor = [];

            if (!deletedFor.includes(userId)) {
                deletedFor.push(userId);
                await db.query('UPDATE messages SET deleted_for = $1 WHERE id = $2', [JSON.stringify(deletedFor), messageId]);
            }
        } catch (err) {
            console.error('Error deleting message for me:', err);
        }
    });

    socket.on('delete_message_for_everyone', async (data) => {
        const { meeting_id, messageId } = data;
        try {
            await db.query('UPDATE messages SET is_deleted_everyone = TRUE WHERE id = $1', [messageId]);
            io.to(meeting_id).emit('message_deleted_everyone', { messageId });
        } catch (err) {
            console.error('Error deleting message for everyone:', err);
        }
    });

    // --- State Sync ---
    socket.on('update_participant', async (data) => {
        const { meeting_id, userId, updates } = data;

        // Persist media state if provided
        if (updates && (updates.isAudioMuted !== undefined || updates.isVideoOff !== undefined)) {
            try {
                const mic_on = updates.isAudioMuted !== undefined ? !updates.isAudioMuted : undefined;
                const camera_on = updates.isVideoOff !== undefined ? !updates.isVideoOff : undefined;

                let query = 'UPDATE meeting_participants SET updated_at = NOW()';
                const params = [meeting_id, userId];
                let paramCount = 3;

                if (mic_on !== undefined) {
                    query += `, mic_on = $${paramCount++}`;
                    params.push(mic_on);
                }
                if (camera_on !== undefined) {
                    query += `, camera_on = $${paramCount++}`;
                    params.push(camera_on);
                }

                query += ' WHERE meeting_id = $1 AND user_id = $2';
                await db.query(query, params);
            } catch (err) {
                console.error('Error persisting participant media state:', err);
            }
        }

        // Update in-memory room state
        const room = rooms.get(meeting_id);
        if (room) {
            for (const [sId, p] of room.entries()) {
                if (p.id === userId) {
                    room.set(sId, { ...p, ...updates });
                    break;
                }
            }
        }

        // Broadcast the update to everyone else
        socket.to(meeting_id).emit('participant_updated', { userId, updates });
    });

    socket.on('update_meeting_settings', async (data) => {
        const { meetingId, settings } = data;
        try {
            // Update meeting settings in DB
            const currentRes = await db.query('SELECT settings FROM meetings WHERE id = $1', [meetingId]);
            if (currentRes.rows.length > 0) {
                const currentSettings = typeof currentRes.rows[0].settings === 'string' ? JSON.parse(currentRes.rows[0].settings) : (currentRes.rows[0].settings || {});
                const newSettings = { ...currentSettings, ...settings };

                await db.query('UPDATE meetings SET settings = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(newSettings), meetingId]);

                // Broadcast setting change to everyone in the room
                io.to(meetingId).emit('meeting_controls_updated', newSettings);

                // If recording is now allowed for all, broadcast a grant event to clear "Requesting..." states
                if (settings.recordingAllowedForAll) {
                    io.to(meetingId).emit('recording_granted', { all: true });
                }

                console.log(`Meeting settings updated for ${meetingId}:`, newSettings);
            }
        } catch (err) {
            console.error('Error updating meeting settings:', err);
        }
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

            // Persist to DB
            db.query(
                'INSERT INTO meeting_participants (meeting_id, user_id, status) VALUES ($1, $2, $3) ON CONFLICT (meeting_id, user_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()',
                [meetingId, p.id, 'admitted']
            ).catch(err => console.error('Error persisting participant admission:', err));

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

            // Persist rejection to DB
            db.query(
                'INSERT INTO meeting_participants (meeting_id, user_id, status) VALUES ($1, $2, $3) ON CONFLICT (meeting_id, user_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()',
                [meetingId, p.id, 'rejected']
            ).catch(err => console.error('Error persisting participant rejection:', err));

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

                            // Persist to DB
                            db.query(
                                'INSERT INTO meeting_participants (meeting_id, user_id, status) VALUES ($1, $2, $3) ON CONFLICT (meeting_id, user_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()',
                                [meetingId, p.id, 'admitted']
                            ).catch(err => console.error('Error persisting participant admission (WR disabled):', err));

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

    socket.on('request_video_start', (data) => {
        const { meetingId, targetUserId, requesterName } = data;
        // Broadcast to the specific user in the meeting
        const room = rooms.get(meetingId);
        if (room) {
            // Find requester's userId
            const requesterEntry = room.get(socket.id);
            const requesterId = requesterEntry?.id || 'host';

            for (const [sId, p] of room.entries()) {
                if (p.id === targetUserId) {
                    io.to(sId).emit('video_start_requested', { requesterName, requesterId });
                    console.log(`Host ${requesterName} (${requesterId}) requested video start for user ${targetUserId}`);
                    break;
                }
            }
        }
    });

    socket.on('video_start_response', (data) => {
        const { meetingId, hostId, participantId, accepted } = data;
        const room = rooms.get(meetingId);
        if (room) {
            for (const [sId, p] of room.entries()) {
                if (p.id === hostId) {
                    io.to(sId).emit('video_start_response_received', { participantId, accepted });
                    console.log(`User ${participantId} responded to video request: ${accepted ? 'Accepted' : 'Denied'}`);
                    break;
                }
            }
    socket.on('audio_chunk', async (data) => {
        const { meetingId, participantId, participantName, audioBlob } = data;
        if (!meetingId || !audioBlob) return;

     try {
    // Write blob to temporary file
    const tempDir = os.tmpdir();
    const fileName = `audio_${meetingId}_${socket.id}_${Date.now()}.webm`;
    const filePath = path.join(tempDir, fileName);

    fs.writeFileSync(filePath, Buffer.from(audioBlob));

    // ✅ USE WHISPER (KEEP THIS)
    const text = await transcribeWithWhisper(filePath);

    // Clean up
    fs.unlinkSync(filePath);

    if (text && text.trim().length > 0) {

        const segment = {
            participantId,
            participantName,
            text: text.trim(),
            timestamp: new Date().toISOString()
        };

        // Store in memory
        if (!meetingTranscripts.has(meetingId)) {
            meetingTranscripts.set(meetingId, []);
        }

        meetingTranscripts.get(meetingId).push(segment);

        // Broadcast transcript
        io.to(meetingId).emit('transcription_received', segment);

    }

} catch (error) {

    console.error('Transcription error:', error);

}
    socket.on('get_transcripts', (data) => {
        const { meetingId } = data;
        if (meetingTranscripts.has(meetingId)) {
            socket.emit('all_transcripts', meetingTranscripts.get(meetingId));
        }
    });

    socket.on('end_meeting', (data) => {
        const { meetingId } = data;
        console.log(`Meeting ${meetingId} ended by host`);
        questionTracker.delete(meetingId);
        meetingTranscripts.delete(meetingId);
        io.to(meetingId).emit('meeting_ended', { meetingId });
    });

    socket.on('request_media', (data) => {
        const { meetingId, userId, type } = data;
        const room = rooms.get(meetingId);
        if (!room) return;

        // Find the socket ID for the target user ID
        let targetSocketId = null;
        for (const [sId, p] of room.entries()) {
            if (p.id === userId) {
                targetSocketId = sId;
                break;
            }
        }

        if (targetSocketId) {
            // Find the sender's name
            const sender = room.get(socket.id);
            const fromName = 'Host';

            console.log(`Forwarding ${type} request from ${fromName} to participant ${userId} (Socket: ${targetSocketId})`);
            io.to(targetSocketId).emit('media_request', { type, fromName });
        }
    });

    socket.on('start_recording', (data) => {
        const { meetingId } = data;
        socket.to(meetingId).emit('recording_started');
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

    socket.on('whiteboard_undo', (data) => {
        const { meeting_id } = data;
        // Broadcast undo signal to everyone else in the room
        socket.to(meeting_id).emit('whiteboard_undo');
    });

    socket.on('whiteboard_redo', (data) => {
        const { meeting_id } = data;
        // Broadcast redo signal to everyone else in the room
        socket.to(meeting_id).emit('whiteboard_redo');
    });

    socket.on('whiteboard_access_update', (data) => {
        const { meeting_id, access } = data;
        // Broadcast access change to everyone in the room
        io.to(meeting_id).emit('whiteboard_access_updated', { access });
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
            // Frontend already enforces who can close (RBAC)
            console.log(`Global whiteboard close triggered by authorized user ${userId} for meeting ${meeting_id}`);
            // Wait: let's not delete initiator on close, because opening again might need it
            // Or maybe delete it to reset session. Let's delete it.
            whiteboardInitiators.delete(meeting_id);
            socket.to(meeting_id).emit('whiteboard_toggle', { isOpen: false });
        }
    });

    // --- Recording Permission ---
    socket.on('request_recording', async (data) => {
        const { meetingId, userId, userName } = data;
        try {
            const result = await db.query('SELECT settings FROM meetings WHERE id = $1', [meetingId]);
            const settings = result.rows[0]?.settings
                ? (typeof result.rows[0].settings === 'string' ? JSON.parse(result.rows[0].settings) : result.rows[0].settings)
                : {};

            if (settings.recordingAllowedForAll) {
                io.to(meetingId).emit('recording_granted', { userId });
            } else {
                io.to(meetingId).emit('recording_requested', { userId, userName });
            }
        } catch (err) {
            console.error('Error in request_recording:', err);
            io.to(meetingId).emit('recording_requested', { userId, userName });
        }
    });

    socket.on('grant_recording', (data) => {
        const { meetingId, userId } = data;
        io.to(meetingId).emit('recording_granted', { userId });
    });

    socket.on('deny_recording', (data) => {
        const { meetingId, userId } = data;
        io.to(meetingId).emit('recording_denied', { userId });
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
                    questionTracker.delete(meetingId);
                }

                // --- Analytics Tracking ---
                const stats = analyticsTracker.get(meetingId);
                if (stats && !stats.calculated) {
                    if (stats.participants[p.id]) {
                        stats.participants[p.id].isPresent = false;
                        stats.participants[p.id].leaveTime = Date.now();

                        // Emit real-time update
                        const pIds = Object.keys(stats.participants);
                        const totalJ = pIds.length;
                        let stayed = 0;
                        pIds.forEach(id => { if (stats.participants[id].isPresent) stayed++; });
                        io.to(meetingId).emit('analytics_updated', {
                            totalJoined: totalJ,
                            leftEarly: totalJ - stayed,
                            stayedUntilEnd: stayed,
                            isFinal: false
                        });
                    }
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

// Analytics API
app.get('/api/meetings/:id/analytics', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('SELECT * FROM meeting_analytics WHERE meeting_id = $1', [id]);
        if (result.rows.length === 0) {
            // Check if it's currently being tracked in memory
            const stats = analyticsTracker.get(id);
            if (stats) {
                const participantIds = Object.keys(stats.participants);
                const totalJoined = participantIds.length;
                let stayedUntilEnd = 0;
                for (const userId of participantIds) {
                    if (stats.participants[userId].isPresent) stayedUntilEnd++;
                }
                const leftEarly = totalJoined - stayedUntilEnd;
                return res.json({
                    meeting_id: id,
                    total_joined: totalJoined,
                    left_early: leftEarly,
                    stayed_until_end: stayedUntilEnd,
                    is_live: true,
                    is_final: !!stats.calculated
                });
            }
            return res.status(404).json({ error: 'Analytics not found for this meeting' });
        }
        res.json({
            ...result.rows[0],
            is_live: false,
            is_final: true
        });
    } catch (err) {
        console.error('Error fetching analytics', err);
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

app.get('/api/meetings/:id/participant-status', async (req, res) => {
    const { id: meetingId } = req.params;
    const userId = req.headers['x-user-id'];

    if (!userId) {
        return res.status(401).json({ error: 'User ID is required' });
    }

    try {
        const result = await db.query(
            'SELECT status, mic_on, camera_on FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2',
            [meetingId, userId]
        );

        if (result.rows.length === 0) {
            return res.json({ status: 'not_found' });
        }

        const row = result.rows[0];
        res.json({
            status: row.status,
            micOn: row.mic_on,
            cameraOn: row.camera_on
        });
    } catch (err) {
        console.error('Error checking participant status:', err);
        res.status(500).json({ error: 'Internal server error' });
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
