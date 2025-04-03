
var eM = class e {
	constructor(t) {
		this._extensionContext = t
	}
	static assetSubdirectory = "augment-user-assets"
	async saveAsset(t, r) {
		let n = await this._getUri(t)
		await ame(n.fsPath, r)
	}
	async loadAsset(t) {
		let r = await this._getUri(t)
		try {
			return await Ak(r.fsPath)
		} catch {
			return
		}
	}
	async deleteAsset(t) {
		let r = await this._getUri(t)
		return await cme(r.fsPath)
	}
	async _getUri(t) {
		let r = this._extensionContext.storageUri ?? this._extensionContext.globalStorageUri,
			n = $t(r.fsPath, e.assetSubdirectory)
		;(await $d(n)) || (await Su(n))
		let i = _c(t)
		if (i) {
			let s = $t(n, i)
			;(await $d(s)) || (await Su(s))
		}
		return oCe.Uri.file($t(n, t))
	}
}