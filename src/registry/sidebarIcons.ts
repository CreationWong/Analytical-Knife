import {
    IconLayoutDashboard, IconWorld, IconTerminal2, IconWand, IconCode, IconTrophy, IconTools, IconLockCode, IconKey,
} from '@tabler/icons-react';

// 定义图标组件类型
type IconComponent = React.ComponentType<{ size?: string | number; stroke?: number }>;

// 路径段名称 → 图标组件 的映射表
export const PARENT_ICONS: Record<string, IconComponent> = {
    '编码处理':IconLockCode,

    '密码分析':IconKey,
    'RSA':IconKey,

    // 网络 & API
    '网络工具': IconWorld,
    'API 调试': IconTerminal2,

    // 生成器
    '生成器': IconWand,
    'Payload': IconCode,

    // CTF
    'CTF': IconTrophy,
    '辅助': IconTools,

};

// 默认 fallback 图标
export const DEFAULT_PARENT_ICON: IconComponent = IconLayoutDashboard;