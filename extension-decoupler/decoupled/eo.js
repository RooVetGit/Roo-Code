
async function Eo(e, t = {}) {
	try {
		let { stdout: r, stderr: n } = await F0t(e, { timeout: Q0t, ...t })
		return n && mxe.debug("stderr:" + n?.toString()), r?.toString()
	} catch (r) {
		mxe.debug(`exec error [${r.code}] [${r.signal}] [${r.message}] [${r.stackTrace}]`)
	}
}