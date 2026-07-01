import { Button, Tooltip, Tag, Avatar } from 'tdesign-react';
import { 
  SunnyIcon,
  MoonIcon,
  MenuFoldIcon,
  MenuUnfoldIcon,
  UserIcon,
} from 'tdesign-icons-react';
import { Bot } from 'lucide-react';
import { APP_CONFIG } from '../config';
import { Session, Agent, Theme, UserInfo } from '../types';
import { ICON_MAP } from '../utils/iconMap';

interface HeaderProps {
  isSettingsPage: boolean;
  isAdminPage: boolean;
  sidebarOpen: boolean;
  theme: Theme;
  currentSession: Session | undefined;
  currentAgent: Agent | undefined;
  user: UserInfo | null;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  onOpenLoginDialog: () => void;
  onLogout: () => void;
}

export function Header({
  isSettingsPage,
  isAdminPage,
  sidebarOpen,
  theme,
  currentSession,
  currentAgent,
  user,
  onToggleSidebar,
  onToggleTheme,
  onOpenLoginDialog,
  onLogout,
}: HeaderProps) {
  const getPageTitle = () => {
    if (isSettingsPage) return '设置';
    if (isAdminPage) return '管理后台';
    return currentSession?.title || APP_CONFIG.name;
  };

  return (
    <header 
      className="h-14 flex justify-between items-center px-4 flex-shrink-0 glass-header relative z-10"
    >
      <div className="flex items-center gap-3">
        <Button
          variant="text"
          shape="circle"
          icon={sidebarOpen ? <MenuFoldIcon /> : <MenuUnfoldIcon />}
          onClick={onToggleSidebar}
        />
        {!isSettingsPage && !isAdminPage && currentAgent && (
          <div 
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: currentAgent.color || 'var(--td-brand-color)' }}
          >
            {(() => {
              const Icon = ICON_MAP[currentAgent.icon || 'Bot'] || Bot;
              return <Icon size={14} color="white" />;
            })()}
          </div>
        )}
        <h1 
          className="text-base font-semibold"
          style={{ color: 'var(--td-text-color-primary)' }}
        >
          {getPageTitle()}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        {/* 用户信息 */}
        {user ? (
          <Tooltip content={`${user.name} (VIP${user.vipLevel}) · 点击退出`}>
            <div 
              className="flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer"
              style={{ background: 'var(--td-bg-color-secondarycontainer)' }}
              onClick={onLogout}
            >
              <Avatar size="small" style={{ background: '#0052d9' }}>
                {user.name[0]}
              </Avatar>
              <span style={{ fontSize: 13, color: 'var(--td-text-color-primary)' }}>
                {user.name}
              </span>
              {user.vipLevel > 0 && (
                <Tag size="small" theme="warning" variant="light">
                  VIP{user.vipLevel}
                </Tag>
              )}
            </div>
          </Tooltip>
        ) : (
          <Tooltip content="登录以查询个人订单">
            <Button
              variant="outline"
              shape="round"
              size="small"
              icon={<UserIcon />}
              onClick={onOpenLoginDialog}
            >
              登录
            </Button>
          </Tooltip>
        )}

        <Tooltip content={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}>
          <Button
            variant="outline"
            shape="circle"
            icon={theme === 'light' ? <MoonIcon /> : <SunnyIcon />}
            onClick={onToggleTheme}
          />
        </Tooltip>
      </div>
    </header>
  );
}
