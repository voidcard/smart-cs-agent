/**
 * FAQ 知识库数据
 * 包含退款、查询订单、技术支持等常见问题
 */

import { FAQItem, IntentType } from './types';

export const FAQ_DATABASE: FAQItem[] = [
  // ===== 退款相关 =====
  {
    id: 'refund-001',
    category: 'refund',
    question: '如何申请退款？',
    answer: '您可以通过以下步骤申请退款：\n1. 进入"我的订单"页面\n2. 找到需要退款的订单\n3. 点击"申请退款"按钮\n4. 选择退款原因并提交\n\n退款审核通常在1-3个工作日内完成，审核通过后退款将原路返回至您的支付账户。',
    keywords: ['退款', '退钱', '退货', '申请退款', '如何退款', '退款流程'],
  },
  {
    id: 'refund-002',
    category: 'refund',
    question: '退款多久到账？',
    answer: '退款到账时间取决于您的支付方式：\n- 支付宝：1-3个工作日\n- 微信支付：1-3个工作日\n- 银行卡：3-7个工作日\n- 信用卡：7-15个工作日\n\n如果超过上述时间仍未到账，请联系我们的客服人员协助查询。',
    keywords: ['退款到账', '退款时间', '多久到账', '退款多久', '退款周期'],
  },
  {
    id: 'refund-003',
    category: 'refund',
    question: '退款被拒绝了怎么办？',
    answer: '如果您的退款申请被拒绝，可能的原因包括：\n1. 超过了退款期限（购买后15天内）\n2. 商品已经使用或损坏\n3. 缺少退款所需的凭证\n\n您可以：\n- 重新提交退款申请并补充相关凭证\n- 联系人工客服进行申诉\n- 拨打客服热线 400-xxx-xxxx',
    keywords: ['退款拒绝', '退款失败', '退款被拒', '不能退款', '无法退款'],
  },
  {
    id: 'refund-004',
    category: 'refund',
    question: '部分退款可以吗？',
    answer: '支持部分退款的情况：\n1. 订单中包含多件商品时，可以对单件商品申请退款\n2. 套餐订单中，可以对部分项目申请退款\n\n不支持部分退款的情况：\n1. 单件商品不支持部分退款\n2. 促销活动商品（如买一送一）需整单退换\n\n如需帮助，请联系人工客服。',
    keywords: ['部分退款', '退一部分', '只退一个', '部分退货'],
  },

  // ===== 查询订单相关 =====
  {
    id: 'order-001',
    category: 'order_query',
    question: '如何查询我的订单？',
    answer: '查询订单的方式：\n1. **App查询**：打开App → "我的" → "我的订单"\n2. **网站查询**：登录官网 → 个人中心 → 订单管理\n3. **短信查询**：发送"CX+订单号"到服务号\n\n如果您记得订单号，也可以直接输入订单号进行精确查询。',
    keywords: ['查询订单', '看订单', '我的订单', '订单在哪', '怎么查订单', '订单查询'],
  },
  {
    id: 'order-002',
    category: 'order_query',
    question: '订单一直没发货怎么办？',
    answer: '如果您的订单长时间未发货，请按以下步骤处理：\n1. 首先确认订单状态是否为"待发货"\n2. 查看商品详情页是否有预计发货时间\n3. 如果超过预计发货时间仍未发货：\n   - 可联系在线客服催促\n   - 可申请取消订单并退款\n\n注意：预售商品和定制商品发货时间较长，请以商品详情页标注的时间为准。',
    keywords: ['不发货', '没发货', '一直不发货', '发货慢', '迟迟不发货'],
  },
  {
    id: 'order-003',
    category: 'order_query',
    question: '如何修改收货地址？',
    answer: '修改收货地址的规则：\n- **未发货**：可以在订单详情页直接修改\n- **已发货**：无法修改，建议联系快递公司转寄\n- **待付款**：取消订单重新下单\n\n修改路径：我的订单 → 订单详情 → 修改收货地址',
    keywords: ['修改地址', '改地址', '换地址', '收货地址', '改收货地址'],
  },
  {
    id: 'order-004',
    category: 'order_query',
    question: '物流信息怎么看？',
    answer: '查看物流信息：\n1. 进入"我的订单" → 点击对应订单\n2. 在订单详情页点击"查看物流"\n3. 系统会显示实时物流追踪信息\n\n如果物流信息长时间未更新（超过48小时），可能是以下原因：\n- 快递信息尚未同步\n- 物流高峰期更新延迟\n- 包裹正在中转中\n\n如需帮助，可联系人工客服查询。',
    keywords: ['物流', '快递', '物流信息', '快递查询', '到哪了', '配送'],
  },

  // ===== 技术支持相关 =====
  {
    id: 'tech-001',
    category: 'tech_support',
    question: 'App闪退/无法打开怎么办？',
    answer: 'App闪退或无法打开的解决方案：\n1. **重启App**：完全关闭App后重新打开\n2. **清理缓存**：手机设置 → 应用管理 → 清除缓存\n3. **更新App**：检查应用商店是否有新版本\n4. **重启手机**：尝试重启手机后再打开\n5. **重装App**：卸载后重新安装\n\n如果以上方法均无效，请告知我们您的手机型号和系统版本，我们将尽快修复。',
    keywords: ['闪退', '打不开', '崩溃', '无法打开', '卡顿', '闪退怎么办'],
  },
  {
    id: 'tech-002',
    category: 'tech_support',
    question: '登录不了账号怎么办？',
    answer: '账号登录问题排查：\n1. **忘记密码**：点击"忘记密码" → 通过手机号/邮箱重置\n2. **验证码收不到**：检查手机短信拦截设置，或等待60秒后重试\n3. **账号被锁定**：连续5次输入错误密码后锁定30分钟\n4. **网络问题**：切换WiFi/移动数据后重试\n\n如果仍然无法登录，请联系人工客服验证身份后协助处理。',
    keywords: ['登录不了', '无法登录', '登不上', '密码错误', '验证码', '账号锁定'],
  },
  {
    id: 'tech-003',
    category: 'tech_support',
    question: '支付失败怎么办？',
    answer: '支付失败的常见原因和解决方法：\n1. **余额不足**：请检查支付账户余额\n2. **网络超时**：切换网络后重试\n3. **银行卡限额**：联系银行提高支付限额或更换银行卡\n4. **支付系统维护**：等待10分钟后重试\n5. **订单已过期**：重新下单\n\n注意：如果扣款但订单未生成，款项将在1-3个工作日内自动退回。',
    keywords: ['支付失败', '付款失败', '无法支付', '付不了', '支付问题'],
  },
  {
    id: 'tech-004',
    category: 'tech_support',
    question: '如何绑定/解绑手机号？',
    answer: '手机号绑定/解绑操作：\n\n**绑定手机号**：\n设置 → 账号安全 → 绑定手机 → 输入手机号 → 验证\n\n**解绑手机号**：\n设置 → 账号安全 → 手机管理 → 解绑 → 身份验证\n\n注意：\n- 每个手机号只能绑定一个账号\n- 解绑后需绑定新手机号才能正常使用\n- 如无法收到验证码，请联系人工客服',
    keywords: ['绑定手机', '解绑手机', '换手机号', '修改手机号', '手机号'],
  },

  // ===== 一般咨询 =====
  {
    id: 'general-001',
    category: 'general',
    question: '客服工作时间是什么？',
    answer: '我们的客服服务时间：\n- **在线客服**：7×24小时全天候服务\n- **电话客服**：工作日 9:00-21:00\n- **邮件客服**：24小时内回复\n\n紧急问题建议使用在线客服，我们会优先处理。',
    keywords: ['客服时间', '上班时间', '工作时间', '几点上班'],
  },
  {
    id: 'general-002',
    category: 'general',
    question: '如何投诉或建议？',
    answer: '我们非常重视您的反馈：\n\n**投诉渠道**：\n1. App内：我的 → 帮助与反馈 → 投诉建议\n2. 电话：400-xxx-xxxx（工作日 9:00-21:00）\n3. 邮箱：feedback@example.com\n\n**处理时效**：\n- 一般投诉：3个工作日内回复\n- 紧急投诉：24小时内回复\n\n感谢您帮助我们改进服务！',
    keywords: ['投诉', '建议', '反馈', '意见', '不满', '举报'],
  },
];

