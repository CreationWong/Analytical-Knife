import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { Box, Paper, useMantineColorScheme } from '@mantine/core';
// 判断当前是否需要跟随系统深色模式
export const getTheme = (mode: 'dark' | 'light') => mode;

export default function Whiteboard() {
    const { colorScheme } = useMantineColorScheme();

    return (
        <Paper
            withBorder
            shadow="xs"
            p={0}
            style={{
                height: 'calc(100vh - 120px)',
                overflow: 'hidden',
                backgroundColor: 'var(--mantine-color-body)'
            }}
        >
            <Box style={{ height: '100%', width: '100%' }}>
                <Excalidraw
                    // 自动切换深色/浅色模式
                    theme={getTheme(colorScheme as 'dark' | 'light')}
                    UIOptions={{
                        canvasActions: {
                            toggleTheme: false, // 禁用内部切换，由系统统一控制
                        }
                    }}
                />
            </Box>
        </Paper>
    );
}