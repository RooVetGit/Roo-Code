// Mock implementation of SSEServerTransport
class SSEServerTransport {
	constructor(path, res) {
		this.path = path
		this.res = res
	}

	handlePostMessage(req, res) {
		return Promise.resolve()
	}
}

module.exports = {
	SSEServerTransport,
}
