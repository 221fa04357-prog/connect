const db = require('./db');
require('dotenv').config();

console.log(`Connecting to database: ${process.env.DB_NAME} as user: ${process.env.DB_USER}`);

async function setup() {
  try {
    console.log('Setting up database...');

    // Create tables if not exists
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
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS meetings (
        id VARCHAR(255) PRIMARY KEY,
        title TEXT NOT NULL,
        host_id VARCHAR(255) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        duration INTEGER DEFAULT 60,
        status VARCHAR(50) DEFAULT 'scheduled',
        settings JSONB DEFAULT '{}',
        password VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

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

    // Seed initial data if table is empty
    const recapCount = await db.query('SELECT COUNT(*) FROM recaps');
    if (parseInt(recapCount.rows[0].count) === 0) {
      console.log('Seeding initial recap data...');
      const mockRecaps = [
        {
          id: 'mock-1',
          title: 'Product Roadmap Q3 Sync',
          date: 'Feb 12, 2026',
          timestamp: new Date('2026-02-12').getTime(),
          host: 'Alex Rivera',
          duration: '45 mins',
          participants: ['Alex Rivera', 'Sarah Chen', 'Jordan Smith', 'Maria Garcia'],
          summary: [
            'Confirmed Q3 Roadmap priorities focusing on AI integration.',
            'Agreed to delay the legacy database refactor to Q4.',
            'Identified critical mobile responsiveness issues on iOS devices.',
            'Proposed a new design for the user settings panel and permissions.',
            'Decided to increase server capacity by 20% for the upcoming beta event.'
          ],
          action_items: [
            { id: 'a1', text: 'Create high-fidelity mockups for new settings panel', completed: true },
            { id: 'a2', text: 'Schedule follow-up meeting with Infra team about server capacity', completed: false },
            { id: 'a3', text: 'Audit iOS media stream handling for orientation changes', completed: false },
            { id: 'a4', text: 'Update stakeholder deck with revised Q3 timeline', completed: true }
          ],
          transcript: [
            { speaker: 'Alex Rivera', time: '10:02 AM', text: "Welcome everyone. Let's start with the Q3 roadmap updates." },
            { speaker: 'Sarah Chen', time: '10:05 AM', text: "The AI companion feature is progressing well, but we might need more time for the core engine refactor." },
            { speaker: 'Jordan Smith', time: '10:12 AM', text: "I suggest we prioritize the AI features since they have higher stakeholder visibility." },
            { speaker: 'Maria Garcia', time: '10:15 AM', text: "Agreed. Let's shift the database refactor to Q4 then." }
          ]
        },
        {
          id: 'mock-2',
          title: 'Design System Review',
          date: 'Feb 11, 2026',
          timestamp: new Date('2026-02-11').getTime(),
          host: 'Sarah Chen',
          duration: '60 mins',
          participants: ['Sarah Chen', 'Emma Wilson', 'David Lee'],
          summary: ['Reviewed color palette for accessibility', 'Finalized button component variants'],
          action_items: [{ id: 'b1', text: 'Publish v1.2 of the UI kit', completed: false }],
          transcript: [{ speaker: 'Sarah Chen', time: '2:00 PM', text: "Let's look at the contrast ratios." }]
        }
      ];

      for (const recap of mockRecaps) {
        await db.query(`
          INSERT INTO recaps (id, title, date, timestamp, host, duration, participants, summary, action_items, transcript)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [recap.id, recap.title, recap.date, recap.timestamp, recap.host, recap.duration, JSON.stringify(recap.participants), JSON.stringify(recap.summary), JSON.stringify(recap.action_items), JSON.stringify(recap.transcript)]);
      }
      console.log('Seeding complete.');
    }

    console.log('Database setup complete: all tables created/verified.');
    process.exit(0);
  } catch (err) {
    console.error('Database setup failed:', err);
    process.exit(1);
  }
}

setup();
