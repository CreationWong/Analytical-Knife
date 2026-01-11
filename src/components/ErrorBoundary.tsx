import { Component, ReactNode } from "react";
import { Alert, Button, Box } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";

interface Props { children?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ToolErrorBoundary extends Component<Props, State> {
    public state: State = { hasError: false, error: null };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public render() {
        if (this.state.hasError) {
            return (
                <Box p="md">
                    <Alert variant="light" color="red" title="该工具加载失败" icon={<IconAlertCircle />}>
                        {this.state.error?.message}
                        <div style={{ marginTop: 10 }}>
                            <Button size="xs" color="red" onClick={() => window.location.reload()}>刷新重试</Button>
                        </div>
                    </Alert>
                </Box>
            );
        }
        return this.props.children;
    }
}