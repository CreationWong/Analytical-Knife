import { describe, expect, it } from 'vitest';
import {
    buildPluginEntryPath,
    buildPluginRuntimeUrl,
    buildPluginToolPath,
    encodePluginRuntimeHost,
    isPluginTool,
    normalizeSidebarGroupPath,
    toPluginToolDefinition,
} from '../customPlugins';
import { CustomPluginRecord } from '../../registry/types';

const createPluginRecord = (): CustomPluginRecord => ({
    id: 'plugin_1',
    name: '示例插件',
    description: '示例描述',
    enabled: true,
    iconKey: 'IconCode',
    sidebarGroupPath: '第三方插件/常用',
    sidebarOrder: 10,
    entryFile: 'index.html',
    pluginRoot: 'C:\\plugins\\plugin_1',
    windowMaxWidth: 'none',
    createdAt: '2026-05-31T00:00:00Z',
    updatedAt: '2026-05-31T00:00:00Z',
});

describe('customPlugins utils', () => {
    it('normalizes sidebar group path', () => {
        expect(normalizeSidebarGroupPath(' /第三方插件/ 常用工具 // ')).toBe('第三方插件/常用工具');
        expect(normalizeSidebarGroupPath('')).toBe('第三方插件');
    });

    it('builds plugin tool definition', () => {
        const record = createPluginRecord();
        const tool = toPluginToolDefinition(record);

        expect(tool.path).toBe('第三方插件/常用/示例插件');
        expect(tool.windowMaxWidth).toBe('none');
        expect(isPluginTool(tool)).toBe(true);
    });

    it('builds plugin entry path from tool definition', () => {
        const tool = toPluginToolDefinition(createPluginRecord());

        expect(buildPluginToolPath(createPluginRecord())).toBe('第三方插件/常用/示例插件');
        expect(buildPluginEntryPath(tool)).toBe('C:\\plugins\\plugin_1/index.html');
    });

    it('encodes plugin runtime host and url', () => {
        const tool = toPluginToolDefinition(createPluginRecord());

        expect(encodePluginRuntimeHost('plugin_1')).toBe('p706c7567696e5f31.localhost');
        expect(buildPluginRuntimeUrl(tool, 'Mozilla/5.0 (X11; Linux x86_64)')).toBe(
            'plugin://p706c7567696e5f31.localhost/index.html'
        );
        expect(buildPluginRuntimeUrl(tool, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(
            'http://plugin.p706c7567696e5f31.localhost/index.html'
        );
    });
});
