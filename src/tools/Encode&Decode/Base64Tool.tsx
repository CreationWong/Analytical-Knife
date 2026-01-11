import { useState, useMemo, useEffect } from 'react';
import {
    Stack,
    Textarea,
    Title,
    SegmentedControl,
    Group,
    ActionIcon,
    Tooltip,
    CopyButton,
    Space,
    Text,
    Paper
} from '@mantine/core';
import { IconCopy, IconCheck, IconExchange, IconTrash } from '@tabler/icons-react';
import { handleAppError } from '../../utils/error';

// 操作模式枚举
enum Mode {
    ENCODE = 'encode',
    DECODE = 'decode'
}

// 支持的模式选项
const MODE_OPTIONS = [
    { label: '编码', value: Mode.ENCODE },
    { label: '解码', value: Mode.DECODE }
];

export default function Base64Tool() {
    try {
        const [input, setInput] = useState('');
        const [mode, setMode] = useState<Mode>(Mode.ENCODE);
        const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

        // 处理 Base64 编码
        const base64Encode = (str: string): string => {
            try {
                // UTF-8 安全编码
                return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
                    String.fromCharCode(parseInt(p1, 16))
                ));
            } catch {
                return '';
            }
        };

        // 处理 Base64 解码
        const base64Decode = (str: string): string => {
            try {
                // UTF-8 安全解码
                return decodeURIComponent(Array.from(atob(str)).map(char =>
                    '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2)
                ).join(''));
            } catch (err) {
                handleAppError(err,{
                    title: '解码失败',
                    message: '无效的 Base64 字符串',
                    isWarning: true,
                })
                return '无效的 Base64 字符串';
            }
        };

        // 计算输出结果
        const output = useMemo(() => {
            if (!input.trim()) return '';

            try {
                if (mode === Mode.ENCODE) {
                    return base64Encode(input);
                } else {
                    return base64Decode(input);
                }
            } catch (err) {
                handleAppError(err, {
                    title: "处理错误",
                    message: `Base64 ${mode === Mode.ENCODE ? '编码' : '解码'}失败`,
                    autoReload: false
                });
                return `错误: ${err instanceof Error ? err.message : '未知错误'}`;
            }
        }, [input, mode]);

        // 清空输入
        const handleClear = () => {
            setInput('');
        };

        // 交换输入输出
        const handleSwapContent = () => {
            if (output && !output.includes('错误')) {
                setInput(output);
            }
        };

        // 更新最后操作时间
        useEffect(() => {
            if (input) {
                setLastUpdated(new Date());
            }
        }, [input, mode]);

        // 输入框占位符
        const inputPlaceholder = mode === Mode.ENCODE
            ? '输入要编码的文本...'
            : '输入要解码的 Base64 字符串...';

        // 输出框标签
        const outputLabel = mode === Mode.ENCODE
            ? 'Base64 编码结果'
            : '解码后的文本';

        return (
            <Paper p="md" withBorder radius="md">
                <Stack gap="lg">
                    <Group justify="space-between" align="flex-end">
                        <div>
                            <Title order={3}>Base64 转换器</Title>
                            <Text size="sm" c="dimmed" mt={4}>
                                编码和解码
                            </Text>
                        </div>
                        {lastUpdated && (
                            <Text size="xs" c="dimmed">
                                操作: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        )}
                    </Group>

                    {/* 模式选择 */}
                    <SegmentedControl
                        value={mode}
                        onChange={(value) => setMode(value as Mode)}
                        data={MODE_OPTIONS}
                        fullWidth
                    />

                    {/* 输入区域 */}
                    <Textarea
                        label="输入"
                        description={mode === Mode.ENCODE ? "支持任意文本输入" : "请输入有效的 Base64 字符串"}
                        placeholder={inputPlaceholder}
                        value={input}
                        onChange={(e) => setInput(e.currentTarget.value)}
                        minRows={4}
                        maxRows={8}
                        autosize
                        styles={{
                            input: {
                                fontFamily: mode === Mode.DECODE ? 'monospace' : 'inherit',
                                fontSize: mode === Mode.DECODE ? '0.95em' : 'inherit'
                            }
                        }}
                    />

                    {/* 操作按钮组 */}
                    <Group gap="xs">
                        <Tooltip label="清空输入">
                            <ActionIcon
                                size="lg"
                                variant="light"
                                color="red"
                                onClick={handleClear}
                                disabled={!input}
                            >
                                <IconTrash size={18} />
                            </ActionIcon>
                        </Tooltip>

                        <Tooltip label="交换输入输出">
                            <ActionIcon
                                size="lg"
                                variant="light"
                                color="teal"
                                onClick={handleSwapContent}
                                disabled={!output || output.includes('错误')}
                            >
                                <IconExchange size={18} style={{ transform: 'rotate(90deg)' }} />
                            </ActionIcon>
                        </Tooltip>

                        <Space style={{ flex: 1 }} />

                        {/* 复制输出按钮 */}
                        <CopyButton value={output}>
                            {({ copied, copy }) => (
                                <Tooltip label={copied ? '已复制!' : '复制结果'}>
                                    <ActionIcon
                                        size="lg"
                                        color={copied ? 'teal' : 'blue'}
                                        variant="light"
                                        onClick={copy}
                                        disabled={!output}
                                    >
                                        {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                                    </ActionIcon>
                                </Tooltip>
                            )}
                        </CopyButton>
                    </Group>

                    {/* 输出区域 */}
                    <Textarea
                        label={outputLabel}
                        description={output && !output.includes('错误') ? "点击上方复制按钮或双击全选" : ""}
                        value={output}
                        readOnly
                        minRows={4}
                        maxRows={8}
                        autosize
                        styles={{
                            input: {
                                fontFamily: mode === Mode.ENCODE ? 'monospace' : 'inherit',
                                backgroundColor: 'var(--mantine-color-gray-0)',
                                fontSize: mode === Mode.ENCODE ? '0.9em' : 'inherit',
                                cursor: 'text'
                            }
                        }}
                        onDoubleClick={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.select();
                        }}
                    />

                    {/* 统计信息 */}
                    {input && (
                        <Group gap="xl" mt="xs">
                            <Text size="sm" c="dimmed">
                                输入长度: {new Blob([input]).size} 字节
                            </Text>
                            <Text size="sm" c="dimmed">
                                输出长度: {new Blob([output]).size} 字节
                            </Text>
                            {mode === Mode.ENCODE && input.length > 0 && (
                                <Text size="sm" c="dimmed">
                                    增加量: {Math.round((output.length / input.length - 1) * 100)}%
                                </Text>
                            )}
                        </Group>
                    )}

                    {/* 使用说明 */}
                    <Paper p="sm" bg="blue.0" withBorder>
                        <Text size="sm">
                            {mode === Mode.ENCODE
                                ? 'Base64 编码会将数据大小增加约 33%，常用于在文本协议（如 JSON、XML）中传输二进制数据。'
                                : '解码时请确保输入的 Base64 字符串格式正确（仅包含 A-Za-z0-9+/= 字符）。'
                            }
                        </Text>
                    </Paper>
                </Stack>
            </Paper>
        );
    } catch (err) {
        // 全局错误处理
        handleAppError(err, {
            title: "Base64 工具错误",
            autoReload: true,
            reloadDelay: 3000,
        });
        return null;
    }
}