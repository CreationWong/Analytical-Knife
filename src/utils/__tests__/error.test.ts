/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleAppError } from '../error';
import { notifications } from '@mantine/notifications';

// Mock Mantine 的 notifications 模块
vi.mock('@mantine/notifications', () => ({
    notifications: {
        show: vi.fn(),
        hide: vi.fn(),
    },
}));

describe('handleAppError 异常处理器测试', () => {
    // 缓存原始 location 以便还原
    const originalLocation = window.location;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        console.error = vi.fn();

        // @ts-ignore
        delete window.location;
        // @ts-ignore
        window.location = {
            ...originalLocation,
            reload: vi.fn()
        } as unknown as Location;
    });

    afterEach(() => {
        vi.useRealTimers();
        // 还原原始对象（防止污染其他测试）
        // @ts-ignore
        window.location = originalLocation;
    });

    it('应当能正确处理简单的字符串错误', () => {
        handleAppError('测试错误消息');
        expect(notifications.show).toHaveBeenCalledWith(
            expect.objectContaining({
                title: '运行出错',
                color: 'red',
            })
        );
    });

    it('自动重载模式：应当在指定延迟后触发刷新页面', () => {
        handleAppError('系统错误', { autoReload: true, reloadDelay: 1000 });

        // 验证计时器逻辑
        vi.advanceTimersByTime(1000);
        expect(window.location.reload).toHaveBeenCalled();
    });

    it('手动重载模式：点击按钮应当触发自定义重试逻辑', () => {
        const onRetry = vi.fn();
        handleAppError('失败', { onRetry });

        const showArgs = vi.mocked(notifications.show).mock.calls[0][0];
        const messageElement = showArgs.message as any;

        // 寻找自定义的按钮并模拟点击
        const button = messageElement.props.children.find(
            (child: any) => child && child.type === 'button'
        );

        expect(button).toBeDefined();
        button.props.onClick();

        expect(notifications.hide).toHaveBeenCalledWith('manual-error-notification');
        expect(onRetry).toHaveBeenCalled();
    });
});