const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Путь к файлу с новостями
const NEWS_FILE = path.join(__dirname, 'database.json');

// Загрузка новостей из файла
function loadNewsFromFile() {
    try {
        if (fs.existsSync(NEWS_FILE)) {
            const data = fs.readFileSync(NEWS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Ошибка загрузки:', err);
    }
    return [];
}

// Сохранение новостей в файл
function saveNewsToFile(news) {
    fs.writeFileSync(NEWS_FILE, JSON.stringify(news, null, 2), 'utf8');
}

// Получить все новости
app.get('/api/news', (req, res) => {
    const news = loadNewsFromFile();
    res.json(news);
});

// Добавить новость
app.post('/api/news', (req, res) => {
    const { title, content, tags, media, secret } = req.body;
    
    if (secret !== 'АДМИНКА') {
        return res.status(403).json({ error: 'Неверное секретное слово' });
    }
    
    const news = loadNewsFromFile();
    
    const newNews = {
        id: Date.now(),
        title: title,
        content: content,
        date: new Date().toLocaleDateString('ru-RU'),
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        media: media || [],
        likes: 0,
        dislikes: 0
    };
    
    news.unshift(newNews);
    saveNewsToFile(news);
    
    res.json({ success: true, news: newNews });
});

// Удалить новость
app.delete('/api/news/:id', (req, res) => {
    const { secret } = req.body;
    
    if (secret !== 'АДМИНКА') {
        return res.status(403).json({ error: 'Неверное секретное слово' });
    }
    
    let news = loadNewsFromFile();
    const id = parseInt(req.params.id);
    news = news.filter(n => n.id !== id);
    saveNewsToFile(news);
    
    res.json({ success: true });
});

// Голосование
app.post('/api/news/:id/vote', (req, res) => {
    const { id } = req.params;
    const { type } = req.body;
    
    let news = loadNewsFromFile();
    const index = news.findIndex(n => n.id == id);
    
    if (index !== -1) {
        if (type === 'like') {
            news[index].likes = (news[index].likes || 0) + 1;
        } else if (type === 'dislike') {
            news[index].dislikes = (news[index].dislikes || 0) + 1;
        }
        saveNewsToFile(news);
    }
    
    res.json({ success: true });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
