const fs = require('fs');

/**
 * Collection of tools to minify a NormalizedTable to save space when saving as file
 */
var JSONMinify = {
	language: 'g',
	levels: 'l',
	probabilities: 'p',
	next: 'n',
	endProbability: 'e',
	value: 'v',
	char: 'c',
	minify: function(key, value) {
		if (value instanceof NormalizedTable || value.hasOwnProperty('char')) {
			var result = {}
			for (key in value)
				result[JSONMinify[key]] = value[key]
			return result
		} else return value
	}
}

/**
 * Collection of tools for using a specific language charset to generate the words
 */
var Language = {
    default: 'enEN',
    isValid: (char, language) => Language[language].includes(char),
    createCharTrail: (text, language) => {
    	var result = []
		for (var char of text) {
			result.push(Language[language].indexOf(char.toLowerCase()))
		}
		return result
    },
    enEN: 'abcdefghijklmnopqrstuvwqxyz',
    enEN_dashed: 'abcdefghijklmnopqrstuvwqxyz-',
    deDE: 'abcdefghijklmnopqrstuvwqxyzäöüß',
    deDE_dashed: 'abcdefghijklmnopqrstuvwqxyzäöüß-',
    frFR: "abcdefghijklmnopqrstuvwqyz'àéèìòùçâêîôûäëïüœ",
    frFR_dashed: "abcdefghijklmnopqrstuvwqyz'àéèìòùçâêîôûäëïüœ-"
}

/**
 * Full size Probability Tabel to store and change charTrail probabilities.
 * Dynamically filled with new Probabilities when probabilities are added
 * @param {string} language Language ID representing a charset
 * @param {number} levels Maximum length of char trail to take into account
 * @constructor
 */
function ProbTable(language = Language.default, levels = 3) {
	this.language = language
	this.levels = levels
	this.total = 0
	this.probabilities = []
	this.endProbability = []
	this.next = []
	for (var i = 0; i < Language[language].length+1; i++) this.probabilities[i] = 0
	for (var i = 0; i < levels; i++) this.endProbability[i] = 0
}
/**
 * Increments the probability for the chartrail
 * @param {[Number]} charTrail Array of indexes of the language charset - should be created with Language.createCharTrail
 */
ProbTable.prototype.incrementCharTrail = function(charTrail) {
	var currentTable = this
	for (var charID of charTrail) {
		currentTable.probabilities[charID]++
		if (currentTable.next[charID] == undefined)
			currentTable.next[charID] = new ProbTable(currentTable.language, currentTable.levels)
		currentTable = currentTable.next[charID]
	}
}
/**
 * Increments the end word probability for the chartrail
 * backtracks to allow for less depth word generation
 * @param {*} charTrail Array of indexes of the language charset - should be created with Language.createCharTrail
 * @param {*} backTrack Amount already backtracked. Only for calling recoursively
 */
ProbTable.prototype.incrementEndWord = function(charTrail, backTrack = 0) {
	var currentTable = this
	for (var i in charTrail) {
		if (currentTable.next[charTrail[i]] != undefined) currentTable = currentTable.next[charTrail[i]]
		else break
	}
	for (var i = 0; i < this.levels - backTrack; i++)
		currentTable.endProbability[i]++
	if(charTrail.length > 1) this.incrementEndWord(charTrail.slice(1), charTrail.length-2)
}
/**
 * Read in probabilities from Text lines
 * @param {[String]} lines Text lines
 * @param {Boolean} capitals Wether to only parse words starting with a capital
 */
ProbTable.prototype.parseTextLines = function(lines, capitals) {
    var charTrail = ""
    var words = 0;
    for (var line of lines) {
    	var firstChar = true
        for (char of line) {
            if (Language.isValid(char.toLowerCase(), this.language) && (!capitals || (firstChar && char.toUpperCase() == char) || !firstChar)) {
            	firstChar = false
                charTrail += char
                if (charTrail.length > this.levels) charTrail = charTrail.slice(1)
                this.incrementCharTrail(Language.createCharTrail(charTrail, this.language))
            } else if (charTrail.length > 0) {
            	this.incrementEndWord(Language.createCharTrail(charTrail, this.language))
            	firstChar = true
                charTrail = ""
                words++;
            }
        }
    }
    console.log("Learned " + words + " words.")
}
/**
 * Create a smaller normalized table for actual use
 */
ProbTable.prototype.getNormalizedTable = function() {
	var normalizedTable = new NormalizedTable(this.language, this.levels)
	this.total = 0
	for (prob of this.probabilities) this.total += prob
	for (i in this.endProbability) normalizedTable.endProbability[i] = this.endProbability[i] / (this.total + this.endProbability[i])
	for (var i in this.probabilities) {
		if (this.probabilities[i] > 0) {
			normalizedTable.probabilities.push({
				value: this.probabilities[i] / this.total,
				char: Language[this.language][i]
			})
			if (this.next[i] != undefined)
				normalizedTable.next.push(this.next[i].getNormalizedTable())
		}
	}

	return normalizedTable
}

/**
 * Smaller Size probability tabel storing probabilities normalized to 1
 * Should not be changed, only for generating words
 * @param {String} language language Language ID representing a charset
 * @param {Number} levels Maximum length of char trail to take into account
 * @constructor
 */
function NormalizedTable(language, levels) {
	this.language = language
	this.levels = levels
	this.probabilities = []
	this.endProbability = []
	this.next = []
}
/**
 * Get child probability table by char
 * @param {String} char char to get child probability table of
 */
