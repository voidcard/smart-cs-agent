import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Model, Session, PermissionMode, CustomAgent, PermissionRequest } from '../types';
import { NewChatView } from '../components/NewChatView';
import { ChatMessages } from '../components/ChatMessages';
import { ChatInput } from '../components/ChatInput';
import { TechBackground } from '../components/TechBackground';

interface ChatPageProps {
  currentSession: Session | undefined;
  models: Model[];
  selectedModel: string;
  agents: CustomAgent[];
  isLoading: boolean;
  inputValue: string;
  permissionRequest: PermissionRequest | null;
  permissionMode: PermissionMode;
  onSendMessage: (message: string, newChatOptions?: NewChatOptions, onNavigate?: (path: string) => void) => void;
  onStop: () => void;
  onInputChange: (value: string) => void;
  onPermissionAllow: () => void;
  onPermissionDeny: () => void;
}

interface NewChatOptions {
  agentId: string;
  cwd: string;
  permissionMode: PermissionMode;
}

export function ChatPage({
  currentSession,
  models,
  selectedModel,
  agents,
  isLoading,
  inputValue,
  permissionRequest,
  permissionMode,
  onSendMessage,
  onStop,
  onInputChange,
  onPermissionAllow,
  onPermissionDeny,
}: ChatPageProps) {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [newChatAgentId, setNewChatAgentId] = useState('default');
  const [isTransferredToHuman, setIsTransferredToHuman] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  const handleSend = useCallback((message: string) => {
    if (!currentSession) {
      onSendMessage(message, {
        agentId: newChatAgentId,
        cwd: '',
        permissionMode,
      }, (path) => {
        setNewChatAgentId('default');
        navigate(path);
      });
    } else {
      onSendMessage(message);
    }
  }, [currentSession, newChatAgentId, permissionMode, onSendMessage, navigate]);

  const handleQuickQuestion = useCallback((text: string, _intent: string) => {
    handleSend(text);
  }, [handleSend]);

  const showNewChatView = !currentSession || currentSession.messages.length === 0;

  return (
    <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
      <TechBackground variant={showNewChatView ? 'full' : 'subtle'} />

      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin">
          {showNewChatView ? (
            <NewChatView
              agents={agents}
              newChatAgentId={newChatAgentId}
              onSelectAgent={setNewChatAgentId}
              onQuickQuestion={handleQuickQuestion}
            />
          ) : (
            <div className="max-w-3xl mx-auto">
              <ChatMessages
                messages={currentSession!.messages}
                models={models}
                messagesEndRef={messagesEndRef}
                currentSessionId={currentSession!.id}
                isTransferredToHuman={isTransferredToHuman}
                permissionRequest={permissionRequest}
                onPermissionAllow={onPermissionAllow}
                onPermissionDeny={onPermissionDeny}
              />
            </div>
          )}
        </div>

        <ChatInput
          inputValue={inputValue}
          selectedModel={selectedModel}
          isLoading={isLoading}
          onSend={handleSend}
          onStop={onStop}
          onChange={onInputChange}
        />
      </div>
    </div>
  );
}
