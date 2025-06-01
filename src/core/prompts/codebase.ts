
import { McpHub } from "../../services/mcp/McpHub"
import { McpServer } from "../../shared/mcp"
import { Cline } from "../Cline"
import { Anthropic } from "@anthropic-ai/sdk"


async function codebase(conversation: string, mcpHub: McpHub, codeContextServer: McpServer, cline: Cline, n_results: number = 64) {
  // 调用code_context服务器中的search_code工具
  let queries: string[] = []
  try {
    const system_prompt = 
`You are an experienced requirements analyst and RAG designer. Below, users will show you a conversation between a user and an AI assistant, which may contain one or more unresolved questions or requirements. 
You need to extract keywords and dependencies from these conversations. These keywords and dependencies will be used in the RAG code vector database within the CodeBase feature of the AI programming tool to search for contextual code or documentation information that the questions or requirements depend on to resolve them.

Please note:

- If code blocks appear in the conversation, note that keywords may be important fields within the code blocks, such as class names, member names, function names, etc. Identify those identifiers that need to understand their details when solving problems.
- These dependencies may not be directly provided in the conversation but may be implied within it, requiring you to abstract and summarize based on the dialogue.
- Regarding predicting keywords not directly present in the conversation:
    - If the question is code-related, you can try to infer or guess required function names, class names, or other relevant code elements as keywords.
    - If it's about documentation, try to infer or guess keywords that might be contained in the documentation.
- Focus on the question itself, your answer will directly affect subsequent retrieval results in RAG, thus impacting the effectiveness of AI's problem-solving, so ensure information is complete and accurate.
- Keywords should be specific and closely related to the project and the problem. Do not output vague keywords, such as "class definition" and "member function", as these keywords are too general and abstract and cannot effectively search for specific content in the project RAG
- If any character in the recent conversation specifies some keywords that need to be searched, then also add these keywords to the output results.
- Do not use filenames or directories as keywords unless explicitly mentioned in the conversation to query documents related to a specific file. For example, if the task in the conversation is "I will modify the xxx file" or "I will read the xxx file", the topic is not related to the filename but to the file content, and file paths or filenames should not be used as keywords. If the conversation states "I will look for information about the xxx file", the content of the task is related to the filename, and filenames can be used as keywords.
- Avoid repetition. Select the most critical keywords or dependencies, with no more than 6 items in total.
- **Each keywords should be written as a single line, starting with "-", and should not exceed 20 characters.**
- Use English to answer.

For example:
\`\`\`
sqlite建表的代码写在了哪个文件中
\`\`\`
Your response might be:
\`\`\`
- SQLite tables
- CREATE TABLE
\`\`\`
For example:
\`\`\`
链表节点定义在哪里？申请了堆内存吗？用了RAII吗？
\`\`\`
Your response might be:
\`\`\`
- Linked list node definition
- Memory allocation
- ~Node()
\`\`\`
For example:
\`\`\`
当前是一个c++项目，我需要在Base类和他的所有派生类中添加一个虚函数debug()，这个函数的实现需要打印出类名、name成员和对象的地址。请问该怎么做？
\`\`\`
Your response might be:
\`\`\`
- AAAA class definition
- class AAAA members name
- virtual T debug()
- class D: AAAA {{
\`\`\`
`
    // 创建一个流式请求获取关键词
    const stream = await cline.api.createMessage(system_prompt, [{
      content: conversation,
      role: "user"
    }])

    // 收集响应文本
    let keywordsText = ""
    for await (const chunk of stream) {
      if (chunk.type === "text") {
        keywordsText += chunk.text
      }
    }

    // 分割成数组
    queries = keywordsText.split("\n").filter(kw => kw.startsWith("- ")).map(kw => kw.replace("- ", "").trim()).filter(Boolean)
  } catch (toolError) {
    console.error("Failed to get keywords:", toolError)
    return { queries: [], contextContent: "" }
  }

  if (queries.length > 0) {
    // 调用code_context服务器中的search_code工具
    try {
      // 使用提取的搜索查询来增强相关性
      const result = await mcpHub.callTool(
        codeContextServer.name,
        "search_code",
        { queries, n_results },
        codeContextServer.source
      )

      if (result && result.content) {
        // 处理内容数组，提取文本内容
        const contextContent = result.content
          .map(item => {
            if (item.type === "text") {
              return item.text
            } else if (item.type === "resource" && item.resource.text) {
              return item.resource.text
            }
            return ""
          })
          .filter(Boolean)
          .join("\n\n")

        if (contextContent) {
          return { queries, contextContent }
        }
      }
    } catch (toolError) {
      console.error("Failed to call search_code tool:", toolError)
      return { "queries": [], "contextContent": "" }
    }
  }
  return { queries: [], contextContent: "" }
}

