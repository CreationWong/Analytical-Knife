import { useState, useEffect, useMemo } from 'react';
import {
    Paper, Textarea, NumberInput, Button, Stack, Tabs,
    Group, Text, Table, Badge, ActionIcon, CopyButton, Tooltip,
    Switch, SegmentedControl, LoadingOverlay, Divider
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconLock, IconLockOpen, IconAnalyze, IconCopy, IconCheck } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { handleAppError } from '../../utils/error.tsx';
import { showNotification } from '../../utils/notifications.tsx';
import { useAppSettings } from '../../hooks/useAppSettings.ts';

// --- 类型定义 ---
type AlgorithmVariant = 'standard' | 'rot18' | 'rot47';

interface CrackResult {
    label: string;
    text: string;
    score: number;
}

interface Preset {
    label: string;
    value: number;
    variant: AlgorithmVariant;
    shiftNums?: boolean;
}

// --- 预设配置 ---
const PRESETS: Preset[] = [
    { label: 'Standard (ROT3)', value: 3, variant: 'standard', shiftNums: false },
    { label: 'ROT5 (Digits)', value: 5, variant: 'standard', shiftNums: true },
    { label: 'ROT13', value: 13, variant: 'standard', shiftNums: false },
    { label: 'ROT18', value: 0, variant: 'rot18' },
    { label: 'ROT47', value: 0, variant: 'rot47' },
];

