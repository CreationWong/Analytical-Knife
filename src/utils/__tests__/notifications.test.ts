/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showNotification } from '../notifications';
import { notifications } from '@mantine/notifications';
import React from 'react';

// Mock Mantine 模块
vi.mock('@mantine/notifications', () => ({
    notifications: {
        show: vi.fn(),
    },
}));

describe('showNotification 统一通知工具测试', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('应当使用默认参数显示 info 通知', () => {
        showNotification({ message: '这是一条普通消息' });

        expect(notifications.show).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'info-notification',
                title: '提示',
                color: 'blue',
                autoClose: 5000,
                withCloseButton: true,
            })
        );
    });

    it('应当为 warning 类型设置正确的默认值', () => {
        showNotification({ type: 'warning', message: '潜在问题' });

        expect(notifications.show).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'warning-notification',
                title: '警告',
                color: 'yellow',
                autoClose: false, // 警告默认不自动关闭
            })
        );
    });

    it('应当为 error 类型设置正确的默认值', () => {
        showNotification({ type: 'error', message: '严重错误' });

        expect(notifications.show).toHaveBeenCalledWith(
            expect.objectContaining({
                title: '错误',
                color: 'red',
                autoClose: false,
            })
        );
    });

    it('应当允许覆盖默认标题和 autoClose 设置', () => {
        showNotification({
            type: 'info',
            title: '自定义标题',
            message: '消息',
            autoClose: 1000,
            id: 'custom-id'
        });

        expect(notifications.show).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'custom-id',
                title: '自定义标题',
                autoClose: 1000,
            })
        );
    });

    it('当 message 为字符串时，应当包裹 whiteSpace: pre-wrap 的 div', () => {
        const testMsg = '第一行\n第二行';
        showNotification({ message: testMsg });

        const callArgs = vi.mocked(notifications.show).mock.calls[0][0];

        // 将 message 强制断言为 React.ReactElement
        // 并指定 props 的结构
        const renderedMessage = callArgs.message as React.ReactElement<{
            style: React.CSSProperties;
            children: React.ReactNode;
        }>;

        expect(renderedMessage.type).toBe('div');
        expect(renderedMessage.props.style).toEqual({ whiteSpace: 'pre-wrap' });
        expect(renderedMessage.props.children).toBe(testMsg);
    });

    it('当 message 为 React 元素时，应当直接传递', () => {
        const customElement = React.createElement('span', null, '自定义元素');
        showNotification({ message: customElement });

        const callArgs = vi.mocked(notifications.show).mock.calls[0][0];
        expect(callArgs.message).toBe(customElement);
    });
});