
const crypto = require('crypto');
const zlib = require('zlib');

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