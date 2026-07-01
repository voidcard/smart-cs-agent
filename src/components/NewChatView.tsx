import { useState } from 'react';
import {
  Bot,
  ChevronRight,
  ChevronDown,
  Headphones,
  Package,
  RotateCcw,
  Wrench,
  MessageCircle,
  Sparkles,
  Zap,
  Shield,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { APP_CONFIG } from '../config';
import { Agent } from '../types';
import { ICON_MAP } from '../utils/iconMap';

interface NewChatViewProps {
  agents: Agent[];
  newChatAgentId: string;
  onSelectAgent: (agentId: string) => void;
  onQuickQuestion?: (text: string, intent: string) => void;
}

const HELP_TOPICS = [
  {
    id: 'order_query',
    title: '订单与物流',
    desc: '查订单、看物流、改地址',
    icon: Package,
    accent: '#3b82f6',
    questions: ['查询我的订单', '物流信息怎么看？'],
  },
  {
    id: 'refund',
    title: '退款与售后',
    desc: '申请退款、到账时间',
    icon: RotateCcw,
    accent: '#f43f5e',
    questions: ['如何申请退款？', '退款多久到账？'],
  },
  {
    id: 'tech_support',
    title: '账户与技术',
    desc: '登录、App、支付问题',
    icon: Wrench,
    accent: '#10b981',
    questions: ['App闪退怎么办？', '登录不了账号'],
  },
  {
    id: 'general',
    title: '其他帮助',
    desc: '工作时间、转人工',
    icon: MessageCircle,
    accent: '#8b5cf6',
    questions: ['客服工作时间', '转接人工客服'],
  },
] as const;

const POPULAR_QUESTIONS = [
  { text: '如何申请退款？', intent: 'refund' },
  { text: '查询我的订单', intent: 'order_query' },
  { text: '物流信息怎么看？', intent: 'order_query' },
  { text: '退款多久到账？', intent: 'refund' },
  { text: '转接人工客服', intent: 'general' },
];

const TRUST_ITEMS = [
  { icon: Zap, label: 'AI 秒级响应' },
  { icon: Clock, label: '7×24 在线' },
  { icon: Shield, label: '安全加密' },
];

export function NewChatView({
  agents,
  newChatAgentId,
  onSelectAgent,
  onQuickQuestion,
}: NewChatViewProps) {
  const [agentExpanded, setAgentExpanded] = useState(false);
  const selectedAgent = agents.find(a => a.id === newChatAgentId);

  const handleQuestion = (text: string, intent: string) => {
    onQuickQuestion?.(text, intent);
  };

  return (
    <div className="premium-welcome">
      <div className="premium-welcome__inner">
        {/* Hero */}
        <header className="premium-hero reveal-up">
          <div className="premium-hero__visual">
            <div className="premium-hero__ring premium-hero__ring--outer" />
            <div className="premium-hero__ring premium-hero__ring--inner" />
            <div className="premium-hero__avatar">
              <Headphones size={32} strokeWidth={1.5} />
            </div>
            <div className="premium-hero__badge">
              <Sparkles size={12} />
              <span>AI</span>
            </div>
          </div>
          <div className="premium-hero__content">
            <p className="premium-hero__eyebrow">
              <span className="premium-hero__dot" />
              {APP_CONFIG.name} · 智能在线
            </p>
            <h1 className="premium-hero__title">
              您好，需要什么
              <span className="premium-hero__title-accent">帮助？</span>
            </h1>
            <p className="premium-hero__desc">
              我是 AI 客服「小客」，订单、退款、物流一站解答。选择下方主题，或直接输入您的问题。
            </p>
          </div>
        </header>

        {/* 信任指标 */}
        <div className="premium-stats reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
          {TRUST_ITEMS.map(({ icon: Icon, label }) => (
            <div key={label} className="premium-stat">
              <div className="premium-stat__icon">
                <Icon size={15} strokeWidth={2} />
              </div>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* 主题卡片 */}
        <section className="premium-section reveal-up" style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
          <div className="premium-section__head">
            <h2 className="premium-section__title">服务主题</h2>
            <span className="premium-section__hint">点击即可开始咨询</span>
          </div>
          <div className="premium-topics">
            {HELP_TOPICS.map((topic, i) => {
              const Icon = topic.icon;
              return (
                <article
                  key={topic.id}
                  className="premium-topic reveal-up"
                  style={{
                    '--topic-accent': topic.accent,
                    '--reveal-delay': `${160 + i * 60}ms`,
                  } as React.CSSProperties}
                >
                  <div className="premium-topic__glow" />
                  <div className="premium-topic__head">
                    <div className="premium-topic__icon">
                      <Icon size={22} strokeWidth={1.75} />
                    </div>
                    <div>
                      <h3>{topic.title}</h3>
                      <p>{topic.desc}</p>
                    </div>
                  </div>
                  <div className="premium-topic__links">
                    {topic.questions.map(q => (
                      <button
                        key={q}
                        type="button"
                        className="premium-topic__link"
                        onClick={() => handleQuestion(q, topic.id)}
                      >
                        <span>{q}</span>
                        <ArrowRight size={14} className="premium-topic__link-arrow" />
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* 热门问题 chips */}
        <section className="premium-section reveal-up" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
          <div className="premium-section__head">
            <h2 className="premium-section__title">热门问题</h2>
          </div>
          <div className="premium-chips">
            {POPULAR_QUESTIONS.map((q, i) => (
              <button
                key={q.text}
                type="button"
                className="premium-chip reveal-up"
                style={{ '--reveal-delay': `${240 + i * 40}ms` } as React.CSSProperties}
                onClick={() => handleQuestion(q.text, q.intent)}
              >
                <span>{q.text}</span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
        </section>

        {/* 客服专员 */}
        <section className="premium-agent reveal-up" style={{ '--reveal-delay': '280ms' } as React.CSSProperties}>
          <button
            type="button"
            className="premium-agent__toggle"
            onClick={() => setAgentExpanded(v => !v)}
            aria-expanded={agentExpanded}
          >
            <div className="premium-agent__toggle-left">
              {selectedAgent && (() => {
                const AgentIcon = ICON_MAP[selectedAgent.icon || 'Bot'] || Bot;
                return (
                  <div
                    className="premium-agent__avatar"
                    style={{ '--agent-color': selectedAgent.color || '#3b82f6' } as React.CSSProperties}
                  >
                    <AgentIcon size={14} color="white" />
                  </div>
                );
              })()}
              <div className="premium-agent__toggle-text">
                <span className="premium-agent__label">专属客服</span>
                <strong>{selectedAgent?.name || '通用助手'}</strong>
              </div>
            </div>
            <ChevronDown
              size={18}
              className={`premium-agent__chevron ${agentExpanded ? 'premium-agent__chevron--open' : ''}`}
            />
          </button>

          <div className={`premium-agent__panel ${agentExpanded ? 'premium-agent__panel--open' : ''}`}>
            <div className="premium-agent__panel-inner">
              <p className="premium-agent__hint">选择不同专长的 AI 客服助手</p>
              <div className="premium-agent__grid">
                {agents.map(agent => {
                  const AgentIcon = ICON_MAP[agent.icon || 'Bot'] || Bot;
                  const isSelected = agent.id === newChatAgentId;
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      className={`premium-agent__card ${isSelected ? 'premium-agent__card--active' : ''}`}
                      style={{ '--agent-color': agent.color || '#3b82f6' } as React.CSSProperties}
                      onClick={() => onSelectAgent(agent.id)}
                    >
                      <div className="premium-agent__card-icon">
                        <AgentIcon size={18} color="white" />
                      </div>
                      <div className="premium-agent__card-text">
                        <span>{agent.name}</span>
                        {agent.description && <small>{agent.description}</small>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
