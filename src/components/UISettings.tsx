import { Stack, Group, SegmentedControl, Text, Divider, ColorSwatch, CheckIcon, Center } from '@mantine/core';
import { useAppSettings } from '../hooks/useAppSettings';

const MANTINE_COLORS = ['blue', 'red', 'teal', 'grape', 'orange', 'cyan', 'pink'];

export default function UISettings() {
    const [settings, setSettings] = useAppSettings();

    const updateSetting = (key: string, value: any) => {
        setSettings({ ...settings, [key]: value });
    };

    return (
        <Stack gap="xl" p="md">
            <section>
                <Text fw={700} size="lg" mb="sm">外观设置</Text>

                {/* 主题模式切换 */}
                <Group justify="space-between" mb="md">
                    <Text size="sm">主题模式</Text>
                    <SegmentedControl
                        value={settings.theme}
                        onChange={(v) => updateSetting('theme', v)}
                        data={[
                            { label: '浅色', value: 'light' },
                            { label: '深色', value: 'dark' },
                        ]}
                    />
                </Group>

                {/* 主题色选择 */}
                <Group justify="space-between">
                    <Text size="sm">主题色</Text>
                    <Group gap="xs">
                        {MANTINE_COLORS.map((color) => (
                            <ColorSwatch
                                key={color}
                                color={`var(--mantine-color-${color}-filled)`}
                                onClick={() => updateSetting('primaryColor', color)}
                                style={{ cursor: 'pointer' }}
                                size={22}
                            >
                                {settings.primaryColor === color && (
                                    <Center>
                                        <CheckIcon style={{ width: 12, height: 12 }} color="white" />
                                    </Center>
                                )}
                            </ColorSwatch>
                        ))}
                    </Group>
                </Group>
            </section>

            <Divider />
        </Stack>
    );
}