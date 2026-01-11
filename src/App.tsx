import { useState, Suspense, useMemo } from 'react';
import { AppShell, Burger, NavLink, Text, ScrollArea, Loader, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { TOOLS_REGISTRY } from './registry';
import { ToolErrorBoundary } from './components/ErrorBoundary';

// 定义树节点结构
interface TreeNode {
    label: string;
    children: Record<string, TreeNode>;
    toolId?: string; // 如果是叶子节点，记录工具 ID
}

export default function App() {
    const [opened, { toggle }] = useDisclosure();
    const [activeId, setActiveId] = useState<string>(TOOLS_REGISTRY[0].id);

    // 将扁平列表转换为树结构
    const toolTree = useMemo(() => {
        const root: Record<string, TreeNode> = {};

        TOOLS_REGISTRY.forEach((tool) => {
            const parts = tool.path.split('/');
            let currentLevel = root;

            parts.forEach((part, index) => {
                if (!currentLevel[part]) {
                    currentLevel[part] = { label: part, children: {} };
                }

                // 如果是路径的最后一部分，标记为工具节点
                if (index === parts.length - 1) {
                    currentLevel[part].toolId = tool.id;
                    currentLevel[part].label = tool.name; // 叶子节点显示工具名称
                }

                currentLevel = currentLevel[part].children;
            });
        });
        return root;
    }, []);

    // 递归渲染 NavLink
    const renderNavNodes = (nodes: Record<string, TreeNode>) => {
        return Object.entries(nodes).map(([key, node]) => {
            const isLeaf = !!node.toolId;
            const tool = isLeaf ? TOOLS_REGISTRY.find(t => t.id === node.toolId) : null;

            return (
                <NavLink
                    key={key}
                    label={node.label}
                    leftSection={tool?.icon ? <tool.icon size="1rem" /> : null}
                    active={isLeaf && activeId === node.toolId}
                    childrenOffset={20}
                    defaultOpened={!isLeaf} // 默认展开文件夹
                    onClick={() => {
                        if (isLeaf && node.toolId) {
                            setActiveId(node.toolId);
                            if (opened) toggle(); // 移动端点击后关闭侧边栏
                        }
                    }}
                >
                    {Object.keys(node.children).length > 0 && renderNavNodes(node.children)}
                </NavLink>
            );
        });
    };

    const activeTool = TOOLS_REGISTRY.find((t) => t.id === activeId);

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{ width: 280, breakpoint: 'sm', collapsed: { mobile: !opened } }}
            padding="md"
        >
            <AppShell.Header p="md" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
                <Text fw={700} size="xl" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
                    Analytical Knife
                </Text>
            </AppShell.Header>

            <AppShell.Navbar p="xs">
                <ScrollArea>
                    <Stack gap={2}>
                        {renderNavNodes(toolTree)}
                    </Stack>
                </ScrollArea>
            </AppShell.Navbar>

            <AppShell.Main>
                <ToolErrorBoundary key={activeId}>
                    <Suspense fallback={<Stack align="center" mt="xl"><Loader size="md" /><Text size="sm">加载中...</Text></Stack>}>
                        {activeTool && <activeTool.component />}
                    </Suspense>
                </ToolErrorBoundary>
            </AppShell.Main>
        </AppShell>
    );
}