/** 意图关键词映射 */
export const INTENT_KEYWORDS: Record<IntentType, string[]> = {
  refund: ['退款', '退钱', '退货', '退款申请', '退款流程', '退款到账', '退款时间', '退款拒绝', '退一部分', '不想买了', '取消订单', '取消购买'],
  order_query: ['订单', '查询', '物流', '快递', '发货', '配送', '收货', '地址', '到哪了', '多久到', '订单号', '运单'],
  tech_support: ['闪退', '打不开', '崩溃', '登录不了', '支付失败', '验证码', '绑定', '解绑', '卡顿', '加载慢', '报错', '出错', 'bug', '故障'],
  general: ['客服', '投诉', '建议', '工作时间', '联系方式', '帮助', '怎么联系'],
};

/**
 * 根据用户消息识别意图
 */
export function detectIntent(message: string): IntentType {
  const lowerMessage = message.toLowerCase();
  
  let bestIntent: IntentType = 'general';
  let bestScore = 0;

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        score += keyword.length; // 匹配的关键词越长，权重越高
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent as IntentType;
    }
  }

  return bestIntent;
}

/**
 * 根据 FAQ 知识库检索相关答案
 */
export function searchFAQ(message: string, intent?: IntentType): FAQItem[] {
  const lowerMessage = message.toLowerCase();
  let results = FAQ_DATABASE;

  // 先按意图过滤
  if (intent && intent !== 'general') {
    results = results.filter(faq => faq.category === intent);
  }

  // 计算每个FAQ的匹配分数
  const scored = results.map(faq => {
    let score = 0;
    
    // 关键词匹配
    for (const keyword of faq.keywords) {
      if (lowerMessage.includes(keyword)) {
        score += keyword.length * 2;
      }
    }
    
    // 问题文本匹配
    for (const char of lowerMessage) {
      if (faq.question.includes(char)) {
        score += 0.5;
      }
    }
    
    return { faq, score };
  });

  // 返回匹配分数最高的3个
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.faq);
}

/**
 * 判断是否需要转人工
 */
export function shouldTransferToHuman(message: string, conversationLength: number): boolean {
  const transferKeywords = ['转人工', '人工客服', '真人', '不要机器人', '不想和机器人说话', '投诉', '我要投诉', '经理', '主管'];
  const lowerMessage = message.toLowerCase();
  
  // 直接要求转人工
  if (transferKeywords.some(kw => lowerMessage.includes(kw))) {
    return true;
  }
  
  // 对话轮次过多（超过10轮还未解决）
  if (conversationLength > 10) {
    return true;
  }
  
  return false;
}
