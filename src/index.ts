import FS from "fs";
import Path from "path";
import { GengarCompiler } from "./compiler";

const SourceFile = "hello.gengar";
const SourceFilePath = Path.resolve(__dirname, "../demo", SourceFile);
const JSFile = "hello.js";
const JSFilePath = Path.resolve(__dirname, "../demo", JSFile);
const SourceMapFile = "hello.js.map";
const SourceMapFilePath = Path.resolve(__dirname, "../demo", SourceMapFile);

const ggc = new GengarCompiler(
  FS.readFileSync(SourceFilePath, {
    encoding: "utf-8",
  }),
  SourceFile
);

const compileResult = ggc
  .Compile()
  .Generate()
  ?.toStringWithSourceMap({ file: SourceMapFile });

FS.writeFileSync(
  JSFilePath,
  compileResult?.code + `\n//# sourceMappingURL=${SourceMapFile}`
);
FS.writeFileSync(SourceMapFilePath, compileResult?.map as any);
