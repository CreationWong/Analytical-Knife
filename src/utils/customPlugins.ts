import { invoke } from '@tauri-apps/api/core';
import { CustomPluginRecord, PluginEnvironment, ToolDefinition } from '../registry/types';

export const CUSTOM_PLUGINS_CHANGED_EVENT = 'analytical-knife:custom-plugins-changed';
export const DEFAULT_PLUGIN_ICON_KEY = 'IconCode';
export const DEFAULT_PLUGIN_GROUP_PATH = '第三方插件';
export const PLUGIN_URI_SCHEME = 'plugin';
const PLUGIN_RUNTIME_HOST_SUFFIX = '.localhost';

export const dispatchCustomPluginsChanged = () => {
    window.dispatchEvent(new CustomEvent(CUSTOM_PLUGINS_CHANGED_EVENT));
};

export const normalizeSidebarGroupPath = (value: string) => {
    const trimmed = value
        .split(/[\\/]/)
        .map(part => part.trim())
        .filter(Boolean);

    return trimmed.join('/') || DEFAULT_PLUGIN_GROUP_PATH;
};

export const buildPluginToolPath = (plugin: CustomPluginRecord) => {
    return `${normalizeSidebarGroupPath(plugin.sidebarGroupPath)}/${plugin.name.trim()}`;
};

export const toPluginToolDefinition = (plugin: CustomPluginRecord): ToolDefinition => {
    return {
        id: plugin.id,
        name: plugin.name,
        description: plugin.description,
        enabled: plugin.enabled,
        iconKey: plugin.iconKey,
        path: buildPluginToolPath(plugin),
        pluginRoot: plugin.pluginRoot,
        entryFile: plugin.entryFile,
        source: 'plugin',
        sidebarOrder: plugin.sidebarOrder,
        windowMaxWidth: plugin.windowMaxWidth === 'none' ? 'none' : undefined,
    };
};

export const isPluginTool = (tool?: ToolDefinition): boolean => {
    return tool?.source === 'plugin' && !!tool.pluginRoot && !!tool.entryFile;
};

export const buildPluginEntryPath = (tool: ToolDefinition) => {
    const root = tool.pluginRoot?.replace(/[\\/]+$/, '') || '';
    const entryFile = tool.entryFile?.replace(/^[/\\]+/, '') || '';

    return `${root}/${entryFile}`;
};

const encodePathSegments = (value: string) => {
    return value
        .split(/[\\/]+/)
        .filter(Boolean)
        .map(segment => encodeURIComponent(segment))
        .join('/');
};

const chunkString = (value: string, chunkSize: number) => {
    const chunks: string[] = [];

    for (let index = 0; index < value.length; index += chunkSize) {
        chunks.push(value.slice(index, index + chunkSize));
    }

    return chunks;
};

export const encodePluginRuntimeHost = (pluginId: string) => {
    const hex = Array.from(pluginId)
        .map(character => character.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('');

    const labels = chunkString(`p${hex}`, 63);

    return `${labels.join('.')}${PLUGIN_RUNTIME_HOST_SUFFIX}`;
};

const shouldUseHttpProtocolBridge = (userAgent: string) => {
    return /windows|android/i.test(userAgent);
};

export const buildPluginRuntimeUrl = (
    tool: ToolDefinition,
    userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent
) => {
    const runtimeHost = encodePluginRuntimeHost(tool.id);
    const entryFile = encodePathSegments(tool.entryFile || 'index.html');
    const useHttpBridge = shouldUseHttpProtocolBridge(userAgent);

    return useHttpBridge
        ? `http://${PLUGIN_URI_SCHEME}.${runtimeHost}/${entryFile}`
        : `${PLUGIN_URI_SCHEME}://${runtimeHost}/${entryFile}`;
};

export const listCustomPlugins = async () => {
    return invoke<CustomPluginRecord[]>('list_custom_plugins');
};

export const getPluginEnvironment = async () => {
    return invoke<PluginEnvironment>('get_plugin_environment');
};
