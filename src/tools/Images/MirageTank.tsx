// TODO: 优化重复代码
import { useEffect, useState } from 'react';
import {
    Paper,
    Stack,
    Button,
    Group,
    Text,
    Slider,
    SimpleGrid,
    Image,
    FileButton,
    Tabs,
    Box,
    Center,
    Alert,
    Loader,
    ActionIcon,
    Tooltip,
    Overlay,
    ThemeIcon,
    Card,
    Divider,
    SegmentedControl
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { invoke } from '@tauri-apps/api/core';
import {
    IconPhoto,
    IconDownload,
    IconWand,
    IconEye,
    IconSettings,
    IconRefresh,
    IconX,
    IconGrid4x4,
    IconMoon,
    IconSun
} from '@tabler/icons-react';
import { handleAppError } from '../../utils/error';
import { useAppSettings } from '../../hooks/useAppSettings';
import { saveBase64File } from '../../utils/fileSave';

// === 常量定义 ===
const CHECKERBOARD_STYLE = {
    backgroundImage: `
        linear-gradient(45deg, #eee 25%, transparent 25%), 
        linear-gradient(-45deg, #eee 25%, transparent 25%), 
        linear-gradient(45deg, transparent 75%, #eee 75%), 
        linear-gradient(-45deg, transparent 75%, #eee 75%)`,
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
    backgroundColor: '#fff'
};

// === 工具函数 ===
const resizeImageToBytes = (file: File, maxWidth: number = 400): Promise<number[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject('Canvas context error');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (!blob) return reject('Blob error');
                    blob.arrayBuffer().then(buf => resolve(Array.from(new Uint8Array(buf))));
                }, 'image/jpeg', 0.9);
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    });
};

const fileToBytes = async (file: File): Promise<number[]> => {
    const buffer = await file.arrayBuffer();
    return Array.from(new Uint8Array(buffer));
};

