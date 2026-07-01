import { Tag } from 'tdesign-react';
import { IntentType } from '../types';

interface IntentTagProps {
  intent: IntentType | string;
  size?: 'small' | 'medium' | 'large';
}

const INTENT_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  refund: { label: '退款', color: '#e34d59', bgColor: 'rgba(227, 77, 89, 0.1)' },
  order_query: { label: '查询订单', color: '#0052d9', bgColor: 'rgba(0, 82, 217, 0.1)' },
  tech_support: { label: '技术支持', color: '#2ba471', bgColor: 'rgba(43, 164, 113, 0.1)' },
  general: { label: '一般咨询', color: '#ed7b2f', bgColor: 'rgba(237, 123, 47, 0.1)' },
};

export function IntentTag({ intent, size = 'small' }: IntentTagProps) {
  const config = INTENT_CONFIG[intent] || INTENT_CONFIG.general;
  
  return (
    <Tag
      size={size}
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
        borderColor: config.color + '40',
        fontWeight: 500,
      }}
    >
      {config.label}
    </Tag>
  );
}
