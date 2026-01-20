import { useState, useEffect } from 'react';
import { readFile } from '@tauri-apps/plugin-fs';

// 扩展名到 MIME 类型的映射表
const MIME_MAP: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    'txt': 'text/plain',
    'json': 'application/json',
    'pdf': 'application/pdf'
};

interface UseFilePreviewResult {
    previewUrl: string | null;
    mimeType: string | null; // 返回检测到的 MIME 类型
    isLoading: boolean;
    error: Error | null;
}

/**
 * @param filePath 文件绝对路径
 * @param allowedExtensions (可选) 允许的扩展名列表，如 ['png', 'jpg']。如果不传则不限制。
 */
export function useFilePreview(
    filePath: string | null,
    allowedExtensions: string[] = []
): UseFilePreviewResult {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        // 基础状态重置
        if (!filePath) {
            setPreviewUrl(null);
            setMimeType(null);
            setError(null);
            return;
        }

        let isMounted = true;
        let objectUrl: string | null = null;

        const loadFile = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // 获取扩展名并校验
                const ext = filePath.split('.').pop()?.toLowerCase() || '';

                // 如果传入了限制列表，且当前扩展名不在列表中，则报错
                if (allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
                    throw new Error(`不支持的文件类型: .${ext}`);
                }

                // 确定 MIME 类型
                const detectedMime = MIME_MAP[ext] || 'application/octet-stream';

                if (isMounted) setMimeType(detectedMime);

                // 读取文件 (Tauri FS)
                const fileBytes = await readFile(filePath);

                // 生成 Blob URL
                const blob = new Blob([fileBytes], { type: detectedMime });
                objectUrl = URL.createObjectURL(blob);

                if (isMounted) {
                    setPreviewUrl(objectUrl);
                }

            } catch (err) {
                if (isMounted) {
                    console.error("预览加载失败:", err);
                    setError(err instanceof Error ? err : new Error('读取文件失败'));
                    setPreviewUrl(null);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadFile();

        // 清理函数
        return () => {
            isMounted = false;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [filePath, JSON.stringify(allowedExtensions)]);

    return { previewUrl, mimeType, isLoading, error };
}