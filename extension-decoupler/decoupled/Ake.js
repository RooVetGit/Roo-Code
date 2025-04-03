
function ake(e) {
	return {
		path: { rootPath: e.filePath.rootPath, relPath: e.filePath.relPath },
		originalCode: e.originalCode,
		modifiedCode: e.modifiedCode,
	}
}