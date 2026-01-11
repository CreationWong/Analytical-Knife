import { useState, Suspense, useMemo } from 'react';
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

// 树节点接口定义
interface TreeNode {
    label: string;
    children: Record<string, TreeNode>;
    toolId?: string;
}

// 本地存储的 Key
const STORAGE_KEY = 'analytical_knife_last_tool';

export default function App() {
    // 状态管理
    const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
    const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);

    // 初始化 activeId：优先从本地存储读取，若无则默认为 'about'
    const [activeId, setActiveId] = useState<string>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        // 验证保存的 ID 是否依然存在于注册表中，防止插件删除后导致死循环
        return TOOLS_REGISTRY.some(t => t.id === saved) ? (saved as string) : 'about';
    });

    // 处理工具切换并持久化
    const handleToolChange = (id: string) => {
        setActiveId(id);
        localStorage.setItem(STORAGE_KEY, id);
    };

    // 构建工具树逻辑 (基于 path 字段)
    const toolTree = useMemo(() => {
        const root: Record<string, TreeNode> = {};

        TOOLS_REGISTRY.forEach((tool) => {
            // 如果 path 为空，直接跳过，不加入侧边栏树结构
            if (!tool.path) return;

            const parts = tool.path.split('/');
            let currentLevel = root;

            parts.forEach((part, index) => {
                if (!currentLevel[part]) {
                    currentLevel[part] = { label: part, children: {} };
                }

                if (index === parts.length - 1) {
                    currentLevel[part].toolId = tool.id;
                    currentLevel[part].label = tool.name;
                }

                currentLevel = currentLevel[part].children;
            });
        });
        return root;
    }, []);

    // 递归渲染侧边栏菜单
    const renderNavNodes = (nodes: Record<string, TreeNode>) => {
        return Object.entries(nodes).map(([key, node]) => {
            const isLeaf = !!node.toolId;
            const tool = isLeaf ? TOOLS_REGISTRY.find(t => t.id === node.toolId) : null;
            const hasChildren = Object.keys(node.children).length > 0;

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
                        // 仅在展开且是工具时显示描述
                        description={desktopOpened && isLeaf ? tool?.description : null}
                        leftSection={
                            tool?.icon ? (
                                <tool.icon size="1.2rem" stroke={1.5} />
                            ) : (
                                <IconLayoutDashboard size="1.1rem" stroke={1.5} />
                            )
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
                                marginBottom: '4px', // 稍微增加间距以适应双行文字
                                justifyContent: desktopOpened ? 'flex-start' : 'center',
                                // 如果有描述，稍微增加高度
                                minHeight: desktopOpened && isLeaf && tool?.description ? 54 : 42,
                            },
                            section: { margin: desktopOpened ? undefined : 0 },
                            body: {
                                // 限制描述文字过长时显示省略号
                                overflow: 'hidden'
                            },
                            description: {
                                fontSize: '10px',
                                opacity: 0.7,
                                marginTop: '2px'
                            }
                        }}
                    >
                        {desktopOpened && hasChildren && renderNavNodes(node.children)}
                    </NavLink>
                </Tooltip>
            );
        });
    };

    const activeTool = TOOLS_REGISTRY.find((t) => t.id === activeId);

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{
                width: desktopOpened ? 280 : 80,
                breakpoint: 'sm',
                collapsed: { mobile: !mobileOpened },
            }}
            padding="md"
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
                                opacity: desktopOpened ? 1 : 0,
                                display: desktopOpened ? 'block' : 'none',
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
            <AppShell.Main bg="var(--mantine-color-gray-0)">
                <ToolErrorBoundary key={activeId}>
                    <Suspense
                        fallback={
                            <Stack align="center" justify="center" h="100%" gap="md">
                                <Loader size="lg" type="dots" />
                                <Text size="sm" c="dimmed">正在加载工具模块...</Text>
                            </Stack>
                        }
                    >
                        <Box p="md" maw={1200} mx="auto">
                            {activeTool ? (
                                <activeTool.component />
                            ) : (
                                <Stack align="center" mt={100}>
                                    <IconInfoCircle size={48} color="var(--mantine-color-gray-4)" />
                                    <Text c="dimmed">未找到该工具，请重新选择</Text>
                                </Stack>
                            )}
                        </Box>
                    </Suspense>
                </ToolErrorBoundary>
            </AppShell.Main>
        </AppShell>
    );
}