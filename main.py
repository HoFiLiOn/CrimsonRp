from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import json
from datetime import datetime
import hashlib
import os

app = Flask(__name__, static_folder='.')
CORS(app)

DB_PATH = 'crimson.db'

# ========== ИНИЦИАЛИЗАЦИЯ БД ==========
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Таблица новостей
    c.execute('''CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        date TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        media TEXT DEFAULT '[]',
        likes INTEGER DEFAULT 0,
        dislikes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Таблица голосов пользователей
    c.execute('''CREATE TABLE IF NOT EXISTS user_votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        news_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        vote_type TEXT NOT NULL,
        UNIQUE(news_id, user_id)
    )''')
    
    # Таблица подписок на теги
    c.execute('''CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        UNIQUE(user_id, tag)
    )''')
    
    # Таблица избранного
    c.execute('''CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        news_id INTEGER NOT NULL,
        UNIQUE(user_id, news_id)
    )''')
    
    # Добавляем тестовую новость если нет новостей
    c.execute('SELECT COUNT(*) FROM news')
    if c.fetchone()[0] == 0:
        test_image = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23e31b23'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='white' font-size='20'%3ECRIMSON%3C/text%3E%3C/svg%3E"
        c.execute('INSERT INTO news (title, content, date, tags, media, likes) VALUES (?, ?, ?, ?, ?, ?)',
                  ('🔴 CRIMSON RP ОТКРЫТ', 'Добро пожаловать на проект! Сервер официально запущен.', 
                   datetime.now().strftime('%Y-%m-%d'), '["Открытие", "Важное"]', json.dumps([test_image]), 15))
    
    conn.commit()
    conn.close()

init_db()

def get_user_id(request):
    user_id = request.headers.get('X-User-Id')
    if not user_id:
        ip = request.remote_addr
        ua = request.headers.get('User-Agent', '')
        user_id = hashlib.md5(f"{ip}{ua}".encode()).hexdigest()[:16]
    return user_id

# ========== API ==========
@app.route('/api/news', methods=['GET'])
def get_news():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM news ORDER BY likes DESC, id DESC')
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])

@app.route('/api/news', methods=['POST'])
def add_news():
    data = request.json
    if data.get('secret') != 'АДМИНКА':
        return jsonify({'error': 'Unauthorized'}), 403
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('INSERT INTO news (title, content, date, tags, media) VALUES (?, ?, ?, ?, ?)',
              (data['title'], data['content'], datetime.now().strftime('%Y-%m-%d'), 
               json.dumps(data.get('tags', [])), json.dumps(data.get('media', []))))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/news/<int:id>', methods=['DELETE'])
def delete_news(id):
    if request.json.get('secret') != 'АДМИНКА':
        return jsonify({'error': 'Unauthorized'}), 403
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('DELETE FROM news WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/news/<int:id>/vote', methods=['POST'])
def vote_news(id):
    user_id = get_user_id(request)
    vote_type = request.json.get('type')
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT * FROM user_votes WHERE news_id = ? AND user_id = ?', (id, user_id))
    if c.fetchone():
        conn.close()
        return jsonify({'error': 'Already voted'}), 403
    c.execute('INSERT INTO user_votes (news_id, user_id, vote_type) VALUES (?, ?, ?)', (id, user_id, vote_type))
    if vote_type == 'like':
        c.execute('UPDATE news SET likes = likes + 1 WHERE id = ?', (id,))
    else:
        c.execute('UPDATE news SET dislikes = dislikes + 1 WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/user/vote/<int:id>', methods=['GET'])
def get_user_vote(id):
    user_id = get_user_id(request)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT vote_type FROM user_votes WHERE news_id = ? AND user_id = ?', (id, user_id))
    row = c.fetchone()
    conn.close()
    return jsonify({'hasVoted': row is not None, 'voteType': row[0] if row else None})

@app.route('/api/user/favorites', methods=['GET', 'POST', 'DELETE'])
def handle_favorites():
    user_id = get_user_id(request)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    if request.method == 'GET':
        c.execute('SELECT news_id FROM favorites WHERE user_id = ?', (user_id,))
        return jsonify([row[0] for row in c.fetchall()])
    elif request.method == 'POST':
        news_id = request.json.get('news_id')
        c.execute('INSERT OR IGNORE INTO favorites (user_id, news_id) VALUES (?, ?)', (user_id, news_id))
        conn.commit()
        return jsonify({'success': True})
    else:
        news_id = request.json.get('news_id')
        c.execute('DELETE FROM favorites WHERE user_id = ? AND news_id = ?', (user_id, news_id))
        conn.commit()
        return jsonify({'success': True})

@app.route('/api/user/subscriptions', methods=['GET', 'POST', 'DELETE'])
def handle_subscriptions():
    user_id = get_user_id(request)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    if request.method == 'GET':
        c.execute('SELECT tag FROM subscriptions WHERE user_id = ?', (user_id,))
        return jsonify([row[0] for row in c.fetchall()])
    elif request.method == 'POST':
        tag = request.json.get('tag')
        c.execute('INSERT OR IGNORE INTO subscriptions (user_id, tag) VALUES (?, ?)', (user_id, tag))
        conn.commit()
        return jsonify({'success': True})
    else:
        tag = request.json.get('tag')
        c.execute('DELETE FROM subscriptions WHERE user_id = ? AND tag = ?', (user_id, tag))
        conn.commit()
        return jsonify({'success': True})

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)