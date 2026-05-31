import { useEffect, useState } from 'react';
import {
    ActionIcon,
    Badge,
    Box,
    Button,
    Code,
    Divider,
    Group,
    NumberInput,
    Paper,
    Select,
    Stack,
    Switch,
    Text,
    TextInput,
    Textarea,
    Title,
} from '@mantine/core';
import { IconFileImport, IconRefresh, IconTrash } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { CustomPluginRecord, PluginEnvironment } from '../../registry/types';
import { CUSTOM_PLUGIN_ICON_OPTIONS, resolvePluginIcon } from '../../registry/sidebarIcons';
import { handleAppError } from '../../utils/error';
import {
    DEFAULT_PLUGIN_GROUP_PATH,
    DEFAULT_PLUGIN_ICON_KEY,
    dispatchCustomPluginsChanged,
    getPluginEnvironment,
    listCustomPlugins,
    normalizeSidebarGroupPath,
} from '../../utils/customPlugins';
import { showNotification } from '../../utils/notifications';

interface ImportFormState {
    sourceHtmlPath: string;
    name: string;
    description: string;
    enabled: boolean;
    iconKey: string;
    sidebarGroupPath: string;
    sidebarOrder: number;
    windowMaxWidth: 'default' | 'none';
}

type PluginDraftState = Record<string, ImportFormState>;

const createDefaultImportForm = (): ImportFormState => ({
    sourceHtmlPath: '',
    name: '',
    description: '',
    enabled: true,
    iconKey: DEFAULT_PLUGIN_ICON_KEY,
    sidebarGroupPath: DEFAULT_PLUGIN_GROUP_PATH,
    sidebarOrder: 100,
    windowMaxWidth: 'default',
});

const toDraft = (plugin: CustomPluginRecord): ImportFormState => ({
    sourceHtmlPath: '',
    name: plugin.name,
    description: plugin.description || '',
    enabled: plugin.enabled,
    iconKey: plugin.iconKey || DEFAULT_PLUGIN_ICON_KEY,
    sidebarGroupPath: plugin.sidebarGroupPath,
    sidebarOrder: plugin.sidebarOrder,
    windowMaxWidth: plugin.windowMaxWidth === 'none' ? 'none' : 'default',
});

const inferPluginName = (htmlPath: string) => {
    const normalized = htmlPath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    const fileName = parts[parts.length - 1] || 'index.html';
    const directoryName = parts.length > 1 ? parts[parts.length - 2] : undefined;

    return directoryName || fileName.replace(/\.[^.]+$/, '');
};

const hasInvalidPluginName = (name: string) => /[\\/]/.test(name);

