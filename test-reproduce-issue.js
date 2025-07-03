const fs = require("fs")
const path = require("path")

// Create test directory structure to reproduce the issue
const testDir = "./test-issue-5301"

// Clean up if exists
if (fs.existsSync(testDir)) {
	fs.rmSync(testDir, { recursive: true })
}

// Create the test structure
fs.mkdirSync(testDir)
fs.mkdirSync(path.join(testDir, "a"))
fs.mkdirSync(path.join(testDir, "b"))

// Create 200 files in folder 'a'
for (let i = 1; i <= 200; i++) {
	fs.writeFileSync(path.join(testDir, "a", `file${i.toString().padStart(3, "0")}.txt`), `Content of file ${i}`)
}

// Create some files in folder 'b'
fs.writeFileSync(path.join(testDir, "b", "important-file1.txt"), "Important content 1")
fs.writeFileSync(path.join(testDir, "b", "important-file2.txt"), "Important content 2")
fs.writeFileSync(path.join(testDir, "b", "important-file3.txt"), "Important content 3")

console.log("Test directory structure created:")
console.log(`- ${testDir}/a/ contains 200 files`)
console.log(`- ${testDir}/b/ contains 3 files`)
console.log("Total: 203 files + 2 directories")
