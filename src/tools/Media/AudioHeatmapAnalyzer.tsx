import {
    startTransition,
    type MouseEvent,
    type ReactNode,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    ActionIcon,
    Badge,
    Box,
    Button,
    Center,
    Divider,
    Grid,
    Group,
    Paper,
    SegmentedControl,
    SimpleGrid,
    Slider,
    Stack,
    Text,
    TextInput,
    ThemeIcon,
    Title,
    rgba,
    useMantineColorScheme,
    useMantineTheme,
} from '@mantine/core';
import { useMediaQuery, useViewportSize } from '@mantine/hooks';
import {
    IconDownload,
    IconFileMusic,
    IconRefresh,
    IconTrash,
    IconWaveSine,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { showNotification } from '@/utils/notifications';

type AnalyzerStatus = 'idle' | 'analyzing' | 'ready' | 'error';
type PaletteName = 'ember' | 'glacier' | 'neon';

interface AudioHeatmapResult {
    width: number;
    height: number;
    intensities: number[];
    averageBandIntensity: number[];
    bandCenters: number[];
    durationSec: number;
    peakAmplitude: number;
    averageRms: number;
    peakRms: number;
    dominantFrequency: number;
    dbRange: [number, number];
    sampleRate: number;
    channels: number;
    fileSize: number;
}

interface HoverInfo {
    column: number;
    band: number;
    timeSec: number;
    frequencyHz: number;
    intensity: number;
}

interface ViewWindow {
    start: number;
    size: number;
}

interface ScopeThemeTokens {
    pageBackground: string;
    pageBorder: string;
    pageShadow: string;
    mainPanelBackground: string;
    panelBackground: string;
    panelBorder: string;
    cardBackground: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textFaint: string;
    canvasShellBackground: string;
    canvasShellBorder: string;
    canvasBgStart: string;
    canvasBgEnd: string;
    plotBackground: string;
    grid: string;
    axisText: string;
    axisMuted: string;
    frameBorder: string;
    crosshair: string;
    cursorDot: string;
    timelineBgStart: string;
    timelineBgEnd: string;
    timelineEnvelope: string;
    timelineOverlay: string;
    timelineSelectionStroke: string;
    timelineSelectionFill: string;
    timelineGrid: string;
    accent: string;
    accentGlow: string;
}

const HEATMAP_PALETTES: Record<PaletteName, string[]> = {
    ember: ['#020408', '#111d30', '#23456a', '#cf5e1c', '#f6ad32', '#fff2c6'],
    glacier: ['#030b12', '#0e2736', '#124b54', '#1f977c', '#7de0c2', '#effff7'],
    neon: ['#040611', '#1b1748', '#2752d6', '#23c9aa', '#dffc59', '#fff9de'],
};

const BAND_COUNT = 96;
const TIMELINE_HEIGHT = 92;
const AUDIO_FILTERS = [{
    name: 'Audio',
    extensions: ['wav', 'wave', 'mp3', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'wma'],
}];
const RESOLUTION_MARKS = [
    { value: 320, label: '320' },
    { value: 640, label: '640' },
    { value: 960, label: '960' },
];

export default function AudioHeatmapAnalyzer() {
    const theme = useMantineTheme();
    const { colorScheme } = useMantineColorScheme();
    const { height: viewportHeight } = useViewportSize();
    const isDark = colorScheme === 'dark';
    const isCompactLayout = useMediaQuery('(max-width: 75em)');

    const [status, setStatus] = useState<AnalyzerStatus>('idle');
    const [selectedPath, setSelectedPath] = useState('');
    const [fftSize, setFftSize] = useState('2048');
    const [targetColumns, setTargetColumns] = useState(640);
    const [maxFrequency, setMaxFrequency] = useState('16000');
    const [palette, setPalette] = useState<PaletteName>('ember');
    const [analysis, setAnalysis] = useState<AudioHeatmapResult | null>(null);
    const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
    const [viewport, setViewport] = useState<ViewWindow | null>(null);
    const [timelineDragging, setTimelineDragging] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const timelineCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const canvasContainerRef = useRef<HTMLDivElement | null>(null);
    const timelineDragRef = useRef<{ anchorRatio: number } | null>(null);

    const [canvasWidth, setCanvasWidth] = useState(1024);

    const scope = useMemo(() => buildScopeTheme(theme, isDark), [theme, isDark]);
    const activeView = useMemo(() => resolveViewport(analysis, viewport), [analysis, viewport]);
    const timelineEnvelope = useMemo(() => (analysis ? buildTimelineEnvelope(analysis) : []), [analysis]);
    const heatmapSurface = useMemo(
        () => (analysis ? buildHeatmapSurface(analysis, palette) : null),
        [analysis, palette]
    );
    const chartHeight = useMemo(
        () => getChartHeight(canvasWidth, viewportHeight, isCompactLayout),
        [canvasWidth, viewportHeight, isCompactLayout]
    );

    useEffect(() => {
        const updateCanvasWidth = () => {
            if (!canvasContainerRef.current) {
                return;
            }
            setCanvasWidth(Math.max(360, Math.floor(canvasContainerRef.current.clientWidth)));
        };

        updateCanvasWidth();

        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(updateCanvasWidth)
            : null;

        if (resizeObserver && canvasContainerRef.current) {
            resizeObserver.observe(canvasContainerRef.current);
        }

        window.addEventListener('resize', updateCanvasWidth);
        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener('resize', updateCanvasWidth);
        };
    }, []);

    useEffect(() => {
        if (!analysis || !canvasRef.current || !heatmapSurface || !activeView) {
            return;
        }

        drawHeatmap(
            canvasRef.current,
            heatmapSurface,
            analysis,
            activeView,
            canvasWidth,
            chartHeight,
            hoverInfo,
            scope
        );
    }, [analysis, activeView, canvasWidth, chartHeight, heatmapSurface, hoverInfo, scope]);

    useEffect(() => {
        if (!analysis || !timelineCanvasRef.current || !heatmapSurface || !activeView) {
            return;
        }

        drawTimeline(
            timelineCanvasRef.current,
            heatmapSurface,
            analysis,
            activeView,
            timelineEnvelope,
            canvasWidth,
            TIMELINE_HEIGHT,
            hoverInfo,
            scope
        );
    }, [analysis, activeView, canvasWidth, heatmapSurface, hoverInfo, timelineEnvelope, scope]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !analysis || !activeView) {
            return;
        }

        const handleCanvasWheel = (event: globalThis.WheelEvent) => {
            handleHeatmapWheel(event, canvas);
        };

        canvas.addEventListener('wheel', handleCanvasWheel, { passive: false });
        return () => {
            canvas.removeEventListener('wheel', handleCanvasWheel);
        };
    }, [analysis, activeView, canvasWidth, chartHeight]);

    useEffect(() => {
        if (!timelineDragging || !analysis) {
            return;
        }

        const handleMouseMove = (event: globalThis.MouseEvent) => {
            const canvas = timelineCanvasRef.current;
            const dragMeta = timelineDragRef.current;
            if (!canvas || !dragMeta) {
                return;
            }

            const ratio = getHorizontalRatio(event.clientX, canvas);
            setViewport((current) => {
                const next = resolveViewport(analysis, current) ?? { start: 0, size: analysis.width };
                return moveViewportToRatio(next, ratio, dragMeta.anchorRatio, analysis.width);
            });
        };

        const handleMouseUp = () => {
            timelineDragRef.current = null;
            setTimelineDragging(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [timelineDragging, analysis]);

    const statusBadge = useMemo(() => {
        switch (status) {
            case 'analyzing':
                return { label: '分析中', color: 'orange' };
            case 'ready':
                return { label: '就绪', color: 'teal' };
            case 'error':
                return { label: '失败', color: 'red' };
            default:
                return { label: '待分析', color: 'gray' };
        }
    }, [status]);

    const maxFrequencyPresets = useMemo(() => {
        const nyquist = analysis ? Math.floor(analysis.sampleRate / 2) : 22_050;
        return [
            { value: '4000', label: '4 kHz', disabled: false },
            { value: '8000', label: '8 kHz', disabled: false },
            { value: '16000', label: '16 kHz', disabled: 16_000 > nyquist },
            { value: String(nyquist), label: 'Nyquist', disabled: false },
        ];
    }, [analysis]);

    const signalCards = useMemo(() => {
        if (!analysis || !activeView) {
            return [];
        }

        return [
            {
                label: '可视窗口',
                value: formatRange(activeView.start, activeView.start + activeView.size - 1, analysis),
                note: `${activeView.size}/${analysis.width} 列`,
            },
            {
                label: '光标',
                value: hoverInfo ? formatDuration(hoverInfo.timeSec, true) : '--',
                note: hoverInfo ? formatFrequency(hoverInfo.frequencyHz) : '移动鼠标读取',
            },
            {
                label: '时长',
                value: formatDuration(analysis.durationSec),
                note: `${analysis.sampleRate.toLocaleString()} Hz`,
            },
            {
                label: '主导频率',
                value: formatFrequency(analysis.dominantFrequency),
                note: `峰值 ${formatPercent(analysis.peakAmplitude)}`,
            },
        ];
    }, [analysis, activeView, hoverInfo]);

    const handleSelectFile = async () => {
        const selected = await open({
            multiple: false,
            title: '选择音频文件',
            filters: AUDIO_FILTERS,
        });

        if (!selected || Array.isArray(selected)) {
            return;
        }

        setSelectedPath(selected);
        setStatus('idle');
        setAnalysis(null);
        setViewport(null);
        setHoverInfo(null);
    };

    const handleAnalyze = async (): Promise<void> => {
        if (!selectedPath) {
            return;
        }

        setStatus('analyzing');
        setAnalysis(null);
        setViewport(null);
        setHoverInfo(null);

        await new Promise((resolve) => window.setTimeout(resolve, 0));

        try {
            const result = await invoke<AudioHeatmapResult>('analyze_audio_heatmap', {
                filePath: selectedPath,
                fftSize: Number(fftSize),
                bandCount: BAND_COUNT,
                targetColumns,
                maxFrequency: Number(maxFrequency),
            });

            startTransition(() => {
                setAnalysis(result);
                setViewport({ start: 0, size: result.width });
            });

            setStatus('ready');
            showNotification({
                type: 'info',
                title: '分析完成',
                message: `${extractFileName(selectedPath)} 的热力图已生成`,
                autoClose: 2200,
            });
        } catch (error) {
            console.error(error);
            setStatus('error');
            showNotification({
                type: 'error',
                title: '分析失败',
                message: error instanceof Error ? error.message : '当前音频无法完成分析',
            });
        }
    };

    const handleClear = () => {
        setSelectedPath('');
        setStatus('idle');
        setAnalysis(null);
        setViewport(null);
        setHoverInfo(null);
    };

    const handleExport = async (): Promise<void> => {
        const canvas = canvasRef.current;
        if (!canvas || !analysis) {
            return;
        }

        try {
            const savePath = await save({
                defaultPath: `${stripExtension(extractFileName(selectedPath || 'heatmap'))}-heatmap.png`,
                filters: [{ name: 'PNG', extensions: ['png'] }],
            });

            if (!savePath) {
                return;
            }

            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (!blob) {
                throw new Error('当前环境无法导出 PNG');
            }

            const buffer = await blob.arrayBuffer();
            await writeFile(savePath, new Uint8Array(buffer));

            showNotification({
                type: 'info',
                title: '导出完成',
                message: `热力图已保存到 ${savePath}`,
                autoClose: 2400,
            });
        } catch (error) {
            console.error(error);
            showNotification({
                type: 'error',
                title: '导出失败',
                message: error instanceof Error ? error.message : '无法导出当前热力图',
            });
        }
    };

    const handlePointerMove = (event: MouseEvent<HTMLCanvasElement>) => {
        if (!analysis || !activeView) {
            return;
        }

        const plotRect = getHeatmapPlotRect(canvasWidth, chartHeight);
        const bounds = event.currentTarget.getBoundingClientRect();
        const scaleX = canvasWidth / bounds.width;
        const scaleY = plotRect.totalHeight / bounds.height;
        const x = (event.clientX - bounds.left) * scaleX;
        const y = (event.clientY - bounds.top) * scaleY;

        if (
            x < plotRect.x ||
            x > plotRect.x + plotRect.width ||
            y < plotRect.y ||
            y > plotRect.y + plotRect.height
        ) {
            setHoverInfo(null);
            return;
        }

        const localColumn = Math.min(
            activeView.size - 1,
            Math.max(0, Math.floor(((x - plotRect.x) / plotRect.width) * activeView.size))
        );
        const column = Math.min(analysis.width - 1, activeView.start + localColumn);
        const topBand = Math.min(
            analysis.height - 1,
            Math.max(0, Math.floor(((y - plotRect.y) / plotRect.height) * analysis.height))
        );
        const band = analysis.height - 1 - topBand;

        setHoverInfo({
            column,
            band,
            timeSec: columnToTime(column, analysis),
            frequencyHz: analysis.bandCenters[band],
            intensity: analysis.intensities[band * analysis.width + column],
        });
    };

    const handleHeatmapWheel = (event: globalThis.WheelEvent, currentTarget: HTMLCanvasElement) => {
        if (!analysis || !activeView) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const plotRect = getHeatmapPlotRect(canvasWidth, chartHeight);
        const bounds = currentTarget.getBoundingClientRect();
        const scaleX = canvasWidth / bounds.width;
        const scaleY = plotRect.totalHeight / bounds.height;
        const x = (event.clientX - bounds.left) * scaleX;
        const y = (event.clientY - bounds.top) * scaleY;

        if (
            x < plotRect.x ||
            x > plotRect.x + plotRect.width ||
            y < plotRect.y ||
            y > plotRect.y + plotRect.height
        ) {
            return;
        }

        if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
            const delta = event.shiftKey ? event.deltaY : event.deltaX;
            setViewport((current) => {
                const next = current ?? activeView;
                return panViewport(next, delta, analysis.width);
            });
            return;
        }

        const cursorRatio = (x - plotRect.x) / plotRect.width;
        setViewport((current) => {
            const next = current ?? activeView;
            return zoomViewport(next, event.deltaY, cursorRatio, analysis.width);
        });
    };

    const handleTimelineMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
        if (!analysis || !activeView || !timelineCanvasRef.current) {
            return;
        }

        event.preventDefault();

        const ratio = getHorizontalRatio(event.clientX, timelineCanvasRef.current);
        const startRatio = activeView.start / analysis.width;
        const sizeRatio = activeView.size / analysis.width;
        const isInsideView = ratio >= startRatio && ratio <= startRatio + sizeRatio;
        const anchorRatio = isInsideView
            ? clamp((ratio - startRatio) / Math.max(sizeRatio, 1 / analysis.width), 0, 1)
            : 0.5;

        if (!isInsideView) {
            setViewport(moveViewportToRatio(activeView, ratio, anchorRatio, analysis.width));
        }

        timelineDragRef.current = { anchorRatio };
        setTimelineDragging(true);
    };

    const fileName = selectedPath ? extractFileName(selectedPath) : 'NO SIGNAL';

    return (
        <Stack gap="lg" py="sm">
            <Paper
                withBorder
                radius="xl"
                p={{ base: 'md', sm: 'xl' }}
                style={{
                    background: scope.pageBackground,
                    borderColor: scope.pageBorder,
                    boxShadow: scope.pageShadow,
                }}
            >
                <Grid gutter={{ base: 'md', md: 'xl' }} align="stretch">
                    <Grid.Col span={{ base: 12, xl: 8.4 }}>
                        <Stack gap="md">
                            <Paper
                                withBorder
                                radius="xl"
                                p={{ base: 'md', sm: 'lg' }}
                                style={{
                                    background: scope.mainPanelBackground,
                                    borderColor: scope.panelBorder,
                                }}
                            >
                                <Group justify="space-between" align="flex-start" mb="md">
                                    <Group gap="md" wrap="nowrap" align="flex-start">
                                        <ThemeIcon
                                            size={54}
                                            radius="xl"
                                            variant="light"
                                            color={theme.primaryColor}
                                            style={{
                                                boxShadow: `0 0 24px ${scope.accentGlow}`,
                                            }}
                                        >
                                            <IconWaveSine size={28} />
                                        </ThemeIcon>
                                        <div>
                                            <Group gap="xs" mb={8}>
                                                <Title order={2} c={scope.textPrimary}>声音热力图分析器</Title>
                                                <Badge color={statusBadge.color} variant="light">
                                                    {statusBadge.label}
                                                </Badge>
                                            </Group>
                                            <Text size="sm" c={scope.textSecondary}>
                                                主视图用于频谱浏览，时间轴用于定位和拖拽窗口。
                                            </Text>
                                        </div>
                                    </Group>

                                    <Stack gap={2} align="flex-end">
                                        <Text size="xs" fw={700} c={scope.textFaint}>SOURCE</Text>
                                        <Text size="sm" fw={700} c={scope.textPrimary}>{fileName}</Text>
                                        <Text size="xs" c={scope.textMuted}>
                                            {analysis ? formatFileSize(analysis.fileSize) : '等待输入'}
                                        </Text>
                                    </Stack>
                                </Group>

                                <SimpleGrid cols={{ base: 1, xs: 2, xl: 4 }} spacing="md" mb="md">
                                    {signalCards.length > 0 ? signalCards.map((card) => (
                                        <ScopeReadout
                                            key={card.label}
                                            label={card.label}
                                            value={card.value}
                                            note={card.note}
                                            scope={scope}
                                        />
                                    )) : (
                                        <>
                                            <ScopeReadout label="可视窗口" value="--" note="等待分析" scope={scope} />
                                            <ScopeReadout label="光标" value="--" note="移动鼠标读取" scope={scope} />
                                            <ScopeReadout label="时长" value="--" note="等待分析" scope={scope} />
                                            <ScopeReadout label="主导频率" value="--" note="等待分析" scope={scope} />
                                        </>
                                    )}
                                </SimpleGrid>

                                <Paper
                                    withBorder
                                    radius="lg"
                                    p="md"
                                    style={{
                                        background: scope.canvasShellBackground,
                                        borderColor: scope.canvasShellBorder,
                                    }}
                                >
                                    <Box ref={canvasContainerRef}>
                                        {analysis ? (
                                            <canvas
                                                ref={canvasRef}
                                                onMouseMove={handlePointerMove}
                                                onMouseLeave={() => setHoverInfo(null)}
                                                onDoubleClick={() => setViewport({ start: 0, size: analysis.width })}
                                                style={{
                                                    width: '100%',
                                                    height: 'auto',
                                                    display: 'block',
                                                    borderRadius: '16px',
                                                    cursor: activeView && activeView.size < analysis.width ? 'crosshair' : 'default',
                                                    touchAction: 'none',
                                                    overscrollBehavior: 'contain',
                                                }}
                                            />
                                        ) : (
                                            <Center h={chartHeight}>
                                                <Stack align="center" gap="sm">
                                                    <ThemeIcon size={60} radius="xl" variant="light" color={theme.primaryColor}>
                                                        <IconWaveSine size={30} />
                                                    </ThemeIcon>
                                                    <Title order={4} c={scope.textPrimary}>热力图主画布</Title>
                                                    <Text size="sm" c={scope.textSecondary} ta="center">
                                                        选择音频文件后生成频谱热力图。滚轮缩放，Shift + 滚轮平移。
                                                    </Text>
                                                </Stack>
                                            </Center>
                                        )}
                                    </Box>
                                </Paper>

                                <Stack gap="xs" mt="md">
                                    <Group justify="space-between" align="center">
                                        <div>
                                            <Text size="xs" fw={700} c={scope.textFaint}>TIME AXIS</Text>
                                            <Text size="sm" c={scope.textPrimary}>
                                                {analysis && activeView
                                                    ? formatRange(activeView.start, activeView.start + activeView.size - 1, analysis)
                                                    : '等待时间窗'}
                                            </Text>
                                        </div>

                                        <Group gap="xs">
                                            <ActionIcon
                                                variant="light"
                                                color={theme.primaryColor}
                                                size={34}
                                                onClick={() => analysis && setViewport({ start: 0, size: analysis.width })}
                                                disabled={!analysis}
                                            >
                                                <IconRefresh size={16} />
                                            </ActionIcon>
                                            <Button
                                                size="compact-sm"
                                                variant="light"
                                                color={theme.primaryColor}
                                                onClick={handleExport}
                                                disabled={!analysis || status === 'analyzing'}
                                                leftSection={<IconDownload size={14} />}
                                            >
                                                导出当前视图
                                            </Button>
                                        </Group>
                                    </Group>

                                    <Paper
                                        withBorder
                                        radius="lg"
                                        p="xs"
                                        style={{
                                            background: scope.canvasShellBackground,
                                            borderColor: timelineDragging ? scope.accent : scope.canvasShellBorder,
                                        }}
                                    >
                                        {analysis ? (
                                            <canvas
                                                ref={timelineCanvasRef}
                                                onMouseDown={handleTimelineMouseDown}
                                                style={{
                                                    width: '100%',
                                                    height: `${TIMELINE_HEIGHT}px`,
                                                    display: 'block',
                                                    borderRadius: '12px',
                                                    cursor: timelineDragging ? 'grabbing' : 'grab',
                                                }}
                                            />
                                        ) : (
                                            <Center h={TIMELINE_HEIGHT}>
                                                <Text size="sm" c={scope.textSecondary}>
                                                    时间轴会在分析后显示完整时域概览
                                                </Text>
                                            </Center>
                                        )}
                                    </Paper>

                                    <Text size="xs" c={scope.textMuted}>
                                        拖动高亮窗口平移时间段，滚轮在主画布缩放，双击主画布重置。
                                    </Text>
                                </Stack>
                            </Paper>
                        </Stack>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, xl: 3.6 }}>
                        <Stack gap="md">
                            <InstrumentPanel title="文件输入" scope={scope}>
                                <Stack gap="sm">
                                    <TextInput
                                        label="音频路径"
                                        placeholder="未选择文件"
                                        value={selectedPath}
                                        readOnly
                                        leftSection={<IconFileMusic size={16} />}
                                        rightSectionWidth={70}
                                        rightSection={
                                            <Button
                                                size="compact-xs"
                                                variant="light"
                                                color={theme.primaryColor}
                                                onClick={handleSelectFile}
                                            >
                                                选择
                                            </Button>
                                        }
                                    />

                                    <Group grow>
                                        <Button
                                            color={theme.primaryColor}
                                            leftSection={<IconWaveSine size={16} />}
                                            onClick={handleAnalyze}
                                            loading={status === 'analyzing'}
                                            disabled={!selectedPath}
                                        >
                                            开始分析
                                        </Button>
                                        <ActionIcon
                                            size={36}
                                            variant="subtle"
                                            color="gray"
                                            onClick={handleClear}
                                            disabled={!selectedPath && !analysis}
                                        >
                                            <IconTrash size={16} />
                                        </ActionIcon>
                                    </Group>
                                </Stack>
                            </InstrumentPanel>

                            <InstrumentPanel title="分析参数" scope={scope}>
                                <Stack gap="md">
                                    <div>
                                        <Text size="sm" fw={600} c={scope.textPrimary} mb={8}>FFT 窗口</Text>
                                        <SegmentedControl
                                            fullWidth
                                            value={fftSize}
                                            onChange={setFftSize}
                                            data={[
                                                { label: '1024', value: '1024' },
                                                { label: '2048', value: '2048' },
                                                { label: '4096', value: '4096' },
                                            ]}
                                        />
                                    </div>

                                    <div>
                                        <Text size="sm" fw={600} c={scope.textPrimary} mb={8}>时间分辨率</Text>
                                        <Slider
                                            value={targetColumns}
                                            onChange={setTargetColumns}
                                            min={320}
                                            max={960}
                                            step={32}
                                            marks={RESOLUTION_MARKS}
                                            label={(value) => `${value} 列`}
                                            color={theme.primaryColor}
                                        />
                                    </div>

                                    <div>
                                        <Text size="sm" fw={600} c={scope.textPrimary} mb={8}>频率上限</Text>
                                        <SegmentedControl
                                            fullWidth
                                            value={maxFrequency}
                                            onChange={setMaxFrequency}
                                            data={maxFrequencyPresets.map((preset) => ({
                                                label: preset.label,
                                                value: preset.value,
                                                disabled: preset.disabled,
                                            }))}
                                        />
                                    </div>

                                    <div>
                                        <Text size="sm" fw={600} c={scope.textPrimary} mb={8}>热力配色</Text>
                                        <SegmentedControl
                                            fullWidth
                                            value={palette}
                                            onChange={(value) => setPalette(value as PaletteName)}
                                            data={[
                                                { label: 'Ember', value: 'ember' },
                                                { label: 'Glacier', value: 'glacier' },
                                                { label: 'Neon', value: 'neon' },
                                            ]}
                                        />
                                    </div>
                                </Stack>
                            </InstrumentPanel>

                            <InstrumentPanel title="快速读数" scope={scope}>
                                <Stack gap="sm">
                                    <ScopeLine
                                        label="光标时间"
                                        value={hoverInfo ? formatDuration(hoverInfo.timeSec, true) : '--'}
                                        scope={scope}
                                    />
                                    <ScopeLine
                                        label="光标频率"
                                        value={hoverInfo ? formatFrequency(hoverInfo.frequencyHz) : '--'}
                                        scope={scope}
                                    />
                                    <ScopeLine
                                        label="光标强度"
                                        value={hoverInfo ? `${(hoverInfo.intensity * 100).toFixed(1)}%` : '--'}
                                        scope={scope}
                                    />
                                    <Divider color={scope.grid} />
                                    <ScopeLine
                                        label="频段覆盖"
                                        value={analysis
                                            ? `${formatFrequency(analysis.bandCenters[0])} ~ ${formatFrequency(analysis.bandCenters[analysis.bandCenters.length - 1])}`
                                            : '--'}
                                        scope={scope}
                                    />
                                    <ScopeLine
                                        label="平均 RMS"
                                        value={analysis ? formatPercent(analysis.averageRms) : '--'}
                                        scope={scope}
                                    />
                                    <ScopeLine
                                        label="动态范围"
                                        value={analysis ? `${analysis.dbRange[0].toFixed(0)} ~ ${analysis.dbRange[1].toFixed(0)} dB` : '--'}
                                        scope={scope}
                                    />
                                </Stack>
                            </InstrumentPanel>
                        </Stack>
                    </Grid.Col>
                </Grid>
            </Paper>
        </Stack>
    );
}

