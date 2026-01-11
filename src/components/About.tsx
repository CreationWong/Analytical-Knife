import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {Container, Paper, ScrollArea} from '@mantine/core';
// 使用 ?raw 获取文件字符串内容
import aboutContent from '../assets/about/info.md?raw';

export default function About() {
    return (
        <Container size="md" py="xl">
            <Paper p="xl" radius="md" withBorder shadow="sm">
                <ScrollArea h="calc(100vh - 200px)" offsetScrollbars>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {/* 动态替换 MD 中的变量占位符 */}
                        {aboutContent
                            .replace(/\${__APP_NAME__}/g, __APP_NAME__)
                            .replace(/\${__APP_VERSION__}/g, __APP_VERSION__)}
                    </ReactMarkdown>
                </ScrollArea>
            </Paper>
        </Container>
    );
}