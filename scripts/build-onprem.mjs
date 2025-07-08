#!/usr/bin/env node

/**
 * 온프레미스용 VSIX 빌드 스크립트
 * 
 * 1. 기본 package.json과 package.onprem.json 병합
 * 2. 온프레미스용 환경 변수 설정
 * 3. VSIX 패키징 실행
 * 4. 결과물을 bin/ 디렉토리에 저장
 */

import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const srcDir = path.join(rootDir, 'src')

class OnPremBuilder {
	constructor() {
		this.backupPath = path.join(srcDir, 'package.json.backup')
		this.packagePath = path.join(srcDir, 'package.json')
		this.onPremPath = path.join(srcDir, 'package.onprem.json')
		this.binDir = path.join(rootDir, 'bin')
	}

	async log(message, level = 'info') {
		const timestamp = new Date().toISOString()
		const prefix = {
			info: '📦',
			success: '✅',
			error: '❌',
			warn: '⚠️'
		}[level] || 'ℹ️'
		
		console.log(`${prefix} [${timestamp}] ${message}`)
	}

	async readJsonFile(filePath) {
		try {
			const content = await fs.readFile(filePath, 'utf-8')
			return JSON.parse(content)
		} catch (error) {
			throw new Error(`Failed to read ${filePath}: ${error.message}`)
		}
	}

	async writeJsonFile(filePath, data) {
		try {
			await fs.writeFile(filePath, JSON.stringify(data, null, '\t'), 'utf-8')
		} catch (error) {
			throw new Error(`Failed to write ${filePath}: ${error.message}`)
		}
	}

	async backupOriginalPackage() {
		await this.log('Backing up original package.json...')
		try {
			await fs.copyFile(this.packagePath, this.backupPath)
			await this.log('Package.json backed up successfully', 'success')
		} catch (error) {
			throw new Error(`Failed to backup package.json: ${error.message}`)
		}
	}

	async restoreOriginalPackage() {
		await this.log('Restoring original package.json...')
		try {
			await fs.copyFile(this.backupPath, this.packagePath)
			await fs.unlink(this.backupPath)
			await this.log('Package.json restored successfully', 'success')
		} catch (error) {
			await this.log(`Failed to restore package.json: ${error.message}`, 'error')
		}
	}

	async mergePackageConfigs() {
		await this.log('Merging package configurations...')
		
		const originalPackage = await this.readJsonFile(this.packagePath)
		const onPremOverrides = await this.readJsonFile(this.onPremPath)
		
		// 깊은 병합 (온프레미스 설정이 우선)
		const mergedPackage = {
			...originalPackage,
			...onPremOverrides,
			contributes: {
				...originalPackage.contributes,
				...onPremOverrides.contributes
			},
			scripts: {
				...originalPackage.scripts,
				...onPremOverrides.scripts
			}
		}

		// 온프레미스 특화 설정 추가
		mergedPackage.extensionPack = mergedPackage.extensionPack || []
		mergedPackage.extensionDependencies = mergedPackage.extensionDependencies || []
		
		// 환경 변수 기본값 설정
		if (!mergedPackage.contributes.configuration) {
			mergedPackage.contributes.configuration = {}
		}

		await this.writeJsonFile(this.packagePath, mergedPackage)
		await this.log(`Merged package created: ${mergedPackage.name}@${mergedPackage.version}`, 'success')
		
		return mergedPackage
	}

	async ensureBinDirectory() {
		try {
			await fs.access(this.binDir)
		} catch {
			await fs.mkdir(this.binDir, { recursive: true })
			await this.log('Created bin directory', 'success')
		}
	}

	async buildVSIX() {
		await this.log('Building VSIX package...')
		
		try {
			// 환경 변수 설정
			const env = {
				...process.env,
				ON_PREM: 'true',
				NODE_ENV: 'production'
			}

			// 1. 모든 의존성 빌드
			await this.log('Building dependencies...')
			execSync('pnpm build', {
				cwd: rootDir,
				stdio: 'inherit',
				env
			})

			// 2. 웹뷰 빌드
			await this.log('Building webview...')
			execSync('pnpm --filter @roo-code/vscode-webview build', {
				cwd: rootDir,
				stdio: 'inherit',
				env
			})

			// 3. 확장 번들링 
			await this.log('Bundling extension...')
			execSync('pnpm --filter roo-cline bundle', {
				cwd: rootDir,
				stdio: 'inherit',
				env
			})

			// 3. VSIX 패키징
			await this.log('Packaging VSIX...')
			execSync('npx vsce package --no-dependencies --out ../bin', {
				cwd: srcDir,
				stdio: 'inherit',
				env
			})

			await this.log('VSIX package built successfully!', 'success')
		} catch (error) {
			throw new Error(`VSIX build failed: ${error.message}`)
		}
	}

