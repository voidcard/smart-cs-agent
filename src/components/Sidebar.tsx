import { Button, Tooltip } from 'tdesign-react';
import { AddIcon, DeleteIcon, SettingIcon, ViewListIcon } from 'tdesign-icons-react';
import { Bot } from 'lucide-react';
import { APP_CONFIG } from '../config';
import { Session, Agent } from '../types';
import { ICON_MAP } from '../utils/iconMap';

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  isSettingsPage: boolean;
  isAdminPage: boolean;
  sidebarOpen: boolean;
  agents: Agent[];
  getAgent: (id: string) => Agent | undefined;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenSettings: () => void;
  onOpenAdmin: () => void;
}

export function Sidebar({
  sessions,
  currentSessionId,
  isSettingsPage,
  isAdminPage,
  sidebarOpen,
  agents,
  getAgent,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onOpenSettings,
  onOpenAdmin,
}: SidebarProps) {
  // 意图颜色映射
  const getIntentDotColor = (intent?: string) => {
    const map: Record<string, string> = {
      refund: '#e34d59', order_query: '#0052d9', tech_support: '#2ba471', general: '#ed7b2f'
    };
    return map[intent || 'general'] || '#8c8c8c';
  };

  return (
    <aside 
      className="sidebar-glass flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden"
      style={{ 
        width: sidebarOpen ? 260 : 0,
      }}
    >
      {/* Logo */}
      <div className="h-14 px-4 flex items-center flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div 
            className="sidebar-logo w-8 h-8 rounded-lg flex items-center justify-center"
          >
            <span className="text-sm font-bold text-white">{APP_CONFIG.nameInitial}</span>
          </div>
          <span 
            className="text-lg font-semibold"
            style={{ color: 'var(--td-text-color-primary)' }}
          >
            {APP_CONFIG.name}
          </span>
        </div>
      </div>

      {/* 新对话按钮 */}
      <div className="p-3">
        <Button 
          icon={<AddIcon />}
          onClick={onNewChat}
          block
          variant="outline"
        >
          新对话
        </Button>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.map(session => {
          const sessionAgent = session.agentId ? getAgent(session.agentId) : getAgent('default');
          const AgentIcon = ICON_MAP[sessionAgent?.icon || 'Bot'] || Bot;
          const isActive = session.id === currentSessionId && !isSettingsPage && !isAdminPage;
          return (
            <div 
              key={session.id}
              className="sidebar-session-item flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer group"
              style={{
                backgroundColor: isActive
                  ? 'var(--td-brand-color-light)' 
                  : 'transparent',
                color: isActive
                  ? 'var(--td-brand-color)' 
                  : 'var(--td-text-color-secondary)'
              }}
              onClick={() => onSelectSession(session.id)}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--td-bg-color-component-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <div 
                className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center"
                style={{ backgroundColor: sessionAgent?.color || 'var(--td-brand-color)' }}
              >
                <AgentIcon size={12} color="white" />
              </div>
              <span className="flex-1 truncate text-sm">{session.title}</span>
              {/* 意图标识小圆点 */}
              <div 
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: getIntentDotColor(session.intent) }}
                title={session.intent || '一般咨询'}
              />
              <Tooltip content="删除会话">
                <Button
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  variant="text"
                  shape="circle"
                  size="medium"
                  icon={<DeleteIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                />
              </Tooltip>
            </div>
          );
        })}
      </div>
      
      {/* 底部按钮区 */}
      <div 
        className="p-3 border-t flex-shrink-0 flex flex-col gap-2"
        style={{ borderColor: 'var(--td-component-border)' }}
      >
        <Button 
          icon={<ViewListIcon />}
          onClick={onOpenAdmin}
          block
          variant={isAdminPage ? 'outline' : 'text'}
          theme={isAdminPage ? 'warning' : 'default'}
        >
          管理后台
        </Button>
        <Button 
          icon={<SettingIcon />}
          onClick={onOpenSettings}
          block
          variant={isSettingsPage ? 'outline' : 'text'}
          theme={isSettingsPage ? 'primary' : 'default'}
        >
          设置
        </Button>
      </div>
    </aside>
  );
}
