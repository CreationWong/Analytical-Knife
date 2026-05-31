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
    IconPlayerPause,
    IconPlayerPlay,
    IconPlayerStop,
    IconRefresh,
    IconTrash,
    IconWaveSine,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
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
    bandStart: number;
    bandSize: number;
}

interface BrushSelection {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    startColumn: number;
    currentColumn: number;
    startBand: number;
    currentBand: number;
}

interface HeatmapPoint {
    x: number;
    y: number;
    column: number;
    band: number;
    timeSec: number;
    frequencyHz: number;
    intensity: number;
    cursorRatio: number;
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
const AUDIO_MIME_MAP: Record<string, string> = {
    wav: 'audio/wav',
    wave: 'audio/wav',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    flac: 'audio/flac',
    opus: 'audio/ogg; codecs=opus',
    wma: 'audio/x-ms-wma',
};

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
    const [brushSelection, setBrushSelection] = useState<BrushSelection | null>(null);
    const [heatmapDragging, setHeatmapDragging] = useState(false);
    const [timelineDragging, setTimelineDragging] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackTime, setPlaybackTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const [audioSource, setAudioSource] = useState('');

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioObjectUrlRef = useRef<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const timelineCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const canvasContainerRef = useRef<HTMLDivElement | null>(null);
    const heatmapDragRef = useRef<{ view: ViewWindow; selection: BrushSelection } | null>(null);
    const timelineDragRef = useRef<{ anchorRatio: number } | null>(null);
    const playbackTimerRef = useRef<number | null>(null);

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
    const playbackDuration = analysis?.durationSec ?? audioDuration;
    const playbackColumn = useMemo(
        () => (analysis ? timeToColumn(playbackTime, analysis) : null),
        [analysis, playbackTime]
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
            brushSelection,
            playbackColumn,
            scope
        );
    }, [analysis, activeView, brushSelection, canvasWidth, chartHeight, heatmapSurface, hoverInfo, playbackColumn, scope]);

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
            playbackColumn,
            scope
        );
    }, [analysis, activeView, canvasWidth, heatmapSurface, hoverInfo, playbackColumn, timelineEnvelope, scope]);

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
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        const syncTime = () => setPlaybackTime(audio.currentTime || 0);
        const syncDuration = () => {
            const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
            setAudioDuration(duration);
        };
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => {
            setIsPlaying(false);
            syncTime();
        };
        const handleEnded = () => {
            setIsPlaying(false);
            syncTime();
        };
        const handleError = () => {
            setIsPlaying(false);
        };

        audio.addEventListener('loadedmetadata', syncDuration);
        audio.addEventListener('durationchange', syncDuration);
        audio.addEventListener('timeupdate', syncTime);
        audio.addEventListener('seeked', syncTime);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);

        return () => {
            audio.removeEventListener('loadedmetadata', syncDuration);
            audio.removeEventListener('durationchange', syncDuration);
            audio.removeEventListener('timeupdate', syncTime);
            audio.removeEventListener('seeked', syncTime);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const resetAudioElement = () => {
            const audio = audioRef.current;
            if (!audio) {
                return;
            }

            audio.pause();
            audio.currentTime = 0;
            audio.removeAttribute('src');
            audio.load();
        };

        const revokePreviousUrl = () => {
            if (audioObjectUrlRef.current) {
                URL.revokeObjectURL(audioObjectUrlRef.current);
                audioObjectUrlRef.current = null;
            }
        };

        revokePreviousUrl();
        setAudioSource('');
        setIsPlaying(false);
        setPlaybackTime(0);
        setAudioDuration(0);

        if (!selectedPath) {
            resetAudioElement();
            return () => {
                cancelled = true;
            };
        }

        const loadAudioSource = async () => {
            try {
                const ext = selectedPath.split('.').pop()?.toLowerCase() || '';
                const mimeType = AUDIO_MIME_MAP[ext] || 'application/octet-stream';
                const bytes = await readFile(selectedPath);

                if (cancelled) {
                    return;
                }

                const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
                audioObjectUrlRef.current = objectUrl;
                setAudioSource(objectUrl);
            } catch (error) {
                console.error(error);
                resetAudioElement();
                showNotification({
                    type: 'error',
                    title: '音频装载失败',
                    message: error instanceof Error ? error.message : '无法读取当前音频文件',
                });
            }
        };

        loadAudioSource();

        return () => {
            cancelled = true;
            revokePreviousUrl();
        };
    }, [selectedPath]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        audio.pause();
        setIsPlaying(false);
        setPlaybackTime(0);
        setAudioDuration(0);

        if (!audioSource) {
            audio.removeAttribute('src');
            audio.load();
            return;
        }

        audio.currentTime = 0;
        audio.load();
    }, [audioSource]);

    useEffect(() => {
        if (playbackTimerRef.current !== null) {
            window.clearInterval(playbackTimerRef.current);
            playbackTimerRef.current = null;
        }

        if (!isPlaying) {
            return;
        }

        playbackTimerRef.current = window.setInterval(() => {
            const audio = audioRef.current;
            if (audio) {
                setPlaybackTime(audio.currentTime || 0);
            }
        }, 50);

        return () => {
            if (playbackTimerRef.current !== null) {
                window.clearInterval(playbackTimerRef.current);
                playbackTimerRef.current = null;
            }
        };
    }, [isPlaying]);

    useEffect(() => {
        if (!heatmapDragging || !analysis) {
            return;
        }

        const handleMouseMove = (event: globalThis.MouseEvent) => {
            const canvas = canvasRef.current;
            const dragMeta = heatmapDragRef.current;
            if (!canvas || !dragMeta) {
                return;
            }

            const point = readHeatmapPoint(
                event.clientX,
                event.clientY,
                canvas,
                canvasWidth,
                chartHeight,
                analysis,
                dragMeta.view,
                true
            );

            if (!point) {
                return;
            }

            const nextSelection: BrushSelection = {
                ...dragMeta.selection,
                currentX: point.x,
                currentY: point.y,
                currentColumn: point.column,
                currentBand: point.band,
            };

            heatmapDragRef.current = {
                view: dragMeta.view,
                selection: nextSelection,
            };
            setBrushSelection(nextSelection);
            setHoverInfo({
                column: point.column,
                band: point.band,
                timeSec: point.timeSec,
                frequencyHz: point.frequencyHz,
                intensity: point.intensity,
            });
        };

        const handleMouseUp = (event: globalThis.MouseEvent) => {
            const canvas = canvasRef.current;
            const dragMeta = heatmapDragRef.current;
            if (!canvas || !dragMeta) {
                heatmapDragRef.current = null;
                setBrushSelection(null);
                setHeatmapDragging(false);
                return;
            }

            const point = readHeatmapPoint(
                event.clientX,
                event.clientY,
                canvas,
                canvasWidth,
                chartHeight,
                analysis,
                dragMeta.view,
                true
            );

            const finalSelection = point ? {
                ...dragMeta.selection,
                currentX: point.x,
                currentY: point.y,
                currentColumn: point.column,
                currentBand: point.band,
            } : dragMeta.selection;

            const dragDistance = Math.hypot(
                finalSelection.currentX - finalSelection.startX,
                finalSelection.currentY - finalSelection.startY
            );

            if (dragDistance < 6) {
                handleSeekToTime(columnToTime(finalSelection.currentColumn, analysis));
            } else {
                setViewport(createViewFromSelection(finalSelection, analysis));
            }

            heatmapDragRef.current = null;
            setBrushSelection(null);
            setHeatmapDragging(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [analysis, canvasWidth, chartHeight, heatmapDragging]);

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
                const next = resolveViewport(analysis, current) ?? createFullView(analysis);
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

        const visibleMinBand = activeView.bandStart;
        const visibleMaxBand = activeView.bandStart + activeView.bandSize - 1;

        return [
            {
                label: '可视窗口',
                value: formatRange(activeView.start, activeView.start + activeView.size - 1, analysis),
                note: `${activeView.size}/${analysis.width} 列 · ${activeView.bandSize}/${analysis.height} 带`,
            },
            {
                label: '可视频段',
                value: `${formatFrequency(analysis.bandCenters[visibleMinBand])} ~ ${formatFrequency(analysis.bandCenters[visibleMaxBand])}`,
                note: '拖拽矩形聚焦局部频带',
            },
            {
                label: '播放头',
                value: formatDuration(playbackTime, true),
                note: isPlaying ? '播放中' : audioSource ? '可单击热力图定位' : '等待装载',
            },
            {
                label: '光标',
                value: hoverInfo ? formatDuration(hoverInfo.timeSec, true) : '--',
                note: hoverInfo ? formatFrequency(hoverInfo.frequencyHz) : '移动鼠标读取',
            },
            {
                label: '主导频率',
                value: formatFrequency(analysis.dominantFrequency),
                note: `峰值 ${formatPercent(analysis.peakAmplitude)}`,
            },
        ];
    }, [analysis, activeView, audioSource, hoverInfo, isPlaying, playbackTime]);

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
        setBrushSelection(null);
        setHeatmapDragging(false);
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
                setViewport(createFullView(result));
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
        setBrushSelection(null);
        setHeatmapDragging(false);
        setIsPlaying(false);
        setPlaybackTime(0);
        setAudioDuration(0);

        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
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
        if (!analysis || !activeView || heatmapDragRef.current) {
            return;
        }

        const point = readHeatmapPoint(
            event.clientX,
            event.clientY,
            event.currentTarget,
            canvasWidth,
            chartHeight,
            analysis,
            activeView
        );

        if (!point) {
            setHoverInfo(null);
            return;
        }

        setHoverInfo({
            column: point.column,
            band: point.band,
            timeSec: point.timeSec,
            frequencyHz: point.frequencyHz,
            intensity: point.intensity,
        });
    };

    const handleHeatmapWheel = (event: globalThis.WheelEvent, currentTarget: HTMLCanvasElement) => {
        if (!analysis || !activeView) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const point = readHeatmapPoint(
            event.clientX,
            event.clientY,
            currentTarget,
            canvasWidth,
            chartHeight,
            analysis,
            activeView
        );

        if (!point) {
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

        setViewport((current) => {
            const next = current ?? activeView;
            return zoomViewport(next, event.deltaY, point.cursorRatio, analysis.width);
        });
    };

    const handleHeatmapMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
        if (!analysis || !activeView || event.button !== 0) {
            return;
        }

        const point = readHeatmapPoint(
            event.clientX,
            event.clientY,
            event.currentTarget,
            canvasWidth,
            chartHeight,
            analysis,
            activeView
        );

        if (!point) {
            return;
        }

        event.preventDefault();

        const selection: BrushSelection = {
            startX: point.x,
            startY: point.y,
            currentX: point.x,
            currentY: point.y,
            startColumn: point.column,
            currentColumn: point.column,
            startBand: point.band,
            currentBand: point.band,
        };

        heatmapDragRef.current = {
            view: activeView,
            selection,
        };
        setBrushSelection(selection);
        setHeatmapDragging(true);
    };

    const handleTogglePlayback = async () => {
        const audio = audioRef.current;
        if (!audio || !audioSource) {
            return;
        }

        try {
            if (audio.paused) {
                await audio.play();
            } else {
                audio.pause();
            }
        } catch (error) {
            console.error(error);
            showNotification({
                type: 'error',
                title: '播放失败',
                message: error instanceof Error ? error.message : '当前音频无法播放',
            });
        }
    };

    const handleStopPlayback = () => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        audio.pause();
        audio.currentTime = 0;
        setPlaybackTime(0);
    };

    const handleSeekToTime = (nextTime: number) => {
        const audio = audioRef.current;
        const duration = playbackDuration || audio?.duration || 0;
        const clampedTime = clamp(nextTime, 0, duration || nextTime);

        if (audio) {
            audio.currentTime = clampedTime;
        }

        setPlaybackTime(clampedTime);
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
                                                主视图用于频谱浏览与框选放大，时间轴用于定位和拖拽窗口。
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

                                <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 5 }} spacing="md" mb="md">
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
                                            <ScopeReadout label="可视频段" value="--" note="等待分析" scope={scope} />
                                            <ScopeReadout label="播放头" value="--" note="等待装载" scope={scope} />
                                            <ScopeReadout label="光标" value="--" note="移动鼠标读取" scope={scope} />
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
                                                onMouseDown={handleHeatmapMouseDown}
                                                onMouseMove={handlePointerMove}
                                                onMouseLeave={() => setHoverInfo(null)}
                                                onDoubleClick={() => setViewport(createFullView(analysis))}
                                                style={{
                                                    width: '100%',
                                                    height: 'auto',
                                                    display: 'block',
                                                    borderRadius: '16px',
                                                    cursor: heatmapDragging ? 'crosshair' : 'cell',
                                                    touchAction: 'none',
                                                    overscrollBehavior: 'contain',
                                                    userSelect: 'none',
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
                                                        选择音频文件后生成频谱热力图。拖拽矩形放大，滚轮缩放，单击定位播放头。
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
                                            <Text size="xs" c={scope.textMuted}>
                                                {analysis
                                                    ? `播放头 ${formatDuration(playbackTime, true)} / ${formatDuration(playbackDuration)}`
                                                    : '等待音频装载'}
                                            </Text>
                                        </div>

                                        <Group gap="xs">
                                            <ActionIcon
                                                variant="light"
                                                color={theme.primaryColor}
                                                size={34}
                                                onClick={() => analysis && setViewport(createFullView(analysis))}
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
                                        主画布拖拽矩形放大局部区域，单击可定位播放头；拖动时间轴高亮窗口平移时间段，双击主画布重置。
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

                            <InstrumentPanel title="播放控制" scope={scope}>
                                <Stack gap="sm">
                                    <Group grow>
                                        <Button
                                            color={theme.primaryColor}
                                            variant={isPlaying ? 'light' : 'filled'}
                                            leftSection={isPlaying ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
                                            onClick={handleTogglePlayback}
                                            disabled={!audioSource}
                                        >
                                            {isPlaying ? '暂停' : '播放'}
                                        </Button>
                                        <ActionIcon
                                            size={36}
                                            variant="light"
                                            color={theme.primaryColor}
                                            onClick={handleStopPlayback}
                                            disabled={!audioSource}
                                        >
                                            <IconPlayerStop size={16} />
                                        </ActionIcon>
                                    </Group>

                                    <ScopeLine
                                        label="当前位置"
                                        value={`${formatDuration(playbackTime)} / ${formatDuration(playbackDuration)}`}
                                        scope={scope}
                                    />
                                    <ScopeLine
                                        label="定位方式"
                                        value="单击热力图"
                                        scope={scope}
                                    />
                                    <ScopeLine
                                        label="当前状态"
                                        value={isPlaying ? '播放中' : audioSource ? '已装载' : '未装载'}
                                        scope={scope}
                                    />
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
                                        value={analysis && activeView
                                            ? `${formatFrequency(analysis.bandCenters[activeView.bandStart])} ~ ${formatFrequency(analysis.bandCenters[activeView.bandStart + activeView.bandSize - 1])}`
                                            : '--'}
                                        scope={scope}
                                    />
                                    <ScopeLine
                                        label="总时长"
                                        value={analysis ? formatDuration(analysis.durationSec) : '--'}
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
            <audio ref={audioRef} src={audioSource || undefined} preload="metadata" style={{ display: 'none' }} />
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
    brushSelection: BrushSelection | null,
    playbackColumn: number | null,
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
        analysis.height - view.bandStart - view.bandSize,
        Math.max(1, view.size),
        Math.max(1, view.bandSize),
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

    if (playbackColumn !== null && playbackColumn >= view.start && playbackColumn < view.start + view.size) {
        const relativeColumn = playbackColumn - view.start;
        const lineX = plotRect.x + (relativeColumn / Math.max(view.size - 1, 1)) * plotRect.width;

        context.strokeStyle = scope.accent;
        context.lineWidth = 2;
        context.shadowBlur = 14;
        context.shadowColor = scope.accentGlow;
        context.beginPath();
        context.moveTo(lineX, plotRect.y);
        context.lineTo(lineX, plotRect.y + plotRect.height);
        context.stroke();
        context.shadowBlur = 0;
    }

    if (brushSelection) {
        const brushLeft = Math.min(brushSelection.startX, brushSelection.currentX);
        const brushTop = Math.min(brushSelection.startY, brushSelection.currentY);
        const brushWidth = Math.abs(brushSelection.currentX - brushSelection.startX);
        const brushHeight = Math.abs(brushSelection.currentY - brushSelection.startY);

        context.fillStyle = rgba(scope.accent, 0.16);
        context.fillRect(brushLeft, brushTop, brushWidth, brushHeight);
        context.strokeStyle = rgba(scope.accent, 0.94);
        context.lineWidth = 1.4;
        context.setLineDash([6, 4]);
        context.strokeRect(brushLeft, brushTop, brushWidth, brushHeight);
        context.setLineDash([]);
    }

    if (
        hoverInfo &&
        hoverInfo.column >= view.start &&
        hoverInfo.column < view.start + view.size &&
        hoverInfo.band >= view.bandStart &&
        hoverInfo.band < view.bandStart + view.bandSize
    ) {
        const relativeColumn = hoverInfo.column - view.start;
        const columnRatio = view.size <= 1 ? 0 : relativeColumn / (view.size - 1);
        const relativeBand = hoverInfo.band - view.bandStart;
        const bandRatio = view.bandSize <= 1 ? 0 : relativeBand / (view.bandSize - 1);
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
    playbackColumn: number | null,
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

    if (playbackColumn !== null) {
        const playheadX = plotRect.x + (playbackColumn / Math.max(analysis.width - 1, 1)) * plotRect.width;
        context.strokeStyle = scope.accent;
        context.lineWidth = 2;
        context.shadowBlur = 12;
        context.shadowColor = scope.accentGlow;
        context.beginPath();
        context.moveTo(playheadX, plotRect.y);
        context.lineTo(playheadX, plotRect.y + plotRect.height);
        context.stroke();
        context.shadowBlur = 0;
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

    const minFrequency = analysis.bandCenters[view.bandStart];
    const maxFrequency = analysis.bandCenters[view.bandStart + view.bandSize - 1];
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

function createFullView(analysis: AudioHeatmapResult): ViewWindow {
    return {
        start: 0,
        size: analysis.width,
        bandStart: 0,
        bandSize: analysis.height,
    };
}

function createViewFromSelection(selection: BrushSelection, analysis: AudioHeatmapResult): ViewWindow {
    const columnWindow = buildWindowFromRange(
        selection.startColumn,
        selection.currentColumn,
        analysis.width,
        Math.min(analysis.width, 24)
    );
    const bandWindow = buildWindowFromRange(
        selection.startBand,
        selection.currentBand,
        analysis.height,
        Math.min(analysis.height, 8)
    );

    return {
        start: columnWindow.start,
        size: columnWindow.size,
        bandStart: bandWindow.start,
        bandSize: bandWindow.size,
    };
}

function buildWindowFromRange(first: number, second: number, total: number, minSize: number) {
    const start = Math.min(first, second);
    const end = Math.max(first, second);
    const center = (start + end) / 2;
    const size = clamp(end - start + 1, minSize, total);
    const windowStart = clamp(Math.round(center - size / 2), 0, Math.max(0, total - size));

    return {
        start: windowStart,
        size,
    };
}

function readHeatmapPoint(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    totalWidth: number,
    totalHeight: number,
    analysis: AudioHeatmapResult,
    view: ViewWindow,
    clampToPlot = false
): HeatmapPoint | null {
    const plotRect = getHeatmapPlotRect(totalWidth, totalHeight);
    const bounds = canvas.getBoundingClientRect();
    const scaleX = totalWidth / Math.max(bounds.width, 1);
    const scaleY = plotRect.totalHeight / Math.max(bounds.height, 1);
    const rawX = (clientX - bounds.left) * scaleX;
    const rawY = (clientY - bounds.top) * scaleY;

    const x = clampToPlot ? clamp(rawX, plotRect.x, plotRect.x + plotRect.width) : rawX;
    const y = clampToPlot ? clamp(rawY, plotRect.y, plotRect.y + plotRect.height) : rawY;

    if (
        x < plotRect.x ||
        x > plotRect.x + plotRect.width ||
        y < plotRect.y ||
        y > plotRect.y + plotRect.height
    ) {
        return null;
    }

    const localColumn = Math.min(
        view.size - 1,
        Math.max(0, Math.floor(((x - plotRect.x) / plotRect.width) * view.size))
    );
    const column = Math.min(analysis.width - 1, view.start + localColumn);

    const topBand = Math.min(
        view.bandSize - 1,
        Math.max(0, Math.floor(((y - plotRect.y) / plotRect.height) * view.bandSize))
    );
    const band = clamp(
        view.bandStart + view.bandSize - 1 - topBand,
        view.bandStart,
        view.bandStart + view.bandSize - 1
    );

    return {
        x,
        y,
        column,
        band,
        timeSec: columnToTime(column, analysis),
        frequencyHz: analysis.bandCenters[band],
        intensity: analysis.intensities[band * analysis.width + column] ?? 0,
        cursorRatio: (x - plotRect.x) / Math.max(plotRect.width, 1),
    };
}

function resolveViewport(analysis: AudioHeatmapResult | null, viewport: ViewWindow | null): ViewWindow | null {
    if (!analysis) {
        return null;
    }

    const fallback = createFullView(analysis);
    if (!viewport) {
        return fallback;
    }

    const size = clamp(Math.round(viewport.size), Math.min(analysis.width, 24), analysis.width);
    const start = clamp(Math.round(viewport.start), 0, Math.max(0, analysis.width - size));
    const bandSize = clamp(Math.round(viewport.bandSize), Math.min(analysis.height, 8), analysis.height);
    const bandStart = clamp(Math.round(viewport.bandStart), 0, Math.max(0, analysis.height - bandSize));
    return { start, size, bandStart, bandSize };
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

    return { ...current, start: nextStart, size: nextSize };
}

function panViewport(current: ViewWindow, delta: number, totalColumns: number): ViewWindow {
    if (current.size >= totalColumns) {
        return { ...current, start: 0, size: totalColumns };
    }

    const step = Math.max(1, Math.round(current.size / 20));
    const offset = Math.round((delta / 72) * step);
    const nextStart = clamp(current.start + offset, 0, Math.max(0, totalColumns - current.size));
    return { ...current, start: nextStart, size: current.size };
}

function moveViewportToRatio(current: ViewWindow, ratio: number, anchorRatio: number, totalColumns: number): ViewWindow {
    const focusColumn = ratio * totalColumns;
    const nextStart = clamp(
        Math.round(focusColumn - anchorRatio * current.size),
        0,
        Math.max(0, totalColumns - current.size)
    );

    return { ...current, start: nextStart, size: current.size };
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

function timeToColumn(timeSec: number, analysis: AudioHeatmapResult): number {
    if (analysis.width <= 1 || analysis.durationSec <= 0) {
        return 0;
    }

    const normalized = clamp(timeSec / analysis.durationSec, 0, 1);
    return Math.round(normalized * (analysis.width - 1));
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
