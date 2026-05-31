import {useState, Suspense, useMemo, useEffect} from 'react';
import {
    AppShell,
    Burger,
    NavLink,
    Text,
    ScrollArea,
    Loader,
    Stack,
    ActionIcon,
    Tooltip,
    Group,
    Box,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
    IconChevronLeft,
    IconChevronRight,
    IconLayoutDashboard,
    IconInfoCircle
} from '@tabler/icons-react';
import { TOOLS_REGISTRY } from './registry';
import { ToolErrorBoundary } from './components/ErrorBoundary';
import HtmlPluginHost from './components/HtmlPluginHost';
import { useCustomPlugins } from './hooks/useCustomPlugins';
import { PARENT_ICONS, resolvePluginIcon } from './registry/sidebarIcons.ts';
import { ToolDefinition } from './registry/types';
import { isPluginTool, toPluginToolDefinition } from './utils/customPlugins';

// 树节点接口定义
interface TreeNode {
    label: string;
    children: Record<string, TreeNode>;
    toolId?: string;
    sortOrder: number;
}

// 本地存储的 Key
const STORAGE_KEY = 'analytical_knife_last_tool';

export default function App() {
    // 状态管理
    const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
    const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
    const { plugins: customPlugins, loading: customPluginsLoading } = useCustomPlugins();

    useEffect(() => {
        // 生产环境禁用右键菜单
        if (!import.meta.env.DEV) {
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                return false;
            });
        }
    }, []);

    const runtimeTools = useMemo<ToolDefinition[]>(
        () => [
            ...TOOLS_REGISTRY,
            ...customPlugins
                .filter(plugin => plugin.enabled)
                .map(toPluginToolDefinition),
        ],
        [customPlugins]
    );

    // 初始化 activeId：优先从本地存储读取，若无则默认为 'about'
    const [activeId, setActiveId] = useState<string>(() => {
        return localStorage.getItem(STORAGE_KEY) || 'about';
    });

    // 处理工具切换并持久化
    const handleToolChange = (id: string) => {
        setActiveId(id);
        localStorage.setItem(STORAGE_KEY, id);
    };

    useEffect(() => {
        if (runtimeTools.some(tool => tool.id === activeId)) return;

        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved && runtimeTools.some(tool => tool.id === saved)) {
            setActiveId(saved);
            return;
        }

        setActiveId('about');
        localStorage.setItem(STORAGE_KEY, 'about');
    }, [activeId, runtimeTools]);

    // 构建工具树逻辑 (基于 path 字段)
    const toolTree = useMemo(() => {
        const root: Record<string, TreeNode> = {};

        runtimeTools.forEach((tool, index) => {
            // 如果 path 为空，直接跳过，不加入侧边栏树结构
            if (!tool.path) return;

            const parts = tool.path.split('/');
            let currentLevel = root;
            const sortOrder = tool.sidebarOrder ?? index;

            parts.forEach((part, index) => {
                if (!currentLevel[part]) {
                    currentLevel[part] = {
                        label: part,
                        children: {},
                        sortOrder,
                    };
                }

                currentLevel[part].sortOrder = Math.min(currentLevel[part].sortOrder, sortOrder);

                if (index === parts.length - 1) {
                    currentLevel[part].toolId = tool.id;
                    currentLevel[part].label = tool.name;
                    currentLevel[part].sortOrder = sortOrder;
                }

                currentLevel = currentLevel[part].children;
            });
        });
        return root;
    }, [runtimeTools]);

    // 递归渲染侧边栏菜单
    const renderNavNodes = (nodes: Record<string, TreeNode>, inheritedIcon?: any) => {
        return Object.entries(nodes)
            .sort(([, a], [, b]) => {
                if (a.sortOrder !== b.sortOrder) {
                    return a.sortOrder - b.sortOrder;
                }

                return a.label.localeCompare(b.label, 'zh-CN');
            })
            .map(([key, node]) => {
            const isLeaf = !!node.toolId;
            const tool = isLeaf ? runtimeTools.find(t => t.id === node.toolId) : null;
            const hasChildren = Object.keys(node.children).length > 0;

            let CurrentIcon;

            if (isLeaf) {
                // 叶子节点（工具）：注册表定义 > 继承的父节点图标 > 默认图标
                CurrentIcon = tool?.icon
                    || (tool?.source === 'plugin' ? resolvePluginIcon(tool.iconKey) : undefined)
                    || inheritedIcon
                    || IconLayoutDashboard;
            } else {
                // 父节点（目录）：sidebarIcons 定义 > 继承的父节点图标 > 默认图标
                CurrentIcon = PARENT_ICONS[key] || inheritedIcon || IconLayoutDashboard;
            }

            return (
                <Tooltip
                    key={key}
                    label={node.label}
                    position="right"
                    disabled={desktopOpened}
                    withArrow
                >
                    <NavLink
                        label={desktopOpened ? node.label : null}
                        description={desktopOpened && isLeaf ? tool?.description : null}
                        leftSection={
                            <CurrentIcon size="1.2rem" stroke={1.5} />
                        }
                        active={isLeaf && activeId === node.toolId}
                        childrenOffset={desktopOpened ? 20 : 0}
                        defaultOpened={!isLeaf && desktopOpened}
                        onClick={() => {
                            if (isLeaf && node.toolId) {
                                handleToolChange(node.toolId);
                                if (mobileOpened) toggleMobile();
                            }
                        }}
                        styles={{
                            root: {
                                borderRadius: 'var(--mantine-radius-sm)',
                                marginBottom: '4px',
                                justifyContent: desktopOpened ? 'flex-start' : 'center',
                                minHeight: desktopOpened && isLeaf && tool?.description ? 54 : 42,
                            },
                            section: { margin: desktopOpened ? undefined : 0 },
                            body: { overflow: 'hidden' },
                            description: { fontSize: '10px', opacity: 0.7, marginTop: '2px' }
                        }}
                    >
                        {/* 递归调用：将当前的 CurrentIcon 传给子节点作为继承项 */}
                        {desktopOpened && hasChildren && renderNavNodes(node.children, CurrentIcon)}
                    </NavLink>
                </Tooltip>
            );
        });
    };

    const activeTool = runtimeTools.find((t) => t.id === activeId);
    const isActivePluginTool = isPluginTool(activeTool);

    // 确定当前容器的最大宽度逻辑：
    // 1. 如果工具明确定义了 maxWidth，则使用该值
    // 2. 如果没定义，默认使用 1200
    const currentMaxWidth = activeTool?.windowMaxWidth !== undefined ? activeTool.windowMaxWidth : 1200;
    const shouldFillWindow = isActivePluginTool;

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{
                width: desktopOpened ? 280 : 80,
                breakpoint: 'sm',
                collapsed: { mobile: !mobileOpened },
            }}
            padding={shouldFillWindow ? 0 : 'md'}
            transitionDuration={300}
            transitionTimingFunction="ease"
        >
            {/* Header 部分 */}
            <AppShell.Header p="md">
                <Group h="100%" px="md" justify="space-between" align="center" wrap="nowrap">
                    <Group
                        align="center"
                        gap="sm"
                        onClick={() => handleToolChange('about')}
                        style={{ cursor: 'pointer' }} // 增加手型指针提示
                    >
                        <Burger opened={mobileOpened} onClick={(e) => { e.stopPropagation(); toggleMobile(); }} hiddenFrom="sm" size="sm" />
                        <IconLayoutDashboard size="1.8rem" color="var(--mantine-color-blue-filled)" />
                        <Text
                            fw={800}
                            size="xl"
                            variant="gradient"
                            gradient={{ from: 'blue', to: 'cyan' }}
                            style={{
                                display: 'block',
                                whiteSpace: 'nowrap',
                                transition: 'opacity 0.2s ease',
                                userSelect: 'none' // 防止文字被意外选中
                            }}
                        >
                            {__APP_NAME__}
                        </Text>
                    </Group>

                    <ActionIcon
                        variant="light"
                        onClick={toggleDesktop}
                        visibleFrom="sm"
                        size="lg"
                        radius="md"
                    >
                        {desktopOpened ? <IconChevronLeft size="1.2rem" /> : <IconChevronRight size="1.2rem" />}
                    </ActionIcon>
                </Group>
            </AppShell.Header>

            {/* 侧边栏部分 */}
            <AppShell.Navbar p="xs">
                <AppShell.Section component={ScrollArea} grow>
                    <Stack gap={4}>
                        {renderNavNodes(toolTree)}
                    </Stack>
                </AppShell.Section>

                {/* 底部版本显示 + Tooltip */}
                <AppShell.Section p="xs" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
                    <Tooltip label={__APP_VERSION__} position="right" withArrow disabled={desktopOpened}>
                        <Text size="xs" c="dimmed" ta="center" style={{ cursor: 'default', whiteSpace: 'nowrap' }}>
                            {desktopOpened ? __APP_VERSION__ : __SHORT_VERSION__}
                        </Text>
                    </Tooltip>
                </AppShell.Section>
            </AppShell.Navbar>

            {/* 主内容区域 */}
            <AppShell.Main
                bg="var(--mantine-color-body)"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    height: '100vh'
                }}
            >
                <ToolErrorBoundary key={activeId}>
                    <Suspense fallback={
                        <Group justify="center" mt="xl">
                            <Loader size="lg" variant="dots" />
                        </Group>
                    }>
                        <Box
                            style={{
                                padding: shouldFillWindow || currentMaxWidth === 'none' ? 0 : 'var(--mantine-spacing-md)',
                                // 动态最大宽度
                                maxWidth: shouldFillWindow || currentMaxWidth === 'none' ? '100%' : `${currentMaxWidth}px`,
                                width: '100%',
                                marginLeft: 'auto',
                                marginRight: 'auto',
                                flex: 1,
                                minHeight: 0,
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            {activeTool ? (
                                isPluginTool(activeTool) ? (
                                    <HtmlPluginHost tool={activeTool} />
                                ) : activeTool.component ? (
                                    <activeTool.component />
                                ) : null
                            ) : (
                                customPluginsLoading ? (
                                    <Group justify="center" mt="xl">
                                        <Loader size="lg" variant="dots" />
                                    </Group>
                                ) : (
                                    <Stack align="center" mt={100} gap="sm">
                                        <IconInfoCircle size={48} color="var(--mantine-color-gray-4)" />
                                        <Text c="dimmed" fw={500}>未找到该工具，请在侧边栏重新选择</Text>
                                    </Stack>
                                )
                            )}
                        </Box>
                    </Suspense>
                </ToolErrorBoundary>
            </AppShell.Main>
        </AppShell>
    );
}
