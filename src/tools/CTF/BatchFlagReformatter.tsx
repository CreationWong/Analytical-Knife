import { useState, useEffect } from 'react';
import {
    Stack,
    Textarea,
    TextInput,
    Paper,
    Text,
    Group,
    ActionIcon,
    Tooltip,
} from '@mantine/core';
import { IconFlag3, IconCopy, IconListCheck } from '@tabler/icons-react';
import { useClipboard } from '@mantine/hooks';
import {showNotification} from "../../utils/notifications.ts";

// 提取单个 flag 的 {} 内容
const extractContent = (flag: string): string | null => {
    const start = flag.indexOf('{');
    const end = flag.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    return flag.slice(start + 1, end);
};

export default function BatchFlagReformatter() {
    const [inputFlags, setInputFlags] = useState<string>(
        'flag{hello_ctf}'
    );
    const [newPrefix, setNewPrefix] = useState<string>('CTF');
    const [outputText, setOutputText] = useState<string>('');
    const clipboard = useClipboard();

    useEffect(() => {
        const lines = inputFlags.split('\n');
        const validFlags: string[] = [];
        let invalidCount = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue; // 跳过空行

            const content = extractContent(trimmed);
            if (content !== null) {
                validFlags.push(`${newPrefix.trim()}{${content}}`);
            } else {
                invalidCount++;
            }
        }

        setOutputText(validFlags.join('\n'));

        // 只在有无效行时提示
        if (invalidCount > 0) {
            showNotification({
                type: 'warning',
                title: '部分 flag 格式无效',
                message: `已跳过 ${invalidCount} 行无法识别的格式。`,
                autoClose: 3000,
            });
        }

        setOutputText(validFlags.join('\n'));
    }, [inputFlags, newPrefix]);

    return (
        <Stack gap="md">
            {/* 输入区 */}
            <Paper p="md" radius="md" withBorder>
                <Group align="center" mb="sm">
                    <IconListCheck size={20} />
                    <Text fw={600}>输入原始 Flags（每行一个）</Text>
                </Group>
                <Textarea
                    placeholder={`例如：FLAG{hello}`}
                    value={inputFlags}
                    onChange={(e) => setInputFlags(e.currentTarget.value)}
                    minRows={4}
                    autosize
                    styles={{ input: { fontFamily: 'monospace' } }}
                />
            </Paper>

            {/* 新前缀 */}
            <Paper p="md" radius="md" withBorder>
                <Group align="center" mb="sm">
                    <IconFlag3 size={20} />
                    <Text fw={600}>新 Flag 前缀</Text>
                </Group>
                <TextInput
                    placeholder="例如：CTF"
                    value={newPrefix}
                    onChange={(e) => setNewPrefix(e.currentTarget.value)}
                    styles={{ input: { fontFamily: 'monospace' } }}
                />
            </Paper>

            {/* 输出区 */}
            {outputText && (
                <Paper p="md" radius="md" withBorder>
                    <Group justify="space-between" mb="sm">
                        <Text fw={600}>转换结果</Text>
                        <Tooltip label="复制全部">
                            <ActionIcon
                                onClick={() => clipboard.copy(outputText)}
                                variant="light"
                                color="blue"
                            >
                                <IconCopy size={16} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                    <Textarea
                        value={outputText}
                        readOnly
                        minRows={6}
                        autosize
                        styles={{
                            input: {
                                fontFamily: 'monospace',
                                backgroundColor: '#f8f9fa',
                                fontSize: '0.95em',
                            },
                        }}
                    />
                </Paper>
            )}
        </Stack>
    );
}