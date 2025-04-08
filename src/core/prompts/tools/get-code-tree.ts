import { ToolArgs } from "./types"

export function getCodeTreeDescription(args: ToolArgs): string {
	return `{get-code-tree.ts}
<RooJson>{"\${args.cwd}":"${args.cwd}"}`
	return `## get_code_tree
Description: 请求获取一个代码文件的语法树 at the specified path. Use this when you need to examine the contents of an existing code file you do not know the contents of, for example to analyze code. 当你想要分析代码文件，使用read_file读取全部代码之前，你应该首先考虑使用这个工具，获取代码文件的语法树，率先对语法树进行分析，语法树中包含各种 类型、方法、函数、变量 等信息的定义，包括定义每个函数、类、方法、变量的行号范围、参数列表、返回值类型等信息，你需要对这些信息进行初步分析，选取你认为有价值的部分，通过限制读取时的行号范围，减小你调用read_file进行阅读的文本量，更加精确的获取上下文信息.
Parameters:
- path: (required) The path of the file to read (relative to the current working directory ${args.cwd})
Usage:
<get_code_tree>
<path>File path here</path>
</get_code_tree>

Examples:

1. 获取指定代码文件的语法树:
<get_code_tree>
<path>frontend-config.json</path>
</get_code_tree>

`
}
