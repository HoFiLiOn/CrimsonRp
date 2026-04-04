const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS news (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            date TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    const res = await pool.query('SELECT COUNT(*) FROM news');
    if (parseInt(res.rows[0].count) === 0) {
        await pool.query(`
            INSERT INTO news (title, content, date) VALUES 
            ('CRIMSON RP ОТКРЫТ', 'Добро пожаловать на проект. Сервер официально запущен.', '2026-04-05')
        `);
    }
}

initDB();

module.exports = pool;
