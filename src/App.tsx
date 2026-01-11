import { AppShell, Burger, NavLink, Text, ScrollArea } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState, Suspense } from 'react';
import { TOOLS_REGISTRY } from './registry';
import {ToolErrorBoundary} from "./components/ErrorBoundary.tsx";
import {Loader} from "lucide-react";

export default function App() {
    const [opened, { toggle }] = useDisclosure();
    const [activeId, setActiveId] = useState(TOOLS_REGISTRY[0].id);

    const activeTool = TOOLS_REGISTRY.find(t => t.id === activeId);

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
            padding="md"
        >
            <AppShell.Header p="md" style={{ display: 'flex', alignItems: 'center' }}>
                <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
                <Text size="lg" fw={700}>Analytical Knife</Text>

            </AppShell.Header>

            <AppShell.Navbar p="xs">
                <ScrollArea>
                    {TOOLS_REGISTRY.map((tool) => (
                        <NavLink
                            key={tool.id}
                            active={tool.id === activeId}
                            label={tool.name}
                            description={tool.description}
                            leftSection={<tool.icon size="1.2rem" />}
                            onClick={() => setActiveId(tool.id)}
                        />
                    ))}
                </ScrollArea>
            </AppShell.Navbar>

            <AppShell.Main>
                <ToolErrorBoundary key={activeId}>
                    <Suspense fallback={<Loader />}>
                        {activeTool && <activeTool.component />}
                    </Suspense>
                </ToolErrorBoundary>
            </AppShell.Main>
        </AppShell>
    );
}