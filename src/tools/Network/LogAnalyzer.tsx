import { useState, useMemo } from 'react';
import { Stack, Button, Textarea, Table, Paper, ScrollArea, Badge, Group, Text, TextInput, Modal, Code, Tabs, ActionIcon } from '@mantine/core';
import { IconFileSearch, IconFileUpload, IconFilter, IconTerminal, IconInfoCircle, IconTrash, IconChevronRight } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useDisclosure } from '@mantine/hooks';
import { handleAppError } from '../../utils/error';
import { useAppSettings } from '../../hooks/useAppSettings';

interface LogEntry {
    ip: string;
    timestamp: string;
    method: string;
    path: string;
    status: string;
    size: string;
    ua: string;
    raw: string;
}

export default function LogAnalyzer() {
    const [settings] = useAppSettings();
    const [rawText, setRawText] = useState('');
    const [data, setData] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterQuery, setFilterQuery] = useState('');
    const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);
    const [opened, { open: openModal, close: closeModal }] = useDisclosure(false);

    // Wireshark 过滤器引擎
    const filteredData = useMemo(() => {
        if (!filterQuery.trim()) return data;
        return data.filter(item => {
            try {
                const query = filterQuery.toLowerCase();
                const checkMatch = (condition: string) => {
                    const c = condition.trim();
                    if (c.includes('ip ==')) return item.ip.includes(c.split('==')[1].trim().replace(/"/g, ''));
                    if (c.includes('http.status ==')) return item.status === c.split('==')[1].trim();
                    if (c.includes('http.method ==')) return item.method.toLowerCase() === c.split('==')[1].trim().replace(/"/g, '');
                    if (c.includes('http.uri contains')) return item.path.toLowerCase().includes(c.split('contains')[1].trim().replace(/"/g, ''));
                    if (c.includes('frame.time >')) return item.timestamp > c.split('>')[1].trim().replace(/"/g, '');
                    return item.path.toLowerCase().includes(c) || item.raw.toLowerCase().includes(c);
                };
                return query.includes('&&') ? query.split('&&').every(checkMatch) : checkMatch(query);
            } catch { return true; }
        });
    }, [data, filterQuery]);

    const onParse = async (content: string) => {
        if (!content.trim()) return;
        setLoading(true);
        try {
            const res = await invoke<LogEntry[]>('parse_log_content', { content });
            setData(res);
        } catch (err) { handleAppError(err); }
        finally { setLoading(false); }
    };

    return (
        <Stack gap="sm">
            <Paper withBorder p="xs" bg="var(--mantine-color-default-hover)">
                <Stack gap="xs">
                    <Textarea
                        placeholder="粘贴原始日志..."
                        minRows={3}
                        maxRows={6}
                        autosize
                        value={rawText}
                        onChange={(e) => setRawText(e.currentTarget.value)}
                        styles={{ input: { fontSize: '12px', fontFamily: 'monospace' } }}
                    />
                    <Group justify="space-between">
                        <Group gap="xs">
                            <Button size="xs" variant="light" leftSection={<IconFileUpload size={14} />} onClick={async () => {
                                const selected = await open({ filters: [{ name: 'Logs', extensions: ['log', 'txt'] }] });
                                if (selected && typeof selected === 'string') {
                                    setLoading(true);
                                    try {
                                        const res = await invoke<LogEntry[]>('read_and_parse_log', { filePath: selected });
                                        setData(res);
                                    } catch (err) { handleAppError(err); }
                                    finally { setLoading(false); }
                                }
                            }}>上传文件</Button>
                            {data.length > 0 && <ActionIcon variant="subtle" color="red" onClick={() => {setData([]); setRawText('');}}><IconTrash size={16}/></ActionIcon>}
                        </Group>
                        <Button size="xs" color={settings.primaryColor} leftSection={<IconFileSearch size={14} />} onClick={() => onParse(rawText)} loading={loading}>分析</Button>
                    </Group>
                </Stack>
            </Paper>

            {data.length > 0 && (
                <Stack gap="xs">
                    <TextInput
                        size="xs"
                        placeholder='过滤器: ip == "127.0.0.1" && http.status == 200'
                        leftSection={<IconFilter size={14} />}
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.currentTarget.value)}
                    />

                    <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                        <ScrollArea h={550} offsetScrollbars scrollbars="xy">
                            <Table layout="fixed" verticalSpacing="xs" horizontalSpacing="md" highlightOnHover withColumnBorders>
                                <Table.Thead bg="var(--mantine-color-body)">
                                    <Table.Tr style={{ fontSize: '12px' }}>
                                        <Table.Th w={165}>时间 / 来源 IP</Table.Th>
                                        <Table.Th w={75}>方法</Table.Th>
                                        <Table.Th>请求路径</Table.Th>
                                        <Table.Th w={85}>状态</Table.Th>
                                        <Table.Th w={40}></Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filteredData.map((item, i) => (
                                        <Table.Tr key={i} onClick={() => { setSelectedEntry(item); openModal(); }} style={{ cursor: 'pointer' }}>
                                            <Table.Td>
                                                <Text size="xs" fw={700} c={settings.primaryColor} truncate>{item.ip}</Text>
                                                <Text size="10px" c="dimmed" truncate>{item.timestamp}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge size="xs" radius="xs" variant="light" fullWidth>{item.method}</Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="xs" ff="monospace" truncate>{item.path}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge size="xs" fullWidth color={item.status.startsWith('2') ? 'green' : 'red'} variant="filled">
                                                    {item.status}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                <IconChevronRight size={14} style={{ opacity: 0.3 }} />
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </ScrollArea>
                    </Paper>
                </Stack>
            )}

            <Modal opened={opened} onClose={closeModal} title="详细信息" size="xl" centered>
                {selectedEntry && (
                    <Tabs defaultValue="structured" color={settings.primaryColor}>
                        <Tabs.List mb="md">
                            <Tabs.Tab value="structured" leftSection={<IconInfoCircle size={14} />}>解析详情</Tabs.Tab>
                            <Tabs.Tab value="raw" leftSection={<IconTerminal size={14} />}>原始日志</Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="structured">
                            <Stack gap="xs">
                                <DetailRow label="访问时间" value={selectedEntry.timestamp} />
                                <DetailRow label="客户端 IP" value={selectedEntry.ip} />
                                <DetailRow label="请求方法" value={selectedEntry.method} />
                                <DetailRow label="响应状态" value={selectedEntry.status} color={selectedEntry.status.startsWith('2') ? 'green' : 'red'} />
                                <DetailRow label="资源路径" value={selectedEntry.path} isCode />
                                <DetailRow label="User-Agent" value={selectedEntry.ua} isCode />
                            </Stack>
                        </Tabs.Panel>

                        <Tabs.Panel value="raw">
                            <Code block p="md" style={{ fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {selectedEntry.raw}
                            </Code>
                        </Tabs.Panel>
                    </Tabs>
                )}
            </Modal>
        </Stack>
    );
}

function DetailRow({ label, value, isCode, color }: { label: string, value: string, isCode?: boolean, color?: string }) {
    return (
        <Group wrap="nowrap" align="start">
            <Text size="xs" fw={700} w={100} c="dimmed">{label}</Text>
            {isCode ? <Code style={{ flex: 1, fontSize: '12px' }}>{value}</Code> : <Text size="sm" fw={500} c={color}>{value}</Text>}
        </Group>
    );
}