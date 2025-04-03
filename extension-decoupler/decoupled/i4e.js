
	var { isUSVString: Nte, bufferToLowerCasedHeaderName: y4e } = Xt(),
		{ utf8DecodeBytes: C4e } = ga(),
		{ HTTP_TOKEN_CODEPOINTS: v4e, isomorphicDecode: Pte } = No(),
		{ isFileLike: E4e } = OO(),
		{ makeEntry: b4e } = ME(),
		BB = require("assert"),
		{ File: x4e } = require("buffer"),
		_4e = globalThis.File ?? x4e,
		w4e = Buffer.from('form-data; name="'),
		Lte = Buffer.from("; filename"),
		I4e = Buffer.from("--"),
		S4e = Buffer.from(`--\r
`)