export default function CaesarCipher() {
    const [settings] = useAppSettings();
    const primaryColor = settings.primaryColor;
    const [activeTab, setActiveTab] = useState<string | null>('transform');

    // --- 实时转换状态 ---
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [mode, setMode] = useState<string>('encrypt');
    const [isTransforming, setIsTransforming] = useState(false);
    const [inputError, setInputError] = useState<string | null>(null);

    // 算法参数
    const [variant, setVariant] = useState<AlgorithmVariant>('standard');
    const [shift, setShift] = useState<number | ''>(3);
    const [shiftNumbers, setShiftNumbers] = useState(false);

    // --- 暴力破解状态 ---
    const [crackInput, setCrackInput] = useState('');
    const [keyword, setKeyword] = useState('');
    const [crackScope, setCrackScope] = useState<string>('common');
    const [crackResults, setCrackResults] = useState<CrackResult[]>([]);
    const [isCracking, setIsCracking] = useState(false);

    // --- 参数去抖动处理 ---
    const paramObject = useMemo(() => ({
        input,
        shift,
        shiftNumbers,
        mode,
        variant
    }), [input, shift, shiftNumbers, mode, variant]);

    const [debouncedParams] = useDebouncedValue(paramObject, 300);

    // --- 核心转换逻辑 (Effect) ---
    useEffect(() => {
        const runTransform = async () => {
            // 空输入检查
            if (!debouncedParams.input) {
                setOutput('');
                setInputError(null);
                return;
            }

            // 非 ASCII 字符校验
            if (/[^\x00-\x7F]/.test(debouncedParams.input)) {
                const errorMsg = '凯撒密码仅支持标准 ASCII 字符 (英文/数字/标点)';
                setInputError(errorMsg);
                showNotification({
                    type: 'warning',
                    title: '输入格式错误',
                    message: errorMsg,
                    id: 'caesar-validation-warn' // 唯一ID 防止刷屏
                });
                return;
            }

            setInputError(null);
            setIsTransforming(true);

            try {
                const res = await invoke<string>('caesar_transform', {
                    input: debouncedParams.input,
                    shift: Number(debouncedParams.shift) || 0,
                    mode: debouncedParams.mode,
                    shiftNumbers: debouncedParams.shiftNumbers,
                    variant: debouncedParams.variant
                });
                setOutput(res);
            } catch (err) {
                // 实时输入使用警告级别处理
                handleAppError(err, { title: '转换服务异常', isWarning: true });
                setInputError('计算服务暂时不可用');
            } finally {
                setIsTransforming(false);
            }
        };

        runTransform().catch(err => console.error("Effect error:", err));
    }, [debouncedParams]);

    // --- 暴力破解处理 ---
    const handleCrack = async () => {
        if (!crackInput.trim()) return;

        if (/[^\x00-\x7F]/.test(crackInput)) {
            showNotification({
                type: 'warning',
                title: '字符集限制',
                message: '请移除中文或其他非 ASCII 字符以进行准确分析',
            });
            return;
        }

        setIsCracking(true);
        try {
            const res = await invoke<CrackResult[]>('caesar_crack', {
                input: crackInput,
                keyword: keyword.trim() || null,
                scope: crackScope
            });
            setCrackResults(res);

            showNotification({
                type: 'info',
                message: `分析完成，已按置信度排序 (${res.length} 个结果)`
            });
        } catch (err) {
            handleAppError(err, {
                title: '分析失败',
                onRetry: () => handleCrack()
            });
        } finally {
            setIsCracking(false);
        }
    };

    // 应用预设
    const applyPreset = (p: Preset) => {
        setVariant(p.variant);
        if (p.variant === 'standard') {
            setShift(p.value);
            if (p.shiftNums !== undefined) setShiftNumbers(p.shiftNums);
        }
    };

    return (
        <Stack gap="md">
            <Tabs value={activeTab} onChange={setActiveTab} variant="outline">
                <Tabs.List>
                    <Tabs.Tab value="transform" leftSection={mode === 'encrypt' ? <IconLock size={16} /> : <IconLockOpen size={16} />}>
                        实时转换
                    </Tabs.Tab>
                    <Tabs.Tab value="crack" leftSection={<IconAnalyze size={16} />}>
                        暴力破解
                    </Tabs.Tab>
                </Tabs.List>

                {/* --- 面板 1: 实时转换 --- */}
                <Tabs.Panel value="transform" pt="md">
                    <Paper withBorder shadow="xs" p="md" pos="relative">
                        <LoadingOverlay visible={isTransforming} zIndex={1000} overlayProps={{ radius: "sm", blur: 1 }} />
                        <Stack>
                            <SegmentedControl
                                value={mode}
                                onChange={setMode}
                                data={[
                                    { label: '加密 (Encrypt)', value: 'encrypt' },
                                    { label: '解密 (Decrypt)', value: 'decrypt' },
                                ]}
                                color={primaryColor}
                                fullWidth
                            />

                            <Textarea
                                label="输入文本"
                                placeholder={variant === 'rot47' ? "ROT47 支持大部分 ASCII 符号..." : "输入英文或数字..."}
                                value={input}
                                onChange={(e) => setInput(e.currentTarget.value)}
                                autosize
                                minRows={4}
                                maxRows={10}
                                error={inputError}
                            />

                            {/* 控制参数区域 */}
                            <Stack gap="xs">
                                {variant === 'standard' ? (
                                    <Group grow align="flex-end">
                                        <NumberInput
                                            label="位移量 (Shift)"
                                            value={shift}
                                            onChange={(val) => setShift(val === '' ? '' : Number(val))}
                                            min={0}
                                            max={25}
                                        />
                                        <Switch
                                            label="偏移数字 (0-9)"
                                            checked={shiftNumbers}
                                            onChange={(event) => setShiftNumbers(event.currentTarget.checked)}
                                            pb={8}
                                        />
                                    </Group>
                                ) : (
                                    <Paper withBorder p="xs" bg="var(--mantine-color-gray-light)">
                                        <Text size="sm" c="dimmed" ta="center">
                                            当前模式: <b>{variant.toUpperCase()}</b> —— 固定算法，无需配置参数。
                                        </Text>
                                    </Paper>
                                )}

                                <Divider label="预设 / Presets" labelPosition="center" my="xs" />

                                <Group gap="xs" justify="center">
                                    {PRESETS.map((preset) => {
                                        const isActive = variant === preset.variant &&
                                            (preset.variant !== 'standard' || shift === preset.value);

                                        return (
                                            <Badge
                                                key={preset.label}
                                                variant={isActive ? "filled" : "outline"}
                                                color={isActive ? primaryColor : "gray"}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => applyPreset(preset)}
                                                size="lg"
                                            >
                                                {preset.label}
                                            </Badge>
                                        );
                                    })}
                                </Group>
                            </Stack>

                            {/* 结果输出 */}
                            <Paper withBorder p="sm" bg="var(--mantine-color-default-hover)" style={{ minHeight: '60px' }}>
                                <Group justify="space-between" align="start">
                                    <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                                        {output || <Text c="dimmed" fs="italic" size="sm">等待输入...</Text>}
                                    </Text>
                                    {output && (
                                        <CopyButton value={output} timeout={2000}>
                                            {({ copied, copy }) => (
                                                <Tooltip label={copied ? '已复制' : '复制结果'}>
                                                    <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                                                        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                                    </ActionIcon>
                                                </Tooltip>
                                            )}
                                        </CopyButton>
                                    )}
                                </Group>
                            </Paper>
                        </Stack>
                    </Paper>
                </Tabs.Panel>

                {/* --- 面板 2: 暴力破解 --- */}
                <Tabs.Panel value="crack" pt="md">
                    <Paper withBorder shadow="xs" p="md">
                        <Stack>
                            <Group justify="space-between" align="center">
                                <Text size="sm" fw={500}>破解范围</Text>
                                <SegmentedControl
                                    size="xs"
                                    value={crackScope}
                                    onChange={setCrackScope}
                                    data={[
                                        { label: '常用算法 (ROT3/5/13/18/47)', value: 'common' },
                                        { label: '全量穷举 (-26 ~ 26)', value: 'full' },
                                    ]}
                                    color={primaryColor}
                                />
                            </Group>

                            <Textarea
                                label="密文输入"
                                placeholder="输入未知密文（支持多行）..."
                                value={crackInput}
                                onChange={(e) => setCrackInput(e.currentTarget.value)}
                                autosize
                                minRows={3}
                            />

                            <Textarea
                                label="关键词筛选 (可选)"
                                placeholder="输入可能包含的单词 (如: FLAG, THE) 以提高评分权重"
                                value={keyword}
                                onChange={(e) => setKeyword(e.currentTarget.value)}
                                autosize
                                rows={1}
                            />

                            <Button
                                loading={isCracking}
                                color={primaryColor}
                                onClick={handleCrack}
                                leftSection={<IconAnalyze size={16} />}
                                fullWidth
                            >
                                开始分析
                            </Button>

                            {crackResults.length > 0 && (
                                <Table striped highlightOnHover withTableBorder>
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th w={140}>算法 / 位移</Table.Th>
                                            <Table.Th w={100}>置信度</Table.Th>
                                            <Table.Th>解码预览</Table.Th>
                                            <Table.Th w={50}></Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {crackResults.map((item, index) => (
                                            <Table.Tr key={`${item.label}-${index}`}>
                                                <Table.Td>
                                                    <Badge
                                                        variant="outline"
                                                        color={['ROT13', 'ROT18', 'ROT47'].includes(item.label) ? primaryColor : 'gray'}
                                                    >
                                                        {item.label}
                                                    </Badge>
                                                </Table.Td>
                                                <Table.Td>
                                                    {index === 0 ? (
                                                        <Badge size="xs" color="green" variant="light">最佳匹配</Badge>
                                                    ) : (
                                                        <Text size="xs" c="dimmed">{item.score.toFixed(1)}</Text>
                                                    )}
                                                </Table.Td>
                                                <Table.Td style={{ wordBreak: 'break-all' }}>
                                                    <Text size="sm" lineClamp={2} style={{ fontFamily: 'monospace' }}>
                                                        {item.text}
                                                    </Text>
                                                </Table.Td>
                                                <Table.Td>
                                                    <CopyButton value={item.text}>
                                                        {({ copied, copy }) => (
                                                            <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                                                                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                                            </ActionIcon>
                                                        )}
                                                    </CopyButton>
                                                </Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            )}
                        </Stack>
                    </Paper>
                </Tabs.Panel>
            </Tabs>
        </Stack>
    );
}