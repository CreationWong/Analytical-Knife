import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Paper,
    ScrollArea,
    Box,
    useMantineTheme
} from '@mantine/core';
import aboutContent from '../assets/about/home.md?raw';

export default function Home() {
    const theme = useMantineTheme();

    const processedContent = useMemo(() => {
        return aboutContent
            .replace(/\${__APP_NAME__}/g, __APP_NAME__)
            .replace(/\${__APP_VERSION__}/g, __APP_VERSION__);
    }, []);

    return (
        <Box h="100%">
            <Paper
                p="xl"
                radius="md"
                withBorder
                shadow="xs"
                style={{
                    backgroundColor: 'var(--mantine-color-body)',
                }}
            >
                <ScrollArea h="calc(100vh - 160px)" offsetScrollbars type="hover">
                    {/* 使用数据属性或特定的类名控制排版样式 */}
                    <Box className="mantine-typography">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                // 映射 Markdown 元素到 Mantine 样式
                                a: ({ node, ...props }) => (
                                    <a {...props}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       style={{ color: `var(--mantine-color-${theme.primaryColor}-filled)` }}
                                    />
                                ),
                            }}
                        >
                            {processedContent}
                        </ReactMarkdown>
                    </Box>
                </ScrollArea>
            </Paper>
        </Box>
    );
}