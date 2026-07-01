import "dotenv/config";
import express from "express";
import { query, unstable_v2_createSession, unstable_v2_authenticate, PermissionResult, CanUseTool } from "@tencent-ai/agent-sdk";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import * as db from "./db.js";
import { searchFAQ, detectIntent, shouldTransferToHuman, FAQ_DATABASE, IntentType } from "./faq.js";
import { assertValidUtf8Text } from "./textUtils.js";

console.log('[FAQ] 知识库已加载，共', FAQ_DATABASE.length, '条');

const execAsync = promisify(exec);

// 待处理的权限请求
interface PendingPermission {
  resolve: (result: PermissionResult) => void;
  reject: (error: Error) => void;
  toolName: string;
  input: Record<string, unknown>;
  sessionId: string;
  timestamp: number;
}

const pendingPermissions = new Map<string, PendingPermission>();

// 权限请求超时时间（5分钟）
const PERMISSION_TIMEOUT = 5 * 60 * 1000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use((_req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return json(body);
  };
  next();
});

function setupSSE(res: express.Response) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}

// 缓存可用模型列表
let cachedModels: Array<{ modelId: string; name: string; description?: string }> = [];
const defaultModel = "claude-sonnet-4";

// 健康检查
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============= 认证 API =============

type LoginMethod = 'env' | 'cli' | 'none';

interface LoginStatusResponse {
  isLoggedIn: boolean;
  method?: LoginMethod;
  envConfigured?: boolean;
  cliConfigured?: boolean;
  error?: string;
  apiKey?: string;
  envVars?: {
    apiKey?: string;
    authToken?: string;
    internetEnv?: string;
    baseUrl?: string;
  };
}

app.get("/api/check-login", async (req, res) => {
  const response: LoginStatusResponse = {
    isLoggedIn: false,
    envConfigured: false,
    cliConfigured: false,
    envVars: {},
  };
  
  const apiKey = process.env.CODEBUDDY_API_KEY;
  const authToken = process.env.CODEBUDDY_AUTH_TOKEN;
  const internetEnv = process.env.CODEBUDDY_INTERNET_ENVIRONMENT;
  const baseUrl = process.env.CODEBUDDY_BASE_URL;
  
  if (apiKey || authToken) {
    response.envConfigured = true;
    if (apiKey) {
      response.envVars!.apiKey = apiKey.slice(0, 8) + '****' + apiKey.slice(-4);
      response.apiKey = response.envVars!.apiKey;
    }
    if (authToken) {
      response.envVars!.authToken = authToken.slice(0, 8) + '****' + authToken.slice(-4);
    }
    if (internetEnv) { response.envVars!.internetEnv = internetEnv; }
    if (baseUrl) { response.envVars!.baseUrl = baseUrl; }
  }
  
  try {
    let needsLogin = false;
    const result = await unstable_v2_authenticate({
      environment: 'external',
      onAuthUrl: async (authState) => {
        needsLogin = true;
        response.error = '未登录，请先登录 CodeBuddy CLI';
      }
    });
    
    if (!needsLogin && result?.userinfo) {
      response.isLoggedIn = true;
      response.cliConfigured = true;
      response.method = response.envConfigured ? 'env' : 'cli';
    } else if (!needsLogin) {
      response.isLoggedIn = true;
      response.cliConfigured = true;
      response.method = response.envConfigured ? 'env' : 'cli';
    }
  } catch (error: any) {
    if (response.envConfigured) {
      response.isLoggedIn = true;
      response.method = 'env';
    } else {
      response.error = error?.message || String(error);
      response.method = 'none';
    }
  }
  
  res.json(response);
});

app.post("/api/save-env-config", (req, res) => {
  const { apiKey, authToken, internetEnv, baseUrl } = req.body;
  if (!apiKey && !authToken) {
    return res.status(400).json({ error: '请至少配置 API Key 或 Auth Token' });
  }
  
  const configuredVars: string[] = [];
  if (apiKey) { process.env.CODEBUDDY_API_KEY = apiKey; configuredVars.push('CODEBUDDY_API_KEY'); }
  if (authToken) { process.env.CODEBUDDY_AUTH_TOKEN = authToken; configuredVars.push('CODEBUDDY_AUTH_TOKEN'); }
  if (internetEnv) { process.env.CODEBUDDY_INTERNET_ENVIRONMENT = internetEnv; configuredVars.push('CODEBUDDY_INTERNET_ENVIRONMENT'); }
  if (baseUrl) { process.env.CODEBUDDY_BASE_URL = baseUrl; configuredVars.push('CODEBUDDY_BASE_URL'); }
  
  cachedModels = [];
  res.json({ success: true, message: `已设置: ${configuredVars.join(', ')}` });
});

