import { Stack, Group, SegmentedControl, Text, Divider } from '@mantine/core';
import { useAppSettings } from '../hooks/useAppSettings';
import { handleAppError } from '../utils/error';

export default function UISettings() {
    const [settings, setSettings] = useAppSettings();

    const updateSetting = (key: string, value: any) => {
        try {
            setSettings({ ...settings, [key]: value });
        } catch (err) {
            handleAppError(err, { title: '设置保存失败', isWarning: true });
        }
    };

    return (
        <Stack gap="xl" p="md">
            <section>
                <Text fw={700} size="lg" mb="sm">显示设置</Text>
                <Group justify="space-between">
                    <Text size="sm">外观主题</Text>
                    <SegmentedControl
                        value={settings.theme}
                        onChange={(v) => updateSetting('theme', v)}
                        data={[
                            { label: '浅色', value: 'light' },
                            { label: '深色', value: 'dark' },
                        ]}
                    />
                </Group>
            </section>

            <Divider />


        </Stack>
    );
}