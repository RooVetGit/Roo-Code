import { Cline } from "../Cline"
import { Anthropic } from "@anthropic-ai/sdk"
import { OpenAiHandler } from "../../api/providers/openai"


async function extern_thinking(systemPrompt: string, conversation: {
  role: "user" | "assistant";
  content: string | Anthropic.Messages.ContentBlockParam[];
}[], cline: Cline) {
  try {
    const options = {
      openAiModelId: "gpt-4o",
      openAiApiKey: '123',
      openAiStreamingEnabled: true,
      openAiBaseUrl: 'http://172.13.28.66:46605/v1'
    }
    
    const handler = new OpenAiHandler(options)

    const stream = handler.createMessage(systemPrompt, conversation)
    let reasoningMessage = ""
    for await (const chunk of stream) {
      if (chunk.type === "reasoning") {
        reasoningMessage += chunk.text
        await cline.say("reasoning", reasoningMessage, undefined, true)
      }
    }
    return reasoningMessage
  } catch (error) {
    console.error("Error in extern_thinking:", error)
    await cline.say("error", "思考过程出现错误")
  }
  return null
}

export async function addExternThinkingInToConversation(systemPrompt: string, cleanConversationHistory: {
  role: "user" | "assistant";
  content: string | Anthropic.Messages.ContentBlockParam[];
}[], cline: Cline) {
  const lastMessage = cleanConversationHistory.at(-1);
  const reasoningMessage = 
`This is the thinking of another AI agent on the current issue, which can be used as a reference. Note that its line of reasoning may not necessarily be entirely correct or comprehensive. 
<thinking>
${await extern_thinking(systemPrompt, cleanConversationHistory, cline)}
</thinking>
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



