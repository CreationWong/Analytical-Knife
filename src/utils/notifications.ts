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
 * 统一通知弹窗（支持信息、警告、错误三种类型）
 *
 * 该函数封装了 Mantine Notifications 的常用配置，提供一致的 UI/UX 体验。
 * - `info`（蓝色）：用于操作成功、普通提示等非干扰性信息。
 * - `warning`（黄色）：用于潜在问题、部分失败、格式不规范等需注意但非致命的情况。
 * - `error`（红色）：用于严重错误、操作失败等必须引起用户注意的情形。
 *
 * @param {Object} options - 通知配置选项
 * @param {string} [options.title] - 通知标题。若未提供，则根据 type 自动设置为“提示”、“警告”或“错误”。
 * @param {string | React.ReactNode} options.message - 通知内容。支持纯文本（自动保留换行）或 React 元素（用于富文本/交互）。
 * @param {'info' | 'warning' | 'error'} [options.type='info'] - 通知类型，决定颜色和默认行为。
 * @param {number | boolean} [options.autoClose=5000（info）/false（warning|error）] -
 *   自动关闭时间（毫秒）。`info` 默认 5 秒后自动消失；`warning` 和 `error` 默认不自动关闭，需用户手动关闭。
 * @param {string} [options.id=`${type}-notification`] - 通知的唯一标识符。
 *   相同 id 的通知会自动合并（避免重复弹窗），适用于防止高频触发。
 * @param {boolean} [options.withCloseButton=true] - 是否显示右上角关闭按钮。
 *   对于需要用户确认的重要错误，建议保留；对于临时提示可设为 false。
 *
 * @example
 * // 信息提示
 * showNotification({ type: 'info', title: '成功', message: '文件已保存！' });
 *
 * // 警告（带自定义关闭时间）
 * showNotification({ type: 'warning', message: '部分数据格式不匹配', autoClose: 6000 });
 *
 * // 错误（不自动关闭）
 * showNotification({ type: 'error', message: '网络连接失败，请重试。' });
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