import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import App from './App';
import { useAppSettings } from './hooks/useAppSettings'; // 确保路径正确

function Root() {
    const [settings] = useAppSettings();

    // 根据设置动态生成主题
    const theme = createTheme({
        // 全局字体设置
        fontFamily: 'Source Han Mono, sans-serif',
        fontFamilyMonospace: 'Source Han Mono, Monaco, Consolas, monospace',
        primaryColor: 'blue',
    });

    return (
        // forceColorScheme 可以实现深色/浅色模式切换
        <MantineProvider
            theme={theme}
            defaultColorScheme="auto"
            forceColorScheme={settings.theme === 'dark' ? undefined : settings.theme}
        >
            <Notifications position="top-right" zIndex={2000} />
            <App />
        </MantineProvider>
    );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Root />
    </React.StrictMode>
);