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
import { IconChevronLeft, IconChevronRight, IconLayoutDashboard } from '@tabler/icons-react';
import { TOOLS_REGISTRY } from './registry';
import { ToolErrorBoundary } from './components/ErrorBoundary';

// 树节点接口定义
interface TreeNode {
    label: string;
    children: Record<string, TreeNode>;
    toolId?: string;
}

export default function App() {
    // mobileOpened: 移动端抽屉开关
    // desktopOpened: 桌面端侧边栏展开/收起状态 (true 为展开，false 为收起)
    const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
    const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);

    // 默认激活第一个工具
    const [activeId, setActiveId] = useState<string>(TOOLS_REGISTRY[0]?.id || '');

    // 将扁平列表转换为树结构 (基于 path 字段)
    const toolTree = useMemo(() => {
        const root: Record<string, TreeNode> = {};

        TOOLS_REGISTRY.forEach((tool) => {
            const parts = tool.path.split('/');
            let currentLevel = root;

            parts.forEach((part, index) => {
                if (!currentLevel[part]) {
                    currentLevel[part] = { label: part, children: {} };
                }

                // 如果是路径的最后一部分，则关联工具 ID
                if (index === parts.length - 1) {
                    currentLevel[part].toolId = tool.id;
                    currentLevel[part].label = tool.name;
                }

                currentLevel = currentLevel[part].children;
            });
        });
        return root;
    }, []);

    // 递归渲染 NavLink 函数
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
                    disabled={desktopOpened} // 展开时不显示 Tooltip
                    withArrow
                >
                    <NavLink
                        label={desktopOpened ? node.label : null}
                        leftSection={tool?.icon ? <tool.icon size="1.2rem" stroke={1.5} /> : <IconLayoutDashboard size="1.1rem" stroke={1.5} />}
                        active={isLeaf && activeId === node.toolId}
                        childrenOffset={desktopOpened ? 20 : 0}
                        // 默认展开有子节点的父级，但在收起模式下关闭所有子菜单
                        defaultOpened={!isLeaf && desktopOpened}
                        onClick={() => {
                            if (isLeaf && node.toolId) {
                                setActiveId(node.toolId);
                                if (mobileOpened) toggleMobile();
                            }
                        }}
                        styles={{
                            root: {
                                borderRadius: 'var(--mantine-radius-sm)',
                                marginBottom: '2px',
                                justifyContent: desktopOpened ? 'flex-start' : 'center',
                            },
                            section: {
                                margin: desktopOpened ? undefined : 0,
                            }
                        }}
                    >
                        {/* 仅在侧边栏展开且有子节点时进行递归 */}
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
                width: desktopOpened ? 280 : 80, // 动态宽度
                breakpoint: 'sm',
                collapsed: { mobile: !mobileOpened },
            }}
            padding="md"
            transitionDuration={300} // 平滑折叠动画
            transitionTimingFunction="ease"
        >
            {/* Header 区域 */}
            {/* Header 区域 */}
            <AppShell.Header p="md">
                <Group h="100%" px="md" justify="space-between" align="center" wrap="nowrap">
                    <Group align="center" gap="sm">
                        {/* 移动端菜单按钮 */}
                        <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />

                        {/* 工具箱图标 */}
                        {/*<Box style={{ color: 'var(--mantine-color-blue-filled)' }}>*/}
                        {/*    <IconLayoutDashboard size="1.8rem" stroke={2} />*/}
                        {/*</Box>*/}

                        {/* 标题文字 */}
                        <Text
                            fw={800}
                            size="xl"
                            variant="gradient"
                            gradient={{ from: 'blue', to: 'cyan' }}
                            style={{
                                transition: 'opacity 0.2s ease',
                                display: 'block', // 彻底移除占位
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {__APP_NAME__}
                        </Text>
                    </Group>

                    {/* 桌面端收起/展开按钮 */}
                    <ActionIcon
                        variant="light"
                        onClick={toggleDesktop}
                        visibleFrom="sm"
                        size="lg"
                        radius="md"
                        title={desktopOpened ? "收起菜单" : "展开菜单"}
                    >
                        {desktopOpened ? <IconChevronLeft size="1.2rem" /> : <IconChevronRight size="1.2rem" />}
                    </ActionIcon>
                </Group>
            </AppShell.Header>

            {/* Navbar 区域 */}
            <AppShell.Navbar p="xs">
                <AppShell.Section component={ScrollArea} grow>
                    <Stack gap={4}>
                        {renderNavNodes(toolTree)}
                    </Stack>
                </AppShell.Section>

                {/* Navbar 底部预留 */}
                <AppShell.Section p="xs" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
                    <Text size="xs" c="dimmed" ta="center">
                        {desktopOpened ? __APP_VERSION__ : __SHORT_VERSION__}
                    </Text>
                </AppShell.Section>
            </AppShell.Navbar>

            {/* Main 内容区域 */}
            <AppShell.Main bg="var(--mantine-color-gray-0)">
                <ToolErrorBoundary key={activeId}>
                    <Suspense
                        fallback={
                            <Stack align="center" justify="center" h="100%" gap="md">
                                <Loader size="lg" type="dots" />
                                <Text size="sm" c="dimmed">正在初始化工具...</Text>
                            </Stack>
                        }
                    >
                        {activeTool ? (
                            <Box p="md">
                                <activeTool.component />
                            </Box>
                        ) : (
                            <Stack align="center" mt={100}>
                                <Text c="dimmed">请从左侧选择一个工具开始使用</Text>
                            </Stack>
                        )}
                    </Suspense>
                </ToolErrorBoundary>
            </AppShell.Main>
        </AppShell>
    );
}