function InstrumentPanel({ title, children, scope }: { title: string; children: ReactNode; scope: ScopeThemeTokens }) {
    return (
        <Paper
            withBorder
            radius="xl"
            p="lg"
            style={{
                background: scope.panelBackground,
                borderColor: scope.panelBorder,
            }}
        >
            <Text size="xs" fw={700} mb="md" c={scope.textFaint}>{title.toUpperCase()}</Text>
            {children}
        </Paper>
    );
}

function ScopeReadout(
    { label, value, note, scope }: { label: string; value: string; note: string; scope: ScopeThemeTokens }
) {
    return (
        <Paper
            withBorder
            radius="lg"
            p="md"
            style={{
                background: scope.cardBackground,
                borderColor: scope.panelBorder,
            }}
        >
            <Text size="xs" fw={700} c={scope.textFaint}>{label}</Text>
            <Text size="lg" fw={800} c={scope.textPrimary} mt={6}>{value}</Text>
            <Text size="xs" c={scope.textMuted} mt={4}>{note}</Text>
        </Paper>
    );
}

function ScopeLine({ label, value, scope }: { label: string; value: string; scope: ScopeThemeTokens }) {
    return (
        <Group justify="space-between" gap="md" wrap="nowrap">
            <Text size="xs" fw={700} c={scope.textMuted}>{label}</Text>
            <Text size="sm" fw={700} c={scope.textPrimary} ta="right">{value}</Text>
        </Group>
    );
}

