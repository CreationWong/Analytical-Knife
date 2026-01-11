import React from 'react';

export interface ToolDefinition {
    id: string;          // 唯一ID
    name: string;        // 显示名称
    description: string; // 简短描述
    icon: React.ElementType;
    component: React.LazyExoticComponent<any>; // 懒加载组件
    category: 'Text' | 'Image' | 'Dev' | 'System';
}