// ============= 用户认证 API =============

// VIP等级标签映射
const VIP_LABELS: Record<number, string> = {
  0: '普通会员', 1: 'VIP1', 2: 'VIP2', 3: 'VIP3',
};

app.post("/api/auth/register", (req, res) => {
  try {
    const { name, phone, email } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: "姓名和手机号为必填项" });
    }
    const existing = db.getUserByPhone(phone);
    if (existing) {
      return res.status(409).json({ error: "该手机号已注册", userId: existing.id });
    }
    const user = db.createUser({ name, phone, email: email || '', vip_level: 0 });
    res.json({ userId: user.id, name: user.name, phone: user.phone, vipLevel: VIP_LABELS[user.vip_level] || '普通会员' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "注册失败" });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "请提供手机号" });
    }
    const user = db.getUserByPhone(phone);
    if (!user) {
      return res.status(404).json({ error: "用户不存在" });
    }
    res.json({ userId: user.id, name: user.name, phone: user.phone, email: user.email, vipLevel: VIP_LABELS[user.vip_level] || '普通会员' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "登录失败" });
  }
});

app.get("/api/auth/me", (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "请提供 userId" });
    }
    const user = db.getUserById(userId as string);
    if (!user) {
      return res.status(404).json({ error: "用户不存在" });
    }
    res.json({ userId: user.id, name: user.name, phone: user.phone, email: user.email, vipLevel: VIP_LABELS[user.vip_level] || '普通会员' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取用户信息失败" });
  }
});

app.get("/api/auth/user/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    const user = db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "用户不存在" });
    }
    res.json({ userId: user.id, name: user.name, phone: user.phone, email: user.email, vipLevel: VIP_LABELS[user.vip_level] || '普通会员' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取用户信息失败" });
  }
});

// ============= 模型 API =============

app.get("/api/models", async (req, res) => {
  try {
    if (cachedModels.length === 0) {
      const session = await unstable_v2_createSession({ cwd: process.cwd() });
      const models = await session.getAvailableModels();
      if (models && Array.isArray(models)) {
        cachedModels = models;
      }
    }
    res.json({ models: cachedModels.length > 0 ? cachedModels : [{ modelId: "claude-sonnet-4", name: "Claude Sonnet 4" }], defaultModel });
  } catch (error: any) {
    res.json({ models: [{ modelId: "claude-sonnet-4", name: "Claude Sonnet 4" }, { modelId: "claude-opus-4", name: "Claude Opus 4" }], defaultModel, error: error?.message || String(error) });
  }
});

// ============= 会话 API =============

app.get("/api/sessions", (req, res) => {
  try {
    const { userId } = req.query;
    let sessions = userId ? db.getSessionsByUserId(userId as string) : db.getAllSessions();
    const sessionsWithMessages = sessions.map(session => {
      const messages = db.getMessagesBySession(session.id);
      return {
        ...session,
        title: db.getSessionDisplayTitle(session),
        messageCount: messages.length,
      };
    });
    res.json({ sessions: sessionsWithMessages });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

app.get("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = db.getSession(sessionId);
    if (!session) { return res.status(404).json({ error: "会话不存在" }); }
    
    const messages = db.getMessagesBySession(sessionId);
    const satisfaction = db.getSatisfactionBySession(sessionId);
    const parsedMessages = messages.map(msg => ({
      ...msg,
      tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null
    }));
    
    res.json({
      session: { ...session, title: db.getSessionDisplayTitle(session) },
      messages: parsedMessages,
      satisfaction,
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

app.post("/api/sessions", (req, res) => {
  try {
    const { model = defaultModel, title = "新对话", intent = "general", userId } = req.body;
    const now = new Date().toISOString();
    const session = db.createSession({
      id: uuidv4(), title, model, sdk_session_id: null, user_id: userId || null, intent,
      satisfaction_rating: null, is_transferred_to_human: 0, resolved_at: null,
      created_at: now, updated_at: now
    });
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "创建会话失败" });
  }
});

app.patch("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title, model, intent, is_transferred_to_human, satisfaction_rating, resolved_at } = req.body;
    if (title !== undefined) {
      try {
        assertValidUtf8Text(title, '标题');
      } catch (e: any) {
        return res.status(400).json({ error: e?.message || "标题编码无效" });
      }
    }
    const success = db.updateSession(sessionId, { title, model, intent, is_transferred_to_human, satisfaction_rating, resolved_at });
    if (!success) { return res.status(404).json({ error: "会话不存在" }); }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "更新会话失败" });
  }
});

