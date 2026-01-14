import { useState, useMemo, useEffect } from 'react';
import {
    Stack, Textarea, Title, SegmentedControl, Group, ActionIcon,
    Tooltip, CopyButton, Space, Text, Paper, Divider, Box, Button
} from '@mantine/core';
import { IconCopy, IconCheck, IconExchange, IconTrash } from '@tabler/icons-react';

// --- 核心逻辑 ---
export const base64Encode = (str: string): string => {
    try {
        if (!str) return '';
        // UTF-8 Base64 编码方案
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
            String.fromCharCode(parseInt(p1, 16))
        ));
    } catch {
        return '';
    }
};

export const base64Decode = (str: string): string => {
    try {
        if (!str) return '';

        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        const cleanedStr = str.replace(/\s/g, ''); // 移除空格

        if (!base64Regex.test(cleanedStr) || cleanedStr.length % 4 !== 0) {
            throw new Error('无效的 Base64 字符串');
        }

        return decodeURIComponent(
            Array.from(atob(cleanedStr)).map(char =>
                '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2)
            ).join('')
        );
    } catch (err) {
        throw new Error('无效的 Base64 字符串');
    }
};

enum Mode {
    ENCODE = 'encode',
    DECODE = 'decode'
}

export default function Base64Tool() {
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<Mode>(Mode.ENCODE);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const output = useMemo(() => {
        if (!input.trim()) return '';
        try {
            return mode === Mode.ENCODE ? base64Encode(input) : base64Decode(input);
        } catch (err) {
            // 解码失败时不阻塞渲染，仅返回提示
            return (err as Error).message;
        }
    }, [input, mode]);

    const handleSwapContent = () => {
        if (output && !output.includes('无效')) {
            setInput(output);
            setMode(mode === Mode.ENCODE ? Mode.DECODE : Mode.ENCODE);
        }
    };

    useEffect(() => {
        if (input) setLastUpdated(new Date());
    }, [input, mode]);

    // 计算字节大小
    const getByteSize = (str: string) => new TextEncoder().encode(str).length;

    return (
        <Stack gap="md">
            <Paper p="md" withBorder shadow="xs">
                <Group justify="space-between" mb="md">
                    <Box>
                        <Title order={4}>Base64 转换器</Title>
                        <Text size="xs" c="dimmed">支持 UTF-8 字符的安全编解码</Text>
                    </Box>
                    <SegmentedControl
                        size="xs"
                        value={mode}
                        onChange={(v) => setMode(v as Mode)}
                        data={[{ label: '编码', value: Mode.ENCODE }, { label: '解码', value: Mode.DECODE }]}
                    />
                </Group>

                <Textarea
                    placeholder={mode === Mode.ENCODE ? "输入原文..." : "输入 Base64..."}
                    value={input}
                    onChange={(e) => setInput(e.currentTarget.value)}
                    minRows={4}
                    autosize
                    styles={{ input: { fontFamily: 'var(--mantine-font-family-mono)' } }}
                />

                <Group mt="xs" gap="xs">
                    <Tooltip label="交换并切换模式">
                        <ActionIcon variant="light" color="orange" onClick={handleSwapContent} disabled={!output || output.includes('无效')}>
                            <IconExchange size={18} />
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label="清空">
                        <ActionIcon variant="light" color="red" onClick={() => setInput('')}>
                            <IconTrash size={18} />
                        </ActionIcon>
                    </Tooltip>
                    <Space style={{ flex: 1 }} />
                    <CopyButton value={output}>
                        {({ copied, copy }) => (
                            <Button
                                size="xs"
                                variant="light"
                                color={copied ? 'teal' : 'blue'}
                                onClick={copy}
                                leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                            >
                                {copied ? '已复制' : '复制结果'}
                            </Button>
                        )}
                    </CopyButton>
                </Group>
            </Paper>

            <Paper p="md" withBorder bg="var(--mantine-color-default-hover)">
                <Group justify="space-between" mb="xs">
                    <Text fw={600} size="sm">{mode === Mode.ENCODE ? '编码结果' : '解码原文'}</Text>
                    {lastUpdated && (
                        <Text size="xs" c="dimmed">
                            更新于: {lastUpdated.toLocaleTimeString()}
                        </Text>
                    )}
                </Group>
                <Divider mb="sm" variant="dashed" />
                <Box
                    component="pre"
                    style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        fontFamily: 'var(--mantine-font-family-mono)',
                        fontSize: 'var(--mantine-font-size-sm)',
                        minHeight: '40px',
                        color: output.includes('无效') ? 'var(--mantine-color-red-6)' : 'inherit'
                    }}
                >
                    {output || '等待输入...'}
                </Box>

                {input && !output.includes('无效') && (
                    <Group mt="md" gap="xl">
                        <Box>
                            <Text size="xs" c="dimmed">输入大小</Text>
                            <Text size="sm" fw={500}>{getByteSize(input)} Bytes</Text>
                        </Box>
                        <Box>
                            <Text size="xs" c="dimmed">输出大小</Text>
                            <Text size="sm" fw={500}>{getByteSize(output)} Bytes</Text>
                        </Box>
                        {mode === Mode.ENCODE && (
                            <Box>
                                <Text size="xs" c="dimmed">膨胀率</Text>
                                <Text size="sm" fw={500} c="orange">
                                    +{Math.round((getByteSize(output) / getByteSize(input) - 1) * 100)}%
                                </Text>
                            </Box>
                        )}
                    </Group>
                )}
            </Paper>
        </Stack>
    );
}