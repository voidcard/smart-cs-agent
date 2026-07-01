import { useState } from 'react';
import { Rate, Textarea, Button, Card, MessagePlugin } from 'tdesign-react';
import { StarFilledIcon } from 'tdesign-icons-react';

interface SatisfactionRatingProps {
  sessionId: string;
  onRated?: () => void;
}

export function SatisfactionRating({ sessionId, onRated }: SatisfactionRatingProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      MessagePlugin.warning('请先选择评分');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      });

      if (response.ok) {
        setSubmitted(true);
        MessagePlugin.success('感谢您的评价！');
        onRated?.();
      } else {
        MessagePlugin.error('提交评价失败，请重试');
      }
    } catch (error) {
      MessagePlugin.error('网络错误，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div 
        className="p-4 rounded-xl text-center"
        style={{ backgroundColor: 'var(--td-bg-color-component)' }}
      >
        <StarFilledIcon size="32px" style={{ color: '#ED7B2F' }} />
        <p className="mt-2 text-sm" style={{ color: 'var(--td-text-color-primary)' }}>
          感谢您的评价！
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--td-text-color-secondary)' }}>
          您的反馈帮助我们改进服务
        </p>
      </div>
    );
  }

  return (
    <div 
      className="p-4 rounded-xl"
      style={{ 
        backgroundColor: 'var(--td-bg-color-component)',
        border: '1px solid var(--td-component-stroke)'
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <StarFilledIcon size="18px" style={{ color: '#ED7B2F' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
          对本次服务评价
        </span>
      </div>
      
      <div className="mb-3">
        <Rate 
          value={rating} 
          onChange={(v) => setRating(v as number)}
          size="medium"
          color="#ED7B2F"
        />
        <span className="ml-2 text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
          {rating === 0 ? '请选择评分' : 
           rating === 1 ? '非常不满意' :
           rating === 2 ? '不满意' :
           rating === 3 ? '一般' :
           rating === 4 ? '满意' : '非常满意'}
        </span>
      </div>

      <Textarea
        value={comment}
        onChange={(v) => setComment(v as string)}
        placeholder="请输入您的建议（可选）"
        maxlength={200}
        autosize={{ minRows: 2, maxRows: 4 }}
        style={{ marginBottom: '12px' }}
      />

      <Button 
        theme="primary" 
        size="small"
        onClick={handleSubmit}
        loading={submitting}
        disabled={rating === 0}
      >
        提交评价
      </Button>
    </div>
  );
}
