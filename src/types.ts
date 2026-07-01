/**
 * 类型定义
 */

export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';

export interface Model {
  modelId: string;
  name: string;
  description?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input?: Record<string, unknown>;
  status: 'running' | 'completed' | 'error';
  result?: string;
  isError?: boolean;
}

/**
 * 内容块类型 - 支持文字和工具调用按顺序排列
 */
export type ContentBlock = 
  | { type: 'text'; text: string }
  | { type: 'tool_use'; toolCall: ToolCall };

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  timestamp: Date;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
  contentBlocks?: ContentBlock[];
  // 智能客服扩展
  intent?: IntentType;
  isTransferredToHuman?: boolean;
  satisfactionRating?: number;  // 1-5 星
}

export interface Session {
  id: string;
  title: string;
  model: string;
  agentId?: string;
  cwd?: string;
  permissionMode?: PermissionMode;
  createdAt: Date;
  messages: Message[];
  userId?: string;
  // 智能客服扩展
  intent?: IntentType;
  satisfactionRating?: number;
  isTransferredToHuman?: boolean;
  resolvedAt?: Date;
}

export interface UserInfo {
  id: string;
  name: string;
  phone: string;
  email: string;
  vipLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomAgent {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  icon?: string;
  color?: string;
  permissionMode?: PermissionMode;
  createdAt: Date;
  updatedAt: Date;
}

// Agent 是 CustomAgent 的别名
export type Agent = CustomAgent;

export type Theme = 'light' | 'dark';

/**
 * 权限请求 - 用于工具调用确认
 */
export interface PermissionRequest {
  requestId: string;
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
  sessionId: string;
  timestamp: number;
}

/**
 * 权限响应
 */
export interface PermissionResponse {
  requestId: string;
  behavior: 'allow' | 'deny';
  message?: string;
}

// ============= 智能客服扩展类型 =============

/** 意图类型 */
export type IntentType = 'refund' | 'order_query' | 'tech_support' | 'general';

/** 意图配置 */
export interface IntentConfig {
  id: IntentType;
  name: string;
  color: string;
  icon: string;
  keywords: string[];
  description: string;
}

/** FAQ 条目 */
export interface FAQItem {
  id: string;
  category: IntentType;
  question: string;
  answer: string;
  keywords: string[];
}

/** 满意度评价 */
export interface SatisfactionRating {
  id: string;
  sessionId: string;
  rating: number;  // 1-5
  comment?: string;
  createdAt: string;
}

/** 管理后台统计 */
export interface AdminStats {
  totalSessions: number;
  avgSatisfaction: number;
  intentDistribution: Record<string, number>;
  transferRate: number;
  resolutionRate: number;
  dailyStats: Array<{
    date: string;
    sessions: number;
    avgSatisfaction: number;
    transfers: number;
  }>;
  satisfactionDistribution: Record<number, number>;
  totalRatings: number;
}