export default function MirageTankTool() {
    const [activeTab, setActiveTab] = useState<string | null>('generator');
    const [settings] = useAppSettings();
    const primaryColor = settings.primaryColor;

    // State
    const [fileF, setFileF] = useState<File | null>(null);
    const [fileB, setFileB] = useState<File | null>(null);
    const [brightF, setBrightF] = useState<number>(12);
    const [brightB, setBrightB] = useState<number>(7);
    const [debouncedF] = useDebouncedValue(brightF, 200);
    const [debouncedB] = useDebouncedValue(brightB, 200);
    const [previewImg, setPreviewImg] = useState<string | null>(null);
    const [finalImg, setFinalImg] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [viewFile, setViewFile] = useState<string | null>(null);

    // 预览背景控制 ('transparent' | 'white' | 'black')
    const [previewBg, setPreviewBg] = useState<string>('transparent');

    // 自动触发低清预览
    useEffect(() => {
        const generatePreview = async () => {
            if (!fileF || !fileB) return;
            setIsPreviewing(true);
            try {
                const [bytesF, bytesB] = await Promise.all([
                    resizeImageToBytes(fileF, 300),
                    resizeImageToBytes(fileB, 300)
                ]);
                const res = await invoke<string>('generate_mirage_tank', {
                    imgFBytes: bytesF,
                    imgBBytes: bytesB,
                    brightnessF: debouncedF,
                    brightnessB: debouncedB,
                });
                setPreviewImg(res);
            } catch (err) {
                console.error("Preview failed", err);
            } finally {
                setIsPreviewing(false);
            }
        };
        generatePreview().catch(err => console.error("Effect error:", err));
    }, [fileF, fileB, debouncedF, debouncedB]);

    // 生成图片
    const handleGenerateHighRes = async () => {
        if (!fileF || !fileB) return;
        setIsGenerating(true);
        setFinalImg(null);
        try {
            const [bytesF, bytesB] = await Promise.all([
                fileToBytes(fileF),
                fileToBytes(fileB)
            ]);
            const res = await invoke<string>('generate_mirage_tank', {
                imgFBytes: bytesF,
                imgBBytes: bytesB,
                brightnessF: brightF,
                brightnessB: brightB,
            });
            setFinalImg(res);
            setViewFile(res);
        } catch (err) {
            handleAppError(err);
        } finally {
            setIsGenerating(false);
        }
    };

    const downloadImage = async () => {
        if (!finalImg) return;
        try {
            await saveBase64File(finalImg, {
                defaultName: `mirage-tank-${Date.now()}.png`,
                successTitle: '幻影坦克保存成功'
            });
        } catch (e) {
            handleAppError(e);
        }
    };

    // 重置参数
    const resetParams = () => {
        setBrightF(12);
        setBrightB(7);
    };

    // 渲染上传框组件
    const UploadBox = ({ label, file, setFile, iconColor }: any) => (
        <Card withBorder padding="md" radius="md" style={{ flex: 1 }}>
            <Group justify="space-between" mb="xs">
                <Text size="sm" fw={600} c="dimmed">{label}</Text>
                {file && (
                    <Tooltip label="清除图片">
                        <ActionIcon variant="subtle" color="red" size="xs" onClick={() => setFile(null)}>
                            <IconX size={14} />
                        </ActionIcon>
                    </Tooltip>
                )}
            </Group>
            <FileButton onChange={setFile} accept="image/png,image/jpeg">
                {(props) => (
                    <Box
                        {...props}
                        style={{
                            cursor: 'pointer',
                            height: 140,
                            border: '2px dashed var(--mantine-color-default-border)',
                            borderRadius: 'var(--mantine-radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: file ? 'transparent' : 'var(--mantine-color-default-hover)',
                            overflow: 'hidden',
                            position: 'relative'
                        }}
                    >
                        {file ? (
                            <Image src={URL.createObjectURL(file)} h="100%" fit="contain" style={{ pointerEvents: 'none' }} />
                        ) : (
                            <Stack align="center" gap={4}>
                                <ThemeIcon variant="light" size={40} color={iconColor}>
                                    <IconPhoto size={24} />
                                </ThemeIcon>
                                <Text size="xs" c="dimmed">点击选择图片</Text>
                            </Stack>
                        )}
                    </Box>
                )}
            </FileButton>
        </Card>
    );

    // 获取当前预览背景样式
    const getPreviewBgStyle = () => {
        switch (previewBg) {
            case 'white': return { backgroundColor: 'white' };
            case 'black': return { backgroundColor: 'black' };
            default: return CHECKERBOARD_STYLE;
        }
    };

    return (
        <Stack gap="md">
            <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="md">
                <Tabs.List>
                    <Tabs.Tab value="generator" leftSection={<IconSettings size={16} />}>制作工坊</Tabs.Tab>
                    <Tabs.Tab value="viewer" leftSection={<IconEye size={16} />}>幻影查看器</Tabs.Tab>
                </Tabs.List>

                {/* ==================== 制作工坊 ==================== */}
                <Tabs.Panel value="generator" pt="md">
                    <Stack gap="lg">
                        {/* 1. 上传区域 */}
                        <Group align="stretch" grow>
                            <UploadBox label="表图 (白底显示)" file={fileF} setFile={setFileF} iconColor="gray" />
                            <UploadBox label="里图 (黑底显示)" file={fileB} setFile={setFileB} iconColor="dark" />
                        </Group>

                        {/* 2. 控制与预览区域 */}
                        <Card withBorder radius="md" padding="lg">
                            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
                                {/* 左侧：参数控制 */}
                                <Stack justify="center">
                                    <Group justify="space-between" align="center">
                                        <Text size="md" fw={600}>参数调整</Text>
                                        <Tooltip label="重置为默认值">
                                            <ActionIcon variant="light" color="gray" onClick={resetParams}>
                                                <IconRefresh size={16} />
                                            </ActionIcon>
                                        </Tooltip>
                                    </Group>

                                    <Divider />

                                    <Box>
                                        <Group justify="space-between" mb={5}>
                                            <Text size="sm">表图亮度 (显示)</Text>
                                            <Text size="sm" fw={700} c={primaryColor}>{brightF}</Text>
                                        </Group>
                                        <Slider
                                            value={brightF} onChange={setBrightF}
                                            min={5} max={20} step={0.5}
                                            color={primaryColor}
                                            disabled={!fileF || !fileB}
                                        />
                                    </Box>

                                    <Box>
                                        <Group justify="space-between" mb={5}>
                                            <Text size="sm">里图亮度 (隐藏)</Text>
                                            <Text size="sm" fw={700} c={primaryColor}>{brightB}</Text>
                                        </Group>
                                        <Slider
                                            value={brightB} onChange={setBrightB}
                                            min={1} max={15} step={0.5}
                                            color={primaryColor}
                                            disabled={!fileF || !fileB}
                                        />
                                    </Box>

                                    <Button
                                        fullWidth size="md" mt="md"
                                        onClick={handleGenerateHighRes}
                                        disabled={!fileF || !fileB}
                                        loading={isGenerating}
                                        leftSection={<IconWand size={20} />}
                                        color={primaryColor}
                                    >
                                        生成图片
                                    </Button>
                                </Stack>

                                {/* 右侧：实时预览 */}
                                <Stack gap="xs">
                                    {/* 预览头部：标题 + 背景切换器 */}
                                    <Group justify="space-between" align="center">
                                        <Text size="sm" c="dimmed">实时预览</Text>
                                        <SegmentedControl
                                            size="xs"
                                            value={previewBg}
                                            onChange={setPreviewBg}
                                            color={primaryColor}
                                            data={[
                                                {
                                                    value: 'transparent',
                                                    label: (
                                                        <Center style={{ gap: 5 }}>
                                                            <IconGrid4x4 size={14} />
                                                            <span>透明</span>
                                                        </Center>
                                                    )
                                                },
                                                {
                                                    value: 'white',
                                                    label: (
                                                        <Center style={{ gap: 5 }}>
                                                            <IconSun size={14} />
                                                            <span>白底</span>
                                                        </Center>
                                                    )
                                                },
                                                {
                                                    value: 'black',
                                                    label: (
                                                        <Center style={{ gap: 5 }}>
                                                            <IconMoon size={14} />
                                                            <span>黑底</span>
                                                        </Center>
                                                    )
                                                },
                                            ]}
                                        />
                                    </Group>

                                    <Paper
                                        withBorder
                                        w="100%"
                                        h={220}
                                        radius="md"
                                        style={{
                                            ...getPreviewBgStyle(), // 动态应用背景
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            transition: 'background-color 0.3s ease'
                                        }}
                                    >
                                        {isPreviewing && (
                                            <Overlay color="#fff" backgroundOpacity={0.5} blur={2}>
                                                <Center h="100%"><Loader size="sm" color={primaryColor} /></Center>
                                            </Overlay>
                                        )}
                                        {previewImg ? (
                                            <Image src={previewImg} h="100%" w="100%" fit="contain" />
                                        ) : (
                                            <Text size="xs" c="dimmed">上传两张图片以预览</Text>
                                        )}
                                    </Paper>
                                </Stack>
                            </SimpleGrid>
                        </Card>

                        {/* 3. 结果栏 */}
                        {finalImg && (
                            <Alert
                                variant="light"
                                color="green"
                                title="生成完毕"
                                icon={<IconWand size={20} />}
                                withCloseButton
                                onClose={() => setFinalImg(null)}
                            >
                                <Group justify="space-between" align="center">
                                    <Text size="sm">图片已生成，您可以下载或在查看器中检查细节。</Text>
                                    <Group gap="xs">
                                        <Button size="xs" variant="white" onClick={() => setActiveTab('viewer')} leftSection={<IconEye size={14} />}>
                                            检查
                                        </Button>
                                        <Button size="xs" onClick={downloadImage} leftSection={<IconDownload size={14} />} color="teal">
                                            下载
                                        </Button>
                                    </Group>
                                </Group>
                            </Alert>
                        )}
                    </Stack>
                </Tabs.Panel>

                {/* ==================== 幻影查看器 ==================== */}
                <Tabs.Panel value="viewer" pt="md">
                    <Stack gap="md">
                        {/* 顶部工具栏 */}
                        <Group justify="space-between">
                            <Group>
                                <FileButton onChange={(file) => file && setViewFile(URL.createObjectURL(file))} accept="image/png">
                                    {(props) => <Button variant="default" {...props} leftSection={<IconPhoto size={16} />}>上传图片</Button>}
                                </FileButton>
                                {viewFile && (
                                    <Button variant="subtle" color="red" onClick={() => setViewFile(null)} leftSection={<IconX size={16} />}>
                                        清空
                                    </Button>
                                )}
                            </Group>
                            <Alert py={4} color="gray" icon={<IconEye size={16} />} style={{ flex: 1, border: 'none', background: 'transparent' }}>
                                <Text size="sm">请观察图片在黑、白、透明背景下的表现。</Text>
                            </Alert>
                        </Group>

                        {/* 预览网格 */}
                        {viewFile ? (
                            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
                                {[
                                    { title: '白色背景 (表图)', bg: 'white', border: true },
                                    { title: '黑色背景 (里图)', bg: 'black', border: true },
                                    { title: '透明度检查', style: CHECKERBOARD_STYLE, border: true }
                                ].map((mode, idx) => (
                                    <Card key={idx} withBorder padding="xs" radius="md">
                                        <Text size="xs" ta="center" mb="xs" fw={700} c="dimmed">{mode.title}</Text>
                                        <Box
                                            h={320}
                                            style={{
                                                backgroundColor: mode.bg,
                                                ...mode.style,
                                                borderRadius: 6,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            <Image src={viewFile} fit="contain" h="100%" w="100%" />
                                        </Box>
                                    </Card>
                                ))}
                            </SimpleGrid>
                        ) : (
                            <Center h={300} bg="var(--mantine-color-default)" style={{ borderRadius: 8, border: '1px dashed var(--mantine-color-gray-4)' }}>
                                <Stack align="center" gap="xs">
                                    <IconPhoto size={48} color="gray" style={{ opacity: 0.3 }} />
                                    <Text c="dimmed" size="sm">暂无预览内容</Text>
                                </Stack>
                            </Center>
                        )}
                    </Stack>
                </Tabs.Panel>
            </Tabs>
        </Stack>
    );
}