import { lazy } from 'react';
import { ToolDefinition } from './types';
import { Hash } from 'lucide-react';

export const TOOLS_REGISTRY: ToolDefinition[] = [
    {
        id: 'base64',
        name: 'Base64 转换',
        description: '字符串与 Base64 互转',
        icon: Hash,
        path: 'TextTools/Base64Tool',
        component: lazy(() => import('../tools/TextTools/Base64Tool')),
    },
];