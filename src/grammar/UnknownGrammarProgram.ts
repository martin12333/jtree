import TreeNode from "../base/TreeNode"

import { GrammarConstants, GrammarStandardCellTypes } from "./GrammarConstants"

import jTreeTypes from "../jTreeTypes"

class UnknownGrammarProgram extends TreeNode {
  getPredictedGrammarFile(grammarName: string): string {
    const rootNode = new TreeNode(`${GrammarConstants.grammar}
 ${GrammarConstants.name} ${grammarName}`)

    // note: right now we assume 1 global cellTypeMap and nodeTypeMap per grammar. But we may have scopes in the future?
    const globalCellTypeMap = new Map()
    const xi = this.getXI()
    const yi = this.getYI()

    this.getFirstWords().forEach(firstWord => rootNode.touchNode(`${GrammarConstants.grammar} ${GrammarConstants.inScope} ${firstWord}`))

    const clone = <UnknownGrammarProgram>this.clone()
    let allNodes = clone.getTopDownArrayIterator()
    let node: TreeNode
    for (node of allNodes) {
      const firstWord = node.getFirstWord()
      const asInt = parseInt(firstWord)
      if (!isNaN(asInt) && asInt.toString() === firstWord && node.getParent().getFirstWord()) node.setFirstWord(node.getParent().getFirstWord() + "Child")
    }
    allNodes = clone.getTopDownArrayIterator()
    const allChilds: { [firstWord: string]: jTreeTypes.stringMap } = {}
    const allFirstWordNodes: { [firstWord: string]: TreeNode[] } = {}
    for (let node of allNodes) {
      const firstWord = node.getFirstWord()
      if (!allChilds[firstWord]) allChilds[firstWord] = {}
      if (!allFirstWordNodes[firstWord]) allFirstWordNodes[firstWord] = []
      allFirstWordNodes[firstWord].push(node)
      node.forEach((child: TreeNode) => {
        allChilds[firstWord][child.getFirstWord()] = true
      })
    }

    const lineCount = clone.getNumberOfLines()

    const firstWords = Object.keys(allChilds).map(firstWord => {
      const defNode = <TreeNode>new TreeNode(`${GrammarConstants.nodeType} ${firstWord}`).nodeAt(0)
      const childFirstWords = Object.keys(allChilds[firstWord])
      if (childFirstWords.length) {
        //defNode.touchNode(GrammarConstants.blob) // todo: remove?
        defNode.touchNode(GrammarConstants.inScope).setContent(childFirstWords.join(" "))
      }

      const allLines = allFirstWordNodes[firstWord]
      const cells = allLines
        .map(line => line.getContent())
        .filter(i => i)
        .map(i => i.split(xi))
      const sizes = new Set(cells.map(c => c.length))
      const max = Math.max(...Array.from(sizes))
      const min = Math.min(...Array.from(sizes))
      let catchAllCellType: string
      let cellTypes = []
      for (let index = 0; index < max; index++) {
        const cellType = this._getBestCellType(firstWord, cells.map(c => c[index]))
        if (cellType.cellTypeDefinition && !globalCellTypeMap.has(cellType.cellTypeName))
          globalCellTypeMap.set(cellType.cellTypeName, cellType.cellTypeDefinition)

        cellTypes.push(cellType.cellTypeName)
      }
      if (max > min) {
        //columns = columns.slice(0, min)
        catchAllCellType = cellTypes.pop()
        while (cellTypes[cellTypes.length - 1] === catchAllCellType) {
          cellTypes.pop()
        }
      }

      if (catchAllCellType) defNode.set(GrammarConstants.catchAllCellType, catchAllCellType)

      if (cellTypes.length > 1) defNode.set(GrammarConstants.cells, cellTypes.join(xi))

      if (!catchAllCellType && cellTypes.length === 1) defNode.set(GrammarConstants.cells, cellTypes[0])

      // Todo: switch to conditional frequency
      //defNode.set(GrammarConstants.frequency, (allLines.length / lineCount).toFixed(3))
      return defNode.getParent().toString()
    })

    const cellTypes: string[] = []
    globalCellTypeMap.forEach(def => cellTypes.push(def))

    return [rootNode.toString(), cellTypes.join(yi), firstWords.join(yi)].filter(i => i).join("\n")
  }

  private _getBestCellType(firstWord: string, allValues: any[]): { cellTypeName: string; cellTypeDefinition?: string } {
    const asSet = new Set(allValues)
    const xi = this.getXI()
    const values = Array.from(asSet).filter(c => c)
    const all = (fn: Function) => {
      for (let i = 0; i < values.length; i++) {
        if (!fn(values[i])) return false
      }
      return true
    }
    if (all((str: string) => str === "0" || str === "1")) return { cellTypeName: GrammarStandardCellTypes.bit }

    if (
      all((str: string) => {
        const num = parseInt(str)
        if (isNaN(num)) return false
        return num.toString() === str
      })
    ) {
      return { cellTypeName: GrammarStandardCellTypes.int }
    }

    if (all((str: string) => !str.match(/[^\d\.\-]/))) return { cellTypeName: GrammarStandardCellTypes.float }

    const bools = new Set(["1", "0", "true", "false", "t", "f", "yes", "no"])
    if (all((str: string) => bools.has(str.toLowerCase()))) return { cellTypeName: GrammarStandardCellTypes.bool }

    // If there are duplicate files and the set is less than enum
    const enumLimit = 30
    if ((asSet.size === 1 || allValues.length > asSet.size) && asSet.size < enumLimit)
      return {
        cellTypeName: `${firstWord}Enum`,
        cellTypeDefinition: `cellType ${firstWord}Enum
 enum ${values.join(xi)}`
      }

    return { cellTypeName: GrammarStandardCellTypes.any }
  }
}

export default UnknownGrammarProgram
