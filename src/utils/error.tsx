import {notifications} from '@mantine/notifications';
import React from 'react';

export interface ErrorOptions {
    title?: string;
    message?: string;
    isWarning?: boolean;
    autoReload?: boolean;
    reloadDelay?: number;
    onRetry?: () => void;
}

/**
 * 统一异常处理器
 */
export const handleAppError = (error: any, options: ErrorOptions = {}) => {
    const {
        isWarning = false,
        autoReload = false,
        reloadDelay = 3000,
        onRetry,
        title = isWarning ? '操作警告' : '运行出错',
        message: customMessage,
    } = options;

    console.error('[App Error]:', error);

    // 统一解析错误文本
    const errorMessage = customMessage || (
        typeof error === 'string' ? error : error?.message || '未知错误!'
    );

    // 封装统一的执行逻辑
    const executeRetry = () => {
        if (onRetry) {
            onRetry();
        } else {
            window.location.reload();
        }
    };

    // 处理自动重载模式
    if (autoReload) {
        const seconds = Math.ceil(reloadDelay / 1000);

        notifications.show({
            id: 'auto-reload-notification',
            title,
            color: 'orange',
            loading: true,
            autoClose: reloadDelay,
            withCloseButton: false,
            message: (
                <div style={{whiteSpace: 'pre-wrap'}}>
                    <div>{errorMessage}</div>
                    <div style={{
                        marginTop: '8px',
                        fontSize: '12px',
                        opacity: 0.8,
                        fontWeight: 500
                    }}>
                        程序将在 {seconds} 秒后自动尝试恢复...
                    </div>
                </div>
            )
        });

        setTimeout(executeRetry, reloadDelay);
        return;
    }

    // 处理手动模式（警告或错误）
    notifications.show({
        id: 'manual-error-notification',
        title,
        color: isWarning ? 'yellow' : 'red',
        autoClose: isWarning ? 5000 : false,
        withCloseButton: true,
        message: (
            <div>
                <p style={{marginBottom: '12px'}}>{errorMessage}</p>
                {!isWarning && (
                    <button
                        className="mantine-active"
                        style={retryButtonStyle}
                        onClick={() => {
                            notifications.hide('manual-error-notification');
                            executeRetry();
                        }}
                    >
                        立即刷新重试
                    </button>
                )}
            </div>
        )
    });
};

/**
 * 提取样式常量，保持渲染函数整洁
 */
const retryButtonStyle: React.CSSProperties = {
    cursor: 'pointer',
    backgroundColor: '#fa5252',
    border: 'none',
    color: 'white',
    padding: '5px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600
};