import { useRef, useCallback } from 'react';
import { ChatSender } from '@tdesign-react/chat';
import { Sparkles } from 'lucide-react';

interface ChatInputProps {
  inputValue: string;
  selectedModel: string;
  isLoading: boolean;
  onSend: (message: string) => void;
  onStop: () => void;
  onChange: (value: string) => void;
}

export function ChatInput({
  inputValue,
  selectedModel,
  isLoading,
  onSend,
  onStop,
  onChange,
}: ChatInputProps) {
  const chatSenderRef = useRef<any>(null);

  const handleSend = useCallback((e: any) => {
    const content = e?.detail?.message || e?.detail || e?.message || inputValue;
    if (content && typeof content === 'string' && content.trim() && selectedModel) {
      onSend(content.trim());
    } else if (inputValue.trim() && selectedModel) {
      onSend(inputValue.trim());
    }
  }, [inputValue, selectedModel, onSend]);

  const handleChange = useCallback((e: any) => {
    const value = e?.detail ?? e ?? '';
    onChange(typeof value === 'string' ? value : '');
  }, [onChange]);

  return (
    <div className="premium-input-area">
      <div className="max-w-3xl mx-auto">
        <div className="premium-input-glow" />
        <div className="premium-input-box">
          <div className="premium-input-box__icon">
            <Sparkles size={16} />
          </div>
          <div className="premium-input-box__field">
            <ChatSender
              ref={chatSenderRef}
              value={inputValue}
              placeholder="描述您的问题，AI 客服即刻为您解答..."
              disabled={!selectedModel}
              loading={isLoading}
              autosize={{ minRows: 1, maxRows: 6 }}
              actions={['send']}
              onSend={handleSend}
              onStop={onStop}
              onChange={handleChange}
            />
          </div>
        </div>
        <p className="premium-input-hint">
          由 AI 智能驱动 · 说「转接人工客服」可切换人工服务
        </p>
      </div>
    </div>
  );
}