export default function PluginManager() {
    const [environment, setEnvironment] = useState<PluginEnvironment | null>(null);
    const [plugins, setPlugins] = useState<CustomPluginRecord[]>([]);
    const [drafts, setDrafts] = useState<PluginDraftState>({});
    const [importForm, setImportForm] = useState<ImportFormState>(createDefaultImportForm());
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        void reloadAll();
    }, []);

    const reloadAll = async () => {
        setLoading(true);

        try {
            const [env, pluginList] = await Promise.all([
                getPluginEnvironment(),
                listCustomPlugins(),
            ]);

            setEnvironment(env);
            setPlugins(pluginList);
            setDrafts(
                Object.fromEntries(pluginList.map(plugin => [plugin.id, toDraft(plugin)]))
            );
        } catch (error) {
            handleAppError(error, {
                title: '插件数据读取失败',
                message: '无法读取插件根目录环境或 plugins.xml，请检查目录权限和 XML 格式。',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleImportFileSelect = async () => {
        try {
            const selected = await open({
                multiple: false,
                title: '选择编译后的 HTML 入口文件',
                filters: [{ name: 'HTML', extensions: ['html', 'htm'] }],
            });

            if (!selected || Array.isArray(selected)) return;

            const inferredName = inferPluginName(selected);

            setImportForm(prev => ({
                ...prev,
                sourceHtmlPath: selected,
                name: prev.name || inferredName,
            }));
        } catch (error) {
            handleAppError(error, {
                title: '选择文件失败',
                message: '无法打开文件选择器，请稍后重试。',
                isWarning: true,
            });
        }
    };

    const handleImportSubmit = async () => {
        if (!importForm.sourceHtmlPath.trim()) {
            showNotification({ type: 'warning', message: '请先选择编译后的 HTML 入口文件。' });
            return;
        }

        if (!importForm.name.trim()) {
            showNotification({ type: 'warning', message: '插件名称不能为空。' });
            return;
        }

        if (hasInvalidPluginName(importForm.name)) {
            showNotification({ type: 'warning', message: '插件名称不能包含 / 或 \\。' });
            return;
        }

        setSubmitting(true);

        try {
            await invoke('import_compiled_html_plugin', {
                input: {
                    sourceHtmlPath: importForm.sourceHtmlPath.trim(),
                    name: importForm.name.trim(),
                    description: importForm.description.trim(),
                    enabled: importForm.enabled,
                    iconKey: importForm.iconKey,
                    sidebarGroupPath: normalizeSidebarGroupPath(importForm.sidebarGroupPath),
                    sidebarOrder: importForm.sidebarOrder,
                    windowMaxWidth: importForm.windowMaxWidth === 'none' ? 'none' : null,
                },
            });

            showNotification({
                type: 'info',
                title: '导入成功',
                message: '插件已写入程序根目录并同步到 plugins.xml。',
            });

            setImportForm(createDefaultImportForm());
            await reloadAll();
            dispatchCustomPluginsChanged();
        } catch (error) {
            handleAppError(error, {
                title: '插件导入失败',
                message: '导入编译后的 HTML 失败，请检查 HTML 入口文件和目录权限。',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDraftChange = (id: string, patch: Partial<ImportFormState>) => {
        setDrafts(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                ...patch,
            },
        }));
    };

    const handlePluginSave = async (pluginId: string) => {
        const draft = drafts[pluginId];

        if (!draft?.name.trim()) {
            showNotification({ type: 'warning', message: '插件名称不能为空。' });
            return;
        }

        if (hasInvalidPluginName(draft.name)) {
            showNotification({ type: 'warning', message: '插件名称不能包含 / 或 \\。' });
            return;
        }

        try {
            await invoke('update_custom_plugin_metadata', {
                input: {
                    id: pluginId,
                    name: draft.name.trim(),
                    description: draft.description.trim(),
                    enabled: draft.enabled,
                    iconKey: draft.iconKey,
                    sidebarGroupPath: normalizeSidebarGroupPath(draft.sidebarGroupPath),
                    sidebarOrder: draft.sidebarOrder,
                    windowMaxWidth: draft.windowMaxWidth === 'none' ? 'none' : null,
                },
            });

            showNotification({
                type: 'info',
                message: '插件配置已保存，并已重新生成 XML。',
            });

            await reloadAll();
            dispatchCustomPluginsChanged();
        } catch (error) {
            handleAppError(error, {
                title: '插件保存失败',
                message: '插件元数据更新失败，请检查输入内容。',
            });
        }
    };

    const handlePluginDelete = async (pluginId: string) => {
        try {
            await invoke('remove_custom_plugin', { pluginId });

            showNotification({
                type: 'info',
                message: '插件已删除，并已同步更新 XML。',
            });

            await reloadAll();
            dispatchCustomPluginsChanged();
        } catch (error) {
            handleAppError(error, {
                title: '插件删除失败',
                message: '删除插件时发生错误，请检查插件目录权限。',
            });
        }
    };

    const handleRegenerateXml = async () => {
        try {
            await invoke('generate_plugins_xml');
            showNotification({
                type: 'info',
                message: 'plugins.xml 已重新生成。',
            });
            await reloadAll();
            dispatchCustomPluginsChanged();
        } catch (error) {
            handleAppError(error, {
                title: 'XML 生成失败',
                message: '无法重建程序根目录下的 plugins.xml。',
            });
        }
    };

    return (
        <Stack gap="xl" p="md">
            <Paper withBorder shadow="xs" radius="md" p="lg">
                <Group justify="space-between" align="flex-start">
                    <Stack gap={4}>
                        <Title order={3}>插件管理</Title>
                        <Text size="sm" c="dimmed">
                            导入已编译的 HTML 页面，并在此控制第三方插件在侧边栏中的位置和图标。
                        </Text>
                    </Stack>

                    <Button
                        variant="light"
                        leftSection={<IconRefresh size={16} />}
                        onClick={handleRegenerateXml}
                    >
                        重建 XML
                    </Button>
                </Group>

                <Divider my="md" />

                <Stack gap="xs">
                    <Text size="sm" fw={600}>程序根目录</Text>
                    <Code block>{environment?.programRoot || '加载中...'}</Code>

                    <Text size="sm" fw={600}>XML 文件路径</Text>
                    <Code block>{environment?.xmlPath || '加载中...'}</Code>

                    <Text size="sm" fw={600}>插件托管目录</Text>
                    <Code block>{environment?.pluginsDirectory || '加载中...'}</Code>
                </Stack>
            </Paper>

            <Paper withBorder shadow="xs" radius="md" p="lg">
                <Stack gap="md">
                    <Group justify="space-between">
                        <div>
                            <Title order={4}>导入新插件</Title>
                            <Text size="sm" c="dimmed">
                                选择一个已编译完成的 HTML 入口文件，程序会将该文件所在目录整体复制到插件托管目录。
                            </Text>
                        </div>

                        <Button
                            variant="light"
                            leftSection={<IconFileImport size={16} />}
                            onClick={handleImportFileSelect}
                        >
                            选择 HTML
                        </Button>
                    </Group>

                    <TextInput
                        label="HTML 入口文件"
                        value={importForm.sourceHtmlPath}
                        readOnly
                        placeholder="请选择编译后的 HTML 入口文件"
                    />

                    <TextInput
                        label="插件名称"
                        value={importForm.name}
                        onChange={event => setImportForm(prev => ({ ...prev, name: event.currentTarget.value }))}
                    />

                    <Textarea
                        label="插件说明"
                        minRows={2}
                        value={importForm.description}
                        onChange={event => setImportForm(prev => ({ ...prev, description: event.currentTarget.value }))}
                    />

                    <Group grow align="flex-start">
                        <TextInput
                            label="侧边栏挂载路径"
                            placeholder="第三方插件/常用工具"
                            value={importForm.sidebarGroupPath}
                            onChange={event => setImportForm(prev => ({ ...prev, sidebarGroupPath: event.currentTarget.value }))}
                        />

                        <NumberInput
                            label="排序序号"
                            value={importForm.sidebarOrder}
                            onChange={value => setImportForm(prev => ({
                                ...prev,
                                sidebarOrder: typeof value === 'number' ? value : 100,
                            }))}
                        />
                    </Group>

                    <Group grow align="flex-start">
                        <Select
                            label="侧边栏图标"
                            value={importForm.iconKey}
                            data={CUSTOM_PLUGIN_ICON_OPTIONS}
                            onChange={value => setImportForm(prev => ({
                                ...prev,
                                iconKey: value || DEFAULT_PLUGIN_ICON_KEY,
                            }))}
                        />

                        <Select
                            label="显示宽度"
                            value={importForm.windowMaxWidth}
                            data={[
                                { value: 'default', label: '默认宽度' },
                                { value: 'none', label: '全宽显示' },
                            ]}
                            onChange={value => setImportForm(prev => ({
                                ...prev,
                                windowMaxWidth: value === 'none' ? 'none' : 'default',
                            }))}
                        />
                    </Group>

                    <Switch
                        checked={importForm.enabled}
                        onChange={event => setImportForm(prev => ({ ...prev, enabled: event.currentTarget.checked }))}
                        label="导入后立即启用"
                    />

                    <Group justify="flex-end">
                        <Button onClick={handleImportSubmit} loading={submitting}>
                            导入并写入 XML
                        </Button>
                    </Group>
                </Stack>
            </Paper>

            <Stack gap="md">
                <Group justify="space-between">
                    <Title order={4}>已注册第三方插件</Title>
                    <Badge variant="light">{plugins.length} 个</Badge>
                </Group>

                {loading ? (
                    <Paper withBorder radius="md" p="lg">
                        <Text c="dimmed">正在读取 plugins.xml ...</Text>
                    </Paper>
                ) : plugins.length === 0 ? (
                    <Paper withBorder radius="md" p="lg">
                        <Text c="dimmed">当前程序根目录尚未注册第三方插件。</Text>
                    </Paper>
                ) : (
                    plugins.map(plugin => {
                        const draft = drafts[plugin.id] || toDraft(plugin);
                        const CurrentIcon = resolvePluginIcon(draft.iconKey);

                        return (
                            <Paper key={plugin.id} withBorder shadow="xs" radius="md" p="lg">
                                <Stack gap="md">
                                    <Group justify="space-between" align="flex-start">
                                        <Group gap="sm" align="center">
                                            <Box
                                                style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: 'var(--mantine-radius-md)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor: 'var(--mantine-color-default-hover)',
                                                }}
                                            >
                                                <CurrentIcon size={20} stroke={1.8} />
                                            </Box>

                                            <div>
                                                <Text fw={700}>{plugin.name}</Text>
                                                <Text size="xs" c="dimmed">{plugin.id}</Text>
                                            </div>
                                        </Group>

                                        <Group gap="xs">
                                            <Button variant="light" onClick={() => handlePluginSave(plugin.id)}>
                                                保存
                                            </Button>
                                            <ActionIcon
                                                color="red"
                                                variant="light"
                                                onClick={() => handlePluginDelete(plugin.id)}
                                            >
                                                <IconTrash size={16} />
                                            </ActionIcon>
                                        </Group>
                                    </Group>

                                    <TextInput
                                        label="插件名称"
                                        value={draft.name}
                                        onChange={event => handleDraftChange(plugin.id, { name: event.currentTarget.value })}
                                    />

                                    <Textarea
                                        label="插件说明"
                                        minRows={2}
                                        value={draft.description}
                                        onChange={event => handleDraftChange(plugin.id, { description: event.currentTarget.value })}
                                    />

                                    <Group grow align="flex-start">
                                        <TextInput
                                            label="侧边栏挂载路径"
                                            value={draft.sidebarGroupPath}
                                            onChange={event => handleDraftChange(plugin.id, { sidebarGroupPath: event.currentTarget.value })}
                                        />

                                        <NumberInput
                                            label="排序序号"
                                            value={draft.sidebarOrder}
                                            onChange={value => handleDraftChange(plugin.id, {
                                                sidebarOrder: typeof value === 'number' ? value : plugin.sidebarOrder,
                                            })}
                                        />
                                    </Group>

                                    <Group grow align="flex-start">
                                        <Select
                                            label="侧边栏图标"
                                            value={draft.iconKey}
                                            data={CUSTOM_PLUGIN_ICON_OPTIONS}
                                            onChange={value => handleDraftChange(plugin.id, {
                                                iconKey: value || DEFAULT_PLUGIN_ICON_KEY,
                                            })}
                                        />

                                        <Select
                                            label="显示宽度"
                                            value={draft.windowMaxWidth}
                                            data={[
                                                { value: 'default', label: '默认宽度' },
                                                { value: 'none', label: '全宽显示' },
                                            ]}
                                            onChange={value => handleDraftChange(plugin.id, {
                                                windowMaxWidth: value === 'none' ? 'none' : 'default',
                                            })}
                                        />
                                    </Group>

                                    <Switch
                                        checked={draft.enabled}
                                        onChange={event => handleDraftChange(plugin.id, {
                                            enabled: event.currentTarget.checked,
                                        })}
                                        label="启用此插件"
                                    />

                                    <Stack gap="xs">
                                        <Text size="sm" fw={600}>托管目录</Text>
                                        <Code block>{plugin.pluginRoot}</Code>
                                        <Text size="sm" fw={600}>入口文件</Text>
                                        <Code block>{plugin.entryFile}</Code>
                                    </Stack>
                                </Stack>
                            </Paper>
                        );
                    })
                )}
            </Stack>
        </Stack>
    );
}
