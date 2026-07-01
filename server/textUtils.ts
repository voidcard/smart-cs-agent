const INTENT_LABELS: Record<string, string> = {
  refund: '退款咨询',
  order_query: '订单查询',
  tech_support: '技术支持',
  general: '一般咨询',
};

/** 检测文本是否因编码错误损坏（含替换符或典型乱码特征） */
export function isCorruptedText(text: string | null | undefined): boolean {
  if (!text) return false;
  if (text.includes('\uFFFD')) return true;

  const cjkCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  if (cjkCount > 0) return false;

  // 中文客服场景：较长文本却无任何汉字，且含高位字符 → 多为乱码
  const highChars = (text.match(/[^\x00-\x7f]/g) || []).length;
  if (text.length >= 4 && highChars >= Math.ceil(text.length * 0.4)) {
    return true;
  }

  return false;
}

export function truncateTitle(text: string, max = 30): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max) + '...';
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  } catch {
    return '';
  }
}

/** 无法恢复原文时的会话标题 */
export function fallbackSessionTitle(intent: string | null | undefined, createdAt: string): string {
  const label = INTENT_LABELS[intent || 'general'] || '历史对话';
  const date = formatShortDate(createdAt);
  return date ? `${label} · ${date}` : label;
}

/** 从会话数据解析可展示的标题 */
export function resolveSessionTitle(
  title: string,
  intent: string | null | undefined,
  createdAt: string,
  firstUserMessage?: string | null
): string {
  if (!isCorruptedText(title)) {
    return title;
  }
  if (firstUserMessage && !isCorruptedText(firstUserMessage)) {
    return truncateTitle(firstUserMessage);
  }
  return fallbackSessionTitle(intent, createdAt);
}

export function assertValidUtf8Text(text: string, fieldName = '内容'): string {
  if (isCorruptedText(text)) {
    throw new Error(`${fieldName}编码无效，请重新输入`);
  }
  return text;
}
