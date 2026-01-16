import { lazy } from 'react';
import { ToolDefinition } from './types';
import {
    IconBug, IconChartBar,
    IconCode, IconHeartHandshake,
    IconInfoCircle,
    IconKey,
    IconListCheck,
    IconLockCode, IconLockOpen, IconReplace, IconSettings,
    IconTerminal2
} from "@tabler/icons-react";

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
        id: 'UISettings',
        name: '界面设置',
        description: '配置界面',
        icon: IconSettings,
        path: '设置/UISettings',
        component: lazy(() => import('../components/./UISettings')),
    },

    {
        id: 'base64',
        name: 'Base64 转换',
        description: '字符串与 Base64 互转',
        icon: IconLockCode,
        path: '编码处理/Base/base64',
        component: lazy(() => import('../tools/Encode&Decode/Base64Tool')),
    },

    {
        id: "urlCodecTool",
        name: "URL 编解码",
        description: "URL 编解码工具",
        icon: IconLockCode,
        path: '编码处理/网络工具/urlCodecTool',
        component: lazy(() => import('../tools/Encode&Decode/UrlCodecTool.tsx')),
    },

    {
        id: 'coreValuesCrypto',
        name: '社会主义核心价值观编码',
        description: '将文本转换成社会主义核心价值观',
        icon: IconHeartHandshake,
        path: '编码处理/特殊编码/coreValuesCrypto',
        component: lazy(() => import('../tools/Encode&Decode/CoreValuesTool.tsx')),
    },

    {
        id: 'wordFreq',
        name: '字频分析',
        description: '大规模文本频率统计工具',
        icon: IconChartBar,
        path: '密码学/Text/WordFreq',
        component: lazy(() => import('../tools/Crypto/WordFreq.tsx')),
    },

    {
        id: 'smartReplacer',
        name: '字符替换',
        description: '多规则替换',
        icon: IconReplace,
        path: '密码学/Text/Replacer',
        component: lazy(() => import('../tools/Crypto/SmartReplacer.tsx')),
    },

    {
        id: "bigRsaSolver",
        name: "BigRSA (共享素数)",
        description: "利用模数共享质因数(GCD)破解 RSA密文",
        icon: IconLockOpen,
        path: '密码学/RSA/bigRsaSolver',
        component: lazy(() => import('../tools/Crypto/BigRSASolver.tsx')),
    },

    {
        id: 'commonModulusAttack',
        name: '共模攻击',
        description: '利用相同模数 N、不同公钥指数的两个 RSA 密文恢复明文',
        icon: IconKey,
        path: '密码学/RSA/commonModulusAttack',
        component: lazy(() => import('../tools/Crypto/CommonModulusAttack')),
    },

    {
        id: 'curlCommandGenerator',
        name: 'Curl 命令生成器',
        description: 'curl 构造器',
        icon: IconTerminal2,
        path: '网络工具/API/curlCommandGenerator',
        component: lazy(() => import('../tools/Network/CurlCommandGenerator')),
    },

    {
        id: 'payloadWebshellGenerator',
        name: 'Webshell 生成器',
        description: '支持多种编程语言、免杀混淆及工具适配的 Webshell 生成器',
        icon: IconCode,
        path: '生成器/Payload/payloadWebshellGenerator',
        component: lazy(() => import('../tools/Security/PayloadWebshellGenerator.tsx')),
    },

    {
        id: 'reverseShellGenerator',
        name: '反弹 Shell 生成器',
        description: '快速生成不同环境下的反弹 Shell 命令',
        icon: IconTerminal2,
        path: '生成器/Payload/reverseShellGenerator',
        component: lazy(() => import('../tools/Security/ReverseShellGenerator')),
    },

    {
        id: 'xssGenerator',
        name: 'XSS 生成器',
        description: '快速生成常见的跨站脚本攻击测试 Payload',
        icon: IconBug,
        path: '生成器/漏洞测试/xssGenerator',
        component: lazy(() => import('../tools/Security/XSSGenerator.tsx')),
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