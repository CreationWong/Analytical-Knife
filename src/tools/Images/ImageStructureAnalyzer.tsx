import React, { useState, useEffect, memo, useRef, UIEvent, forwardRef, useImperativeHandle } from 'react';
import {
    Paper, Title, Text, Group, Button, Stack, Badge, Tabs,
    Code, SimpleGrid, Card, Table,
    Image, ScrollArea, Divider, Grid, Tooltip, Box, Loader, ActionIcon
} from '@mantine/core';
import {
    IconUpload, IconFileCode, IconList, IconBinary, IconX,
    IconInfoCircle, IconAlertCircle, IconTags, IconArrowRight
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { showNotification } from '@mantine/notifications';
import { handleAppError } from '../../utils/error';
import { useAppSettings } from '../../hooks/useAppSettings';
import { useFilePreview } from '../../hooks/useFilePreview';
import previewErrorImg from '../../assets/Error/400x200-PreviewError.svg';

// --- 常量定义 ---
const ALLOWED_PREVIEW_TYPES = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg'];
const ROW_HEIGHT = 24;
const BYTES_PER_ROW = 16;
const HEX_COL_WIDTH = 24;  // 固定 16 进制列宽
const ASCII_COL_WIDTH = 12; // 固定 ASCII 列宽

// --- 类型定义 ---
interface MarkerDefinition {
    name: string; hex: string; description: string; color: string;
}
interface FormatTemplate {
    name: string; extension: string; signature_hex: string; description: string; markers: MarkerDefinition[];
}
interface ChunkInfo {
    name: string; offset: number; length: number; total_size: number; description: string; color: string;
}
interface FormatDetail {
    format_name: string; dimensions: [number, number] | null; bit_depth: number | null; color_mode: string; chunks: ChunkInfo[];
}
interface AnalysisResult {
    file_size: number; exif_data: Record<string, string>; structure: FormatDetail | null; raw_preview: number[];
}

// --- 组件：Hex Viewer (修复对齐，保留 Tooltip 与交互) ---
const HexViewer = memo(forwardRef(({ data, chunks }: { data: number[], chunks: ChunkInfo[] }, ref) => {
    const [scrollTop, setScrollTop] = useState(0);
    const [highlightRange, setHighlightRange] = useState<{ offset: number; length: number } | null>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<any>(null);

    const totalRows = Math.ceil(data.length / BYTES_PER_ROW);
    const totalHeight = totalRows * ROW_HEIGHT;
    const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
    const endRow = Math.min(totalRows, startRow + 30);
    const offsetY = startRow * ROW_HEIGHT;

    useImperativeHandle(ref, () => ({
        scrollToOffset: (offset: number, length: number) => {
            const row = Math.floor(offset / BYTES_PER_ROW);
            if (viewportRef.current) {
                viewportRef.current.scrollTo({ top: Math.max(0, (row - 3) * ROW_HEIGHT), behavior: 'smooth' });
                setHighlightRange({ offset, length });
                if (timerRef.current) clearTimeout(timerRef.current);
                timerRef.current = setTimeout(() => setHighlightRange(null), 3000);
            }
        }
    }));

    const colorMap = new Map<number, ChunkInfo>();
    chunks.forEach(chunk => {
        const len = Math.min(chunk.total_size, data.length);
        for (let i = 0; i < len; i++) colorMap.set(chunk.offset + i, chunk);
    });

    const toAscii = (byte: number) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.');

    const visibleRows = [];
    for (let rowIdx = startRow; rowIdx < endRow; rowIdx++) {
        const startByteIdx = rowIdx * BYTES_PER_ROW;
        const hexCells = [];
        const asciiCells = [];

        for (let j = 0; j < BYTES_PER_ROW; j++) {
            const offset = startByteIdx + j;
            if (offset >= data.length) break;
            const byte = data[offset];
            const chunk = colorMap.get(offset);
            const isTarget = highlightRange && offset >= highlightRange.offset && offset < (highlightRange.offset + highlightRange.length);

            const cellStyle: React.CSSProperties = {
                display: 'inline-block',
                textAlign: 'center',
                fontFamily: 'ui-monospace, monospace',
                fontSize: 12,
                borderRadius: 2,
                boxSizing: 'border-box',
                backgroundColor: isTarget ? 'var(--mantine-color-yellow-4)' : (chunk ? chunk.color : 'transparent'),
                color: isTarget ? '#000' : (chunk ? '#fff' : 'inherit'),
                boxShadow: isTarget ? 'inset 0 0 0 1px rgba(0,0,0,0.2)' : 'none',
                cursor: chunk ? 'help' : 'default',
            };

            const hexCell = (
                <span key={`h-${offset}`} style={{ ...cellStyle, width: HEX_COL_WIDTH }}>
                    {byte.toString(16).toUpperCase().padStart(2, '0')}
                </span>
            );

            hexCells.push(chunk ? <Tooltip key={offset} label={chunk.name} openDelay={500} color="dark" withinPortal>{hexCell}</Tooltip> : hexCell);
            asciiCells.push(
                <span key={`a-${offset}`} style={{ ...cellStyle, width: ASCII_COL_WIDTH, opacity: isTarget ? 1 : 0.7 }}>
                    {toAscii(byte)}
                </span>
            );
        }

        visibleRows.push(
            <div key={rowIdx} style={{ display: 'flex', height: ROW_HEIGHT, alignItems: 'center', gap: 10 }}>
                <Code c="dimmed" w={60} fz={11} bg="transparent">{startByteIdx.toString(16).toUpperCase().padStart(6, '0')}</Code>
                {/* 使用 Grid 确保每列宽度恒定，防止错位 */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${BYTES_PER_ROW}, ${HEX_COL_WIDTH}px)`, gap: 4 }}>
                    {hexCells}
                </div>
                <Divider orientation="vertical" />
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${BYTES_PER_ROW}, ${ASCII_COL_WIDTH}px)` }}>
                    {asciiCells}
                </div>
            </div>
        );
    }

    return (
        <Box p="xs" bg="var(--mantine-color-default)" style={{ borderRadius: 4, border: '1px solid var(--mantine-color-default-border)' }}>
            <div ref={viewportRef} onScroll={(e: UIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop)} style={{ height: 600, overflowY: 'auto', position: 'relative' }}>
                <div style={{ height: totalHeight, position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${offsetY}px)` }}>
                        {visibleRows}
                    </div>
                </div>
            </div>
            <Text size="xs" ta="center" mt="xs" c="dimmed">已加载预览数据: {data.length.toLocaleString()} 字节</Text>
        </Box>
    );
}));

// --- 组件：模板卡片 (还原原有设计) ---
const TemplateCard = ({ template }: { template: FormatTemplate }) => (
    <Card withBorder shadow="sm" radius="md">
        <Group justify="space-between" mb="sm">
            <Group gap="xs">
                <Badge size="lg" color="blue">{template.extension.toUpperCase()}</Badge>
                <Text size="sm" fw={700}>{template.name}</Text>
            </Group>
            <Code fz="xs">{template.signature_hex} ...</Code>
        </Group>
        <Text size="xs" c="dimmed" mb="md">{template.description}</Text>
        <Table striped withTableBorder layout="fixed">
            <Table.Thead><Table.Tr><Table.Th w={70}>标记</Table.Th><Table.Th>Hex</Table.Th><Table.Th>描述</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
                {template.markers.map((m) => (
                    <Table.Tr key={m.name}>
                        <Table.Td><Badge size="xs" color={m.color}>{m.name}</Badge></Table.Td>
                        <Table.Td><Code fz={10}>{m.hex}</Code></Table.Td>
                        <Table.Td fz="xs" style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{m.description}</Table.Td>
                    </Table.Tr>
                ))}
            </Table.Tbody>
        </Table>
    </Card>
);

// --- 主组件 ---
export default function ImageStructureAnalyzer() {
    const [settings] = useAppSettings();
    const [analyzing, setAnalyzing] = useState(false);
    const [templates, setTemplates] = useState<FormatTemplate[]>([]);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [filePath, setFilePath] = useState<string>('');
    const [activeTab, setActiveTab] = useState<string | null>('hex');

    // ✅ 修正 Hook 调用规则：必须在顶层
    const { previewUrl, isLoading: isPreviewLoading, error: previewError } = useFilePreview(filePath, ALLOWED_PREVIEW_TYPES);
    const hexViewerRef = useRef<any>(null);

    useEffect(() => {
        invoke<FormatTemplate[]>('get_supported_templates').then(setTemplates).catch(handleAppError);
    }, []);

    const handleSelectFile = async () => {
        try {
            const selected = await open({ multiple: false, title: '选择图片', filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif'] }] });
            if (!selected) return;
            setFilePath(selected as string);
            setAnalyzing(true);
            setResult(null);
            const res = await invoke<AnalysisResult>('analyze_image_header', { filePath: selected as string });
            setResult(res);
            showNotification({ message: '分析完成', color: 'green' });
        } catch (err) {
            handleAppError(err);
            setResult(null);
        } finally {
            setAnalyzing(false);
        }
    };

    const handleClear = () => { setResult(null); setFilePath(''); };

    const handleJump = (chunk: ChunkInfo) => {
        setActiveTab('hex');
        setTimeout(() => hexViewerRef.current?.scrollToOffset(chunk.offset, chunk.total_size), 100);
    };

    return (
        <Stack gap="md" pb="xl" h="100%">
            <Paper withBorder p="md" shadow="xs" radius="md">
                <Group justify="space-between">
                    <Group>
                        <IconFileCode size={24} color={settings.primaryColor} />
                        <div>
                            <Title order={4}>图像结构显微镜</Title>
                            <Text size="xs" c="dimmed">基于底层字节流的图像结构解析</Text>
                        </div>
                    </Group>
                    <Group>
                        {result && <Button variant="light" color="gray" onClick={handleClear} leftSection={<IconX size={16}/>}>关闭</Button>}
                        <Button onClick={handleSelectFile} loading={analyzing} leftSection={<IconUpload size={18} />}>打开文件</Button>
                    </Group>
                </Group>
                {filePath && <Text size="xs" c="dimmed" mt="xs" truncate>文件路径: <Code fz="xs">{filePath}</Code></Text>}
            </Paper>

            {!result ? (
                <Stack>
                    <Group gap="xs" mt="md">
                        <IconInfoCircle size={18} color="gray" />
                        <Title order={5} c="dimmed">支持的分析模板</Title>
                    </Group>
                    <SimpleGrid cols={{ base: 1, lg: 2 }}>
                        {templates.map(t => <TemplateCard key={t.name} template={t} />)}
                    </SimpleGrid>
                </Stack>
            ) : (
                <Grid gutter="md" align="stretch">
                    <Grid.Col span={{ base: 12, md: 3.5 }}>
                        <Stack>
                            <Paper p="xs" withBorder radius="md" bg="var(--mantine-color-default)">
                                <Group gap="xs" mb="xs"><Text size="xs" fw={500} c="dimmed">图像预览</Text></Group>
                                <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200, overflow: 'hidden', borderRadius: 4 }}>
                                    {isPreviewLoading ? <Loader color="gray" type="dots" /> :
                                        previewError ? <Stack align="center" gap="xs"><IconAlertCircle size={24} color="red" /><Text size="xs" c="red">{previewError.message}</Text></Stack> :
                                            <Image src={previewUrl} fit="contain" radius="xs" fallbackSrc={previewErrorImg} />}
                                </Box>
                            </Paper>
                            <Paper p="md" withBorder shadow="sm" radius="md">
                                <Title order={5} mb="md" size="h6">基础属性</Title>
                                <Stack gap="sm">
                                    <Group justify="space-between"><Text size="xs" c="dimmed">识别格式</Text><Badge color="blue" variant="light">{result.structure?.format_name.split(' ')[0]}</Badge></Group>
                                    <Group justify="space-between"><Text size="xs" c="dimmed">逻辑尺寸</Text><Text size="xs" fw={600}>{result.structure?.dimensions ? `${result.structure.dimensions[0]} × ${result.structure.dimensions[1]}` : '无法识别'}</Text></Group>
                                    <Group justify="space-between"><Text size="xs" c="dimmed">物理大小</Text><Text size="xs" fw={600}>{(result.file_size / 1024).toFixed(2)} KB</Text></Group>
                                    <Group justify="space-between"><Text size="xs" c="dimmed">颜色模式</Text><Text size="xs" fw={600}>{result.structure?.color_mode || 'N/A'}</Text></Group>
                                </Stack>
                            </Paper>
                        </Stack>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 8.5 }}>
                        <Paper p="md" withBorder shadow="sm" radius="md" h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
                            <Tabs value={activeTab} onChange={setActiveTab} variant="pills" radius="md">
                                <Tabs.List mb="md">
                                    <Tabs.Tab value="hex" leftSection={<IconBinary size={16}/>}>十六进制</Tabs.Tab>
                                    <Tabs.Tab value="structure" leftSection={<IconList size={16}/>}>逻辑结构</Tabs.Tab>
                                    <Tabs.Tab value="exif" leftSection={<IconTags size={16}/>} disabled={Object.keys(result.exif_data).length === 0}>元数据 (EXIF)</Tabs.Tab>
                                </Tabs.List>

                                <Tabs.Panel value="hex">
                                    <Stack gap="xs">
                                        <Text size="xs" c="dimmed"><IconInfoCircle size={14} style={{display:'inline', verticalAlign:'middle', marginRight: 4}}/>色彩高亮表示已识别的块。滚动以查看更多。</Text>
                                        {result.structure && <HexViewer ref={hexViewerRef} data={result.raw_preview} chunks={result.structure.chunks} />}
                                    </Stack>
                                </Tabs.Panel>

                                <Tabs.Panel value="structure">
                                    <ScrollArea h={600} type="auto">
                                        <Stack gap="xs" pr="md">
                                            {result.structure?.chunks.map((chunk, idx) => (
                                                <Paper key={idx} p="xs" withBorder style={{ borderLeft: `4px solid ${chunk.color}`, cursor: 'pointer' }} onClick={() => handleJump(chunk)}>
                                                    <Group justify="space-between">
                                                        <Group gap="xs">
                                                            <Badge color={chunk.color} size="sm" radius="sm">{chunk.name}</Badge>
                                                            <Text size="sm" fw={500}>{chunk.description}</Text>
                                                        </Group>
                                                        <Group gap="xl">
                                                            <Stack gap={0} align="flex-end"><Text size="xs" c="dimmed">偏移量</Text><Code fz="xs">0x{chunk.offset.toString(16).toUpperCase()}</Code></Stack>
                                                            <Stack gap={0} align="flex-end"><Text size="xs" c="dimmed">长度</Text><Text size="xs" fw={500}>{chunk.total_size} bytes</Text></Stack>
                                                            <ActionIcon variant="subtle" color="gray"><IconArrowRight size={16}/></ActionIcon>
                                                        </Group>
                                                    </Group>
                                                </Paper>
                                            ))}
                                        </Stack>
                                    </ScrollArea>
                                </Tabs.Panel>

                                <Tabs.Panel value="exif">
                                    <ScrollArea h={600} type="auto">
                                        <Table striped highlightOnHover withTableBorder withColumnBorders>
                                            <Table.Thead><Table.Tr><Table.Th w="35%">Tag</Table.Th><Table.Th>Value</Table.Th></Table.Tr></Table.Thead>
                                            <Table.Tbody>
                                                {Object.entries(result.exif_data).map(([key, value]) => (
                                                    <Table.Tr key={key}>
                                                        <Table.Td><Text size="xs" fw={500}>{key}</Text></Table.Td>
                                                        <Table.Td><Text size="xs" style={{ wordBreak: 'break-all' }}>{value}</Text></Table.Td>
                                                    </Table.Tr>
                                                ))}
                                            </Table.Tbody>
                                        </Table>
                                    </ScrollArea>
                                </Tabs.Panel>
                            </Tabs>
                        </Paper>
                    </Grid.Col>
                </Grid>
            )}
        </Stack>
    );
}