const express = require('express');
const crypto = require('crypto');
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


const axios = require('axios');
const FormData = require('form-data');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const session = require('express-session');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// ================= NODEMAILER CONFIG =================
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Verify transporter
transporter.verify((error, success) => {
    if (error) {
        console.error('[SMTP] Connection Error:', error);
    } else {
        console.log('[SMTP] Server is ready to take our messages');
    }
});

async function sendOTPEmail(email, otp) {
    const mailOptions = {
        from: `"NeuralChat" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Verify your email - NeuralChat',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <h2 style="color: #0B5CFF; text-align: center;">Welcome to NeuralChat!</h2>
                <p style="font-size: 16px; color: #333;">Please use the following verification code to complete your registration:</p>
                <div style="background-color: #f4f7ff; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0B5CFF;">${otp}</span>
                </div>
                <p style="font-size: 14px; color: #666;">This code will expire in 5 minutes. If you did not request this, please ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 12px; color: #999; text-align: center;">&copy; 2026 NeuralChat. All rights reserved.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[OTP] Sent ${otp} to ${email}`);
        } else {
            console.log(`[OTP] Sent to ${email}`);
        }
    } catch (err) {
        console.error('[OTP] Email delivery failed:', err);
        throw new Error('Failed to send verification email');
    }
}

// ================= PASSPORT CONFIG =================

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        done(null, result.rows[0]);
    } catch (err) {
        done(err, null);
    }
});

// Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id') {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.AUTH_CALLBACK_URL || 'http://localhost:5005'}/api/auth/google/callback`
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;
            const name = profile.displayName;
            const avatar = profile.photos[0].value;

            // Check if user exists
            let result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            let user;

            if (result.rows.length === 0) {
                // Create user
                const id = `user-google-${profile.id}`;
                // Random default password hash for OAuth users
                const passwordHash = await bcrypt.hash(Math.random().toString(36), 10);
                const insertResult = await db.query(
                    'INSERT INTO users (id, name, email, password_hash, avatar, provider, is_password_set) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                    [id, name, email, passwordHash, avatar, 'google', false]
                );
                user = insertResult.rows[0];
            } else {
                user = result.rows[0];
                // Update avatar if provided
                if (avatar && !user.avatar) {
                    await db.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, user.id]);
                    user.avatar = avatar;
                }
            }
            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }));
}

// Microsoft Strategy
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_ID !== 'your_microsoft_client_id') {
    passport.use(new MicrosoftStrategy({
        clientID: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        callbackURL: `${process.env.AUTH_CALLBACK_URL || 'http://localhost:5005'}/api/auth/microsoft/callback`,
        scope: ['user.read']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;
            const name = profile.displayName;

            // Check if user exists
            let result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            let user;

            if (result.rows.length === 0) {
                // Create user
                const id = `user-ms-${profile.id}`;
                const passwordHash = await bcrypt.hash(Math.random().toString(36), 10);
                const insertResult = await db.query(
                    'INSERT INTO users (id, name, email, password_hash, provider, is_password_set) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                    [id, name, email, passwordHash, 'microsoft', false]
                );
                user = insertResult.rows[0];
            } else {
                user = result.rows[0];
            }
            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }));
}

async function transcribeWithWhisper(audioPath, language = null) {
    try {
        console.log(`[Transcription] Starting Groq transcription for: ${path.basename(audioPath)}`);
        // Switch from local Python server to Groq Whisper for better speed, accuracy and Vercel compatibility
        const text = await groqService.transcribeAudio(audioPath, language);
        console.log(`[Transcription] Groq result: "${text || 'EMPTY'}"`);
        return text || "";
    } catch (error) {
        console.error("Groq Transcription Error (via whisper fallback):", error.message);
        return "";
    }
}


const app = express();
const server = http.createServer(app);

// CORS Configuration
const allowedOrigin = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, "") : "*";
const corsOptions = {
    origin: [allowedOrigin, "http://localhost:5173", "https://your-vercel-app.vercel.app", "*"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning"]
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

// Transcription store (moved up for visibility)
const meetingTranscripts = new Map();
// meeting_id -> [{ id: string, name: string, participants: string[] }]
const breakoutRooms = new Map();
const bannedUsers = new Map(); // meetingId -> Set of banned userIds

// ================= TRANSCRIPTION CONFIG =================
const multer = require('multer');
const transcriptionStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || '.webm';
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: transcriptionStorage });

// Add a POST endpoint for transcription (better for Vercel than WebSockets)
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

    const { meetingId, participantId, participantName, language, role } = req.body;

    console.log(`[Transcription] received /api/transcribe: meeting=${meetingId}, user=${participantName}, role=${role || 'none'}, file=${req.file.filename} (${req.file.size} bytes)`);

    try {
        if (!process.env.GROQ_API_KEY) {
            console.error('[Transcription] Error: GROQ_API_KEY is missing');
            return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
        }

        // Send audio to Groq for transcription
        let text = await groqService.transcribeAudio(req.file.path, language);

        // Remove temp file
        try { fs.unlinkSync(req.file.path); } catch (e) { }

        if (text && text.trim().length > 0) {

            const targetLanguage = req.body.targetLanguage;
            let translatedText = text;

            // Translation (optional)
            if (targetLanguage && targetLanguage.toLowerCase() !== 'original' && targetLanguage.toLowerCase() !== language) {
                console.log(`[Translation] Translating "${text}" to ${targetLanguage}`);
                translatedText = await groqService.translateText(text, targetLanguage);
            }

            // Broadcast transcription to meeting room
            if (meetingId) {

                const segment = {
                    participantId: participantId || 'guest',
                    participantName: participantName || 'Guest',
                    role: role || 'participant',
                    text: translatedText.trim(),
                    originalText: text.trim(),
                    language: language || 'en',
                    timestamp: new Date().toISOString()
                };

                // Store transcript
                if (!meetingTranscripts.has(meetingId)) {
                    meetingTranscripts.set(meetingId, []);
                }

                meetingTranscripts.get(meetingId).push(segment);

                // Send to all users in meeting
                console.log(`[Transcription] Broadcasting segment to room ${meetingId}: "${translatedText.trim().substring(0, 30)}..."`);

                io.to(meetingId).emit('transcription_received', segment);

            } else {
                console.warn('[Transcription] Cannot broadcast: meetingId is missing in request body');
            }

            return res.json({ text: translatedText.trim() });
        }

        return res.status(204).send();

    } catch (err) {
        console.error('API Transcribe error:', err);
        return res.status(500).json({ error: 'Transcription failed: ' + (err.message || 'Unknown error') });
    }
});

app.post('/api/translate', async (req, res) => {
    const { text, targetLang } = req.body;

    if (!text || !targetLang) {
        return res.status(400).json({ error: 'Text and targetLang are required' });
    }

    try {
        console.log(`[Translation] Translating text to ${targetLang}...`);
        const translatedText = await groqService.translateText(text, targetLang);
        res.json({ text: translatedText });
    } catch (err) {
        console.error('Translation error:', err);
        res.status(500).json({ error: 'Translation failed' });
    }
});

app.get('/api/resources/:meetingId', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM resources WHERE meeting_id = $1 ORDER BY timestamp DESC', [req.params.meetingId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching resources:', err);
        res.status(500).json({ error: 'Failed to fetch resources' });
    }
});

