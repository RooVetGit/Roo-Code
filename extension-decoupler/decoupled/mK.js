
var Mk = class extends hi {
	constructor(t, r, n, i) {
		super(t, r, n, { ...i }), this.addDisposable(this.onModifiedUpdated(() => void this.writeDocumentToFile()))
	}
	async writeDocumentToFile() {
		await Do().writeFile(this.filePath, this.modifiedCode)
	}
}