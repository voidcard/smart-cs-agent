import { useState, useEffect, useCallback } from 'react';
import { Card, Tag, Table, Select, Button, Tabs, Rate, Row, Col, MessagePlugin } from 'tdesign-react';
import { UserIcon, CheckCircleIcon, SwapIcon, StarFilledIcon, ChatIcon } from 'tdesign-icons-react';
import { AdminStats } from '../types';

interface SessionRecord {
  id: string;
  title: string;
  intent: string;
  is_transferred_to_human: number;
  satisfaction_rating: number | null;
  created_at: string;
  messageCount: number;
}

export function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [page, setPage] = useState(1);
  const [filterIntent, setFilterIntent] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  // 加载统计数据
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  // 加载会话列表
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        intent: filterIntent,
        page: page.toString(),
        pageSize: '20',
      });
      const response = await fetch(`/api/admin/sessions?${params}`);
      const data = await response.json();
      setSessions(data.sessions || []);
      setTotalSessions(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [filterIntent, page]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // 意图名称映射
  const getIntentLabel = (intent: string) => {
    const map: Record<string, string> = {
      refund: '退款', order_query: '查询订单', tech_support: '技术支持', general: '一般咨询'
    };
    return map[intent] || intent;
  };

  const getIntentColor = (intent: string) => {
    const map: Record<string, string> = {
      refund: '#e34d59', order_query: '#0052d9', tech_support: '#2ba471', general: '#ed7b2f'
    };
    return map[intent] || '#8c8c8c';
  };

  // 表格列定义
  const columns = [
    {
      colKey: 'title',
      title: '对话标题',
      width: 200,
      ellipsis: true,
    },
    {
      colKey: 'intent',
      title: '意图分类',
      width: 120,
      render: ({ row }: { row: SessionRecord }) => (
        <Tag 
          theme="primary"
          style={{ 
            backgroundColor: getIntentColor(row.intent) + '15', 
            color: getIntentColor(row.intent),
            borderColor: getIntentColor(row.intent) + '40'
          }}
        >
          {getIntentLabel(row.intent)}
        </Tag>
      ),
    },
    {
      colKey: 'is_transferred_to_human',
      title: '转人工',
      width: 90,
      render: ({ row }: { row: SessionRecord }) => (
        row.is_transferred_to_human ? 
          <Tag theme="warning" variant="light">已转人工</Tag> : 
          <Tag theme="success" variant="light">AI解决</Tag>
      ),
    },
    {
      colKey: 'satisfaction_rating',
      title: '满意度',
      width: 160,
      render: ({ row }: { row: SessionRecord }) => (
        row.satisfaction_rating ? 
          <Rate value={row.satisfaction_rating} size="small" /> : 
          <span style={{ color: 'var(--td-text-color-placeholder)' }}>未评价</span>
      ),
    },
    {
      colKey: 'messageCount',
      title: '消息数',
      width: 80,
    },
    {
      colKey: 'created_at',
      title: '创建时间',
      width: 180,
      render: ({ row }: { row: SessionRecord }) => (
        <span style={{ fontSize: '13px', color: 'var(--td-text-color-secondary)' }}>
          {new Date(row.created_at).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      colKey: 'action',
      title: '操作',
      width: 80,
      render: ({ row }: { row: SessionRecord }) => (
        <Button variant="text" theme="primary" size="small"
          onClick={() => window.open(`/chat/${row.id}`, '_blank')}
        >
          查看详情
        </Button>
      ),
    },
  ];

  // 简单的柱状图（CSS实现）
  const renderBarChart = () => {
    if (!stats?.dailyStats) return null;
    const maxSessions = Math.max(...stats.dailyStats.map(d => d.sessions), 1);
    
    return (
      <div className="flex items-end gap-3 h-48 px-2">
        {stats.dailyStats.map((day, index) => (
          <div key={index} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col items-center justify-end" style={{ height: '160px' }}>
              <span className="text-xs mb-1" style={{ color: 'var(--td-text-color-secondary)' }}>
                {day.sessions}
              </span>
              <div 
                className="w-full rounded-t-md transition-all duration-500"
                style={{ 
                  height: `${(day.sessions / maxSessions) * 140}px`,
                  backgroundColor: 'var(--td-brand-color)',
                  minHeight: day.sessions > 0 ? '4px' : '0px'
                }}
              />
            </div>
            <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
              {day.date.slice(5)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // 满意度分布图
  const renderSatisfactionChart = () => {
    if (!stats?.satisfactionDistribution) return null;
    const dist = stats.satisfactionDistribution;
    const total = Object.values(dist).reduce((a: number, b: number) => a + b, 0) || 1;
    
    return (
      <div className="flex flex-col gap-3">
        {[5, 4, 3, 2, 1].map(star => {
          const count = dist[star] || 0;
          return (
            <div key={star} className="flex items-center gap-3">
              <div className="flex items-center gap-1 w-16">
                <StarFilledIcon size="14px" style={{ color: '#ED7B2F' }} />
                <span className="text-sm">{star}星</span>
              </div>
              <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--td-bg-color-component)' }}>
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${(count / total) * 100}%`,
                    backgroundColor: star >= 4 ? '#2ba471' : star === 3 ? '#ed7b2f' : '#e34d59'
                  }}
                />
              </div>
              <span className="text-sm w-12 text-right" style={{ color: 'var(--td-text-color-secondary)' }}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-1" style={{ color: 'var(--td-text-color-primary)' }}>
            管理后台
          </h2>
          <p style={{ color: 'var(--td-text-color-secondary)' }}>
            查看对话记录、满意度统计和运营数据
          </p>
        </div>

        {/* 统计卡片 */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col span={3}>
            <Card bordered={false}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(59,130,246,0.1)' }}>
                  <ChatIcon style={{ color: '#3b82f6' }} />
                </div>
                <div>
                  <div className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>总会话数</div>
                  <div className="text-xl font-semibold" style={{ color: '#3b82f6' }}>{stats?.totalSessions || 0}</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={3}>
            <Card bordered={false}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(237,123,47,0.1)' }}>
                  <StarFilledIcon style={{ color: '#ED7B2F' }} />
                </div>
                <div>
                  <div className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>平均满意度</div>
                  <div className="text-xl font-semibold" style={{ color: '#ED7B2F' }}>{stats?.avgSatisfaction || 0} <span className="text-sm font-normal">/ 5</span></div>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={3}>
            <Card bordered={false}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(43,164,113,0.1)' }}>
                  <CheckCircleIcon style={{ color: '#2ba471' }} />
                </div>
                <div>
                  <div className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>AI解决率</div>
                  <div className="text-xl font-semibold" style={{ color: '#2ba471' }}>{stats?.resolutionRate || 0}%</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={3}>
            <Card bordered={false}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(227,77,89,0.1)' }}>
                  <SwapIcon style={{ color: '#e34d59' }} />
                </div>
                <div>
                  <div className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>转人工率</div>
                  <div className="text-xl font-semibold" style={{ color: '#e34d59' }}>{stats?.transferRate || 0}%</div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* 图表区域 */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col span={6}>
            <Card title="意图分布" bordered={false}>
              {stats?.intentDistribution && (
                <div className="flex flex-col gap-4 py-2">
                  {Object.entries(stats.intentDistribution).map(([intent, count]) => (
                    <div key={intent} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getIntentColor(intent) }}
                        />
                        <span className="text-sm">{getIntentLabel(intent)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: getIntentColor(intent) }}>
                          {count as number}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
                          ({stats.totalSessions > 0 ? Math.round(((count as number) / stats.totalSessions) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>
          <Col span={6}>
            <Card title="近7天会话趋势" bordered={false}>
              {renderBarChart()}
            </Card>
          </Col>
          <Col span={6}>
            <Card title="满意度分布" bordered={false}>
              {renderSatisfactionChart()}
            </Card>
          </Col>
        </Row>

        {/* 对话记录列表 */}
        <Card title="对话记录" bordered={false}>
          <div className="mb-4 flex items-center gap-4">
            <Select
              value={filterIntent}
              onChange={(v) => { setFilterIntent(v as string); setPage(1); }}
              style={{ width: 160 }}
              clearable
              placeholder="筛选意图"
            >
              <Select.Option value="all" label="全部意图" />
              <Select.Option value="refund" label="退款" />
              <Select.Option value="order_query" label="查询订单" />
              <Select.Option value="tech_support" label="技术支持" />
              <Select.Option value="general" label="一般咨询" />
            </Select>
            <Button variant="outline" onClick={() => { fetchStats(); fetchSessions(); }}>
              刷新数据
            </Button>
            <span className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
              共 {totalSessions} 条记录
            </span>
          </div>

          <Table
            data={sessions}
            columns={columns}
            loading={loading}
            rowKey="id"
            size="medium"
            pagination={{
              current: page,
              pageSize: 20,
              total: totalSessions,
              onChange: (pageInfo: any) => setPage(pageInfo.current),
            }}
            style={{ minHeight: '300px' }}
            empty="暂无对话记录"
          />
        </Card>
      </div>
    </div>
  );
}
