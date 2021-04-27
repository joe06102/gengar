import FS from "fs";
import Path from "path";
import { Program } from "./ast";
import { GengarLexer } from "./lexer";
import { GengarParser } from "./parser";

export class GengarCompiler {
  private lexer: GengarLexer;
  private parser: GengarParser;
  private program: Program | undefined;

  constructor(source: string) {
    this.lexer = new GengarLexer(source);
    this.parser = new GengarParser(this.lexer);
  }

  Compile() {
    this.program = this.parser.Parse();
  }

  Generate() {
    return this.program?.generate();
  }
}

const ggc = new GengarCompiler(
  FS.readFileSync(Path.resolve(__dirname, "../demo/hello.gengar"), {
    encoding: "utf-8",
  })
);
ggc.Compile();
console.log(ggc.Generate());
