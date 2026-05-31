import {
    IconWorld, IconTerminal2, IconWand, IconCode, IconTrophy, IconTools, IconLockCode, IconKey,
    IconBug, IconSettings, IconJoker, IconLanguage, IconBulb, IconPhoto, IconPhotoQuestion, IconSearch, IconVideo,
    IconWaveSine, IconLayoutDashboard, IconFileAnalytics, IconInfoCircle, IconGhost,
} from '@tabler/icons-react';
import React from "react";

// 定义图标组件类型
export type IconComponent = React.ComponentType<{ size?: string | number; stroke?: number }>;

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
    'Images': IconPhoto,
    '隐写': IconPhotoQuestion,
    '网络工具': IconWorld,
    '网络': IconWorld,
    'API': IconTerminal2,
    '生成器': IconWand,
    'Payload': IconCode,
    '漏洞测试': IconBug,
    'CTF': IconTrophy,
    '辅助': IconTools,
    '分析': IconSearch,
    'Videos': IconVideo,
    'Audios': IconWaveSine,
    '第三方插件': IconTools,
    '插件': IconTools,
};

export const CUSTOM_PLUGIN_ICONS: Record<string, IconComponent> = {
    IconCode,
    IconTools,
    IconTerminal2,
    IconWorld,
    IconPhoto,
    IconVideo,
    IconWaveSine,
    IconKey,
    IconLockCode,
    IconSearch,
    IconBug,
    IconBulb,
    IconLayoutDashboard,
    IconFileAnalytics,
    IconInfoCircle,
    IconGhost,
};

export const CUSTOM_PLUGIN_ICON_OPTIONS = [
    { value: 'IconCode', label: '代码' },
    { value: 'IconTools', label: '工具' },
    { value: 'IconTerminal2', label: '终端' },
    { value: 'IconWorld', label: '网络' },
    { value: 'IconPhoto', label: '图片' },
    { value: 'IconVideo', label: '视频' },
    { value: 'IconWaveSine', label: '音频' },
    { value: 'IconKey', label: '密钥' },
    { value: 'IconLockCode', label: '编码' },
    { value: 'IconSearch', label: '分析' },
    { value: 'IconBug', label: '调试' },
    { value: 'IconBulb', label: '创意' },
    { value: 'IconLayoutDashboard', label: '面板' },
    { value: 'IconFileAnalytics', label: '日志' },
    { value: 'IconInfoCircle', label: '信息' },
    { value: 'IconGhost', label: '特殊' },
];

export const resolvePluginIcon = (iconKey?: string): IconComponent => {
    if (!iconKey) return IconLayoutDashboard;

    return CUSTOM_PLUGIN_ICONS[iconKey] || IconLayoutDashboard;
};