function buildHeatmapSurface(analysis: AudioHeatmapResult, palette: PaletteName): HTMLCanvasElement {
    const surface = document.createElement('canvas');
    surface.width = analysis.width;
    surface.height = analysis.height;
    const context = surface.getContext('2d');

    if (!context) {
        return surface;
    }

    const imageData = context.createImageData(analysis.width, analysis.height);
    for (let band = 0; band < analysis.height; band += 1) {
        for (let column = 0; column < analysis.width; column += 1) {
            const normalized = analysis.intensities[band * analysis.width + column] ?? 0;
            const [red, green, blue] = samplePaletteColor(HEATMAP_PALETTES[palette], normalized);
            const row = analysis.height - 1 - band;
            const pixelIndex = (row * analysis.width + column) * 4;

            imageData.data[pixelIndex] = red;
            imageData.data[pixelIndex + 1] = green;
            imageData.data[pixelIndex + 2] = blue;
            imageData.data[pixelIndex + 3] = 255;
        }
    }

    context.putImageData(imageData, 0, 0);
    return surface;
}

function buildTimelineEnvelope(analysis: AudioHeatmapResult): number[] {
    const envelope = new Array<number>(analysis.width).fill(0);

    for (let column = 0; column < analysis.width; column += 1) {
        let peak = 0;
        let sum = 0;

        for (let band = 0; band < analysis.height; band += 1) {
            const value = analysis.intensities[band * analysis.width + column] ?? 0;
            peak = Math.max(peak, value);
            sum += value;
        }

        envelope[column] = peak * 0.66 + (sum / analysis.height) * 0.34;
    }

    return envelope;
}

