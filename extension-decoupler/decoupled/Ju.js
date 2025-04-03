
	var Vn = class extends Error {
			constructor(t) {
				super(t), (this.name = "UndiciError"), (this.code = "UND_ERR")
			}
		},
		VU = class extends Vn {
			constructor(t) {
				super(t),
					(this.name = "ConnectTimeoutError"),
					(this.message = t || "Connect Timeout Error"),
					(this.code = "UND_ERR_CONNECT_TIMEOUT")
			}
		},
		HU = class extends Vn {
			constructor(t) {
				super(t),
					(this.name = "HeadersTimeoutError"),
					(this.message = t || "Headers Timeout Error"),
					(this.code = "UND_ERR_HEADERS_TIMEOUT")
			}
		},
		WU = class extends Vn {
			constructor(t) {
				super(t),
					(this.name = "HeadersOverflowError"),
					(this.message = t || "Headers Overflow Error"),
					(this.code = "UND_ERR_HEADERS_OVERFLOW")
			}
		},
		GU = class extends Vn {
			constructor(t) {
				super(t),
					(this.name = "BodyTimeoutError"),
					(this.message = t || "Body Timeout Error"),
					(this.code = "UND_ERR_BODY_TIMEOUT")
			}
		},
		$U = class extends Vn {
			constructor(t, r, n, i) {
				super(t),
					(this.name = "ResponseStatusCodeError"),
					(this.message = t || "Response Status Code Error"),
					(this.code = "UND_ERR_RESPONSE_STATUS_CODE"),
					(this.body = i),
					(this.status = r),
					(this.statusCode = r),
					(this.headers = n)
			}
		},
		YU = class extends Vn {
			constructor(t) {
				super(t),
					(this.name = "InvalidArgumentError"),
					(this.message = t || "Invalid Argument Error"),
					(this.code = "UND_ERR_INVALID_ARG")
			}
		},
		KU = class extends Vn {
			constructor(t) {
				super(t),
					(this.name = "InvalidReturnValueError"),
					(this.message = t || "Invalid Return Value Error"),
					(this.code = "UND_ERR_INVALID_RETURN_VALUE")
			}
		},
		oB = class extends Vn {
			constructor(t) {
				super(t), (this.name = "AbortError"), (this.message = t || "The operation was aborted")
			}
		},
		JU = class extends oB {
			constructor(t) {
				super(t),
					(this.name = "AbortError"),
					(this.message = t || "Request aborted"),
					(this.code = "UND_ERR_ABORTED")
			}
		},
		zU = class extends Vn {
			constructor(t) {
				super(t),
					(this.name = "InformationalError"),
					(this.message = t || "Request information"),
					(this.code = "UND_ERR_INFO")
			}
		},
		jU = class extends Vn {
			constructor(t) {
				super(t),
					(this.name = "RequestContentLengthMismatchError"),
					(this.message = t || "Request body length does not match content-length header"),
					(this.code = "UND_ERR_REQ_CONTENT_LENGTH_MISMATCH")
			}
		},
		ZU = class extends Vn {
			constructor(t) {
				super(t),
					(this.name = "ResponseContentLengthMismatchError"),
					(this.message = t || "Response body length does not match content-length header"),
					(this.code = "UND_ERR_RES_CONTENT_LENGTH_MISMATCH")
			}
		},
		XU = class extends Vn {
			constructor(t) {
				super(t),
					(this.name = "ClientDestroyedError"),
					(this.message = t || "The client is destroyed"),
					(this.code = "UND_ERR_DESTROYED")
			}
		},
		eO = class extends Vn {
			constructor(t) {
				super(t),
					(this.name = "ClientClosedError"),
					(this.message = t || "The client is closed"),
					(this.code = "UND_ERR_CLOSED")
			}
		},
		tO = class extends Vn {
			constructor(t, r) {
				super(t),
					(this.name = "SocketError"),
					(this.message = t || "Socket error"),
					(this.code = "UND_ERR_SOCKET"),
					(this.socket = r)
			}
		},
		rO = class extends Vn {
			constructor(t) {
				super(t),
					(this.name = "NotSupportedError"),
					(this.message = t || "Not supported error"),
					(this.code = "UND_ERR_NOT_SUPPORTED")
			}
		},
		nO = class extends Vn {
			constructor(t) {
				super(t),
					(this.name = "MissingUpstreamError"),
					(this.message = t || "No upstream has been added to the BalancedPool"),
					(this.code = "UND_ERR_BPL_MISSING_UPSTREAM")
			}
		},
		iO = class extends Error {
			constructor(t, r, n) {
				super(t),
					(this.name = "HTTPParserError"),
					(this.code = r ? `HPE_${r}` : void 0),
					(this.data = n ? n.toString() : void 0)
			}
		},
		sO = class extends Vn {
			constructor(t) {
				super(t),
					(this.name = "ResponseExceededMaxSizeError"),
					(this.message = t || "Response content exceeded max size"),
					(this.code = "UND_ERR_RES_EXCEEDED_MAX_SIZE")
			}
		},
		oO = class extends Vn {
			constructor(t, r, { headers: n, data: i }) {
				super(t),
					(this.name = "RequestRetryError"),
					(this.message = t || "Request retry error"),
					(this.code = "UND_ERR_REQ_RETRY"),
					(this.statusCode = r),
					(this.data = i),
					(this.headers = n)
			}
		},
		aO = class extends Vn {
			constructor(t, r, { headers: n, data: i }) {
				super(t),
					(this.name = "ResponseError"),
					(this.message = t || "Response error"),
					(this.code = "UND_ERR_RESPONSE"),
					(this.statusCode = r),
					(this.data = i),
					(this.headers = n)
			}
		},
		lO = class extends Vn {
			constructor(t, r, n) {
				super(r, { cause: t, ...(n ?? {}) }),
					(this.name = "SecureProxyConnectionError"),
					(this.message = r || "Secure Proxy Connection failed"),
					(this.code = "UND_ERR_PRX_TLS"),
					(this.cause = t)
			}
		}