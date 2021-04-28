import { Program } from "./ast";
import { GengarLexer } from "./lexer";
import { GengarParser } from "./parser";

export class GengarCompiler {
  private lexer: GengarLexer;
  private parser: GengarParser;
  private program: Program | undefined;

  constructor(source: string, filename: string) {
    this.lexer = new GengarLexer(source);
    this.parser = new GengarParser(this.lexer, filename);
  }

  Compile() {
    this.program = this.parser.Parse();
    return this;
  }

  Generate() {
    return this.program?.Generate();
  }
}
