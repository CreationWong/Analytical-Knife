// utils/notifications.ts

import { notifications } from '@mantine/notifications';
import React from 'react';

export type NotificationType = 'info' | 'warning' | 'error';

export interface ShowNotificationOptions {
    title?: string;
    message: string | React.ReactNode;
    type?: NotificationType;        // 'info' | 'warning' | 'error'
    autoClose?: number | boolean;   // 自动关闭时间（毫秒或 false）
    id?: string;                    // 通知唯一 ID（用于防重复）
    withCloseButton?: boolean;      // 是否显示关闭按钮
}

/**
 * 统一通知弹窗
 */
export const showNotification = ({
                                     title,
                                     message,
                                     type = 'info',
                                     autoClose = type === 'info' ? 5000 : false, // info 自动关，warning/error 手动关
                                     id = `${type}-notification`,
                                     withCloseButton = true,
                                 }: ShowNotificationOptions) => {
    // 根据类型设置默认标题和颜色
    const config = {
        info: { defaultTitle: '提示', color: 'blue' as const },
        warning: { defaultTitle: '警告', color: 'yellow' as const },
        error: { defaultTitle: '错误', color: 'red' as const },
    }[type];

    const finalTitle = title ?? config.defaultTitle;
    const color = config.color;

    // 处理 message：字符串自动换行
    const renderedMessage = typeof message === 'string'
        ? React.createElement('div', { style: { whiteSpace: 'pre-wrap' } }, message)
        : message;

    notifications.show({
        id,
        title: finalTitle,
        message: renderedMessage,
        color,
        autoClose,
        withCloseButton,
    });
};