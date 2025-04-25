import * as http from 'http';
import * as vscode from 'vscode';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { compressWithGzip, encryptData } from './providers/tools';

// 定义支持的供应商类型
export type ChatVendor = 'deepseek' | 'openai' | 'openrouter';

export class ChatCompletionServer {
    private server: http.Server | null = null;
    private port: number;
    private outputChannel: vscode.OutputChannel;
    private vendor: ChatVendor;
    private baseURL: string;
    
    /**
     * 创建一个新的聊天补全服务器
     * @param port 服务器端口
     * @param vendor 使用的供应商 (deepseek、openai 或 openrouter)
     * @param outputChannel VS Code输出通道
     */
    constructor(port: number = 3793, vendor: ChatVendor = 'deepseek', outputChannel?: vscode.OutputChannel) {
        this.port = port;
        this.vendor = vendor;
        this.outputChannel = outputChannel || vscode.window.createOutputChannel('Chat Completion Server');
        
        // 根据供应商选择不同的基础URL
        let baseURL: string;
        switch (vendor) {
            case 'openai':
                baseURL = 'https://riddler.mynatapp.cc/api/openai/v1';
                break;
            case 'openrouter':
                baseURL = 'https://riddler.mynatapp.cc/api/openrouter/v1';
                break;
            case 'deepseek':
            default:
                baseURL = 'https://riddler.mynatapp.cc/api/deepseek/v1';
                break;
        }
        
        this.baseURL = baseURL;
        
        this.log(`聊天服务初始化完成，使用供应商: ${vendor}, 基础URL: ${baseURL}`);
    }

    /**
     * 启动聊天补全服务器
     */
    public start(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.server) {
                this.log('Server is already running');
                resolve();
                return;
            }

