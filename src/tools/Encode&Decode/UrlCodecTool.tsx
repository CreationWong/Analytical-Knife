import { useState, useMemo } from 'react';
import {
    Stack, Textarea, Title, SegmentedControl, Group, ActionIcon,
    Tooltip, CopyButton, Space, Text, Paper, Divider, Box, Checkbox
} from '@mantine/core';
import { IconCopy, IconCheck, IconExchange, IconTrash } from '@tabler/icons-react';
import { useClipboard } from '@mantine/hooks';

// --- 核心逻辑 ---

export const urlEncode = (str: string, encodeAll: boolean = true): string => {
    if (!str) return '';
    // encodeURIComponent 会编码所有特殊字符
    // encodeURI 则保留 URL 结构字符（如 http://, /, ?, #）
    return encodeAll ? encodeURIComponent(str) : encodeURI(str);
};

export const urlDecode = (str: string): string => {
    if (!str) return '';
    try {
        return decodeURIComponent(str);
    } catch {
        throw new Error('无效的 URL 编码格式');
    }
};

export default function UrlCodecTool() {
    const [input, setInput] = useState('');
    const [isEncode, setIsEncode] = useState(true);
    const [encodeAll, setEncodeAll] = useState(true);

    useClipboard({ timeout: 2000 });

    const output = useMemo(() => {
        if (!input.trim()) return '';
        try {
            return isEncode ? urlEncode(input, encodeAll) : urlDecode(input);
        } catch (err) {
            return (err as Error).message;
        }
    }, [input, isEncode, encodeAll]);

    const handleSwap = () => {
        if (output && !output.includes('无效')) {
            setInput(output);
            setIsEncode(!isEncode);
        }
    };

    return (
        <Stack gap="md">
            <Paper p="md" withBorder shadow="xs">
                <Group justify="space-between" mb="md">
                    <Box>
                        <Title order={4}>URL 编解码器</Title>
                        <Text size="xs" c="dimmed">将特殊字符转换为百分比编码格式</Text>
                    </Box>
                    <SegmentedControl
                        size="xs"
                        value={isEncode ? 'en' : 'de'}
                        onChange={(v) => setIsEncode(v === 'en')}
                        data={[{ label: '编码', value: 'en' }, { label: '解码', value: 'de' }]}
                    />
                </Group>

                <Textarea
                    placeholder={isEncode ? "输入原文或 URL..." : "输入 %E4%BD%A0%E5%A5%BD..."}
                    value={input}
                    onChange={(e) => setInput(e.currentTarget.value)}
                    minRows={4}
                    autosize
                    styles={{ input: { fontFamily: 'var(--mantine-font-family-mono)' } }}
                />

                <Group mt="md" gap="xs">
                    {isEncode && (
                        <Checkbox
                            label="编码所有特殊字符"
                            size="xs"
                            checked={encodeAll}
                            onChange={(e) => setEncodeAll(e.currentTarget.checked)}
                        />
                    )}
                    <Space style={{ flex: 1 }} />
                    <Tooltip label="交换输入输出">
                        <ActionIcon variant="light" color="orange" onClick={handleSwap} disabled={!output || output.includes('无效')}>
                            <IconExchange size={18} />
                        </ActionIcon>
                    </Tooltip>
                    <ActionIcon variant="light" color="red" onClick={() => setInput('')} disabled={!input}>
                        <IconTrash size={18} />
                    </ActionIcon>
                </Group>
            </Paper>

            <Paper p="md" withBorder bg="var(--mantine-color-default-hover)">
                <Group justify="space-between" mb="xs">
                    <Text fw={600} size="sm">结果</Text>
                    <CopyButton value={output}>
                        {({ copied, copy }) => (
                            <ActionIcon variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy} disabled={!output}>
                                {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                            </ActionIcon>
                        )}
                    </CopyButton>
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
            </Paper>
        </Stack>
    );
}