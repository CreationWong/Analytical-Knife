# 工具开发规范 (Plugin Development Guide)

本项目采用 **注册制（Registry-based）** 架构。通过严格的模块化约定和全栈单元测试要求，确保系统的高度可维护性与稳定性。

------

## 1. 目录结构与环境约定

### 1.1 前端目录 (React/TypeScript)

所有工具必须存放在 `src/tools/` 目录下，并强制包含测试域：

```
src/tools/
└── [CategoryName]/
    ├── __tests__/             # 强制：单元测试文件夹 (Vitest)
    │   └── [ToolName].test.ts
    └── [ToolName].tsx         # 视图与交互层
```

### 1.2 后端目录 (Rust/Tauri)

后端采用 **多级路由解耦模式**，逻辑结构如下：

```
src-tauri/src/
├── modules/                   # 逻辑根目录
│   ├── mod.rs                 # 顶级路由枢纽 (Domain Entry)
│   └── [domain]/              # 功能分类目录 (例如：crypto)
│       ├── mod.rs             # 二级路由枢纽 (Module Entry)
│       └── [tool_name].rs     # 核心算法与 Command 实现
└── lib.rs                     # 注册中心
```

------

## 2. 代码开发过程

一般分为 **前端工具** 和 **后端工具** 。前端工具适合简单编解码、生成器等性能开销不大情景，对于需要大量计算和分析的工具 **必须使用后端** ！

### 前端组件开发 (React)

在 `src/tools/[Category]/[ToolName].tsx` 中实现 UI。推荐将纯算法逻辑提取，以便测试。

```typescript
import { Paper, Stack, TextInput } from '@mantine/core';
import { handleAppError } from '../../utils/error';

export const localLogic = (val: string) => val.trim();

export default function MyTool() {
  // UI 实现...
}
```

### 后端逻辑实现 (Rust)

在 `src-tauri/src/modules/[domain]/[tool_name].rs` 中编写核心算法。**必须包含内部单元测试**。

对于纯前端工具可以跳过此步。

```rust
#[tauri::command]
pub fn solve_task(input: String) -> Result<String, String> {
    if input.is_empty() { return Err("输入不能为空".into()); }
    Ok(input.to_uppercase())
}

// 强制：后端算法单元测试
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_solve_task() {
        assert_eq!(solve_task("abc".into()).unwrap(), "ABC");
    }
}
```

### 全栈测试验证

- **后端测试**：执行 `cargo test`。
- **前端测试**：在 `__tests__` 下编写 Vitest 用例，执行 `npm test`。

### 注册登记

在 `src/registry/index.ts` 中登记工具元数据：

```
{
  id: 'myTool',                // 唯一标识 (驼峰命名)
  name: '转换工具',
  description: '文字处理示例',   // 建议 10 字以内
  icon: IconAlphabetUppercase, // 仅限 tabler.io/icons
  path: 'Text/Basic/myTool',   // 菜单路径：分类/子类/ID
  component: lazy(() => import('../tools/Example/MyTool')),
}
```

------

## 3. 进阶辅助工具

详细内容参见 `API.md` 。

### 3.1 统一通知弹窗 (`showNotification`)

自动适配语义化颜色与交互行为。

| **类型**    | **颜色** | **自动关闭** | **场景**    |
|-----------|--------|----------|-----------|
| `info`    | 蓝色     | 5000ms   | 成功、普通提示   |
| `warning` | 黄色     | 永久       | 格式问题、部分失败 |
| `error`   | 红色     | 永久       | 系统故障、致命异常 |

### 3.2 统一异常处理器 (`handleAppError`)

**涉及后端调用的工具必须使用此处理器**。它能自动解析 Rust 返回的 `Err` 字符串并提供恢复选项。

```typescript
try {
  const res = await invoke('solve_task', { input });
} catch (err) {
  handleAppError(err, { autoReload: true, reloadDelay: 3000 });
}
```

------

## 4. UI 视觉规范 (Dark Mode)

本项目严格适配深色模式。**严禁硬编码颜色值**。

- **颜色变量**：
  - 背景：`var(--mantine-color-body)`
  - 文字：`var(--mantine-color-text)`
  - 容器弱背景：`var(--mantine-color-default-hover)`
- **容器组件**：优先使用 `<Paper withBorder shadow="xs" />`，边框颜色将由 Mantine 根据模式自动切换。
- **主题颜色**：
  - 本项目允许用户定义不妨碍视觉引导的主题颜色。
  - 请导入 `import { useAppSettings } from '../../hooks/useAppSettings';` 以获取 HOOK。
  - 按照 HOOK 规范定义、导入和使用。例：const [settings] = useAppSettings();
    - 使用 `settings.primaryColor`  获取用户定义的颜色。
    - 可以使用 `var(--mantine-color-${settings.primaryColor}-filled)` 定义图标颜色。

  - 注意：应当不影响深色模式下使用。


------

## 5. 开发检查清单 (Checklist)

- 后端逻辑是否已在两级 `mod.rs` 中正确挂载？
- 后端 Command 是否已在 `lib.rs` 的 `generate_handler!` 中注册？
- 前端组件是否使用了 `handleAppError` 处理后端异常？
- 是否已通过 `cargo test` 和 `npm test`？
- UI 是否在深色/浅色模式下均清晰可见？