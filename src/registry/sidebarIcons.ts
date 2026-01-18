import {
    IconWorld, IconTerminal2, IconWand, IconCode, IconTrophy, IconTools, IconLockCode, IconKey,
    IconBug, IconSettings, IconJoker, IconLanguage, IconBulb,
} from '@tabler/icons-react';
import React from "react";

// 定义图标组件类型
type IconComponent = React.ComponentType<{ size?: string | number; stroke?: number }>;

// 路径段名称 → 图标组件 的映射表
export const PARENT_ICONS: Record<string, IconComponent> = {
    '设置': IconSettings,

    '想法': IconBulb,

    '编码处理': IconLockCode,
    'Base': IconKey,
    '特殊编码': IconJoker,

    '密码学': IconKey,
    'Text': IconLanguage,
    'RSA': IconKey,

    // 网络 & API
    '网络工具': IconWorld,
    'API': IconTerminal2,

    // 生成器
    '生成器': IconWand,
    'Payload': IconCode,
    '漏洞测试': IconBug,

    // CTF
    'CTF': IconTrophy,
    '辅助': IconTools,

};