const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS news (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            date TEXT NOT NULL,
            tags TEXT[] DEFAULT '{}',
            media TEXT[] DEFAULT '{}',
            likes INTEGER DEFAULT 0,
            dislikes INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    const res = await pool.query('SELECT COUNT(*) FROM news');
    if (parseInt(res.rows[0].count) === 0) {
        await pool.query(`
            INSERT INTO news (title, content, date, tags, likes) VALUES 
            ('CRIMSON RP ОТКРЫТ', 'Добро пожаловать на проект!', '2026-04-05', ARRAY['Открытие', 'Важное'], 10)
        `);
    }
}

initDB();

module.exports = pool;