NormalizedTable.prototype.getChildByChar = function(char) {
	if (char == "") return this
	for (var i in this.probabilities) 
		if (this.probabilities[i].char === char) return this.next[i]
	return null
}
/**
 * Get child probability table by char trail
 * @param {string} charTrail char trail to get child probability table of
 */
NormalizedTable.prototype.getChildByCharTrail = function(charTrail) {
	if (charTrail.length < 1) return this
	else if (charTrail.length == 1) return this.getChildByChar(charTrail)
	else {
		var nextCharChild = this.getChildByChar(charTrail.charAt(0))
		if (nextCharChild == null) return null
		else return nextCharChild.getChildByCharTrail(charTrail.slice(1))
	}
}
/**
 * Get the corresponding char from a random Number
 * @param {Number} prob Number between 0 and 1
 */
NormalizedTable.prototype.getCharFromProb = function(prob) {
	var keys = this.probabilities.keys()
	var currentKey = keys.next()
	var i = currentKey.value
	var total = this.probabilities[i].value
	while (prob > total && !(currentKey = keys.next()).done) {
		i = currentKey.value
		total += this.probabilities[i].value
	}
	return this.probabilities[i].char
}
/**
 * 
 * @param {Object} options Options to generate word
 * @param {Number} options.minLength minimum Word Length
 * @param {Number} options.maxLength maximum Word Length
 * @param {Function} options.endFactor end factor function takes (prob, value, length, minLength, maxLength)
 * @param {Number} options.levels Maximum length of char trail to take into account
 * @param {Number} options.endBacktrack additional levels to backtrack when ending word
 * @param {Number} options.endProbIndex overwrite levels to backtrack when ending word
 */
NormalizedTable.prototype.generateWord = function(options) {
	var minLength = options.minLength
	var maxLength = options.maxLength
	var endFactor = NormalizedTable.weighedEndFactor(1)
	if (options.endFactor != undefined) endFactor = options.endFactor
	var levels = this.levels
	if (options.levels != undefined) {
		if (options.levels < this.levels) levels = options.levels
	}
	var endBacktrack = levels - 1
	if (options.endBacktrack != undefined) {
		if (options.endBacktrack > 0 && options.endBacktrack < this.levels - levels) endBacktrack += options.endBacktrack
	}
	if (options.endProbIndex != undefined) endBacktrack = options.endProbIndex

    var rnd = Math.random()
    var char = this.getCharFromProb(rnd)
    var word = ""
    var charTrail = ""
    for (var i = 0; i < maxLength; i++) {
        word += char
        charTrail += char;
        if (charTrail.length > levels) charTrail = charTrail.slice(1)
    
        rnd = Math.random()
    	var tempProbTable = this.getChildByCharTrail(charTrail)
    	while (tempProbTable == null || tempProbTable.probabilities.length == 0) {
    		charTrail = charTrail.slice(1)
    		tempProbTable = this.getChildByCharTrail(charTrail)
    	}
    	if (word.length >= minLength && endFactor(tempProbTable.endProbability[endBacktrack], rnd, word.length, minLength, maxLength)) break
        char = tempProbTable.getCharFromProb(rnd)
    }
    return word.charAt(0).toUpperCase() + word.slice(1)
}
/**
 * Returns an end factor function based on cosine and with the maximum value of the given weight
 * @param {Number} weight Multiplier for the end factor function
 */
NormalizedTable.weighedEndFactor = function(weight) {
	return function(prob, value, length, minLength, maxLength) {
		return prob > 0 && value > (1 + Math.cos(Math.PI / (maxLength - minLength) * (length - minLength)))*weight
	}
}
/**
 * Load a normalized Table from a json file
 * @param {String} file File path
 */
NormalizedTable.createFromFile = function(file) {
	return new Promise(resolve => resolve(NormalizedTable.convertToNormalizedTable(require(file))))
}
/**
 * Load a normalized Table from a json file
 * @param {String} file File path
 */
NormalizedTable.createFromFileSync = function(file) {
	return NormalizedTable.convertToNormalizedTable(require(file))
}
/**
 * Helper function to load from file
 * Attaches all Normalized Table functions
 * @param {Object} object Object to convert to NormalizedTable
 */
NormalizedTable.convertToNormalizedTable = function(object) {
	var result = new NormalizedTable(object[JSONMinify.language], object[JSONMinify.levels])
	result.probabilities = object[JSONMinify.probabilities]
	result.endProbability = object[JSONMinify.endProbability]
	for (var i in object[JSONMinify.next])
		result.next[i] = NormalizedTable.convertToNormalizedTable(object[JSONMinify.next][i])
	for (var prob of result.probabilities) {
		prob.value = prob[JSONMinify.value]
		prob.char = prob[JSONMinify.char]
		delete prob[JSONMinify.value]
		delete prob[JSONMinify.char]
	}
	return result
}
/**
 * Save a NormalizedTable to a file
 * @param {String} path File to save to
 */
NormalizedTable.prototype.writeToFileSync = function(path) {
	fs.writeFileSync(path, JSON.stringify(this, JSONMinify.minify, 0) , 'utf-8')
	console.log("Successfully saved to file " + path + ".")
}
/**
 * Save a NormalizedTable to a file
 * @param {String} path File to save to
 */
NormalizedTable.prototype.writeToFile = function(path) {
	return new Promise(resolve => {
		fs.writeFile(path, JSON.stringify(this, JSONMinify.minify, 0) , 'utf-8')
		console.log("Successfully saved to file " + path + ".")
		resolve()
	})
}

module.exports = {
	ProbTable: ProbTable,
	NormalizedTable: NormalizedTable,
	Language: Language
}
