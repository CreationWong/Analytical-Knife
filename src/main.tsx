import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import App from './App';

const theme = createTheme({
    // 全局字体设置
    fontFamily: 'Source Han Mono, sans-serif',
    fontFamilyMonospace: 'Source Han Mono, Monaco, Consolas, monospace',

    // 定义全局样式
    primaryColor: 'blue',

    // TODO: 优化全局样式
});

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <MantineProvider theme={theme}>
            <Notifications position="top-right" zIndex={2000} />
            <App />
        </MantineProvider>
    </React.StrictMode>
);