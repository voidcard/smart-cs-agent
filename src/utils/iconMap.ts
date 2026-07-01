import { 
  Bot, 
  Code, 
  Globe,
  Sparkles,
  FileText,
  Lightbulb,
  Headphones,
  Wallet,
  Search,
  HelpCircle,
  MessageCircle,
  UserCheck,
  Settings,
  Shield,
  Zap,
} from 'lucide-react';

// Icon 映射 - 使用 any 类型以兼容 lucide-react 的类型定义
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ICON_MAP: Record<string, any> = {
  Bot,
  Sparkles,
  Code,
  FileText,
  Globe,
  Lightbulb,
  HeadsetIcon: Headphones,
  WalletIcon: Wallet,
  SearchIcon: Search,
  HelpCircleIcon: HelpCircle,
  ChatIcon: MessageCircle,
  UserCheckIcon: UserCheck,
  SettingsIcon: Settings,
  ShieldIcon: Shield,
  ZapIcon: Zap,
  // 兼容旧名
  Headphones,
  Wallet,
  Search,
  HelpCircle,
  MessageCircle,
};
