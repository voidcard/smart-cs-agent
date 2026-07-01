import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { isCorruptedText, resolveSessionTitle, truncateTitle } from './textUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径
const dbPath = path.join(__dirname, '..', 'data', 'chat.db');

// 确保 data 目录存在
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// sql.js 数据库实例
let db: SqlJsDatabase;

// 定期保存数据库到文件
let saveTimer: ReturnType<typeof setInterval> | null = null;

// 初始化数据库
export async function initDatabase(): Promise<void> {
  const wasmPath = path.join(__dirname, 'sql-wasm.wasm');
  const SQL = await initSqlJs({
    locateFile: (file: string) => fs.existsSync(wasmPath) ? wasmPath : path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file)
  });

  // 尝试从文件加载已有数据库
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log('[DB] Loaded existing database from file');
  } else {
    db = new SQL.Database();
    console.log('[DB] Created new database');
  }

  // 初始化数据库表
  db.exec(`
    -- 会话表
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      model TEXT NOT NULL,
      sdk_session_id TEXT,
      user_id TEXT,
      intent TEXT DEFAULT 'general',
      satisfaction_rating INTEGER,
      is_transferred_to_human INTEGER DEFAULT 0,
      resolved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 消息表
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      model TEXT,
      intent TEXT,
      created_at TEXT NOT NULL,
      tool_calls TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    -- 满意度评价表
    CREATE TABLE IF NOT EXISTS satisfaction_ratings (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      email TEXT,
      vip_level INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    -- 订单表
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      product_name TEXT,
      product_sku TEXT,
      quantity INTEGER,
      price REAL,
      status TEXT CHECK (status IN ('pending', 'paid', 'shipping', 'delivered', 'refunding', 'refunded', 'cancelled')),
      tracking_no TEXT,
      tracking_company TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 退款表
    CREATE TABLE IF NOT EXISTS refunds (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      user_id TEXT,
      reason TEXT,
      amount REAL,
      status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 用户记忆表
    CREATE TABLE IF NOT EXISTS user_memory (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      memory_type TEXT CHECK (memory_type IN ('summary', 'preference', 'fact')),
      content TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 为会话 ID 创建索引
    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_intent ON sessions(intent);
    CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_satisfaction_session_id ON satisfaction_ratings(session_id);

    -- 新表索引
    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);
    CREATE INDEX IF NOT EXISTS idx_refunds_user_id ON refunds(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON user_memory(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_memory_type ON user_memory(memory_type);
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
  `);

  // 数据库迁移：sessions 表添加新列
  try {
    const tableInfo = queryAll("PRAGMA table_info(sessions)");
    const existingColumns = tableInfo.map(col => (col as any).name as string);

    const migrations = [
      { column: 'sdk_session_id', sql: "ALTER TABLE sessions ADD COLUMN sdk_session_id TEXT" },
      { column: 'intent', sql: "ALTER TABLE sessions ADD COLUMN intent TEXT DEFAULT 'general'" },
      { column: 'satisfaction_rating', sql: "ALTER TABLE sessions ADD COLUMN satisfaction_rating INTEGER" },
      { column: 'is_transferred_to_human', sql: "ALTER TABLE sessions ADD COLUMN is_transferred_to_human INTEGER DEFAULT 0" },
      { column: 'resolved_at', sql: "ALTER TABLE sessions ADD COLUMN resolved_at TEXT" },
      { column: 'user_id', sql: "ALTER TABLE sessions ADD COLUMN user_id TEXT" },
    ];

    for (const migration of migrations) {
      if (!existingColumns.includes(migration.column)) {
        db.exec(migration.sql);
        console.log(`[DB] Added ${migration.column} column to sessions table`);
      }
    }
  } catch (e) {
    // 忽略错误（列可能已存在）
  }

  // 消息表添加 intent 列
  try {
    const msgTableInfo = queryAll("PRAGMA table_info(messages)");
    const msgColumns = msgTableInfo.map(col => (col as any).name as string);
    if (!msgColumns.includes('intent')) {
      db.exec("ALTER TABLE messages ADD COLUMN intent TEXT");
      console.log("[DB] Added intent column to messages table");
    }
  } catch (e) {
    // 忽略
  }

  // 种子数据
  await seedData();

  // 修复历史乱码会话标题
  repairCorruptedSessions();

  // 定期保存数据库到文件（每 5 秒）
  saveTimer = setInterval(saveDatabase, 5000);

  // 保存一次确保文件创建
  saveDatabase();
}