app.delete("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const success = db.deleteSession(sessionId);
    if (!success) { return res.status(404).json({ error: "会话不存在" }); }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "删除会话失败" });
  }
});

// ============= 满意度评价 API =============

app.post("/api/sessions/:sessionId/rate", (req, res) => {
  try {
    const { sessionId } = req.params;
    const { rating, comment } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "评分必须在1-5之间" });
    }
    
    const now = new Date().toISOString();
    const satisfaction = db.createSatisfactionRating({
      id: uuidv4(), session_id: sessionId, rating, comment: comment || null, created_at: now
    });
    
    res.json({ satisfaction });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "提交评价失败" });
  }
});

app.get("/api/sessions/:sessionId/rate", (req, res) => {
  try {
    const { sessionId } = req.params;
    const satisfaction = db.getSatisfactionBySession(sessionId);
    res.json({ satisfaction });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取评价失败" });
  }
});

// ============= 管理后台 API =============

app.get("/api/admin/stats", (req, res) => {
  try {
    const intentStats = db.getIntentStats();
    const satisfactionStats = db.getSatisfactionStats();
    const transferStats = db.getTransferStats();
    const dailyStats = db.getDailyStats(7);
    
    const totalSessions = transferStats.total;
    const resolutionRate = totalSessions > 0 
      ? Math.round(((totalSessions - transferStats.transferred) / totalSessions) * 1000) / 10 
      : 0;
    
    res.json({
      totalSessions,
      avgSatisfaction: satisfactionStats.avgRating,
      intentDistribution: intentStats,
      transferRate: transferStats.rate,
      resolutionRate,
      dailyStats,
      satisfactionDistribution: satisfactionStats.distribution,
      totalRatings: satisfactionStats.totalRatings,
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取统计失败" });
  }
});

app.get("/api/admin/sessions", (req, res) => {
  try {
    const { intent, startDate, endDate, page = '1', pageSize = '20' } = req.query;
    
    let sessions = db.getAllSessions();
    
    // 按意图过滤
    if (intent && intent !== 'all') {
      sessions = sessions.filter(s => s.intent === intent);
    }
    
    // 按日期过滤
    if (startDate) {
      sessions = sessions.filter(s => s.created_at >= (startDate as string));
    }
    if (endDate) {
      sessions = sessions.filter(s => s.created_at <= (endDate as string) + 'T23:59:59');
    }
    
    // 分页
    const total = sessions.length;
    const p = parseInt(page as string);
    const ps = parseInt(pageSize as string);
    const paginatedSessions = sessions.slice((p - 1) * ps, p * ps).map(session => {
      const messages = db.getMessagesBySession(session.id);
      return {
        ...session,
        title: db.getSessionDisplayTitle(session),
        messageCount: messages.length,
      };
    });
    
    res.json({ sessions: paginatedSessions, total, page: p, pageSize: ps });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取会话列表失败" });
  }
});

// ============= FAQ 知识库 API =============

// 获取所有 FAQ 分类
app.get("/api/faq/categories", (_req, res) => {
  const categories = [
    { id: 'refund', name: '退款', icon: '💰', count: FAQ_DATABASE.filter(f => f.category === 'refund').length },
    { id: 'order_query', name: '查询订单', icon: '📦', count: FAQ_DATABASE.filter(f => f.category === 'order_query').length },
    { id: 'tech_support', name: '技术支持', icon: '🔧', count: FAQ_DATABASE.filter(f => f.category === 'tech_support').length },
    { id: 'general', name: '一般咨询', icon: '👤', count: FAQ_DATABASE.filter(f => f.category === 'general').length },
  ];
  res.json({ categories });
});

// 获取所有 FAQ
app.get("/api/faq/list", (req, res) => {
  const { category } = req.query;
  let faqs = FAQ_DATABASE;
  if (category && category !== 'all') {
    faqs = faqs.filter(f => f.category === category);
  }
  res.json({ faqs: faqs.map(({ keywords, ...rest }) => rest) });
});

// 搜索 FAQ
app.post("/api/faq/search", (req, res) => {
  const { message, intent } = req.body;
  if (!message) {
    return res.status(400).json({ error: "请提供搜索内容" });
  }
  const detectedIntent = intent || detectIntent(message);
  const results = searchFAQ(message, detectedIntent as IntentType);
  res.json({ results, detectedIntent });
});

// ============= 业务数据 API =============

// 订单状态标签
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: '待付款', paid: '待发货', shipping: '配送中',
  delivered: '已送达', refunding: '退款中', refunded: '已退款', cancelled: '已取消',
};

// 退款状态标签
const REFUND_STATUS_LABELS: Record<string, string> = {
  pending: '申请中', approved: '已批准', rejected: '已拒绝', completed: '已完成',
};

app.get("/api/orders/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    const orders = db.getOrdersByUserId(userId);
    const ordersWithRefund = orders.map(order => {
      const refund = db.getRefundByOrderId(order.id);
      return {
        ...order,
        statusLabel: ORDER_STATUS_LABELS[order.status] || order.status,
        refund: refund ? { ...refund, statusLabel: REFUND_STATUS_LABELS[refund.status] || refund.status } : null,
      };
    });
    res.json({ orders: ordersWithRefund });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取订单失败" });
  }
});

