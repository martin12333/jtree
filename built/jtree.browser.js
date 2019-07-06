"use strict";
let _jtreeLatestTime = 0;
let _jtreeMinTimeIncrement = 0.000000000001;
class AbstractNode {
    _getProcessTimeInMilliseconds() {
        // We add this loop to restore monotonically increasing .now():
        // https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
        let time = performance.now();
        while (time <= _jtreeLatestTime) {
            if (time === time + _jtreeMinTimeIncrement)
                // Some browsers have different return values for perf.now()
                _jtreeMinTimeIncrement = 10 * _jtreeMinTimeIncrement;
            time += _jtreeMinTimeIncrement;
        }
        _jtreeLatestTime = time;
        return time;
    }
}
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
var FileFormat;
(function (FileFormat) {
    FileFormat["csv"] = "csv";
    FileFormat["tsv"] = "tsv";
    FileFormat["tree"] = "tree";
})(FileFormat || (FileFormat = {}));
var WhereOperators;
(function (WhereOperators) {
    WhereOperators["equal"] = "=";
    WhereOperators["notEqual"] = "!=";
    WhereOperators["lessThan"] = "<";
    WhereOperators["lessThanOrEqual"] = "<=";
    WhereOperators["greaterThan"] = ">";
    WhereOperators["greaterThanOrEqual"] = ">=";
    WhereOperators["includes"] = "includes";
    WhereOperators["doesNotInclude"] = "doesNotInclude";
    WhereOperators["in"] = "in";
    WhereOperators["notIn"] = "notIn";
    WhereOperators["empty"] = "empty";
    WhereOperators["notEmpty"] = "notEmpty";
})(WhereOperators || (WhereOperators = {}));
class ImmutableNode extends AbstractNode {
    constructor(children, line, parent) {
        super();
        this._parent = parent;
        this._setLine(line);
        this._setChildren(children);
    }
    execute(context) {
        return Promise.all(this.map(child => child.execute(context)));
    }
    getErrors() {
        return [];
    }
    getLineCellTypes() {
        // todo: make this any a constant
        return "undefinedCellType ".repeat(this.getWords().length).trim();
    }
    executeSync(context) {
        return this.map(child => child.executeSync(context));
    }
    isNodeJs() {
        return typeof exports !== "undefined";
    }
    isBrowser() {
        return !this.isNodeJs();
    }
    getOlderSiblings() {
        if (this.isRoot())
            return [];
        return this.getParent().slice(0, this.getIndex());
    }
    _getClosestOlderSibling() {
        const olderSiblings = this.getOlderSiblings();
        return olderSiblings[olderSiblings.length - 1];
    }
    getYoungerSiblings() {
        if (this.isRoot())
            return [];
        return this.getParent().slice(this.getIndex() + 1);
    }
    getSiblings() {
        if (this.isRoot())
            return [];
        return this.getParent().filter(node => node !== this);
    }
    _getUid() {
        if (!this._uid)
            this._uid = ImmutableNode._makeUniqueId();
        return this._uid;
    }
    // todo: rename getMother? grandMother et cetera?
    getParent() {
        return this._parent;
    }
    getPoint() {
        return this._getPoint();
    }
    _getPoint(relativeTo) {
        return {
            x: this._getXCoordinate(relativeTo),
            y: this._getYCoordinate(relativeTo)
        };
    }
    getPointRelativeTo(relativeTo) {
        return this._getPoint(relativeTo);
    }
    getIndentation(relativeTo) {
        return this.getXI().repeat(this._getXCoordinate(relativeTo) - 1);
    }
    _getTopDownArray(arr) {
        this.forEach(child => {
            arr.push(child);
            child._getTopDownArray(arr);
        });
    }
    getTopDownArray() {
        const arr = [];
        this._getTopDownArray(arr);
        return arr;
    }
    *getTopDownArrayIterator() {
        for (let child of this.getChildren()) {
            yield child;
            yield* child.getTopDownArrayIterator();
        }
    }
    nodeAtLine(lineNumber) {
        let index = 0;
        for (let node of this.getTopDownArrayIterator()) {
            if (lineNumber === index)
                return node;
            index++;
        }
    }
    getNumberOfLines() {
        let lineCount = 0;
        for (let node of this.getTopDownArrayIterator()) {
            lineCount++;
        }
        return lineCount;
    }
    _getLineNumber(target) {
        let lineNumber = 1;
        for (let node of this.getTopDownArrayIterator()) {
            if (node === target)
                return lineNumber;
            lineNumber++;
        }
        return lineNumber;
    }
    isBlankLine() {
        return !this.length && !this.getLine();
    }
    hasDuplicateFirstWords() {
        return this.length ? new Set(this.getFirstWords()).size !== this.length : false;
    }
    isEmpty() {
        return !this.length && !this.getContent();
    }
    _getYCoordinate(relativeTo) {
        if (this._cachedLineNumber)
            return this._cachedLineNumber;
        if (this.isRoot(relativeTo))
            return 0;
        const start = relativeTo || this.getRootNode();
        return start._getLineNumber(this);
    }
    isRoot(relativeTo) {
        return relativeTo === this || !this.getParent();
    }
    getRootNode() {
        return this._getRootNode();
    }
    _getRootNode(relativeTo) {
        if (this.isRoot(relativeTo))
            return this;
        return this.getParent()._getRootNode(relativeTo);
    }
    toString(indentCount = 0, language = this) {
        if (this.isRoot())
            return this._childrenToString(indentCount, language);
        return (language.getXI().repeat(indentCount) + this.getLine(language) + (this.length ? language.getYI() + this._childrenToString(indentCount + 1, language) : ""));
    }
    getWord(index) {
        const words = this._getLine().split(this.getZI());
        if (index < 0)
            index = words.length + index;
        return words[index];
    }
    _toHtml(indentCount) {
        const path = this.getPathVector().join(" ");
        const classes = {
            nodeLine: "nodeLine",
            xi: "xIncrement",
            yi: "yIncrement",
            nodeChildren: "nodeChildren"
        };
        const edge = this.getXI().repeat(indentCount);
        // Set up the firstWord part of the node
        const edgeHtml = `<span class="${classes.nodeLine}" data-pathVector="${path}"><span class="${classes.xi}">${edge}</span>`;
        const lineHtml = this._getLineHtml();
        const childrenHtml = this.length
            ? `<span class="${classes.yi}">${this.getYI()}</span>` + `<span class="${classes.nodeChildren}">${this._childrenToHtml(indentCount + 1)}</span>`
            : "";
        return `${edgeHtml}${lineHtml}${childrenHtml}</span>`;
    }
    _getWords(startFrom) {
        if (!this._words)
            this._words = this._getLine().split(this.getZI());
        return startFrom ? this._words.slice(startFrom) : this._words;
    }
    getWords() {
        return this._getWords(0);
    }
    getWordsFrom(startFrom) {
        return this._getWords(startFrom);
    }
    _getWordIndexCharacterStartPosition(wordIndex) {
        const xiLength = this.getXI().length;
        const numIndents = this._getXCoordinate(undefined) - 1;
        const indentPosition = xiLength * numIndents;
        if (wordIndex < 1)
            return xiLength * (numIndents + wordIndex);
        return (indentPosition +
            this.getWords()
                .slice(0, wordIndex)
                .join(this.getZI()).length +
            this.getZI().length);
    }
    getNodeInScopeAtCharIndex(charIndex) {
        if (this.isRoot())
            return this;
        let wordIndex = this.getWordIndexAtCharacterIndex(charIndex);
        if (wordIndex > 0)
            return this;
        let node = this;
        while (wordIndex < 1) {
            node = node.getParent();
            wordIndex++;
        }
        return node;
    }
    getWordProperties(wordIndex) {
        const start = this._getWordIndexCharacterStartPosition(wordIndex);
        const word = wordIndex < 0 ? "" : this.getWord(wordIndex);
        return {
            startCharIndex: start,
            endCharIndex: start + word.length,
            word: word
        };
    }
    getAllWordBoundaryCoordinates() {
        const coordinates = [];
        let line = 0;
        for (let node of this.getTopDownArrayIterator()) {
            ;
            node.getWordBoundaryIndices().forEach(index => {
                coordinates.push({
                    y: line,
                    x: index
                });
            });
            line++;
        }
        return coordinates;
    }
    getWordBoundaryIndices() {
        const boundaries = [0];
        let numberOfIndents = this._getXCoordinate(undefined) - 1;
        let start = numberOfIndents;
        // Add indents
        while (numberOfIndents) {
            boundaries.push(boundaries.length);
            numberOfIndents--;
        }
        // Add columns
        const ziIncrement = this.getZI().length;
        this.getWords().forEach(word => {
            if (boundaries[boundaries.length - 1] !== start)
                boundaries.push(start);
            start += word.length;
            if (boundaries[boundaries.length - 1] !== start)
                boundaries.push(start);
            start += ziIncrement;
        });
        return boundaries;
    }
    getWordIndexAtCharacterIndex(charIndex) {
        // todo: is this correct thinking for handling root?
        if (this.isRoot())
            return 0;
        const numberOfIndents = this._getXCoordinate(undefined) - 1;
        // todo: probably want to rewrite this in a performant way.
        const spots = [];
        while (spots.length < numberOfIndents) {
            spots.push(-(numberOfIndents - spots.length));
        }
        this.getWords().forEach((word, wordIndex) => {
            word.split("").forEach(letter => {
                spots.push(wordIndex);
            });
            spots.push(wordIndex);
        });
        return spots[charIndex];
    }
    getAllErrors() {
        const errors = [];
        let line = 1;
        for (let node of this.getTopDownArray()) {
            node._cachedLineNumber = line;
            const errs = node.getErrors();
            errs.forEach(err => errors.push(err));
            delete node._cachedLineNumber;
            line++;
        }
        return errors;
    }
    *getAllErrorsIterator() {
        let line = 1;
        for (let node of this.getTopDownArrayIterator()) {
            node._cachedLineNumber = line;
            const errs = node.getErrors();
            delete node._cachedLineNumber;
            if (errs.length)
                yield errs;
            line++;
        }
    }
    getFirstWord() {
        return this.getWords()[0];
    }
    getContent() {
        const words = this.getWordsFrom(1);
        return words.length ? words.join(this.getZI()) : undefined;
    }
    getContentWithChildren() {
        // todo: deprecate
        const content = this.getContent();
        return (content ? content : "") + (this.length ? this.getYI() + this._childrenToString() : "");
    }
    getFirstNode() {
        return this.nodeAt(0);
    }
    getStack() {
        return this._getStack();
    }
    _getStack(relativeTo) {
        if (this.isRoot(relativeTo))
            return [];
        const parent = this.getParent();
        if (parent.isRoot(relativeTo))
            return [this];
        else
            return parent._getStack(relativeTo).concat([this]);
    }
    getStackString() {
        return this._getStack()
            .map((node, index) => this.getXI().repeat(index) + node.getLine())
            .join(this.getYI());
    }
    getLine(language) {
        if (!this._words && !language)
            return this._getLine(); // todo: how does this interact with "language" param?
        return this.getWords().join((language || this).getZI());
    }
    getColumnNames() {
        return this._getUnionNames();
    }
    getOneHot(column) {
        const clone = this.clone();
        const cols = Array.from(new Set(clone.getColumn(column)));
        clone.forEach(node => {
            const val = node.get(column);
            node.delete(column);
            cols.forEach(col => {
                node.set(column + "_" + col, val === col ? "1" : "0");
            });
        });
        return clone;
    }
    // todo: return array? getPathArray?
    _getFirstWordPath(relativeTo) {
        if (this.isRoot(relativeTo))
            return "";
        else if (this.getParent().isRoot(relativeTo))
            return this.getFirstWord();
        return this.getParent()._getFirstWordPath(relativeTo) + this.getXI() + this.getFirstWord();
    }
    getFirstWordPathRelativeTo(relativeTo) {
        return this._getFirstWordPath(relativeTo);
    }
    getFirstWordPath() {
        return this._getFirstWordPath();
    }
    getPathVector() {
        return this._getPathVector();
    }
    getPathVectorRelativeTo(relativeTo) {
        return this._getPathVector(relativeTo);
    }
    _getPathVector(relativeTo) {
        if (this.isRoot(relativeTo))
            return [];
        const path = this.getParent()._getPathVector(relativeTo);
        path.push(this.getIndex());
        return path;
    }
    getIndex() {
        return this.getParent()._indexOfNode(this);
    }
    isTerminal() {
        return !this.length;
    }
    _getLineHtml() {
        return this.getWords()
            .map((word, index) => `<span class="word${index}">${TreeUtils.stripHtml(word)}</span>`)
            .join(`<span class="zIncrement">${this.getZI()}</span>`);
    }
    _getXmlContent(indentCount) {
        if (this.getContent() !== undefined)
            return this.getContentWithChildren();
        return this.length ? `${indentCount === -1 ? "" : "\n"}${this._childrenToXml(indentCount > -1 ? indentCount + 2 : -1)}${" ".repeat(indentCount)}` : "";
    }
    _toXml(indentCount) {
        const indent = " ".repeat(indentCount);
        const tag = this.getFirstWord();
        return `${indent}<${tag}>${this._getXmlContent(indentCount)}</${tag}>${indentCount === -1 ? "" : "\n"}`;
    }
    _toObjectTuple() {
        const content = this.getContent();
        const length = this.length;
        const hasChildrenNoContent = content === undefined && length;
        const hasContentAndHasChildren = content !== undefined && length;
        // If the node has a content and a subtree return it as a string, as
        // Javascript object values can't be both a leaf and a tree.
        const tupleValue = hasChildrenNoContent ? this.toObject() : hasContentAndHasChildren ? this.getContentWithChildren() : content;
        return [this.getFirstWord(), tupleValue];
    }
    _indexOfNode(needleNode) {
        let result = -1;
        this.find((node, index) => {
            if (node === needleNode) {
                result = index;
                return true;
            }
        });
        return result;
    }
    getSlice(startIndexInclusive, stopIndexExclusive) {
        return new TreeNode(this.slice(startIndexInclusive, stopIndexExclusive)
            .map(child => child.toString())
            .join("\n"));
    }
    _hasColumns(columns) {
        const words = this.getWords();
        return columns.every((searchTerm, index) => searchTerm === words[index]);
    }
    hasWord(index, word) {
        return this.getWord(index) === word;
    }
    getNodeByColumns(...columns) {
        return this.getTopDownArray().find(node => node._hasColumns(columns));
    }
    getNodeByColumn(index, name) {
        return this.find(node => node.getWord(index) === name);
    }
    _getNodesByColumn(index, name) {
        return this.filter(node => node.getWord(index) === name);
    }
    // todo: preserve subclasses!
    select(columnNames) {
        columnNames = Array.isArray(columnNames) ? columnNames : [columnNames];
        const result = new TreeNode();
        this.forEach(node => {
            const tree = result.appendLine(node.getLine());
            columnNames.forEach((name) => {
                const valueNode = node.getNode(name);
                if (valueNode)
                    tree.appendNode(valueNode);
            });
        });
        return result;
    }
    // Note: this is for debugging select chains
    print(message = "") {
        if (message)
            console.log(message);
        console.log(this.toString());
        return this;
    }
    // todo: preserve subclasses!
    where(columnName, operator, fixedValue) {
        const isArray = Array.isArray(fixedValue);
        const valueType = isArray ? typeof fixedValue[0] : typeof fixedValue;
        let parser;
        if (valueType === "number")
            parser = parseFloat;
        const fn = (node) => {
            const cell = node.get(columnName);
            const typedCell = parser ? parser(cell) : cell;
            if (operator === WhereOperators.equal)
                return fixedValue === typedCell;
            else if (operator === WhereOperators.notEqual)
                return fixedValue !== typedCell;
            else if (operator === WhereOperators.includes)
                return typedCell !== undefined && typedCell.includes(fixedValue);
            else if (operator === WhereOperators.doesNotInclude)
                return typedCell === undefined || !typedCell.includes(fixedValue);
            else if (operator === WhereOperators.greaterThan)
                return typedCell > fixedValue;
            else if (operator === WhereOperators.lessThan)
                return typedCell < fixedValue;
            else if (operator === WhereOperators.greaterThanOrEqual)
                return typedCell >= fixedValue;
            else if (operator === WhereOperators.lessThanOrEqual)
                return typedCell <= fixedValue;
            else if (operator === WhereOperators.empty)
                return !node.has(columnName);
            else if (operator === WhereOperators.notEmpty)
                return node.has(columnName);
            else if (operator === WhereOperators.in && isArray)
                return fixedValue.includes(typedCell);
            else if (operator === WhereOperators.notIn && isArray)
                return !fixedValue.includes(typedCell);
        };
        const result = new TreeNode();
        this.filter(fn).forEach(node => {
            result.appendNode(node);
        });
        return result;
    }
    first(quantity = 1) {
        return this.limit(quantity, 0);
    }
    last(quantity = 1) {
        return this.limit(quantity, this.length - quantity);
    }
    // todo: preserve subclasses!
    limit(quantity, offset = 0) {
        const result = new TreeNode();
        this.getChildren()
            .slice(offset, quantity + offset)
            .forEach(node => {
            result.appendNode(node);
        });
        return result;
    }
    getChildrenFirstArray() {
        const arr = [];
        this._getChildrenFirstArray(arr);
        return arr;
    }
    _getChildrenFirstArray(arr) {
        this.forEach(child => {
            child._getChildrenFirstArray(arr);
            arr.push(child);
        });
    }
    _getXCoordinate(relativeTo) {
        return this._getStack(relativeTo).length;
    }
    getParentFirstArray() {
        const levels = this._getLevels();
        const arr = [];
        Object.values(levels).forEach(level => {
            level.forEach(item => arr.push(item));
        });
        return arr;
    }
    _getLevels() {
        const levels = {};
        this.getTopDownArray().forEach(node => {
            const level = node._getXCoordinate();
            if (!levels[level])
                levels[level] = [];
            levels[level].push(node);
        });
        return levels;
    }
    _getChildrenArray() {
        if (!this._children)
            this._children = [];
        return this._children;
    }
    _getChildren() {
        return this._getChildrenArray();
    }
    getLines() {
        return this.map(node => node.getLine());
    }
    getChildren() {
        return this._getChildren().slice(0);
    }
    get length() {
        return this._getChildren().length;
    }
    _nodeAt(index) {
        if (index < 0)
            index = this.length + index;
        return this._getChildren()[index];
    }
    nodeAt(indexOrIndexArray) {
        if (typeof indexOrIndexArray === "number")
            return this._nodeAt(indexOrIndexArray);
        if (indexOrIndexArray.length === 1)
            return this._nodeAt(indexOrIndexArray[0]);
        const first = indexOrIndexArray[0];
        const node = this._nodeAt(first);
        if (!node)
            return undefined;
        return node.nodeAt(indexOrIndexArray.slice(1));
    }
    _toObject() {
        const obj = {};
        this.forEach(node => {
            const tuple = node._toObjectTuple();
            obj[tuple[0]] = tuple[1];
        });
        return obj;
    }
    toHtml() {
        return this._childrenToHtml(0);
    }
    _getHtmlJoinByCharacter() {
        return `<span class="yIncrement">${this.getYI()}</span>`;
    }
    _childrenToHtml(indentCount) {
        const joinBy = this._getHtmlJoinByCharacter();
        return this.map(node => node._toHtml(indentCount)).join(joinBy);
    }
    _childrenToString(indentCount, language = this) {
        return this.map(node => node.toString(indentCount, language)).join(language.getYI());
    }
    childrenToString() {
        return this._childrenToString();
    }
    // todo: implement
    _getChildJoinCharacter() {
        return "\n";
    }
    compile() {
        return this.map(child => child.compile()).join(this._getChildJoinCharacter());
    }
    toXml() {
        return this._childrenToXml(0);
    }
    toDisk(path) {
        if (!this.isNodeJs())
            throw new Error("This method only works in Node.js");
        const format = ImmutableNode._getFileFormat(path);
        const formats = {
            tree: (tree) => tree.toString(),
            csv: (tree) => tree.toCsv(),
            tsv: (tree) => tree.toTsv()
        };
        require("fs").writeFileSync(path, formats[format](this), "utf8");
        return this;
    }
    _lineToYaml(indentLevel, listTag = "") {
        let prefix = " ".repeat(indentLevel);
        if (listTag && indentLevel > 1)
            prefix = " ".repeat(indentLevel - 2) + listTag + " ";
        return prefix + `${this.getFirstWord()}:` + (this.getContent() ? " " + this.getContent() : "");
    }
    _isYamlList() {
        return this.hasDuplicateFirstWords();
    }
    toYaml() {
        return `%YAML 1.2
---\n${this._childrenToYaml(0).join("\n")}`;
    }
    _childrenToYaml(indentLevel) {
        if (this._isYamlList())
            return this._childrenToYamlList(indentLevel);
        else
            return this._childrenToYamlAssociativeArray(indentLevel);
    }
    // if your code-to-be-yaml has a list of associative arrays of type N and you don't
    // want the type N to print
    _collapseYamlLine() {
        return false;
    }
    _toYamlListElement(indentLevel) {
        const children = this._childrenToYaml(indentLevel + 1);
        if (this._collapseYamlLine()) {
            if (indentLevel > 1)
                return children.join("\n").replace(" ".repeat(indentLevel), " ".repeat(indentLevel - 2) + "- ");
            return children.join("\n");
        }
        else {
            children.unshift(this._lineToYaml(indentLevel, "-"));
            return children.join("\n");
        }
    }
    _childrenToYamlList(indentLevel) {
        return this.map(node => node._toYamlListElement(indentLevel + 2));
    }
    _toYamlAssociativeArrayElement(indentLevel) {
        const children = this._childrenToYaml(indentLevel + 1);
        children.unshift(this._lineToYaml(indentLevel));
        return children.join("\n");
    }
    _childrenToYamlAssociativeArray(indentLevel) {
        return this.map(node => node._toYamlAssociativeArrayElement(indentLevel));
    }
    toJsonSubset() {
        return JSON.stringify(this.toObject(), null, " ");
    }
    findNodes(firstWordPath) {
        // todo: can easily speed this up
        const map = {};
        if (!Array.isArray(firstWordPath))
            firstWordPath = [firstWordPath];
        firstWordPath.forEach(path => (map[path] = true));
        return this.getTopDownArray().filter(node => {
            if (map[node._getFirstWordPath(this)])
                return true;
            return false;
        });
    }
    format(str) {
        const that = this;
        return str.replace(/{([^\}]+)}/g, (match, path) => that.get(path) || "");
    }
    getColumn(path) {
        return this.map(node => node.get(path));
    }
    getFiltered(fn) {
        const clone = this.clone();
        clone
            .filter((node, index) => !fn(node, index))
            .forEach(node => {
            node.destroy();
        });
        return clone;
    }
    getNode(firstWordPath) {
        return this._getNodeByPath(firstWordPath);
    }
    get(firstWordPath) {
        const node = this._getNodeByPath(firstWordPath);
        return node === undefined ? undefined : node.getContent();
    }
    getNodesByGlobPath(query) {
        return this._getNodesByGlobPath(query);
    }
    _getNodesByGlobPath(globPath) {
        const xi = this.getXI();
        if (!globPath.includes(xi)) {
            if (globPath === "*")
                return this.getChildren();
            return this.filter(node => node.getFirstWord() === globPath);
        }
        const parts = globPath.split(xi);
        const current = parts.shift();
        const rest = parts.join(xi);
        const matchingNodes = current === "*" ? this.getChildren() : this.filter(child => child.getFirstWord() === current);
        return [].concat.apply([], matchingNodes.map(node => node._getNodesByGlobPath(rest)));
    }
    _getNodeByPath(firstWordPath) {
        const xi = this.getXI();
        if (!firstWordPath.includes(xi)) {
            const index = this.indexOfLast(firstWordPath);
            return index === -1 ? undefined : this._nodeAt(index);
        }
        const parts = firstWordPath.split(xi);
        const current = parts.shift();
        const currentNode = this._getChildren()[this._getIndex()[current]];
        return currentNode ? currentNode._getNodeByPath(parts.join(xi)) : undefined;
    }
    getNext() {
        if (this.isRoot())
            return this;
        const index = this.getIndex();
        const parent = this.getParent();
        const length = parent.length;
        const next = index + 1;
        return next === length ? parent._getChildren()[0] : parent._getChildren()[next];
    }
    getPrevious() {
        if (this.isRoot())
            return this;
        const index = this.getIndex();
        const parent = this.getParent();
        const length = parent.length;
        const prev = index - 1;
        return prev === -1 ? parent._getChildren()[length - 1] : parent._getChildren()[prev];
    }
    _getUnionNames() {
        if (!this.length)
            return [];
        const obj = {};
        this.forEach((node) => {
            if (!node.length)
                return undefined;
            node.forEach(node => {
                obj[node.getFirstWord()] = 1;
            });
        });
        return Object.keys(obj);
    }
    getAncestorNodesByInheritanceViaExtendsKeyword(key) {
        const ancestorNodes = this._getAncestorNodes((node, id) => node._getNodesByColumn(0, id), node => node.get(key), this);
        ancestorNodes.push(this);
        return ancestorNodes;
    }
    // Note: as you can probably tell by the name of this method, I don't recommend using this as it will likely be replaced by something better.
    getAncestorNodesByInheritanceViaColumnIndices(thisColumnNumber, extendsColumnNumber) {
        const ancestorNodes = this._getAncestorNodes((node, id) => node._getNodesByColumn(thisColumnNumber, id), node => node.getWord(extendsColumnNumber), this);
        ancestorNodes.push(this);
        return ancestorNodes;
    }
    _getAncestorNodes(getPotentialParentNodesByIdFn, getParentIdFn, cannotContainNode) {
        const parentId = getParentIdFn(this);
        if (!parentId)
            return [];
        const potentialParentNodes = getPotentialParentNodesByIdFn(this.getParent(), parentId);
        if (!potentialParentNodes.length)
            throw new Error(`"${this.getLine()} tried to extend "${parentId}" but "${parentId}" not found.`);
        if (potentialParentNodes.length > 1)
            throw new Error(`Invalid inheritance family tree. Multiple unique ids found for "${parentId}"`);
        const parentNode = potentialParentNodes[0];
        // todo: detect loops
        if (parentNode === cannotContainNode)
            throw new Error(`Loop detected between '${this.getLine()}' and '${parentNode.getLine()}'`);
        const ancestorNodes = parentNode._getAncestorNodes(getPotentialParentNodesByIdFn, getParentIdFn, cannotContainNode);
        ancestorNodes.push(parentNode);
        return ancestorNodes;
    }
    pathVectorToFirstWordPath(pathVector) {
        const path = pathVector.slice(); // copy array
        const names = [];
        let node = this;
        while (path.length) {
            if (!node)
                return names;
            names.push(node.nodeAt(path[0]).getFirstWord());
            node = node.nodeAt(path.shift());
        }
        return names;
    }
    toCsv() {
        return this.toDelimited(",");
    }
    _getTypes(header) {
        const matrix = this._getMatrix(header);
        const types = header.map(i => "int");
        matrix.forEach(row => {
            row.forEach((value, index) => {
                const type = types[index];
                if (type === "string")
                    return 1;
                if (value === undefined || value === "")
                    return 1;
                if (type === "float") {
                    if (value.match(/^\-?[0-9]*\.?[0-9]*$/))
                        return 1;
                    types[index] = "string";
                }
                if (value.match(/^\-?[0-9]+$/))
                    return 1;
                types[index] = "string";
            });
        });
        return types;
    }
    toDataTable(header = this._getUnionNames()) {
        const types = this._getTypes(header);
        const parsers = {
            string: str => str,
            float: parseFloat,
            int: parseInt
        };
        const cellFn = (cellValue, rowIndex, columnIndex) => (rowIndex ? parsers[types[columnIndex]](cellValue) : cellValue);
        const arrays = this._toArrays(header, cellFn);
        arrays.rows.unshift(arrays.header);
        return arrays.rows;
    }
    toDelimited(delimiter, header = this._getUnionNames()) {
        const regex = new RegExp(`(\\n|\\"|\\${delimiter})`);
        const cellFn = (str, row, column) => (!str.toString().match(regex) ? str : `"` + str.replace(/\"/g, `""`) + `"`);
        return this._toDelimited(delimiter, header, cellFn);
    }
    _getMatrix(columns) {
        const matrix = [];
        this.forEach(child => {
            const row = [];
            columns.forEach(col => {
                row.push(child.get(col));
            });
            matrix.push(row);
        });
        return matrix;
    }
    _toArrays(header, cellFn) {
        const skipHeaderRow = 1;
        const headerArray = header.map((columnName, index) => cellFn(columnName, 0, index));
        const rows = this.map((node, rowNumber) => header.map((columnName, columnIndex) => {
            const childNode = node.getNode(columnName);
            const content = childNode ? childNode.getContentWithChildren() : "";
            return cellFn(content, rowNumber + skipHeaderRow, columnIndex);
        }));
        return {
            rows: rows,
            header: headerArray
        };
    }
    _toDelimited(delimiter, header, cellFn) {
        const data = this._toArrays(header, cellFn);
        return data.header.join(delimiter) + "\n" + data.rows.map(row => row.join(delimiter)).join("\n");
    }
    toTable() {
        // Output a table for printing
        return this._toTable(100, false);
    }
    toFormattedTable(maxWidth, alignRight = false) {
        // Output a table with padding up to maxWidth in each cell
        return this._toTable(maxWidth, alignRight);
    }
    _toTable(maxWidth, alignRight = false) {
        const header = this._getUnionNames();
        const widths = header.map(col => (col.length > maxWidth ? maxWidth : col.length));
        this.forEach(node => {
            if (!node.length)
                return true;
            header.forEach((col, index) => {
                const cellValue = node.get(col);
                if (!cellValue)
                    return true;
                const length = cellValue.toString().length;
                if (length > widths[index])
                    widths[index] = length > maxWidth ? maxWidth : length;
            });
        });
        const cellFn = (cellText, row, col) => {
            const width = widths[col];
            // Strip newlines in fixedWidth output
            const cellValue = cellText.toString().replace(/\n/g, "\\n");
            const cellLength = cellValue.length;
            if (cellLength > width) {
                return cellValue.substr(0, width);
            }
            const padding = " ".repeat(width - cellLength);
            return alignRight ? padding + cellValue : cellValue + padding;
        };
        return this._toDelimited(" ", header, cellFn);
    }
    toSsv() {
        return this.toDelimited(" ");
    }
    toOutline() {
        return this._toOutline(node => node.getLine());
    }
    toMappedOutline(nodeFn) {
        return this._toOutline(nodeFn);
    }
    // Adapted from: https://github.com/notatestuser/treeify.js
    _toOutline(nodeFn) {
        const growBranch = (outlineTreeNode, last, lastStates, nodeFn, callback) => {
            let lastStatesCopy = lastStates.slice(0);
            const node = outlineTreeNode.node;
            if (lastStatesCopy.push([outlineTreeNode, last]) && lastStates.length > 0) {
                let line = "";
                // firstWordd on the "was last element" states of whatever we're nested within,
                // we need to append either blankness or a branch to our line
                lastStates.forEach((lastState, idx) => {
                    if (idx > 0)
                        line += lastState[1] ? " " : "│";
                });
                // the prefix varies firstWordd on whether the key contains something to show and
                // whether we're dealing with the last element in this collection
                // the extra "-" just makes things stand out more.
                line += (last ? "└" : "├") + nodeFn(node);
                callback(line);
            }
            if (!node)
                return;
            const length = node.length;
            let index = 0;
            node.forEach(node => {
                let lastKey = ++index === length;
                growBranch({ node: node }, lastKey, lastStatesCopy, nodeFn, callback);
            });
        };
        let output = "";
        growBranch({ node: this }, false, [], nodeFn, (line) => (output += line + "\n"));
        return output;
    }
    copyTo(node, index) {
        return node._setLineAndChildren(this.getLine(), this.childrenToString(), index);
    }
    // Note: Splits using a positive lookahead
    // this.split("foo").join("\n") === this.toString()
    split(firstWord) {
        const constructor = this.constructor;
        const YI = this.getYI();
        const ZI = this.getZI();
        // todo: cleanup. the escaping is wierd.
        return this.toString()
            .split(new RegExp(`\\${YI}(?=${firstWord}(?:${ZI}|\\${YI}))`, "g"))
            .map(str => new constructor(str));
    }
    toMarkdownTable() {
        return this.toMarkdownTableAdvanced(this._getUnionNames(), (val) => val);
    }
    toMarkdownTableAdvanced(columns, formatFn) {
        const matrix = this._getMatrix(columns);
        const empty = columns.map(col => "-");
        matrix.unshift(empty);
        matrix.unshift(columns);
        const lines = matrix.map((row, rowIndex) => {
            const formattedValues = row.map((val, colIndex) => formatFn(val, rowIndex, colIndex));
            return `|${formattedValues.join("|")}|`;
        });
        return lines.join("\n");
    }
    toTsv() {
        return this.toDelimited("\t");
    }
    getYI() {
        return "\n";
    }
    getZI() {
        return " ";
    }
    getYIRegex() {
        return new RegExp(this.getYI(), "g");
    }
    getXI() {
        return " ";
    }
    _textToContentAndChildrenTuple(text) {
        const lines = text.split(this.getYIRegex());
        const firstLine = lines.shift();
        const children = !lines.length
            ? undefined
            : lines
                .map(line => (line.substr(0, 1) === this.getXI() ? line : this.getXI() + line))
                .map(line => line.substr(1))
                .join(this.getYI());
        return [firstLine, children];
    }
    _getLine() {
        return this._line;
    }
    _setLine(line = "") {
        this._line = line;
        if (this._words)
            delete this._words;
        return this;
    }
    _clearChildren() {
        delete this._children;
        this._clearIndex();
        return this;
    }
    _setChildren(content, circularCheckArray) {
        this._clearChildren();
        if (!content)
            return this;
        // set from string
        if (typeof content === "string")
            return this._parseString(content);
        // set from tree object
        if (content instanceof ImmutableNode) {
            const me = this;
            content.forEach(node => {
                me._setLineAndChildren(node.getLine(), node.childrenToString());
            });
            return this;
        }
        // If we set from object, create an array of inserted objects to avoid circular loops
        if (!circularCheckArray)
            circularCheckArray = [content];
        return this._setFromObject(content, circularCheckArray);
    }
    _setFromObject(content, circularCheckArray) {
        for (let firstWord in content) {
            if (!content.hasOwnProperty(firstWord))
                continue;
            // Branch the circularCheckArray, as we only have same branch circular arrays
            this._appendFromJavascriptObjectTuple(firstWord, content[firstWord], circularCheckArray.slice(0));
        }
        return this;
    }
    // todo: refactor the below.
    _appendFromJavascriptObjectTuple(firstWord, content, circularCheckArray) {
        const type = typeof content;
        let line;
        let children;
        if (content === null)
            line = firstWord + " " + null;
        else if (content === undefined)
            line = firstWord;
        else if (type === "string") {
            const tuple = this._textToContentAndChildrenTuple(content);
            line = firstWord + " " + tuple[0];
            children = tuple[1];
        }
        else if (type === "function")
            line = firstWord + " " + content.toString();
        else if (type !== "object")
            line = firstWord + " " + content;
        else if (content instanceof Date)
            line = firstWord + " " + content.getTime().toString();
        else if (content instanceof ImmutableNode) {
            line = firstWord;
            children = new TreeNode(content.childrenToString(), content.getLine());
        }
        else if (circularCheckArray.indexOf(content) === -1) {
            circularCheckArray.push(content);
            line = firstWord;
            const length = content instanceof Array ? content.length : Object.keys(content).length;
            if (length)
                children = new TreeNode()._setChildren(content, circularCheckArray);
        }
        else {
            // iirc this is return early from circular
            return;
        }
        this._setLineAndChildren(line, children);
    }
    // todo: protected?
    _setLineAndChildren(line, children, index = this.length) {
        const nodeConstructor = this.getNodeConstructor(line);
        const newNode = new nodeConstructor(children, line, this);
        const adjustedIndex = index < 0 ? this.length + index : index;
        this._getChildrenArray().splice(adjustedIndex, 0, newNode);
        if (this._index)
            this._makeIndex(adjustedIndex);
        return newNode;
    }
    _parseString(str) {
        const lines = str.split(this.getYIRegex());
        const parentStack = [];
        let currentIndentCount = -1;
        let lastNode = this;
        lines.forEach(line => {
            const indentCount = this._getIndentCount(line);
            if (indentCount > currentIndentCount) {
                currentIndentCount++;
                parentStack.push(lastNode);
            }
            else if (indentCount < currentIndentCount) {
                // pop things off stack
                while (indentCount < currentIndentCount) {
                    parentStack.pop();
                    currentIndentCount--;
                }
            }
            const lineContent = line.substr(currentIndentCount);
            const parent = parentStack[parentStack.length - 1];
            const nodeConstructor = parent.getNodeConstructor(lineContent);
            lastNode = new nodeConstructor(undefined, lineContent, parent);
            parent._getChildrenArray().push(lastNode);
        });
        return this;
    }
    _getIndex() {
        // StringMap<int> {firstWord: index}
        // When there are multiple tails with the same firstWord, _index stores the last content.
        // todo: change the above behavior: when a collision occurs, create an array.
        return this._index || this._makeIndex();
    }
    getContentsArray() {
        return this.map(node => node.getContent());
    }
    // todo: rename to getChildrenByConstructor(?)
    getChildrenByNodeConstructor(constructor) {
        return this.filter(child => child instanceof constructor);
    }
    // todo: rename to getNodeByConstructor(?)
    getNodeByType(constructor) {
        return this.find(child => child instanceof constructor);
    }
    indexOfLast(firstWord) {
        const result = this._getIndex()[firstWord];
        return result === undefined ? -1 : result;
    }
    // todo: renmae to indexOfFirst?
    indexOf(firstWord) {
        if (!this.has(firstWord))
            return -1;
        const length = this.length;
        const nodes = this._getChildren();
        for (let index = 0; index < length; index++) {
            if (nodes[index].getFirstWord() === firstWord)
                return index;
        }
    }
    toObject() {
        return this._toObject();
    }
    getFirstWords() {
        return this.map(node => node.getFirstWord());
    }
    _makeIndex(startAt = 0) {
        if (!this._index || !startAt)
            this._index = {};
        const nodes = this._getChildren();
        const newIndex = this._index;
        const length = nodes.length;
        for (let index = startAt; index < length; index++) {
            newIndex[nodes[index].getFirstWord()] = index;
        }
        return newIndex;
    }
    _childrenToXml(indentCount) {
        return this.map(node => node._toXml(indentCount)).join("");
    }
    _getIndentCount(str) {
        let level = 0;
        const edgeChar = this.getXI();
        while (str[level] === edgeChar) {
            level++;
        }
        return level;
    }
    clone() {
        return new this.constructor(this.childrenToString(), this.getLine());
    }
    // todo: rename to hasFirstWord
    has(firstWord) {
        return this._hasFirstWord(firstWord);
    }
    _hasFirstWord(firstWord) {
        return this._getIndex()[firstWord] !== undefined;
    }
    map(fn) {
        return this.getChildren().map(fn);
    }
    filter(fn) {
        return this.getChildren().filter(fn);
    }
    find(fn) {
        return this.getChildren().find(fn);
    }
    every(fn) {
        let index = 0;
        for (let node of this.getTopDownArrayIterator()) {
            if (!fn(node, index))
                return false;
            index++;
        }
        return true;
    }
    forEach(fn) {
        this.getChildren().forEach(fn);
        return this;
    }
    // todo: protected?
    _clearIndex() {
        delete this._index;
    }
    slice(start, end) {
        return this.getChildren().slice(start, end);
    }
    getFirstWordMap() {
        return {};
    }
    getCatchAllNodeConstructor(line) {
        return this.constructor;
    }
    // todo: make 0 and 1 a param
    getInheritanceTree() {
        const paths = {};
        const result = new TreeNode();
        this.forEach(node => {
            const key = node.getWord(0);
            const parentKey = node.getWord(1);
            const parentPath = paths[parentKey];
            paths[key] = parentPath ? [parentPath, key].join(" ") : key;
            result.touchNode(paths[key]);
        });
        return result;
    }
    _getGrandParent() {
        return this.isRoot() || this.getParent().isRoot() ? undefined : this.getParent().getParent();
    }
    _getFirstWord(line) {
        const firstBreak = line.indexOf(this.getZI());
        return line.substr(0, firstBreak > -1 ? firstBreak : undefined);
    }
    getNodeConstructor(line) {
        return this.getFirstWordMap()[this._getFirstWord(line)] || this.getCatchAllNodeConstructor(line);
    }
    static _makeUniqueId() {
        if (this._uniqueId === undefined)
            this._uniqueId = 0;
        this._uniqueId++;
        return this._uniqueId;
    }
    static _getFileFormat(path) {
        const format = path.split(".").pop();
        return FileFormat[format] ? format : FileFormat.tree;
    }
}
ImmutableNode.iris = `sepal_length,sepal_width,petal_length,petal_width,species
6.1,3,4.9,1.8,virginica
5.6,2.7,4.2,1.3,versicolor
5.6,2.8,4.9,2,virginica
6.2,2.8,4.8,1.8,virginica
7.7,3.8,6.7,2.2,virginica
5.3,3.7,1.5,0.2,setosa
6.2,3.4,5.4,2.3,virginica
4.9,2.5,4.5,1.7,virginica
5.1,3.5,1.4,0.2,setosa
5,3.4,1.5,0.2,setosa`;
class TreeNode extends ImmutableNode {
    getMTime() {
        if (!this._mtime)
            this._updateMTime();
        return this._mtime;
    }
    _getChildrenMTime() {
        const mTimes = this.map(child => child.getTreeMTime());
        const cmTime = this._getCMTime();
        if (cmTime)
            mTimes.push(cmTime);
        const newestTime = Math.max.apply(null, mTimes);
        return this._setCMTime(newestTime || this._getProcessTimeInMilliseconds())._getCMTime();
    }
    _getCMTime() {
        return this._cmtime;
    }
    _setCMTime(value) {
        this._cmtime = value;
        return this;
    }
    getTreeMTime() {
        const mtime = this.getMTime();
        const cmtime = this._getChildrenMTime();
        return Math.max(mtime, cmtime);
    }
    _setVirtualParentTree(tree) {
        this._virtualParentTree = tree;
        return this;
    }
    _getVirtualParentTreeNode() {
        return this._virtualParentTree;
    }
    _setVirtualAncestorNodesByInheritanceViaColumnIndicesAndThenExpand(nodes, thisIdColumnNumber, extendsIdColumnNumber) {
        const map = {};
        for (let node of nodes) {
            const nodeId = node.getWord(thisIdColumnNumber);
            if (map[nodeId])
                throw new Error(`Tried to define a node with id "${nodeId}" but one is already defined.`);
            map[nodeId] = {
                nodeId: nodeId,
                node: node,
                parentId: node.getWord(extendsIdColumnNumber)
            };
        }
        // Add parent Nodes
        Object.values(map).forEach(nodeInfo => {
            const parentId = nodeInfo.parentId;
            const parentNode = map[parentId];
            if (parentId && !parentNode)
                throw new Error(`Node "${nodeInfo.nodeId}" tried to extend "${parentId}" but "${parentId}" not found.`);
            if (parentId)
                nodeInfo.node._setVirtualParentTree(parentNode.node);
        });
        nodes.forEach(node => node._expandFromVirtualParentTree());
        return this;
    }
    _expandFromVirtualParentTree() {
        if (this._isVirtualExpanded)
            return this;
        this._isExpanding = true;
        let parentNode = this._getVirtualParentTreeNode();
        if (parentNode) {
            if (parentNode._isExpanding)
                throw new Error(`Loop detected: '${this.getLine()}' is the ancestor of one of its ancestors.`);
            parentNode._expandFromVirtualParentTree();
            const clone = this.clone();
            this._setChildren(parentNode.childrenToString());
            this.extend(clone);
        }
        this._isExpanding = false;
        this._isVirtualExpanded = true;
    }
    // todo: solve issue related to whether extend should overwrite or append.
    _expandChildren(thisIdColumnNumber, extendsIdColumnNumber, childrenThatNeedExpanding = this.getChildren()) {
        return this._setVirtualAncestorNodesByInheritanceViaColumnIndicesAndThenExpand(childrenThatNeedExpanding, thisIdColumnNumber, extendsIdColumnNumber);
    }
    // todo: add more testing.
    // todo: solve issue with where extend should overwrite or append
    // todo: should take a grammar? to decide whether to overwrite or append.
    // todo: this is slow.
    extend(nodeOrStr) {
        if (!(nodeOrStr instanceof TreeNode))
            nodeOrStr = new TreeNode(nodeOrStr);
        const usedFirstWords = new Set();
        nodeOrStr.forEach(sourceNode => {
            const firstWord = sourceNode.getFirstWord();
            let targetNode;
            const isAnArrayNotMap = usedFirstWords.has(firstWord);
            if (!this.has(firstWord)) {
                usedFirstWords.add(firstWord);
                this.appendLineAndChildren(sourceNode.getLine(), sourceNode.childrenToString());
                return true;
            }
            if (isAnArrayNotMap)
                targetNode = this.appendLine(sourceNode.getLine());
            else {
                targetNode = this.touchNode(firstWord).setContent(sourceNode.getContent());
                usedFirstWords.add(firstWord);
            }
            if (sourceNode.length)
                targetNode.extend(sourceNode);
        });
        return this;
    }
    macroExpand(macroDefinitionWord, macroUsageWord) {
        const clone = this.clone();
        const defs = clone.findNodes(macroDefinitionWord);
        const allUses = clone.findNodes(macroUsageWord);
        const zi = clone.getZI();
        defs.forEach(def => {
            const macroName = def.getWord(1);
            const uses = allUses.filter(node => node.hasWord(1, macroName));
            const params = def.getWordsFrom(2);
            const replaceFn = (str) => {
                const paramValues = str.split(zi).slice(2);
                let newTree = def.childrenToString();
                params.forEach((param, index) => {
                    newTree = newTree.replace(new RegExp(param, "g"), paramValues[index]);
                });
                return newTree;
            };
            uses.forEach(node => {
                node.replaceNode(replaceFn);
            });
            def.destroy();
        });
        return clone;
    }
    setChildren(children) {
        return this._setChildren(children);
    }
    _updateMTime() {
        this._mtime = this._getProcessTimeInMilliseconds();
    }
    insertWord(index, word) {
        const wi = this.getZI();
        const words = this._getLine().split(wi);
        words.splice(index, 0, word);
        this.setLine(words.join(wi));
        return this;
    }
    deleteDuplicates() {
        const set = new Set();
        this.getTopDownArray().forEach(node => {
            const str = node.toString();
            if (set.has(str))
                node.destroy();
            else
                set.add(str);
        });
        return this;
    }
    setWord(index, word) {
        const wi = this.getZI();
        const words = this._getLine().split(wi);
        words[index] = word;
        this.setLine(words.join(wi));
        return this;
    }
    deleteChildren() {
        return this._clearChildren();
    }
    setContent(content) {
        if (content === this.getContent())
            return this;
        const newArray = [this.getFirstWord()];
        if (content !== undefined) {
            content = content.toString();
            if (content.match(this.getYI()))
                return this.setContentWithChildren(content);
            newArray.push(content);
        }
        this._updateMTime();
        return this._setLine(newArray.join(this.getZI()));
    }
    setContentWithChildren(text) {
        // todo: deprecate
        if (!text.includes(this.getYI())) {
            this._clearChildren();
            return this.setContent(text);
        }
        const lines = text.split(this.getYIRegex());
        const firstLine = lines.shift();
        this.setContent(firstLine);
        // tood: cleanup.
        const remainingString = lines.join(this.getYI());
        const children = new TreeNode(remainingString);
        if (!remainingString)
            children.appendLine("");
        this.setChildren(children);
        return this;
    }
    setFirstWord(firstWord) {
        return this.setWord(0, firstWord);
    }
    setLine(line) {
        if (line === this.getLine())
            return this;
        this._updateMTime();
        // todo: clear parent TMTimes
        this.getParent()._clearIndex();
        return this._setLine(line);
    }
    duplicate() {
        return this.getParent()._setLineAndChildren(this.getLine(), this.childrenToString(), this.getIndex() + 1);
    }
    destroy() {
        ;
        this.getParent()._deleteNode(this);
    }
    set(firstWordPath, text) {
        return this.touchNode(firstWordPath).setContentWithChildren(text);
    }
    setFromText(text) {
        if (this.toString() === text)
            return this;
        const tuple = this._textToContentAndChildrenTuple(text);
        this.setLine(tuple[0]);
        return this._setChildren(tuple[1]);
    }
    // todo: throw error if line contains a \n
    appendLine(line) {
        return this._setLineAndChildren(line);
    }
    appendLineAndChildren(line, children) {
        return this._setLineAndChildren(line, children);
    }
    getNodesByRegex(regex) {
        const matches = [];
        regex = regex instanceof RegExp ? [regex] : regex;
        this._getNodesByLineRegex(matches, regex);
        return matches;
    }
    getNodesByLinePrefixes(columns) {
        const matches = [];
        this._getNodesByLineRegex(matches, columns.map(str => new RegExp("^" + str)));
        return matches;
    }
    _getNodesByLineRegex(matches, regs) {
        const rgs = regs.slice(0);
        const reg = rgs.shift();
        const candidates = this.filter(child => child.getLine().match(reg));
        if (!rgs.length)
            return candidates.forEach(cand => matches.push(cand));
        candidates.forEach(cand => cand._getNodesByLineRegex(matches, rgs));
    }
    concat(node) {
        if (typeof node === "string")
            node = new TreeNode(node);
        return node.map(node => this._setLineAndChildren(node.getLine(), node.childrenToString()));
    }
    _deleteByIndexes(indexesToDelete) {
        this._clearIndex();
        // note: assumes indexesToDelete is in ascending order
        indexesToDelete.reverse().forEach(index => this._getChildrenArray().splice(index, 1));
        return this._setCMTime(this._getProcessTimeInMilliseconds());
    }
    _deleteNode(node) {
        const index = this._indexOfNode(node);
        return index > -1 ? this._deleteByIndexes([index]) : 0;
    }
    reverse() {
        this._clearIndex();
        this._getChildrenArray().reverse();
        return this;
    }
    shift() {
        if (!this.length)
            return null;
        const node = this._getChildrenArray().shift();
        return node.copyTo(new this.constructor(), 0);
    }
    sort(fn) {
        this._getChildrenArray().sort(fn);
        this._clearIndex();
        return this;
    }
    invert() {
        this.forEach(node => node.getWords().reverse());
        return this;
    }
    _rename(oldFirstWord, newFirstWord) {
        const index = this.indexOf(oldFirstWord);
        if (index === -1)
            return this;
        const node = this._getChildren()[index];
        node.setFirstWord(newFirstWord);
        this._clearIndex();
        return this;
    }
    // Does not recurse.
    remap(map) {
        this.forEach(node => {
            const firstWord = node.getFirstWord();
            if (map[firstWord] !== undefined)
                node.setFirstWord(map[firstWord]);
        });
        return this;
    }
    rename(oldFirstWord, newFirstWord) {
        this._rename(oldFirstWord, newFirstWord);
        return this;
    }
    renameAll(oldName, newName) {
        this.findNodes(oldName).forEach(node => node.setFirstWord(newName));
        return this;
    }
    _deleteAllChildNodesWithFirstWord(firstWord) {
        if (!this.has(firstWord))
            return this;
        const allNodes = this._getChildren();
        const indexesToDelete = [];
        allNodes.forEach((node, index) => {
            if (node.getFirstWord() === firstWord)
                indexesToDelete.push(index);
        });
        return this._deleteByIndexes(indexesToDelete);
    }
    delete(path = "") {
        const xi = this.getXI();
        if (!path.includes(xi))
            return this._deleteAllChildNodesWithFirstWord(path);
        const parts = path.split(xi);
        const nextFirstWord = parts.pop();
        const targetNode = this.getNode(parts.join(xi));
        return targetNode ? targetNode._deleteAllChildNodesWithFirstWord(nextFirstWord) : 0;
    }
    deleteColumn(firstWord = "") {
        this.forEach(node => node.delete(firstWord));
        return this;
    }
    _getNonMaps() {
        const results = this.getTopDownArray().filter(node => node.hasDuplicateFirstWords());
        if (this.hasDuplicateFirstWords())
            results.unshift(this);
        return results;
    }
    replaceNode(fn) {
        const parent = this.getParent();
        const index = this.getIndex();
        const newNodes = new TreeNode(fn(this.toString()));
        const returnedNodes = [];
        newNodes.forEach((child, childIndex) => {
            const newNode = parent.insertLineAndChildren(child.getLine(), child.childrenToString(), index + childIndex);
            returnedNodes.push(newNode);
        });
        this.destroy();
        return returnedNodes;
    }
    insertLineAndChildren(line, children, index) {
        return this._setLineAndChildren(line, children, index);
    }
    insertLine(line, index) {
        return this._setLineAndChildren(line, undefined, index);
    }
    prependLine(line) {
        return this.insertLine(line, 0);
    }
    pushContentAndChildren(content, children) {
        let index = this.length;
        while (this.has(index.toString())) {
            index++;
        }
        const line = index.toString() + (content === undefined ? "" : this.getZI() + content);
        return this.appendLineAndChildren(line, children);
    }
    deleteBlanks() {
        this.getChildren()
            .filter(node => node.isBlankLine())
            .forEach(node => node.destroy());
        return this;
    }
    // todo: add "globalReplace" method? Which runs a global regex or string replace on the Tree doc as a string?
    firstWordSort(firstWordOrder) {
        return this._firstWordSort(firstWordOrder);
    }
    deleteWordAt(wordIndex) {
        const words = this.getWords();
        words.splice(wordIndex, 1);
        return this.setWords(words);
    }
    setWords(words) {
        return this.setLine(words.join(this.getZI()));
    }
    setWordsFrom(index, words) {
        this.setWords(this.getWords()
            .slice(0, index)
            .concat(words));
        return this;
    }
    appendWord(word) {
        const words = this.getWords();
        words.push(word);
        return this.setWords(words);
    }
    _firstWordSort(firstWordOrder, secondarySortFn) {
        const map = {};
        firstWordOrder.forEach((word, index) => {
            map[word] = index;
        });
        this.sort((nodeA, nodeB) => {
            const valA = map[nodeA.getFirstWord()];
            const valB = map[nodeB.getFirstWord()];
            if (valA > valB)
                return 1;
            if (valA < valB)
                return -1; // A comes first
            return secondarySortFn ? secondarySortFn(nodeA, nodeB) : 0;
        });
        return this;
    }
    _touchNode(firstWordPathArray) {
        let contextNode = this;
        firstWordPathArray.forEach(firstWord => {
            contextNode = contextNode.getNode(firstWord) || contextNode.appendLine(firstWord);
        });
        return contextNode;
    }
    _touchNodeByString(str) {
        str = str.replace(this.getYIRegex(), ""); // todo: do we want to do this sanitization?
        return this._touchNode(str.split(this.getZI()));
    }
    touchNode(str) {
        return this._touchNodeByString(str);
    }
    appendNode(node) {
        return this.appendLineAndChildren(node.getLine(), node.childrenToString());
    }
    hasLine(line) {
        return this.getChildren().some(node => node.getLine() === line);
    }
    getNodesByLine(line) {
        return this.filter(node => node.getLine() === line);
    }
    toggleLine(line) {
        const lines = this.getNodesByLine(line);
        if (lines.length) {
            lines.map(line => line.destroy());
            return this;
        }
        return this.appendLine(line);
    }
    // todo: remove?
    sortByColumns(indexOrIndices) {
        const indices = indexOrIndices instanceof Array ? indexOrIndices : [indexOrIndices];
        const length = indices.length;
        this.sort((nodeA, nodeB) => {
            const wordsA = nodeA.getWords();
            const wordsB = nodeB.getWords();
            for (let index = 0; index < length; index++) {
                const col = indices[index];
                const av = wordsA[col];
                const bv = wordsB[col];
                if (av === undefined)
                    return -1;
                if (bv === undefined)
                    return 1;
                if (av > bv)
                    return 1;
                else if (av < bv)
                    return -1;
            }
            return 0;
        });
        return this;
    }
    shiftLeft() {
        const grandParent = this._getGrandParent();
        if (!grandParent)
            return this;
        const parentIndex = this.getParent().getIndex();
        const newNode = grandParent.insertLineAndChildren(this.getLine(), this.length ? this.childrenToString() : undefined, parentIndex + 1);
        this.destroy();
        return newNode;
    }
    shiftRight() {
        const olderSibling = this._getClosestOlderSibling();
        if (!olderSibling)
            return this;
        const newNode = olderSibling.appendLineAndChildren(this.getLine(), this.length ? this.childrenToString() : undefined);
        this.destroy();
        return newNode;
    }
    shiftYoungerSibsRight() {
        const nodes = this.getYoungerSiblings();
        nodes.forEach(node => node.shiftRight());
        return this;
    }
    sortBy(nameOrNames) {
        const names = nameOrNames instanceof Array ? nameOrNames : [nameOrNames];
        const length = names.length;
        this.sort((nodeA, nodeB) => {
            if (!nodeB.length && !nodeA.length)
                return 0;
            else if (!nodeA.length)
                return -1;
            else if (!nodeB.length)
                return 1;
            for (let index = 0; index < length; index++) {
                const firstWord = names[index];
                const av = nodeA.get(firstWord);
                const bv = nodeB.get(firstWord);
                if (av > bv)
                    return 1;
                else if (av < bv)
                    return -1;
            }
            return 0;
        });
        return this;
    }
    static fromCsv(str) {
        return this.fromDelimited(str, ",", '"');
    }
    static fromJsonSubset(str) {
        return new TreeNode(JSON.parse(str));
    }
    static fromSsv(str) {
        return this.fromDelimited(str, " ", '"');
    }
    static fromTsv(str) {
        return this.fromDelimited(str, "\t", '"');
    }
    static fromDelimited(str, delimiter, quoteChar) {
        const rows = this._getEscapedRows(str, delimiter, quoteChar);
        return this._rowsToTreeNode(rows, delimiter, true);
    }
    static _getEscapedRows(str, delimiter, quoteChar) {
        return str.includes(quoteChar) ? this._strToRows(str, delimiter, quoteChar) : str.split("\n").map(line => line.split(delimiter));
    }
    static fromDelimitedNoHeaders(str, delimiter, quoteChar) {
        const rows = this._getEscapedRows(str, delimiter, quoteChar);
        return this._rowsToTreeNode(rows, delimiter, false);
    }
    static _strToRows(str, delimiter, quoteChar, newLineChar = "\n") {
        const rows = [[]];
        const newLine = "\n";
        const length = str.length;
        let currentCell = "";
        let inQuote = str.substr(0, 1) === quoteChar;
        let currentPosition = inQuote ? 1 : 0;
        let nextChar;
        let isLastChar;
        let currentRow = 0;
        let char;
        let isNextCharAQuote;
        while (currentPosition < length) {
            char = str[currentPosition];
            isLastChar = currentPosition + 1 === length;
            nextChar = str[currentPosition + 1];
            isNextCharAQuote = nextChar === quoteChar;
            if (inQuote) {
                if (char !== quoteChar)
                    currentCell += char;
                else if (isNextCharAQuote) {
                    // Both the current and next char are ", so the " is escaped
                    currentCell += nextChar;
                    currentPosition++; // Jump 2
                }
                else {
                    // If the current char is a " and the next char is not, it's the end of the quotes
                    inQuote = false;
                    if (isLastChar)
                        rows[currentRow].push(currentCell);
                }
            }
            else {
                if (char === delimiter) {
                    rows[currentRow].push(currentCell);
                    currentCell = "";
                    if (isNextCharAQuote) {
                        inQuote = true;
                        currentPosition++; // Jump 2
                    }
                }
                else if (char === newLine) {
                    rows[currentRow].push(currentCell);
                    currentCell = "";
                    currentRow++;
                    if (nextChar)
                        rows[currentRow] = [];
                    if (isNextCharAQuote) {
                        inQuote = true;
                        currentPosition++; // Jump 2
                    }
                }
                else if (isLastChar)
                    rows[currentRow].push(currentCell + char);
                else
                    currentCell += char;
            }
            currentPosition++;
        }
        return rows;
    }
    static multiply(nodeA, nodeB) {
        const productNode = nodeA.clone();
        productNode.forEach((node, index) => {
            node.setChildren(node.length ? this.multiply(node, nodeB) : nodeB.clone());
        });
        return productNode;
    }
    // Given an array return a tree
    static _rowsToTreeNode(rows, delimiter, hasHeaders) {
        const numberOfColumns = rows[0].length;
        const treeNode = new TreeNode();
        const names = this._getHeader(rows, hasHeaders);
        const rowCount = rows.length;
        for (let rowIndex = hasHeaders ? 1 : 0; rowIndex < rowCount; rowIndex++) {
            let row = rows[rowIndex];
            // If the row contains too many columns, shift the extra columns onto the last one.
            // This allows you to not have to escape delimiter characters in the final column.
            if (row.length > numberOfColumns) {
                row[numberOfColumns - 1] = row.slice(numberOfColumns - 1).join(delimiter);
                row = row.slice(0, numberOfColumns);
            }
            else if (row.length < numberOfColumns) {
                // If the row is missing columns add empty columns until it is full.
                // This allows you to make including delimiters for empty ending columns in each row optional.
                while (row.length < numberOfColumns) {
                    row.push("");
                }
            }
            const obj = {};
            row.forEach((cellValue, index) => {
                obj[names[index]] = cellValue;
            });
            treeNode.pushContentAndChildren(undefined, obj);
        }
        return treeNode;
    }
    static _initializeXmlParser() {
        if (this._xmlParser)
            return;
        const windowObj = window;
        if (typeof windowObj.DOMParser !== "undefined")
            this._xmlParser = (xmlStr) => new windowObj.DOMParser().parseFromString(xmlStr, "text/xml");
        else if (typeof windowObj.ActiveXObject !== "undefined" && new windowObj.ActiveXObject("Microsoft.XMLDOM")) {
            this._xmlParser = (xmlStr) => {
                const xmlDoc = new windowObj.ActiveXObject("Microsoft.XMLDOM");
                xmlDoc.async = "false";
                xmlDoc.loadXML(xmlStr);
                return xmlDoc;
            };
        }
        else
            throw new Error("No XML parser found");
    }
    static fromXml(str) {
        this._initializeXmlParser();
        const xml = this._xmlParser(str);
        try {
            return this._treeNodeFromXml(xml).getNode("children");
        }
        catch (err) {
            return this._treeNodeFromXml(this._parseXml2(str)).getNode("children");
        }
    }
    static _zipObject(keys, values) {
        const obj = {};
        keys.forEach((key, index) => (obj[key] = values[index]));
        return obj;
    }
    static fromShape(shapeArr, rootNode = new TreeNode()) {
        const part = shapeArr.shift();
        if (part !== undefined) {
            for (let index = 0; index < part; index++) {
                rootNode.appendLine(index.toString());
            }
        }
        if (shapeArr.length)
            rootNode.forEach(node => TreeNode.fromShape(shapeArr.slice(0), node));
        return rootNode;
    }
    static fromDataTable(table) {
        const header = table.shift();
        return new TreeNode(table.map(row => this._zipObject(header, row)));
    }
    static _parseXml2(str) {
        const el = document.createElement("div");
        el.innerHTML = str;
        return el;
    }
    // todo: cleanup typings
    static _treeNodeFromXml(xml) {
        const result = new TreeNode();
        const children = new TreeNode();
        // Set attributes
        if (xml.attributes) {
            for (let index = 0; index < xml.attributes.length; index++) {
                result.set(xml.attributes[index].name, xml.attributes[index].value);
            }
        }
        if (xml.data)
            children.pushContentAndChildren(xml.data);
        // Set content
        if (xml.childNodes && xml.childNodes.length > 0) {
            for (let index = 0; index < xml.childNodes.length; index++) {
                const child = xml.childNodes[index];
                if (child.tagName && child.tagName.match(/parsererror/i))
                    throw new Error("Parse Error");
                if (child.childNodes.length > 0 && child.tagName)
                    children.appendLineAndChildren(child.tagName, this._treeNodeFromXml(child));
                else if (child.tagName)
                    children.appendLine(child.tagName);
                else if (child.data) {
                    const data = child.data.trim();
                    if (data)
                        children.pushContentAndChildren(data);
                }
            }
        }
        if (children.length > 0)
            result.touchNode("children").setChildren(children);
        return result;
    }
    static _getHeader(rows, hasHeaders) {
        const numberOfColumns = rows[0].length;
        const headerRow = hasHeaders ? rows[0] : [];
        const ZI = " ";
        const ziRegex = new RegExp(ZI, "g");
        if (hasHeaders) {
            // Strip any ZIs from column names in the header row.
            // This makes the mapping not quite 1 to 1 if there are any ZIs in names.
            for (let index = 0; index < numberOfColumns; index++) {
                headerRow[index] = headerRow[index].replace(ziRegex, "");
            }
        }
        else {
            // If str has no headers, create them as 0,1,2,3
            for (let index = 0; index < numberOfColumns; index++) {
                headerRow.push(index.toString());
            }
        }
        return headerRow;
    }
    static nest(str, xValue) {
        const YI = "\n";
        const XI = " ";
        const indent = YI + XI.repeat(xValue);
        return str ? indent + str.replace(/\n/g, indent) : "";
    }
    static fromDisk(path) {
        const format = this._getFileFormat(path);
        const content = require("fs").readFileSync(path, "utf8");
        const methods = {
            tree: (content) => new TreeNode(content),
            csv: (content) => this.fromCsv(content),
            tsv: (content) => this.fromTsv(content)
        };
        return methods[format](content);
    }
}
var GrammarConstantsCompiler;
(function (GrammarConstantsCompiler) {
    GrammarConstantsCompiler["stringTemplate"] = "stringTemplate";
    GrammarConstantsCompiler["indentCharacter"] = "indentCharacter";
    GrammarConstantsCompiler["catchAllCellDelimiter"] = "catchAllCellDelimiter";
    GrammarConstantsCompiler["openChildren"] = "openChildren";
    GrammarConstantsCompiler["joinChildrenWith"] = "joinChildrenWith";
    GrammarConstantsCompiler["closeChildren"] = "closeChildren";
})(GrammarConstantsCompiler || (GrammarConstantsCompiler = {}));
var GrammarStandardCellTypeIds;
(function (GrammarStandardCellTypeIds) {
    GrammarStandardCellTypeIds["any"] = "any";
    GrammarStandardCellTypeIds["anyFirstWord"] = "anyFirstWord";
    GrammarStandardCellTypeIds["extraWord"] = "extraWord";
    GrammarStandardCellTypeIds["float"] = "float";
    GrammarStandardCellTypeIds["number"] = "number";
    GrammarStandardCellTypeIds["bit"] = "bit";
    GrammarStandardCellTypeIds["bool"] = "bool";
    GrammarStandardCellTypeIds["int"] = "int";
})(GrammarStandardCellTypeIds || (GrammarStandardCellTypeIds = {}));
var GrammarConstantsConstantTypes;
(function (GrammarConstantsConstantTypes) {
    GrammarConstantsConstantTypes["boolean"] = "boolean";
    GrammarConstantsConstantTypes["string"] = "string";
    GrammarConstantsConstantTypes["int"] = "int";
    GrammarConstantsConstantTypes["float"] = "float";
})(GrammarConstantsConstantTypes || (GrammarConstantsConstantTypes = {}));
var GrammarConstants;
(function (GrammarConstants) {
    // node types
    GrammarConstants["extensions"] = "extensions";
    GrammarConstants["toolingDirective"] = "tooling";
    GrammarConstants["todoComment"] = "todo";
    GrammarConstants["version"] = "version";
    GrammarConstants["nodeTypeOrder"] = "nodeTypeOrder";
    GrammarConstants["nodeType"] = "nodeType";
    GrammarConstants["cellType"] = "cellType";
    // error check time
    GrammarConstants["regex"] = "regex";
    GrammarConstants["reservedWords"] = "reservedWords";
    GrammarConstants["enumFromGrammar"] = "enumFromGrammar";
    GrammarConstants["enum"] = "enum";
    // baseNodeTypes
    GrammarConstants["baseNodeType"] = "baseNodeType";
    GrammarConstants["blobNode"] = "blobNode";
    GrammarConstants["errorNode"] = "errorNode";
    GrammarConstants["terminalNode"] = "terminalNode";
    GrammarConstants["nonTerminalNode"] = "nonTerminalNode";
    // parse time
    GrammarConstants["extends"] = "extends";
    GrammarConstants["abstract"] = "abstract";
    GrammarConstants["root"] = "root";
    GrammarConstants["match"] = "match";
    GrammarConstants["inScope"] = "inScope";
    GrammarConstants["cells"] = "cells";
    GrammarConstants["catchAllCellType"] = "catchAllCellType";
    GrammarConstants["firstCellType"] = "firstCellType";
    GrammarConstants["catchAllNodeType"] = "catchAllNodeType";
    GrammarConstants["constants"] = "constants";
    GrammarConstants["required"] = "required";
    GrammarConstants["single"] = "single";
    GrammarConstants["tags"] = "tags";
    // code
    GrammarConstants["javascript"] = "javascript";
    // compile time
    GrammarConstants["compilerNodeType"] = "compiler";
    GrammarConstants["compilesTo"] = "compilesTo";
    // develop time
    GrammarConstants["description"] = "description";
    GrammarConstants["example"] = "example";
    GrammarConstants["frequency"] = "frequency";
    GrammarConstants["highlightScope"] = "highlightScope";
})(GrammarConstants || (GrammarConstants = {}));
class GrammarBackedNode extends TreeNode {
    getAutocompleteResults(partialWord, cellIndex) {
        return cellIndex === 0 ? this._getAutocompleteResultsForFirstWord(partialWord) : this._getAutocompleteResultsForCell(partialWord, cellIndex);
    }
    getChildInstancesOfNodeTypeId(nodeTypeId) {
        return this.filter(node => node.doesExtend(nodeTypeId));
    }
    doesExtend(nodeTypeId) {
        return this.getDefinition()._doesExtend(nodeTypeId);
    }
    _getAutocompleteResultsForFirstWord(partialWord) {
        let defs = Object.values(this.getDefinition().getRunTimeFirstWordMapWithDefinitions());
        if (partialWord)
            defs = defs.filter(def => def._getFirstWordMatch().includes(partialWord));
        return defs.map(def => {
            const id = def._getFirstWordMatch();
            const description = def.getDescription();
            return {
                text: id,
                displayText: id + (description ? " " + description : "")
            };
        });
    }
    _getAutocompleteResultsForCell(partialWord, cellIndex) {
        // todo: root should be [] correct?
        const cell = this._getGrammarBackedCellArray()[cellIndex];
        return cell ? cell.getAutoCompleteWords(partialWord) : [];
    }
    getFirstWordMap() {
        return this.getDefinition().getRunTimeFirstWordMap();
    }
    getCatchAllNodeConstructor(line) {
        return this.getDefinition().getRunTimeCatchAllNodeConstructor();
    }
    _getGrammarBackedCellArray() {
        return [];
    }
    getRunTimeEnumOptions(cell) {
        return undefined;
    }
    _getRequiredNodeErrors(errors = []) {
        Object.values(this.getDefinition().getRunTimeFirstWordMapWithDefinitions()).forEach(def => {
            if (def.isRequired()) {
                const firstWord = def._getFirstWordMatch();
                if (!this.has(firstWord))
                    errors.push(new MissingRequiredNodeTypeError(this, firstWord));
            }
        });
        return errors;
    }
}
class GrammarBackedRootNode extends GrammarBackedNode {
    getRootProgramNode() {
        return this;
    }
    getDefinition() {
        return this.getGrammarProgramRoot();
    }
    getInPlaceCellTypeTree() {
        return this.getTopDownArray()
            .map(child => child.getIndentation() + child.getLineCellTypes())
            .join("\n");
    }
    getAllErrors() {
        return this._getRequiredNodeErrors(super.getAllErrors());
    }
    // Helper method for selecting potential nodeTypes needed to update grammar file.
    getInvalidNodeTypes() {
        return Array.from(new Set(this.getAllErrors()
            .filter(err => err instanceof UnknownNodeTypeError)
            .map(err => err.getNode().getFirstWord())));
    }
    updateNodeTypeIds(nodeTypeMap) {
        if (typeof nodeTypeMap === "string")
            nodeTypeMap = new TreeNode(nodeTypeMap);
        if (nodeTypeMap instanceof TreeNode)
            nodeTypeMap = nodeTypeMap.toObject();
        const renames = [];
        for (let node of this.getTopDownArrayIterator()) {
            const nodeTypeId = node.getNodeTypeId();
            const newId = nodeTypeMap[nodeTypeId];
            if (newId)
                renames.push([node, newId]);
        }
        renames.forEach(pair => pair[0].setFirstWord(pair[1]));
        return this;
    }
    getAllSuggestions() {
        return new TreeNode(this.getAllWordBoundaryCoordinates().map(coordinate => {
            const results = this.getAutocompleteResultsAt(coordinate.y, coordinate.x);
            return {
                line: coordinate.y,
                char: coordinate.x,
                word: results.word,
                suggestions: results.matches.map(m => m.text).join(" ")
            };
        })).toTable();
    }
    getAutocompleteResultsAt(lineIndex, charIndex) {
        const lineNode = this.nodeAtLine(lineIndex) || this;
        const nodeInScope = lineNode.getNodeInScopeAtCharIndex(charIndex);
        // todo: add more tests
        // todo: second param this.childrenToString()
        // todo: change to getAutocomplete definitions
        const wordIndex = lineNode.getWordIndexAtCharacterIndex(charIndex);
        const wordProperties = lineNode.getWordProperties(wordIndex);
        return {
            startCharIndex: wordProperties.startCharIndex,
            endCharIndex: wordProperties.endCharIndex,
            word: wordProperties.word,
            matches: nodeInScope.getAutocompleteResults(wordProperties.word, wordIndex)
        };
    }
    getPrettified() {
        const nodeTypeOrder = this.getGrammarProgramRoot().getNodeTypeOrder();
        const clone = this.clone();
        const isCondensed = this.getGrammarProgramRoot().getGrammarName() === "grammar"; // todo: generalize?
        clone._firstWordSort(nodeTypeOrder.split(" "), isCondensed ? TreeUtils._makeGraphSortFunction(node => node.getWord(1), node => node.get(GrammarConstants.extends)) : undefined);
        return clone.toString();
    }
    getNodeTypeUsage(filepath = "") {
        // returns a report on what nodeTypes from its language the program uses
        const usage = new TreeNode();
        const grammarProgram = this.getGrammarProgramRoot();
        grammarProgram.getConcreteAndAbstractNodeTypeDefinitions().forEach(def => {
            usage.appendLine([def.getNodeTypeIdFromDefinition(), "line-id", GrammarConstants.nodeType, def.getRequiredCellTypeIds().join(" ")].join(" "));
        });
        this.getTopDownArray().forEach((node, lineNumber) => {
            const stats = usage.getNode(node.getNodeTypeId());
            stats.appendLine([filepath + "-" + lineNumber, node.getWords().join(" ")].join(" "));
        });
        return usage;
    }
    getInPlaceHighlightScopeTree() {
        return this.getTopDownArray()
            .map(child => child.getIndentation() + child.getLineHighlightScopes())
            .join("\n");
    }
    getInPlaceCellTypeTreeWithNodeConstructorNames() {
        return this.getTopDownArray()
            .map(child => child.constructor.name + this.getZI() + child.getIndentation() + child.getLineCellTypes())
            .join("\n");
    }
    getTreeWithNodeTypes() {
        return this.getTopDownArray()
            .map(child => child.constructor.name + this.getZI() + child.getIndentation() + child.getLine())
            .join("\n");
    }
    getCellHighlightScopeAtPosition(lineIndex, wordIndex) {
        this._initCellTypeCache();
        const typeNode = this._cache_highlightScopeTree.getTopDownArray()[lineIndex - 1];
        return typeNode ? typeNode.getWord(wordIndex - 1) : undefined;
    }
    _initCellTypeCache() {
        const treeMTime = this.getTreeMTime();
        if (this._cache_programCellTypeStringMTime === treeMTime)
            return undefined;
        this._cache_typeTree = new TreeNode(this.getInPlaceCellTypeTree());
        this._cache_highlightScopeTree = new TreeNode(this.getInPlaceHighlightScopeTree());
        this._cache_programCellTypeStringMTime = treeMTime;
    }
}
class GrammarBackedNonRootNode extends GrammarBackedNode {
    getRootProgramNode() {
        return this.getParent().getRootProgramNode();
    }
    getNodeTypeId() {
        return this.getDefinition().getNodeTypeIdFromDefinition();
    }
    getDefinition() {
        const grammarProgramRoot = this.getRootProgramNode().getGrammarProgramRoot();
        // todo: do we need a relative to with this firstWord path?
        return grammarProgramRoot.getNodeTypeDefinitionByFirstWordPath(this.getFirstWordPath());
    }
    getGrammarProgramRoot() {
        return this.getRootProgramNode().getGrammarProgramRoot();
    }
    _getGrammarBackedCellArray() {
        const definition = this.getDefinition();
        const grammarProgram = definition.getLanguageDefinitionProgram();
        const requiredCellTypeIds = definition.getRequiredCellTypeIds();
        const firstCellTypeId = definition.getFirstCellTypeId();
        const numberOfRequiredCells = requiredCellTypeIds.length + 1; // todo: assuming here first cell is required.
        const catchAllCellTypeId = definition.getCatchAllCellTypeId();
        const actualWordCountOrRequiredCellCount = Math.max(this.getWords().length, numberOfRequiredCells);
        const cells = [];
        // A for loop instead of map because "numberOfCellsToFill" can be longer than words.length
        for (let cellIndex = 0; cellIndex < actualWordCountOrRequiredCellCount; cellIndex++) {
            const isCatchAll = cellIndex >= numberOfRequiredCells;
            let cellTypeId;
            if (cellIndex === 0)
                cellTypeId = firstCellTypeId;
            else if (isCatchAll)
                cellTypeId = catchAllCellTypeId;
            else
                cellTypeId = requiredCellTypeIds[cellIndex - 1];
            let cellTypeDefinition = grammarProgram.getCellTypeDefinitionById(cellTypeId);
            let cellConstructor;
            if (cellTypeDefinition)
                cellConstructor = cellTypeDefinition.getCellConstructor();
            else if (cellTypeId)
                cellConstructor = GrammarUnknownCellTypeCell;
            else {
                cellConstructor = GrammarExtraWordCellTypeCell;
                cellTypeId = GrammarStandardCellTypeIds.extraWord;
                cellTypeDefinition = grammarProgram.getCellTypeDefinitionById(cellTypeId);
            }
            cells[cellIndex] = new cellConstructor(this, cellIndex, cellTypeDefinition, cellTypeId, isCatchAll);
        }
        return cells;
    }
    // todo: just make a fn that computes proper spacing and then is given a node to print
    getLineCellTypes() {
        return this._getGrammarBackedCellArray()
            .map(slot => slot.getCellTypeId())
            .join(" ");
    }
    getLineHighlightScopes(defaultScope = "source") {
        return this._getGrammarBackedCellArray()
            .map(slot => slot.getHighlightScope() || defaultScope)
            .join(" ");
    }
    getErrors() {
        const errors = this._getGrammarBackedCellArray()
            .map(check => check.getErrorIfAny())
            .filter(i => i);
        const firstWord = this.getFirstWord();
        if (this.getDefinition().has(GrammarConstants.single))
            this.getParent()
                .findNodes(firstWord)
                .forEach((node, index) => {
                if (index)
                    errors.push(new NodeTypeUsedMultipleTimesError(node));
            });
        return this._getRequiredNodeErrors(errors);
    }
    _getCompiledIndentation() {
        const indentCharacter = this.getDefinition()._getCompilerObject()[GrammarConstantsCompiler.indentCharacter];
        const indent = this.getIndentation();
        return indentCharacter !== undefined ? indentCharacter.repeat(indent.length) : indent;
    }
    _getCompiledLine() {
        const compiler = this.getDefinition()._getCompilerObject();
        const catchAllCellDelimiter = compiler[GrammarConstantsCompiler.catchAllCellDelimiter];
        const str = compiler[GrammarConstantsCompiler.stringTemplate];
        return str ? TreeUtils.formatStr(str, catchAllCellDelimiter, this.cells) : this.getLine();
    }
    compile() {
        return this._getCompiledIndentation() + this._getCompiledLine();
    }
    // todo: remove
    get cells() {
        const cells = {};
        this._getGrammarBackedCellArray().forEach(cell => {
            if (!cell.isCatchAll())
                cells[cell.getCellTypeId()] = cell.getParsed();
            else {
                if (!cells[cell.getCellTypeId()])
                    cells[cell.getCellTypeId()] = [];
                cells[cell.getCellTypeId()].push(cell.getParsed());
            }
        });
        return cells;
    }
}
class GrammarBackedTerminalNode extends GrammarBackedNonRootNode {
}
class GrammarBackedErrorNode extends GrammarBackedNonRootNode {
    // todo: is this correct?
    getLineCellTypes() {
        return "errorNodeAnyCellType ".repeat(this.getWords().length).trim();
    }
    getErrors() {
        return [this.getFirstWord() ? new UnknownNodeTypeError(this) : new BlankLineError(this)];
    }
}
class GrammarBackedNonTerminalNode extends GrammarBackedNonRootNode {
    // todo: implement
    _getChildJoinCharacter() {
        return "\n";
    }
    compile() {
        const compiler = this.getDefinition()._getCompilerObject();
        const openChildrenString = compiler[GrammarConstantsCompiler.openChildren] || "";
        const closeChildrenString = compiler[GrammarConstantsCompiler.closeChildren] || "";
        const childJoinCharacter = compiler[GrammarConstantsCompiler.joinChildrenWith] || "\n";
        const compiledLine = this._getCompiledLine();
        const indent = this._getCompiledIndentation();
        const compiledChildren = this.map(child => child.compile()).join(childJoinCharacter);
        return `${indent}${compiledLine}${openChildrenString}
${compiledChildren}
${indent}${closeChildrenString}`;
    }
}
class GrammarBackedBlobNode extends GrammarBackedNonRootNode {
    getFirstWordMap() {
        return {};
    }
    getErrors() {
        return [];
    }
    getCatchAllNodeConstructor(line) {
        return GrammarBackedBlobNode;
    }
}
/*
A cell contains a word but also the type information for that word.
*/
class AbstractGrammarBackedCell {
    constructor(node, index, typeDef, cellTypeId, isCatchAll) {
        this._typeDef = typeDef;
        this._node = node;
        this._isCatchAll = isCatchAll;
        this._index = index;
        this._cellTypeId = cellTypeId;
        this._word = node.getWord(index);
    }
    getCellTypeId() {
        return this._cellTypeId;
    }
    getNode() {
        return this._node;
    }
    getCellIndex() {
        return this._index;
    }
    isCatchAll() {
        return this._isCatchAll;
    }
    getHighlightScope() {
        const definition = this._getCellTypeDefinition();
        if (definition)
            return definition.getHighlightScope();
    }
    getAutoCompleteWords(partialWord = "") {
        const cellDef = this._getCellTypeDefinition();
        let words = cellDef ? cellDef._getAutocompleteWordOptions(this.getNode().getRootProgramNode()) : [];
        const runTimeOptions = this.getNode().getRunTimeEnumOptions(this);
        if (runTimeOptions)
            words = runTimeOptions.concat(words);
        if (partialWord)
            words = words.filter(word => word.includes(partialWord));
        return words.map(word => {
            return {
                text: word,
                displayText: word
            };
        });
    }
    getWord() {
        return this._word;
    }
    _getCellTypeDefinition() {
        return this._typeDef;
    }
    _getLineNumber() {
        return this.getNode().getPoint().y;
    }
    _getFullLine() {
        return this.getNode().getLine();
    }
    _getErrorContext() {
        return this._getFullLine().split(" ")[0]; // todo: XI
    }
    isValid() {
        const runTimeOptions = this.getNode().getRunTimeEnumOptions(this);
        if (runTimeOptions)
            return runTimeOptions.includes(this._word);
        return this._getCellTypeDefinition().isValid(this._word, this.getNode().getRootProgramNode()) && this._isValid();
    }
    getErrorIfAny() {
        if (this._word !== undefined && this.isValid())
            return undefined;
        // todo: refactor invalidwordError. We want better error messages.
        return this._word === undefined ? new MissingWordError(this) : new InvalidWordError(this);
    }
}
AbstractGrammarBackedCell.parserFunctionName = "";
class GrammarIntCell extends AbstractGrammarBackedCell {
    _isValid() {
        const num = parseInt(this._word);
        if (isNaN(num))
            return false;
        return num.toString() === this._word;
    }
    getRegexString() {
        return "\-?[0-9]+";
    }
    getParsed() {
        return parseInt(this._word);
    }
}
GrammarIntCell.parserFunctionName = "parseInt";
class GrammarBitCell extends AbstractGrammarBackedCell {
    _isValid() {
        const str = this._word;
        return str === "0" || str === "1";
    }
    getRegexString() {
        return "[01]";
    }
    getParsed() {
        return !!parseInt(this._word);
    }
}
class GrammarFloatCell extends AbstractGrammarBackedCell {
    _isValid() {
        const num = parseFloat(this._word);
        return !isNaN(num) && /^-?\d*(\.\d+)?$/.test(this._word);
    }
    getRegexString() {
        return "-?\d*(\.\d+)?";
    }
    getParsed() {
        return parseFloat(this._word);
    }
}
GrammarFloatCell.parserFunctionName = "parseFloat";
// ErrorCellType => grammar asks for a '' cell type here but the grammar does not specify a '' cell type. (todo: bring in didyoumean?)
class GrammarBoolCell extends AbstractGrammarBackedCell {
    constructor() {
        super(...arguments);
        this._trues = new Set(["1", "true", "t", "yes"]);
        this._falses = new Set(["0", "false", "f", "no"]);
    }
    _isValid() {
        const str = this._word.toLowerCase();
        return this._trues.has(str) || this._falses.has(str);
    }
    _getOptions() {
        return Array.from(this._trues).concat(Array.from(this._falses));
    }
    getRegexString() {
        return "(?:" + this._getOptions().join("|") + ")";
    }
    getParsed() {
        return this._trues.has(this._word.toLowerCase());
    }
}
class GrammarAnyCell extends AbstractGrammarBackedCell {
    _isValid() {
        return true;
    }
    getRegexString() {
        return "[^ ]+";
    }
    getParsed() {
        return this._word;
    }
}
class GrammarExtraWordCellTypeCell extends AbstractGrammarBackedCell {
    _isValid() {
        return false;
    }
    getParsed() {
        return this._word;
    }
    getErrorIfAny() {
        return new ExtraWordError(this);
    }
}
class GrammarUnknownCellTypeCell extends AbstractGrammarBackedCell {
    _isValid() {
        return false;
    }
    getParsed() {
        return this._word;
    }
    getErrorIfAny() {
        return new UnknownCellTypeError(this);
    }
}
class AbstractTreeError {
    constructor(node) {
        this._node = node;
    }
    getLineIndex() {
        return this.getLineNumber() - 1;
    }
    getLineNumber() {
        return this.getNode().getPoint().y;
    }
    isCursorOnWord(lineIndex, characterIndex) {
        return lineIndex === this.getLineIndex() && this._doesCharacterIndexFallOnWord(characterIndex);
    }
    _doesCharacterIndexFallOnWord(characterIndex) {
        return this.getCellIndex() === this.getNode().getWordIndexAtCharacterIndex(characterIndex);
    }
    // convenience method. may be removed.
    isBlankLineError() {
        return false;
    }
    // convenience method. may be removed.
    isMissingWordError() {
        return false;
    }
    getIndent() {
        return this.getNode().getIndentation();
    }
    getCodeMirrorLineWidgetElement(onApplySuggestionCallBack = () => { }) {
        const suggestion = this.getSuggestionMessage();
        if (this.isMissingWordError())
            return this._getCodeMirrorLineWidgetElementCellTypeHints();
        if (suggestion)
            return this._getCodeMirrorLineWidgetElementWithSuggestion(onApplySuggestionCallBack, suggestion);
        return this._getCodeMirrorLineWidgetElementWithoutSuggestion();
    }
    _getCodeMirrorLineWidgetElementCellTypeHints() {
        const el = document.createElement("div");
        el.appendChild(document.createTextNode(this.getIndent() + this.getNode().getDefinition().getLineHints()));
        el.className = "LintCellTypeHints";
        return el;
    }
    _getCodeMirrorLineWidgetElementWithoutSuggestion() {
        const el = document.createElement("div");
        el.appendChild(document.createTextNode(this.getIndent() + this.getMessage()));
        el.className = "LintError";
        return el;
    }
    _getCodeMirrorLineWidgetElementWithSuggestion(onApplySuggestionCallBack, suggestion) {
        const el = document.createElement("div");
        el.appendChild(document.createTextNode(this.getIndent() + `${this.getErrorTypeName()}. Suggestion: ${suggestion}`));
        el.className = "LintErrorWithSuggestion";
        el.onclick = () => {
            this.applySuggestion();
            onApplySuggestionCallBack();
        };
        return el;
    }
    getLine() {
        return this.getNode().getLine();
    }
    getExtension() {
        return this.getNode().getGrammarProgramRoot().getExtensionName();
    }
    getNode() {
        return this._node;
    }
    getErrorTypeName() {
        return this.constructor.name.replace("Error", "");
    }
    getCellIndex() {
        return 0;
    }
    toObject() {
        return {
            type: this.getErrorTypeName(),
            line: this.getLineNumber(),
            cell: this.getCellIndex(),
            suggestion: this.getSuggestionMessage(),
            path: this.getNode().getFirstWordPath(),
            message: this.getMessage()
        };
    }
    hasSuggestion() {
        return this.getSuggestionMessage() !== "";
    }
    getSuggestionMessage() {
        return "";
    }
    toString() {
        return this.getMessage();
    }
    applySuggestion() { }
    getMessage() {
        return `${this.getErrorTypeName()} at line ${this.getLineNumber()} cell ${this.getCellIndex()}.`;
    }
}
class AbstractCellError extends AbstractTreeError {
    constructor(cell) {
        super(cell.getNode());
        this._cell = cell;
    }
    getCell() {
        return this._cell;
    }
    getCellIndex() {
        return this._cell.getCellIndex();
    }
    _getWordSuggestion() {
        return TreeUtils.didYouMean(this.getCell().getWord(), this.getCell()
            .getAutoCompleteWords()
            .map(option => option.text));
    }
}
class UnknownNodeTypeError extends AbstractTreeError {
    getMessage() {
        return super.getMessage() + ` Invalid nodeType "${this.getNode().getFirstWord()}".`;
    }
    _getWordSuggestion() {
        const node = this.getNode();
        const parentNode = node.getParent();
        return TreeUtils.didYouMean(node.getFirstWord(), parentNode.getAutocompleteResults("", 0).map(option => option.text));
    }
    getSuggestionMessage() {
        const suggestion = this._getWordSuggestion();
        const node = this.getNode();
        if (suggestion)
            return `Change "${node.getFirstWord()}" to "${suggestion}"`;
        return "";
    }
    applySuggestion() {
        const suggestion = this._getWordSuggestion();
        if (suggestion)
            this.getNode().setWord(this.getCellIndex(), suggestion);
        return this;
    }
}
class BlankLineError extends UnknownNodeTypeError {
    getMessage() {
        return super.getMessage() + ` Line: "${this.getNode().getLine()}". Blank lines are errors.`;
    }
    // convenience method
    isBlankLineError() {
        return true;
    }
    getSuggestionMessage() {
        return `Delete line ${this.getLineNumber()}`;
    }
    applySuggestion() {
        this.getNode().destroy();
        return this;
    }
}
class InvalidConstructorPathError extends AbstractTreeError {
    getMessage() {
        return super.getMessage() + ` No constructor "${this.getLine()}" found. Language grammar "${this.getExtension()}" may need to be fixed.`;
    }
}
class MissingRequiredNodeTypeError extends AbstractTreeError {
    constructor(node, missingWord) {
        super(node);
        this._missingWord = missingWord;
    }
    getMessage() {
        return super.getMessage() + ` Missing required node "${this._missingWord}".`;
    }
    getSuggestionMessage() {
        return `Insert "${this._missingWord}" on line ${this.getLineNumber() + 1}`;
    }
    applySuggestion() {
        return this.getNode().prependLine(this._missingWord);
    }
}
class NodeTypeUsedMultipleTimesError extends AbstractTreeError {
    getMessage() {
        return super.getMessage() + ` Multiple "${this.getNode().getFirstWord()}" found.`;
    }
    getSuggestionMessage() {
        return `Delete line ${this.getLineNumber()}`;
    }
    applySuggestion() {
        return this.getNode().destroy();
    }
}
class UnknownCellTypeError extends AbstractCellError {
    getMessage() {
        return super.getMessage() + ` No cellType "${this.getCell().getCellTypeId()}" found. Language grammar for "${this.getExtension()}" may need to be fixed.`;
    }
}
class InvalidWordError extends AbstractCellError {
    getMessage() {
        return super.getMessage() + ` "${this.getCell().getWord()}" does not fit in cellType "${this.getCell().getCellTypeId()}".`;
    }
    getSuggestionMessage() {
        const suggestion = this._getWordSuggestion();
        if (suggestion)
            return `Change "${this.getCell().getWord()}" to "${suggestion}"`;
        return "";
    }
    applySuggestion() {
        const suggestion = this._getWordSuggestion();
        if (suggestion)
            this.getNode().setWord(this.getCellIndex(), suggestion);
        return this;
    }
}
class ExtraWordError extends AbstractCellError {
    getMessage() {
        return super.getMessage() + ` Extra word "${this.getCell().getWord()}".`;
    }
    getSuggestionMessage() {
        return `Delete word "${this.getCell().getWord()}" at cell ${this.getCellIndex()}`;
    }
    applySuggestion() {
        return this.getNode().deleteWordAt(this.getCellIndex());
    }
}
class MissingWordError extends AbstractCellError {
    // todo: autocomplete suggestion
    getMessage() {
        return super.getMessage() + ` Missing word for cell "${this.getCell().getCellTypeId()}".`;
    }
    isMissingWordError() {
        return true;
    }
}
// todo: add standard types, enum types, from disk types
class AbstractGrammarWordTestNode extends TreeNode {
}
class GrammarRegexTestNode extends AbstractGrammarWordTestNode {
    isValid(str) {
        if (!this._regex)
            this._regex = new RegExp("^" + this.getContent() + "$");
        return !!str.match(this._regex);
    }
}
class GrammarReservedWordsTestNode extends AbstractGrammarWordTestNode {
    isValid(str) {
        if (!this._set)
            this._set = new Set(this.getContent().split(" "));
        return !this._set.has(str);
    }
}
// todo: remove in favor of custom word type constructors
class EnumFromGrammarTestNode extends AbstractGrammarWordTestNode {
    _getEnumFromGrammar(programRootNode) {
        const nodeTypes = this.getWordsFrom(1);
        const enumGroup = nodeTypes.join(" ");
        // note: hack where we store it on the program. otherwise has global effects.
        if (!programRootNode._enumMaps)
            programRootNode._enumMaps = {};
        if (programRootNode._enumMaps[enumGroup])
            return programRootNode._enumMaps[enumGroup];
        const wordIndex = 1;
        const map = {};
        programRootNode.findNodes(nodeTypes).forEach(node => {
            map[node.getWord(wordIndex)] = true;
        });
        programRootNode._enumMaps[enumGroup] = map;
        return map;
    }
    // todo: remove
    isValid(str, programRootNode) {
        return this._getEnumFromGrammar(programRootNode)[str] === true;
    }
}
class GrammarEnumTestNode extends AbstractGrammarWordTestNode {
    isValid(str) {
        // enum c c++ java
        return !!this.getOptions()[str];
    }
    getOptions() {
        if (!this._map)
            this._map = TreeUtils.arrayToMap(this.getWordsFrom(1));
        return this._map;
    }
}
class AbstractExtendibleTreeNode extends TreeNode {
    _getFromExtended(firstWordPath) {
        const hit = this._getNodeFromExtended(firstWordPath);
        return hit ? hit.get(firstWordPath) : undefined;
    }
    // todo: be more specific with the param
    _getChildrenByNodeConstructorInExtended(constructor) {
        return this._getAncestorsArray().map(node => node.getChildrenByNodeConstructor(constructor)).flat();
    }
    _getExtendedParent() {
        return this._getAncestorsArray()[1];
    }
    _hasFromExtended(firstWordPath) {
        return !!this._getNodeFromExtended(firstWordPath);
    }
    _getNodeFromExtended(firstWordPath) {
        return this._getAncestorsArray().find(node => node.has(firstWordPath));
    }
    _doesExtend(nodeTypeId) {
        if (!this._cache_ancestorSet)
            this._cache_ancestorSet = new Set(this._getAncestorsArray().map(def => def._getId()));
        return this._cache_ancestorSet.has(nodeTypeId);
    }
    // Note: the order is: [this, parent, grandParent, ...]
    _getAncestorsArray(cannotContainNodes) {
        this._initAncestorsArrayCache(cannotContainNodes);
        return this._cache_ancestorsArray;
    }
    _getIdThatThisExtends() {
        return this.get(GrammarConstants.extends);
    }
    _initAncestorsArrayCache(cannotContainNodes) {
        if (this._cache_ancestorsArray)
            return undefined;
        if (cannotContainNodes && cannotContainNodes.includes(this))
            throw new Error(`Loop detected: '${this.getLine()}' is the ancestor of one of its ancestors.`);
        cannotContainNodes = cannotContainNodes || [this];
        let ancestors = [this];
        const extendedId = this._getIdThatThisExtends();
        if (extendedId) {
            const parentNode = this._getIdToNodeMap()[extendedId];
            if (!parentNode)
                throw new Error(`${extendedId} not found`);
            ancestors = ancestors.concat(parentNode._getAncestorsArray(cannotContainNodes));
        }
        this._cache_ancestorsArray = ancestors;
    }
}
class GrammarCellTypeDefinitionNode extends AbstractExtendibleTreeNode {
    getFirstWordMap() {
        const types = {};
        types[GrammarConstants.regex] = GrammarRegexTestNode;
        types[GrammarConstants.reservedWords] = GrammarReservedWordsTestNode;
        types[GrammarConstants.enumFromGrammar] = EnumFromGrammarTestNode;
        types[GrammarConstants.enum] = GrammarEnumTestNode;
        types[GrammarConstants.highlightScope] = TreeNode;
        types[GrammarConstants.todoComment] = TreeNode;
        types[GrammarConstants.extends] = TreeNode;
        return types;
    }
    _getIdToNodeMap() {
        return this._getRootProgramNode().getCellTypeDefinitions();
    }
    getGetter(wordIndex) {
        const wordToNativeJavascriptTypeParser = this.getCellConstructor().parserFunctionName;
        return `get ${this.getCellTypeId()}() {
      return ${wordToNativeJavascriptTypeParser ? wordToNativeJavascriptTypeParser + `(this.getWord(${wordIndex}))` : `this.getWord(${wordIndex})`}
    }`;
    }
    getCatchAllGetter(wordIndex) {
        const wordToNativeJavascriptTypeParser = this.getCellConstructor().parserFunctionName;
        return `get ${this.getCellTypeId()}() {
      return ${wordToNativeJavascriptTypeParser
            ? `this.getWordsFrom(${wordIndex}).map(val => ${wordToNativeJavascriptTypeParser}(val))`
            : `this.getWordsFrom(${wordIndex})`}
    }`;
    }
    // `this.getWordsFrom(${requireds.length + 1})`
    // todo: cleanup typings. todo: remove this hidden logic. have a "baseType" property?
    getCellConstructor() {
        const kinds = {};
        kinds[GrammarStandardCellTypeIds.any] = GrammarAnyCell;
        kinds[GrammarStandardCellTypeIds.anyFirstWord] = GrammarAnyCell;
        kinds[GrammarStandardCellTypeIds.float] = GrammarFloatCell;
        kinds[GrammarStandardCellTypeIds.number] = GrammarFloatCell;
        kinds[GrammarStandardCellTypeIds.bit] = GrammarBitCell;
        kinds[GrammarStandardCellTypeIds.bool] = GrammarBoolCell;
        kinds[GrammarStandardCellTypeIds.int] = GrammarIntCell;
        return kinds[this.getWord(1)] || kinds[this._getExtendedCellTypeId()] || GrammarAnyCell;
    }
    _getExtendedCellTypeId() {
        return this.get(GrammarConstants.extends);
    }
    getHighlightScope() {
        return this._getFromExtended(GrammarConstants.highlightScope);
    }
    _getEnumOptions() {
        const enumNode = this._getNodeFromExtended(GrammarConstants.enum);
        if (!enumNode)
            return undefined;
        // we sort by longest first to capture longest match first. todo: add test
        const options = Object.keys(enumNode.getNode(GrammarConstants.enum).getOptions());
        options.sort((a, b) => b.length - a.length);
        return options;
    }
    _getEnumFromGrammarOptions(program) {
        const node = this._getNodeFromExtended(GrammarConstants.enumFromGrammar);
        return node ? Object.keys(node.getNode(GrammarConstants.enumFromGrammar)._getEnumFromGrammar(program)) : undefined;
    }
    _getRootProgramNode() {
        return this.getParent();
    }
    _getAutocompleteWordOptions(program) {
        return this._getEnumOptions() || this._getEnumFromGrammarOptions(program) || [];
    }
    getRegexString() {
        // todo: enum
        const enumOptions = this._getEnumOptions();
        return this._getFromExtended(GrammarConstants.regex) || (enumOptions ? "(?:" + enumOptions.join("|") + ")" : "[^ ]*");
    }
    isValid(str, programRootNode) {
        return this._getChildrenByNodeConstructorInExtended(AbstractGrammarWordTestNode).every(node => node.isValid(str, programRootNode));
    }
    getCellTypeId() {
        return this.getWord(1);
    }
    _getId() {
        return this.getCellTypeId();
    }
}
class GrammarDefinitionErrorNode extends TreeNode {
    getErrors() {
        return [this.getFirstWord() ? new UnknownNodeTypeError(this) : new BlankLineError(this)];
    }
    getLineCellTypes() {
        return [GrammarConstants.nodeType].concat(this.getWordsFrom(1).map(word => GrammarStandardCellTypeIds.any)).join(" ");
    }
}
class GrammarExampleNode extends TreeNode {
}
class GrammarCompilerNode extends TreeNode {
    getFirstWordMap() {
        const types = [
            GrammarConstantsCompiler.stringTemplate,
            GrammarConstantsCompiler.indentCharacter,
            GrammarConstantsCompiler.catchAllCellDelimiter,
            GrammarConstantsCompiler.openChildren,
            GrammarConstantsCompiler.closeChildren
        ];
        const map = {};
        types.forEach(type => {
            map[type] = TreeNode;
        });
        return map;
    }
}
class AbstractCustomConstructorNode extends TreeNode {
    isAppropriateEnvironment() {
        return true;
    }
    getErrors() {
        if (!this.isAppropriateEnvironment())
            return [];
        try {
            // Attempt to load the custom constructor
            this._getCustomConstructor();
            return [];
        }
        catch (err) {
            console.log(err);
            return [new InvalidConstructorPathError(this)];
        }
    }
    getGrammarProgramRoot() {
        return this._getDef().getLanguageDefinitionProgram();
    }
    _getDef() {
        const def = this.getParent().getParent();
        if (def instanceof NonRootNodeTypeDefinition)
            return def;
        return def.getLanguageDefinitionProgram();
    }
}
class CustomNodeJsConstructorNode extends AbstractCustomConstructorNode {
    // todo: if we keep this, we need to surface better error messaging with the submodule convention bit.
    _getCustomConstructor() {
        const filepath = this.getContent();
        const rootPath = this.getRootNode().getTheGrammarFilePath();
        const basePath = TreeUtils.getPathWithoutFileName(rootPath) + "/";
        const fullPath = filepath.startsWith("/") ? filepath : basePath + filepath;
        const theModule = require(fullPath);
        const constructorName = this._getDef()._getGeneratedClassName();
        const constructor = TreeUtils.resolveProperty(theModule, constructorName);
        if (!constructor)
            throw new Error(`constructor "${constructorName}" not found in "${fullPath}".`);
        return constructor;
    }
    isAppropriateEnvironment() {
        return this.isNodeJs();
    }
}
class CustomBrowserConstructorNode extends AbstractCustomConstructorNode {
    _getCustomConstructor() {
        // todo: bad idea to have browser and node have reverse ordering for submodulename
        const constructorName = this._getDef()._getGeneratedClassName();
        const constructor = TreeUtils.resolveProperty(window, constructorName);
        if (!constructor)
            throw new Error(`constructor window.${constructorName} not found.`);
        return constructor;
    }
    isAppropriateEnvironment() {
        return !this.isNodeJs();
    }
}
class GrammarNodeTypeConstant extends TreeNode {
    getGetter() {
        return `get ${this.getIdentifier()}() { return ${this.getConstantValueAsJsText()} }`;
    }
    getIdentifier() {
        return this.getWord(1);
    }
    getConstantValueAsJsText() {
        const words = this.getWordsFrom(2);
        return words.length > 1 ? `[${words.join(",")}]` : words[0];
    }
    getConstantValue() {
        return JSON.parse(this.getConstantValueAsJsText());
    }
}
class GrammarNodeTypeConstantInt extends GrammarNodeTypeConstant {
}
class GrammarNodeTypeConstantString extends GrammarNodeTypeConstant {
    getConstantValueAsJsText() {
        return "`" + TreeUtils.escapeBackTicks(this.getConstantValue()) + "`";
    }
    getConstantValue() {
        return this.length ? this.childrenToString() : this.getWordsFrom(2).join(" ");
    }
}
class GrammarNodeTypeConstantFloat extends GrammarNodeTypeConstant {
}
class GrammarNodeTypeConstantBoolean extends GrammarNodeTypeConstant {
}
class AbstractGrammarDefinitionNode extends AbstractExtendibleTreeNode {
    getFirstWordMap() {
        // todo: some of these should just be on nonRootNodes
        const types = [
            GrammarConstants.frequency,
            GrammarConstants.inScope,
            GrammarConstants.cells,
            GrammarConstants.extends,
            GrammarConstants.description,
            GrammarConstants.catchAllNodeType,
            GrammarConstants.catchAllCellType,
            GrammarConstants.firstCellType,
            GrammarConstants.extensions,
            GrammarConstants.version,
            GrammarConstants.tags,
            GrammarConstants.nodeTypeOrder,
            GrammarConstants.match,
            GrammarConstants.baseNodeType,
            GrammarConstants.required,
            GrammarConstants.root,
            GrammarConstants.compilesTo,
            GrammarConstants.abstract,
            GrammarConstants.javascript,
            GrammarConstants.single,
            GrammarConstants.todoComment
        ];
        const map = {};
        types.forEach(type => {
            map[type] = TreeNode;
        });
        map[GrammarConstantsConstantTypes.boolean] = GrammarNodeTypeConstantBoolean;
        map[GrammarConstantsConstantTypes.int] = GrammarNodeTypeConstantInt;
        map[GrammarConstantsConstantTypes.string] = GrammarNodeTypeConstantString;
        map[GrammarConstantsConstantTypes.float] = GrammarNodeTypeConstantFloat;
        map[GrammarConstants.compilerNodeType] = GrammarCompilerNode;
        map[GrammarConstants.example] = GrammarExampleNode;
        return map;
    }
    getConstantsObject() {
        const obj = this._getUniqueConstantNodes();
        Object.keys(obj).forEach(key => {
            obj[key] = obj[key].getConstantValue();
        });
        return obj;
    }
    _getUniqueConstantNodes() {
        const obj = {};
        const items = this._getChildrenByNodeConstructorInExtended(GrammarNodeTypeConstant);
        items.reverse(); // Last definition wins.
        items.forEach((node) => {
            obj[node.getIdentifier()] = node;
        });
        return obj;
    }
    getExamples() {
        return this._getChildrenByNodeConstructorInExtended(GrammarExampleNode);
    }
    getNodeTypeIdFromDefinition() {
        return this.getWord(1);
    }
    // todo: remove. just reused nodeTypeId
    _getGeneratedClassName() {
        return this.getNodeTypeIdFromDefinition();
    }
    getNodeConstructorToJavascript() {
        const nodeMap = this.getRunTimeFirstWordMapWithDefinitions();
        // if THIS node defines a catch all constructor, use that
        // IF IT DOES NOT, ADD NOTHING
        // if THIS node defines a keyword map, use that first
        // IF IT DOES NOT, ADD NOTHING
        // CHECK PARENTS TOO
        const firstWordMap = this._createRunTimeFirstWordToNodeConstructorMap(this._getMyInScopeNodeTypeIds());
        // todo: use constants in first word maps
        if (Object.keys(firstWordMap).length)
            return `getFirstWordMap() {
  return {${Object.keys(firstWordMap)
                .map(firstWord => `"${firstWord}" : ${nodeMap[firstWord]._getGeneratedClassName()}`)
                .join(",\n")}}
  }`;
        return "";
    }
    _isAbstract() {
        return this.has(GrammarConstants.abstract);
    }
    _getConstructorDefinedInGrammar() {
        if (!this._cache_definedNodeConstructor)
            this._cache_definedNodeConstructor = this._initConstructorDefinedInGrammar();
        return this._cache_definedNodeConstructor;
    }
    _getFirstWordMatch() {
        return this.get(GrammarConstants.match) || this.getNodeTypeIdFromDefinition();
    }
    _importNodeJsConstructor(className, code) {
        const vm = require("vm");
        try {
            ;
            global.jtree = require(__dirname + "/jtree.node.js").default;
            global.require = require;
            // Todo: do we want to add new classes to global namespace?
            return vm.runInThisContext(`{
 ${code}
 ${className}
}`);
        }
        catch (err) {
            console.log("Error in code:");
            console.log(code);
            throw err;
        }
    }
    _importBrowserConstructor(code) {
        const tempClassName = "tempConstructor" + TreeUtils.getRandomString(30);
        const script = document.createElement("script");
        script.innerHTML = `window.${tempClassName} = ${code}`;
        document.head.appendChild(script);
        return window[tempClassName];
    }
    // todo: always should return a custom constructor for each node type
    _initConstructorDefinedInGrammar() {
        let constructor;
        // todo: this is not catching if we dont have that but we do have constants.
        // todo: reuse other code...load things into 1 file?
        const className = this._getGeneratedClassName();
        const extendsClassName = this._getExtendsClassName(false);
        const gettersAndConstants = this._getCellGettersAndNodeTypeConstants();
        const code = `class ${className} extends ${extendsClassName} {
      ${gettersAndConstants}
      ${this._getCustomJavascriptMethods()}
}`;
        if (AbstractGrammarDefinitionNode._cachedNodeConstructorsFromCode[code])
            return AbstractGrammarDefinitionNode._cachedNodeConstructorsFromCode[code];
        if (this.isNodeJs())
            constructor = this._importNodeJsConstructor(this._getGeneratedClassName(), code);
        else
            constructor = this._importBrowserConstructor(code);
        AbstractGrammarDefinitionNode._cachedNodeConstructorsFromCode[code] = constructor;
        return constructor;
    }
    getCatchAllNodeConstructor(line) {
        return GrammarDefinitionErrorNode;
    }
    getLanguageDefinitionProgram() {
        return this.getParent();
    }
    _getCustomJavascriptMethods() {
        const jsCode = this._getNodeFromExtended(GrammarConstants.javascript);
        return jsCode ? jsCode.getNode(GrammarConstants.javascript).childrenToString() : "";
    }
    getRunTimeFirstWordMap() {
        if (!this._cache_runTimeFirstWordToNodeConstructorMap)
            this._cache_runTimeFirstWordToNodeConstructorMap = this._createRunTimeFirstWordToNodeConstructorMap(this._getInScopeNodeTypeIds());
        return this._cache_runTimeFirstWordToNodeConstructorMap;
    }
    getRunTimeFirstWordMapWithDefinitions() {
        if (!this._cache_runTimeFirstWordToNodeDefMap)
            this._cache_runTimeFirstWordToNodeDefMap = this._createRunTimeFirstWordToNodeDefMap(this._getInScopeNodeTypeIds());
        return this._cache_runTimeFirstWordToNodeDefMap;
    }
    getRunTimeFirstWordsInScope() {
        return Object.keys(this.getRunTimeFirstWordMap());
    }
    getRequiredCellTypeIds() {
        const parameters = this._getFromExtended(GrammarConstants.cells);
        return parameters ? parameters.split(" ") : [];
    }
    // todo: what happens when you have a cell getter and constant with same name?
    _getCellGettersAndNodeTypeConstants() {
        // todo: add cellType parsings
        const grammarProgram = this.getLanguageDefinitionProgram();
        const getters = this.getRequiredCellTypeIds().map((cellTypeId, index) => grammarProgram.getCellTypeDefinitionById(cellTypeId).getGetter(index + 1));
        const catchAllCellTypeId = this.getCatchAllCellTypeId();
        if (catchAllCellTypeId)
            getters.push(grammarProgram.getCellTypeDefinitionById(catchAllCellTypeId).getCatchAllGetter(getters.length + 1));
        // Constants
        Object.values(this._getUniqueConstantNodes()).forEach(node => {
            getters.push(node.getGetter());
        });
        return getters.join("\n");
    }
    getCatchAllCellTypeId() {
        return this._getFromExtended(GrammarConstants.catchAllCellType);
    }
    _createRunTimeFirstWordToNodeConstructorMap(nodeTypeIdsInScope) {
        const map = this._createRunTimeFirstWordToNodeDefMap(nodeTypeIdsInScope);
        const result = {};
        Object.keys(map).forEach(firstWord => {
            result[firstWord] = map[firstWord]._getConstructorDefinedInGrammar();
        });
        return result;
    }
    _createRunTimeFirstWordToNodeDefMap(nodeTypeIdsInScope) {
        if (!nodeTypeIdsInScope.length)
            return {};
        const result = {};
        const allProgramNodeTypeDefinitionsMap = this._getProgramNodeTypeDefinitionCache();
        Object.keys(allProgramNodeTypeDefinitionsMap)
            .filter(nodeTypeId => allProgramNodeTypeDefinitionsMap[nodeTypeId].isOrExtendsANodeTypeInScope(nodeTypeIdsInScope))
            .filter(nodeTypeId => !allProgramNodeTypeDefinitionsMap[nodeTypeId]._isAbstract())
            .forEach(nodeTypeId => {
            const def = allProgramNodeTypeDefinitionsMap[nodeTypeId];
            result[def._getFirstWordMatch()] = def;
        });
        return result;
    }
    // todo: update to better reflect _getFirstWordMatch?
    getTopNodeTypeIds() {
        const definitions = this._getProgramNodeTypeDefinitionCache();
        const firstWords = this.getRunTimeFirstWordMap();
        const arr = Object.keys(firstWords).map(firstWord => definitions[firstWord]);
        arr.sort(TreeUtils.sortByAccessor((definition) => definition.getFrequency()));
        arr.reverse();
        return arr.map(definition => definition.getNodeTypeIdFromDefinition());
    }
    _getMyInScopeNodeTypeIds() {
        const nodeTypesNode = this.getNode(GrammarConstants.inScope);
        return nodeTypesNode ? nodeTypesNode.getWordsFrom(1) : [];
    }
    _getInScopeNodeTypeIds() {
        // todo: allow multiple of these if we allow mixins?
        const ids = this._getMyInScopeNodeTypeIds();
        const parentDef = this._getExtendedParent();
        return parentDef ? ids.concat(parentDef._getInScopeNodeTypeIds()) : ids;
    }
    isRequired() {
        return this._hasFromExtended(GrammarConstants.required);
    }
    // todo: protected?
    _getRunTimeCatchAllNodeTypeId() {
        return "";
    }
    getNodeTypeDefinitionByNodeTypeId(nodeTypeId) {
        const definitions = this._getProgramNodeTypeDefinitionCache();
        return definitions[nodeTypeId] || this._getCatchAllNodeTypeDefinition(); // todo: this is where we might do some type of firstWord lookup for user defined fns.
    }
    _getCatchAllNodeTypeDefinition() {
        const catchAllNodeTypeId = this._getRunTimeCatchAllNodeTypeId();
        const definitions = this._getProgramNodeTypeDefinitionCache();
        const def = definitions[catchAllNodeTypeId];
        if (def)
            return def;
        // todo: implement contraints like a grammar file MUST have a catch all.
        if (this.isRoot())
            throw new Error(`This grammar language "${this.getLanguageDefinitionProgram().getGrammarName()}" lacks a root catch all definition`);
        else
            return this.getParent()._getCatchAllNodeTypeDefinition();
    }
    _initCatchAllNodeConstructorCache() {
        if (this._cache_catchAllConstructor)
            return undefined;
        this._cache_catchAllConstructor = this._getCatchAllNodeTypeDefinition()._getConstructorDefinedInGrammar();
    }
    getFirstCellTypeId() {
        return this._getFromExtended(GrammarConstants.firstCellType) || GrammarStandardCellTypeIds.anyFirstWord;
    }
    isDefined(nodeTypeId) {
        return !!this._getProgramNodeTypeDefinitionCache()[nodeTypeId.toLowerCase()];
    }
    _getIdToNodeMap() {
        return this._getProgramNodeTypeDefinitionCache();
    }
    _getProgramNodeTypeDefinitionCache() {
        return this.getLanguageDefinitionProgram()._getProgramNodeTypeDefinitionCache();
    }
    getRunTimeCatchAllNodeConstructor() {
        this._initCatchAllNodeConstructorCache();
        return this._cache_catchAllConstructor;
    }
}
// constructor
//  extends constructor (baseType)
//  getters/setters(?) (int/string/float/boolean)
//  custom code (javascript)
AbstractGrammarDefinitionNode._cachedNodeConstructorsFromCode = {};
class NonRootNodeTypeDefinition extends AbstractGrammarDefinitionNode {
    // todo: protected?
    _getRunTimeCatchAllNodeTypeId() {
        return this._getFromExtended(GrammarConstants.catchAllNodeType) || this.getParent()._getRunTimeCatchAllNodeTypeId();
    }
    _getId() {
        return this.getWord(1);
    }
    _amIRoot() {
        if (this._cache_isRoot === undefined)
            this._cache_isRoot = this.getParent()._getRootNodeTypeDefinitionNode() === this;
        return this._cache_isRoot;
    }
    _getCatchAllNodeConstructorToJavascript() {
        const nodeTypeId = this._getRunTimeCatchAllNodeTypeId();
        if (!nodeTypeId)
            return "";
        const className = this.getNodeTypeDefinitionByNodeTypeId(nodeTypeId)._getGeneratedClassName();
        return `getCatchAllNodeConstructor() { return ${className}}`;
    }
    _getCompilerObject() {
        let obj = {};
        const items = this._getChildrenByNodeConstructorInExtended(GrammarCompilerNode);
        items.reverse(); // Last definition wins.
        items.forEach((node) => {
            obj = Object.assign(obj, node.toObject()); // todo: what about multiline strings?
        });
        return obj;
    }
    // todo: improve layout (use bold?)
    getLineHints() {
        const catchAllCellTypeId = this.getCatchAllCellTypeId();
        return `${this._getFirstWordMatch()}: ${this.getRequiredCellTypeIds().join(" ")}${catchAllCellTypeId ? ` ${catchAllCellTypeId}...` : ""}`;
    }
    isOrExtendsANodeTypeInScope(firstWordsInScope) {
        const chain = this._getNodeTypeInheritanceSet();
        return firstWordsInScope.some(firstWord => chain.has(firstWord));
    }
    _getExtendsClassName(isCompiled = false) {
        if (this._amIRoot())
            return "jtree.GrammarBackedRootNode";
        const baseTypeNames = {};
        baseTypeNames[GrammarConstants.blobNode] = "BlobNode";
        baseTypeNames[GrammarConstants.errorNode] = "ErrorNode";
        baseTypeNames[GrammarConstants.terminalNode] = "TerminalNode";
        baseTypeNames[GrammarConstants.nonTerminalNode] = "NonTerminalNode";
        const isNonTerminal = this._getFromExtended(GrammarConstants.inScope) || this._getFromExtended(GrammarConstants.catchAllNodeType);
        const baseNodeTypeName = baseTypeNames[this._getFromExtended(GrammarConstants.baseNodeType)] || (isNonTerminal ? "NonTerminalNode" : "TerminalNode");
        if (!isCompiled)
            return "jtree." + baseNodeTypeName; // todo: this is incorrect but works for legacy stuff.
        const extendedDef = this._getExtendedParent();
        return extendedDef ? extendedDef._getGeneratedClassName() : isCompiled ? "jtree.TerminalNode" : "jtree.NonTerminalNode";
    }
    _getFirstCellHighlightScope() {
        const program = this.getLanguageDefinitionProgram();
        const cellTypeDefinition = program.getCellTypeDefinitionById(this.getFirstCellTypeId());
        // todo: standardize error/capture error at grammar time
        if (!cellTypeDefinition)
            throw new Error(`No ${GrammarConstants.cellType} ${this.getFirstCellTypeId()} found`);
        return cellTypeDefinition.getHighlightScope();
    }
    getMatchBlock() {
        const defaultHighlightScope = "source";
        const program = this.getLanguageDefinitionProgram();
        const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const firstWordHighlightScope = (this._getFirstCellHighlightScope() || defaultHighlightScope) + "." + this.getNodeTypeIdFromDefinition();
        const match = `'^ *${escapeRegExp(this._getFirstWordMatch())}(?: |$)'`;
        const topHalf = ` '${this.getNodeTypeIdFromDefinition()}':
  - match: ${match}
    scope: ${firstWordHighlightScope}`;
        const requiredCellTypeIds = this.getRequiredCellTypeIds();
        const catchAllCellTypeId = this.getCatchAllCellTypeId();
        if (catchAllCellTypeId)
            requiredCellTypeIds.push(catchAllCellTypeId);
        if (!requiredCellTypeIds.length)
            return topHalf;
        const captures = requiredCellTypeIds
            .map((cellTypeId, index) => {
            const cellTypeDefinition = program.getCellTypeDefinitionById(cellTypeId); // todo: cleanup
            if (!cellTypeDefinition)
                throw new Error(`No ${GrammarConstants.cellType} ${cellTypeId} found`); // todo: standardize error/capture error at grammar time
            return `        ${index + 1}: ${(cellTypeDefinition.getHighlightScope() || defaultHighlightScope) + "." + cellTypeDefinition.getCellTypeId()}`;
        })
            .join("\n");
        const cellTypesToRegex = (cellTypeIds) => cellTypeIds.map((cellTypeId) => `({{${cellTypeId}}})?`).join(" ?");
        return `${topHalf}
    push:
     - match: ${cellTypesToRegex(requiredCellTypeIds)}
       captures:
${captures}
     - match: $
       pop: true`;
    }
    _getNodeTypeInheritanceSet() {
        if (!this._cache_nodeTypeInheritanceSet)
            this._cache_nodeTypeInheritanceSet = new Set(this.getAncestorNodeTypeIdsArray());
        return this._cache_nodeTypeInheritanceSet;
    }
    getAncestorNodeTypeIdsArray() {
        if (!this._cache_ancestorNodeTypeIdsArray) {
            this._cache_ancestorNodeTypeIdsArray = this._getAncestorsArray().map(def => def.getNodeTypeIdFromDefinition());
            this._cache_ancestorNodeTypeIdsArray.reverse();
        }
        return this._cache_ancestorNodeTypeIdsArray;
    }
    // todo: protected?
    _getProgramNodeTypeDefinitionCache() {
        return this.getLanguageDefinitionProgram()._getProgramNodeTypeDefinitionCache();
    }
    // todo: remove
    getDoc() {
        return this.getNodeTypeIdFromDefinition();
    }
    getDescription() {
        return this._getFromExtended(GrammarConstants.description) || "";
    }
    getFrequency() {
        const val = this._getFromExtended(GrammarConstants.frequency);
        return val ? parseFloat(val) : 0;
    }
    _getExtendedNodeTypeId() {
        const ancestorIds = this.getAncestorNodeTypeIdsArray();
        if (ancestorIds.length > 1)
            return ancestorIds[ancestorIds.length - 2];
    }
    _nodeDefToJavascriptClass(isCompiled = true) {
        const components = [
            this.getNodeConstructorToJavascript(),
            this._getCellGettersAndNodeTypeConstants(),
            this._getCustomJavascriptMethods(),
            this._getCatchAllNodeConstructorToJavascript()
        ].filter(code => code);
        if (this._amIRoot())
            components.push(`getGrammarProgramRoot() {
        if (!this._cachedGrammarProgramRoot)
          this._cachedGrammarProgramRoot = new jtree.GrammarProgram(\`${TreeUtils.escapeBackTicks(this.getParent()
                .toString()
                .replace(/\\/g, "\\\\"))}\`)
        return this._cachedGrammarProgramRoot
      }`);
        return `class ${this._getGeneratedClassName()} extends ${this._getExtendsClassName(isCompiled)} {
      ${components.join("\n")}
    }`;
    }
}
// GrammarProgram is a constructor that takes a grammar file, and builds a new
// constructor for new language that takes files in that language to execute, compile, etc.
class GrammarProgram extends AbstractGrammarDefinitionNode {
    getFirstWordMap() {
        const map = {};
        map[GrammarConstants.cellType] = GrammarCellTypeDefinitionNode;
        map[GrammarConstants.nodeType] = NonRootNodeTypeDefinition;
        map[GrammarConstants.toolingDirective] = TreeNode;
        map[GrammarConstants.todoComment] = TreeNode;
        return map;
    }
    // todo: remove
    _getExtendsClassName() {
        return "";
    }
    // todo: this shouldnt be here?
    _getId() {
        return "";
    }
    getErrorsInGrammarExamples() {
        const programConstructor = this.getRootConstructor();
        const errors = [];
        this.getConcreteAndAbstractNodeTypeDefinitions().forEach(def => def.getExamples().forEach(example => {
            const exampleProgram = new programConstructor(example.childrenToString());
            exampleProgram.getAllErrors().forEach(err => {
                errors.push(err);
            });
        }));
        return errors;
    }
    getTargetExtension() {
        return this._getRootNodeTypeDefinitionNode().get(GrammarConstants.compilesTo);
    }
    getNodeTypeOrder() {
        return this._getRootNodeTypeDefinitionNode().get(GrammarConstants.nodeTypeOrder);
    }
    getCellTypeDefinitions() {
        if (!this._cache_cellTypes)
            this._cache_cellTypes = this._getCellTypeDefinitions();
        return this._cache_cellTypes;
    }
    getCellTypeDefinitionById(cellTypeId) {
        // todo: return unknownCellTypeDefinition? or is that handled somewhere else?
        return this.getCellTypeDefinitions()[cellTypeId];
    }
    getNodeTypeFamilyTree() {
        const tree = new TreeNode();
        Object.values(this.getConcreteAndAbstractNodeTypeDefinitions()).forEach(node => {
            const path = node.getAncestorNodeTypeIdsArray().join(" ");
            tree.touchNode(path);
        });
        return tree;
    }
    _getCellTypeDefinitions() {
        const types = {};
        // todo: add built in word types?
        this.getChildrenByNodeConstructor(GrammarCellTypeDefinitionNode).forEach(type => (types[type.getCellTypeId()] = type));
        return types;
    }
    getLanguageDefinitionProgram() {
        return this;
    }
    getConcreteAndAbstractNodeTypeDefinitions() {
        return this.getChildrenByNodeConstructor(NonRootNodeTypeDefinition);
    }
    // todo: remove?
    getTheGrammarFilePath() {
        return this.getLine();
    }
    _getRootNodeTypeDefinitionNode() {
        if (!this._cache_rootNodeTypeNode) {
            this.forEach(def => {
                if (def.has(GrammarConstants.root))
                    this._cache_rootNodeTypeNode = def;
            });
        }
        return this._cache_rootNodeTypeNode;
    }
    getExtensionName() {
        return this.getGrammarName();
    }
    getGrammarName() {
        return this._getRootNodeTypeDefinitionNode().getNodeTypeIdFromDefinition();
    }
    _getMyInScopeNodeTypeIds() {
        const nodeTypesNode = this._getRootNodeTypeDefinitionNode().getNode(GrammarConstants.inScope);
        return nodeTypesNode ? nodeTypesNode.getWordsFrom(1) : [];
    }
    _getInScopeNodeTypeIds() {
        const nodeTypesNode = this._getRootNodeTypeDefinitionNode().getNode(GrammarConstants.inScope);
        return nodeTypesNode ? nodeTypesNode.getWordsFrom(1) : [];
    }
    getNodeTypeDefinitionByFirstWordPath(firstWordPath) {
        if (!this._cachedDefinitions)
            this._cachedDefinitions = {};
        if (this._cachedDefinitions[firstWordPath])
            return this._cachedDefinitions[firstWordPath];
        const parts = firstWordPath.split(" ");
        let subject = this;
        let def;
        for (let index = 0; index < parts.length; index++) {
            const part = parts[index];
            def = subject.getRunTimeFirstWordMapWithDefinitions()[part];
            if (!def)
                def = subject._getCatchAllNodeTypeDefinition();
            subject = def;
        }
        this._cachedDefinitions[firstWordPath] = def;
        return def;
    }
    _initProgramNodeTypeDefinitionCache() {
        if (this._cache_nodeTypeDefinitions)
            return undefined;
        this._cache_nodeTypeDefinitions = {};
        this.getChildrenByNodeConstructor(NonRootNodeTypeDefinition).forEach(nodeTypeDefinitionNode => {
            this._cache_nodeTypeDefinitions[nodeTypeDefinitionNode.getNodeTypeIdFromDefinition()] = nodeTypeDefinitionNode;
        });
    }
    _getProgramNodeTypeDefinitionCache() {
        this._initProgramNodeTypeDefinitionCache();
        return this._cache_nodeTypeDefinitions;
    }
    _getRunTimeCatchAllNodeTypeId() {
        return this._getRootNodeTypeDefinitionNode().get(GrammarConstants.catchAllNodeType);
    }
    _getRootConstructor() {
        const extendedConstructor = this._getRootNodeTypeDefinitionNode()._getConstructorDefinedInGrammar();
        const grammarProgram = this;
        // Note: this is some of the most unorthodox code in this repo. We create a class on the fly for your
        // new language.
        return class extends extendedConstructor {
            getGrammarProgramRoot() {
                return grammarProgram;
            }
        };
    }
    getRootConstructor() {
        if (!this._cache_rootConstructorClass)
            this._cache_rootConstructorClass = this._getRootConstructor();
        return this._cache_rootConstructorClass;
    }
    _getFileExtensions() {
        return this._getRootNodeTypeDefinitionNode().get(GrammarConstants.extensions)
            ? this._getRootNodeTypeDefinitionNode()
                .get(GrammarConstants.extensions)
                .split(" ")
                .join(",")
            : this.getExtensionName();
    }
    toNodeJsJavascript(jtreePath = "jtree") {
        return this._nodeDefToJavascriptClass(true, jtreePath, true).trim();
    }
    // todo: have this here or not?
    toNodeJsJavascriptPrettier(jtreePath = "jtree") {
        return require("prettier").format(this.toNodeJsJavascript(jtreePath), { semi: false, parser: "babel", printWidth: 160 });
    }
    toBrowserJavascript() {
        return this._nodeDefToJavascriptClass(true, "", false).trim();
    }
    toBrowserJavascriptPrettier() {
        return require("prettier").format(this.toBrowserJavascript(), { semi: false, parser: "babel", printWidth: 160 });
    }
    _getProperName() {
        return TreeUtils.ucfirst(this.getExtensionName());
    }
    _nodeDefToJavascriptClass(isCompiled, jtreePath, forNodeJs = true) {
        const defs = this.getConcreteAndAbstractNodeTypeDefinitions();
        // todo: throw if there is no root node defined
        const rootNode = this._getRootNodeTypeDefinitionNode();
        const nodeTypeClasses = defs.map(def => def._nodeDefToJavascriptClass()).join("\n\n");
        const constantsName = this._getProperName() + "Constants";
        const nodeTypeConstants = defs
            .map(def => {
            const id = def.getNodeTypeIdFromDefinition();
            return `"${id}": "${id}"`;
        })
            .join(",\n");
        const cellTypeConstants = Object.keys(this.getCellTypeDefinitions())
            .map(id => `"${id}" : "${id}"`)
            .join(",\n");
        return `"use strict";

${forNodeJs ? `const jtree = require("${jtreePath}")` : ""}

const ${constantsName} = {
  nodeTypes: {
    ${nodeTypeConstants}
  },
  cellTypes: {
    ${cellTypeConstants}
  }
}

${nodeTypeClasses}

${forNodeJs ? `module.exports = {${constantsName}, ` + rootNode._getGeneratedClassName() + "}" : ""}
`;
    }
    toSublimeSyntaxFile() {
        const cellTypeDefs = this.getCellTypeDefinitions();
        const variables = Object.keys(cellTypeDefs)
            .map(name => ` ${name}: '${cellTypeDefs[name].getRegexString()}'`)
            .join("\n");
        const defs = this.getConcreteAndAbstractNodeTypeDefinitions().filter(kw => !kw._isAbstract());
        const nodeTypeContexts = defs.map(def => def.getMatchBlock()).join("\n\n");
        const includes = defs.map(nodeTypeDef => `  - include: '${nodeTypeDef.getNodeTypeIdFromDefinition()}'`).join("\n");
        return `%YAML 1.2
---
name: ${this.getExtensionName()}
file_extensions: [${this._getFileExtensions()}]
scope: source.${this.getExtensionName()}

variables:
${variables}

contexts:
 main:
${includes}

${nodeTypeContexts}`;
    }
    // A language where anything goes.
    // todo: can we remove? can we make the default language not require any grammar node?
    static getTheAnyLanguageRootConstructor() {
        return new GrammarProgram(`${GrammarConstants.nodeType} anyLanguage
 ${GrammarConstants.root}
 ${GrammarConstants.catchAllNodeType} anyNode
${GrammarConstants.nodeType} anyNode
 ${GrammarConstants.catchAllCellType} anyWord
 ${GrammarConstants.firstCellType} anyWord
${GrammarConstants.cellType} anyWord`).getRootConstructor();
    }
}
// Adapted from https://github.com/NeekSandhu/codemirror-textmate/blob/master/src/tmToCm.ts
var CmToken;
(function (CmToken) {
    CmToken["Atom"] = "atom";
    CmToken["Attribute"] = "attribute";
    CmToken["Bracket"] = "bracket";
    CmToken["Builtin"] = "builtin";
    CmToken["Comment"] = "comment";
    CmToken["Def"] = "def";
    CmToken["Error"] = "error";
    CmToken["Header"] = "header";
    CmToken["HR"] = "hr";
    CmToken["Keyword"] = "keyword";
    CmToken["Link"] = "link";
    CmToken["Meta"] = "meta";
    CmToken["Number"] = "number";
    CmToken["Operator"] = "operator";
    CmToken["Property"] = "property";
    CmToken["Qualifier"] = "qualifier";
    CmToken["Quote"] = "quote";
    CmToken["String"] = "string";
    CmToken["String2"] = "string-2";
    CmToken["Tag"] = "tag";
    CmToken["Type"] = "type";
    CmToken["Variable"] = "variable";
    CmToken["Variable2"] = "variable-2";
    CmToken["Variable3"] = "variable-3";
})(CmToken || (CmToken = {}));
const tmToCm = {
    comment: {
        $: CmToken.Comment
    },
    constant: {
        // TODO: Revision
        $: CmToken.Def,
        character: {
            escape: {
                $: CmToken.String2
            }
        },
        language: {
            $: CmToken.Atom
        },
        numeric: {
            $: CmToken.Number
        },
        other: {
            email: {
                link: {
                    $: CmToken.Link
                }
            },
            symbol: {
                // TODO: Revision
                $: CmToken.Def
            }
        }
    },
    entity: {
        name: {
            class: {
                $: CmToken.Def
            },
            function: {
                $: CmToken.Def
            },
            tag: {
                $: CmToken.Tag
            },
            type: {
                $: CmToken.Type,
                class: {
                    $: CmToken.Variable
                }
            }
        },
        other: {
            "attribute-name": {
                $: CmToken.Attribute
            },
            "inherited-class": {
                // TODO: Revision
                $: CmToken.Def
            }
        },
        support: {
            function: {
                // TODO: Revision
                $: CmToken.Def
            }
        }
    },
    invalid: {
        $: CmToken.Error,
        illegal: { $: CmToken.Error },
        deprecated: {
            $: CmToken.Error
        }
    },
    keyword: {
        $: CmToken.Keyword,
        operator: {
            $: CmToken.Operator
        },
        other: {
            "special-method": CmToken.Def
        }
    },
    punctuation: {
        $: CmToken.Operator,
        definition: {
            comment: {
                $: CmToken.Comment
            },
            tag: {
                $: CmToken.Bracket
            }
            // 'template-expression': {
            //     $: CodeMirrorToken.Operator,
            // },
        }
        // terminator: {
        //     $: CodeMirrorToken.Operator,
        // },
    },
    storage: {
        $: CmToken.Keyword
    },
    string: {
        $: CmToken.String,
        regexp: {
            $: CmToken.String2
        }
    },
    support: {
        class: {
            $: CmToken.Def
        },
        constant: {
            $: CmToken.Variable2
        },
        function: {
            $: CmToken.Def
        },
        type: {
            $: CmToken.Type
        },
        variable: {
            $: CmToken.Variable2,
            property: {
                $: CmToken.Property
            }
        }
    },
    variable: {
        $: CmToken.Def,
        language: {
            // TODO: Revision
            $: CmToken.Variable3
        },
        other: {
            object: {
                $: CmToken.Variable,
                property: {
                    $: CmToken.Property
                }
            },
            property: {
                $: CmToken.Property
            }
        },
        parameter: {
            $: CmToken.Def
        }
    }
};
const textMateScopeToCodeMirrorStyle = (scopeSegments, styleTree = tmToCm) => {
    const matchingBranch = styleTree[scopeSegments.shift()];
    return matchingBranch ? textMateScopeToCodeMirrorStyle(scopeSegments, matchingBranch) || matchingBranch.$ || null : null;
};
class TreeNotationCodeMirrorMode {
    constructor(name, getProgramConstructorMethod, getProgramCodeMethod, codeMirrorLib = undefined) {
        this._name = name;
        this._getProgramConstructorMethod = getProgramConstructorMethod;
        this._getProgramCodeMethod = getProgramCodeMethod || (instance => (instance ? instance.getValue() : this._originalValue));
        this._codeMirrorLib = codeMirrorLib;
    }
    _getParsedProgram() {
        const source = this._getProgramCodeMethod(this._cmInstance) || "";
        if (!this._cachedProgram || this._cachedSource !== source) {
            this._cachedSource = source;
            this._cachedProgram = new (this._getProgramConstructorMethod())(source);
        }
        return this._cachedProgram;
    }
    _getExcludedIntelliSenseTriggerKeys() {
        return {
            "8": "backspace",
            "9": "tab",
            "13": "enter",
            "16": "shift",
            "17": "ctrl",
            "18": "alt",
            "19": "pause",
            "20": "capslock",
            "27": "escape",
            "33": "pageup",
            "34": "pagedown",
            "35": "end",
            "36": "home",
            "37": "left",
            "38": "up",
            "39": "right",
            "40": "down",
            "45": "insert",
            "46": "delete",
            "91": "left window key",
            "92": "right window key",
            "93": "select",
            "112": "f1",
            "113": "f2",
            "114": "f3",
            "115": "f4",
            "116": "f5",
            "117": "f6",
            "118": "f7",
            "119": "f8",
            "120": "f9",
            "121": "f10",
            "122": "f11",
            "123": "f12",
            "144": "numlock",
            "145": "scrolllock"
        };
    }
    token(stream, state) {
        return this._advanceStreamAndReturnTokenType(stream, state);
    }
    fromTextAreaWithAutocomplete(area, options) {
        this._originalValue = area.value;
        const defaultOptions = {
            lineNumbers: true,
            mode: this._name,
            tabSize: 1,
            indentUnit: 1,
            hintOptions: {
                hint: (cmInstance, options) => this.codeMirrorAutocomplete(cmInstance, options)
            }
        };
        Object.assign(defaultOptions, options);
        this._cmInstance = this._getCodeMirrorLib().fromTextArea(area, defaultOptions);
        this._enableAutoComplete(this._cmInstance);
        return this._cmInstance;
    }
    _enableAutoComplete(cmInstance) {
        const excludedKeys = this._getExcludedIntelliSenseTriggerKeys();
        const codeMirrorLib = this._getCodeMirrorLib();
        cmInstance.on("keyup", (cm, event) => {
            // https://stackoverflow.com/questions/13744176/codemirror-autocomplete-after-any-keyup
            if (!cm.state.completionActive && !excludedKeys[event.keyCode.toString()])
                // Todo: get typings for CM autocomplete
                codeMirrorLib.commands.autocomplete(cm, null, { completeSingle: false });
        });
    }
    _getCodeMirrorLib() {
        return this._codeMirrorLib;
    }
    async codeMirrorAutocomplete(cmInstance, options) {
        const cursor = cmInstance.getDoc().getCursor();
        const codeMirrorLib = this._getCodeMirrorLib();
        const result = await this._getParsedProgram().getAutocompleteResultsAt(cursor.line, cursor.ch);
        // It seems to be better UX if there's only 1 result, and its the word the user entered, to close autocomplete
        if (result.matches.length === 1 && result.matches[0].text === result.word)
            return null;
        return result.matches.length
            ? {
                list: result.matches,
                from: codeMirrorLib.Pos(cursor.line, result.startCharIndex),
                to: codeMirrorLib.Pos(cursor.line, result.endCharIndex)
            }
            : null;
    }
    register() {
        const codeMirrorLib = this._getCodeMirrorLib();
        codeMirrorLib.defineMode(this._name, () => this);
        codeMirrorLib.defineMIME("text/" + this._name, this._name);
        return this;
    }
    _advanceStreamAndReturnTokenType(stream, state) {
        let nextCharacter = stream.next();
        const lineNumber = this._getLineNumber(stream, state);
        while (typeof nextCharacter === "string") {
            const peek = stream.peek();
            if (nextCharacter === " ") {
                if (peek === undefined || peek === "\n") {
                    stream.skipToEnd(); // advance string to end
                    this._incrementLine(state);
                }
                return "bracket";
            }
            if (peek === " ") {
                state.cellIndex++;
                return this._getCellStyle(lineNumber, state.cellIndex);
            }
            nextCharacter = stream.next();
        }
        state.cellIndex++;
        const style = this._getCellStyle(lineNumber, state.cellIndex);
        this._incrementLine(state);
        return style;
    }
    _getLineNumber(stream, state) {
        const num = stream.lineOracle.line + 1; // state.lineIndex
        return num;
    }
    _getCellStyle(lineIndex, cellIndex) {
        const program = this._getParsedProgram();
        // todo: if the current word is an error, don't show red?
        const highlightScope = program.getCellHighlightScopeAtPosition(lineIndex, cellIndex);
        const style = highlightScope ? textMateScopeToCodeMirrorStyle(highlightScope.split(".")) : undefined;
        return style || "noHighlightScopeDefinedInGrammar";
    }
    // todo: remove.
    startState() {
        return {
            cellIndex: 0
        };
    }
    _incrementLine(state) {
        state.cellIndex = 0;
    }
}
class UnknownGrammarProgram extends TreeNode {
    getPredictedGrammarFile(grammarName) {
        const rootNode = new TreeNode(`${GrammarConstants.nodeType} ${grammarName}
 ${GrammarConstants.root}`);
        // note: right now we assume 1 global cellTypeMap and nodeTypeMap per grammar. But we may have scopes in the future?
        const globalCellTypeMap = new Map();
        const xi = this.getXI();
        const yi = this.getYI();
        rootNode.nodeAt(0).touchNode(GrammarConstants.inScope).setWordsFrom(1, Array.from(new Set(this.getFirstWords())));
        const clone = this.clone();
        let allNodes = clone.getTopDownArrayIterator();
        let node;
        for (node of allNodes) {
            const firstWord = node.getFirstWord();
            const asInt = parseInt(firstWord);
            if (!isNaN(asInt) && asInt.toString() === firstWord && node.getParent().getFirstWord())
                node.setFirstWord(node.getParent().getFirstWord() + "Child");
        }
        allNodes = clone.getTopDownArrayIterator();
        const allChilds = {};
        const allFirstWordNodes = {};
        for (let node of allNodes) {
            const firstWord = node.getFirstWord();
            if (!allChilds[firstWord])
                allChilds[firstWord] = {};
            if (!allFirstWordNodes[firstWord])
                allFirstWordNodes[firstWord] = [];
            allFirstWordNodes[firstWord].push(node);
            node.forEach((child) => {
                allChilds[firstWord][child.getFirstWord()] = true;
            });
        }
        const lineCount = clone.getNumberOfLines();
        const firstWords = Object.keys(allChilds).map(firstWord => {
            const defNode = new TreeNode(`${GrammarConstants.nodeType} ${firstWord}`).nodeAt(0);
            const childFirstWords = Object.keys(allChilds[firstWord]);
            if (childFirstWords.length)
                defNode.touchNode(GrammarConstants.inScope).setWordsFrom(1, childFirstWords);
            const allLines = allFirstWordNodes[firstWord];
            const cells = allLines
                .map(line => line.getContent())
                .filter(i => i)
                .map(i => i.split(xi));
            const sizes = new Set(cells.map(c => c.length));
            const max = Math.max(...Array.from(sizes));
            const min = Math.min(...Array.from(sizes));
            let catchAllCellType;
            let cellTypes = [];
            for (let index = 0; index < max; index++) {
                const cellType = this._getBestCellType(firstWord, cells.map(c => c[index]));
                if (cellType.cellTypeDefinition && !globalCellTypeMap.has(cellType.cellTypeId))
                    globalCellTypeMap.set(cellType.cellTypeId, cellType.cellTypeDefinition);
                cellTypes.push(cellType.cellTypeId);
            }
            if (max > min) {
                //columns = columns.slice(0, min)
                catchAllCellType = cellTypes.pop();
                while (cellTypes[cellTypes.length - 1] === catchAllCellType) {
                    cellTypes.pop();
                }
            }
            if (catchAllCellType)
                defNode.set(GrammarConstants.catchAllCellType, catchAllCellType);
            if (cellTypes.length > 1)
                defNode.set(GrammarConstants.cells, cellTypes.join(xi));
            if (!catchAllCellType && cellTypes.length === 1)
                defNode.set(GrammarConstants.cells, cellTypes[0]);
            // Todo: switch to conditional frequency
            //defNode.set(GrammarConstants.frequency, (allLines.length / lineCount).toFixed(3))
            return defNode.getParent().toString();
        });
        const cellTypes = [];
        globalCellTypeMap.forEach(def => cellTypes.push(def));
        return [rootNode.toString(), cellTypes.join(yi), firstWords.join(yi)].filter(i => i).join("\n");
    }
    _getBestCellType(firstWord, allValues) {
        const asSet = new Set(allValues);
        const xi = this.getXI();
        const values = Array.from(asSet).filter(c => c);
        const all = (fn) => {
            for (let i = 0; i < values.length; i++) {
                if (!fn(values[i]))
                    return false;
            }
            return true;
        };
        if (all((str) => str === "0" || str === "1"))
            return { cellTypeId: GrammarStandardCellTypeIds.bit };
        if (all((str) => {
            const num = parseInt(str);
            if (isNaN(num))
                return false;
            return num.toString() === str;
        })) {
            return { cellTypeId: GrammarStandardCellTypeIds.int };
        }
        if (all((str) => !str.match(/[^\d\.\-]/)))
            return { cellTypeId: GrammarStandardCellTypeIds.float };
        const bools = new Set(["1", "0", "true", "false", "t", "f", "yes", "no"]);
        if (all((str) => bools.has(str.toLowerCase())))
            return { cellTypeId: GrammarStandardCellTypeIds.bool };
        // If there are duplicate files and the set is less than enum
        const enumLimit = 30;
        if ((asSet.size === 1 || allValues.length > asSet.size) && asSet.size < enumLimit)
            return {
                cellTypeId: `${firstWord}Enum`,
                cellTypeDefinition: `cellType ${firstWord}Enum
 enum ${values.join(xi)}`
            };
        return { cellTypeId: GrammarStandardCellTypeIds.any };
    }
}
class jtree {
}
jtree.GrammarBackedRootNode = GrammarBackedRootNode;
jtree.Utils = TreeUtils;
jtree.TreeNode = TreeNode;
jtree.NonTerminalNode = GrammarBackedNonTerminalNode;
jtree.BlobNode = GrammarBackedBlobNode;
jtree.ErrorNode = GrammarBackedErrorNode;
jtree.TerminalNode = GrammarBackedTerminalNode;
jtree.GrammarProgram = GrammarProgram;
jtree.UnknownGrammarProgram = UnknownGrammarProgram;
jtree.TreeNotationCodeMirrorMode = TreeNotationCodeMirrorMode;
jtree.getVersion = () => "30.0.0";
class Upgrader extends TreeNode {
    upgradeManyInPlace(globPatterns, fromVersion, toVersion) {
        this._upgradeMany(globPatterns, fromVersion, toVersion).forEach(file => file.tree.toDisk(file.path));
        return this;
    }
    upgradeManyPreview(globPatterns, fromVersion, toVersion) {
        return this._upgradeMany(globPatterns, fromVersion, toVersion);
    }
    _upgradeMany(globPatterns, fromVersion, toVersion) {
        const glob = require("glob");
        const files = globPatterns.map(pattern => glob.sync(pattern)).flat();
        console.log(`${files.length} files to upgrade`);
        return files.map((path) => {
            console.log("Upgrading " + path);
            return {
                tree: this.upgrade(TreeNode.fromDisk(path), fromVersion, toVersion),
                path: path
            };
        });
    }
    upgrade(code, fromVersion, toVersion) {
        const updateFromMap = this.getUpgradeFromMap();
        const semver = require("semver");
        let fromMap;
        while ((fromMap = updateFromMap[fromVersion])) {
            const toNextVersion = Object.keys(fromMap)[0]; // todo: currently we just assume 1 step at a time
            if (semver.lt(toVersion, toNextVersion))
                break;
            const fn = Object.values(fromMap)[0];
            code = fn(code);
            fromVersion = toNextVersion;
        }
        return code;
    }
}
