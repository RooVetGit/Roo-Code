// This script removes symlinks or files for shared items (e.g. LICENSE, README.md, locales)
// from the plugins/vscode directory after packaging the VSCode extension.

const fs = require("fs")
const path = require("path")

const TARGET_DIR = path.resolve(__dirname, "../")

const SHARED_ITEMS = ["LICENSE", "README.md", "CHANGELOG.md", "PRIVACY.md", "locales", "assets"]

for (const item of SHARED_ITEMS) {
	const dst = path.join(TARGET_DIR, path.basename(item))
	if (fs.existsSync(dst)) {
		try {
			// Only remove if it's a symlink or a file/directory created by prepack
			const stat = fs.lstatSync(dst)
			if (stat.isSymbolicLink() || stat.isFile() || stat.isDirectory()) {
				fs.rmSync(dst, { recursive: true, force: true })
				console.log(`Removed ${dst}`)
			}
		} catch (e) {
			// Ignore errors
		}
	}
}
