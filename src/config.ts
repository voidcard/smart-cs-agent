/**
 * 应用配置文件
 * 统一管理应用名称和其他全局配置
 */

export const APP_CONFIG = {
  /** 应用名称 */
  name: '智能客服',
  
  /** 应用名称首字母（用于 Logo） */
  nameInitial: '客',
  
  /** 应用描述 */
  description: 'AI 智能客服，自动识别意图，快速解决问题',
  
  /** 版本号 */
  version: '1.0.0',

  /** 意图类型 */
  intents: [
    { id: 'refund', name: '退款', color: '#e34d59', icon: 'WalletIcon' },
    { id: 'order_query', name: '查询订单', color: '#0052d9', icon: 'SearchIcon' },
    { id: 'tech_support', name: '技术支持', color: '#2ba471', icon: 'HelpCircleIcon' },
    { id: 'general', name: '一般咨询', color: '#ed7b2f', icon: 'ChatIcon' },
  ] as const,
};

export default APP_CONFIG;
