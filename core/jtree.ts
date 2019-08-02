//tooling product jtree.node.js

import TreeUtils from "./TreeUtils"
import TreeNode from "./TreeNode"

import { GrammarProgram, GrammarBackedRootNode, GrammarBackedNonRootNode } from "./GrammarLanguage"
import { UnknownGrammarProgram } from "./UnknownGrammarProgram"
import { TreeNotationCodeMirrorMode } from "./TreeNotationCodeMirrorMode"

class jtree {
  static GrammarBackedRootNode = GrammarBackedRootNode
  static GrammarBackedNonRootNode = GrammarBackedNonRootNode
  static Utils = TreeUtils
  static TreeNode = TreeNode
  static GrammarProgram = GrammarProgram
  static UnknownGrammarProgram = UnknownGrammarProgram
  static TreeNotationCodeMirrorMode = TreeNotationCodeMirrorMode
  static getVersion = () => "36.2.0"
}

export default jtree