function drawHeatmap(
    canvas: HTMLCanvasElement,
    surface: HTMLCanvasElement,
    analysis: AudioHeatmapResult,
    view: ViewWindow,
    totalWidth: number,
    totalHeight: number,
    hoverInfo: HoverInfo | null,
    scope: ScopeThemeTokens
) {
    const ratio = window.devicePixelRatio || 1;
    const plotRect = getHeatmapPlotRect(totalWidth, totalHeight);
    const context = canvas.getContext('2d');

    if (!context) {
        return;
    }

    canvas.width = Math.floor(totalWidth * ratio);
    canvas.height = Math.floor(totalHeight * ratio);
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${totalHeight}px`;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, totalWidth, totalHeight);

    const background = context.createLinearGradient(0, 0, totalWidth, totalHeight);
    background.addColorStop(0, scope.canvasBgStart);
    background.addColorStop(1, scope.canvasBgEnd);
    context.fillStyle = background;
    context.fillRect(0, 0, totalWidth, totalHeight);

    context.fillStyle = scope.plotBackground;
    context.fillRect(plotRect.x, plotRect.y, plotRect.width, plotRect.height);

    context.imageSmoothingEnabled = true;
    context.drawImage(
        surface,
        view.start,
        0,
        Math.max(1, view.size),
        analysis.height,
        plotRect.x,
        plotRect.y,
        plotRect.width,
        plotRect.height
    );

    drawScopeGrid(context, plotRect, scope);
    drawHeatmapAxes(context, analysis, plotRect, totalWidth, view, scope);

    context.strokeStyle = scope.frameBorder;
    context.lineWidth = 1;
    context.strokeRect(plotRect.x, plotRect.y, plotRect.width, plotRect.height);

    if (hoverInfo) {
        const relativeColumn = hoverInfo.column - view.start;
        const columnRatio = view.size <= 1 ? 0 : relativeColumn / (view.size - 1);
        const bandRatio = analysis.height <= 1 ? 0 : hoverInfo.band / (analysis.height - 1);
        const crossX = plotRect.x + columnRatio * plotRect.width;
        const crossY = plotRect.y + plotRect.height - bandRatio * plotRect.height;

        context.strokeStyle = scope.crosshair;
        context.setLineDash([4, 6]);
        context.beginPath();
        context.moveTo(crossX, plotRect.y);
        context.lineTo(crossX, plotRect.y + plotRect.height);
        context.moveTo(plotRect.x, crossY);
        context.lineTo(plotRect.x + plotRect.width, crossY);
        context.stroke();
        context.setLineDash([]);

        context.fillStyle = scope.cursorDot;
        context.beginPath();
        context.arc(crossX, crossY, 3.5, 0, Math.PI * 2);
        context.fill();
    }
}

function drawTimeline(
    canvas: HTMLCanvasElement,
    surface: HTMLCanvasElement,
    analysis: AudioHeatmapResult,
    view: ViewWindow,
    envelope: number[],
    totalWidth: number,
    totalHeight: number,
    hoverInfo: HoverInfo | null,
    scope: ScopeThemeTokens
) {
    const ratio = window.devicePixelRatio || 1;
    const plotRect = getTimelinePlotRect(totalWidth, totalHeight);
    const context = canvas.getContext('2d');

    if (!context) {
        return;
    }

    canvas.width = Math.floor(totalWidth * ratio);
    canvas.height = Math.floor(totalHeight * ratio);
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${totalHeight}px`;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, totalWidth, totalHeight);

    const background = context.createLinearGradient(0, 0, totalWidth, totalHeight);
    background.addColorStop(0, scope.timelineBgStart);
    background.addColorStop(1, scope.timelineBgEnd);
    context.fillStyle = background;
    context.fillRect(0, 0, totalWidth, totalHeight);

    context.globalAlpha = 0.8;
    context.drawImage(
        surface,
        0,
        0,
        analysis.width,
        analysis.height,
        plotRect.x,
        plotRect.y,
        plotRect.width,
        plotRect.height
    );
    context.globalAlpha = 1;

    context.strokeStyle = scope.timelineEnvelope;
    context.lineWidth = 1.6;
    context.beginPath();
    for (let column = 0; column < analysis.width; column += 1) {
        const x = plotRect.x + (column / Math.max(analysis.width - 1, 1)) * plotRect.width;
        const y = plotRect.y + plotRect.height - envelope[column] * plotRect.height;
        if (column === 0) {
            context.moveTo(x, y);
        } else {
            context.lineTo(x, y);
        }
    }
    context.stroke();

    const selectionStart = plotRect.x + (view.start / analysis.width) * plotRect.width;
    const selectionWidth = (view.size / analysis.width) * plotRect.width;

    context.fillStyle = scope.timelineOverlay;
    context.fillRect(plotRect.x, plotRect.y, Math.max(0, selectionStart - plotRect.x), plotRect.height);
    context.fillRect(
        selectionStart + selectionWidth,
        plotRect.y,
        Math.max(0, plotRect.x + plotRect.width - selectionStart - selectionWidth),
        plotRect.height
    );

    context.strokeStyle = scope.timelineSelectionStroke;
    context.lineWidth = 1.4;
    context.strokeRect(selectionStart, plotRect.y, selectionWidth, plotRect.height);

    context.fillStyle = scope.timelineSelectionFill;
    context.fillRect(selectionStart, plotRect.y, selectionWidth, plotRect.height);

    const timeSteps = [0, 0.25, 0.5, 0.75, 1];
    context.fillStyle = scope.axisText;
    context.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';

    timeSteps.forEach((ratioStep, index) => {
        const x = plotRect.x + ratioStep * plotRect.width;
        const label = formatDuration(analysis.durationSec * ratioStep, true);
        const metrics = context.measureText(label);
        const drawX = index === 0 ? x : index === timeSteps.length - 1 ? x - metrics.width : x - metrics.width / 2;

        context.strokeStyle = scope.timelineGrid;
        context.beginPath();
        context.moveTo(x, plotRect.y);
        context.lineTo(x, plotRect.y + plotRect.height);
        context.stroke();

        context.fillText(label, drawX, totalHeight - 6);
    });

    if (hoverInfo) {
        const cursorX = plotRect.x + (hoverInfo.column / Math.max(analysis.width - 1, 1)) * plotRect.width;
        context.strokeStyle = scope.crosshair;
        context.setLineDash([3, 4]);
        context.beginPath();
        context.moveTo(cursorX, plotRect.y);
        context.lineTo(cursorX, plotRect.y + plotRect.height);
        context.stroke();
        context.setLineDash([]);
    }
}

