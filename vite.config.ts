import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import pkg from './package.json';

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

/**
 *  版本号处理逻辑
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
    },

    define: {
        __APP_VERSION__: JSON.stringify(Version),
        __SHORT_VERSION__: JSON.stringify(shortVersion),
        __APP_NAME__: JSON.stringify("Analytical Knife"),
    },
}));
