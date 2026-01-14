import { useState, useMemo, useEffect } from 'react';
import {
    Stack, Textarea, Title, SegmentedControl, Group, ActionIcon,
    Tooltip, CopyButton, Space, Text, Paper, Divider, Box, Button
} from '@mantine/core';
import { IconCopy, IconCheck, IconExchange, IconTrash } from '@tabler/icons-react';
import { showNotification } from '../../utils/notifications';

// --- 核心逻辑域 ---

/**
 * UTF-8 安全的 Base64 编码
 */
export const base64Encode = (str: string): string => {
    if (!str) return '';
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
    ));
};

/**
 * 校验 Base64 字符串合法性
 * 采用逻辑返回而非抛出异常
 */
export const isValidBase64 = (str: string): boolean => {
    const cleanedStr = str.replace(/\s/g, '');
    if (!cleanedStr) return true;
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    return base64Regex.test(cleanedStr) && cleanedStr.length % 4 === 0;
};

/**
 * UTF-8 安全的 Base64 解码
 */
export const base64Decode = (str: string): string | null => {
    const cleanedStr = str.replace(/\s/g, '');
    if (!cleanedStr) return '';

    // 逻辑检查替代 throw 语句
    if (!isValidBase64(cleanedStr)) return null;

    try {
        return decodeURIComponent(
            Array.from(atob(cleanedStr)).map(char =>
                '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2)
            ).join('')
        );
    } catch {
        return null; // 捕获 atob 可能出现的底层异常
    }
};

// --- 组件域 ---

enum Mode {
    ENCODE = 'encode',
    DECODE = 'decode'
}

export default function Base64Tool() {
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<Mode>(Mode.ENCODE);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const result = useMemo(() => {
        if (!input.trim()) return { data: '', error: false };

        if (mode === Mode.ENCODE) {
            return { data: base64Encode(input), error: false };
        } else {
            const decoded = base64Decode(input);
            return decoded !== null
                ? { data: decoded, error: false }
                : { data: '无效的 Base64 字符串', error: true };
        }
    }, [input, mode]);

    const handleSwapContent = () => {
        if (result.data && !result.error) {
            setInput(result.data);
            setMode(mode === Mode.ENCODE ? Mode.DECODE : Mode.ENCODE);
            showNotification({ type: 'info', message: '内容已交换并切换模式' });
        }
    };

    useEffect(() => {
        if (input) setLastUpdated(new Date());
    }, [input, mode]);

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
                    error={result.error ? '格式校验失败' : false}
                />

                <Group mt="xs" gap="xs">
                    <Tooltip label="交换内容并切换模式">
                        <ActionIcon
                            variant="light"
                            color="orange"
                            onClick={handleSwapContent}
                            disabled={!result.data || result.error}
                        >
                            <IconExchange size={18} />
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label="清空输入">
                        <ActionIcon variant="light" color="red" onClick={() => setInput('')}>
                            <IconTrash size={18} />
                        </ActionIcon>
                    </Tooltip>
                    <Space style={{ flex: 1 }} />
                    <CopyButton value={result.data}>
                        {({ copied, copy }) => (
                            <Button
                                size="xs"
                                variant="light"
                                color={copied ? 'teal' : 'blue'}
                                onClick={copy}
                                disabled={result.error || !result.data}
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
                        color: result.error ? 'var(--mantine-color-red-6)' : 'inherit'
                    }}
                >
                    {result.data || '等待输入...'}
                </Box>

                {input && !result.error && (
                    <Group mt="md" gap="xl">
                        <Box>
                            <Text size="xs" c="dimmed">输入大小</Text>
                            <Text size="sm" fw={500}>{getByteSize(input)} B</Text>
                        </Box>
                        <Box>
                            <Text size="xs" c="dimmed">输出大小</Text>
                            <Text size="sm" fw={500}>{getByteSize(result.data)} B</Text>
                        </Box>
                        {mode === Mode.ENCODE && (
                            <Box>
                                <Text size="xs" c="dimmed">膨胀率</Text>
                                <Text size="sm" fw={500} c="orange">
                                    +{Math.round((getByteSize(result.data) / getByteSize(input) - 1) * 100)}%
                                </Text>
                            </Box>
                        )}
                    </Group>
                )}
            </Paper>
        </Stack>
    );
}