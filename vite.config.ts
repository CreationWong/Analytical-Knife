// @ts-ignore

import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import pkg from './package.json';
import path from 'path'

const host = process.env.TAURI_DEV_HOST;

/**
 * 版本号处理逻辑
 */
// 版本号解析逻辑
const Version = 'V' + pkg.version;
// 短版本号：提取前面的数字部分
const shortVersion = ('V' + Version.match(/[\d.]+/)?.[0]) || 'V0';

// https://vite.dev/config/
export default defineConfig(async () => ({
    plugins: [react()],

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent Vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                protocol: "ws",
                host,
                port: 1421,
            }
            : undefined,
        watch: {
            // 3. tell Vite to ignore watching `src-tauri`
            ignored: ["**/src-tauri/**"],
        },
        // 4. 配置跨域隔离响应头，以支持 FFmpeg.wasm 运行所需的 SharedArrayBuffer
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },

    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },

    // 5. 优化依赖排除：防止 Vite 预编译导致的 FFmpeg Worker 路径丢失问题
    optimizeDeps: {
        exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
    },

    // 6. 构建目标配置：支持 Top-level await 等现代特性
    build: {
        target: 'esnext',
    },

    define: {
        __APP_VERSION__: JSON.stringify(Version),
        __SHORT_VERSION__: JSON.stringify(shortVersion),
        __APP_NAME__: JSON.stringify("Analytical Knife"),
    },
}));