            this.server = http.createServer(async (req, res) => {
                // 从头中获取apikey
                // api_key = request.headers.get('Authorization')
                // if not api_key:
                //     return generate_error("Invalid API key")
                // if api_key.startswith('Bearer '):
                //     api_key = api_key[7:]
                // if len(api_key) < 8:
                //     return generate_error("Invalid API key")

                let api_key = req.headers['authorization'] || '';
                if (typeof api_key === 'string') {
                    api_key = api_key.replace('Bearer ', '');
                } else {
                    throw new Error('API密钥无效');
                }

                if (req.method === 'POST' && req.url === '/v1/chat/completions') {
                    let body = '';
                    
                    req.on('data', (chunk) => {
                        body += chunk.toString();
                    });
                    
                    req.on('end', async () => {
                        try {
                            // 记录传入请求
                            this.log(`Received chat completion request: ${body.substring(0, 100)}...`);
                            
                            // 解析原始请求数据
                            const requestData = JSON.parse(body);
                            
                            // 提取请求参数
                            const messages = requestData.messages;
                            const model = requestData.model || '';
                            const temperature = requestData.temperature ?? 0;
                            const topP = requestData.top_p;
                            const n = requestData.n;
                            const stream = requestData.stream || false;
                            const stop = requestData.stop;
                            const maxTokens = requestData.max_tokens;
                            const presencePenalty = requestData.presence_penalty;
                            const frequencyPenalty = requestData.frequency_penalty;
                            const logitBias = requestData.logit_bias;
                            const user = requestData.user;
                            
                            // 处理并加密消息数据
                            let encryptedMessages;
                            try {
                                const messagesJson = JSON.stringify(messages);
                                const compressedData = await compressWithGzip(messagesJson);
                                encryptedMessages = encryptData(compressedData);
                                this.log('成功压缩和加密消息数据');
                            } catch (error) {
                                this.log(`消息加密失败: ${error instanceof Error ? error.message : String(error)}`);
                                throw new Error('消息加密失败');
                            }
                            
                            // 使用OpenAI客户端发送请求
                            const response = await this.createChatCompletion(
                                api_key,
                                encryptedMessages,
                                model,
                                temperature,
                                topP,
                                n,
                                stream,
                                stop,
                                maxTokens,
                                presencePenalty,
                                frequencyPenalty,
                                logitBias,
                                user
                            );
                            
                            // 处理流式响应
                            if (stream && typeof response[Symbol.asyncIterator] === 'function') {
                                
                                let count = 0
                                for await (const chunk of response) {
                                    // 发送SSE格式的数据
                                    if (count === 0) {
                                        res.writeHead(200, {
                                            'Content-Type': 'text/event-stream',
                                            'Cache-Control': 'no-cache',
                                            'Connection': 'keep-alive',
                                        });
                                    }
                                    console.log(`Sending chunk: ${JSON.stringify(chunk)}`);
                                    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                                    count += 1
                                }
                                
                                // 发送结束标记
                                res.write('data: [DONE]\n\n');
                                res.end();
                            } else {
                                // 处理非流式响应
                                res.setHeader('Content-Type', 'application/json');
                                res.writeHead(200);
                                res.end(JSON.stringify(response));
                            }
                        } catch (error) {
                            this.log(`Error processing request: ${error instanceof Error ? error.message : String(error)}`);
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }));
                        }
                    });
                } else {
                    // 处理不支持的路径
                    res.writeHead(404);
                    res.end(JSON.stringify({ error: 'Not found' }));
                }
            });

            // 处理服务器错误
            this.server.on('error', (err) => {
                this.log(`Server error: ${err.message}`);
                reject(err);
            });

            // 启动服务器
            this.server.listen(this.port, () => {
                this.log(`Chat completion server running at http://localhost:${this.port} (Vendor: ${this.vendor})`);
                resolve();
            });
        });
    }

    /**
     * 停止聊天补全服务器
     */
    public stop(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.server) {
                resolve();
                return;
            }

            this.server.close(() => {
                this.log('Chat completion server stopped');
                this.server = null;
                resolve();
            });
        });
    }

    /**
     * 使用OpenAI库创建聊天补全
     */
    private async createChatCompletion(
        api_key: string,
        encryptedMessages: string,
        model: string,
        temperature?: number,
        topP?: number,
        n?: number,
        stream?: boolean,
        stop?: string | string[],
        maxTokens?: number,
        presencePenalty?: number,
        frequencyPenalty?: number,
        logitBias?: Record<string, number>,
        user?: string
    ): Promise<any> {
        try {
            // 初始化OpenAI客户端
            const openaiClient = new OpenAI({ 
                apiKey: api_key, // 这里的apiKey只是占位符
                baseURL: this.baseURL
            });

            // 生成UUID作为停止标记
            const uuid = uuidv4();
            const chunkSize = 8192; // 每块不超过8k
            
            // 检查输入长度
            if (!encryptedMessages) {
                throw new Error("消息数据不能为空");
            }
            
            this.log(`加密数据总长度: ${encryptedMessages.length}`);
            
            // 检查数据大小
            if (encryptedMessages.length > 524288) {
                throw new Error(`你的任务信息量过大，请尝试将任务拆分成子任务再进行处理`);
            }
            
            // 构建基本请求参数
            const baseRequestParams: any = {
                model,
                stream: false
            };
            
            // 添加可选参数
            if (temperature !== undefined) baseRequestParams.temperature = temperature;
            if (topP !== undefined) baseRequestParams.top_p = topP;
            if (n !== undefined) baseRequestParams.n = n;
            if (stop !== undefined) baseRequestParams.stop = stop;
            if (maxTokens !== undefined) baseRequestParams.max_tokens = maxTokens;
            if (presencePenalty !== undefined) baseRequestParams.presence_penalty = presencePenalty;
            if (frequencyPenalty !== undefined) baseRequestParams.frequency_penalty = frequencyPenalty;
            if (logitBias !== undefined) baseRequestParams.logit_bias = logitBias;
            if (user !== undefined) baseRequestParams.user = user;
            
            // 使用分块传输方式发送大型请求
            // 分割输入数据为多个块
            for (let i = 0; i < encryptedMessages.length; i += chunkSize) {
                const blockContent = encryptedMessages.substring(i, i + chunkSize);
                
                // 发送块数据
                const chunkRequestParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
                    ...baseRequestParams,
                    messages: [{ role: "system", content: blockContent }],
                    stream: true,
                    stop: uuid
                };
                
                this.log(`发送块 ${Math.floor(i/chunkSize) + 1}/${Math.ceil(encryptedMessages.length/chunkSize)}`);
                
                // 发送块数据但不处理响应
                try {
                    const response = await openaiClient.chat.completions.create(chunkRequestParams);
                    for await (const chunk of response) {
                        // 忽略中间响应
                    }
                } catch (error) {
                    this.log(`块传输错误，继续发送: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            
            // 发送结束标记
            const finalRequestParams = {
                ...baseRequestParams,
                messages: [{ role: "system", content: "#end" }],
                stream: stream,
                stop: uuid
            };
            
            this.log("发送结束标记");
            
            // 最终响应
            if (stream && typeof finalRequestParams[Symbol.asyncIterator] === 'function') {
                // 返回流式响应
                return openaiClient.chat.completions.create(finalRequestParams);
            } else {
                // 返回完整响应
                const finalResponse = await openaiClient.chat.completions.create(finalRequestParams);
                this.log(`Successfully created chat completion`);
                return finalResponse;
            }
        } catch (error) {
            this.log(`Error creating chat completion: ${error instanceof Error ? error.message : String(error)}`);
            
            // 尝试从错误响应中提取详细信息
            if (error instanceof OpenAI.APIError) {
                this.log(`Status: ${error.status}, Message: ${error.message}`);
                this.log(`Error details: ${JSON.stringify(error.error || {})}`);
            }
            
            throw error;
        }
    }

    /**
     * 记录消息到输出通道
     */
    private log(message: string): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] [${this.vendor}] ${message}`);
    }
}
