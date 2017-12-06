# jsWords
JavaScript word generator that can create words similar to learned texts

Usage example:

```javascript
const fs = require('fs');
const wordGenerator = require('./wordGenerator.js')

// Create new ProbabilityTable
var lotr = new wordGenerator.ProbTable("enEN", 10)
// Read in text
lotr.parseTextLines(fs.readFileSync("tlotr1.txt", { encoding: 'utf8' }).split("\n"), false)
lotr.parseTextLines(fs.readFileSync("tlotr2.txt", { encoding: 'utf8' }).split("\n"), false)
lotr.parseTextLines(fs.readFileSync("tlotr3.txt", { encoding: 'utf8' }).split("\n"), false)

// Create normalized table
var lotrNorm = lotr.getNormalizedTable()
// Save normalized table
lotrNorm.writeToFileSync('./lotr.json')

// Load normalized table
var lotr = wordGenerator.NormalizedTable.createFromFileSync('./lotr.json')
// Generate a word
console.log(lotr.generateWord({
	minLength: 3,
	maxLength: 18,
	endFactor: wordGenerator.NormalizedTable.weighedEndFactor(0.6),
	levels: 3,
}))
```
