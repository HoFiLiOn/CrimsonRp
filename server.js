const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const pool = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

const upload = multer({ dest: 'uploads/' });

// Получить все новости
app.get('/api/news', async (req, res) => {
    const result = await pool.query('SELECT * FROM news ORDER BY likes DESC, id DESC');
    res.json(result.rows);
});

// Добавить новость (с фото/видео в base64)
app.post('/api/news', async (req, res) => {
    const { title, content, tags, media, secret } = req.body;
    
    if (secret !== 'АДМИНКА') {
        return res.status(403).json({ error: 'Неверное секретное слово' });
    }
    
    const date = new Date().toLocaleDateString('ru-RU');
    const tagsArray = tags ? tags.split(',').map(t => t.trim()) : [];
    const mediaArray = media || [];
    
    await pool.query(
        'INSERT INTO news (title, content, date, tags, media) VALUES ($1, $2, $3, $4, $5)',
        [title, content, date, tagsArray, mediaArray]
    );
    res.json({ success: true });
});

// Удалить новость
app.delete('/api/news/:id', async (req, res) => {
    await pool.query('DELETE FROM news WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

// Голосование
app.post('/api/news/:id/vote', async (req, res) => {
    const { id } = req.params;
    const { type } = req.body;
    
    if (type === 'like') {
        await pool.query('UPDATE news SET likes = likes + 1 WHERE id = $1', [id]);
    } else if (type === 'dislike') {
        await pool.query('UPDATE news SET dislikes = dislikes + 1 WHERE id = $1', [id]);
    }
    res.json({ success: true });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
