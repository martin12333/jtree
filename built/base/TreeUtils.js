"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class TreeUtils {
    static getPathWithoutFileName(path) {
        const parts = path.split("/"); // todo: change for windows?
        parts.pop();
        return parts.join("/");
    }
    static getClassNameFromFilePath(filename) {
        return filename
            .replace(/\.[^\.]+$/, "")
            .split("/")
            .pop();
    }
    static escapeBackTicks(str) {
        return str.replace(/\`/g, "\\`").replace(/\$\{/g, "\\${");
    }
    static ucfirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    // Adapted from: https://github.com/dcporter/didyoumean.js/blob/master/didYouMean-1.2.1.js
    static didYouMean(str = "", options = [], caseSensitive = false, threshold = 0.4, thresholdAbsolute = 20) {
        if (!caseSensitive)
            str = str.toLowerCase();
        // Calculate the initial value (the threshold) if present.
        const thresholdRelative = threshold * str.length;
        let maximumEditDistanceToBeBestMatch;
        if (thresholdRelative !== null && thresholdAbsolute !== null)
            maximumEditDistanceToBeBestMatch = Math.min(thresholdRelative, thresholdAbsolute);
        else if (thresholdRelative !== null)
            maximumEditDistanceToBeBestMatch = thresholdRelative;
        else if (thresholdAbsolute !== null)
            maximumEditDistanceToBeBestMatch = thresholdAbsolute;
        // Get the edit distance to each option. If the closest one is less than 40% (by default) of str's length, then return it.
        let closestMatch;
        const len = options.length;
        for (let optionIndex = 0; optionIndex < len; optionIndex++) {
            const candidate = options[optionIndex];
            if (!candidate)
                continue;
            const editDistance = TreeUtils._getEditDistance(str, caseSensitive ? candidate : candidate.toLowerCase(), maximumEditDistanceToBeBestMatch);
            if (editDistance < maximumEditDistanceToBeBestMatch) {
                maximumEditDistanceToBeBestMatch = editDistance;
                closestMatch = candidate;
            }
        }
        return closestMatch;
    }
    // Adapted from: https://github.com/dcporter/didyoumean.js/blob/master/didYouMean-1.2.1.js
    static _getEditDistance(stringA, stringB, maxInt) {
        // Handle null or undefined max.
        maxInt = maxInt || maxInt === 0 ? maxInt : TreeUtils.MAX_INT;
        const aLength = stringA.length;
        const bLength = stringB.length;
        // Fast path - no A or B.
        if (aLength === 0)
            return Math.min(maxInt + 1, bLength);
        if (bLength === 0)
            return Math.min(maxInt + 1, aLength);
        // Fast path - length diff larger than max.
        if (Math.abs(aLength - bLength) > maxInt)
            return maxInt + 1;
        // Slow path.
        const matrix = [];
        // Set up the first row ([0, 1, 2, 3, etc]).
        for (let bIndex = 0; bIndex <= bLength; bIndex++) {
            matrix[bIndex] = [bIndex];
        }
        // Set up the first column (same).
        for (let aIndex = 0; aIndex <= aLength; aIndex++) {
            matrix[0][aIndex] = aIndex;
        }
        let colMin;
        let minJ;
        let maxJ;
        // Loop over the rest of the columns.
        for (let bIndex = 1; bIndex <= bLength; bIndex++) {
            colMin = TreeUtils.MAX_INT;
            minJ = 1;
            if (bIndex > maxInt)
                minJ = bIndex - maxInt;
            maxJ = bLength + 1;
            if (maxJ > maxInt + bIndex)
                maxJ = maxInt + bIndex;
            // Loop over the rest of the rows.
            for (let aIndex = 1; aIndex <= aLength; aIndex++) {
                // If j is out of bounds, just put a large value in the slot.
                if (aIndex < minJ || aIndex > maxJ)
                    matrix[bIndex][aIndex] = maxInt + 1;
                // Otherwise do the normal Levenshtein thing.
                else {
                    // If the characters are the same, there's no change in edit distance.
                    if (stringB.charAt(bIndex - 1) === stringA.charAt(aIndex - 1))
                        matrix[bIndex][aIndex] = matrix[bIndex - 1][aIndex - 1];
                    // Otherwise, see if we're substituting, inserting or deleting.
                    else
                        matrix[bIndex][aIndex] = Math.min(matrix[bIndex - 1][aIndex - 1] + 1, // Substitute
                        Math.min(matrix[bIndex][aIndex - 1] + 1, // Insert
                        matrix[bIndex - 1][aIndex] + 1)); // Delete
                }
                // Either way, update colMin.
                if (matrix[bIndex][aIndex] < colMin)
                    colMin = matrix[bIndex][aIndex];
            }
            // If this column's minimum is greater than the allowed maximum, there's no point
            // in going on with life.
            if (colMin > maxInt)
                return maxInt + 1;
        }
        // If we made it this far without running into the max, then return the final matrix value.
        return matrix[bLength][aLength];
    }
    static getLineIndexAtCharacterPosition(str, index) {
        const lines = str.split("\n");
        const len = lines.length;
        let position = 0;
        for (let lineNumber = 0; lineNumber < len; lineNumber++) {
            position += lines[lineNumber].length;
            if (position >= index)
                return lineNumber;
        }
    }
    static resolvePath(filePath, programFilepath) {
        // For use in Node.js only
        if (!filePath.startsWith("."))
            return filePath;
        const path = require("path");
        const folder = this.getPathWithoutFileName(programFilepath);
        return path.resolve(folder + "/" + filePath);
    }
    static getFileExtension(url = "") {
        const match = url.match(/\.([^\.]+)$/);
        return (match && match[1]) || "";
    }
    static resolveProperty(obj, path, separator = ".") {
        const properties = Array.isArray(path) ? path : path.split(separator);
        return properties.reduce((prev, curr) => prev && prev[curr], obj);
    }
    static formatStr(str, catchAllCellDelimiter = " ", parameterMap) {
        return str.replace(/{([^\}]+)}/g, (match, path) => {
            const val = parameterMap[path];
            if (!val)
                return "";
            return Array.isArray(val) ? val.join(catchAllCellDelimiter) : val;
        });
    }
    static stripHtml(text) {
        return text && text.replace ? text.replace(/<(?:.|\n)*?>/gm, "") : text;
    }
    static getUniqueWordsArray(allWords) {
        const words = allWords.replace(/\n/g, " ").split(" ");
        const index = {};
        words.forEach(word => {
            if (!index[word])
                index[word] = 0;
            index[word]++;
        });
        return Object.keys(index).map(key => {
            return {
                word: key,
                count: index[key]
            };
        });
    }
    // todo: add seed!
    static getRandomString(length = 30, letters = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")) {
        let str = "";
        while (length) {
            str += letters[Math.round(Math.min(Math.random() * letters.length, letters.length - 1))];
            length--;
        }
        return str;
    }
    // todo: add seed!
    static makeRandomTree(lines = 1000) {
        let str = "";
        let letters = " 123abc".split("");
        while (lines) {
            let indent = " ".repeat(Math.round(Math.random() * 6));
            let bit = indent;
            let rand = Math.floor(Math.random() * 30);
            while (rand) {
                bit += letters[Math.round(Math.min(Math.random() * letters.length, letters.length - 1))];
                rand--;
            }
            bit += "\n";
            str += bit;
            lines--;
        }
        return str;
    }
    static arrayToMap(arr) {
        const map = {};
        arr.forEach(val => (map[val] = true));
        return map;
    }
    static mapValues(object, fn) {
        const result = {};
        Object.keys(object).forEach(key => {
            result[key] = fn(key);
        });
        return result;
    }
    static sortByAccessor(accessor) {
        return (objectA, objectB) => {
            const av = accessor(objectA);
            const bv = accessor(objectB);
            let result = av < bv ? -1 : av > bv ? 1 : 0;
            if (av === undefined && bv !== undefined)
                result = -1;
            else if (bv === undefined && av !== undefined)
                result = 1;
            return result;
        };
    }
    static _makeGraphSortFunction(idAccessor, extendsIdAccessor) {
        return (nodeA, nodeB) => {
            // -1 === a before b
            const nodeAUniqueId = idAccessor(nodeA);
            const nodeAExtends = extendsIdAccessor(nodeA);
            const nodeBUniqueId = idAccessor(nodeB);
            const nodeBExtends = extendsIdAccessor(nodeB);
            const nodeAExtendsNodeB = nodeAExtends && nodeAExtends === nodeBUniqueId;
            const nodeBExtendsNodeA = nodeBExtends && nodeBExtends === nodeAUniqueId;
            if (!nodeAExtends && !nodeBExtends) {
                // If neither extends, sort by firstWord
                if (nodeAUniqueId > nodeBUniqueId)
                    return 1;
                else if (nodeAUniqueId < nodeBUniqueId)
                    return -1;
                return 0;
            }
            // If only one extends, the other comes first
            else if (!nodeAExtends)
                return -1;
            else if (!nodeBExtends)
                return 1;
            // If A extends B, B should come first
            if (nodeAExtendsNodeB)
                return 1;
            else if (nodeBExtendsNodeA)
                return -1;
            // Sort by what they extend
            if (nodeAExtends > nodeBExtends)
                return 1;
            else if (nodeAExtends < nodeBExtends)
                return -1;
            // Finally sort by firstWord
            if (nodeAUniqueId > nodeBUniqueId)
                return 1;
            else if (nodeAUniqueId < nodeBUniqueId)
                return -1;
            // Should never hit this, unless we have a duplicate line.
            return 0;
        };
    }
}
TreeUtils.MAX_INT = Math.pow(2, 32) - 1;
TreeUtils.BrowserScript = class {
    constructor(fileStr) {
        this._str = fileStr;
    }
    addUseStrict() {
        this._str = `"use strict";\n` + this._str;
        return this;
    }
    removeRequires() {
        this._str = this._str.replace(/(\n|^)const .* \= require\(.*/g, "$1");
        return this;
    }
    _removeAllLinesStartingWith(prefix) {
        this._str = this._str
            .split("\n")
            .filter(line => !line.startsWith(prefix))
            .join("\n");
        return this;
    }
    removeNodeJsOnlyLines() {
        return this._removeAllLinesStartingWith("/*NODE_JS_ONLY*/");
    }
    removeHashBang() {
        this._str = this._str.replace(/^\#\![^\n]+\n/, "");
        return this;
    }
    removeImports() {
        // todo: what if this spans multiple lines?
        this._str = this._str.replace(/(\n|^)import .* from .*/g, "$1");
        this._str = this._str.replace(/(\n|^)\/\*FOR_TYPES_ONLY\*\/ import .* from .*/g, "$1");
        this._str = this._str.replace(/(\n|^)import {[^\}]+} ?from ?"[^\"]+"/g, "$1");
        return this;
    }
    removeExports() {
        this._str = this._str.replace(/(\n|^)export default .*/g, "$1");
        this._str = this._str.replace(/(\n|^)export {[^\}]+}/g, "$1");
        return this;
    }
    changeDefaultExportsToWindowExports() {
        this._str = this._str.replace(/\nexport default ([^;]*)/g, "\nwindow.$1 = $1");
        // todo: should we just switch to some bundler?
        const matches = this._str.match(/\nexport { [^\}]+ }/g);
        if (matches)
            this._str.replace(/\nexport { ([^\}]+) }/g, matches[0]
                .replace("export {", "")
                .replace("}", "")
                .split(/ /g)
                .map(mod => `\nwindow.${mod} = ${mod}`)
                .join("\n"));
        return this;
    }
    changeNodeExportsToWindowExports() {
        // todo: should we just switch to some bundler?
        const reg = /\nmodule\.exports = { ?([^\}]+) ?}/;
        const matches = this._str.match(reg);
        if (matches) {
            this._str = this._str.replace(reg, matches[1]
                .split(/,/g)
                .map(mod => mod.replace(/\s/g, ""))
                .map(mod => `\nwindow.${mod} = ${mod}`)
                .join("\n"));
        }
        this._str = this._str.replace(/\nmodule\.exports \= ([^;^{]*)/g, "\nwindow.$1 = $1");
        this._str = this._str.replace(/\nexports\.default \= ([^;]*)/g, "\nwindow.$1 = $1");
        return this;
    }
    getString() {
        return this._str;
    }
};
exports.default = TreeUtils;