	async findGeneratedVSIX() {
		try {
			const files = await fs.readdir(this.binDir)
			const vsixFiles = files.filter(file => 
				file.endsWith('.vsix') && file.includes('onprem')
			)
			
			if (vsixFiles.length === 0) {
				throw new Error('No on-premises VSIX file found')
			}

			// 가장 최근 파일 반환
			const latestVsix = vsixFiles.sort().pop()
			return path.join(this.binDir, latestVsix)
		} catch (error) {
			throw new Error(`Failed to find generated VSIX: ${error.message}`)
		}
	}

	async validateVSIX(vsixPath) {
		await this.log('Validating VSIX package...')
		
		try {
			// VSIX 파일 크기 확인
			const stats = await fs.stat(vsixPath)
			const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
			
			if (stats.size < 1024 * 1024) { // 1MB 미만이면 문제 있을 가능성
				throw new Error(`VSIX file too small: ${sizeMB}MB`)
			}

			await this.log(`VSIX validation passed: ${path.basename(vsixPath)} (${sizeMB}MB)`, 'success')
			return true
		} catch (error) {
			await this.log(`VSIX validation failed: ${error.message}`, 'error')
			return false
		}
	}

	async generateBuildInfo(vsixPath, packageInfo) {
		const buildInfo = {
			buildDate: new Date().toISOString(),
			version: packageInfo.version,
			name: packageInfo.name,
			publisher: packageInfo.publisher,
			vsixPath: path.relative(rootDir, vsixPath),
			vsixSize: (await fs.stat(vsixPath)).size,
			environment: {
				nodeVersion: process.version,
				platform: process.platform,
				arch: process.arch
			},
			features: packageInfo.__onPremFeatures__ || {},
			config: packageInfo.__onPremConfig__ || {}
		}

		const buildInfoPath = path.join(this.binDir, 'build-info-onprem.json')
		await this.writeJsonFile(buildInfoPath, buildInfo)
		await this.log(`Build info saved: ${buildInfoPath}`, 'success')

		return buildInfo
	}

	async build() {
		const startTime = Date.now()

		try {
			await this.log('🚀 Starting On-Premises VSIX Build', 'info')
			await this.log('=====================================')

			// 1. 준비 작업
			await this.ensureBinDirectory()
			await this.backupOriginalPackage()

			// 2. 설정 병합
			const packageInfo = await this.mergePackageConfigs()

			// 3. VSIX 빌드
			await this.buildVSIX()

			// 4. 결과 검증
			const vsixPath = await this.findGeneratedVSIX()
			const isValid = await this.validateVSIX(vsixPath)

			if (!isValid) {
				throw new Error('VSIX validation failed')
			}

			// 5. 빌드 정보 생성
			const buildInfo = await this.generateBuildInfo(vsixPath, packageInfo)

			// 6. 완료 메시지
			const duration = ((Date.now() - startTime) / 1000).toFixed(2)
			await this.log('=====================================')
			await this.log(`🎉 On-Premises VSIX Build Completed!`, 'success')
			await this.log(`📦 Package: ${buildInfo.name}@${buildInfo.version}`)
			await this.log(`📁 Output: ${buildInfo.vsixPath}`)
			await this.log(`📊 Size: ${(buildInfo.vsixSize / 1024 / 1024).toFixed(2)}MB`)
			await this.log(`⏱️  Duration: ${duration}s`)
			await this.log('=====================================')

			// 설치 방법 안내
			await this.log('📋 Installation Instructions:')
			await this.log(`   code --install-extension ${buildInfo.vsixPath}`)
			await this.log(`   OR: Extensions > Install from VSIX > Select ${buildInfo.vsixPath}`)

			return {
				success: true,
				vsixPath,
				buildInfo
			}

		} catch (error) {
			await this.log(`Build failed: ${error.message}`, 'error')
			return {
				success: false,
				error: error.message
			}
		} finally {
			// 항상 원본 package.json 복원
			await this.restoreOriginalPackage()
		}
	}
}

// 메인 실행
async function main() {
	const builder = new OnPremBuilder()
	const result = await builder.build()

	if (!result.success) {
		console.error(`❌ Build failed: ${result.error}`)
		process.exit(1)
	}

	console.log('✅ Build completed successfully!')
	process.exit(0)
}

if (import.meta.url === `file://${__filename}`) {
	main().catch(error => {
		console.error('💥 Unexpected error:', error)
		process.exit(1)
	})
} 