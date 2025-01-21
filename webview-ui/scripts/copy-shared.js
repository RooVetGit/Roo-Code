const fs = require('fs-extra')
const path = require('path')

// 共有フォルダのパス
const srcDir = path.resolve(__dirname, '../../src/shared')
const destDir = path.resolve(__dirname, '../src/roo-shared')

// コピー実行
async function copySharedFiles() {
  try {
    // 既存のフォルダを削除
    await fs.remove(destDir)

    // フォルダをコピー
    await fs.copy(srcDir, destDir)

    console.log('Successfully copied src/shared to src/roo-shared')

    // ts/js ファイルのインポートパスを修正
    const files = await fs.readdir(destDir)
    for (const file of files) {
      if (file.endsWith('.ts') || file.endsWith('.js')) {
        const filePath = path.join(destDir, file)
        let content = await fs.readFile(filePath, 'utf8')

        // VSCode関連のインポートを修正
        content = content.replace(
          /from ['"]vscode['"]/g,
          'from "../__mocks__/vscode"'
        )

        // 相対パスのインポートを修正
        content = content.replace(
          /from ['"]\.\.\/shared\/(.*)['"]/g,
          'from "../roo-shared/$1"'
        )

        await fs.writeFile(filePath, content, 'utf8')
      }
    }

    console.log('Successfully updated import paths')
  } catch (err) {
    console.error('Error copying shared files:', err)
    process.exit(1)
  }
}

copySharedFiles()