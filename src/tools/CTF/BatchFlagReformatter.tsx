import React, {useState, useEffect, JSX} from 'react';
import {
    Stack,
    Textarea,
    TextInput,
    Paper,
    Text,
    Group,
    ActionIcon,
    Tooltip,
    Divider,
    Box,
} from '@mantine/core';
import { IconFlag3, IconCopy, IconListCheck, IconCheck, IconExclamationCircle } from '@tabler/icons-react';
import { useClipboard } from '@mantine/hooks';
import { showNotification } from "../../utils/notifications";

// --- 核心逻辑 ---

/**
 * 提取 Flag 中花括号内部的内容
 * 采用 indexOf 和 lastIndexOf 以支持内容中嵌套花括号的情况
 */
export const extractFlagContent = (flag: string): string | null => {
    const start = flag.indexOf('{');
    const end = flag.lastIndexOf('}');
    // 确保括号存在且中间有内容
    if (start === -1 || end === -1 || end <= start + 1) return null;
    return flag.slice(start + 1, end);
};

/**
 * 批量处理函数
 */
export const reformatFlagsLogic = (input: string, prefix: string) => {
    const lines = input.split('\n');
    const validFlags: string[] = [];
    let invalidCount = 0;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue; // 跳过空行

        const content = extractFlagContent(trimmed);
        if (content !== null) {
            validFlags.push(`${prefix.trim()}{${content}}`);
        } else {
            invalidCount++;
        }
    }

    return {
        output: validFlags.join('\n'),
        invalidCount,
        totalValid: validFlags.length
    };
};

// --- 组件部分 ---

export default function BatchFlagReformatter() {
    const [inputFlags, setInputFlags] = useState<string>('flag{hello_ctf}\noriginal{example_data}');
    const [newPrefix, setNewPrefix] = useState<string>('CTF');
    const [outputText, setOutputText] = useState<string>('');
    const clipboard = useClipboard({ timeout: 2000 });

    useEffect(() => {
        const { output, invalidCount } = reformatFlagsLogic(inputFlags, newPrefix);

        setOutputText(output);

        // 当用户停止输入且存在无效行时尝试提醒
        if (invalidCount > 0 && inputFlags.length > 20) {
            const timer = setTimeout(() => {
                showNotification({
                    type: 'warning',
                    title: '格式解析提示',
                    message: `已自动跳过 ${invalidCount} 行格式不规范的内容`,
                    autoClose: 2000,
                });
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [inputFlags, newPrefix]);

    return (
        <Stack gap="md">
            <Box>
                <Title order={4}>批量 Flag 格式转换</Title>
                <Text size="xs" c="dimmed">批量提取并重命名 CTF Flag 前缀</Text>
            </Box>

            <Group grow align="flex-start" wrap="wrap">
                {/* 配置区 */}
                <Stack gap="md">
                    <Paper p="md" radius="md" withBorder shadow="xs">
                        <Group align="center" mb="xs">
                            <IconFlag3 size={18} color="var(--mantine-color-blue-filled)" />
                            <Text fw={600} size="sm">新前缀设置</Text>
                        </Group>
                        <TextInput
                            placeholder="例如: CTF, FLAG, EIS"
                            value={newPrefix}
                            onChange={(e) => setNewPrefix(e.currentTarget.value)}
                            styles={{ input: { fontFamily: 'var(--mantine-font-family-mono)' } }}
                        />
                    </Paper>

                    <Paper p="md" radius="md" withBorder shadow="xs">
                        <Group align="center" mb="xs">
                            <IconListCheck size={18} color="var(--mantine-color-teal-filled)" />
                            <Text fw={600} size="sm">原始 Flags 输入</Text>
                        </Group>
                        <Textarea
                            placeholder="每行一个 Flag..."
                            value={inputFlags}
                            onChange={(e) => setInputFlags(e.currentTarget.value)}
                            minRows={8}
                            autosize
                            styles={{ input: { fontFamily: 'var(--mantine-font-family-mono)', fontSize: '13px' } }}
                        />
                    </Paper>
                </Stack>

                {/* 结果显示区 */}
                <Paper p="md" radius="md" withBorder bg="var(--mantine-color-default-hover)" style={{ flex: 1.5 }}>
                    <Group justify="space-between" mb="xs">
                        <Group gap="xs">
                            <Text fw={600} size="sm">转换结果</Text>
                            {outputText && (
                                <Text size="xs" c="dimmed">
                                    共 {outputText.split('\n').length} 项
                                </Text>
                            )}
                        </Group>

                        <Group gap={5}>
                            <Tooltip label={clipboard.copied ? "已复制" : "全部复制"}>
                                <ActionIcon
                                    onClick={() => clipboard.copy(outputText)}
                                    variant="light"
                                    color={clipboard.copied ? 'teal' : 'blue'}
                                    disabled={!outputText}
                                >
                                    {clipboard.copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                </ActionIcon>
                            </Tooltip>
                        </Group>
                    </Group>

                    <Divider mb="sm" variant="dashed" />

                    <Textarea
                        value={outputText}
                        readOnly
                        placeholder="转换后的内容将在这里实时显示"
                        minRows={14}
                        autosize
                        variant="unstyled"
                        styles={{
                            input: {
                                fontFamily: 'var(--mantine-font-family-mono)',
                                fontSize: '13px',
                                lineHeight: 1.6
                            },
                        }}
                    />

                    {!outputText && !inputFlags && (
                        <Group justify="center" py="xl" c="dimmed">
                            <IconExclamationCircle size={20} />
                            <Text size="sm">暂无有效数据</Text>
                        </Group>
                    )}
                </Paper>
            </Group>
        </Stack>
    );
}

// 辅助 Title 组件
function Title({ children, order }: { children: React.ReactNode; order: 1 | 2 | 3 | 4 }) {
    const Tag = `h${order}` as keyof JSX.IntrinsicElements;
    return <Tag style={{ margin: 0 }}>{children}</Tag>;
}