function drawScopeGrid(
    context: CanvasRenderingContext2D,
    plotRect: ReturnType<typeof getHeatmapPlotRect>,
    scope: ScopeThemeTokens
) {
    context.strokeStyle = scope.grid;
    context.lineWidth = 1;

    for (let step = 1; step < 8; step += 1) {
        const x = plotRect.x + (plotRect.width / 8) * step;
        context.beginPath();
        context.moveTo(x, plotRect.y);
        context.lineTo(x, plotRect.y + plotRect.height);
        context.stroke();
    }

    for (let step = 1; step < 6; step += 1) {
        const y = plotRect.y + (plotRect.height / 6) * step;
        context.beginPath();
        context.moveTo(plotRect.x, y);
        context.lineTo(plotRect.x + plotRect.width, y);
        context.stroke();
    }
}

function drawHeatmapAxes(
    context: CanvasRenderingContext2D,
    analysis: AudioHeatmapResult,
    plotRect: ReturnType<typeof getHeatmapPlotRect>,
    totalWidth: number,
    view: ViewWindow,
    scope: ScopeThemeTokens
) {
    context.fillStyle = scope.axisText;
    context.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';

    const startTime = columnToTime(view.start, analysis);
    const endTime = columnToTime(view.start + view.size - 1, analysis);
    const timeSteps = [0, 0.25, 0.5, 0.75, 1];

    timeSteps.forEach((ratio, index) => {
        const x = plotRect.x + ratio * plotRect.width;
        const labelTime = startTime + (endTime - startTime) * ratio;
        const label = formatDuration(labelTime, true);
        const metrics = context.measureText(label);
        const offsetX = index === 4 ? x - metrics.width : index === 0 ? x : x - metrics.width / 2;
        context.fillText(label, offsetX, plotRect.y + plotRect.height + 24);
    });

    const minFrequency = analysis.bandCenters[0];
    const maxFrequency = analysis.bandCenters[analysis.bandCenters.length - 1];
    const frequencyTicks = [60, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
        .filter((value) => value >= minFrequency && value <= maxFrequency);

    if (frequencyTicks[0] !== minFrequency) {
        frequencyTicks.unshift(minFrequency);
    }

    if (frequencyTicks[frequencyTicks.length - 1] !== maxFrequency) {
        frequencyTicks.push(maxFrequency);
    }

    frequencyTicks.forEach((frequency) => {
        const ratio = getFrequencyRatio(frequency, minFrequency, maxFrequency);
        const y = plotRect.y + plotRect.height - ratio * plotRect.height;
        context.fillText(formatFrequency(frequency), 8, y + 4);
    });

    context.save();
    context.translate(totalWidth - 10, plotRect.y + plotRect.height / 2);
    context.rotate(Math.PI / 2);
    context.fillStyle = scope.axisMuted;
    context.fillText('Time', 0, 0);
    context.restore();

    context.save();
    context.translate(14, plotRect.y + 8);
    context.rotate(-Math.PI / 2);
    context.fillStyle = scope.axisMuted;
    context.fillText('Frequency', 0, 0);
    context.restore();
}

function getHeatmapPlotRect(totalWidth: number, totalHeight: number) {
    return {
        x: 74,
        y: 18,
        width: Math.max(120, totalWidth - 102),
        height: Math.max(180, totalHeight - 52),
        totalHeight,
    };
}

function getTimelinePlotRect(totalWidth: number, totalHeight: number) {
    return {
        x: 14,
        y: 10,
        width: Math.max(120, totalWidth - 28),
        height: Math.max(32, totalHeight - 28),
    };
}

function buildScopeTheme(
    theme: ReturnType<typeof useMantineTheme>,
    isDark: boolean
): ScopeThemeTokens {
    const accent = theme.colors[theme.primaryColor][isDark ? 4 : 6];
    const lightBase = '#f4f8fc';
    const lightPanel = '#ffffff';
    const lightShell = '#edf3f9';
    const darkBase = '#090d14';
    const darkPanel = '#0b111a';
    const darkShell = '#050b14';

    return {
        pageBackground: isDark
            ? `radial-gradient(circle at top left, ${rgba(accent, 0.18)}, transparent 38%), ${darkBase}`
            : `radial-gradient(circle at top left, ${rgba(accent, 0.14)}, transparent 36%), ${lightBase}`,
        pageBorder: rgba(accent, isDark ? 0.22 : 0.16),
        pageShadow: isDark
            ? '0 22px 80px rgba(0, 0, 0, 0.28)'
            : '0 16px 48px rgba(67, 86, 107, 0.12)',
        mainPanelBackground: isDark
            ? `linear-gradient(180deg, ${rgba('#07101a', 0.96)}, ${rgba('#04080f', 0.98)})`
            : `linear-gradient(180deg, ${rgba('#ffffff', 0.98)}, ${rgba('#f2f7fb', 0.98)})`,
        panelBackground: isDark
            ? `linear-gradient(180deg, ${rgba(darkPanel, 0.98)}, ${rgba('#070a10', 0.96)})`
            : `linear-gradient(180deg, ${rgba(lightPanel, 0.98)}, ${rgba('#f7fbfe', 0.98)})`,
        panelBorder: isDark ? rgba(accent, 0.14) : rgba('#6b7c8f', 0.14),
        cardBackground: isDark ? rgba('#0f1622', 0.9) : rgba('#ffffff', 0.88),
        textPrimary: isDark ? theme.white : theme.black,
        textSecondary: isDark ? rgba(theme.white, 0.68) : rgba(theme.black, 0.66),
        textMuted: isDark ? rgba(theme.white, 0.56) : rgba(theme.black, 0.54),
        textFaint: isDark ? rgba(theme.white, 0.44) : rgba(theme.black, 0.46),
        canvasShellBackground: isDark ? darkShell : lightShell,
        canvasShellBorder: isDark ? rgba(accent, 0.14) : rgba('#70869c', 0.16),
        canvasBgStart: isDark ? '#07101a' : '#f0f6fb',
        canvasBgEnd: isDark ? '#02050a' : '#dde9f4',
        plotBackground: isDark ? '#040913' : '#ffffff',
        grid: isDark ? rgba(theme.white, 0.07) : rgba(theme.black, 0.08),
        axisText: isDark ? rgba(theme.white, 0.84) : rgba(theme.black, 0.72),
        axisMuted: isDark ? rgba(theme.white, 0.58) : rgba(theme.black, 0.52),
        frameBorder: isDark ? rgba(theme.white, 0.12) : rgba(theme.black, 0.12),
        crosshair: isDark ? rgba(theme.white, 0.88) : rgba(theme.black, 0.76),
        cursorDot: isDark ? rgba(theme.white, 0.92) : rgba(theme.black, 0.82),
        timelineBgStart: isDark ? '#081019' : '#edf4fb',
        timelineBgEnd: isDark ? '#03070d' : '#dce8f5',
        timelineEnvelope: rgba(accent, isDark ? 0.9 : 0.82),
        timelineOverlay: isDark ? 'rgba(0, 0, 0, 0.42)' : 'rgba(255, 255, 255, 0.42)',
        timelineSelectionStroke: isDark ? rgba(theme.white, 0.92) : rgba(theme.black, 0.66),
        timelineSelectionFill: rgba(accent, isDark ? 0.14 : 0.12),
        timelineGrid: isDark ? rgba(theme.white, 0.08) : rgba(theme.black, 0.08),
        accent,
        accentGlow: rgba(accent, isDark ? 0.24 : 0.18),
    };
}

function getChartHeight(canvasWidth: number, viewportHeight: number, isCompactLayout: boolean): number {
    const minHeight = viewportHeight < 760 ? 300 : viewportHeight < 920 ? 360 : 420;
    const desired = Math.round(canvasWidth * (isCompactLayout ? 0.5 : 0.54));
    const maxByWindow = Math.max(minHeight, Math.min(760, viewportHeight - (isCompactLayout ? 300 : 260)));
    return clamp(desired, minHeight, maxByWindow);
}

function resolveViewport(analysis: AudioHeatmapResult | null, viewport: ViewWindow | null): ViewWindow | null {
    if (!analysis) {
        return null;
    }

    const fallback = { start: 0, size: analysis.width };
    if (!viewport) {
        return fallback;
    }

    const size = clamp(Math.round(viewport.size), Math.min(analysis.width, 24), analysis.width);
    const start = clamp(Math.round(viewport.start), 0, Math.max(0, analysis.width - size));
    return { start, size };
}

function zoomViewport(current: ViewWindow, deltaY: number, cursorRatio: number, totalColumns: number): ViewWindow {
    const minSize = Math.min(totalColumns, 24);
    const zoomFactor = deltaY < 0 ? 0.84 : 1.18;
    const nextSize = clamp(Math.round(current.size * zoomFactor), minSize, totalColumns);

    if (nextSize === current.size) {
        return current;
    }

    const focusColumn = current.start + cursorRatio * current.size;
    const nextStart = clamp(
        Math.round(focusColumn - cursorRatio * nextSize),
        0,
        Math.max(0, totalColumns - nextSize)
    );

    return { start: nextStart, size: nextSize };
}

function panViewport(current: ViewWindow, delta: number, totalColumns: number): ViewWindow {
    if (current.size >= totalColumns) {
        return { start: 0, size: totalColumns };
    }

    const step = Math.max(1, Math.round(current.size / 20));
    const offset = Math.round((delta / 72) * step);
    const nextStart = clamp(current.start + offset, 0, Math.max(0, totalColumns - current.size));
    return { start: nextStart, size: current.size };
}

function moveViewportToRatio(current: ViewWindow, ratio: number, anchorRatio: number, totalColumns: number): ViewWindow {
    const focusColumn = ratio * totalColumns;
    const nextStart = clamp(
        Math.round(focusColumn - anchorRatio * current.size),
        0,
        Math.max(0, totalColumns - current.size)
    );

    return { start: nextStart, size: current.size };
}

function getHorizontalRatio(clientX: number, canvas: HTMLCanvasElement): number {
    const rect = canvas.getBoundingClientRect();
    return clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
}

function samplePaletteColor(palette: string[], value: number): [number, number, number] {
    const normalized = Math.min(1, Math.max(0, value));
    const scaled = normalized * (palette.length - 1);
    const baseIndex = Math.floor(scaled);
    const nextIndex = Math.min(palette.length - 1, baseIndex + 1);
    const mix = scaled - baseIndex;
    const [r1, g1, b1] = hexToRgb(palette[baseIndex]);
    const [r2, g2, b2] = hexToRgb(palette[nextIndex]);

    return [
        Math.round(r1 + (r2 - r1) * mix),
        Math.round(g1 + (g2 - g1) * mix),
        Math.round(b1 + (b2 - b1) * mix),
    ];
}

function hexToRgb(hex: string): [number, number, number] {
    const cleaned = hex.replace('#', '');
    return [
        Number.parseInt(cleaned.slice(0, 2), 16),
        Number.parseInt(cleaned.slice(2, 4), 16),
        Number.parseInt(cleaned.slice(4, 6), 16),
    ];
}

function stripExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot === -1 ? fileName : fileName.slice(0, lastDot);
}

