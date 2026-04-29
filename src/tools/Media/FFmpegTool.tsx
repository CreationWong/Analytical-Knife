import {
    useEffect,
    useState,
    useRef,
    useCallback,
    type Dispatch,
    type SetStateAction,
    type RefObject
} from 'react';

import {
    Button, Stack, SegmentedControl, Text, Progress, ScrollArea,
    Group, ActionIcon, Grid, Textarea, TextInput,
    FileInput, Title, Code, ThemeIcon, Badge, Paper, Divider, Tooltip, Box
} from '@mantine/core';

import {
    IconTrash,
    IconSettingsAutomation,
    IconFileImport,
    IconTerminal2,
    IconPlayerPlay,
    IconPlayerStop,
    IconInfoCircle,
    IconDeviceDesktop,
    IconBrandChrome
} from '@tabler/icons-react';

import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

// 导入 Hook
import { useAppSettings } from '@/hooks/useAppSettings';

/* ---------------- 类型 ---------------- */

type Engine = 'native' | 'wasm';

type RunParams = {
    input: string | File;
    output: string;
    args: string[];
    outExt: string; // 新增扩展名参数用于 WASM 识别
};

/* ---------------- 工具 ---------------- */

const parseArgs = (input: string): string[] =>
    input.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(s => s.replace(/"/g, '')) || [];

/* ---------------- 日志 Hook ---------------- */

function useLogs() {
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = useCallback((msg: string) => {
        const time = new Date().toLocaleTimeString([], { hour12: false });
        setLogs(prev => [...prev, `[${time}] ${msg}`]);
    }, []);

    const clear = (): void => setLogs([]);

    return { logs, addLog, clear };
}

/* ---------------- Runner Hook ---------------- */

function useFFmpegRunner(
    engine: Engine,
    ffmpegRef: RefObject<FFmpeg | null>,
    addLog: (msg: string) => void,
    setProgress: Dispatch<SetStateAction<number>>
) {
    const loadWasm = async (): Promise<FFmpeg> => {
        if (ffmpegRef.current) return ffmpegRef.current;
        const ff = new FFmpeg();
        ff.on('log', ({ message }) => addLog(message));
        ff.on('progress', p => setProgress(Math.round(p.progress * 100)));
        await ff.load();

        (ffmpegRef as any).current = ff;
        return ff;
    };

    const run = async ({ input, output, args, outExt }: RunParams): Promise<void> => {
        if (engine === 'native') {
            await invoke('run_ffmpeg_stream', { inputPath: input, outputPath: output, args });
            return;
        }

        const ff = await loadWasm();

        // 为虚拟文件系统提供明确的后缀，防止 FFmpeg 识别失败
        const inputName = 'input_file';
        const outputName = `output_file.${outExt}`;

        await ff.writeFile(inputName, await fetchFile(input));

        // 修正参数拼接：明确 input 后接参数，最后接带后缀的虚拟输出名
        const code = await ff.exec(['-i', inputName, ...args, outputName]);

        if (code !== 0) throw new Error('FFmpeg 执行失败，请检查参数是否正确');

        const data = await ff.readFile(outputName);
        await writeFile(output, new Uint8Array(data as ArrayBuffer));

        // 清理虚拟文件
        await ff.deleteFile(inputName);
        await ff.deleteFile(outputName);
    };

    const stop = async (): Promise<void> => {
        if (engine === 'wasm') {
            ffmpegRef.current?.terminate();
            (ffmpegRef as any).current = null;
        } else {
            await invoke('stop_ffmpeg_native');
        }
    };

    return { run, stop };
}

/* ---------------- 主组件 ---------------- */

export default function FFmpegTool() {
    const [settings] = useAppSettings();
    const primaryColor = settings.primaryColor || 'blue';

    const [engine, setEngine] = useState<Engine>('wasm');
    const [status, setStatus] = useState<'IDLE' | 'RUNNING' | 'ERROR'>('IDLE');
    const [progress, setProgress] = useState<number>(0);

    const [file, setFile] = useState<File | null>(null);
    const [nativePath, setNativePath] = useState<string>('');
    const [rawArgs, setRawArgs] = useState<string>('');
    const [outExt, setOutExt] = useState<string>('');

    const [hasNative, setHasNative] = useState<boolean>(false);

    const ffmpegRef = useRef<FFmpeg | null>(null);
    const viewportRef = useRef<HTMLDivElement>(null);

    const { logs, addLog, clear } = useLogs();

    const { run, stop } = useFFmpegRunner(engine, ffmpegRef, addLog, setProgress);

    useEffect(() => {
        let mounted = true;
        let unlisten: UnlistenFn[] = [];
        (async () => {
            const log = await listen<string>('ffmpeg-log', e => { if (mounted) addLog(e.payload); });
            const prog = await listen<number>('ffmpeg-progress', e => { if (mounted) setProgress(Math.round(e.payload * 100)); });
            unlisten = [log, prog];
        })();
        return () => { mounted = false; unlisten.forEach(fn => fn()); };
    }, [addLog]);

    useEffect(() => {
        viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
    }, [logs]);

    useEffect(() => {
        invoke<boolean>('check_ffmpeg').then(setHasNative).catch(() => setHasNative(false));
    }, []);

    const handleRun = async (): Promise<void> => {
        if (status === 'RUNNING') return;
        const input = engine === 'native' ? nativePath : file;
        if (!input) return;

        const savePath = await save({ defaultPath: `output_${Date.now()}.${outExt}` });
        if (!savePath) return;

        try {
            setStatus('RUNNING');
            setProgress(0);
            // 传递 outExt 确保 WASM 内部文件名正确
            await run({ input, output: savePath, args: parseArgs(rawArgs), outExt });
            setProgress(100);
            setStatus('IDLE');
        } catch (err) {
            addLog(`错误: ${err instanceof Error ? err.message : String(err)}`);
            setStatus('ERROR');
        }
    };

    const handleStop = async (): Promise<void> => {
        await stop();
        setStatus('IDLE');
        addLog('任务已停止');
    };

    return (
        <Stack gap="xl" p="md" bg="var(--mantine-color-body)">
            <Paper shadow="xs" p="lg" withBorder radius="md">
                <Group justify="space-between">
                    <Group gap="md">
                        <ThemeIcon size={44} radius="md" variant="light" color={primaryColor}>
                            <IconSettingsAutomation
                                size={28}
                                color={`var(--mantine-color-${primaryColor}-filled)`}
                            />
                        </ThemeIcon>
                        <div>
                            <Title order={3} fw={800} c="var(--mantine-color-text)">视频转换</Title>
                            <Text size="xs" c="dimmed">配置 FFmpeg 参数并处理多媒体文件</Text>
                        </div>
                    </Group>

                    <Stack align="flex-end" gap={4}>
                        <Text size="xs" fw={700} c="dimmed">执行引擎</Text>
                        <SegmentedControl
                            value={engine}
                            onChange={(v: string) => setEngine(v as Engine)}
                            data={[
                                {
                                    label: (
                                        <Group gap="xs" wrap="nowrap">
                                            <IconDeviceDesktop size={14} />
                                            <span>本地环境</span>
                                        </Group>
                                    ),
                                    value: 'native',
                                    disabled: !hasNative
                                },
                                {
                                    label: (
                                        <Group gap="xs" wrap="nowrap">
                                            <IconBrandChrome size={14} />
                                            <span>WASM</span>
                                        </Group>
                                    ),
                                    value: 'wasm'
                                }
                            ]}
                        />
                    </Stack>
                </Group>
            </Paper>

            <Grid gutter="lg" align="stretch">
                <Grid.Col span={{ base: 12, md: 6 }}>
                    <Stack gap="lg">
                        <Paper withBorder radius="md" p="lg" shadow="sm">
                            <Text fw={700} size="sm" mb="md" c="var(--mantine-color-text)">资源配置</Text>
                            <Stack gap="md">
                                {engine === 'native' ? (
                                    <TextInput
                                        label="源文件路径"
                                        placeholder="未选择文件"
                                        value={nativePath}
                                        readOnly
                                        leftSection={<IconFileImport size={16} />}
                                        rightSectionWidth={70}
                                        rightSection={
                                            <Button size="compact-xs" variant="light" color={primaryColor} onClick={async () => {
                                                const f = await open();
                                                if (f && !Array.isArray(f)) setNativePath(f);
                                            }}>选择</Button>
                                        }
                                    />
                                ) : (
                                    <FileInput
                                        label="选择源视频"
                                        placeholder="点击上传文件"
                                        value={file}
                                        onChange={setFile}
                                        leftSection={<IconFileImport size={16} />}
                                        clearable
                                    />
                                )}

                                <TextInput
                                    label="导出后缀"
                                    value={outExt}
                                    onChange={e => setOutExt(e.currentTarget.value)}
                                    placeholder="输入 文件后缀名"
                                />
                            </Stack>
                        </Paper>

                        <Paper withBorder radius="md" p="lg" shadow="sm">
                            <Text fw={700} size="sm" mb="md" c="var(--mantine-color-text)">参数设置</Text>
                            <Stack gap="md">
                                <Textarea
                                    label="命令行参数"
                                    placeholder="输入 FFmpeg 命令"
                                    minRows={3}
                                    autosize
                                    value={rawArgs}
                                    onChange={e => setRawArgs(e.currentTarget.value)}
                                />
                                <Box>
                                    <Group gap={4} mb={4}>
                                        <IconTerminal2 size={14} color="var(--mantine-color-dimmed)" />
                                        <Text size="xs" c="dimmed" fw={700}>PREVIEW</Text>
                                    </Group>
                                    <Code block p="xs" style={{ borderRadius: '4px', backgroundColor: 'var(--mantine-color-default-hover)' }}>
                                        ffmpeg -i input {rawArgs} output.{outExt}
                                    </Code>
                                </Box>
                            </Stack>
                        </Paper>

                        <Paper withBorder radius="md" p="lg" shadow="sm">
                            <Stack gap="md">
                                <Group justify="space-between">
                                    <Text size="sm" fw={700} c="var(--mantine-color-text)">处理进度</Text>
                                    <Badge variant="filled" color={status === 'ERROR' ? 'red' : primaryColor}>
                                        {progress}%
                                    </Badge>
                                </Group>

                                <Progress
                                    value={progress}
                                    size="xl"
                                    radius="xl"
                                    animated={status === 'RUNNING'}
                                    color={status === 'ERROR' ? 'red' : primaryColor}
                                />

                                <Group grow mt="sm">
                                    <Button
                                        size="md"
                                        leftSection={status === 'RUNNING' ? <IconPlayerStop size={18} /> : <IconPlayerPlay size={18} />}
                                        color={status === 'RUNNING' ? 'red' : primaryColor}
                                        variant={status === 'RUNNING' ? 'light' : 'filled'}
                                        onClick={status === 'RUNNING' ? handleStop : handleRun}
                                        disabled={status !== 'RUNNING' && (engine === 'wasm' ? !file : !nativePath)}
                                    >
                                        {status === 'RUNNING' ? '停止任务' : '开始转换'}
                                    </Button>
                                </Group>
                            </Stack>
                        </Paper>
                    </Stack>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 6 }}>
                    <Paper
                        withBorder
                        radius="md"
                        shadow="sm"
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            height: '650px',
                            overflow: 'hidden'
                        }}
                    >
                        <Box p="xs" bg="var(--mantine-color-default-hover)" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                            <Group justify="space-between">
                                <Group gap="xs">
                                    <Text fw={700} size="sm" c="var(--mantine-color-text)">控制台输出</Text>
                                    {status === 'RUNNING' && <Badge size="xs" variant="dot" color={primaryColor}>运行中</Badge>}
                                </Group>
                                <Tooltip label="清空日志">
                                    <ActionIcon variant="subtle" color="gray" onClick={clear}>
                                        <IconTrash size={16} />
                                    </ActionIcon>
                                </Tooltip>
                            </Group>
                        </Box>

                        <ScrollArea
                            p="md"
                            style={{ flex: 1 }}
                            bg="var(--mantine-color-body)"
                            viewportRef={viewportRef}
                            offsetScrollbars
                            type="always"
                        >
                            {logs.length === 0 ? (
                                <Stack align="center" justify="center" h="100%" gap="xs" style={{ opacity: 0.3 }}>
                                    <IconInfoCircle size={48} color="var(--mantine-color-dimmed)" />
                                    <Text c="dimmed">无日志记录</Text>
                                </Stack>
                            ) : (
                                <Stack gap={2}>
                                    {logs.map((log, i) => (
                                        <Text
                                            key={i}
                                            fz="xs"
                                            ff="monospace"
                                            c={log.includes('错误') || log.includes('Invalid') ? 'red.6' : 'green.6'}
                                            style={{ lineHeight: 1.5, wordBreak: 'break-all' }}
                                        >
                                            {log}
                                        </Text>
                                    ))}
                                </Stack>
                            )}
                        </ScrollArea>

                        <Divider color="var(--mantine-color-default-border)" />
                        <Group p="xs" justify="center" bg="var(--mantine-color-default-hover)">
                            <Text size="xs" c="dimmed">共 {logs.length} 行输出</Text>
                        </Group>
                    </Paper>
                </Grid.Col>
            </Grid>
        </Stack>
    );
}