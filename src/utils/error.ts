import { notifications } from '@mantine/notifications';
import React from 'react';

interface ErrorOptions {
    title?: string;
    message?: string;
    isWarning?: boolean;      // true 为黄色警告，false 为红色错误
    autoReload?: boolean;     // 是否自动重载
    reloadDelay?: number;     // 自动重载的延迟时间（毫秒），默认为 3000ms
    onRetry?: () => void;     // 重试回调（如果不传，默认 reload 页面）
}

/**
 * 统一异常处理器
 */
export const handleAppError = (error: any, options: ErrorOptions = {}) => {
    const {
        title = options.isWarning ? '操作警告' : '运行出错',
        message: customMessage,
        isWarning = false,
        autoReload = false,
        reloadDelay = 3000, // 默认 3 秒
        onRetry
    } = options;

    console.error('[App Error]:', error);

    const message = customMessage || (typeof error === 'string' ? error : error?.message || '未知错误!');

    // 自动重载逻辑
    if (autoReload) {
        const seconds = Math.ceil(reloadDelay / 1000);

        notifications.show({
            id: 'auto-reload-notification',
            title: `${title}`,
            message: React.createElement('div', { style: { whiteSpace: 'pre-wrap' } }, [
                React.createElement('div', { key: 'err-msg' }, message),
                React.createElement('div', {
                    key: 'timer-msg',
                    style: { marginTop: '8px', fontSize: '12px', opacity: 0.8, fontWeight: 500 }
                }, `程序将在 ${seconds} 秒后自动尝试恢复...`)
            ]),
            color: 'orange',
            loading: true,
            autoClose: reloadDelay,
            withCloseButton: false,
        });

        setTimeout(() => {
            if (onRetry) {
                onRetry();
            } else {
                window.location.reload();
            }
        }, reloadDelay);

        return;
    }

    // 手动重载逻辑 (用户决定)
    notifications.show({
        id: 'manual-error-notification',
        title,
        message: React.createElement('div', null, [
            React.createElement('p', { key: 'msg', style: { marginBottom: '12px' } }, message),
            !isWarning && React.createElement('button', {
                key: 'retry-btn',
                className: 'mantine-active', // 利用 Mantine 的点击效果
                style: {
                    cursor: 'pointer',
                    backgroundColor: '#fa5252',
                    border: 'none',
                    color: 'white',
                    padding: '5px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600
                },
                onClick: () => {
                    notifications.hide('manual-error-notification');
                    if (onRetry) onRetry();
                    else window.location.reload();
                }
            }, '立即刷新重试')
        ]),
        color: isWarning ? 'yellow' : 'red',
        autoClose: isWarning ? 5000 : false,
        withCloseButton: true,
    });
};