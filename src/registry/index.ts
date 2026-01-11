import { lazy } from 'react';
import { ToolDefinition } from './types';
import {IconCode, IconInfoCircle, IconListCheck, IconLockCode, IconTerminal2} from "@tabler/icons-react";

export const TOOLS_REGISTRY: ToolDefinition[] = [
    {
        id: 'about',
        name: '关于项目',
        description: '软件信息与说明',
        icon: IconInfoCircle,
        path: null,
        component: lazy(() => import('../components/About')),
    },

    {
        id: 'base64',
        name: 'Base64 转换',
        description: '字符串与 Base64 互转',
        icon: IconLockCode,
        path: '编码处理/base64',
        component: lazy(() => import('../tools/Encode&Decode/Base64Tool')),
    },

    {
        id: 'curlCommandGenerator',
        name: 'Curl 命令生成器',
        description: 'curl 构造器',
        icon: IconTerminal2,
        path: '网络工具/API 调试/curlCommandGenerator',
        component: lazy(() => import('../tools/Network/CurlCommandGenerator')),
    },

    {
        id: 'payloadGenerator',
        name: '一句话木马生成器',
        description: '支持自定义参数的 WebShell 模板生成器',
        icon: IconCode,
        path: '生成器/Payload/payloadGenerator',
        component: lazy(() => import('../tools/Security/PayloadGenerator')),
    },

    {
        id: 'batchFlagReformatter',
        name: '批量 Flag 格式转换',
        description: '批量将 flag{...} 转换为统一前缀格式',
        icon: IconListCheck,
        path: 'CTF/辅助/batchFlagReformatter',
        component: lazy(() => import('../tools/CTF/BatchFlagReformatter')),
    }
];