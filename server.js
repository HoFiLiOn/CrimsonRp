const express = require('express');
const path = require('path');
const cors = require('cors');
const pool = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Получить все новости
app.get('/api/news', async (req, res) => {
    const result = await pool.query('SELECT * FROM news ORDER BY id DESC');
    res.json(result.rows);
});

// Добавить новость (админ)
app.post('/api/news', async (req, res) => {
    const { title, content, password } = req.body;
    if (password !== 'crimson123') {
        return res.status(403).json({ error: 'Неверный пароль' });
    }
    const date = new Date().toLocaleDateString('ru-RU');
    await pool.query('INSERT INTO news (title, content, date) VALUES ($1, $2, $3)', [title, content, date]);
    res.json({ success: true });
});

// Удалить новость
app.delete('/api/news/:id', async (req, res) => {
    const { password } = req.body;
    if (password !== 'crimson123') {
        return res.status(403).json({ error: 'Неверный пароль' });
    }
    await pool.query('DELETE FROM news WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
