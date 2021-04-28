import { SourceNode } from "source-map";
export abstract class ASTNode {
  Line: number;
  Col: number;
  Type: NodeType;
  File: string | null = null;

  constructor(line: number, col: number, type: NodeType, file: string) {
    this.Line = line ?? 1;
    this.Col = col ?? 0;
    this.Type = type ?? NodeType.Unknown;
    this.File = file;
  }

  abstract Generate(): SourceNode;

  CreateSourceNode() {
    return new SourceNode(this.Line, this.Col, this.File, "");
  }
}

export enum NodeType {
  Unknown,
  Program,
  MainDeclare,
  TypeAnotation,
  VarDeclare,
  CallExpression,
  Identifier,
  ReturnStatement,
  FunctionDeclare,
  MemberExpression,
  StringLiteral,
  NumberLiteral,
  BoolLiteral,
  Debugger,
}

export class Program extends ASTNode {
  Generate(): SourceNode {
    return this.CreateSourceNode()
      .add("function print(...args){\n  console.log(...args);\n}\n")
      .add(this.Body.map((n) => n.Generate()));
  }
  constructor(public Body: ASTNode[], line: number, col: number, file: string) {
    super(line, col, NodeType.Program, file);
  }
}

export class MainDeclare extends ASTNode {
  Generate(): SourceNode {
    return this.CreateSourceNode()
      .add(";(function(){")
      .add(this.Body.map((n) => n.Generate()))
      .add("})();\n");
  }
  constructor(public Body: ASTNode[], line: number, col: number, file: string) {
    super(line, col, NodeType.MainDeclare, file);
  }
}

export class FunctionDeclare extends ASTNode {
  Generate(): SourceNode {
    return this.CreateSourceNode()
      .add("function ")
      .add(this.Id.Generate())
      .add("(")
      .add(this.Params.map((p) => p.Generate()))
      .add(") {")
      .add(this.Body.map((n) => n.Generate()))
      .add("}");
  }
  constructor(
    public Id: Identifier,
    public Params: Identifier[],
    public Body: ASTNode[],
    line: number,
    col: number,
    file: string
  ) {
    super(line, col, NodeType.FunctionDeclare, file);
  }
}
export class TypeAnotation extends ASTNode {
  Generate(): SourceNode {
    return this.CreateSourceNode()
      .add(":")
      .add(new SourceNode(this.Line, this.Col, null, this.Val));
  }
  constructor(
    public Val: "string" | "number" | "boolean",
    line: number,
    col: number,
    file: string
  ) {
    super(line, col, NodeType.TypeAnotation, file);
  }
}

export class VarDeclare extends ASTNode {
  Generate(): SourceNode {
    return this.CreateSourceNode()
      .add(this.Kind === "mut" ? "let " : "const ")
      .add(this.Id.Generate())
      .add("=")
      .add(this.Init.Generate())
      .add(";");
  }
  constructor(
    public Kind: "mut" | "const",
    public Id: Identifier,
    public Init: ASTNode,
    line: number,
    col: number,
    file: string
  ) {
    super(line, col, NodeType.VarDeclare, file);
  }
}

export class CallExpression extends ASTNode {
  Generate(): SourceNode {
    return this.CreateSourceNode()
      .add(this.Id.Generate())
      .add("(")
      .add(this.Args.map((n) => n.Generate()))
      .add(")");
  }
  constructor(
    public Id: Identifier | MemberExpression,
    public Args: ASTNode[],
    line: number,
    col: number,
    file: string
  ) {
    super(line, col, NodeType.CallExpression, file);
  }
}

export class Identifier extends ASTNode {
  Generate(): SourceNode {
    return this.CreateSourceNode().add(this.Name);
  }
  constructor(public Name: string, line: number, col: number, file: string) {
    super(line, col, NodeType.Identifier, file);
  }
}

export class MemberExpression extends ASTNode {
  Generate(): SourceNode {
    return this.CreateSourceNode()
      .add(this.Object.Generate())
      .add(".")
      .add(this.Property.Generate());
  }
  constructor(
    public Object: Identifier | MemberExpression,
    public Property: Identifier,
    line: number,
    col: number,
    file: string
  ) {
    super(line, col, NodeType.MemberExpression, file);
  }
}

export class ReturnStatement extends ASTNode {
  Generate(): SourceNode {
    return this.CreateSourceNode()
      .add("\nreturn (")
      .add(this.Argument.Generate())
      .add(")");
  }
  constructor(
    public Argument: ASTNode,
    line: number,
    col: number,
    file: string
  ) {
    super(line, col, NodeType.ReturnStatement, file);
  }
}

export class StringLiteral extends ASTNode {
  Generate(): SourceNode {
    return this.CreateSourceNode().add(this.Val);
  }
  constructor(public Val: string, line: number, col: number, file: string) {
    super(line, col, NodeType.StringLiteral, file);
  }
}

export class NumberLiteral extends ASTNode {
  Generate(): SourceNode {
    return this.CreateSourceNode().add(this.Val);
  }
  constructor(public Val: string, line: number, col: number, file: string) {
    super(line, col, NodeType.NumberLiteral, file);
  }
}

export class BooleanLiteral extends ASTNode {
  Generate(): SourceNode {
    return this.CreateSourceNode().add(this.Val);
  }
  constructor(public Val: string, line: number, col: number, file: string) {
    super(line, col, NodeType.BoolLiteral, file);
  }
}

export class DebuggerNode extends ASTNode {
  Generate(): SourceNode {
    return this.CreateSourceNode().add("\n").add(this.Val).add(";");
  }
  constructor(public Val: string, line: number, col: number, file: string) {
    super(line, col, NodeType.Debugger, file);
  }
}
