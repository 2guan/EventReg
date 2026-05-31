import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../sportsreg.db');

// Native node:sqlite wrapper to mimic better-sqlite3
console.log('Using Native Node SQLite at:', dbPath);
const database = new DatabaseSync(dbPath);

const db = {
  exec: (sql) => database.exec(sql),
  pragma: (sql) => database.exec(`PRAGMA ${sql}`),
  prepare: (sql) => {
    const stmt = database.prepare(sql);
    const normalizeArgs = (args) => {
      if (args.length === 1 && Array.isArray(args[0])) {
        return args[0];
      }
      return args;
    };
    return {
      run: (...args) => stmt.run(...normalizeArgs(args)),
      get: (...args) => stmt.get(...normalizeArgs(args)),
      all: (...args) => stmt.all(...normalizeArgs(args))
    };
  },
  transaction: (fn) => {
    return (...args) => {
      database.exec('BEGIN IMMEDIATE');
      try {
        const result = fn(...args);
        database.exec('COMMIT');
        return result;
      } catch (err) {
        database.exec('ROLLBACK');
        throw err;
      }
    };
  }
};

// Enable WAL mode
db.exec('PRAGMA journal_mode = WAL');

function initDB() {
  console.log('Initializing database at', dbPath);

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nickname TEXT NOT NULL,
      avatar TEXT,
      role TEXT CHECK(role IN ('pending', 'user', 'admin')) DEFAULT 'pending',
      open_id TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Matches table
  db.exec(`
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      time DATETIME NOT NULL,
      location TEXT NOT NULL,
      max_players INTEGER NOT NULL,
      max_waitlist INTEGER DEFAULT 0,
      duration INTEGER DEFAULT 90, -- in minutes
      status INTEGER DEFAULT 0, -- 0:preview, 1:open, 2:waitlist(auto), 3:full, 4:ended_pending, 5:ended_settled, 6:cancelled
      config_json TEXT, -- detailed config
      proxy_limit INTEGER DEFAULT 2, -- max proxy registrations per user
      visibility TEXT CHECK(visibility IN ('public', 'user_hidden', 'fully_hidden')) DEFAULT 'public',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Enrollments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      type TEXT CHECK(type IN ('player', 'candidate')) DEFAULT 'player',
      status TEXT CHECK(status IN ('active', 'cancelled')) DEFAULT 'active',
      enrolled_for_name TEXT, -- if helping others
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Migration: Add score column if not exists
  try {
    const check = db.prepare('SELECT score FROM enrollments LIMIT 1');
    check.get();
  } catch (err) {
    if (err.message.includes('no such column')) {
      console.log('Migrating: Adding score column to enrollments');
      db.exec('ALTER TABLE enrollments ADD COLUMN score REAL');
    }
  }
  
  // Migration: Add proxy_limit column if not exists
  try {
    const check = db.prepare('SELECT proxy_limit FROM matches LIMIT 1');
    check.get();
  } catch (err) {
    if (err.message.includes('no such column')) {
      console.log('Migrating: Adding proxy_limit column to matches');
      db.exec('ALTER TABLE matches ADD COLUMN proxy_limit INTEGER DEFAULT 2');
    }
  }

  // Migration: Add visibility column if not exists
  try {
    const check = db.prepare('SELECT visibility FROM matches LIMIT 1');
    check.get();
  } catch (err) {
    if (err.message.includes('no such column')) {
      console.log('Migrating: Adding visibility column to matches');
      db.exec("ALTER TABLE matches ADD COLUMN visibility TEXT CHECK(visibility IN ('public', 'user_hidden', 'fully_hidden')) DEFAULT 'public'");
    }
  }



  // Enrollment Logs table - 记录每次报名/取消报名操作
  db.exec(`
    CREATE TABLE IF NOT EXISTS enrollment_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      enrolled_for_name TEXT,
      operation TEXT CHECK(operation IN ('join', 'cancel')) NOT NULL,
      enroll_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(match_id) REFERENCES matches(id)
    )
  `);

  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings(
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
    `);

  // Seed default settings
  const settingsStmt = db.prepare('SELECT count(*) as count FROM settings WHERE key = ?');
  const hasRoleSetting = settingsStmt.get('default_role');
  if (hasRoleSetting.count === 0) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('default_role', 'pending');
  }

  // Points table
  db.exec(`
    CREATE TABLE IF NOT EXISTS points(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      match_id INTEGER,
      amount INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
    `);

  // Notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // WeChat Subscriptions table (记录用户授权的订阅消息次数)
  db.exec(`
    CREATE TABLE IF NOT EXISTS wx_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      template_id TEXT NOT NULL,
      count INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      UNIQUE(user_id, template_id)
    )
  `);

  // 迁移：如果旧表没有 count 字段，添加它
  try {
    db.exec(`ALTER TABLE wx_subscriptions ADD COLUMN count INTEGER DEFAULT 1`);
    console.log('[DB] Added count column to wx_subscriptions');
  } catch (e) {
    // 字段已存在，忽略错误
  }
  try {
    db.exec(`ALTER TABLE wx_subscriptions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
    console.log('[DB] Added updated_at column to wx_subscriptions');
  } catch (e) {
    // 字段已存在，忽略错误
  }

  // 迁移：如果notifications表没有 is_read 字段，添加它
  try {
    db.exec(`ALTER TABLE notifications ADD COLUMN is_read INTEGER DEFAULT 0`);
    console.log('[DB] Added is_read column to notifications');
  } catch (e) {
    // 字段已存在，忽略错误
  }

  // Admin Reminders table - 管理员订阅报名/退报提醒
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      reminder_type TEXT CHECK(reminder_type IN ('join', 'cancel')) NOT NULL,
      count INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      UNIQUE(user_id, reminder_type)
    )
  `);


  // Seed default admin if no users exist
  const stmt = db.prepare('SELECT count(*) as count FROM users');
  const result = stmt.get();
  if (result.count === 0) {
    console.log('Seeding default admin user...');
    const hash = bcrypt.hashSync('admin123', 10);
    const insert = db.prepare('INSERT INTO users (username, password, nickname, role, avatar) VALUES (?, ?, ?, ?, ?)');
    insert.run('admin', hash, 'Administrator', 'admin', '/sportsreg/face/defaultface-admin.jpg');
    console.log('Default admin created: admin / admin123');
  }

  // Seed default notification setting
  const notifSettingStmt = db.prepare("SELECT count(*) as count FROM settings WHERE key = 'notification_enabled'");
  const hasNotifSetting = notifSettingStmt.get();
  if (hasNotifSetting.count === 0) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('notification_enabled', 'true');
  }

  // Seed default WeChat push setting (默认关闭)
  const wxPushSettingStmt = db.prepare("SELECT count(*) as count FROM settings WHERE key = 'wx_push_enabled'");
  const hasWxPushSetting = wxPushSettingStmt.get();
  if (hasWxPushSetting.count === 0) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('wx_push_enabled', 'false');
  }
}

export { db, initDB };
