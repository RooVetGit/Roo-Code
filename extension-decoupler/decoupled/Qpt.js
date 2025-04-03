
function qpt(e, t) {
	return (r) => {
		t("[ERROR] child process exception %o", r), e.push(Buffer.from(String(r.stack), "ascii"))
	}
}