import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
    Paper, Button, Stack, SegmentedControl, Text, Progress, ScrollArea,
    Group, Box, ActionIcon, SimpleGrid, Textarea, TextInput, FileInput, Title
} from '@mantine/core';
import {
    IconTerminal2, IconPlayerPlay, IconPlayerStop,
    IconTrash, IconBolt, IconFileTypeZip, IconSettings,
    IconAlertTriangle, IconFileImport, IconAdjustmentsHorizontal
} from '@tabler/icons-react';

// APIs & Hooks
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { showNotification } from '@/utils/notifications';
import { handleAppError } from '@/utils/error';
import { useAppSettings } from '@/hooks/useAppSettings';

// --- 1. 核心常量与安全过滤 ---
enum TaskStatus { IDLE, RUNNING, ERROR }
const BANNED_TOKENS = ['/etc/', '/dev/', 'C:\\Windows', 'rm ', 'format '];
const VIDEO_EXTS = ['mp4', 'mkv', 'mov', 'avi', 'flv', 'webm'];
const AUDIO_EXTS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];

// --- 2. 核心逻辑工具 (解耦至外部) ---
const FFmpegParser = {
    tokenize: (str: string) => {
        const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
        const res = [];
        let m;
        while ((m = regex.exec(str)) !== null) res.push(m[1] || m[2] || m[0]);
        return res;
    },
    isSafe: (args: string[]) => !args.some(arg => BANNED_TOKENS.some(b => arg.includes(b))),
    validate: (args: string[], ext: string) => {
        const argsSet = new Set(args);
        const lowExt = ext.toLowerCase();
        if (argsSet.has('-vn') && VIDEO_EXTS.includes(lowExt)) return `逻辑冲突: -vn 与 .${ext} 不匹配`;
        if (argsSet.has('-an') && AUDIO_EXTS.includes(lowExt)) return `逻辑冲突: -an 与 .${ext} 不匹配`;
        return null;
    }
};

