import { useState } from 'react';
import {
    Stack, Textarea, Button, Paper, Group, Checkbox, Title, Table,
    ScrollArea, TextInput, Badge, Grid, Divider, Text, ActionIcon,
    Progress, Tabs, Box
} from '@mantine/core';
import { IconTrash, IconChartBar, IconSettings, IconAbc, IconVocabulary } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { handleAppError } from '../../utils/error';
import { showNotification } from '../../utils/notifications';

// --- 类型定义 ---
interface FreqItem {
    word: string;
    count: number;
    percentage: number;
}

interface AnalysisResponse {
    word_freq: FreqItem[];
    char_freq: FreqItem[];
}

export default function AdvancedWordFreq() {
    const [text, setText] = useState('');
    const [config, setConfig] = useState({
        remove_punct: true,
        remove_digits: false,
        lowercase: true,
        use_stop_words: true,
        stop_words_custom: '',
        split_pattern: '',
    });

    const [results, setResults] = useState<AnalysisResponse>({ word_freq: [], char_freq: [] });
    const [loading, setLoading] = useState(false);

    const onAnalyze = async () => {
        if (!text.trim()) {
            showNotification({ type: 'warning', message: '内容不能为空' });
            return;
        }
        setLoading(true);
        try {
            const res = await invoke<AnalysisResponse>('analyze_text_advanced', {
                config: { ...config, text }
            });
            setResults(res);
            showNotification({ type: 'info', message: '分析完成' });
        } catch (e) {
            handleAppError(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Stack gap="lg">
            <Grid gutter="md">
                <Grid.Col span={{ base: 12, md: 4 }}>
                    <Paper p="md" withBorder shadow="sm" radius="md">
                        <Group mb="xs"><IconSettings size={20} /><Title order={5}>分析配置</Title></Group>
                        <Divider mb="md" />
                        <Stack gap="sm">
                            <Checkbox label="转换为小写" checked={config.lowercase} onChange={(e) => setConfig({ ...config, lowercase: e.currentTarget.checked })} />
                            <Checkbox label="去除标点" checked={config.remove_punct} onChange={(e) => setConfig({ ...config, remove_punct: e.currentTarget.checked })} />
                            <Checkbox label="去除数字" checked={config.remove_digits} onChange={(e) => setConfig({ ...config, remove_digits: e.currentTarget.checked })} />
                            <Divider label="高级选项" labelPosition="center" />
                            <Checkbox label="过滤停用词" checked={config.use_stop_words} onChange={(e) => setConfig({ ...config, use_stop_words: e.currentTarget.checked })} />
                            <TextInput size="xs" label="自定义停用词" placeholder="测试, Test..." value={config.stop_words_custom} onChange={(e) => setConfig({ ...config, stop_words_custom: e.target.value })} />
                            <TextInput size="xs" label="拆分正则" placeholder="例如: [,|;]" value={config.split_pattern} onChange={(e) => setConfig({ ...config, split_pattern: e.target.value })} />
                        </Stack>
                        <Button fullWidth mt="xl" onClick={onAnalyze} loading={loading} leftSection={<IconChartBar size={18} />}>执行分析</Button>
                    </Paper>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 8 }}>
                    <Paper p="md" withBorder shadow="sm" radius="md">
                        <Group justify="space-between" mb="xs">
                            <Title order={5}>待处理文本</Title>
                            <ActionIcon variant="light" color="red" onClick={() => setText('')}><IconTrash size={16} /></ActionIcon>
                        </Group>
                        <Textarea
                            placeholder="粘贴文本..."
                            minRows={12}
                            autosize
                            value={text}
                            onChange={(e) => setText(e.currentTarget.value)}
                            styles={{ input: { fontFamily: 'monospace', fontSize: '13px' } }}
                        />
                    </Paper>
                </Grid.Col>
            </Grid>

            {(results.word_freq.length > 0 || results.char_freq.length > 0) && (
                <Paper p="md" withBorder radius="md" shadow="sm">
                    <Tabs defaultValue="chars">
                        <Tabs.List mb="md">
                            <Tabs.Tab value="chars" leftSection={<IconAbc size={16} />}>单字频率</Tabs.Tab>
                            <Tabs.Tab value="words" leftSection={<IconVocabulary size={16} />}>词汇频率</Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="chars"><FreqTable data={results.char_freq} label="字符" /></Tabs.Panel>
                        <Tabs.Panel value="words"><FreqTable data={results.word_freq} label="词汇" /></Tabs.Panel>
                    </Tabs>
                </Paper>
            )}
        </Stack>
    );
}

// 内部表格子组件
function FreqTable({ data, label }: { data: FreqItem[], label: string }) {
    return (
        <ScrollArea h={450} type="always" offsetScrollbars>
            <Table striped highlightOnHover verticalSpacing="xs">
                <Table.Thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--mantine-color-body)', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <Table.Tr>
                        <Table.Th w={150}>{label}</Table.Th>
                        <Table.Th w={100}>计数</Table.Th>
                        <Table.Th>频率可视化</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {data.slice(0, 200).map((r, i) => (
                        <Table.Tr key={i}>
                            <Table.Td><Text fw={700} ff="monospace" style={{ wordBreak: 'break-all' }}>{r.word}</Text></Table.Td>
                            <Table.Td><Badge variant="outline" color="gray" radius="xs">{r.count}</Badge></Table.Td>
                            <Table.Td>
                                <Group gap="xs" wrap="nowrap">
                                    <Text size="xs" w={50} ta="right">{r.percentage.toFixed(2)}%</Text>
                                    <Box style={{ flex: 1 }}><Progress value={r.percentage * 4} size="sm" radius="xl" color="blue" /></Box>
                                </Group>
                            </Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </ScrollArea>
    );
}