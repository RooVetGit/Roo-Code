
	var o2e = 1,
		a2e = 3,
		l2e = 4,
		c2e = 5,
		u2e = 7,
		d2e = 8,
		f2e = 9,
		h2e = 11,
		g2e = 12,
		p2e = 13,
		A2e = 14,
		m2e = 15,
		y2e = 17,
		C2e = 18,
		v2e = 19,
		E2e = 20,
		b2e = 21,
		x2e = 22,
		_2e = 23,
		w2e = 24,
		I2e = 25,
		S2e = [
			null,
			"INDEX_SIZE_ERR",
			null,
			"HIERARCHY_REQUEST_ERR",
			"WRONG_DOCUMENT_ERR",
			"INVALID_CHARACTER_ERR",
			null,
			"NO_MODIFICATION_ALLOWED_ERR",
			"NOT_FOUND_ERR",
			"NOT_SUPPORTED_ERR",
			"INUSE_ATTRIBUTE_ERR",
			"INVALID_STATE_ERR",
			"SYNTAX_ERR",
			"INVALID_MODIFICATION_ERR",
			"NAMESPACE_ERR",
			"INVALID_ACCESS_ERR",
			null,
			"TYPE_MISMATCH_ERR",
			"SECURITY_ERR",
			"NETWORK_ERR",
			"ABORT_ERR",
			"URL_MISMATCH_ERR",
			"QUOTA_EXCEEDED_ERR",
			"TIMEOUT_ERR",
			"INVALID_NODE_TYPE_ERR",
			"DATA_CLONE_ERR",
		],
		B2e = [
			null,
			"INDEX_SIZE_ERR (1): the index is not in the allowed range",
			null,
			"HIERARCHY_REQUEST_ERR (3): the operation would yield an incorrect nodes model",
			"WRONG_DOCUMENT_ERR (4): the object is in the wrong Document, a call to importNode is required",
			"INVALID_CHARACTER_ERR (5): the string contains invalid characters",
			null,
			"NO_MODIFICATION_ALLOWED_ERR (7): the object can not be modified",
			"NOT_FOUND_ERR (8): the object can not be found here",
			"NOT_SUPPORTED_ERR (9): this operation is not supported",
			"INUSE_ATTRIBUTE_ERR (10): setAttributeNode called on owned Attribute",
			"INVALID_STATE_ERR (11): the object is in an invalid state",
			"SYNTAX_ERR (12): the string did not match the expected pattern",
			"INVALID_MODIFICATION_ERR (13): the object can not be modified in this way",
			"NAMESPACE_ERR (14): the operation is not allowed by Namespaces in XML",
			"INVALID_ACCESS_ERR (15): the object does not support the operation or argument",
			null,
			"TYPE_MISMATCH_ERR (17): the type of the object does not match the expected type",
			"SECURITY_ERR (18): the operation is insecure",
			"NETWORK_ERR (19): a network error occurred",
			"ABORT_ERR (20): the user aborted an operation",
			"URL_MISMATCH_ERR (21): the given URL does not match another URL",
			"QUOTA_EXCEEDED_ERR (22): the quota has been exceeded",
			"TIMEOUT_ERR (23): a timeout occurred",
			"INVALID_NODE_TYPE_ERR (24): the supplied node is invalid or has an invalid ancestor for this operation",
			"DATA_CLONE_ERR (25): the object can not be cloned.",
		],
		KK = {
			INDEX_SIZE_ERR: o2e,
			DOMSTRING_SIZE_ERR: 2,
			HIERARCHY_REQUEST_ERR: a2e,
			WRONG_DOCUMENT_ERR: l2e,
			INVALID_CHARACTER_ERR: c2e,
			NO_DATA_ALLOWED_ERR: 6,
			NO_MODIFICATION_ALLOWED_ERR: u2e,
			NOT_FOUND_ERR: d2e,
			NOT_SUPPORTED_ERR: f2e,
			INUSE_ATTRIBUTE_ERR: 10,
			INVALID_STATE_ERR: h2e,
			SYNTAX_ERR: g2e,
			INVALID_MODIFICATION_ERR: p2e,
			NAMESPACE_ERR: A2e,
			INVALID_ACCESS_ERR: m2e,
			VALIDATION_ERR: 16,
			TYPE_MISMATCH_ERR: y2e,
			SECURITY_ERR: C2e,
			NETWORK_ERR: v2e,
			ABORT_ERR: E2e,
			URL_MISMATCH_ERR: b2e,
			QUOTA_EXCEEDED_ERR: x2e,
			TIMEOUT_ERR: _2e,
			INVALID_NODE_TYPE_ERR: w2e,
			DATA_CLONE_ERR: I2e,
		}