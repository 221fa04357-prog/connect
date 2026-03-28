require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: String(process.env.DB_PASSWORD),
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const res = await pool.query("SELECT * FROM users WHERE email = 'sravyavajja5@gmail.com'");
        console.log("User:", res.rows);
        await pool.query("DELETE FROM users WHERE email = 'sravyavajja5@gmail.com'");
        console.log("Deleted");
    } catch(err) {
        console.error(err);
    } finally {
        pool.end();
    }
}
run();
