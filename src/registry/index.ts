import { lazy } from 'react';
import { ToolDefinition } from './types';
import {IconInfoCircle, IconLockCode} from "@tabler/icons-react";

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
        path: 'TextTools/Base64Tool',
        component: lazy(() => import('../tools/TextTools/Base64Tool')),
    },
];