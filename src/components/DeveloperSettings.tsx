import { useState } from 'react';
import {
    Alert,
    Button,
    Code,
    Group,
    Modal,
    Paper,
    Stack,
    Text,
} from '@mantine/core';
import { IconAlertTriangle, IconBug, IconRestore, IconTrash } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { useAppSettings } from '../hooks/useAppSettings';
import { dispatchCustomPluginsChanged } from '../utils/customPlugins';
import { handleAppError } from '../utils/error';
import { showNotification } from '../utils/notifications';

const STORAGE_KEY_LAST_TOOL = 'analytical_knife_last_tool';

interface ConfirmDialogState {
    actionKey: string;
    title: string;
    message: string;
    confirmLabel: string;
    confirmColor: string;
    onConfirm: () => Promise<void>;
}

export default function DeveloperSettings() {
    const [, , removeSettings] = useAppSettings();
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

    const withBusyAction = async (actionKey: string, action: () => Promise<void>) => {
        if (busyAction) return;

        setBusyAction(actionKey);

        try {
            await action();
        } finally {
            setBusyAction(null);
        }
    };

    const openConfirmDialog = (dialog: ConfirmDialogState) => {
        if (busyAction) return;
        setConfirmDialog(dialog);
    };

    const handleConfirmDialog = async () => {
        if (!confirmDialog) return;

        const currentDialog = confirmDialog;
        setConfirmDialog(null);

        await withBusyAction(currentDialog.actionKey, currentDialog.onConfirm);
    };

    const handleOpenDevtools = async () => {
        await withBusyAction('devtools', async () => {
            try {
                await invoke('open_main_devtools');
                showNotification({
                    type: 'info',
                    message: '已请求打开主窗口 DevTools。',
                });
            } catch (error) {
                handleAppError(error, {
                    title: 'DevTools 打开失败',
                    message: '当前环境无法打开主窗口 DevTools，请检查是否为支持 DevTools 的构建模式。',
                    isWarning: true,
                });
            }
        });
    };

    const handleResetInterface = () => {
        openConfirmDialog({
            actionKey: 'reset-interface',
            title: '确认重置界面',
            message: '此操作会恢复主题配置和侧边栏默认状态，并立即重新加载程序。',
            confirmLabel: '确认重置界面',
            confirmColor: 'orange',
            onConfirm: async () => {
                removeSettings();
                localStorage.removeItem(STORAGE_KEY_LAST_TOOL);

                showNotification({
                    type: 'info',
                    message: '界面设置已恢复默认，程序即将重新加载。',
                });

                window.setTimeout(() => window.location.reload(), 400);
            },
        });
    };

    const handleResetKernel = () => {
        openConfirmDialog({
            actionKey: 'reset-kernel',
            title: '确认重置内核',
            message: '此操作会清空当前 WebView 浏览数据、本地存储和会话存储，然后立即重新加载程序。',
            confirmLabel: '确认重置内核',
            confirmColor: 'red',
            onConfirm: async () => {
                try {
                    await getCurrentWebview().clearAllBrowsingData();
                    localStorage.clear();
                    sessionStorage.clear();

                    showNotification({
                        type: 'info',
                        message: 'WebView 浏览数据已清空，程序即将重新加载。',
                    });

                    window.setTimeout(() => window.location.reload(), 400);
                } catch (error) {
                    handleAppError(error, {
                        title: '内核重置失败',
                        message: '无法清空当前 WebView 浏览数据。',
                    });
                }
            },
        });
    };

    const handleResetThirdPartyTools = () => {
        openConfirmDialog({
            actionKey: 'reset-third-party',
            title: '确认重置第三方工具',
            message: '此操作会删除程序根目录中的 plugins.xml 和 plugins 目录，清空所有第三方 HTML 插件注册。',
            confirmLabel: '确认重置第三方工具',
            confirmColor: 'red',
            onConfirm: async () => {
                try {
                    await invoke('reset_third_party_tools');
                    dispatchCustomPluginsChanged();

                    showNotification({
                        type: 'info',
                        message: '第三方工具注册已清空，程序根目录下的 plugins.xml 和 plugins 目录已重置。',
                    });
                } catch (error) {
                    handleAppError(error, {
                        title: '第三方工具重置失败',
                        message: '无法清空程序根目录下的第三方工具注册信息。',
                    });
                }
            },
        });
    };

    return (
        <Stack gap="xl" p="md">
            <Modal
                opened={!!confirmDialog}
                onClose={() => setConfirmDialog(null)}
                title={confirmDialog?.title || '确认操作'}
                centered
                radius="md"
            >
                <Stack gap="lg">
                    <Text size="sm" c="var(--mantine-color-text)">
                        {confirmDialog?.message}
                    </Text>

                    <Group justify="flex-end">
                        <Button variant="default" onClick={() => setConfirmDialog(null)}>
                            取消
                        </Button>
                        <Button
                            color={confirmDialog?.confirmColor || 'red'}
                            loading={busyAction === confirmDialog?.actionKey}
                            onClick={handleConfirmDialog}
                        >
                            {confirmDialog?.confirmLabel || '确认'}
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            <section>
                <Text fw={700} size="lg" mb="sm">开发者设置</Text>

                <Alert
                    icon={<IconAlertTriangle size={16} />}
                    color="yellow"
                    variant="light"
                    mb="md"
                >
                    <Text size="sm">
                        下列操作包含调试能力和清理动作。`重置内核` 会清空当前 WebView 浏览数据并重载程序，`重置第三方工具` 会删除程序根目录中的第三方插件注册。
                    </Text>
                </Alert>

                <Stack gap="md">
                    <Paper withBorder radius="md" p="md">
                        <Group justify="space-between" align="center">
                            <div>
                                <Text fw={600}>打开 DevTools</Text>
                                <Text size="sm" c="dimmed">
                                    请求打开主窗口的开发者工具，用于调试前端界面和 WebView。
                                </Text>
                            </div>

                            <Button
                                variant="light"
                                leftSection={<IconBug size={16} />}
                                loading={busyAction === 'devtools'}
                                onClick={handleOpenDevtools}
                            >
                                打开 DevTools
                            </Button>
                        </Group>
                    </Paper>

                    <Paper withBorder radius="md" p="md">
                        <Group justify="space-between" align="center">
                            <div>
                                <Text fw={600}>重置界面</Text>
                                <Text size="sm" c="dimmed">
                                    恢复主题配置和侧边栏默认状态，不影响第三方插件注册。
                                </Text>
                            </div>

                            <Button
                                variant="light"
                                color="orange"
                                leftSection={<IconRestore size={16} />}
                                loading={busyAction === 'reset-interface'}
                                onClick={handleResetInterface}
                            >
                                重置界面
                            </Button>
                        </Group>
                    </Paper>

                    <Paper withBorder radius="md" p="md">
                        <Group justify="space-between" align="center">
                            <div>
                                <Text fw={600}>重置内核</Text>
                                <Text size="sm" c="dimmed">
                                    清空当前 WebView 浏览数据、缓存和本地存储，然后重新加载程序。
                                </Text>
                            </div>

                            <Button
                                variant="light"
                                color="red"
                                leftSection={<IconTrash size={16} />}
                                loading={busyAction === 'reset-kernel'}
                                onClick={handleResetKernel}
                            >
                                重置内核
                            </Button>
                        </Group>
                    </Paper>

                    <Paper withBorder radius="md" p="md">
                        <Group justify="space-between" align="center">
                            <div>
                                <Text fw={600}>重置第三方工具</Text>
                                <Text size="sm" c="dimmed">
                                    删除程序根目录中的 <Code>plugins.xml</Code> 和 <Code>plugins/</Code>，清空第三方 HTML 插件注册。
                                </Text>
                            </div>

                            <Button
                                variant="light"
                                color="red"
                                leftSection={<IconTrash size={16} />}
                                loading={busyAction === 'reset-third-party'}
                                onClick={handleResetThirdPartyTools}
                            >
                                重置第三方工具
                            </Button>
                        </Group>
                    </Paper>
                </Stack>
            </section>
        </Stack>
    );
}
