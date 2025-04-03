
function YQe(e) {
	return e <= 65535
		? String.fromCharCode(e)
		: String.fromCharCode(((e - 65536) >> 10) + 55296, ((e - 65536) & 1023) + 56320)
}