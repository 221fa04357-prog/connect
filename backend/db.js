const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.DATABASE_URL;

const pool = new Pool(
    isProduction
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false,
            },
        }
        : {
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'connect_pro',
            password: process.env.DB_PASSWORD || 'krish#1821',
            port: process.env.DB_PORT || 5432,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        }
);

pool.on('connect', () => {
    console.log('Connected to PostgreSQL');
});

pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL error', err);
    process.exit(1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
