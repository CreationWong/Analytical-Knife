import { useLocalStorage } from '@mantine/hooks';

export interface AppSettings {
    theme: 'light' | 'dark';
}

export function useAppSettings() {
    return useLocalStorage<AppSettings>({
        key: 'knife-settings',
        defaultValue: {
            theme: 'light',
        },
    });
}