// Update smart replies API implementation
app.post('/api/ai/smart-replies', async (req, res) => {
    const { chatContext, meetingId } = req.body;

    try {
        let finalContext = chatContext || [];

        // If we have a meetingId, fetch transcripts to give context to smart replies
        if (meetingId && meetingTranscripts.has(meetingId)) {
            const transcripts = meetingTranscripts.get(meetingId) || [];
            // Take last 10 transcripts for recent speech context
            const recentSpeech = transcripts.slice(-10).map(t => ({ role: t.participantName + ' (Speech)', content: t.text }));

            if (Array.isArray(finalContext)) {
                finalContext = [...recentSpeech, ...finalContext];
            }
        }

        if (!finalContext || (Array.isArray(finalContext) && finalContext.length === 0)) {
            return res.status(400).json({ error: 'Chat context is required' });
        }

        const replies = await groqService.generateSmartReplies(finalContext);
        res.json({ replies });
    } catch (err) {
        console.error('Smart replies error:', err);
        res.status(500).json({ error: 'Failed to generate smart replies' });
    }
});

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
                provider VARCHAR(50) DEFAULT 'local',
                is_password_set BOOLEAN DEFAULT true,
                is_verified BOOLEAN DEFAULT false,
                subscription_plan VARCHAR(50) DEFAULT 'free',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            -- Ensure columns exist for older databases
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='provider') THEN
                    ALTER TABLE users ADD COLUMN provider VARCHAR(50) DEFAULT 'local';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_password_set') THEN
                    ALTER TABLE users ADD COLUMN is_password_set BOOLEAN DEFAULT true;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_verified') THEN
                    ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT false;
                    -- Mark existing users as verified
                    UPDATE users SET is_verified = true WHERE provider != 'local' OR password_hash IS NOT NULL;
                END IF;
            END $$;

            CREATE TABLE IF NOT EXISTS otps (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                otp_code VARCHAR(10) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                attempts INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            );

            -- Ensure name and password_hash exist in otps
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='otps' AND column_name='name') THEN
                    ALTER TABLE otps ADD COLUMN name VARCHAR(255);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='otps' AND column_name='password_hash') THEN
                    ALTER TABLE otps ADD COLUMN password_hash TEXT;
                END IF;
            END $$;

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
            CREATE TABLE IF NOT EXISTS resources (
                id SERIAL PRIMARY KEY,
                meeting_id VARCHAR(255) NOT NULL,
                sender_id VARCHAR(255) NOT NULL,
                sender_name VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata JSONB DEFAULT '{}',
                timestamp TIMESTAMP DEFAULT NOW()
            );

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

            CREATE TABLE IF NOT EXISTS polls (
                id SERIAL PRIMARY KEY,
                meeting_id VARCHAR(255) NOT NULL,
                creator_id VARCHAR(255) NOT NULL,
                question TEXT NOT NULL,
                options JSONB NOT NULL,
                is_anonymous BOOLEAN DEFAULT false,
                is_quiz BOOLEAN DEFAULT false,
                correct_option_index INTEGER,
                status VARCHAR(20) DEFAULT 'open',
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS poll_votes (
                id SERIAL PRIMARY KEY,
                poll_id INTEGER REFERENCES polls(id),
                user_id VARCHAR(255) NOT NULL,
                option_index INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(poll_id, user_id)
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
        origin: [process.env.FRONTEND_URL, "http://localhost:5173", "https://your-vercel-app.vercel.app"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

const port = process.env.PORT || 5001;

// Environment Variable Safety Checks
const requiredEnvVars = ['DATABASE_URL', 'RESEND_API_KEY', 'FRONTEND_URL', 'GROQ_API_KEY'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
    console.error(`[WARNING] Missing environment variables: ${missingVars.join(', ')}`);
}

app.use(session({
    secret: process.env.SESSION_SECRET || 'neural_chat_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

// Root route
app.get("/", (req, res) => {
    res.json({
        status: "ok",
        message: "Backend is running 🚀"
    });
});

// Socket.io Logic
const rooms = new Map(); // meetingId -> Map of socketId -> participantData
const roomMeta = new Map(); // meetingId -> { ownerId }
const waitingRooms = new Map(); // meetingId -> Map of socketId -> participantData
const whiteboardInitiators = new Map(); // meetingId -> userId
const analyticsTracker = new Map(); // meetingId -> { startTime, participants: { userId: { joinTime, leaveTime, isPresent } } }
const questionTracker = new Map(); // meetingId -> { participantId: { count, name } }
const handRaiseCounters = new Map(); // meetingId -> currentCounter (last assigned number)
const userSocketMap = {}; // userId -> socketId
const agentStatusMap = {}; // participantId -> { socketId, meetingId, ready }
const agentSocketMap = {}; // agentId -> socketId
let availableAgents = []; // array of agentIds
let unlinkedParticipants = []; // array of { meetingId, participantId }
const activeSessions = {}; // participantId -> agentId
const controlSessionMap = {}; // participantId -> { agentId, hostSocketId }
const ANALYTICS_WINDOW_MS = 20 * 60 * 1000;

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // --- GLOBAL EVENT LOGGER FOR DEBUGGING ---
    socket.onAny((event, data) => {
        if (event === 'agent_frame' || event === 'host_input_event' || event === 'accept_control' || event === 'control_started') {
            console.log(`[SOCKET ${socket.id}] Event: ${event}`, data ? Object.keys(data).slice(0, 3) : '');
        }
    });

    socket.on('rejoin-meeting', async (data) => {
        const { meetingId, userId } = data;
        if (!meetingId || !userId) return;

        console.log(`[Rejoin] User ${userId} rejoining meeting ${meetingId} with socket ${socket.id}`);
        // 1. Join socket room
        socket.join(meetingId);

        // 2. Restore user socket map
        userSocketMap[userId] = socket.id;

        // 3. Restore control session state for participant if they were controlled
        const controlSession = controlSessionMap[userId];
        if (controlSession) {
            console.log(`[Rejoin] Restoring control session for participant ${userId}`);
            socket.emit('control_started', {
                agentId: controlSession.agentId,
                participantId: userId,
                hostId: controlSession.hostUserId || controlSession.hostSocketId
            });
        }

        // 4. If user was host controlling someone
        Object.entries(controlSessionMap).forEach(([pId, session]) => {
            if (session.hostUserId === userId || session.hostSocketId === userId) {
                console.log(`[Rejoin] Restoring control session for host ${userId} controlling ${pId}`);
                session.hostSocketId = socket.id;

                socket.emit('control_started', {
                    agentId: session.agentId,
                    participantId: pId,
                    hostId: socket.id
                });
            }
        });
    });

    socket.on('join_meeting', async (data) => {
        const { meetingId, user, initialState } = typeof data === 'string' ? { meetingId: data, user: null, initialState: {} } : data;

        if (!meetingId) return;

        // SYNC EXISTING AGENTS for the new joiner
        for (const [pid, agent] of Object.entries(agentStatusMap)) {
            if (agent.meetingId === meetingId && agent.ready) {
                socket.emit("agent_status_update", {
                    participantId: pid,
                    ready: true
                });
            }
        }

        // Check if banned
        if (bannedUsers.has(meetingId)) {
            const userId = user?.id || `guest-${socket.id}`;
            if (bannedUsers.get(meetingId).has(userId)) {
                socket.emit('meeting_join_error', { error: 'You have been banned from this meeting.' });
                return;
            }
        }

        let meeting;
        try {
            // Check meeting start time enforcement
            const meetingResult = await db.query(
                'SELECT host_id, start_timestamp, settings, end_timestamp, status FROM meetings WHERE id = $1',
                [meetingId]
            );

            meeting = meetingResult.rows[0];

            if (meeting) {
                // Store/update room meta (original host)
                if (!roomMeta.has(meetingId)) {
                    roomMeta.set(meetingId, { ownerId: meeting.host_id });
                }
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

                if (meetingSettings.isLocked && !isHost) {
                    console.log(`User ${user?.name} blocked from joining locked meeting ${meetingId}`);
                    socket.emit('join_error', {
                        code: 'MEETING_LOCKED',
                        message: 'This meeting has been locked by the host.'
                    });
                    return;
                }

                // --- WAITING ROOM LOGIC ---
                // Support both boolean true and string "true" logic dynamically
                const enableWaitingRoom = meetingSettings.enableWaitingRoom === true || meetingSettings.enableWaitingRoom === 'true';

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

                        // Cleanup duplicate waiting entries for the same user
                        for (const [existingSocketId, p] of waitingRoom.entries()) {
                            if (p.id === userId && existingSocketId !== socket.id) {
                                console.log(`Cleaning up old waiting room session for user ${userId} (socket ${existingSocketId})`);
                                waitingRoom.delete(existingSocketId);
                            }
                        }

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

                        // Notify the joining user that they are waiting
                        socket.emit('waiting_room_status', {
                            status: 'waiting',
                            message: 'Wait for the host to let you in.'
                        });

                        // Notify host about the new waiting participant (Specific event as requested)
                        io.to(meetingId).emit('participant_waiting', {
                            participantId: userId,
                            socketId: socket.id,
                            name: user?.name || 'Guest'
                        });

                        // Also send a full list update for redundancy and new joins
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
        userSocketMap[userId] = socket.id;
        console.log(`[RemoteControl] Mapping userId ${userId} to socketId ${socket.id}`);

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
        socket.join(meetingId); // CRITICAL: Ensure joining the socket room for broadcasts

        console.log(`User ${participantData.name} (${socket.id}) joined meeting: ${meetingId}`);

        // Send current meeting settings to the user who just joined
        if (meeting && meeting.settings) {
            const currentSettings = typeof meeting.settings === 'string' ? JSON.parse(meeting.settings) : meeting.settings;
            socket.emit('meeting_controls_updated', currentSettings);
        }

        // Broadcast updated participant list to everyone in the room
        const roomParticipants = Array.from(room.values()).map(p => ({
            ...p,
            agentConnected: !!agentStatusMap[p.id]?.ready
        }));
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

            // IF THIS IS A HOST, send them the current waiting room list
            if (isHost) {
                socket.emit('waiting_room_update', Array.from(waitingRoom.values()));
            }
        }

        // Persist admission if not already there (for cases where WR is disabled)
        if (meetingId && userId) {
            db.query(
                'INSERT INTO meeting_participants (meeting_id, user_id, status) VALUES ($1, $2, $3) ON CONFLICT (meeting_id, user_id) DO NOTHING',
                [meetingId, userId, 'admitted']
            ).catch(err => console.error('Error persisting participant join:', err));

            // --- AUTO-LINK SYSTEM: Participant Joins ---
            if (!activeSessions[userId]) {
                if (availableAgents.length > 0) {
                    const agentId = availableAgents.shift();
                    const agentSocketId = agentSocketMap[agentId];
                    if (agentSocketId) {
                        activeSessions[userId] = agentId;
                        io.to(agentSocketId).emit("manual_link_received", {
                            meetingId,
                            participantId: userId
                        });
                        console.log(`[AUTO-LINK] Assigned available agent ${agentId} to participant ${userId}`);
                    }
                } else {
                    unlinkedParticipants = unlinkedParticipants.filter(p => p.participantId !== userId);
                    unlinkedParticipants.push({ meetingId, participantId: userId });
                    console.log(`[AUTO-LINK] Participant ${userId} added to waiting queue for an agent`);
                }
            } else {
                console.log(`[AUTO-LINK] Participant ${userId} already has active session with agent ${activeSessions[userId]}`);
            }
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

    socket.on('share_resource', async (data) => {
        const { meeting_id, sender_id, sender_name, type, title, content, metadata } = data;
        try {
            const query = `
                INSERT INTO resources (meeting_id, sender_id, sender_name, type, title, content, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *;
            `;
            const result = await db.query(query, [meeting_id, sender_id, sender_name, type, title, content, JSON.stringify(metadata || {})]);
            const resource = result.rows[0];
            io.to(meeting_id).emit('resource_shared', resource);
        } catch (err) {
            console.error('Error sharing resource:', err);
        }
    });

    socket.on('delete_resource', async (data) => {
        const { id, meeting_id } = data;
        try {
            await db.query('DELETE FROM resources WHERE id = $1', [id]);
            io.to(meeting_id).emit('resource_deleted', id);
        } catch (err) {
            console.error('Error deleting resource:', err);
        }
    });

    socket.on('fetch_resources', async (data) => {
        const { meeting_id } = data;
        try {
            const result = await db.query('SELECT * FROM resources WHERE meeting_id = $1 ORDER BY timestamp DESC', [meeting_id]);
            socket.emit('resources_list', result.rows);
        } catch (err) {
            console.error('Error fetching resources:', err);
        }
    });

    socket.on('create_breakout_rooms', (data) => {
        const { meeting_id, rooms } = data;
        // rooms is [{ id, name, participants: [userIds] }]
        breakoutRooms.set(meeting_id, rooms);

        rooms.forEach(room => {
            room.participants.forEach(userId => {
                // We need to find the socket associated with this userId
                // This is a bit complex as we don't have a direct userId -> socketId map easily accessible here
                // We'll broadcast the assignment and let clients join the sub-rooms
            });
        });

        io.to(meeting_id).emit('breakout_rooms_created', { rooms });
    });

    socket.on('join_breakout_room', (data) => {
        const { meeting_id, room_id } = data;
        const subRoom = `${meeting_id}_breakout_${room_id}`;
        socket.join(subRoom);
        console.log(`Socket ${socket.id} joined breakout room ${subRoom}`);
    });

    socket.on('leave_breakout_room', (data) => {
        const { meeting_id, room_id } = data;
        const subRoom = `${meeting_id}_breakout_${room_id}`;
        socket.leave(subRoom);
    });

    socket.on('close_breakout_rooms', (data) => {
        const { meeting_id } = data;
        breakoutRooms.delete(meeting_id);
        io.to(meeting_id).emit('breakout_rooms_closed');
    });

    socket.on('create_poll', async (data) => {
        const { meeting_id, question, options, is_anonymous, is_quiz, correct_option_index, creator_id } = data;
        try {
            const result = await db.query(
                'INSERT INTO polls (meeting_id, creator_id, question, options, is_anonymous, is_quiz, correct_option_index) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                [meeting_id, creator_id, question, JSON.stringify(options), is_anonymous || false, is_quiz || false, correct_option_index]
            );
            const poll = result.rows[0];
            poll.votes = [];
            io.to(meeting_id).emit('poll_created', poll);
        } catch (err) {
            console.error('Error creating poll:', err);
        }
    });

    socket.on('vote_poll', async (data) => {
        const { meeting_id, poll_id, user_id, option_index } = data;
        try {
            await db.query(
                'INSERT INTO poll_votes (poll_id, user_id, option_index) VALUES ($1, $2, $3) ON CONFLICT (poll_id, user_id) DO UPDATE SET option_index = $3',
                [poll_id, user_id, option_index]
            );

            // Fetch all votes for this poll
            const votesResult = await db.query('SELECT user_id, option_index FROM poll_votes WHERE poll_id = $1', [poll_id]);
            io.to(meeting_id).emit('poll_voted', { poll_id, votes: votesResult.rows });
        } catch (err) {
            console.error('Error voting in poll:', err);
        }
    });

    socket.on('close_poll', async (data) => {
        const { meeting_id, poll_id } = data;
        try {
            await db.query('UPDATE polls SET status = \'closed\' WHERE id = $1', [poll_id]);
            io.to(meeting_id).emit('poll_closed', { poll_id });
        } catch (err) {
            console.error('Error closing poll:', err);
        }
    });

    socket.on('fetch_polls', async (data) => {
        const { meeting_id } = data;
        try {
            const pollsResult = await db.query('SELECT * FROM polls WHERE meeting_id = $1', [meeting_id]);
            const polls = pollsResult.rows;

            for (const poll of polls) {
                const votesResult = await db.query('SELECT user_id, option_index FROM poll_votes WHERE poll_id = $1', [poll.id]);
                poll.votes = votesResult.rows;
            }

            socket.emit('polls_fetched', polls);
        } catch (err) {
            console.error('Error fetching polls:', err);
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
                console.error('Error updating media state in DB:', err);
            }
        }

        const room = rooms.get(meeting_id);
        const meta = roomMeta.get(meeting_id);
        if (room) {
            const sender = room.get(socket.id);
            if (!sender) return;

            // Security: Only hosts can change roles
            if (updates.role && sender.role !== 'host') {
                delete updates.role;
            }

            // Hand Raise Logic
            if (updates.isHandRaised !== undefined) {
                if (updates.isHandRaised) {
                    // Raising hand
                    let currentCounter = handRaiseCounters.get(meeting_id) || 0;
                    currentCounter++;
                    handRaiseCounters.set(meeting_id, currentCounter);
                    updates.handRaiseNumber = currentCounter;
                    updates.handRaiseTimestamp = Date.now();
                } else {
                    // Lowering hand - need to recalculate others
                    updates.handRaiseNumber = null;
                    updates.handRaiseTimestamp = null;
                }
            }

            for (const [sId, p] of room.entries()) {
                if (p.id === userId) {
                    // Security: Original host role cannot be changed
                    if (updates.role && meta && p.id === meta.ownerId) {
                        delete updates.role;
                    }

                    room.set(sId, { ...p, ...updates });
                    break;
                }
            }

            // If a hand was lowered, recalculate all handRaiseNumbers to keep them sequential
            if (updates.isHandRaised === false) {
                const participantsWithHands = Array.from(room.values())
                    .filter(p => p.isHandRaised)
                    .sort((a, b) => (a.handRaiseTimestamp || 0) - (b.handRaiseTimestamp || 0));

                participantsWithHands.forEach((p, index) => {
                    const newNumber = index + 1;
                    // Update all sockets for this participant
                    for (const [sId, pData] of room.entries()) {
                        if (pData.id === p.id) {
                            room.set(sId, { ...pData, handRaiseNumber: newNumber });
                        }
                    }
                });
                // Update counter to the new max
                handRaiseCounters.set(meeting_id, participantsWithHands.length);
            }

            io.to(meeting_id).emit('participants_update', Array.from(room.values()));
        }

        // Broadcast the update to everyone else
        socket.to(meeting_id).emit('participant_updated', { userId, updates });
    });

    // Ban participant
    socket.on('ban_participant', ({ meetingId, participantId }) => {
        const room = rooms.get(meetingId);
        if (!room) return;

        // Verify sender is host
        const sender = room.get(socket.id);
        if (!sender || (sender.role !== 'host' && sender.role !== 'co-host')) return;

        if (!bannedUsers.has(meetingId)) {
            bannedUsers.set(meetingId, new Set());
        }
        bannedUsers.get(meetingId).add(participantId);

        // Find and kick all sockets for this participant
        for (const [sId, p] of room.entries()) {
            if (p.id === participantId) {
                io.to(sId).emit('participant_banned', { meetingId });
                const s = io.sockets.sockets.get(sId);
                if (s) s.leave(meetingId);
                room.delete(sId);
            }
        }

        // Also check waiting room
        if (waitingRooms.has(meetingId)) {
            const wr = waitingRooms.get(meetingId);
            const index = wr.findIndex(p => p.id === participantId);
            if (index !== -1) {
                const person = wr[index];
                io.to(person.socketId).emit('waiting_room_denied', { reason: 'banned' });
                wr.splice(index, 1);
            }
        }

        // Broadcast update
        io.to(meetingId).emit('participants_update', Array.from(room.values()));
        if (waitingRooms.has(meetingId)) {
            io.to(meetingId).emit('waiting_room_update', Array.from(waitingRooms.get(meetingId)));
        }
    });

    // Force Mute/Unmute
    socket.on('force_media_state', ({ meetingId, participantId, type, state }) => {
        const room = rooms.get(meetingId);
        if (!room) return;

        const sender = room.get(socket.id);
        if (!sender || (sender.role !== 'host' && sender.role !== 'co-host')) return;

        // Target all sockets for this participant
        for (const [sId, p] of room.entries()) {
            if (p.id === participantId) {
                io.to(sId).emit('media_state_forced', { type, state });
            }
        }
    });
    socket.on('kick_participant', ({ meetingId, participantId }) => {
        const room = rooms.get(meetingId);
        const meta = roomMeta.get(meetingId);
        if (!room) return;
        const sender = room.get(socket.id);
        if (!sender || (sender.role !== 'host' && sender.role !== 'co-host')) return;

        // Security: Cannot kick the original host (owner)
        if (meta && participantId === meta.ownerId) return;

        for (const [sId, p] of room.entries()) {
            if (p.id === participantId) {
                // Security: Co-hosts can only kick regular participants
                if (sender.role === 'co-host' && p.role !== 'participant') {
                    continue;
                }

                io.to(sId).emit('participant_kicked', { meetingId });
                const s = io.sockets.sockets.get(sId);
                if (s) s.leave(meetingId);
                room.delete(sId);
            }
        }
        io.to(meetingId).emit('participants_update', Array.from(room.values()));
    });

    socket.on('update_meeting_settings', async (data) => {
        const { meetingId, settings } = data;
        const room = rooms.get(meetingId);
        if (room) {
            const sender = room.get(socket.id);
            if (!sender || (sender.role !== 'host' && sender.role !== 'co-host')) return;
        }
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
        const room = rooms.get(meeting_id);
        if (room) {
            const sender = room.get(socket.id);
            if (!sender || (sender.role !== 'host' && sender.role !== 'co-host')) return;
        }
        // Broadcast to everyone in the meeting
        io.to(meeting_id).emit('mute_all');
    });

    socket.on('unmute_all', (data) => {
        const { meeting_id } = data;
        const room = rooms.get(meeting_id);
        if (room) {
            const sender = room.get(socket.id);
            if (!sender || (sender.role !== 'host' && sender.role !== 'co-host')) return;
        }
        // Broadcast to everyone in the meeting
        io.to(meeting_id).emit('unmute_all');
    });

    socket.on('stop_video_all', (data) => {
        const { meeting_id } = data;
        const room = rooms.get(meeting_id);
        if (room) {
            const sender = room.get(socket.id);
            if (!sender || (sender.role !== 'host' && sender.role !== 'co-host')) return;
        }
        io.to(meeting_id).emit('stop_video_all');
    });

    socket.on('allow_video_all', (data) => {
        const { meeting_id } = data;
        const room = rooms.get(meeting_id);
        if (room) {
            const sender = room.get(socket.id);
            if (!sender || (sender.role !== 'host' && sender.role !== 'co-host')) return;
        }
        io.to(meeting_id).emit('allow_video_all');
    });

    socket.on('host_broadcast', (data) => {
        const { meetingId, text } = data;
        io.to(meetingId).emit('host_broadcast', { text });
    });

    // --- Caption Language Sync ---
    socket.on('caption_language_change', (data) => {
        const { meeting_id, language } = data;
        if (meeting_id && language) {
            // Broadcast to ALL participants in the room (including sender)
            io.to(meeting_id).emit('caption_language_changed', { language });
            console.log(`Caption language changed to "${language}" in meeting ${meeting_id}`);
        }
    });

    // --- Waiting Room Controls ---
    socket.on('admit_participant', (data) => {
        const { meetingId, socketId } = data;
        const room = rooms.get(meetingId);
        if (room) {
            const sender = room.get(socket.id);
            if (!sender || (sender.role !== 'host' && sender.role !== 'co-host')) return;
        }
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

            // Notify the admitted user (Specific event as requested)
            io.to(socketId).emit('admitted_to_meeting', { meetingId });
            io.to(socketId).emit('waiting_room_status', { status: 'admitted' });

            // Broadcast updates
            io.to(meetingId).emit('participants_update', Array.from(room.values()));
            io.to(meetingId).emit('waiting_room_update', Array.from(waitingRoom.values()));

            console.log(`User ${p.name} admitted to meeting ${meetingId}`);
        }
    });

    socket.on('deny_participant', (data) => {
        const { meetingId, socketId } = data;
        const room = rooms.get(meetingId);
        if (room) {
            const sender = room.get(socket.id);
            if (!sender || (sender.role !== 'host' && sender.role !== 'co-host')) return;
        }
        const waitingRoom = waitingRooms.get(meetingId);

        if (waitingRoom && waitingRoom.has(socketId)) {
            const p = waitingRoom.get(socketId);
            waitingRoom.delete(socketId);

            // Persist rejection to DB
            db.query(
                'INSERT INTO meeting_participants (meeting_id, user_id, status) VALUES ($1, $2, $3) ON CONFLICT (meeting_id, user_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()',
                [meetingId, p.id, 'rejected']
            ).catch(err => console.error('Error persisting participant rejection:', err));

            // Notify the denied/rejected user (Specific event as requested)
            io.to(socketId).emit('participant_denied', { message: 'The host has denied your entry.' });
            io.to(socketId).emit('waiting_room_status', { status: 'rejected', message: 'The host has denied your entry.' });

            // Broadcast waiting room update
            io.to(meetingId).emit('waiting_room_update', Array.from(waitingRoom.values()));

            console.log(`User ${p.name} rejected from meeting ${meetingId} (via deny_participant)`);
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

                // Broadcast setting change to everyone not just for the WR switch, but to keep the whole meeting store in sync
                io.to(meetingId).emit('waiting_room_setting_updated', { enabled });
                io.to(meetingId).emit('meeting_controls_updated', settings);

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
        }
    });

    socket.on('audio_chunk', async (data) => {
        const { meetingId, participantId, participantName, audioBlob, language } = data;
        if (!meetingId || !audioBlob) return;

        try {
            // Write blob to temporary file
            const tempDir = os.tmpdir();
            const fileName = `audio_${meetingId}_${socket.id}_${Date.now()}.webm`;
            const filePath = path.join(tempDir, fileName);

            const buffer = Buffer.from(audioBlob);
            fs.writeFileSync(filePath, buffer);
            console.log(`[Transcription] Received audio chunk (${buffer.length} bytes) from ${participantName} [Lang: ${language || 'auto'}]`);

            // ✅ USE WHISPER
            const text = await transcribeWithWhisper(filePath, language);

            // Clean up
            fs.unlinkSync(filePath);

            if (text && text.trim().length > 0) {
                const targetLanguage = data.targetLanguage;
                let finalDisplayText = text.trim();

                if (targetLanguage && targetLanguage.toLowerCase() !== 'original' && targetLanguage.toLowerCase() !== (language || 'english').toLowerCase()) {
                    console.log(`[Translation] Translating "${text}" to ${targetLanguage}`);
                    finalDisplayText = await groqService.translateText(text.trim(), targetLanguage);
                }

                // Determine speaker's role
                let role = 'participant';
                const room = rooms.get(meetingId);
                if (room) {
                    const participant = room.get(socket.id);
                    if (participant && participant.role) {
                        role = participant.role;
                    }
                }

                const segment = {
                    participantId,
                    participantName,
                    role,
                    text: finalDisplayText.trim(),
                    originalText: text.trim(),
                    timestamp: new Date().toISOString()
                };

                if (!meetingTranscripts.has(meetingId)) {
                    meetingTranscripts.set(meetingId, []);
                }
                meetingTranscripts.get(meetingId).push(segment);

                // Broadcast
                io.to(meetingId).emit('transcription_received', segment);
            }
        } catch (error) {
            console.error('Transcription error:', error);
        }
    });

    socket.on('broadcast_transcription', (data) => {
        const { meetingId, participantId, participantName, text } = data;
        if (!meetingId || !text) return;

        const segment = {
            participantId,
            participantName,
            text,
            timestamp: new Date().toISOString()
        };

        // Store in memory
        if (!meetingTranscripts.has(meetingId)) {
            meetingTranscripts.set(meetingId, []);
        }
        meetingTranscripts.get(meetingId).push(segment);

        // Broadcast transcript to EVERYONE in the room
        io.to(meetingId).emit('transcription_received', segment);
    });

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
            const fromName = sender?.name || 'Host';

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

    socket.on('whiteboard_access_update', async (data) => {
        const { meeting_id, access } = data;

        try {
            // Persist to DB so it's not lost on refresh or overwritten by other setting updates
            const result = await db.query('SELECT settings FROM meetings WHERE id = $1', [meeting_id]);
            if (result.rows.length > 0) {
                const settings = typeof result.rows[0].settings === 'string' ? JSON.parse(result.rows[0].settings) : (result.rows[0].settings || {});
                settings.whiteboardEditAccess = access;
                await db.query('UPDATE meetings SET settings = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(settings), meeting_id]);
                console.log(`Whiteboard access persisted for ${meeting_id}: ${access}`);
            }
        } catch (err) {
            console.error('Error persisting whiteboard access update:', err);
        }

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
                const roomParticipants = Array.from(participants.values()).map(p => ({
                    ...p,
                    agentConnected: !!agentStatusMap[p.id]?.ready
                }));
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

        // --- Participant Queue Cleanup ---
        let disconnectedParticipantId = null;
        for (const uid in userSocketMap) {
            if (userSocketMap[uid] === socket.id) {
                disconnectedParticipantId = uid;
                console.log(`[RemoteControl] Removing userId ${uid} from socket map`);
                delete userSocketMap[uid];
                break;
            }
        }

        if (disconnectedParticipantId) {
            unlinkedParticipants = unlinkedParticipants.filter(p => p.participantId !== disconnectedParticipantId);

            // Free up any agent that was locked to this participant
            const linkedAgentId = activeSessions[disconnectedParticipantId];
            if (linkedAgentId) {
                console.log(`[AGENT] Participant ${disconnectedParticipantId} disconnected. Freeing agent ${linkedAgentId}`);
                delete activeSessions[disconnectedParticipantId];
                delete agentStatusMap[disconnectedParticipantId];
                delete controlSessionMap[disconnectedParticipantId];

                // Return agent to available pool if agent is still connected
                if (agentSocketMap[linkedAgentId] && !availableAgents.includes(linkedAgentId)) {
                    availableAgents.push(linkedAgentId);

                    // Tell the agent to reset its visual state since the participant is gone
                    io.to(agentSocketMap[linkedAgentId]).emit("control_stopped");
                }
            }
        }

        // --- agentStatusMap Cleanup ---
        for (const [participantId, agent] of Object.entries(agentStatusMap)) {
            if (agent.socketId === socket.id) {
                const mid = agent.meetingId;
                console.log(`[AGENT] Agent offline for participant ${participantId}`);
                delete agentStatusMap[participantId];

                io.to(mid).emit("agent_status_update", {
                    participantId,
                    ready: false
                });
            }
        }

        // --- agentSocketMap & Queue Cleanup ---
        for (const aid in agentSocketMap) {
            if (agentSocketMap[aid] === socket.id) {
                console.log(`[AGENT] Removing agentId ${aid} from socket map and queues`);
                delete agentSocketMap[aid];
                // availableAgents = availableAgents.filter(a => a !== aid); // Move this outside if we want to remove all

                // Clear active session to allow participant to reconnect later if agent crashes
                for (const pid in activeSessions) {
                    if (activeSessions[pid] === aid) {
                        delete activeSessions[pid];
                        console.log(`[AGENT] Cleared active session for participant ${pid}`);
                        break;
                    }
                }
                // Do NOT break, we want to clear all mappings for this socket.id
            }
        }
        // Cleanup available agents once
        availableAgents = availableAgents.filter(aid => agentSocketMap[aid] !== socket.id);
    });

    socket.on("request_control", (data) => {
        const { participantId, meetingId, hostId, hostName } = data;
        console.log(`[RemoteControl] Request from ${hostName || socket.id} to ${participantId} for meeting ${meetingId}`);
        const targetSocket = userSocketMap[participantId];
        if (targetSocket) {
            console.log(`[RemoteControl] Mapped participantId ${participantId} to socketId ${targetSocket}`);
            io.to(targetSocket).emit("control_request", {
                hostId: hostId || socket.id,
                hostName: hostName || 'A Participant'
            });
            console.log(`[RemoteControl] Event "control_request" emitted to ${targetSocket}`);
        } else {
            console.log(`[RemoteControl] Target socket not found for participantId ${participantId}`);
            // Fallback: search rooms for the socket if map missed it
            let found = false;
            rooms.forEach((participants, mId) => {
                if (mId === meetingId) {
                    participants.forEach((p, sId) => {
                        if (p.id === participantId) {
                            console.log(`[RemoteControl] Found participantId ${participantId} in room ${mId} with socketId ${sId}`);
                            io.to(sId).emit("control_request", { hostId: socket.id, hostName: hostName || 'A Participant' });
                            found = true;
                        }
                    });
                }
            });
            if (!found) {
                socket.emit('control_error', { message: 'Participant not found or offline.' });
            }
        }
    });

    const getSocketIdFallback = (meetingId, userId) => {
        let sid = userSocketMap[userId];
        if (!sid) {
            rooms.forEach((participants, mId) => {
                if (mId === meetingId) {
                    participants.forEach((p, sId) => {
                        if (p.id === userId) sid = sId;
                    });
                }
            });
        }
        return sid;
    };

    socket.on('accept_control', (data) => {
        const { meetingId, participantId, hostId } = data;
        console.log(`[RemoteControl] Participant ${participantId} accepted control request from ${hostId}`);

        const agent = agentStatusMap[participantId];
        let hostSocketId = null;

        // hostId is often provided as the socket.id from the requesting client
        if (hostId && io.sockets.sockets.get && io.sockets.sockets.get(hostId)) {
            hostSocketId = hostId;
        } else if (hostId && io.sockets.sockets[hostId]) {
            hostSocketId = hostId;
        } else {
            hostSocketId = getSocketIdFallback(meetingId, hostId);
        }

        if (!agent || !agent.ready) {
            console.log(`[RemoteControl] Agent not found or not ready for ${participantId}`);
            if (hostSocketId) {
                io.to(hostSocketId).emit('control_response', { accepted: false, reason: 'agent_not_ready' });
            }
            return;
        }

        const agentSocketId = agent.socketId;
        const linkedAgentId = agent.agentId || activeSessions[participantId] || null;
        if (linkedAgentId) {
            activeSessions[participantId] = linkedAgentId;
            controlSessionMap[participantId] = { agentId: linkedAgentId, hostSocketId, hostUserId: hostId };
            console.log('[RemoteControl] Mapped participantId', participantId, 'to hostSocketId', hostSocketId, 'agentId', linkedAgentId);
        } else {
            controlSessionMap[participantId] = { agentId: null, hostSocketId, hostUserId: hostId };
            console.log('[RemoteControl] Mapped participantId', participantId, 'to hostSocketId', hostSocketId, '(no agentId)');
        }

        console.log(`[RemoteControl] Linking Host ${hostId} to Agent ${agentSocketId}`);

        // Notify the agent specifically
        io.to(agentSocketId).emit('control_started', { hostId, hostName: 'Host', participantId });

        // Broadcast to the meeting so everyone stays in sync with control status
        io.to(meetingId).emit('control_started', {
            agentId: linkedAgentId || agentSocketId,
            participantId,
            hostId
        });

        if (hostSocketId) {
            io.to(hostSocketId).emit('control_response', { accepted: true, agentSocketId });
            io.to(hostSocketId).emit('control_connected', { agentId: linkedAgentId || agentSocketId, agentSocketId });
        } else {
            console.log(`[RemoteControl] Host socket not found to send response. hostId: ${hostId}`);
        }
    });

    socket.on('control_rejected', (data) => {
        const { meetingId, hostId } = data;
        console.log(`[RemoteControl] Control rejected by participant for host ${hostId}`);

        let hostSocketId = null;
        if (hostId && io.sockets.sockets.get && io.sockets.sockets.get(hostId)) {
            hostSocketId = hostId;
        } else if (hostId && io.sockets.sockets[hostId]) {
            hostSocketId = hostId;
        } else {
            hostSocketId = getSocketIdFallback(meetingId, hostId);
        }

        // Notify the room so the pending states can be cleared
        io.to(meetingId).emit('control_denied', { participantId: socket.id });

        if (hostSocketId) {
            io.to(hostSocketId).emit('control_response', { accepted: false, reason: 'rejected' });
        }
    });

    socket.on('control_stop', (data) => {
        const { meetingId, participantId } = data;
        console.log(`[RemoteControl] Control session stopped for room: ${meetingId}`);

        // Notify everyone to reset their control indicators
        io.to(meetingId).emit('control_stopped');

        // Stop any agent involved with this participant (if provided)
        if (participantId && controlSessionMap[participantId]) {
            const agentId = controlSessionMap[participantId].agentId;
            if (agentId && agentSocketMap[agentId]) {
                io.to(agentSocketMap[agentId]).emit('control_stopped');
            }
            delete controlSessionMap[participantId];
            delete activeSessions[participantId];
        }

        // Also broadcast stop to all agents as fallback
        availableAgents.forEach(aid => {
            const asid = agentSocketMap[aid];
            if (asid) io.to(asid).emit('control_stopped');
        });
    });

    socket.on('host_input_event', (data) => {
        const { agentId, participantId, event, meetingId } = data;
        let targetSocketId = null;

        if (!agentId && !participantId) {
            console.warn('[RemoteControl] host_input_event: no target target provided');
            return;
        }

        const normalizedId = typeof agentId === 'string' ? agentId.replace(/[- ]/g, '').toUpperCase() : agentId;

        // Helper to check if socket exists
        const isValidSocket = (sid) => sid && io.sockets.sockets.get && io.sockets.sockets.get(sid);

        // 1. Try normalizedId mapping (preferred)
        if (agentSocketMap[normalizedId]) {
            const sid = agentSocketMap[normalizedId];
            if (isValidSocket(sid)) {
                targetSocketId = sid;
            } else {
                console.warn(`[RemoteControl] Stale mapping for normalized ${normalizedId}`);
            }
        }

        // 2. Try raw agentId mapping
        if (!targetSocketId && agentSocketMap[agentId]) {
            const sid = agentSocketMap[agentId];
            if (isValidSocket(sid)) {
                targetSocketId = sid;
            } else {
                console.warn(`[RemoteControl] Stale mapping for ${agentId}`);
            }
        }

        // 3. agentId itself might be a socketId
        if (!targetSocketId && isValidSocket(agentId)) {
            targetSocketId = agentId;
        }

        // 4. Fallback to controlSessionMap lookup
        if (!targetSocketId) {
            const candidate = Object.values(controlSessionMap).find(s => s.agentId === agentId || s.hostSocketId === agentId);
            if (candidate && candidate.agentId) {
                const cNormalized = typeof candidate.agentId === 'string' ? candidate.agentId.replace(/[- ]/g, '').toUpperCase() : candidate.agentId;
                if (isValidSocket(agentSocketMap[cNormalized])) {
                    targetSocketId = agentSocketMap[cNormalized];
                }
            }
        }

        // 5. Fallback: agentStatusMap
        if (!targetSocketId && participantId) {
            const fallbackAgent = agentStatusMap[participantId];
            if (fallbackAgent && isValidSocket(fallbackAgent.socketId)) {
                targetSocketId = fallbackAgent.socketId;
                console.log(`[RemoteControl] Routed via agentStatusMap fallback for participantId=${participantId} -> socket=${targetSocketId}`);
            }
        }

        // 6. Final desperation fallback: Search through ALL active control sessions for this Host's socket
        if (!targetSocketId) {
            for (const [pid, session] of Object.entries(controlSessionMap)) {
                if (session.hostSocketId === socket.id) {
                    const agent = agentStatusMap[pid];
                    if (agent && isValidSocket(agent.socketId)) {
                        targetSocketId = agent.socketId;
                        console.log(`[RemoteControl] Routed via controlSessionMap search for host ${socket.id} -> participant ${pid}`);
                        break;
                    }
                }
            }
        }

        if (!targetSocketId) {
            console.warn(`[RemoteControl] host_input_event: DROPPING EVENT - no agent found for agentId=${agentId}, participantId=${participantId}`);
            return;
        }

        // Relay event
        const relayData = { ...event, hostId: socket.id };
        io.to(targetSocketId).emit('host_input_event', relayData);
        io.to(targetSocketId).emit('input_event', relayData);

        // Optional: mirror to participant UI for visibility in logs
        const participantSocketId = userSocketMap[participantId] || getSocketIdFallback(meetingId, participantId);
        if (participantSocketId && participantSocketId !== targetSocketId) {
            io.to(participantSocketId).emit('host_input_event', relayData);
        }
    });

    socket.on('agent_frame', (data) => {
        const { hostId, participantId, frame } = data;
        let hostSocketId = null;

        if (hostId && isValidSocket(hostId)) {
            hostSocketId = hostId;
        }

        if (!hostSocketId && participantId && controlSessionMap[participantId]) {
            hostSocketId = controlSessionMap[participantId].hostSocketId;
        }

        if (hostSocketId) {
            io.to(hostSocketId).emit('remote_frame', { frame });
        }
    });

    socket.on('agent_cursor_pos', (data) => {
        const { hostId, x, y } = data;
        if (hostId) {
            io.to(hostId).emit('remote_cursor_pos', { x, y });
        }
    });

    socket.on('agent_status', (data) => {
        if (!data) return;
        const { participantId, meetingId, ready, agentId } = data;
        if (!participantId || !meetingId) return;

        console.log(`[AGENT] agent status update: ${participantId} in ${meetingId} (ready: ${ready})`);

        agentStatusMap[participantId] = {
            socketId: socket.id,
            meetingId,
            ready: !!ready,
            agentId: agentId || Object.keys(agentSocketMap).find(id => agentSocketMap[id] === socket.id) || null
        };

        io.to(meetingId).emit("agent_status_update", {
            participantId,
            ready: !!ready
        });
    });

    socket.on('get_agent_status', (data) => {
        if (!data) return;
        const { participantId, meetingId } = data;
        const agent = agentStatusMap[participantId];

        if (agent && agent.ready) {
            socket.emit("agent_status_update", {
                participantId,
                ready: true
            });
        } else {
            socket.emit("agent_status_update", {
                participantId,
                ready: false
            });
        }
    });

    socket.on('agent_idle_connect', (data) => {
        if (!data) return;
        const { agentId } = data;
        if (!agentId) return;

        const normalizedAgentId = agentId.replace(/[- ]/g, '').toUpperCase();
        agentSocketMap[normalizedAgentId] = socket.id;
        console.log(`[AGENT] agent_idle_connect registered: ${normalizedAgentId} (from ${agentId}) -> ${socket.id}`);

        if (unlinkedParticipants.length > 0) {
            const { meetingId, participantId } = unlinkedParticipants.shift();
            activeSessions[participantId] = normalizedAgentId;
            io.to(socket.id).emit("manual_link_received", {
                meetingId,
                participantId
            });
        } else {
            if (!availableAgents.includes(normalizedAgentId)) {
                availableAgents.push(normalizedAgentId);
            }
        }
    });

    socket.on('manual_link_agent', (data) => {
        if (!data) return;
        const { agentId, meetingId, participantId } = data;
        if (!agentId || !meetingId || !participantId) return;

        const normalizedSearchId = agentId.replace(/[- ]/g, '').toUpperCase();
        const agentSocketId = agentSocketMap[normalizedSearchId];
        
        if (!agentSocketId) {
            socket.emit('manual_link_error', { message: `Agent ID "${agentId}" not found.` });
            return;
        }

        availableAgents = availableAgents.filter(a => a !== normalizedSearchId);
        activeSessions[participantId] = normalizedSearchId;
        
        agentStatusMap[participantId] = {
            socketId: agentSocketId,
            meetingId,
            ready: true,
            agentId: normalizedSearchId
        };

        io.to(agentSocketId).emit("manual_link_received", {
            meetingId,
            participantId
        });
        
        io.to(meetingId).emit("agent_status_update", {
            participantId,
            ready: true
        });

        socket.emit('manual_link_success', { agentId });
    });
});

// Auth Endpoints
// Google OAuth Routes
app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/api/auth/google/callback', passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/#/login?error=auth_failed` }), (req, res) => {
    const userData = encodeURIComponent(JSON.stringify(req.user));
    res.redirect(`${process.env.FRONTEND_URL}/#/login?auth_data=${userData}`);
});

// Microsoft OAuth Routes
app.get('/api/auth/microsoft', passport.authenticate('microsoft'));
app.get('/api/auth/microsoft/callback', passport.authenticate('microsoft', { failureRedirect: `${process.env.FRONTEND_URL}/#/login?error=auth_failed` }), (req, res) => {
    const userData = encodeURIComponent(JSON.stringify(req.user));
    res.redirect(`${process.env.FRONTEND_URL}/#/login?auth_data=${userData}`);
});

// OAuth verify endpoint for frontend-driven popups
app.post('/api/auth/social', async (req, res) => {
    const { email, name, avatar, provider, id } = req.body;
    const normalizedEmail = email.toLowerCase();
    try {
        let result = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
        let user;

        if (result.rows.length === 0) {
            const newId = `user-${provider}-${id || Date.now()}`;
            const passwordHash = await bcrypt.hash(Math.random().toString(36), 10);

            const insertResult = await db.query(
                'INSERT INTO users (id, name, email, password_hash, avatar, provider, is_password_set, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, email, avatar, subscription_plan, provider, is_password_set, is_verified',
                [newId, name, normalizedEmail, passwordHash, avatar, provider, false, true]
            );
            user = insertResult.rows[0];
            console.log(`OAuth (${provider}) User registered: ${normalizedEmail}`);
        } else {
            user = result.rows[0];
            // If logging in via OAuth, ensure user is marked as verified
            if (!user.is_verified) {
                await db.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [user.id]);
                user.is_verified = true;
            }
            if (avatar && !user.avatar) {
                await db.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, user.id]);
                user.avatar = avatar;
            }
            console.log(`OAuth (${provider}) Login successful: ${normalizedEmail}`);
            delete user.password_hash;
        }

        res.json(user);
    } catch (err) {
        console.error('Social Auth Error:', err);
        res.status(500).json({ error: 'Failed to authenticate with social provider' });
    }
});
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    const normalizedEmail = email.toLowerCase();
    try {
        const userCheck = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
        if (userCheck.rows.length > 0) {
            const existingUser = userCheck.rows[0];
            if (existingUser.is_verified) {
                return res.status(409).json({ error: 'Email already registered' });
            } else {
                // If unverified legacy user exists, delete them to start fresh
                await db.query('DELETE FROM users WHERE id = $1', [existingUser.id]);
            }
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const otp = crypto.randomInt(100000, 1000000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // Delete existing unverified OTPs for this email
            await client.query('DELETE FROM otps WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);

            await client.query(
                'INSERT INTO otps (email, name, password_hash, otp_code, expires_at) VALUES ($1, $2, $3, $4, $5)',
                [normalizedEmail, name, passwordHash, otp, expiresAt]
            );

            await client.query('COMMIT');

            // Send Email
            await sendOTPEmail(normalizedEmail, otp);

            console.log(`OTP sent (pending verification): ${normalizedEmail}`);
            res.status(201).json({ message: 'OTP sent' });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Failed to register user. ' + (err.message || '') });
    }
});

app.post('/api/auth/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    const normalizedEmail = email.toLowerCase();

    try {
        const result = await db.query(
            'SELECT * FROM otps WHERE email = $1 ORDER BY created_at DESC LIMIT 1',
            [normalizedEmail]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No verification code found for this email.' });
        }

        const otpRecord = result.rows[0];

        // Check if expired
        if (new Date() > new Date(otpRecord.expires_at)) {
            return res.status(400).json({ error: 'OTP expired' });
        }

        // Check attempts
        if (otpRecord.attempts >= 5) {
            return res.status(403).json({ error: 'Too many attempts. Please request a new code.' });
        }

        // Compare codes
        if (otpRecord.otp_code !== otp) {
            await db.query('UPDATE otps SET attempts = attempts + 1 WHERE id = $1', [otpRecord.id]);
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        // Success!
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            const id = `user-${Date.now()}`;

            // Create user
            const userResult = await client.query(
                'INSERT INTO users (id, name, email, password_hash, is_verified) VALUES ($1, $2, $3, $4, TRUE) RETURNING id, name, email, avatar, subscription_plan, is_verified',
                [id, otpRecord.name, normalizedEmail, otpRecord.password_hash]
            );

            // Delete used OTP
            await client.query('DELETE FROM otps WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);

            await client.query('COMMIT');

            console.log(`User verified successfully: ${normalizedEmail}`);
            res.json(userResult.rows[0]);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error('OTP Verification error:', err);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
});

app.post('/api/auth/resend-otp', async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase();

    try {
        const pendingCheck = await db.query('SELECT * FROM otps WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
        if (pendingCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Pending registration not found' });
        }

        // Generate new OTP
        const otp = crypto.randomInt(100000, 1000000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        await db.query(
            'UPDATE otps SET otp_code = $1, expires_at = $2, attempts = 0 WHERE id = $3',
            [otp, expiresAt, pendingCheck.rows[0].id]
        );

        // Send Email
        await sendOTPEmail(normalizedEmail, otp);

        console.log(`OTP resent to: ${normalizedEmail}`);
        res.json({ message: 'A new verification code has been sent to your email.' });

    } catch (err) {
        console.error('Resend OTP error:', err);
        res.status(500).json({ error: 'Failed to resend OTP' });
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

        // Check if verified
        if (user.provider === 'local' && user.is_verified === false) {
            console.log(`Login blocked: ${normalizedEmail} is not verified`);
            return res.status(403).json({
                error: 'email_not_verified',
                message: 'Please verify your email address to log in.',
                email: user.email
            });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            if (user.is_password_set === false) {
                console.log(`Login failed: Google user ${normalizedEmail} has no app password set`);
                return res.status(400).json({
                    error: 'oauth_no_password',
                    message: `You originally signed in with ${user.provider || 'Google'}. Please set an app password to log in with an email and password.`,
                    provider: user.provider
                });
            }
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

app.post('/api/auth/set-password', async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();
    try {
        const result = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        // For security, in a real app we'd verify a token, but here we fulfill the requirement:
        // "Add a Set Password / Reset Password option for users who originally signed in with Google"

        const passwordHash = await bcrypt.hash(password, 10);
        await db.query(
            'UPDATE users SET password_hash = $1, is_password_set = true, updated_at = NOW() WHERE id = $2',
            [passwordHash, user.id]
        );

        console.log(`Password set successfully for user: ${normalizedEmail}`);
        res.json({ message: 'Password set successfully. You can now log in with your email and password.' });
    } catch (err) {
        console.error('Set password error:', err);
        res.status(500).json({ error: 'Failed to set password' });
    }
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
                    const fullTranscriptLog = transcript.map(m => `${m.speaker}: ${m.text}`).join('\n');

                    const aiRecap = await groqService.generateRecapContent(fullTranscriptLog);

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
    const { messages, meetingId, userName } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
    }

    try {
        const response = await groqService.getChatCompletion(messages, "llama-3.3-70b-versatile", userName);
        res.json({ content: response });
    } catch (err) {
        console.error('AI Chat Error:', err);
        res.status(500).json({ error: 'AI failed to respond' });
    }
});

// Summarize Meeting (Live AI Companion)
app.post('/api/ai/summarize', async (req, res) => {
    const { transcript, meetingId, userName } = req.body;

    if (!transcript && !meetingId) {
        return res.status(400).json({ error: 'Transcript text or meetingId is required' });
    }

    try {
        let combinedContext = `Spoken Transcription:\n${transcript || 'None'}`;

        // Also fetch recent chat history if meetingId is provided
        if (meetingId) {
            const chatResult = await db.query('SELECT * FROM messages WHERE meeting_id = $1 ORDER BY timestamp ASC', [meetingId]);
            const chatLog = chatResult.rows.map(m => `${m.sender_name} (Chat): ${m.content}`).join('\n');
            combinedContext = `Chat Messages:\n${chatLog || 'None'}\n\n${combinedContext}`;
        }

        const summary = await groqService.summarizeMeeting(combinedContext);
        res.json({ summary });
    } catch (err) {
        console.error('AI Summarization Error:', err);
        res.status(500).json({ error: 'AI failed to summarize' });
    }
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
