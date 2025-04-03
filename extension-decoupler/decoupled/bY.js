
function By(e) {
	return e.map((t) =>
		yut(t.blobName, t.pathName, t.origStart, t.origStart + t.origLength, t.text, t.uploaded, t.expectedBlobName),
	)
}