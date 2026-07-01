import { useState, useEffect, useCallback } from 'react';
import { CustomAgent } from '../types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'customAgents';

// 智能客服系统提示词
const CUSTOMER_SERVICE_SYSTEM_PROMPT = `你是一个专业的智能客服AI助手，你的名字叫"小客"。你需要：

1. **意图识别**：根据用户的问题，自动识别用户意图，并归入以下类别：
   - **退款**：用户想退款、退货、取消订单
   - **查询订单**：用户想查询订单状态、物流、发货、配送
   - **技术支持**：用户遇到App闪退、登录问题、支付失败等技术问题
   - **一般咨询**：其他常规问题

2. **回答规范**：
   - 首先确认用户的意图，简短说明你理解了什么问题
   - 如果问题在知识库中有匹配，给出准确的解答
   - 回答要简洁清晰，使用分点说明（如使用编号列表）
   - 主动提供下一步建议
   - 保持友善专业的语气

3. **转人工判断**：
   - 当用户明确要求转人工时，立即转接
   - 当你无法解决用户问题时，建议转人工
   - 当对话超过多轮仍未解决时，主动建议转人工

4. **注意事项**：
   - 不要编造不存在的信息
   - 涉及金额和账号信息时要格外谨慎
   - 对于无法确认的信息，建议用户联系人工客服核实
   - 每次回答时，在最开头用【意图：xxx】标注你识别到的意图类别`;

// 默认的智能客服 Agent
const DEFAULT_AGENT: CustomAgent = {
  id: 'default',
  name: '智能客服',
  description: 'AI智能客服，自动识别意图，快速解决问题',
  systemPrompt: CUSTOMER_SERVICE_SYSTEM_PROMPT,
  icon: 'HeadsetIcon',
  color: '#0052d9',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// 退款专员 Agent
const REFUND_AGENT: CustomAgent = {
  id: 'refund-specialist',
  name: '退款专员',
  description: '专注处理退款、退货相关事务',
  systemPrompt: `你是一个专业的退款客服专员。你专注于处理退款相关的问题。

你的职责：
1. 帮助用户了解退款政策和流程
2. 指导用户完成退款申请
3. 解决退款过程中遇到的问题
4. 对于复杂退款问题，及时转人工处理

回答时请注意：
- 明确告知退款时限和条件
- 不同支付方式的退款周期不同，要准确说明
- 如果退款被拒绝，帮助用户理解原因并提供后续方案
- 回答开头标注【意图：退款】`,
  icon: 'WalletIcon',
  color: '#e34d59',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// 订单查询 Agent
const ORDER_AGENT: CustomAgent = {
  id: 'order-specialist',
  name: '订单助手',
  description: '专注处理订单查询、物流追踪等事务',
  systemPrompt: `你是一个专业的订单客服助手。你专注于处理订单相关的问题。

你的职责：
1. 帮助用户查询订单状态
2. 解决物流配送相关问题
3. 处理订单修改（地址、规格等）
4. 解决发货延迟等问题

回答时请注意：
- 告知用户具体的查询路径
- 对于延迟发货，给出合理的解释和时间预估
- 如果物流异常，主动建议联系快递公司或转人工
- 回答开头标注【意图：查询订单】`,
  icon: 'SearchIcon',
  color: '#0052d9',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// 技术支持 Agent
const TECH_AGENT: CustomAgent = {
  id: 'tech-specialist',
  name: '技术支持',
  description: '专注解决App使用中的技术问题',
  systemPrompt: `你是一个专业的技术支持工程师。你专注于解决用户在使用App过程中遇到的技术问题。

你的职责：
1. 诊断App闪退、卡顿等使用问题
2. 解决登录、支付等账号相关技术问题
3. 提供清晰的操作步骤指导
4. 收集问题反馈以帮助产品改进

回答时请注意：
- 提供逐步操作的解决方案
- 从最简单的解决方法开始推荐
- 如果问题可能是Bug，建议用户更新到最新版本
- 对于无法解决的技术问题，转人工并记录设备信息
- 回答开头标注【意图：技术支持】`,
  icon: 'HelpCircleIcon',
  color: '#2ba471',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const BUILT_IN_AGENTS: CustomAgent[] = [DEFAULT_AGENT, REFUND_AGENT, ORDER_AGENT, TECH_AGENT];

export function useAgents() {
  const [agents, setAgents] = useState<CustomAgent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return [...BUILT_IN_AGENTS, ...parsed.map((a: any) => ({
          ...a,
          createdAt: new Date(a.createdAt),
          updatedAt: new Date(a.updatedAt),
        }))];
      }
    } catch (e) {
      console.error('Failed to load agents:', e);
    }
    return BUILT_IN_AGENTS;
  });

  // 保存到 localStorage（排除内置 agent）
  const saveAgents = useCallback((newAgents: CustomAgent[]) => {
    const builtInIds = BUILT_IN_AGENTS.map(a => a.id);
    const toSave = newAgents.filter(a => !builtInIds.includes(a.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, []);

  const addAgent = useCallback((agent: Omit<CustomAgent, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newAgent: CustomAgent = {
      ...agent,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setAgents(prev => {
      const updated = [...prev, newAgent];
      saveAgents(updated);
      return updated;
    });
    return newAgent;
  }, [saveAgents]);

  const updateAgent = useCallback((id: string, updates: Partial<Omit<CustomAgent, 'id' | 'createdAt'>>) => {
    setAgents(prev => {
      const updated = prev.map(a => 
        a.id === id ? { ...a, ...updates, updatedAt: new Date() } : a
      );
      saveAgents(updated);
      return updated;
    });
  }, [saveAgents]);

  const deleteAgent = useCallback((id: string) => {
    const builtInIds = BUILT_IN_AGENTS.map(a => a.id);
    if (builtInIds.includes(id)) return; // 不能删除内置 agent
    setAgents(prev => {
      const updated = prev.filter(a => a.id !== id);
      saveAgents(updated);
      return updated;
    });
  }, [saveAgents]);

  const getAgent = useCallback((id: string) => {
    return agents.find(a => a.id === id);
  }, [agents]);

  return {
    agents,
    addAgent,
    updateAgent,
    deleteAgent,
    getAgent,
    defaultAgent: DEFAULT_AGENT,
  };
}
