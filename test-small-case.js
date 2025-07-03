const fs = require("fs")
const path = require("path")

// Create a smaller test case to verify the fix
const testDir = "./test-small-case"

// Clean up if exists
if (fs.existsSync(testDir)) {
	fs.rmSync(testDir, { recursive: true })
}

// Create the test structure
fs.mkdirSync(testDir)
fs.mkdirSync(path.join(testDir, "a"))
fs.mkdirSync(path.join(testDir, "b"))

// Create 10 files in folder 'a'
for (let i = 1; i <= 10; i++) {
	fs.writeFileSync(path.join(testDir, "a", `file${i.toString().padStart(2, "0")}.txt`), `Content of file ${i}`)
}

// Create 3 files in folder 'b'
fs.writeFileSync(path.join(testDir, "b", "important-file1.txt"), "Important content 1")
fs.writeFileSync(path.join(testDir, "b", "important-file2.txt"), "Important content 2")
fs.writeFileSync(path.join(testDir, "b", "important-file3.txt"), "Important content 3")

console.log("Small test directory structure created:")
console.log(`- ${testDir}/a/ contains 10 files`)
console.log(`- ${testDir}/b/ contains 3 files`)
console.log("Total: 13 files + 2 directories")
