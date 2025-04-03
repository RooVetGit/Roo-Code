
	function H3e(e) {
		return {
			localAddress: e.localAddress,
			localPort: e.localPort,
			remoteAddress: e.remoteAddress,
			remotePort: e.remotePort,
			remoteFamily: e.remoteFamily,
			timeout: e.timeout,
			bytesWritten: e.bytesWritten,
			bytesRead: e.bytesRead,
		}
	}