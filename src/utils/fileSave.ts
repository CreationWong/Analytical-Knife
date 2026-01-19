import { save } from '@tauri-apps/plugin-dialog';
import { writeFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { notifications } from '@mantine/notifications';

interface SaveOptions {
    defaultName?: string;
    filters?: { name: string; extensions: string[] }[];
    successTitle?: string;
}

/**
 * 公共函数：保存 Base64 图片到本地
 */
export async function saveBase64File(base64Data: string, options: SaveOptions = {}) {
    try {
        const filePath = await save({
            defaultPath: options.defaultName || 'untitled.png',
            filters: options.filters || [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
        });

        if (!filePath) return null;

        const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

        const binStr = atob(cleanBase64);
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binStr.charCodeAt(i);
        }

        // ✅ 修正点：使用 writeFile 写入二进制数据
        await writeFile(filePath, bytes);

        notifications.show({
            title: options.successTitle || '保存成功',
            message: `文件已保存至: ${filePath}`,
            color: 'green',
        });

        return filePath;

    } catch (err) {
        console.error('File save failed:', err);
        throw err;
    }
}

/**
 * 公共函数：保存纯文本/JSON 到本地
 */
export async function saveTextFile(content: string, options: SaveOptions = {}) {
    try {
        const filePath = await save({
            defaultPath: options.defaultName || 'document.txt',
            filters: options.filters || [{ name: 'Text', extensions: ['txt', 'json', 'md'] }]
        });

        if (!filePath) return null;

        // ✅ writeTextFile 依然可用，用于写入字符串
        await writeTextFile(filePath, content);

        notifications.show({
            title: options.successTitle || '保存成功',
            message: `文件已保存至: ${filePath}`,
            color: 'green',
        });

        return filePath;
    } catch (err) {
        console.error('File save failed:', err);
        throw err;
    }
}