/**
 * 生成MCP相关的提示内容
 * 
 * @param mcpHub McpHub实例，用于获取代码上下文
 * @param conversation 对话历史信息，用于增强上下文搜索
 * @returns 生成的MCP提示内容
 */
export async function generateCodebasePrompt(mcpHub: McpHub | undefined, conversation: Array<any>, cline: Cline): Promise<string> {
  async function not_support() {
    await cline.say("text", `(Codebase当前不可用)\n\n`)
  }
  
  if (!mcpHub) {
    await not_support()
    return ""
  }

  try {
    // 获取MCP服务器列表
    const servers = mcpHub.getServers()

    // 查找code_context服务器
    const codeContextServer = servers.find(server => server.name.toLowerCase().includes('code_context'))

    if (!codeContextServer) {
      console.log("No code_context MCP server found")
      await not_support()
      return ""
    }

    // 提取对话中的最新用户问题，用于增强搜索相关性
    let searchQuery = ""
    if (conversation && conversation.length > 0) {
      // 提取最近的用户消息
      const recentUserMessages = conversation
        .filter(msg => msg.role === "user" || msg.role === "assistant")
        .slice(-8);

      if (recentUserMessages.length > 0) {
        // 从最近的用户消息中提取文本
        searchQuery = recentUserMessages
          .map(msg => {
            if (typeof msg.content === "string") {
              return `<${msg.role}>${msg.content}</${msg.role}>\n`;
            } else if (Array.isArray(msg.content)) {
              return msg.content
                .filter((block: any) => block.type === "text")
                .map((block: any) => `<${msg.role}>${block.text}</${msg.role}>\n`)
                .slice(0, -1) // 限制长度
                .join(" ");
            }
            return "";
          })
          .join(" ")
          .slice(0, 512 * 1024); // 限制长度
      }
    }

    const {
      queries,
      contextContent
    } = await codebase(searchQuery, mcpHub, codeContextServer, cline, 48)
    if (contextContent && contextContent !== "") {
      if (cline && queries.length > 0 && queries[0] !== "") {
        await cline.say("text", `正在进行问题重写...\n`)
      }
      searchQuery =
        `<task_conversation>
${searchQuery}
</task_conversation>
=======
<context>
${contextContent}
</context>
`
      const dst = await codebase(searchQuery, mcpHub, codeContextServer, cline, 24)
      if (dst.contextContent && dst.contextContent !== "") {
        if (cline && queries.length > 0 && queries[0] !== "") {
          await cline.say("text", `已在CodeBase中搜索：\n${queries.map(query => { return `  -> \`${query}\`` }).join("\n")}`)
        }
        return `
====

# CODEBASE CONTEXT

'Codebase Context' information is generated by the conversation between you and the user, through keyword extraction, and using the RAG technology to search within the current workspace's codebase, resulting in relevant information that may include context-dependent information necessary for problem-solving, which has certain reference value.
When solving user problems, please refer to the 'Codebase Context' information first, analyze and infer based on the 'Codebase Context' information. If the information in the 'Codebase Context' is sufficient to solve the user's problem, you can directly quote and answer. If the information is insufficient, you can list other information you may need and use other tools to supplement and solve the user's problem.

${contextContent}

`
      }
    }

    return ""
  } catch (error) {
    console.error("Failed to generate MCP prompt:", error)
    await not_support()
    return ""
  }
}

export async function addCodebaseInToConversation(cleanConversationHistory: {
  role: "user" | "assistant";
  content: string | Anthropic.Messages.ContentBlockParam[];
}[],
  mcpHub: McpHub | undefined, cline: Cline) {
  // 将CodeBase加入最后一个对话块
  const lastMessage = cleanConversationHistory.at(-1);
  if (lastMessage && (typeof lastMessage.content === "string" || Array.isArray(lastMessage.content))) {
    const mcpCodeContext = await generateCodebasePrompt(mcpHub, cleanConversationHistory, cline)
    if (mcpCodeContext && mcpCodeContext !== "") {

      const CodeBaseContext = `
${mcpCodeContext}

The above context is obtained through the codebase tool, and you should prioritize using these contexts to solve the user's problems. However, these contexts may be lagging, so if you have already obtained the content of the same file through the file reading tool or if you have edited the file, please take the result of the file reading tool or your edit as the standard.
When analyzing issues in the codebase context, some code and their sources can be displayed to the user as references.
`
      if (Array.isArray(lastMessage.content)) {
        lastMessage.content.push({
          type: "text",
          text: CodeBaseContext,
        });
      } else if (typeof lastMessage.content === "string") {
        lastMessage.content = [
          {
            type: "text",
            text: lastMessage.content // 原始文本内容
          },
          {
            type: "text",
            text: CodeBaseContext
          }
        ];
      }
    }
  }
}





/**
 * 生成MCP相关的提示内容
 * 
 * @param mcpHub McpHub实例，用于获取代码上下文
 * @returns 当前支持rag的文件
 */
export async function getCodebaseSupport(mcpHub?: McpHub): Promise<string> {
  if (!mcpHub) {
    return ""
  }

  try {
    // 获取MCP服务器列表
    const servers = mcpHub.getServers()

    // 查找code_context服务器
    const codeContextServer = servers.find(server => server.name.toLowerCase().includes('code_context'))

    if (!codeContextServer) {
      console.log("No code_context MCP server found")
      return ""
    }

    // 调用code_context服务器中的search_code工具
    let Queries: string[] = []
    try {
      // 使用提取的搜索查询来增强相关性
      const result = await mcpHub.callTool(
        codeContextServer.name,
        "get_embedded_list",
        {},
        codeContextServer.source
      )

      if (result && result.content) {
        // 处理内容数组，提取文本内容
        if (result.content[0].type === "text") {
          const contextContent = result.content[0].text
          Queries = JSON.parse(contextContent)
        }
      }
    } catch (toolError) {
      console.error("Failed to call get_keywords tool:", toolError)
    }
    return `
${Queries.map((str: any) => `- ${str}`).join("\n")}
  `
  } catch (error) {
    console.error("Failed to generate MCP prompt:", error)
    return ""
  }
}



/**
 * 生成MCP相关的提示内容
 * 
 * @param mcpHub McpHub实例，用于获取代码上下文
 * @returns 当前支持rag的文件
 */
export async function getSummary(mcpHub?: McpHub, paths?:string[] | undefined): Promise<string> {
  if (!mcpHub) {
    return ""
  }

  try {
    // 获取MCP服务器列表
    const servers = mcpHub.getServers()

    // 查找code_context服务器
    const codeContextServer = servers.find(server => server.name.toLowerCase().includes('code_context'))

    if (!codeContextServer) {
      console.log("No code_context MCP server found")
      return ""
    }

    try {
      const params: any = paths === undefined ? {} : { paths }
      // 使用提取的搜索查询来增强相关性
      const result = await mcpHub.callTool(
        codeContextServer.name,
        "get_summary",
        params,
        codeContextServer.source
      )

      if (result && result.content) {
        // 处理内容数组，提取文本内容
        if (result.content[0].type === "text" && result.content[0].text !== "") {
          return `These summaries include the file paths of the summarized documents and overviews of the files overall and locally. Summaries starting with "- " indicate an overall summary of the file content. Those not starting with "- " indicate a summary of a local part of the file, which includes the line numbers of the local part in the source file.\n<summary>\n${result.content[0].text}\n</summary>\n`
        }
      }
    } catch (toolError) {
      console.error("Failed to call get_keywords tool:", toolError)
    }
    return ""
  } catch (error) {
    console.error("Failed to generate MCP prompt:", error)
    return ""
  }
}

export async function addSummaryInToConversation(cleanConversationHistory: {
  role: "user" | "assistant";
  content: string | Anthropic.Messages.ContentBlockParam[];
}[],
  mcpHub: McpHub | undefined, cline: Cline, paths?: string[] | undefined) {
  // 将CodeBase加入最后一个对话块
  const lastMessage = cleanConversationHistory.at(-1);
  if (lastMessage && (typeof lastMessage.content === "string" || Array.isArray(lastMessage.content))) {
    const Summary = await getSummary(mcpHub, paths)
    if (Summary && Summary !== "") {

      const CodeBaseContext = Summary
      if (Array.isArray(lastMessage.content)) {
        lastMessage.content.push({
          type: "text",
          text: CodeBaseContext,
        });
      } else if (typeof lastMessage.content === "string") {
        lastMessage.content = [
          {
            type: "text",
            text: lastMessage.content // 原始文本内容
          },
          {
            type: "text",
            text: CodeBaseContext
          }
        ];
      }
    }
  }
}
