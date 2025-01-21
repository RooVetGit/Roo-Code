const path = require('path')
const { override, addWebpackAlias } = require('customize-cra')

module.exports = override(
  addWebpackAlias({
    // VS Code拡張の共有コードへのエイリアス
    'roo-shared': path.resolve(__dirname, '..', 'src', 'shared'),
    // VSCode APIのモック
    'vscode': path.resolve(__dirname, 'src', '__mocks__', 'vscode.ts'),
  }),
  // PDF/DOCXパーサーなどNode.js専用モジュールを除外
  (config) => {
    config.externals = {
      'pdf-parse': 'pdf-parse',
      'mammoth': 'mammoth',
      'isbinaryfile': 'isbinaryfile'
    }
    return config
  }
)