app.get("/api/orders/:orderId/detail", (req, res) => {
  try {
    const { orderId } = req.params;
    const order = db.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: "订单不存在" });
    }
    const refund = db.getRefundByOrderId(orderId);
    res.json({
      order: { ...order, statusLabel: ORDER_STATUS_LABELS[order.status] || order.status },
      refund: refund ? { ...refund, statusLabel: REFUND_STATUS_LABELS[refund.status] || refund.status } : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取订单详情失败" });
  }
});

app.post("/api/refunds", (req, res) => {
  try {
    const { order_id, user_id, reason } = req.body;
    if (!order_id || !user_id || !reason) {
      return res.status(400).json({ error: "order_id、user_id、reason 为必填项" });
    }
    const order = db.getOrderById(order_id);
    if (!order) {
      return res.status(404).json({ error: "订单不存在" });
    }
    const refund = db.createRefund({
      order_id, user_id, reason, amount: order.price * order.quantity, status: 'pending',
    });
    res.json({ refund: { ...refund, statusLabel: REFUND_STATUS_LABELS[refund.status] || refund.status } });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "创建退款申请失败" });
  }
});

app.get("/api/refunds/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    const refunds = db.getRefundsByUserId(userId);
    res.json({ refunds: refunds.map(r => ({ ...r, statusLabel: REFUND_STATUS_LABELS[r.status] || r.status })) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取退款记录失败" });
  }
});

// ============= 跨会话记忆 API =============

app.get("/api/memory/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    const memories = db.getMemoriesByUserId(userId);
    res.json({ memories });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取记忆失败" });
  }
});

app.post("/api/memory/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    const { content, memory_type } = req.body;
    if (!content) {
      return res.status(400).json({ error: "请提供记忆内容" });
    }
    const memory = db.addMemory({ user_id: userId, content, memory_type: memory_type || 'summary' });
    res.json({ memory });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "添加记忆失败" });
  }
});

// ============= 聊天 API =============

app.post("/api/permission-response", (req, res) => {
  const { requestId, behavior, message } = req.body;
  const pending = pendingPermissions.get(requestId);
  if (!pending) {
    return res.status(404).json({ error: "权限请求不存在或已超时" });
  }
  
  pendingPermissions.delete(requestId);
  
  if (behavior === 'allow') {
    pending.resolve({ behavior: 'allow', updatedInput: pending.input });
  } else {
    pending.resolve({ behavior: 'deny', message: message || '用户拒绝了此操作' });
  }
  res.json({ success: true });
});

