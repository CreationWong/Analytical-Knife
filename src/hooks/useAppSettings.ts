import { useLocalStorage } from '@mantine/hooks';

// 定义允许的 Mantine 颜色常量列表
export const VALID_COLORS = ['blue', 'red', 'teal', 'grape', 'orange', 'cyan', 'pink'] as const;

// 提取类型
export type MantineThemeColor = (typeof VALID_COLORS)[number];

export interface AppSettings {
    theme: 'light' | 'dark';
    primaryColor: MantineThemeColor; // 使用严格类型替代 string
}

export function useAppSettings() {
    const [settings, setSettings, removeValue] = useLocalStorage<AppSettings>({
        key: 'knife-settings',
        defaultValue: {
            theme: 'light',
            primaryColor: 'blue',
        },
    });

    // 自动校验逻辑：确保返回的 settings 永远包含合法颜色
    const validatedSettings = settings ? {
        ...settings,
        primaryColor: VALID_COLORS.includes(settings.primaryColor)
            ? settings.primaryColor
            : 'blue'
    } : settings;

    return [validatedSettings, setSettings, removeValue] as const;
}