export default function FFmpegToolPro() {
    const [settings] = useAppSettings();
    const primaryColor = settings.primaryColor || 'blue';

    // --- 状态控制 ---
    const [engineType, setEngineType] = useState<'native' | 'wasm'>('wasm');
    const [status, setStatus] = useState<TaskStatus>(TaskStatus.IDLE);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);

    // 输入/输出状态
    const [file, setFile] = useState<File | null>(null);
    const [nativePath, setNativePath] = useState<string>('');
    const [rawArgs, setRawArgs] = useState('-preset fast -crf 23 -y');
    const [customExt, setCustomExt] = useState('mp4');
    const [hasNative, setHasNative] = useState(false);

    // 引用控制
    const ffmpegRef = useRef<FFmpeg | null>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const lastProgressTime = useRef<number>(0);

    // --- 3. 引擎执行策略 ---
    const runNativeEngine = async (args: string[], out: string) => {
        await invoke('run_ffmpeg_stream', { inputPath: nativePath, outputPath: out, args });
    };

    const runWasmEngine = async (args: string[], out: string) => {
        if (!ffmpegRef.current) {
            const ff = new FFmpeg();
            ff.on('log', ({ message }) => appendLog(`[WASM] ${message}`));
            ff.on('progress', ({ progress: p }) => {
                const now = Date.now();
                if (now - lastProgressTime.current > 100) { // Throttle 100ms
                    setProgress(Math.round(p * 100));
                    lastProgressTime.current = now;
                }
            });
            await ff.load();
            ffmpegRef.current = ff;
        }
        const ff = ffmpegRef.current;
        await ff.writeFile('in', await fetchFile(file!));
        const code = await ff.exec(['-i', 'in', ...args, `out.${customExt}`]);
        if (code !== 0) throw new Error('FFmpeg Wasm Exit Code: ' + code);
        const data = await ff.readFile(`out.${customExt}`);
        await writeFile(out, new Uint8Array(data as ArrayBuffer));
    };

    // --- 4. 辅助动作 ---
    const appendLog = (msg: string) => {
        setLogs(prev => [...prev.slice(-199), msg]); // 限制 200 行，防止 DOM 爆炸
    };

    const handleStop = useCallback(() => {
        if (engineType === 'wasm') {
            // Wasm 目前很难优雅 abort，强制 terminate 会丢失实例
            ffmpegRef.current?.terminate();
            ffmpegRef.current = null;
        }
        setStatus(TaskStatus.IDLE);
        appendLog('[System] 任务已人为中断');
        showNotification({ title: '已停止', message: '操作已被中止', type: 'warning' });
    }, [engineType]);

    const activeInput = useMemo(() => engineType === 'native' ? nativePath : (file?.name || ''), [engineType, nativePath, file]);

    useEffect(() => {
        if (activeInput) {
            const ext = activeInput.split('.').pop()?.toLowerCase();
            if (ext) setCustomExt(ext);
        }
    }, [activeInput]);

    useEffect(() => {
        invoke<boolean>('check_ffmpeg').then(setHasNative).catch(() => setHasNative(false));
        return () => { ffmpegRef.current?.terminate(); }; // 组件卸载清理
    }, []);

    const validationError = useMemo(() => {
        const tokens = FFmpegParser.tokenize(rawArgs);
        if (!FFmpegParser.isSafe(tokens)) return "包含非法路径或注入敏感词";
        return FFmpegParser.validate(tokens, customExt);
    }, [rawArgs, customExt]);

    const handleRun = async () => {
        if (status === TaskStatus.RUNNING || !activeInput || validationError) return;

        try {
            const fileName = activeInput.split(/[/\\]/).pop() || 'output';
            const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || 'output';
            const savePath = await save({
                title: '保存位置',
                defaultPath: `${baseName}_ff.${customExt}`,
                filters: [{ name: 'Media', extensions: [customExt] }]
            });
            if (!savePath) return;

            setStatus(TaskStatus.RUNNING);
            setProgress(0);
            appendLog(`[System] 开始任务 | 引擎: ${engineType.toUpperCase()}`);

            const args = FFmpegParser.tokenize(rawArgs);
            if (engineType === 'native') await runNativeEngine(args, savePath);
            else await runWasmEngine(args, savePath);

            setStatus(TaskStatus.IDLE);
            setProgress(100);
            showNotification({ title: '完成', message: '处理成功', type: 'info' });
        } catch (err: any) {
            handleAppError(err);
            setStatus(TaskStatus.ERROR);
        }
    };

    return (
        <Stack gap="md" p="md">
            <Group justify="space-between">
                <Group gap="sm">
                    <IconBolt color={`var(--mantine-color-${primaryColor}-filled)`} size={28} />
                    <Box>
                        <Title order={4}>FFMPEG PRO</Title>
                        <Text size="xs" c={status === TaskStatus.ERROR ? 'red' : 'dimmed'}>
                            {status === TaskStatus.ERROR ? '发生致命错误，请检查控制台' : '安全沙箱媒体终端'}
                        </Text>
                    </Box>
                </Group>
                <SegmentedControl
                    size="xs"
                    value={engineType}
                    onChange={(v) => setEngineType(v as any)}
                    data={[{ label: 'Native', value: 'native', disabled: !hasNative }, { label: 'Wasm', value: 'wasm' }]}
                />
            </Group>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <Stack gap="md">
                    <Paper withBorder p="md" radius="sm">
                        <Group mb="xs" gap="xs">
                            <IconFileImport size={18} color={`var(--mantine-color-${primaryColor}-filled)`} />
                            <Text fw={700} size="sm">INPUT_CONFIG</Text>
                        </Group>
                        {engineType === 'native' ? (
                            <Group gap={5}>
                                <Box style={{ flex: 1, height: 36, display: 'flex', alignItems: 'center', px: 12, backgroundColor: 'var(--mantine-color-default-hover)', borderRadius: '4px' }}>
                                    <Text size="xs" truncate c={nativePath ? 'text' : 'dimmed'}>{nativePath || '未选文件'}</Text>
                                </Box>
                                <Button variant="light" color={primaryColor} size="xs" onClick={async () => {
                                    const s = await open({ multiple: false });
                                    if (s && !Array.isArray(s)) setNativePath(s);
                                }}>浏览</Button>
                            </Group>
                        ) : (
                            <FileInput placeholder="上传文件" size="sm" value={file} onChange={setFile} leftSection={<IconSettings size={14} />} />
                        )}
                        <TextInput mt="md" label="OUTPUT_EXT" size="xs" value={customExt} onChange={(e) => setCustomExt(e.currentTarget.value)} rightSection={<IconFileTypeZip size={14} color="gray" />} />
                    </Paper>

                    <Paper withBorder p="md" radius="sm">
                        <Group mb="xs" gap="xs">
                            <IconAdjustmentsHorizontal size={18} color={`var(--mantine-color-${primaryColor}-filled)`} />
                            <Text fw={700} size="sm">ARGS_EDITOR</Text>
                        </Group>
                        <Textarea
                            minRows={4}
                            value={rawArgs}
                            onChange={(e) => setRawArgs(e.currentTarget.value)}
                            styles={{ input: { fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' } }}
                        />
                        {validationError && (
                            <Group mt="xs" gap={5}>
                                <IconAlertTriangle size={14} color="red" />
                                <Text size="xs" c="red" fw={600}>{validationError}</Text>
                            </Group>
                        )}
                    </Paper>

                    <Paper withBorder p="md" radius="sm" bg="var(--mantine-color-default-hover)">
                        <Stack gap="xs">
                            <Group justify="space-between">
                                <Text size="xs" fw={700}>PROGRESS</Text>
                                <Text size="xs" ff="monospace" fw={700} c={primaryColor}>{progress}%</Text>
                            </Group>
                            <Progress value={progress} color={primaryColor} size="sm" radius="xl" animated={status === TaskStatus.RUNNING} />
                            <Group grow>
                                <Button
                                    color={primaryColor}
                                    onClick={handleRun}
                                    disabled={status === TaskStatus.RUNNING || !activeInput || !!validationError}
                                    leftSection={<IconPlayerPlay size={18}/>}
                                >
                                    EXECUTE
                                </Button>
                                {status === TaskStatus.RUNNING && (
                                    <Button variant="outline" color="red" onClick={handleStop} leftSection={<IconPlayerStop size={18}/>}>
                                        STOP
                                    </Button>
                                )}
                            </Group>
                        </Stack>
                    </Paper>
                </Stack>

                {/* 终端区保持高对比度以防“看不清” */}
                <Paper withBorder p={0} radius="sm" bg="#000" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 480 }}>
                    <Group p="xs" justify="space-between" bg="#111" style={{ borderBottom: '1px solid #333' }}>
                        <Group gap="xs">
                            <IconTerminal2 size={16} color="#62ff00" />
                            <Text size="xs" fw={800} c="gray.6">X-TERM LOGS</Text>
                        </Group>
                        <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setLogs([])}><IconTrash size={14} /></ActionIcon>
                    </Group>
                    <ScrollArea style={{ flex: 1 }} p="md" viewportRef={viewportRef}>
                        <Stack gap={2}>
                            {logs.map((log, i) => (
                                <Text key={i} fz="12px" ff="JetBrains Mono" c={log.includes('Error') || log.includes('failed') ? '#ff4d4d' : '#62ff00'} style={{ wordBreak: 'break-all', opacity: 0.9 }}>
                                    {`${log}`}
                                </Text>
                            ))}
                        </Stack>
                    </ScrollArea>
                </Paper>
            </SimpleGrid>
        </Stack>
    );
}