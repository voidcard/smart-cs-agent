import { Button } from 'tdesign-react';
import { UserIcon, SwapIcon } from 'tdesign-icons-react';

interface TransferToHumanProps {
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function TransferToHuman({ onConfirm, onCancel }: TransferToHumanProps) {
  return (
    <div 
      className="p-4 rounded-xl"
      style={{ 
        backgroundColor: 'rgba(237, 123, 47, 0.08)',
        border: '1px solid rgba(237, 123, 47, 0.3)'
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#ED7B2F' }}
        >
          <UserIcon size={20} color="white" />
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
            转接人工客服
          </p>
          <p className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
            正在为您转接人工客服，请稍候...
          </p>
        </div>
      </div>
      
      <div 
        className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3"
        style={{ backgroundColor: 'var(--td-bg-color-component)' }}
      >
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: '#ED7B2F', animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: '#ED7B2F', animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: '#ED7B2F', animationDelay: '300ms' }} />
        </div>
        <span className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
          等待人工客服接入中
        </span>
      </div>

      <div className="flex gap-2">
        <Button 
          size="small" 
          variant="outline"
          onClick={onCancel}
        >
          继续与AI对话
        </Button>
        <Button 
          size="small" 
          theme="warning"
          onClick={onConfirm}
          icon={<SwapIcon />}
        >
          确认转接
        </Button>
      </div>
    </div>
  );
}
