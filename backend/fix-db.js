require('dotenv').config();
const db = require('./db');

async function fix() {
    try {
        const client = await db.pool.connect();
        await client.query('DELETE FROM users WHERE LOWER(email) = LOWER($1)', ['pinkyrosie@gmail.com']);
        await client.query('DELETE FROM otps WHERE LOWER(email) = LOWER($1)', ['pinkyrosie@gmail.com']);
        console.log('Successfully cleared legacy testing data for pinkyrosie.');
        client.release();
        process.exit(0);
    } catch (err) {
        console.error('Error clearing DB:', err);
        process.exit(1);
    }
}

fix();
