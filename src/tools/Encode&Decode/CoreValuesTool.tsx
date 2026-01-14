import { useState, useCallback } from 'react';
import {
    Stack, Textarea, Button, Group, Paper,
    Title, Divider, ActionIcon, Tooltip, Box
} from '@mantine/core';
import {
    IconLock, IconLockOpen, IconCopy,
    IconTrash, IconCheck, IconRefresh
} from '@tabler/icons-react';
import { useClipboard } from '@mantine/hooks';
import { showNotification } from '../../utils/notifications';
import { handleAppError } from '../../utils/error';

// --- 算法部分 ---
const VALUES_LIST = ['富强', '民主', '文明', '和谐', '自由', '平等', '公正', '法治', '爱国', '敬业', '诚信', '友善'];

/**
 * 编码逻辑
 * 示例："我" -> UTF8: E68891 -> 拆分: [10,4, 6, 8, 8, 9, 1] -> 诚信自由公正...
 * 示例："1" -> UTF8: 31 -> 拆分: [3, 1] -> 和谐民主
 */
export const valuesEncode = (text: string): string => {
    if (!text) return '';

    // 强制将所有输入（含数字）通过 UTF-8 转换为十六进制字符串
    // encodeURIComponent 会把 '1' 变成 '1', 把 '我' 变成 '%E6%88%91'
    const hexString = Array.from(new TextEncoder().encode(text))
        .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
        .join('');

    const duo: number[] = [];

    // 逐位处理 Hex 字符
    for (const char of hexString) {
        const val = parseInt(char, 16);
        if (val < 10) {
            duo.push(val);
        } else {
            // 针对 A-F (10-15) 进行随机拆分
            if (Math.random() > 0.5) {
                duo.push(11, val - 6); // 友善引导
            } else {
                duo.push(10, val - 10); // 诚信引导
            }
        }
    }

    // 3. 映射价值观
    return duo.map(index => VALUES_LIST[index]).join('');
};

/**
 * 解码逻辑
 */
export const valuesDecode = (encoded: string): string => {
    if (!encoded) return '';

    const duo: number[] = [];
    const words = encoded.match(/.{1,2}/g) || [];
    for (const word of words) {
        const index = VALUES_LIST.indexOf(word);
        if (index !== -1) duo.push(index);
    }

    const hexChars: string[] = [];
    for (let i = 0; i < duo.length; i++) {
        const current = duo[i];
        if (current < 10) {
            hexChars.push(current.toString(16));
        } else {
            const mode = current;
            i++;
            if (i < duo.length) {
                const next = duo[i];
                const realVal = mode === 11 ? next + 6 : next + 10;
                hexChars.push(realVal.toString(16));
            }
        }
    }

    const fullHex = hexChars.join('');
    try {
        // 将 Hex 每两位一组还原为字节数组
        const bytes = new Uint8Array(
            (fullHex.match(/.{1,2}/g) || []).map(h => parseInt(h, 16))
        );
        return new TextDecoder().decode(bytes);
    } catch (e) {
        handleAppError('解码失败：密文损坏或非标准格式', { isWarning: true });
        return '';
    }
};

// --- 主组件 ---
export default function CoreValuesTool() {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const clipboard = useClipboard({ timeout: 2000 });

    const handleEncode = useCallback(() => {
        if (!input.trim()) return;
        try {
            setOutput(valuesEncode(input));
            showNotification({ type: 'info', message: '编码成功' });
        } catch (err) {
            handleAppError(err, { title: '编码失败' });
        }
    }, [input]);

    const handleDecode = useCallback(() => {
        if (!input.trim()) return;
        try {
            setOutput(valuesDecode(input));
            showNotification({ type: 'info', message: '解码成功' });
        } catch (err) {
            handleAppError('解码失败：输入的格式不是有效的编码字符串', { isWarning: true });
        }
    }, [input]);

    const handleClear = () => {
        setInput('');
        setOutput('');
    };

    const handleExchange = () => {
        setInput(output);
        setOutput('');
    };

    return (
        <Stack gap="md">
            <Paper p="md" withBorder shadow="xs">
                <Group justify="space-between" mb="xs">
                    <Title order={4}>核心价值观加解密</Title>
                    <Group gap={8}>
                        <Tooltip label="交换输入输出">
                            <ActionIcon variant="light" onClick={handleExchange} disabled={!output}>
                                <IconRefresh size={18} />
                            </ActionIcon>
                        </Tooltip>
                        <Tooltip label="清空">
                            <ActionIcon variant="light" color="red" onClick={handleClear}>
                                <IconTrash size={18} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                </Group>

                <Textarea
                    placeholder="输入要处理的文本..."
                    minRows={4}
                    maxRows={10}
                    autosize
                    value={input}
                    onChange={(e) => setInput(e.currentTarget.value)}
                />

                <Group mt="md">
                    <Button
                        leftSection={<IconLock size={18} />}
                        onClick={handleEncode}
                        flex={1}
                    >
                        编码
                    </Button>
                    <Button
                        variant="light"
                        color="green"
                        leftSection={<IconLockOpen size={18} />}
                        onClick={handleDecode}
                        flex={1}
                    >
                        解码
                    </Button>
                </Group>
            </Paper>

            <Paper
                p="md"
                withBorder
                // 使用 CSS 变量适配深色模式背景
                style={{ backgroundColor: 'var(--_paper-bg)' }}
                styles={{ root: { '--_paper-bg': 'var(--mantine-color-default-hover)' } }}
            >
                <Group justify="space-between" mb="xs">
                    <Title order={5}>转换结果</Title>
                    <Tooltip label={clipboard.copied ? "已复制" : "复制结果"}>
                        <ActionIcon
                            variant="subtle"
                            color={clipboard.copied ? 'teal' : 'gray'}
                            onClick={() => clipboard.copy(output)}
                            disabled={!output}
                        >
                            {clipboard.copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                        </ActionIcon>
                    </Tooltip>
                </Group>

                <Divider mb="sm" variant="dashed" />

                <Box
                    component="pre"
                    style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        margin: 0,
                        fontSize: 'var(--mantine-font-size-sm)',
                        fontFamily: 'var(--mantine-font-family-mono)',
                        minHeight: '20px',
                        color: output ? 'inherit' : 'var(--mantine-color-dimmed)'
                    }}
                >
                    {output || '暂无结果'}
                </Box>
            </Paper>
        </Stack>
    );
}