import * as http from 'http';
import * as vscode from 'vscode';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { compressWithGzip, encryptData } from './providers/tools';

export class EmbeddingServer {
    private server: http.Server | null = null;
    private port: number;
    private outputChannel: vscode.OutputChannel;
    private baseURL: string;

    constructor(port: number = 3791, outputChannel?: vscode.OutputChannel) {
        this.port = port;
        this.outputChannel = outputChannel || vscode.window.createOutputChannel('Embedding Server');
        
        // 设置基础URL
        this.baseURL = 'https://riddler.mynatapp.cc/api/embedding/v1';
        this.log(`嵌入服务初始化完成，基础URL: ${this.baseURL}`);
    }

    /**
     * 启动嵌入服务器
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
                let api_key = req.headers['authorization'] || '';
                if (typeof api_key === 'string') {
                    api_key = api_key.replace('Bearer ', '');
                } else {
                    throw new Error('API密钥无效');
                }
                
                if (req.method === 'POST' && req.url === '/v1/embeddings') {
                    let body = '';
                    
                    req.on('data', (chunk) => {
                        body += chunk.toString();
                    });
                    
                    req.on('end', async () => {
                        try {
                            // 记录传入请求
                            this.log(`Received embedding request: ${body.substring(0, 100)}...`);
                            
                            // 解析原始请求数据
                            const requestData = JSON.parse(body);
                            
                            // 提取并处理输入数据
                            let processedInput: string | string[] | undefined = requestData.input;
                            let model = requestData.model || '';
                            let encodingFormat = requestData.encoding_format || 'float';
                            let user = requestData.user;
                            let dimensions = requestData.dimensions;
                            let realInput = ""
                            
                            // 处理并加密输入数据
                            if (processedInput) {
                                // 处理字符串格式的输入
                                const messagesJson = JSON.stringify(processedInput);
                                try {
                                    const compressedData = await compressWithGzip(messagesJson);
                                    realInput = encryptData(compressedData);
                                    this.log('成功压缩和加密input字符串数据');
                                } catch (error) {
                                    this.log(`输入字符串加密失败: ${error instanceof Error ? error.message : String(error)}`);
                                    throw new Error('输入字符串加密失败');
                                }
                            } else {
                                throw new Error('输入是必需的');
                            }
                            
                            // 使用OpenAI客户端发送请求
                            const response = await this.createEmbeddings(
                                api_key,
                                realInput, 
                                model, 
                                encodingFormat,
                                dimensions,
                                user
                            );
                            
                            // 设置响应头
                            const response_json = JSON.stringify(response)
                            res.setHeader('Content-Type', 'application/json');
                            res.writeHead(200);
                            res.end(response_json);
                        } catch (error) {
                            this.log(`Error processing request: ${error instanceof Error ? error.message : String(error)}`);
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: 'Internal server error' }));
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
                this.log(`Embedding server running at http://localhost:${this.port}`);
                resolve();
            });
        });
    }

    /**
     * 停止嵌入服务器
     */
    public stop(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.server) {
                resolve();
                return;
            }

            this.server.close(() => {
                this.log('Embedding server stopped');
                this.server = null;
                resolve();
            });
        });
    }

    /**
     * 使用OpenAI库创建嵌入
     * @param api_key API密钥
     * @param input 要处理的输入文本(已加密)
     * @param model 要使用的模型
     * @param encodingFormat 编码格式
     * @param dimensions 嵌入维度(可选)
     * @param user 用户标识(可选)
     */
    private async createEmbeddings(
        api_key: string,
        input?: string, 
        model: string = 'text-embedding-ada-002',
        encodingFormat: string = 'float',
        dimensions?: number,
        user?: string
    ): Promise<any> {
        try {
            // 初始化OpenAI客户端
            const openaiClient = new OpenAI({ 
                apiKey: api_key,
                baseURL: this.baseURL
            });
            
            // 生成UUID作为停止标记
            const uuid = uuidv4();
            const chunkSize = 8192; // 每块不超过8k
            
            // 检查输入长度
            if (!input) {
                throw new Error("输入不能为空");
            }
            
            this.log(`加密数据总长度: ${input.length}`);
            
            // 检查数据大小
            if (input.length > 524288) {
                throw new Error(`你的任务信息量过大，请尝试将任务拆分成子任务再进行处理`);
            }
            
            // 构建基本请求参数
            const baseRequestParams: any = {
                model,
                encoding_format: encodingFormat,
            };
            
            // 添加可选参数
            if (dimensions) baseRequestParams.dimensions = dimensions;
            if (user) baseRequestParams.user = user;
            
            // 分割输入数据为多个块
            for (let i = 0; i < input.length; i += chunkSize) {
                const blockContent = input.substring(i, i + chunkSize);
                
                // 发送块数据
                const chunkRequestParams: OpenAI.EmbeddingCreateParams = {
                    ...baseRequestParams,
                    input: blockContent,
                    stop: uuid
                };
                
                this.log(`发送块 ${Math.floor(i/chunkSize) + 1}/${Math.ceil(input.length/chunkSize)}`);
                
                // 发送块数据但不处理响应
                try {
                    const response = await openaiClient.embeddings.create(chunkRequestParams);
                    // 不处理中间响应
                } catch (error) {
                    this.log(`块传输错误，继续发送: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            
            // 发送结束标记
            const finalRequestParams: OpenAI.EmbeddingCreateParams = {
                ...baseRequestParams,
                input: "#end",
                stop: uuid
            };
            
            this.log("发送结束标记");
            
            // 最终响应
            const finalResponse = await openaiClient.embeddings.create(finalRequestParams);
            this.log(`Successfully created embeddings`);
            return finalResponse;
            
        } catch (error) {
            this.log(`Error creating embeddings: ${error instanceof Error ? error.message : String(error)}`);
            
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
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
}