function extractFileName(filePath: string): string {
    return filePath.split(/[/\\]/).pop() || filePath;
}

function formatDuration(seconds: number, compact = false): string {
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return compact ? '0.00s' : '00:00.00';
    }

    const minutes = Math.floor(seconds / 60);
    const remaining = seconds - minutes * 60;

    if (compact && minutes === 0) {
        return `${remaining.toFixed(2)}s`;
    }

    return `${String(minutes).padStart(2, '0')}:${remaining.toFixed(2).padStart(5, '0')}`;
}

function formatFrequency(frequency: number): string {
    if (!Number.isFinite(frequency) || frequency <= 0) {
        return '0 Hz';
    }

    if (frequency >= 1000) {
        return `${(frequency / 1000).toFixed(frequency >= 10_000 ? 0 : 1)} kHz`;
    }

    return `${Math.round(frequency)} Hz`;
}

function formatFileSize(bytes: number): string {
    if (bytes >= 1024 * 1024) {
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    }

    if (bytes >= 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${bytes} B`;
}

function formatPercent(value: number): string {
    return `${Math.max(0, Math.min(100, value * 100)).toFixed(1)}%`;
}

function formatRange(startColumn: number, endColumn: number, analysis: AudioHeatmapResult): string {
    return `${formatDuration(columnToTime(startColumn, analysis), true)} ~ ${formatDuration(columnToTime(endColumn, analysis), true)}`;
}

function getFrequencyRatio(frequency: number, minFrequency: number, maxFrequency: number): number {
    if (maxFrequency <= minFrequency) {
        return 0;
    }

    const clamped = Math.min(maxFrequency, Math.max(minFrequency, frequency));
    return (
        (Math.log(clamped) - Math.log(minFrequency)) /
        (Math.log(maxFrequency) - Math.log(minFrequency))
    );
}

function columnToTime(column: number, analysis: AudioHeatmapResult): number {
    if (analysis.width <= 1) {
        return 0;
    }

    const clampedColumn = clamp(column, 0, analysis.width - 1);
    return (clampedColumn / (analysis.width - 1)) * analysis.durationSec;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
