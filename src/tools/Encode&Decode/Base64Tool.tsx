import { useState, useMemo, useEffect } from 'react';
import {
    Stack, Textarea, Title, SegmentedControl, Group, ActionIcon,
    Tooltip, CopyButton, Space, Text, Paper, Divider, Box, Button
} from '@mantine/core';
import { IconCopy, IconCheck, IconExchange, IconTrash } from '@tabler/icons-react';
import { showNotification } from '../../utils/notifications';
import { useAppSettings } from '../../hooks/useAppSettings';

// --- 核心逻辑域 ---

/**
 * 自动补全 Base64 末尾的等号
 */
const padBase64 = (str: string): string => {
    const diff = str.length % 4;
    return diff === 0 ? str : str + "=".repeat(4 - diff);
};

/**
 * UTF-8 安全的 Base64 编码
 */
export const base64Encode = (str: string): string => {
    if (!str) return '';
    const bytes = new TextEncoder().encode(str);
    const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return btoa(binString);
};

/**
 * UTF-8 安全的 Base64 解码
 */
export const base64Decode = (str: string): string | null => {
    let cleanedStr = str.replace(/\s/g, '');
    if (!cleanedStr) return '';

    // 补全缺失的等号
    cleanedStr = padBase64(cleanedStr);

    // 正则校验合法性
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(cleanedStr) || cleanedStr.length % 4 !== 0) {
        return null;
    }

    try {
        const binString = atob(cleanedStr);
        const bytes = Uint8Array.from(binString, (m) => m.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    } catch (e) {
        return null;
    }
};

// --- 组件域 ---

enum Mode {
    ENCODE = 'encode',
    DECODE = 'decode'
}

export default function Base64Tool() {
    const [settings] = useAppSettings();
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
                    {lastUpdated && (
                        <Text size="xs" c="dimmed">
                            更新于: {lastUpdated.toLocaleTimeString()}
                        </Text>
                    )}
                </Group>
            </Paper>

            <Paper p="md" withBorder bg="var(--mantine-color-default-hover)">
                <Group justify="space-between" mb="xs">
                    <Text fw={600} size="sm">{mode === Mode.ENCODE ? '编码结果' : '解码原文'}</Text>
                    <CopyButton value={result.data}>
                        {({ copied, copy }) => (
                            <Button
                                size="xs"
                                variant="light"
                                color={copied ? 'teal' : settings.primaryColor}
                                onClick={copy}
                                disabled={result.error || !result.data}
                                leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                            >
                                {copied ? '已复制' : '复制结果'}
                            </Button>
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