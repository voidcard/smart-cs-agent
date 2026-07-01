import React, { useState } from 'react';
import { Button, Input, Dialog, Form, MessagePlugin } from 'tdesign-react';
import { useUser } from '../hooks/useUser';

interface LoginDialogProps {
  visible: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export function LoginDialog({ visible, onClose, onLoginSuccess }: LoginDialogProps) {
  const { login, register, isLoading } = useUser();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async () => {
    if (!phone.trim()) {
      MessagePlugin.warning('请输入手机号');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      MessagePlugin.warning('请输入姓名');
      return;
    }

    let result: any;
    if (mode === 'login') {
      result = await login(phone);
    } else {
      result = await register(name, phone, email);
    }

    if (result?.success) {
      MessagePlugin.success(mode === 'login' ? '登录成功！' : '注册成功！');
      onLoginSuccess();
      onClose();
      setPhone('');
      setName('');
      setEmail('');
    } else {
      if (mode === 'login' && result?.error?.includes('不存在')) {
        MessagePlugin.warning('该手机号未注册，请先注册');
        setMode('register');
      } else {
        MessagePlugin.error(result?.error || '操作失败');
      }
    }
  };

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      onCloseBtnClick={onClose}
      onClosed={onClose}
      footer={false}
      width={420}
      showOverlay={true}
      preventScrollThrough={true}
      placement="center"
    >
      <div style={{ padding: '8px 0', textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'linear-gradient(135deg, #0052d9, #2ba471)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 700, color: '#fff',
          margin: '0 auto 16px',
        }}>
          客
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>
          智能客服
        </h2>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
          {mode === 'login' ? '登录后可查询订单、退款等个人业务' : '注册账号以便客服为您提供个性化服务'}
        </p>

        <Form layout="vertical">
          {mode === 'register' && (
            <Form.FormItem label="姓名">
              <Input
                value={name}
                onChange={(val) => setName(String(val))}
                placeholder="请输入您的姓名"
                clearable
              />
            </Form.FormItem>
          )}

          <Form.FormItem label="手机号">
            <Input
              value={phone}
              onChange={(val) => setPhone(String(val))}
              placeholder="请输入手机号"
              clearable
              maxlength={11}
            />
          </Form.FormItem>

          {mode === 'register' && (
            <Form.FormItem label="邮箱（可选）">
              <Input
                value={email}
                onChange={(val) => setEmail(String(val))}
                placeholder="请输入邮箱"
                clearable
              />
            </Form.FormItem>
          )}

          <Button
            theme="primary"
            block
            loading={isLoading}
            onClick={handleSubmit}
            style={{ marginTop: 8, height: 40, borderRadius: 8 }}
          >
            {mode === 'login' ? '登录' : '注册'}
          </Button>
        </Form>

        <div style={{ marginTop: 16, fontSize: 13, color: '#888' }}>
          {mode === 'login' ? (
            <>
              还没有账号？
              <span
                style={{ color: '#0052d9', cursor: 'pointer', marginLeft: 4 }}
                onClick={() => setMode('register')}
              >
                立即注册
              </span>
            </>
          ) : (
            <>
              已有账号？
              <span
                style={{ color: '#0052d9', cursor: 'pointer', marginLeft: 4 }}
                onClick={() => setMode('login')}
              >
                返回登录
              </span>
            </>
          )}
        </div>

        <div
          style={{ marginTop: 12, fontSize: 12, color: '#aaa', cursor: 'pointer' }}
          onClick={onClose}
        >
          暂不登录，使用匿名模式
        </div>
      </div>
    </Dialog>
  );
}
