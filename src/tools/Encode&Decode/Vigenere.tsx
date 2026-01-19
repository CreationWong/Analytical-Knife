import { useState } from 'react';
import {
    Paper,
    Stack,
    Textarea,
    TextInput,
    Button,
    Group,
    SegmentedControl,
    Tabs,
    Title,
    Text,
    Alert,
    ThemeIcon,
    Grid,
    Code,
    ActionIcon,
    CopyButton,
    Tooltip,
    Divider,
    Container
} from '@mantine/core';
import { invoke } from '@tauri-apps/api/core';
import {
    IconLock,
    IconLockOpen,
    IconAnalyze,
    IconKey,
    IconCheck,
    IconAlertTriangle,
    IconMathFunction,
    IconCopy,
    IconCheck as IconSuccess,
    IconArrowRight
} from '@tabler/icons-react';
import { handleAppError } from '../../utils/error';
import { useAppSettings } from '../../hooks/useAppSettings';

// 定义后端返回的破解结果类型
interface CrackResult {
    key: string;
    key_length: number;
    plaintext: string;
    ic_score: number;
}

export default function VigenereTool() {
    const [activeTab, setActiveTab] = useState<string | null>('crypto');
    const [settings] = useAppSettings();
    const primaryColor = settings.primaryColor;

    // --- State: 加解密模块 ---
    const [input, setInput] = useState('THISCRYPTOSYSTEMISNOTSECURE');
    const [key, setKey] = useState('CIPHER');
    const [output, setOutput] = useState('');
    const [mode, setMode] = useState('encrypt');
    const [loadingCipher, setLoadingCipher] = useState(false);

    // --- State: 破解模块 ---
    const [crackInput, setCrackInput] = useState('');
    const [crackResult, setCrackResult] = useState<CrackResult | null>(null);
    const [loadingCrack, setLoadingCrack] = useState(false);

    // 逻辑: 执行加解密
    const handleCipher = async () => {
        if (!input) return;
        setLoadingCipher(true);
        try {
            const res = await invoke<string>('vigenere_cipher', { input, key, mode });
            setOutput(res);
        } catch (err) {
            handleAppError(err);
        } finally {
            setLoadingCipher(false);
        }
    };

    // 逻辑: 执行破解
    const handleCrack = async () => {
        if (!crackInput) return;
        setLoadingCrack(true);
        setCrackResult(null);
        try {
            const res = await invoke<CrackResult>('crack_vigenere_auto', { ciphertext: crackInput });
            setCrackResult(res);
        } catch (err) {
            handleAppError(err);
        } finally {
            setLoadingCrack(false);
        }
    };

    return (
        <Container size="lg" p={0}>
            <Stack gap="lg">
                <Tabs
                    value={activeTab}
                    onChange={setActiveTab}
                    variant="outline"
                    radius="md"
                    styles={{
                        tab: { padding: '12px 20px', fontWeight: 500 }
                    }}
                >
                    <Tabs.List>
                        <Tabs.Tab value="crypto" leftSection={<IconLock size={18} />}>
                            加解密运算
                        </Tabs.Tab>
                        <Tabs.Tab value="analyze" leftSection={<IconAnalyze size={18} />}>
                            唯密文破解
                        </Tabs.Tab>
                    </Tabs.List>

                    {/* ================= 模块一：加解密 ================= */}
                    <Tabs.Panel value="crypto" pt="lg">
                        <Stack gap="md">
                            {/* 原理提示栏 */}
                            <Alert
                                variant="light"
                                color="gray"
                                title="维吉尼亚密码 (Vigenère Cipher)"
                                icon={<IconMathFunction size={18} />}
                                styles={{ message: { marginTop: 4 } }}
                            >
                                <Group gap="xs">
                                    <Text size="sm">经典多表代换密码，公式：</Text>
                                    <Code fw={700}>Cᵢ = (Mᵢ + Kᵢ) mod 26</Code>
                                </Group>
                            </Alert>

                            <Paper withBorder shadow="sm" radius="md" p="lg">
                                <Stack gap="md">
                                    <Grid align="flex-end">
                                        <Grid.Col span={{ base: 12, sm: 8 }}>
                                            <TextInput
                                                label="密钥 (Key)"
                                                placeholder="请输入纯字母密钥 (如: CIPHER)"
                                                value={key}
                                                onChange={(e) => setKey(e.currentTarget.value)}
                                                leftSection={<IconKey size={16} />}
                                                rightSectionWidth={60}
                                                rightSection={
                                                    <Text size="xs" c="dimmed" style={{userSelect: 'none'}}>
                                                        {key.length} chars
                                                    </Text>
                                                }
                                            />
                                        </Grid.Col>
                                        <Grid.Col span={{ base: 12, sm: 4 }}>
                                            <SegmentedControl
                                                fullWidth
                                                value={mode}
                                                onChange={setMode}
                                                data={[
                                                    { label: '加密', value: 'encrypt' },
                                                    { label: '解密', value: 'decrypt' },
                                                ]}
                                            />
                                        </Grid.Col>
                                    </Grid>

                                    <Textarea
                                        label="输入文本"
                                        placeholder="在此输入需要处理的明文或密文..."
                                        minRows={4}
                                        maxRows={10}
                                        autosize
                                        value={input}
                                        onChange={(e) => setInput(e.currentTarget.value)}
                                        styles={{ input: { fontFamily: 'monospace' } }}
                                    />

                                    <Button
                                        fullWidth
                                        size="md"
                                        onClick={handleCipher}
                                        loading={loadingCipher}
                                        color={primaryColor}
                                        leftSection={mode === 'encrypt' ? <IconLock size={20} /> : <IconLockOpen size={20} />}
                                    >
                                        执行{mode === 'encrypt' ? '加密' : '解密'}运算
                                    </Button>
                                </Stack>
                            </Paper>

                            {/* 结果展示区 */}
                            {output && (
                                <Paper
                                    withBorder
                                    shadow="sm"
                                    radius="md"
                                    p="md"
                                    style={{
                                        backgroundColor: 'var(--mantine-color-body)',
                                        borderColor: `var(--mantine-color-${primaryColor}-filled)`
                                    }}
                                >
                                    <Group justify="space-between" mb="xs">
                                        <Group gap="xs">
                                            <ThemeIcon variant="light" color={primaryColor} size="sm">
                                                <IconArrowRight size={14} />
                                            </ThemeIcon>
                                            <Text size="sm" fw={500} c="dimmed">运算结果</Text>
                                        </Group>
                                        <CopyButton value={output} timeout={2000}>
                                            {({ copied, copy }) => (
                                                <Tooltip label={copied ? '已复制' : '复制结果'} withArrow position="left">
                                                    <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                                                        {copied ? <IconSuccess size={16} /> : <IconCopy size={16} />}
                                                    </ActionIcon>
                                                </Tooltip>
                                            )}
                                        </CopyButton>
                                    </Group>
                                    <Paper bg="var(--mantine-color-default)" p="sm" radius="sm" withBorder>
                                        <Text fz="md" style={{ wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.6 }}>
                                            {output}
                                        </Text>
                                    </Paper>
                                </Paper>
                            )}
                        </Stack>
                    </Tabs.Panel>

                    {/* ================= 模块二：破解分析 ================= */}
                    <Tabs.Panel value="analyze" pt="lg">
                        <Stack gap="md">
                            <Alert variant="light" color="blue" title="自动化破解原理 (Cryptanalysis)" icon={<IconAnalyze />}>
                                <Text size="sm" style={{ lineHeight: 1.6 }}>
                                    利用 <b>重合指数 (Index of Coincidence)</b> 确定密钥长度，再通过 <b>拟重合指数 (Chi-square)</b> 频率分析还原密钥。
                                    <br/>
                                    <Text span c="dimmed" size="xs">注意：此方法仅对具有一定长度（推荐 &gt;100字符）的英文段落有效。</Text>
                                </Text>
                            </Alert>

                            <Paper withBorder shadow="sm" radius="md" p="lg">
                                <Stack>
                                    <Textarea
                                        label="待破解密文"
                                        description="请粘贴完整的密文段落"
                                        placeholder="粘贴密文..."
                                        minRows={6}
                                        maxRows={12}
                                        autosize
                                        value={crackInput}
                                        onChange={(e) => setCrackInput(e.currentTarget.value)}
                                        styles={{ input: { fontFamily: 'monospace' } }}
                                    />

                                    <Group justify="flex-end">
                                        <Button
                                            size="md"
                                            onClick={handleCrack}
                                            loading={loadingCrack}
                                            color="red"
                                            variant="light"
                                            leftSection={<IconAnalyze size={20} />}
                                        >
                                            开始自动化分析
                                        </Button>
                                    </Group>
                                </Stack>
                            </Paper>

                            {crackResult && (
                                <Stack gap="md">
                                    <Divider label="分析报告" labelPosition="center" />

                                    <Grid>
                                        <Grid.Col span={6}>
                                            <Paper withBorder p="md" radius="md" bg="var(--mantine-color-body)">
                                                <Stack gap={4} align="center">
                                                    <ThemeIcon size={42} radius="xl" variant="light" color="violet" mb={4}>
                                                        <IconKey size={24} />
                                                    </ThemeIcon>
                                                    <Text c="dimmed" size="xs" tt="uppercase" fw={700}>推测密钥</Text>
                                                    <Title order={3} style={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                                                        {crackResult.key}
                                                    </Title>
                                                </Stack>
                                            </Paper>
                                        </Grid.Col>
                                        <Grid.Col span={6}>
                                            <Paper withBorder p="md" radius="md" bg="var(--mantine-color-body)">
                                                <Stack gap={4} align="center">
                                                    <ThemeIcon
                                                        size={42} radius="xl" variant="light"
                                                        color={crackResult.ic_score > 0.055 ? 'teal' : 'orange'}
                                                        mb={4}
                                                    >
                                                        {crackResult.ic_score > 0.055 ? <IconCheck size={24} /> : <IconAlertTriangle size={24} />}
                                                    </ThemeIcon>
                                                    <Text c="dimmed" size="xs" tt="uppercase" fw={700}>重合指数 (IC)</Text>
                                                    <Text fw={700} size="xl" c={crackResult.ic_score > 0.055 ? 'teal' : 'orange'}>
                                                        {crackResult.ic_score.toFixed(4)}
                                                    </Text>
                                                </Stack>
                                            </Paper>
                                        </Grid.Col>
                                    </Grid>

                                    <Paper withBorder shadow="sm" radius="md" p="md">
                                        <Group justify="space-between" mb="xs">
                                            <Text size="sm" fw={500} c="dimmed">明文恢复预览</Text>
                                            <CopyButton value={crackResult.plaintext} timeout={2000}>
                                                {({ copied, copy }) => (
                                                    <Button
                                                        size="xs"
                                                        variant="subtle"
                                                        color={copied ? 'teal' : 'gray'}
                                                        onClick={copy}
                                                        leftSection={copied ? <IconSuccess size={14}/> : <IconCopy size={14}/>}
                                                    >
                                                        {copied ? '已复制' : '复制全文'}
                                                    </Button>
                                                )}
                                            </CopyButton>
                                        </Group>
                                        <Paper bg="var(--mantine-color-black-0)" p="md" radius="sm" withBorder>
                                            <Text style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '14px' }}>
                                                {crackResult.plaintext}
                                            </Text>
                                        </Paper>
                                    </Paper>
                                </Stack>
                            )}
                        </Stack>
                    </Tabs.Panel>
                </Tabs>
            </Stack>
        </Container>
    );
}