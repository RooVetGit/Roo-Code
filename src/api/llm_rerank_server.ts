import * as http from 'http';
import * as vscode from 'vscode';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { compressWithGzip, encryptData } from './providers/tools';

export class RerankServer {
    private server: http.Server | null = null;
    private port: number;
    private outputChannel: vscode.OutputChannel;
    private baseURL: string;

    constructor(port: number = 3792, outputChannel?: vscode.OutputChannel) {
        this.port = port;
        this.outputChannel = outputChannel || vscode.window.createOutputChannel('Rerank Server');
        
        // 设置基础URL
        this.baseURL = 'https://riddler.mynatapp.cc/api/rerank/v1';
        this.log(`重排序服务初始化完成，基础URL: ${this.baseURL}`);
    }

    public start(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.server) {
                this.log('Server is already running');
                resolve();
                return;
            }

            this.server = http.createServer(async (req, res) => {
                let api_key = req.headers['authorization'] || '';
                if (typeof api_key === 'string') {
                    api_key = api_key.replace('Bearer ', '');
                } else {
                    throw new Error('API密钥无效');
                }
                
                if (req.method === 'POST' && req.url === '/v1/rerank') {
                    let body = '';
                    
                    req.on('data', (chunk) => {
                        body += chunk.toString();
                    });
                    
                    req.on('end', async () => {
                        try {
                            this.log(`Received rerank request: ${body.substring(0, 100)}...`);
                            
                            const requestData = JSON.parse(body);
                            
                            // 更新：重构输入数据结构
                            let query = requestData.query;
                            let documents = requestData.documents;
                            let model = requestData.model || 'BAAI/bge-reranker-v2-m3';
                            let top_n = requestData.top_n || 5;
                            let return_documents = requestData.return_documents ?? true;
                            let max_chunks_per_doc = requestData.max_chunks_per_doc || 1024;
                            let overlap_tokens = requestData.overlap_tokens || 80;
                            
                            if (!query || !documents) {
                                throw new Error('查询和文档都是必需的');
                            }

                            // 构建新的输入数据结构
                            const inputData = {
                                query,
                                documents,
                                top_n,
                                return_documents,
                                max_chunks_per_doc,
                                overlap_tokens
                            };
                            
                            let realInput = "";
                            try {
                                const compressedData = await compressWithGzip(JSON.stringify(inputData));
                                realInput = encryptData(compressedData);
                                this.log('成功压缩和加密input数据');
                            } catch (error) {
                                this.log(`输入加密失败: ${error instanceof Error ? error.message : String(error)}`);
                                throw new Error('输入加密失败');
                            }
                            
                            const response = await this.createRerank(
                                api_key,
                                realInput,
                                model
                            );
                            
                            const response_json = JSON.stringify(response);
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
                    res.writeHead(404);
                    res.end(JSON.stringify({ error: 'Not found' }));
                }
            });

            this.server.on('error', (err) => {
                this.log(`Server error: ${err.message}`);
                reject(err);
            });

            this.server.listen(this.port, () => {
                this.log(`Rerank server running at http://localhost:${this.port}`);
                resolve();
            });
        });
    }

    public stop(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.server) {
                resolve();
                return;
            }

            this.server.close(() => {
                this.log('Rerank server stopped');
                this.server = null;
                resolve();
            });
        });
    }

    private async createRerank(
        api_key: string,
        input?: string,
        model: string = 'BAAI/bge-reranker-v2-m3'
    ): Promise<any> {
        try {
            const uuid = uuidv4();
            const chunkSize = 8192;
            
            if (!input) {
                throw new Error("输入不能为空");
            }
            
            this.log(`加密数据总长度: ${input.length}`);
            
            if (input.length > 524288) {
                throw new Error(`你的任务信息量过大，请尝试将任务拆分成子任务再进行处理`);
            }
            
            const headers = {
                'Authorization': `Bearer ${api_key}`,
                'Content-Type': 'application/json',
            };

            // 分块发送数据
            for (let i = 0; i < input.length; i += chunkSize) {
                const blockContent = input.substring(i, i + chunkSize);
                
                const chunkRequestData = {
                    model,
                    input: blockContent,
                    stop: uuid
                };
                
                this.log(`发送块 ${Math.floor(i/chunkSize) + 1}/${Math.ceil(input.length/chunkSize)}`);
                
                try {
                    await axios.post(`${this.baseURL}/rerank`, chunkRequestData, { headers });
                } catch (error) {
                    if (axios.isAxiosError(error)) {
                        this.log(`块传输错误，继续发送: ${error.message}`);
                        if (error.response) {
                            this.log(`响应状态: ${error.response.status}`);
                            this.log(`错误详情: ${JSON.stringify(error.response.data)}`);
                        }
                    }
                }
            }
            
            // 更新：发送结束标记时包含模型信息
            const finalRequestData = {
                model,
                input: "#end",
                stop: uuid
            };
            
            this.log("发送结束标记");
            
            const finalResponse = await axios.post(`${this.baseURL}/rerank`, finalRequestData, { headers });
            
            // 处理响应
            if (finalResponse.data.error) {
                throw new Error(finalResponse.data.error);
            }
            
            this.log(`重排序成功完成`);
            return finalResponse.data;
            
        } catch (error) {
            this.log(`Error creating rerank: ${error instanceof Error ? error.message : String(error)}`);
            
            if (axios.isAxiosError(error) && error.response) {
                this.log(`Status: ${error.response.status}`);
                this.log(`Error details: ${JSON.stringify(error.response.data)}`);
            }
            
            throw error;
        }
    }

    private log(message: string): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
}
