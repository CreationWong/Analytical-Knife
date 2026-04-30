import { useState, useEffect } from 'react';
import {
    Stack, Group, Text, Button, SimpleGrid, NumberInput, Paper, Image, Badge, ActionIcon, Center, FileButton, ThemeIcon, Loader
} from '@mantine/core';
import {
    IconRefresh, IconDeviceFloppy, IconBinary, IconAdjustments,
    IconFlame, IconAnalyze, IconChevronUp, IconChevronDown,
    IconChevronLeft, IconChevronRight, IconArrowsMove, IconCloudUpload
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { handleAppError } from '@/utils/error';
import { saveBase64File } from '@/utils/fileSave.ts';
import { useAppSettings } from '@/hooks/useAppSettings.ts';

export default function WHEditStego() {
    const [settings] = useAppSettings();
    const primaryCol = settings.primaryColor || 'blue';

    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [stepSize, setStepSize] = useState<number>(100);

    const [previewBase64, setPreviewBase64] = useState<string | null>(null);
    const [metadata, setMetadata] = useState({
        originalW: 0,
        originalH: 0,
        physicalH: 0,
        format: 'UNKNOWN'
    });

    const [targetW, setTargetW] = useState<number>(0);
    const [targetH, setTargetH] = useState<number>(0);

    const callBackend = async (w: number, h: number, mode: "READ" | "EDIT") => {
        if (!file) return;
        setLoading(true);
        try {
            const buffer = await file.arrayBuffer();
            const bytes = Array.from(new Uint8Array(buffer));
            const res = await invoke<any>("process_stego_edit", {
                data: bytes,
                targetW: w,
                targetH: h,
                mode
            });

            setPreviewBase64(res.b64_data);
            if (mode === "READ") {
                setMetadata({
                    originalW: res.original_w,
                    originalH: res.original_h,
                    physicalH: res.physical_h,
                    format: res.format
                });
                setTargetW(res.original_w);
                setTargetH(res.original_h);
            }
        } catch (e) {
            handleAppError(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (file) callBackend(0, 0, "READ"); }, [file]);

    const handleDirectionalStep = (dir: 'W+' | 'W-' | 'H+' | 'H-') => {
        let newW = targetW;
        let newH = targetH;
        if (dir === 'W+') newW += stepSize;
        if (dir === 'W-') newW = Math.max(1, targetW - stepSize);
        if (dir === 'H+') newH += stepSize;
        if (dir === 'H-') newH = Math.max(1, targetH - stepSize);

        setTargetW(newW);
        setTargetH(newH);
        callBackend(newW, newH, "EDIT");
    };

    const hasRedundancy = metadata.physicalH > metadata.originalH;

    return (
        <Stack gap="md">
            <SimpleGrid cols={{ base: 1, md: 10 }} spacing="lg">

                {/* --- 左侧控制面板 --- */}
                <Stack style={{ gridColumn: 'span 4' }} gap="md">
                    <Paper withBorder p="md" radius="md" shadow="xs">
                        <Text size="xs" fw={700} c="dimmed" mb="xs" style={{ letterSpacing: '1px' }}>DATA_MOUNT</Text>
                        <FileButton onChange={setFile} accept="image/*">
                            {(props) => (
                                <Button
                                    {...props}
                                    variant="light"
                                    color={primaryCol}
                                    fullWidth
                                    h={46}
                                    leftSection={<IconCloudUpload size={18}/>}
                                >
                                    {file ? file.name : "载入取证样本"}
                                </Button>
                            )}
                        </FileButton>
                    </Paper>

                    <Paper withBorder p="md" radius="md" shadow="xs">
                        <Group justify="space-between" mb="lg">
                            <Group gap={8}>
                                <ThemeIcon variant="light" color={primaryCol} size="sm">
                                    <IconAdjustments size={14}/>
                                </ThemeIcon>
                                <Text size="sm" fw={700}>全向维度探测器</Text>
                            </Group>
                            <ActionIcon variant="subtle" color="gray" onClick={() => callBackend(0, 0, "READ")} disabled={!file}>
                                <IconRefresh size={18}/>
                            </ActionIcon>
                        </Group>

                        <SimpleGrid cols={2} mb="md">
                            <NumberInput label="WIDTH" value={targetW} onChange={(v) => setTargetW(Number(v))} hideControls variant="filled" />
                            <NumberInput label="HEIGHT" value={targetH} onChange={(v) => setTargetH(Number(v))} hideControls variant="filled" />
                        </SimpleGrid>

                        <Paper bg="var(--mantine-color-default-hover)" p="md" radius="md" mb="md">
                            <Group justify="space-between" mb="xs">
                                <Text size="10px" fw={700} c="dimmed">OMNI_PROBE_STEP</Text>
                                <NumberInput
                                    size="xs" w={80}
                                    value={stepSize}
                                    onChange={(v) => setStepSize(Number(v))}
                                    styles={{ input: { fontSize: '10px', height: '24px', minHeight: '24px' }}}
                                />
                            </Group>

                            <Center py="xs">
                                <Stack gap={6} align="center">
                                    <ActionIcon variant="filled" color={primaryCol} onClick={() => handleDirectionalStep('H-')} size="lg"><IconChevronUp size={20}/></ActionIcon>
                                    <Group gap={6}>
                                        <ActionIcon variant="filled" color={primaryCol} onClick={() => handleDirectionalStep('W-')} size="lg"><IconChevronLeft size={20}/></ActionIcon>
                                        <ThemeIcon variant="white" color={primaryCol} size="lg" radius="md" style={{ boxShadow: 'var(--mantine-shadow-xs)' }}>
                                            <IconArrowsMove size={18}/>
                                        </ThemeIcon>
                                        <ActionIcon variant="filled" color={primaryCol} onClick={() => handleDirectionalStep('W+')} size="lg"><IconChevronRight size={20}/></ActionIcon>
                                    </Group>
                                    <ActionIcon variant="filled" color={primaryCol} onClick={() => handleDirectionalStep('H+')} size="lg"><IconChevronDown size={20}/></ActionIcon>
                                </Stack>
                            </Center>
                        </Paper>

                        <Button
                            fullWidth
                            color={primaryCol}
                            leftSection={<IconFlame size={18}/>}
                            onClick={() => callBackend(targetW, targetH, "EDIT")}
                            disabled={!file}
                            loading={loading}
                        >
                            执行精确定位
                        </Button>
                    </Paper>

                    {file && (
                        <Paper withBorder p="md" radius="md" bg="var(--mantine-color-default-hover)">
                            <Group justify="space-between" mb="md">
                                <Group gap={8}>
                                    <IconAnalyze size={18} color={`var(--mantine-color-${primaryCol}-filled)`}/>
                                    <Text size="sm" fw={700}>取证分析报表</Text>
                                </Group>
                                <Badge size="xs" variant="outline" color={metadata.format === 'PNG' ? 'blue' : 'orange'}>
                                    {metadata.format}
                                </Badge>
                            </Group>

                            <Stack gap={10}>
                                <Group justify="space-between">
                                    <Text size="11px" c="dimmed" fw={500}>ORIGINAL_DIM:</Text>
                                    <Text size="11px" ff="monospace" fw={700}>{metadata.originalW} × {metadata.originalH}</Text>
                                </Group>

                                {metadata.format === 'PNG' && (
                                    <Group justify="space-between">
                                        <Text size="11px" c="dimmed" fw={500}>PHYSICAL_H (IDAT):</Text>
                                        <Text size="11px" ff="monospace" fw={700} c={hasRedundancy ? "red.5" : "green.5"}>
                                            {metadata.physicalH} PX
                                        </Text>
                                    </Group>
                                )}

                                {hasRedundancy && (
                                    <Button
                                        size="compact-xs"
                                        variant="light"
                                        color="red"
                                        fullWidth
                                        mt="xs"
                                        onClick={() => { setTargetH(metadata.physicalH); callBackend(targetW, metadata.physicalH, "EDIT"); }}
                                    >
                                        一键修复高度冗余
                                    </Button>
                                )}
                            </Stack>
                        </Paper>
                    )}
                </Stack>

                {/* --- 右侧预览区 --- */}
                <Stack style={{ gridColumn: 'span 6' }}>
                    <Paper
                        withBorder
                        radius="md"
                        bg="black"
                        h={640}
                        shadow="xl"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                            border: `1px solid var(--mantine-color-default-border)`
                        }}
                    >
                        {loading && (
                            <Center h="100%" w="100%" style={{ position: 'absolute', zIndex: 10, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}>
                                <Loader size="md" color={primaryCol} type="dots" />
                            </Center>
                        )}

                        {previewBase64 ? (
                            <Image src={previewBase64} h="100%" w="100%" fit="contain" style={{ imageRendering: 'pixelated' }} />
                        ) : (
                            <Stack align="center" gap="xs" style={{ opacity: 0.15 }}>
                                <IconBinary size={64} />
                                <Text size="xs" fw={700} style={{ letterSpacing: '2px' }}>READY_FOR_STREAM</Text>
                            </Stack>
                        )}
                    </Paper>

                    <Button
                        fullWidth
                        size="md"
                        variant="filled"
                        color="green.7"
                        disabled={!previewBase64}
                        onClick={() => saveBase64File(previewBase64!, { defaultName: `stego_forensics_${Date.now()}.png` })}
                        leftSection={<IconDeviceFloppy size={20}/>}
                    >
                        导出二进制结果
                    </Button>
                </Stack>
            </SimpleGrid>
        </Stack>
    );
}