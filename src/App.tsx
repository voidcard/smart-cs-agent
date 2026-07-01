import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import '@tdesign-react/chat/es/style/index.js';

import { useAgents } from './hooks/useAgents';
import { useTheme } from './hooks/useTheme';
import { useSessions } from './hooks/useSessions';
import { useModels } from './hooks/useModels';
import { useChat } from './hooks/useChat';
import { useUser } from './hooks/useUser';
import { PermissionMode } from './types';

import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { SettingsPage } from './components/SettingsPage';
import { AdminPage } from './components/AdminPage';
import { ChatPage } from './pages/ChatPage';
import { LoginDialog } from './components/LoginDialog';

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/chat/:sessionId" element={<AppContent />} />
      <Route path="/settings" element={<AppContent />} />
      <Route path="/admin" element={<AppContent />} />
    </Routes>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const isSettingsPage = location.pathname === '/settings';
  const isAdminPage = location.pathname === '/admin';
  
  // Hooks
  const { theme, toggleTheme } = useTheme();
  const { agents, addAgent, updateAgent, deleteAgent, getAgent } = useAgents();
  const { models, selectedModel, setSelectedModel, fetchModels } = useModels();
  const userHook = useUser();
  const {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    currentSession,
    sessionModels,
    fetchSessions,
    deleteSession,
    updateSessionModel,
    addSession,
    updateSession,
    updateSessionMessages,
  } = useSessions();

  // 聊天 Hook
  const {
    isLoading,
    inputValue,
    setInputValue,
    permissionRequest,
    sendMessage,
    handleStop,
    handlePermissionAllow,
    handlePermissionDeny,
  } = useChat({
    currentSession,
    currentSessionId,
    selectedModel,
    getAgent,
    addSession,
    updateSession,
    updateSessionMessages,
    updateSessionModel,
    setCurrentSessionId,
    setSessions,
    getUserId: userHook.getUserId,
  });

  // 登录弹窗状态
  const [loginDialogVisible, setLoginDialogVisible] = useState(false);

  // 获取当前会话的 Agent
  const currentAgent = currentSession?.agentId ? getAgent(currentSession.agentId) : getAgent('default');

  // 从 URL 同步 sessionId
  useEffect(() => {
    if (urlSessionId && urlSessionId !== currentSessionId) {
      setCurrentSessionId(urlSessionId);
    } else if (!urlSessionId && !isSettingsPage && !isAdminPage && currentSessionId) {
      setCurrentSessionId(null);
    }
  }, [urlSessionId, isSettingsPage, isAdminPage, currentSessionId, setCurrentSessionId]);

  // 当切换会话时，恢复该会话的模型选择
  useEffect(() => {
    if (currentSessionId && sessionModels[currentSessionId]) {
      setSelectedModel(sessionModels[currentSessionId]);
    } else if (currentSession) {
      setSelectedModel(currentSession.model);
    }
  }, [currentSessionId, sessionModels, currentSession, setSelectedModel]);

  // 初始加载会话列表
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // 更新当前会话的模型
  const updateCurrentSessionModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    if (currentSessionId) {
      updateSessionModel(currentSessionId, modelId);
    }
  }, [currentSessionId, updateSessionModel, setSelectedModel]);

  // 删除会话处理
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    const navigateTo = await deleteSession(sessionId);
    if (navigateTo) {
      navigate(navigateTo);
    }
  }, [deleteSession, navigate]);

  // 侧边栏事件处理
  const handleNewChat = useCallback(() => {
    setCurrentSessionId(null);
    navigate('/');
  }, [navigate, setCurrentSessionId]);

  const handleSelectSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    navigate(`/chat/${sessionId}`);
  }, [navigate, setCurrentSessionId]);

  const handleOpenSettings = useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  const handleOpenAdmin = useCallback(() => {
    navigate('/admin');
  }, [navigate]);

  // Sidebar 状态
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // 权限模式状态
  const [permissionMode] = useState<PermissionMode>('bypassPermissions');

  return (
    <div className="flex h-screen w-screen app-shell">
      {/* 侧边栏 */}
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        isSettingsPage={isSettingsPage}
        isAdminPage={isAdminPage}
        sidebarOpen={sidebarOpen}
        agents={agents}
        getAgent={getAgent}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onOpenSettings={handleOpenSettings}
        onOpenAdmin={handleOpenAdmin}
      />

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        {/* 顶部栏 */}
        <Header
          isSettingsPage={isSettingsPage}
          isAdminPage={isAdminPage}
          sidebarOpen={sidebarOpen}
          theme={theme}
          currentSession={currentSession}
          currentAgent={currentAgent}
          user={userHook.user}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleTheme={toggleTheme}
          onOpenLoginDialog={() => setLoginDialogVisible(true)}
          onLogout={userHook.logout}
        />

        {/* 页面内容 */}
        {isSettingsPage ? (
          <SettingsPage
            agents={agents}
            onAdd={addAgent}
            onUpdate={updateAgent}
            onDelete={deleteAgent}
          />
        ) : isAdminPage ? (
          <AdminPage />
        ) : (
          <ChatPage
            currentSession={currentSession}
            models={models}
            selectedModel={selectedModel}
            agents={agents}
            isLoading={isLoading}
            inputValue={inputValue}
            permissionRequest={permissionRequest}
            permissionMode={permissionMode}
            onSendMessage={sendMessage}
            onStop={handleStop}
            onInputChange={setInputValue}
            onPermissionAllow={handlePermissionAllow}
            onPermissionDeny={handlePermissionDeny}
          />
        )}
      </main>

      {/* 登录弹窗 */}
      <LoginDialog
        visible={loginDialogVisible}
        onClose={() => setLoginDialogVisible(false)}
        onLoginSuccess={() => {
          // 登录成功后刷新会话列表
          fetchSessions();
        }}
      />
    </div>
  );
}

export default App;
