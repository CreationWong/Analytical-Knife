# 工具开发规范 (Plugin Development Guide)

本项目采用 **注册制（Registry-based）** 架构。添加新工具无需修改核心逻辑，只需遵循以下三个步骤。

### 1. 目录结构约定

所有新工具应存放在 `src/tools/` 下的对应分类目录中：

```
src/tools/
└── [CategoryName]/          # 分类文件夹 (如 TextTools)
    └── [ToolName].tsx       # 工具主组件 (如 HashTool.tsx)
```

### 2. 定义工具属性

在 `src/registry/index.ts` 中注册工具。

| 字段            | 类型       | 说明         | 示例/注意事项                                     |
|:--------------|:---------|:-----------|:--------------------------------------------|
| `id`          | `string` | 唯一标识符      | 用于持久化存储和路由跳转，必须全局唯一                         |
| `name`        | `string` | 侧边栏显示的工具名称 | 用户可见的菜单项名称                                  |
| `description` | `string` | 功能简短描述     | 显示在名称下方的辅助文本，说明工具用途                         |
| `icon`        | `Icon`   | 图标组件       | 来自 `@tabler/icons-react` 的图标组件              |
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
  path: '分类/子项/ID',
  component: lazy(() => import('../tools/Example/MyNewTool')),
},
```

---

## 进阶开发建议

### 1. 统一通知弹窗

`showNotification` 函数封装了 Mantine Notifications 的常用配置，提供一致的 UI/UX 体验。

- `info`（蓝色）：用于操作成功、普通提示等非干扰性信息
- `warning`（黄色）：用于潜在问题、部分失败、格式不规范等需注意但非致命的情况
- `error`（红色）：用于严重错误、操作失败等必须引起用户注意的情形

#### 参数说明

| 参数                | 类型                             | 默认值                       | 说明                                                                |
|:------------------|:-------------------------------|:--------------------------|:------------------------------------------------------------------|
| `title`           | `string`                       | 根据 type 自动设置              | 通知标题。未提供时根据 type 自动设置为“提示”、“警告”或“错误”                              |
| `message`         | `string ｜ React.ReactNode`     | 必填                        | 通知内容。支持纯文本（自动保留换行）或 React 元素（用于富文本/交互）                            |
| `type`            | `'info' ｜ 'warning' ｜ 'error'` | `'info'`                  | 通知类型，决定颜色和默认行为                                                    |
| `autoClose`       | `number ｜ boolean`             | `5000`（info）或 `false`（其他） | 自动关闭时间（毫秒）。`info` 默认 5 秒后自动消失；`warning` 和 `error` 默认不自动关闭，需用户手动关闭 |
| `id`              | `string`                       | `${type}-notification`    | 通知的唯一标识符。相同 id 的通知会自动合并，避免重复弹窗                                    |
| `withCloseButton` | `boolean`                      | `true`                    | 是否显示右上角关闭按钮。对于需要用户确认的重要错误，建议保留；对于临时提示可设为 false                    |

#### 使用示例

```typescript
// 信息提示
showNotification({ type: 'info', title: '成功', message: '文件已保存！' });

// 警告（带自定义关闭时间）
showNotification({ type: 'warning', message: '部分数据格式不匹配', autoClose: 6000 });

// 错误（不自动关闭）
showNotification({ type: 'error', message: '网络连接失败，请重试。' });
```

### 2. 统一异常处理器

`handleAppError` 函数封装了应用中的错误展示逻辑。

#### 功能特性

- 区分警告（warning）与错误（error）
- 支持手动重试（带“立即刷新重试”按钮）
- 支持自动重载（带倒计时提示）
- 支持自定义重试逻辑（通过 `onRetry`）

#### 使用示例

```typescript
// 普通错误
handleAppError(new Error('API 请求失败'));

// 警告（不阻断）
handleAppError('输入格式不规范', { isWarning: true });

// 自动重连
handleAppError(err, { autoReload: true, reloadDelay: 5000 });

// 自定义重试
handleAppError(err, {
  title: '加载失败',
  onRetry: () => refetchData(),
});
```

#### 参数说明

```typescript
interface ErrorOptions {
  title?: string;            // 错误标题，未提供时使用默认标题
  isWarning?: boolean;       // 是否为警告类型（黄色而非红色）
  autoReload?: boolean;      // 是否自动重载页面
  reloadDelay?: number;      // 自动重载延迟时间（毫秒），默认3000
  onRetry?: () => void;      // 自定义重试回调函数
  showNotification?: boolean;// 是否显示通知，默认true
}
```

### 3. 全局错误边界

内置了全局 `ErrorBoundary`。如果工具内部可能发生崩溃（如解析错误格式的文件），可以使用封装的错误处理：

```typescript
import { handleAppError } from '../../utils/error';

// 在 try-catch 中使用
try {
  // 业务逻辑
} catch (err) {
  handleAppError(err, { autoReload: true });
}
```

### 4. 状态持久化

如果工具包含复杂配置，建议使用以下方式确保用户切换工具后状态不丢失：

- 使用 `localStorage` 进行简单状态持久化
- 使用 `jotai/zustand` 的 persist 中间件进行复杂状态管理

### 5. Tauri 后端交互 (Rust)

若需要调用系统 API，请在 `src-tauri/src/main.rs` 定义命令，并在组件中使用 `invoke`：

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('my_rust_command', { payload: data });
```

## 5. 深色模式
添加对深色模式支持。