// 保存数据库到文件
export function saveDatabase(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (e) {
    console.error('[DB] Error saving database:', e);
  }
}

// 关闭数据库
export function closeDatabase(): void {
  if (saveTimer) {
    clearInterval(saveTimer);
    saveTimer = null;
  }
  if (db) {
    saveDatabase(); // 最终保存
    db.close();
    console.log('[DB] Database closed');
  }
}

// 辅助函数：执行查询并返回所有结果
function queryAll(sql: string, params?: any[]): any[] {
  const stmt = db.prepare(sql);
  if (params) {
    stmt.bind(params);
  }
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// 辅助函数：执行查询并返回单条结果
function queryOne(sql: string, params?: any[]): any | undefined {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : undefined;
}

// 辅助函数：执行写操作
function runSql(sql: string, params?: any[]): void {
  db.run(sql, params);
}

// ============= 原有类型定义 =============

export interface DbSession {
  id: string;
  title: string;
  model: string;
  sdk_session_id: string | null;
  intent: string | null;
  satisfaction_rating: number | null;
  is_transferred_to_human: number;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

export interface DbMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string | null;
  intent: string | null;
  created_at: string;
  tool_calls: string | null;
}

export interface DbSatisfactionRating {
  id: string;
  session_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

// ============= 新增类型定义 =============

export interface DbUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  vip_level: number;
  created_at: string;
  updated_at: string;
}

export interface DbOrder {
  id: string;
  user_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  price: number;
  status: 'pending' | 'paid' | 'shipping' | 'delivered' | 'refunding' | 'refunded' | 'cancelled';
  tracking_no: string | null;
  tracking_company: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbRefund {
  id: string;
  order_id: string;
  user_id: string;
  reason: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface DbUserMemory {
  id: string;
  user_id: string;
  memory_type: 'summary' | 'preference' | 'fact';
  content: string;
  created_at: string;
  updated_at: string;
}

// ============= 会话操作 =============

// 获取所有会话
export function getAllSessions(): DbSession[] {
  return queryAll('SELECT * FROM sessions ORDER BY updated_at DESC') as DbSession[];
}

// 获取单个会话
export function getSession(id: string): DbSession | undefined {
  return queryOne('SELECT * FROM sessions WHERE id = ?', [id]) as DbSession | undefined;
}

// 创建会话
export function createSession(session: DbSession): DbSession {
  runSql(`
    INSERT INTO sessions (id, title, model, sdk_session_id, intent, satisfaction_rating, is_transferred_to_human, resolved_at, user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    session.id, session.title, session.model, session.sdk_session_id,
    session.intent || 'general', session.satisfaction_rating, session.is_transferred_to_human || 0,
    session.resolved_at, session.user_id, session.created_at, session.updated_at
  ]);
  return session;
}

// 更新会话
export function updateSession(id: string, updates: Partial<Pick<DbSession, 'title' | 'model' | 'sdk_session_id' | 'intent' | 'satisfaction_rating' | 'is_transferred_to_human' | 'resolved_at' | 'user_id'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.model !== undefined) { fields.push('model = ?'); values.push(updates.model); }
  if (updates.sdk_session_id !== undefined) { fields.push('sdk_session_id = ?'); values.push(updates.sdk_session_id); }
  if (updates.intent !== undefined) { fields.push('intent = ?'); values.push(updates.intent); }
  if (updates.satisfaction_rating !== undefined) { fields.push('satisfaction_rating = ?'); values.push(updates.satisfaction_rating); }
  if (updates.is_transferred_to_human !== undefined) { fields.push('is_transferred_to_human = ?'); values.push(updates.is_transferred_to_human); }
  if (updates.resolved_at !== undefined) { fields.push('resolved_at = ?'); values.push(updates.resolved_at); }
  if (updates.user_id !== undefined) { fields.push('user_id = ?'); values.push(updates.user_id); }

  if (fields.length === 0) return false;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  runSql(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`, values);
  return true;
}

// 删除会话
export function deleteSession(id: string): boolean {
  runSql('DELETE FROM sessions WHERE id = ?', [id]);
  return true;
}

/** 修复因历史编码问题损坏的会话标题 */
export function repairCorruptedSessions(): number {
  const sessions = getAllSessions();
  let fixed = 0;

  for (const session of sessions) {
    if (!isCorruptedText(session.title)) continue;

    const messages = getMessagesBySession(session.id);
    const firstUser = messages.find(m => m.role === 'user');
    const newTitle = resolveSessionTitle(
      session.title,
      session.intent,
      session.created_at,
      firstUser?.content
    );

    if (newTitle !== session.title) {
      updateSession(session.id, { title: newTitle });
      fixed++;
    }
  }

  if (fixed > 0) {
    saveDatabase();
    console.log(`[DB] Repaired ${fixed} corrupted session title(s)`);
  }

  return fixed;
}

/** 获取用于 UI 展示的会话标题 */
export function getSessionDisplayTitle(session: DbSession): string {
  if (!isCorruptedText(session.title)) {
    return session.title;
  }
  const messages = getMessagesBySession(session.id);
  const firstUser = messages.find(m => m.role === 'user');
  return resolveSessionTitle(
    session.title,
    session.intent,
    session.created_at,
    firstUser?.content
  );
}

// 获取用户的所有会话
export function getSessionsByUserId(userId: string): DbSession[] {
  return queryAll('SELECT * FROM sessions WHERE user_id = ? ORDER BY updated_at DESC', [userId]) as DbSession[];
}

// ============= 消息操作 =============

// 获取会话的所有消息
export function getMessagesBySession(sessionId: string): DbMessage[] {
  return queryAll('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC', [sessionId]) as DbMessage[];
}

// 创建消息
export function createMessage(message: DbMessage): DbMessage {
  runSql(`
    INSERT INTO messages (id, session_id, role, content, model, intent, created_at, tool_calls)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    message.id, message.session_id, message.role, message.content,
    message.model, message.intent, message.created_at, message.tool_calls
  ]);

  // 更新会话的 updated_at
  runSql('UPDATE sessions SET updated_at = ? WHERE id = ?', [new Date().toISOString(), message.session_id]);

  return message;
}

// 更新消息内容
export function updateMessage(id: string, updates: Partial<Pick<DbMessage, 'content' | 'tool_calls' | 'intent'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
  if (updates.tool_calls !== undefined) { fields.push('tool_calls = ?'); values.push(updates.tool_calls); }
  if (updates.intent !== undefined) { fields.push('intent = ?'); values.push(updates.intent); }

  if (fields.length === 0) return false;

  values.push(id);

  runSql(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`, values);
  return true;
}

// 删除消息
export function deleteMessage(id: string): boolean {
  runSql('DELETE FROM messages WHERE id = ?', [id]);
  return true;
}

// 批量创建消息
export function createMessages(messages: DbMessage[]): void {
  for (const msg of messages) {
    runSql(`
      INSERT INTO messages (id, session_id, role, content, model, intent, created_at, tool_calls)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      msg.id, msg.session_id, msg.role, msg.content, msg.model, msg.intent, msg.created_at, msg.tool_calls
    ]);
  }
}

// ============= 满意度评价操作 =============

// 创建满意度评价
export function createSatisfactionRating(rating: DbSatisfactionRating): DbSatisfactionRating {
  runSql(`
    INSERT INTO satisfaction_ratings (id, session_id, rating, comment, created_at)
    VALUES (?, ?, ?, ?, ?)
  `, [rating.id, rating.session_id, rating.rating, rating.comment, rating.created_at]);

  // 同时更新会话表的满意度
  runSql('UPDATE sessions SET satisfaction_rating = ? WHERE id = ?', [rating.rating, rating.session_id]);

  return rating;
}

// 获取会话的满意度评价
export function getSatisfactionBySession(sessionId: string): DbSatisfactionRating | undefined {
  return queryOne('SELECT * FROM satisfaction_ratings WHERE session_id = ? ORDER BY created_at DESC LIMIT 1', [sessionId]) as DbSatisfactionRating | undefined;
}

// 获取所有满意度评价
export function getAllSatisfactionRatings(): DbSatisfactionRating[] {
  return queryAll('SELECT * FROM satisfaction_ratings ORDER BY created_at DESC') as DbSatisfactionRating[];
}

// ============= 管理后台统计 =============

// 获取意图分布统计
export function getIntentStats(): Record<string, number> {
  const rows = queryAll('SELECT intent, COUNT(*) as count FROM sessions GROUP BY intent');
  const result: Record<string, number> = { refund: 0, order_query: 0, tech_support: 0, general: 0 };
  for (const row of rows) {
    result[(row as any).intent || 'general'] = (row as any).count;
  }
  return result;
}

// 获取满意度统计
export function getSatisfactionStats(): { avgRating: number; totalRatings: number; distribution: Record<number, number> } {
  const ratings = getAllSatisfactionRatings();
  if (ratings.length === 0) {
    return { avgRating: 0, totalRatings: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  }
  const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratings.forEach(r => { distribution[r.rating] = (distribution[r.rating] || 0) + 1; });
  return { avgRating: Math.round((sum / ratings.length) * 10) / 10, totalRatings: ratings.length, distribution };
}

// 获取转人工统计
export function getTransferStats(): { total: number; transferred: number; rate: number } {
  const totalRow = queryOne('SELECT COUNT(*) as count FROM sessions') as any;
  const transferredRow = queryOne('SELECT COUNT(*) as count FROM sessions WHERE is_transferred_to_human = 1') as any;
  const total = totalRow?.count || 0;
  const transferred = transferredRow?.count || 0;
  return { total, transferred, rate: total > 0 ? Math.round((transferred / total) * 1000) / 10 : 0 };
}

// 获取最近7天的每日统计
export function getDailyStats(days: number = 7): Array<{ date: string; sessions: number; avgSatisfaction: number; transfers: number }> {
  const result: Array<{ date: string; sessions: number; avgSatisfaction: number; transfers: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split('T')[0];

    const sessionsRow = queryOne(
      'SELECT COUNT(*) as count FROM sessions WHERE created_at >= ? AND created_at < ?',
      [dateStr, nextDateStr]
    ) as any;

    const avgRow = queryOne(
      'SELECT AVG(satisfaction_rating) as avg FROM sessions WHERE created_at >= ? AND created_at < ? AND satisfaction_rating IS NOT NULL',
      [dateStr, nextDateStr]
    ) as any;

    const transfersRow = queryOne(
      'SELECT COUNT(*) as count FROM sessions WHERE created_at >= ? AND created_at < ? AND is_transferred_to_human = 1',
      [dateStr, nextDateStr]
    ) as any;

    result.push({
      date: dateStr,
      sessions: sessionsRow?.count || 0,
      avgSatisfaction: avgRow?.avg ? Math.round(avgRow.avg * 10) / 10 : 0,
      transfers: transfersRow?.count || 0,
    });
  }

  return result;
}

// 清空所有数据
export function clearAllData(): void {
  db.exec('DELETE FROM user_memory');
  db.exec('DELETE FROM refunds');
  db.exec('DELETE FROM orders');
  db.exec('DELETE FROM satisfaction_ratings');
  db.exec('DELETE FROM messages');
  db.exec('DELETE FROM sessions');
  db.exec('DELETE FROM users');
  saveDatabase();
}

// ============= 用户操作 =============

export function getUserById(id: string): DbUser | undefined {
  return queryOne('SELECT * FROM users WHERE id = ?', [id]) as DbUser | undefined;
}

export function getUserByPhone(phone: string): DbUser | undefined {
  return queryOne('SELECT * FROM users WHERE phone = ?', [phone]) as DbUser | undefined;
}

export function createUser(user: Omit<DbUser, 'id' | 'created_at' | 'updated_at'>): DbUser {
  const id = uuidv4();
  const now = new Date().toISOString();
  const fullUser: DbUser = {
    id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    vip_level: user.vip_level ?? 0,
    created_at: now,
    updated_at: now,
  };
  runSql(`
    INSERT INTO users (id, name, phone, email, vip_level, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [fullUser.id, fullUser.name, fullUser.phone, fullUser.email, fullUser.vip_level, fullUser.created_at, fullUser.updated_at]);
  return fullUser;
}

export function updateUser(id: string, updates: Partial<Pick<DbUser, 'name' | 'phone' | 'email' | 'vip_level'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.phone !== undefined) { fields.push('phone = ?'); values.push(updates.phone); }
  if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
  if (updates.vip_level !== undefined) { fields.push('vip_level = ?'); values.push(updates.vip_level); }

  if (fields.length === 0) return false;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  runSql(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  return true;
}

// ============= 订单操作 =============

export function getOrdersByUserId(userId: string): DbOrder[] {
  return queryAll('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [userId]) as DbOrder[];
}

export function getOrderById(id: string): DbOrder | undefined {
  return queryOne('SELECT * FROM orders WHERE id = ?', [id]) as DbOrder | undefined;
}

export function createOrder(order: Omit<DbOrder, 'id' | 'created_at' | 'updated_at'>): DbOrder {
  const id = 'ORD-' + Date.now();
  const now = new Date().toISOString();
  const fullOrder: DbOrder = {
    id,
    user_id: order.user_id,
    product_name: order.product_name,
    product_sku: order.product_sku,
    quantity: order.quantity,
    price: order.price,
    status: order.status,
    tracking_no: order.tracking_no ?? null,
    tracking_company: order.tracking_company ?? null,
    created_at: now,
    updated_at: now,
  };
  runSql(`
    INSERT INTO orders (id, user_id, product_name, product_sku, quantity, price, status, tracking_no, tracking_company, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [fullOrder.id, fullOrder.user_id, fullOrder.product_name, fullOrder.product_sku, fullOrder.quantity, fullOrder.price, fullOrder.status, fullOrder.tracking_no, fullOrder.tracking_company, fullOrder.created_at, fullOrder.updated_at]);
  return fullOrder;
}

export function updateOrderStatus(id: string, status: DbOrder['status'], trackingNo?: string, trackingCompany?: string): boolean {
  const fields: string[] = ['status = ?', 'updated_at = ?'];
  const values: any[] = [status, new Date().toISOString()];

  if (trackingNo !== undefined) { fields.push('tracking_no = ?'); values.push(trackingNo); }
  if (trackingCompany !== undefined) { fields.push('tracking_company = ?'); values.push(trackingCompany); }

  values.push(id);
  runSql(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, values);
  return true;
}

// ============= 退款操作 =============

export function getRefundsByUserId(userId: string): DbRefund[] {
  return queryAll('SELECT * FROM refunds WHERE user_id = ? ORDER BY created_at DESC', [userId]) as DbRefund[];
}

export function getRefundByOrderId(orderId: string): DbRefund | undefined {
  return queryOne('SELECT * FROM refunds WHERE order_id = ?', [orderId]) as DbRefund | undefined;
}

export function createRefund(refund: Omit<DbRefund, 'id' | 'created_at' | 'updated_at'>): DbRefund {
  const id = 'REF-' + Date.now();
  const now = new Date().toISOString();
  const fullRefund: DbRefund = {
    id,
    order_id: refund.order_id,
    user_id: refund.user_id,
    reason: refund.reason,
    amount: refund.amount,
    status: refund.status,
    created_at: now,
    updated_at: now,
  };
  runSql(`
    INSERT INTO refunds (id, order_id, user_id, reason, amount, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [fullRefund.id, fullRefund.order_id, fullRefund.user_id, fullRefund.reason, fullRefund.amount, fullRefund.status, fullRefund.created_at, fullRefund.updated_at]);
  return fullRefund;
}

export function updateRefundStatus(id: string, status: DbRefund['status']): boolean {
  runSql('UPDATE refunds SET status = ?, updated_at = ? WHERE id = ?', [status, new Date().toISOString(), id]);
  return true;
}

// ============= 用户记忆操作 =============

export function getMemoriesByUserId(userId: string, memoryType?: DbUserMemory['memory_type']): DbUserMemory[] {
  if (memoryType) {
    return queryAll('SELECT * FROM user_memory WHERE user_id = ? AND memory_type = ? ORDER BY created_at DESC', [userId, memoryType]) as DbUserMemory[];
  }
  return queryAll('SELECT * FROM user_memory WHERE user_id = ? ORDER BY created_at DESC', [userId]) as DbUserMemory[];
}

export function addMemory(memory: Omit<DbUserMemory, 'id' | 'created_at' | 'updated_at'>): DbUserMemory {
  const id = uuidv4();
  const now = new Date().toISOString();
  const fullMemory: DbUserMemory = {
    id,
    user_id: memory.user_id,
    memory_type: memory.memory_type,
    content: memory.content,
    created_at: now,
    updated_at: now,
  };
  runSql(`
    INSERT INTO user_memory (id, user_id, memory_type, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [fullMemory.id, fullMemory.user_id, fullMemory.memory_type, fullMemory.content, fullMemory.created_at, fullMemory.updated_at]);
  return fullMemory;
}

export function updateMemory(id: string, updates: Partial<Pick<DbUserMemory, 'content' | 'memory_type'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
  if (updates.memory_type !== undefined) { fields.push('memory_type = ?'); values.push(updates.memory_type); }

  if (fields.length === 0) return false;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  runSql(`UPDATE user_memory SET ${fields.join(', ')} WHERE id = ?`, values);
  return true;
}

export function getRecentMemorySummary(userId: string, limit: number = 5): DbUserMemory[] {
  return queryAll(
    'SELECT * FROM user_memory WHERE user_id = ? AND memory_type = \'summary\' ORDER BY updated_at DESC LIMIT ?',
    [userId, limit]
  ) as DbUserMemory[];
}

// ============= 种子数据 =============

function seedData(): void {
  // 只在 users 表为空时插入种子数据
  const existingUsers = queryAll('SELECT COUNT(*) as count FROM users');
  if ((existingUsers[0] as any).count > 0) {
    console.log('[DB] Seed data skipped (users table not empty)');
    return;
  }

  const now = new Date().toISOString();

  // 创建测试用户：舒珺琦
  const userId = uuidv4();
  runSql(`
    INSERT INTO users (id, name, phone, email, vip_level, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [userId, '舒珺琦', '13800138001', 'shujunqi@test.com', 2, now, now]);
  console.log(`[DB] Seed user created: ${userId}`);

  // 创建订单
  const ordersData: Array<{ product_name: string; product_sku: string; quantity: number; price: number; status: string; tracking_no: string | null; tracking_company: string | null; orderSuffix: string }> = [
    { product_name: '智能手表 Pro', product_sku: 'SKU-SW001', quantity: 1, price: 2999, status: 'delivered', tracking_no: 'SF1234567890', tracking_company: '顺丰速运', orderSuffix: '20260601' },
    { product_name: '无线耳机 AirPods', product_sku: 'SKU-EP001', quantity: 1, price: 1599, status: 'shipping', tracking_no: 'YT9876543210', tracking_company: '圆通速递', orderSuffix: '20260605' },
    { product_name: '运动鞋 Nike Air Max', product_sku: 'SKU-SH001', quantity: 2, price: 899, status: 'paid', tracking_no: null, tracking_company: null, orderSuffix: '20260610' },
    { product_name: '手机壳 保护套', product_sku: 'SKU-CA001', quantity: 3, price: 29, status: 'refunding', tracking_no: null, tracking_company: null, orderSuffix: '20260612' },
    { product_name: '蓝牙音箱', product_sku: 'SKU-SP001', quantity: 1, price: 499, status: 'pending', tracking_no: null, tracking_company: null, orderSuffix: '20260615' },
    { product_name: '平板电脑 iPad Mini', product_sku: 'SKU-TB001', quantity: 1, price: 3299, status: 'cancelled', tracking_no: null, tracking_company: null, orderSuffix: '20260617' },
  ];

  const createdOrders: Record<string, string> = {};

  for (const orderInfo of ordersData) {
    const orderId = 'ORD-' + orderInfo.orderSuffix;
    runSql(`
      INSERT INTO orders (id, user_id, product_name, product_sku, quantity, price, status, tracking_no, tracking_company, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [orderId, userId, orderInfo.product_name, orderInfo.product_sku, orderInfo.quantity, orderInfo.price, orderInfo.status, orderInfo.tracking_no, orderInfo.tracking_company, now, now]);
    createdOrders[orderInfo.orderSuffix] = orderId;
    console.log(`[DB] Seed order created: ${orderId} - ${orderInfo.product_name}`);
  }

  // 为正在退款的订单(#20260612)创建退款记录
  const refundOrderId1 = createdOrders['20260612'];
  const refundId1 = 'REF-' + Date.now();
  runSql(`
    INSERT INTO refunds (id, order_id, user_id, reason, amount, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [refundId1, refundOrderId1, userId, '商品与描述不符', 87, 'pending', now, now]);
  console.log(`[DB] Seed refund created: ${refundId1} for order ${refundOrderId1}`);

  // 为已送达的订单(#20260601)创建退款记录（质量问题）
  const refundOrderId2 = createdOrders['20260601'];
  const refundId2 = 'REF-' + (Date.now() + 1);
  runSql(`
    INSERT INTO refunds (id, order_id, user_id, reason, amount, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [refundId2, refundOrderId2, userId, '质量问题，手表屏幕有划痕', 2999, 'approved', now, now]);
  console.log(`[DB] Seed refund created: ${refundId2} for order ${refundOrderId2}`);

  console.log('[DB] Seed data inserted successfully');
  saveDatabase();
}

export default db;
