## 工具开发规范 (Plugin Development Guide)

本项目采用 **注册制（Registry-based）** 架构。添加一个新工具无需修改 `App.tsx` 核心逻辑，只需遵循以下三个步骤。

### 1. 目录结构约定

所有新工具应存放在 `src/tools/` 下的对应分类目录中：

```
src/tools/
└── [CategoryName]/          # 分类文件夹 (如 TextTools)
    └── [ToolName].tsx       # 工具主组件 (如 HashTool.tsx)
```

### 2. 定义工具属性

在 `src/registry/index.ts` 中注册你的工具。

| 字段            | 类型       | 说明         | 示例/注意事项                                     |
|:--------------|:---------|:-----------|:--------------------------------------------|
| `id`          | `string` | 唯一标识符      | 用于持久化存储和路由跳转，必须全局唯一                         |
| `name`        | `string` | 侧边栏显示的工具名称 | 用户可见的菜单项名称                                  |
| `description` | `string` | 功能简短描述     | 显示在名称下方的辅助文本，通常用于说明工具用途                     |
| `icon`        | `Icon`   | 图标组件       | 来自 `@tabler/icons-react` 的图标组件，用于视觉标识       |
| `path`        | `string  | null`      | 侧边栏路径                                       | 格式如 `Text/Crypto`（分类/子分类），`null`表示不在侧边栏显示 |
| `component`   | `Lazy`   | React组件    | 使用React的`lazy(() => import(...))`进行代码分割和懒加载 |

### 3. 代码实现步骤

#### 第一步：创建工具组件

在 `src/tools/Example/MyNewTool.tsx` 中编写业务逻辑：

```react
import { Stack, TextInput, Button, Paper } from '@mantine/core';
import { useState } from 'react';

export default function MyNewTool() {
  const [value, setValue] = useState('');
  
  return (
    <Paper p="md" withBorder>
      <Stack>
        <TextInput 
          label="输入内容" 
          value={value} 
          onChange={(e) => setValue(e.currentTarget.value)} 
        />
        <Button onClick={() => alert(value)}>点击测试</Button>
      </Stack>
    </Paper>
  );
}
```

#### 第二步：在注册表中登记

打开 `src/registry/index.ts`，添加新项：

```ts
{
  id: 'my-new-tool',
  name: '我的新工具',
  description: '这是一个演示插件开发的示例工具',
  icon: IconPlug,
  path: '演示分类/子项',
  component: lazy(() => import('../tools/Example/MyNewTool')),
},
```

------

## 进阶开发建议

### 1. 异常处理

内置了全局 `ErrorBoundary`。如果你的工具内部可能发生崩溃（如解析错误格式的文件），可以使用我们封装的错误处理：

```ts
import { handleAppError } from '../../utils/error';

// 在 try-catch 中使用
try {
  // 业务逻辑
} catch (err) {
  handleAppError(err, { autoReload: true });
}
```

### 2. 状态持久化

如果你的工具包含复杂配置，建议使用 `localStorage` 或 `jotai/zustand` 的 persist 中间件，确保用户切换工具回来后状态不丢失。

### 3. Tauri 后端交互 (Rust)

若需要调用系统 API，请在 `src-tauri/src/main.rs` 定义命令，并在组件中使用 `invoke`：

```ts
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('my_rust_command', { payload: data });
```

------

### 