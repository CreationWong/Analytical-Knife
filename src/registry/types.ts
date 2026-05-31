import React from 'react';

export interface ToolDefinition {
    id: string;          // 唯一ID
    name: string;        // 显示名称
    description?: string; // 简短描述
    icon?: React.ElementType;
    iconKey?: string;
    path: string | null;
    component?: React.LazyExoticComponent<any>; // 懒加载组件
    windowMaxWidth?: number | string;
    sidebarOrder?: number;
    source?: 'builtin' | 'plugin';
    enabled?: boolean;
    pluginRoot?: string;
    entryFile?: string;
}

export interface CustomPluginRecord {
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    iconKey: string;
    sidebarGroupPath: string;
    sidebarOrder: number;
    entryFile: string;
    pluginRoot: string;
    windowMaxWidth?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface PluginEnvironment {
    programRoot: string;
    pluginsDirectory: string;
    xmlPath: string;
}
