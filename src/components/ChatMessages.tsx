import { Loading } from 'tdesign-react';
import { ChatMarkdown } from '@tdesign-react/chat';
import { User, Bot, Headphones } from 'lucide-react';
import { Message, Model, PermissionRequest, ContentBlock } from '../types';
import { ToolCallsCollapse } from './ToolCallsCollapse';
import { InlinePermissionCard } from './InlinePermissionCard';
import { IntentTag } from './IntentTag';
import { SatisfactionRating } from './SatisfactionRating';
import { TransferToHuman } from './TransferToHuman';

interface ChatMessagesProps {
  messages: Message[];
  models: Model[];
  messagesEndRef: React.RefObject<HTMLDivElement>;
  currentSessionId?: string;
  isTransferredToHuman?: boolean;
  // 内联权限确认相关
  permissionRequest?: PermissionRequest | null;
  onPermissionAllow?: () => void;
  onPermissionDeny?: () => void;
}

export function ChatMessages({ 
  messages, 
  models, 
  messagesEndRef,
  currentSessionId,
  isTransferredToHuman,
  permissionRequest,
  onPermissionAllow,
  onPermissionDeny
}: ChatMessagesProps) {
  const formatModelName = (modelId: string) => {
    if (modelId === 'faq-knowledge-base') return '智能客服';
    if (modelId === 'business-data') return '订单助手';
    if (modelId === 'system') return '系统';
    const model = models.find(m => m.modelId === modelId);
    const name = model?.name || modelId;
    return name
      .replace(/^(Claude|GPT|Gemini|Kimi|DeepSeek|Qwen|GLM)\s*/i, '')
      .replace(/-/g, ' ')
      .trim() || name;
  };

  // 从消息中提取意图标识
  const extractIntentFromContent = (content: string): string | null => {
    const match = content.match(/【意图[：:](.+?)】/);
    return match ? match[1].trim() : null;
  };

  // 意图名称到类型的映射
  const mapIntentLabel = (label: string): string => {
    const map: Record<string, string> = {
      '退款': 'refund', '退换货': 'refund',
      '查询订单': 'order_query', '订单查询': 'order_query', '物流': 'order_query',
      '技术支持': 'tech_support', '技术问题': 'tech_support',
      '一般咨询': 'general', '其他': 'general'
    };
    return map[label] || 'general';
  };

  // 渲染单个内容块
  const renderContentBlock = (block: ContentBlock, index: number, isStreaming?: boolean, isLast?: boolean) => {
    if (block.type === 'text') {
      // 去除意图标识显示（在标签中单独展示）
      let displayText = block.text;
      displayText = displayText.replace(/【意图[：:].+?】\s*/g, '');
      
      if (!displayText.trim() && block.text.match(/【意图[：:].+?】/)) {
        return null;
      }

      return (
        <div 
          key={`text-${index}`}
          className="px-4 py-3 leading-relaxed break-words"
          style={{
            backgroundColor: 'var(--td-bg-color-component)',
            color: 'var(--td-text-color-primary)',
            borderRadius: '16px 16px 16px 4px'
          }}
        >
          <div className="chat-markdown">
            <ChatMarkdown content={displayText} />
          </div>
          {isStreaming && isLast && (
            <span 
              className="animate-cursor-blink ml-0.5"
              style={{ color: 'var(--td-brand-color)' }}
            >
              |
            </span>
          )}
        </div>
      );
    } else if (block.type === 'tool_use') {
      return (
        <ToolCallsCollapse
          key={`tool-${block.toolCall.id}`}
          toolCalls={[block.toolCall]}
          isStreaming={isStreaming && block.toolCall.status === 'running'}
        />
      );
    }
    return null;
  };

  // 渲染 assistant 消息内容
  const renderAssistantContent = (message: Message) => {
    if (message.contentBlocks && message.contentBlocks.length > 0) {
      return message.contentBlocks.map((block, index) => 
        renderContentBlock(block, index, message.isStreaming, index === message.contentBlocks!.length - 1)
      );
    }
    
    let displayContent = message.content || '';
    displayContent = displayContent.replace(/【意图[：:].+?】\s*/g, '');

    return (
      <>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallsCollapse toolCalls={message.toolCalls} isStreaming={message.isStreaming} />
        )}
        {displayContent && (
          <div 
            className="px-4 py-3 leading-relaxed break-words"
            style={{
              backgroundColor: 'var(--td-bg-color-component)',
              color: 'var(--td-text-color-primary)',
              borderRadius: '16px 16px 16px 4px'
            }}
          >
            <div className="chat-markdown">
              <ChatMarkdown content={displayContent} />
            </div>
            {message.isStreaming && (
              <span className="animate-cursor-blink ml-0.5" style={{ color: 'var(--td-brand-color)' }}>|</span>
            )}
          </div>
        )}
      </>
    );
  };

  // 检查最后一条assistant消息是否包含意图标识
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
  const detectedIntentLabel = lastAssistantMessage ? extractIntentFromContent(lastAssistantMessage.content) : null;

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {messages.map(message => (
        <div 
          key={message.id} 
          className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
        >
          <div 
            className="w-9 h-9 flex items-center justify-center flex-shrink-0 rounded-full self-start"
            style={{
              backgroundColor: message.role === 'user' 
                ? 'var(--td-brand-color)' 
                : isTransferredToHuman ? '#ED7B2F' : 'var(--td-bg-color-component)',
              color: message.role === 'user' 
                ? 'white' 
                : isTransferredToHuman ? 'white' : 'var(--td-text-color-primary)'
            }}
          >
            {message.role === 'user' ? <User size={18} /> : 
             isTransferredToHuman ? <Headphones size={18} /> : <Bot size={18} />}
          </div>
          <div 
            className={`flex flex-col gap-2 max-w-[80%] ${message.role === 'user' ? 'items-end' : ''}`}
          >
            {message.role === 'assistant' && message.model && (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
                  {isTransferredToHuman ? '人工客服' : formatModelName(message.model)}
                </span>
              </div>
            )}
            
            {/* 用户消息 */}
            {message.role === 'user' && (
              <div 
                className="px-4 py-3 leading-relaxed break-words"
                style={{
                  backgroundColor: 'var(--td-brand-color)',
                  color: 'white',
                  borderRadius: '16px 16px 4px 16px'
                }}
              >
                {message.content}
              </div>
            )}
            
            {/* 助手消息 */}
            {message.role === 'assistant' && renderAssistantContent(message)}
            
            {/* 思考中状态 */}
            {message.role === 'assistant' && message.isStreaming && 
             !message.content && 
             (!message.contentBlocks || message.contentBlocks.length === 0) && 
             (!message.toolCalls || message.toolCalls.length === 0) && (
              <div 
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--td-bg-color-component)' }}
              >
                <Loading size="small" />
                <span className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
                  正在分析您的问题...
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
      
      {/* 意图识别标签 */}
      {detectedIntentLabel && !isTransferredToHuman && (
        <div className="flex items-center gap-2 ml-12">
          <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>识别意图：</span>
          <IntentTag intent={mapIntentLabel(detectedIntentLabel)} />
        </div>
      )}

      {/* 转人工状态 */}
      {isTransferredToHuman && (
        <div className="ml-12">
          <TransferToHuman />
        </div>
      )}
      
      {/* 内联权限确认 */}
      {permissionRequest && onPermissionAllow && onPermissionDeny && (
        <div className="flex gap-3 ml-12">
          <InlinePermissionCard
            request={permissionRequest}
            onAllow={onPermissionAllow}
            onDeny={onPermissionDeny}
          />
        </div>
      )}
      
      {/* 满意度评价 - 对话结束后显示 */}
      {currentSessionId && !isTransferredToHuman && messages.length >= 2 && 
       lastAssistantMessage && !lastAssistantMessage.isStreaming && (
        <div className="ml-12 mt-2">
          <SatisfactionRating sessionId={currentSessionId} />
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
}
