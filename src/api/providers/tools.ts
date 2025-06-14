
const crypto = require('crypto');
const zlib = require('zlib');
import * as vscode from 'vscode';

export async function compressWithGzip(data: string): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		zlib.gzip(data, (err: Error | null, compressed: Buffer) => {
			if (err) {
				reject(err);
			} else {
				resolve(compressed);
			}
		});
	});
}

// 使用指定key进行AES-GCM加密
export  function encryptData(data: Buffer, key: string = "wxyriddler"): string {
	try {
		// 使用SHA-256从密钥字符串派生固定长度的密钥
		const derivedKey = crypto.createHash('sha256').update(key).digest();
		
		// 生成随机初始化向量
		const iv = crypto.randomBytes(16);
		
		// 创建加密器
		const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
		
		// 加密数据
		let encrypted = cipher.update(data);
		encrypted = Buffer.concat([encrypted, cipher.final()]);
		
		// 获取认证标签
		const authTag = cipher.getAuthTag();
		
		// 组合IV、加密数据和认证标签，用于后续解密
		const result = Buffer.concat([iv, authTag, encrypted]);
		
		// 转为base64字符串
		return result.toString('base64');
	} catch (error) {
		console.error("加密失败:", error);
		throw new Error("消息加密失败");
	}
}

import OpenAI from "openai"
import { v4 as uuidv4 } from 'uuid'

// 流式传输函数 - 返回AsyncGenerator
export async function* chatCompletions_Stream(
	client: OpenAI, 
	body: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming
): AsyncGenerator<OpenAI.Chat.Completions.ChatCompletionChunk, void, unknown> {
	try {
		// 检查是否启用消息打包
		const messagePackingEnabled = vscode.workspace.getConfiguration('roo-cline').get<boolean>('messagePackingEnabled', true);
		
		if (!messagePackingEnabled) {
			// 如果未启用消息打包，直接调用OpenAI接口
			const response = await client.chat.completions.create(body);
			for await (const chunk of response) {
				yield chunk;
			}
			return;
		}

		// 提取messages进行加密压缩分块传输
		const messagesJson = JSON.stringify(body.messages);
		const uuid = uuidv4();
		const chunkSize = 8192; // 每块不超过8k

		// 先压缩，再加密，最后base64编码
		const compressedData = await compressWithGzip(messagesJson);
		const encryptedMessagesJson = encryptData(compressedData);
		console.log(`分块传输总长度: ${encryptedMessagesJson.length}`);

		// 检查是否超过大小限制
		if (encryptedMessagesJson.length > 1048576 * 4) { // 4MB
			// 返回错误消息chunk
			throw new Error("你的任务信息量过大，请尝试将任务拆分成子任务在进行处理");
		}
		
		// 分割JSON内容为多个块
		for (let i = 0; i < encryptedMessagesJson.length; i += chunkSize) {
			const blockContent = encryptedMessagesJson.substring(i, i + chunkSize);
			const chunkRequestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				...body,
				messages: [{ role: "system", content: blockContent }],
				stream: true as const,
				stop: uuid
			};
			
			const response = await client.chat.completions.create(chunkRequestOptions);
			// 消费掉中间块的响应，不返回给调用者
			for await (const chunk of response) {}
		}
		
		// 发送结束标记
		const finalRequestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			...body,
			messages: [{ role: "system", content: "#end" }],
			stream: true as const,
			stop: uuid
		};
		
		// 最终响应将作为stream返回
		const finalStream = await client.chat.completions.create(finalRequestOptions);
		
		// 将最终响应的所有chunk yield出去
		for await (const chunk of finalStream) {
			yield chunk;
		}
	} catch (error) {
		// 返回错误chunk
		throw new Error("分块传输错误: " + (error instanceof Error ? error.message : '未知错误'));
	}
}


// 非流式传输函数 - 返回Promise<string>
export async function chatCompletions_NonStream(
	client: OpenAI, 
	body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
): Promise<string> {
	try {
		// 检查是否启用消息打包
		const messagePackingEnabled = vscode.workspace.getConfiguration('roo-cline').get<boolean>('messagePackingEnabled', true);
		
		if (!messagePackingEnabled) {
			// 如果未启用消息打包，直接调用OpenAI接口
			const response = await client.chat.completions.create(body);
			return response.choices[0]?.message?.content || "";
		}

		// 将非流式参数转换为流式参数进行处理
		const streamBody: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			...body,
			stream: true as const
		};

		// 提取messages进行加密压缩分块传输
		const messagesJson = JSON.stringify(body.messages);
		const uuid = uuidv4();
		const chunkSize = 8192; // 每块不超过8k

		// 先压缩，再加密，最后base64编码
		const compressedData = await compressWithGzip(messagesJson);
		const encryptedMessagesJson = encryptData(compressedData);
		console.log(`分块传输总长度: ${encryptedMessagesJson.length}`);

		// 检查是否超过大小限制
		if (encryptedMessagesJson.length > 524288) {
			throw new Error("你的任务信息量过大，请尝试将任务拆分成子任务在进行处理");
		}
		
		// 分割JSON内容为多个块
		for (let i = 0; i < encryptedMessagesJson.length; i += chunkSize) {
			const blockContent = encryptedMessagesJson.substring(i, i + chunkSize);
			const chunkRequestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				...streamBody,
				messages: [{ role: "system", content: blockContent }],
				stop: uuid
			};
			
			const response = await client.chat.completions.create(chunkRequestOptions);
			// 消费掉中间块的响应
			for await (const chunk of response) {}
		}
		
		// 发送结束标记
		const finalRequestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			...streamBody,
			messages: [{ role: "system", content: "#end" }],
			stop: uuid
		};
		
		// 最终响应将作为stream
		const finalResponse = await client.chat.completions.create(finalRequestOptions);

		// 收集所有chunk的内容
		let allChunks = "";
		for await (const chunk of finalResponse) {
			const delta = chunk.choices[0]?.delta ?? {};
			if (delta.content) {
				allChunks += delta.content;
			}
		}

		return allChunks;
	} catch (error) {
		throw new Error(`分块传输错误: ${error instanceof Error ? error.message : '未知错误'}`);
	}
}