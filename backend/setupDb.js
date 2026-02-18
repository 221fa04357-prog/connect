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

    // Seed initial data if table is empty (disabled mock seeds for real data flow)
    /*
    const recapCount = await db.query('SELECT COUNT(*) FROM recaps');
    if (parseInt(recapCount.rows[0].count) === 0) {
      ...
    }
    */
    console.log('Database setup complete: all tables created/verified.');
    process.exit(0);
  } catch (err) {
    console.error('Database setup failed:', err);
    process.exit(1);
  }
}

setup();