// 发送消息并获取流式响应
app.post("/api/chat", async (req, res) => {
  const { sessionId, message, model, systemPrompt, cwd, permissionMode, intent, userId } = req.body;
  
  console.log(`\n[Chat] ========== 新请求 ==========`);
  console.log(`[Chat] SessionId: ${sessionId}, Model: ${model}, Intent: ${intent || 'auto'}`);
  console.log(`[Chat] Message: ${message?.slice(0, 100)}${message?.length > 100 ? '...' : ''}`);

  if (!message) {
    return res.status(400).json({ error: "消息不能为空" });
  }

  try {
    assertValidUtf8Text(message, '消息');
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || "消息编码无效" });
  }

  let session = sessionId ? db.getSession(sessionId) : null;
  const now = new Date().toISOString();
  
  if (!session) {
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: truncateTitle(message),
      model: model || defaultModel,
      sdk_session_id: null,
      user_id: userId || null,
      intent: intent || 'general',
      satisfaction_rating: null,
      is_transferred_to_human: 0,
      resolved_at: null,
      created_at: now,
      updated_at: now
    });
  }

  // 如果有 userId，关联到会话
  if (userId && session) {
    db.updateSession(session.id, { user_id: userId });
  }

  const selectedModel = model || session.model;
  const sdkSessionId = session.sdk_session_id;
  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  // 保存用户消息到数据库
  try {
    db.createMessage({
      id: userMessageId,
      session_id: session.id,
      role: 'user',
      content: message,
      model: null,
      intent: intent || null,
      created_at: now,
      tool_calls: null
    });
  } catch (dbError: any) {
    return res.status(500).json({ error: "保存消息失败", detail: dbError?.message });
  }

  // 检测意图
  const detectedIntent = detectIntent(message);
  console.log(`[Chat] Detected intent: ${detectedIntent}`);

  // ===== 第一步：检测是否需要转人工 =====
  const _existingMessages = session ? db.getMessagesBySession(session.id) : [];
  const _conversationLength = Math.floor(_existingMessages.length / 2);
  const _needTransfer = shouldTransferToHuman(message, _conversationLength);
  console.log(`[Chat] Transfer check: ${_needTransfer}, conversationLength: ${_conversationLength}`);

  if (_needTransfer) {
    // 直接转人工，不查 FAQ 也不调 AI
    console.log(`[Chat] Transfer to human triggered by: ${message}`);
    
    const transferAnswer = `🔴 **已为您转接人工客服**

您好，检测到您需要人工服务。请将您的问题告知人工客服，我们会尽快为您处理。

> 人工客服工作时间：工作日 9:00-21:00
> 非工作时间请留言，客服会在上班后第一时间回复您。`;
    
    db.updateSession(session.id, { is_transferred_to_human: 1, intent: 'general' });
    
    db.createMessage({
      id: assistantMessageId,
      session_id: session.id,
      role: 'assistant',
      content: transferAnswer,
      model: 'system',
      intent: 'general',
      created_at: new Date().toISOString(),
      tool_calls: null
    });

    setupSSE(res);
    
    res.write(`data: ${JSON.stringify({ type: "init", sessionId: session.id, userMessageId, assistantMessageId, model: "system" })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "text", content: transferAnswer })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "transfer_to_human" })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "intent_detected", intent: "general", label: "人工客服" })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "done", source: "transfer" })}\n\n`);
    res.end();
    return;
  }

  // ===== 第二步：业务数据直接查询 =====
  // 如果检测到订单相关意图且有 userId，直接查数据库返回订单列表
  const orderQueryKeywords = ['我的订单', '查询订单', '订单列表', '看订单', '查订单', '订单查询', '所有订单', '全部订单', '我的所有'];
  const isOrderQueryWithUser = userId && detectedIntent === 'order_query' && orderQueryKeywords.some(kw => message.toLowerCase().includes(kw));

  if (isOrderQueryWithUser) {
    console.log(`[Chat] Business data direct query: userId=${userId}, intent=order_query`);
    const user = db.getUserById(userId);
    const orders = db.getOrdersByUserId(userId);

    let orderListText = `您好${user?.name || ''}，以下是您的订单列表：\n\n`;
    for (const order of orders) {
      const refund = db.getRefundByOrderId(order.id);
      const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
      const totalPrice = order.price * order.quantity;
      orderListText += `- 订单#${order.id}（${order.product_name} ×${order.quantity}）¥${totalPrice} - ${statusLabel}`;
      if (order.tracking_no) {
        orderListText += ` | 物流：${order.tracking_company} ${order.tracking_no}`;
      }
      if (refund) {
        orderListText += ` | 退款：${REFUND_STATUS_LABELS[refund.status] || refund.status}`;
      }
      orderListText += '\n';
    }
    orderListText += '\n您可以输入订单号查询详情，或告诉我您想了解哪个订单的信息。';

    db.updateSession(session.id, { intent: 'order_query' });
    db.createMessage({
      id: assistantMessageId,
      session_id: session.id,
      role: 'assistant',
      content: orderListText,
      model: 'business-data',
      intent: 'order_query',
      created_at: new Date().toISOString(),
      tool_calls: null
    });

    // 保存记忆：用户查询了订单列表
    db.addMemory({ user_id: userId, content: `用户查询了订单列表，共${orders.length}个订单`, memory_type: 'fact' });

    setupSSE(res);

    res.write(`data: ${JSON.stringify({ type: "init", sessionId: session.id, userMessageId, assistantMessageId, model: "business-data", userId, userName: user?.name })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "text", content: orderListText })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "intent_detected", intent: "order_query", label: "查询订单" })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "done", source: "business-data" })}\n\n`);
    res.end();
    return;
  }

  // ===== 第三步：查 FAQ 知识库 =====
  const faqResults = searchFAQ(message, detectedIntent);
  if (faqResults.length > 0) {
    const topFaq = faqResults[0];
    console.log(`[Chat] FAQ matched: ${topFaq.question}`);

    const intentLabels: Record<string, string> = {
      refund: '退款', order_query: '查询订单', tech_support: '技术支持', general: '一般咨询'
    };
    const intentLabel = intentLabels[detectedIntent] || '一般咨询';

    let faqAnswer = `【意图：${intentLabel}】\n\n关于"${topFaq.question}"，以下是我的解答：\n\n${topFaq.answer}`;

    // FAQ 增强：如果检测到订单相关意图且有 userId，融入用户实际订单数据
    if (userId && detectedIntent === 'order_query') {
      const user = db.getUserById(userId);
      const orders = db.getOrdersByUserId(userId);
      if (orders.length > 0) {
        let ordersContext = `\n\n---\n**您的订单数据：**\n`;
        for (const order of orders) {
          const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
          ordersContext += `- #${order.id} ${order.product_name} ×${order.quantity} ¥${order.price * order.quantity} ${statusLabel}`;
          if (order.tracking_no) ordersContext += `（${order.tracking_company}: ${order.tracking_no}）`;
          ordersContext += '\n';
        }
        faqAnswer += ordersContext;
        if (user) faqAnswer += `\n如需了解具体订单详情，请告诉我订单号。`;
      }
    }

    // FAQ 增强：如果检测到退款相关意图且有 userId，融入用户退款数据
    if (userId && detectedIntent === 'refund') {
      const refunds = db.getRefundsByUserId(userId);
      if (refunds.length > 0) {
        let refundsContext = `\n\n---\n**您的退款记录：**\n`;
        for (const refund of refunds) {
          const order = db.getOrderById(refund.order_id);
          refundsContext += `- 退款#${refund.id}（订单${refund.order_id} ${order?.product_name || ''}）¥${refund.amount} ${REFUND_STATUS_LABELS[refund.status] || refund.status}\n`;
        }
        faqAnswer += refundsContext;
      }
    }

    if (faqResults.length > 1) {
      faqAnswer += '\n\n📋 **相关问题：**\n';
      for (let i = 1; i < faqResults.length; i++) {
        faqAnswer += `${i}. ${faqResults[i].question}\n`;
      }
      faqAnswer += '\n您可以继续提问，我会为您详细解答。';
    }

    db.updateSession(session.id, { intent: detectedIntent });

    db.createMessage({
      id: assistantMessageId,
      session_id: session.id,
      role: 'assistant',
      content: faqAnswer,
      model: 'faq-knowledge-base',
      intent: detectedIntent,
      created_at: new Date().toISOString(),
      tool_calls: null
    });

    setupSSE(res);

    const faqUser = userId ? db.getUserById(userId) : undefined;
    res.write(`data: ${JSON.stringify({ type: "init", sessionId: session.id, userMessageId, assistantMessageId, model: "faq-knowledge-base", userId: userId || undefined, userName: faqUser?.name })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "text", content: faqAnswer })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "intent_detected", intent: detectedIntent, label: intentLabel })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "done", source: "faq" })}\n\n`);
    res.end();
    return;
  }

  // ===== 第四步：FAQ 未命中，调用 AI SDK =====
  console.log(`[Chat] FAQ not matched, falling back to AI SDK`);

  // 构建业务上下文（如果有 userId）
  let userName = '';
  let vipLevel = '';
  let ordersContext = '';
  let memoryContext = '';

  if (userId) {
    const user = db.getUserById(userId);
    if (user) {
      userName = user.name;
      vipLevel = VIP_LABELS[user.vip_level] || '普通会员';

      const orders = db.getOrdersByUserId(userId);
      if (orders.length > 0) {
        ordersContext = orders.map(o => {
          const refund = db.getRefundByOrderId(o.id);
          const statusLabel = ORDER_STATUS_LABELS[o.status] || o.status;
          let line = `订单#${o.id}: ${o.product_name} ×${o.quantity}, ¥${o.price * o.quantity}, 状态:${statusLabel}`;
          if (o.tracking_no) line += `, 物流:${o.tracking_company} ${o.tracking_no}`;
          if (refund) line += `, 退款:${REFUND_STATUS_LABELS[refund.status] || refund.status}`;
          return line;
        }).join('\n');
      }

      const memories = db.getRecentMemorySummary(userId, 5);
      // 也获取其他类型的记忆
      const allMemories = db.getMemoriesByUserId(userId);
      const recentMemories = allMemories.slice(0, 5);
      if (recentMemories.length > 0) {
        memoryContext = recentMemories.map(m => `[${m.memory_type}] ${m.content}`).join('\n');
      }
    }
  }

  // 设置 SSE 头
  setupSSE(res);

  // 智能客服系统提示词
  const defaultSystemPrompt = `你是一个专业的智能客服AI助手，你的名字叫"小客"。

当前用户信息：
- 姓名：${userName || '未知'}
- VIP等级：${vipLevel || '未知'}

用户订单数据：
${ordersContext || '暂无订单数据'}

用户近期记忆：
${memoryContext || '暂无记忆'}

你需要：
1. 能够查询用户的订单、退款、物流信息，直接给出具体结果（如"您好舒女士，您的订单#ORD-20260605（无线耳机）正在配送中"）
2. 多轮对话中记住用户提到的具体订单，后续操作（如退货）要能找到对应订单
3. 回答规范：
   - 首先确认用户的意图，简短说明你理解了什么问题
   - 回答要简洁清晰，使用分点说明
   - 主动提供下一步建议
   - 保持友善专业的语气
4. 转人工判断：当用户明确要求转人工时，立即转接；当你无法解决用户问题时，建议转人工
5. 注意事项：
   - 不要编造不存在的信息
   - 涉及金额和账号信息时要格外谨慎
   - 每次回答时，在最开头用【意图：xxx】标注你识别到的意图类别
   - 意图类别：退款、查询订单、技术支持、一般咨询`;
  
  const workingDir = cwd || process.cwd();

  try {
    const canUseTool: CanUseTool = async (toolName, input, options) => {
      if (permissionMode === 'bypassPermissions') {
        return { behavior: 'allow', updatedInput: input };
      }
      
      const requestId = uuidv4();
      const permissionRequest = {
        requestId, toolUseId: options.toolUseID, toolName, input,
        sessionId: session.id, timestamp: Date.now()
      };
      
      res.write(`data: ${JSON.stringify({ type: "permission_request", ...permissionRequest })}\n\n`);
      
      return new Promise<PermissionResult>((resolve, reject) => {
        const pending: PendingPermission = {
          resolve, reject, toolName, input, sessionId: session.id, timestamp: Date.now()
        };
        pendingPermissions.set(requestId, pending);
        setTimeout(() => {
          if (pendingPermissions.has(requestId)) {
            pendingPermissions.delete(requestId);
            resolve({ behavior: 'deny', message: '权限请求超时' });
          }
        }, PERMISSION_TIMEOUT);
      });
    };
    
    const stream = query({
      prompt: message,
      options: {
        cwd: workingDir,
        model: selectedModel,
        maxTurns: 10,
        systemPrompt: systemPrompt || defaultSystemPrompt,
        permissionMode: permissionMode || 'default',
        canUseTool,
        ...(sdkSessionId ? { resume: sdkSessionId } : {})
      }
    });

    let fullResponse = "";
    let toolCalls: Array<{ id: string; name: string; input?: Record<string, unknown>; status: string; result?: string; isError?: boolean }> = [];
    let newSdkSessionId: string | null = null;

    res.write(`data: ${JSON.stringify({ type: "init", sessionId: session.id, userMessageId, assistantMessageId, model: selectedModel, userId: userId || undefined, userName })}\n\n`);

    let currentToolId: string | null = null;

    for await (const msg of stream) {
      if (msg.type === "system" && (msg as any).subtype === "init") {
        newSdkSessionId = (msg as any).session_id;
        if (newSdkSessionId && newSdkSessionId !== sdkSessionId) {
          db.updateSession(session.id, { sdk_session_id: newSdkSessionId });
        }
      } else if (msg.type === "assistant") {
        const content = msg.message.content;
        if (typeof content === "string") {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text") {
              fullResponse += block.text;
              res.write(`data: ${JSON.stringify({ type: "text", content: block.text })}\n\n`);
            } else if (block.type === "tool_use") {
              currentToolId = block.id || uuidv4();
              const toolInput = (block as any).input || {};
              const toolCall = { id: currentToolId, name: block.name, input: toolInput, status: "running" };
              toolCalls.push(toolCall);
              res.write(`data: ${JSON.stringify({ type: "tool", id: toolCall.id, name: toolCall.name, input: toolCall.input, status: toolCall.status })}\n\n`);
            }
          }
        }
      } else if (msg.type === "tool_result") {
        const msgAny = msg as any;
        const toolId = msgAny.tool_use_id || currentToolId;
        const isError = msgAny.is_error || false;
        const content = msgAny.content;
        const tool = toolCalls.find(t => t.id === toolId) || toolCalls[toolCalls.length - 1];
        if (tool) {
          tool.status = isError ? "error" : "completed";
          tool.isError = isError;
          tool.result = typeof content === 'string' ? content : JSON.stringify(content);
          res.write(`data: ${JSON.stringify({ type: "tool_result", toolId: tool.id, content: tool.result, isError })}\n\n`);
        }
        currentToolId = null;
      } else if (msg.type === "result") {
        toolCalls.forEach(tool => {
          if (tool.status === "running") {
            tool.status = "completed";
            res.write(`data: ${JSON.stringify({ type: "tool_result", toolId: tool.id, content: tool.result || "已完成" })}\n\n`);
          }
        });
        res.write(`data: ${JSON.stringify({ type: "done", duration: msg.duration, cost: msg.cost })}\n\n`);
      }
    }

    // 保存助手消息到数据库
    db.createMessage({
      id: assistantMessageId,
      session_id: session.id,
      role: 'assistant',
      content: fullResponse,
      model: selectedModel,
      intent: null,
      created_at: new Date().toISOString(),
      tool_calls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null
    });

    // 更新会话信息
    const messages = db.getMessagesBySession(session.id);
    if (messages.length <= 2) {
      db.updateSession(session.id, {
        title: truncateTitle(message),
        model: selectedModel,
        intent: intent || 'general'
      });
    }

    // 检测回复中是否包含转人工标识
    if (fullResponse.includes('转人工') || fullResponse.includes('转接人工')) {
      db.updateSession(session.id, { is_transferred_to_human: 1 });
      res.write(`data: ${JSON.stringify({ type: "transfer_to_human" })}\n\n`);
    }

    // 检测回复中的意图标识
    const intentMatch = fullResponse.match(/【意图[：:](.+?)】/);
    if (intentMatch) {
      const detectedIntent = intentMatch[1].trim();
      const intentMap: Record<string, string> = {
        '退款': 'refund', '退换货': 'refund',
        '查询订单': 'order_query', '订单查询': 'order_query', '物流': 'order_query',
        '技术支持': 'tech_support', '技术问题': 'tech_support',
        '一般咨询': 'general', '其他': 'general'
      };
      const mappedIntent = intentMap[detectedIntent] || 'general';
      db.updateSession(session.id, { intent: mappedIntent });
      res.write(`data: ${JSON.stringify({ type: "intent_detected", intent: mappedIntent, label: detectedIntent })}\n\n`);
    }

    // 自动保存记忆：如果 userId 存在且回复涉及具体订单数据
    if (userId && fullResponse) {
      const orderPattern = /订单[#＃]?\s*(ORD-\d+|\d+)/;
      const orderMatch = fullResponse.match(orderPattern);
      if (orderMatch) {
        db.addMemory({
          user_id: userId,
          content: `用户咨询了订单#${orderMatch[1]}的相关信息`,
          memory_type: 'fact',
        });
      }
      // 如果回复中包含退款相关内容，也保存记忆
      if (fullResponse.includes('退款') || fullResponse.includes('退货')) {
        db.addMemory({
          user_id: userId,
          content: `用户提出了退款/退货需求`,
          memory_type: 'fact',
        });
      }
    }

    res.end();
  } catch (error: any) {
    console.error(`[Chat] Error:`, error);
    const errorMessage = error?.message || "处理请求时发生错误";
    res.write(`data: ${JSON.stringify({ type: "error", message: errorMessage })}\n\n`);
    res.end();
  }
});

// 启动服务器（先初始化数据库）
async function startServer() {
  try {
    await db.initDatabase();
    console.log('[DB] Database initialized successfully');
  } catch (e) {
    console.error('[DB] Failed to initialize database:', e);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║     ◉ 智能客服 API 服务器已启动            ║
║                                            ║
║     地址: http://localhost:${PORT}            ║
║     数据库: SQLite (data/chat.db)          ║
║     管理后台: http://localhost:5173/admin   ║
║                                            ║
╚════════════════════════════════════════════╝
    `);
  });
}

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  db.closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Server] Shutting down...');
  db.closeDatabase();
  process.exit(0);
});

startServer();
