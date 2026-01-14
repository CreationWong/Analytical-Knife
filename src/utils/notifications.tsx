import { notifications } from '@mantine/notifications';
import React from 'react';

export type NotificationType = 'info' | 'warning' | 'error';

export interface ShowNotificationOptions {
    title?: string;
    message: string | React.ReactNode;
    type?: NotificationType;
    autoClose?: number | boolean;
    id?: string;
    withCloseButton?: boolean;
}

/**
 * 预定义各类型的配置映射表
 */
const TYPE_CONFIG: Record<NotificationType, { title: string; color: string; autoClose: number | boolean }> = {
    info: {
        title: '提示',
        color: 'blue',
        autoClose: 5000,
    },
    warning: {
        title: '警告',
        color: 'yellow',
        autoClose: false,
    },
    error: {
        title: '错误',
        color: 'red',
        autoClose: false,
    },
};

/**
 * 统一通知弹窗（重构版）
 */
export const showNotification = (options: ShowNotificationOptions) => {
    const {
        type = 'info',
        message,
        title,
        id,
        autoClose,
        withCloseButton = true,
    } = options;

    // 获取对应类型的默认基础配置
    const defaultConfig = TYPE_CONFIG[type];

    // 确定最终参数（优先使用 options 传入的覆盖值）
    const finalId = id ?? `${type}-notification`;
    const finalTitle = title ?? defaultConfig.title;
    const finalAutoClose = autoClose ?? defaultConfig.autoClose;

    // 处理消息渲染（JSX 格式比 React.createElement 更易读）
    const renderedMessage = typeof message === 'string' ? (
        <div style={{ whiteSpace: 'pre-wrap' }}>
    {message}
    </div>
) : (
        message
    );

    // 调用 Mantine 原始接口
    notifications.show({
        id: finalId,
        title: finalTitle,
        message: renderedMessage,
        color: defaultConfig.color,
        autoClose: finalAutoClose,
        withCloseButton,
    });
};