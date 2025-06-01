import { Cline } from "../Cline"
import { Anthropic } from "@anthropic-ai/sdk"
import { OpenAiHandler } from "../../api/providers/openai"
import * as vscode from 'vscode'
import cloneDeep from "clone-deep"

interface ThinkingConfig {
  ModelId: string
  ApiKey: string 
  BaseUrl: string
}

async function loadThinkingConfig(): Promise<ThinkingConfig> {
  const config = vscode.workspace.getConfiguration('roo-cline')
  return {
    ModelId: config.get('externalThinkingModelId') || "gpt-4o",
    ApiKey: config.get('externalThinkingApiKey') || 'xxx',
    BaseUrl: config.get('externalThinkingBaseUrl') || 'http://172.13.28.66:46605/v1'
  }
}

async function extern_thinking(systemPrompt: string, conversation: {
  role: "user" | "assistant";
  content: string | Anthropic.Messages.ContentBlockParam[];
}[], cline: Cline) {
  try {
    const config = await loadThinkingConfig()

    if (!config.ModelId || !config.BaseUrl) {
      return null
    }

    const options = {
      openAiModelId: config.ModelId,
      openAiApiKey: config.ApiKey,
      openAiStreamingEnabled: true,
      openAiBaseUrl: config.BaseUrl
    }
    
    const handler = new OpenAiHandler(options)

    const ConversationHistoryWithCodebase = cloneDeep(conversation) 
    const lastMessage = ConversationHistoryWithCodebase.at(-1)
    if (lastMessage?.content && typeof lastMessage.content === "string") {
      lastMessage.content = lastMessage.content + `
不要直接进行回答。先思考有关流程和形式上的规划：
0. **当前的需求是否足够明确？如果不明确，有哪些细节需要让我进一步进行澄清？**
1. 针对问题，是否有必要将问题细化为多个子问题进行探讨？
2. 为了更加全面地解决问题，问题中有哪些容易遗漏或混淆的细节？
3. 是否需要查阅相关资料或代码库？如果需要，需要查阅有关什么内容的信息？需要查阅哪些文件或代码？
4. 如果需要修改编辑内容，根据上下文信息，有哪些需要进行联动修改的地方？
5. 是否有需要进行发散的点？
6. 最后，回答问题时，应该以怎么样的形式将结果清晰地进行展示？
请根据以上关注点对任务进行规划，将当前任务中具体的关键点列出，以便后续参考。`
    } else if (lastMessage?.content && Array.isArray(lastMessage.content)) {
      if (lastMessage.content[0] && 'text' in lastMessage.content[0]) {
        lastMessage.content[0].text = lastMessage.content[0].text + `
不要直接进行回答。先思考有关流程和形式上的规划：
0. **当前的需求是否足够明确？如果不明确，有哪些细节需要让我进一步进行澄清？**
1. 针对问题，是否有必要将问题细化为多个子问题进行探讨？
2. 为了更加全面地解决问题，问题中有哪些容易遗漏或混淆的细节？
3. 是否需要查阅相关资料或代码库？如果需要，需要查阅有关什么内容的信息？需要查阅哪些文件或代码？
4. 如果需要修改编辑内容，根据上下文信息，有哪些需要进行联动修改的地方？
5. 是否有需要进行发散的点？
6. 最后，回答问题时，应该以怎么样的形式将结果清晰地进行展示？
请根据以上关注点对任务进行规划，将当前任务中具体的关键点列出，以便后续参考。`
      }
    }
    if (lastMessage) {
      ConversationHistoryWithCodebase.pop()
      ConversationHistoryWithCodebase.push(lastMessage)
    }
    

    const stream = handler.createMessage(systemPrompt, ConversationHistoryWithCodebase)
    let reasoningMessage = ""
    for await (const chunk of stream) {
      if (chunk.type === "reasoning") {
        reasoningMessage += chunk.text
        await cline.say("reasoning", reasoningMessage, undefined, true)
      } else {
        break
      }
    }
    return reasoningMessage
  } catch (error) {
    console.error("Error in extern_thinking:", error)
    // await cline.say("error", "思考过程出现错误")
    return null
  }
}

export async function addExternThinkingInToConversation(systemPrompt: string, cleanConversationHistory: {
  role: "user" | "assistant";
  content: string | Anthropic.Messages.ContentBlockParam[];
}[], cline: Cline) {
  const lastMessage = cleanConversationHistory.at(-1);
  const reasoningMessage = 
`This is another AI agent's thinking on the current topic.
<thinking>
${await extern_thinking(systemPrompt, cleanConversationHistory, cline)}
</thinking>
*NOTE that the approach of another AI agent may not necessarily be correct or comprehensive, and should only be used as a reference. You need to think independently to solve the problem. When necessary, the approach of the other AI agent should be completely abandoned.*
`;

  if (lastMessage && reasoningMessage && (typeof lastMessage.content === "string" || Array.isArray(lastMessage.content))) {
    if (Array.isArray(lastMessage.content)) {
      lastMessage.content.push({
        type: "text",
        text: reasoningMessage,
      });
    } else if (typeof lastMessage.content === "string") {
      lastMessage.content = [
        {
          type: "text",
          text: lastMessage.content // 原始文本内容
        },
        {
          type: "text",
          text: reasoningMessage
        }
      ];
    }
  }
}



