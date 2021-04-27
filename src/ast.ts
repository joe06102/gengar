export abstract class ASTNode {
  Line: number;
  Col: number;
  Type: NodeType;

  constructor(line?: number, col?: number, type?: NodeType) {
    this.Line = line ?? 0;
    this.Col = col ?? 0;
    this.Type = type ?? NodeType.Unknown;
  }

  abstract generate(): string;
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
}

export class Program extends ASTNode {
  generate(): string {
    return `function print(...args){\n  console.log(...args);\n}\n${this.Body.map(
      (n) => n.generate()
    ).join("\n\n")}`;
  }
  constructor(public Body: ASTNode[], line: number, col: number) {
    super(line, col, NodeType.Program);
  }
}

export class MainDeclare extends ASTNode {
  generate(): string {
    return `;(function(){\n  ${this.Body.map((n) => n.generate()).join(
      "\n  "
    )}\n})();`;
  }
  constructor(public Body: ASTNode[], line: number, col: number) {
    super(line, col, NodeType.MainDeclare);
  }
}

export class FunctionDeclare extends ASTNode {
  generate(): string {
    return `function ${this.Id.generate()}(${this.Params.map((n) =>
      n.generate()
    ).join(",")}) {\n  ${this.Body.map((n) => n.generate()).join(";\n")}\n}
    `;
  }
  constructor(
    public Id: Identifier,
    public Params: Identifier[],
    public Body: ASTNode[],
    line: number,
    col: number
  ) {
    super(line, col);
  }
}
export class TypeAnotation extends ASTNode {
  generate(): string {
    return "";
  }
  constructor(
    public Val: "string" | "number" | "boolean",
    line: number,
    col: number
  ) {
    super(line, col, NodeType.MainDeclare);
  }
}

export class VarDeclare extends ASTNode {
  generate(): string {
    return `${
      this.Kind === "mut" ? "let" : "const"
    } ${this.Id.generate()} = ${this.Init.generate()};`;
  }
  constructor(
    public Kind: "mut" | "const",
    public Id: Identifier,
    public Init: ASTNode,
    line: number,
    col: number
  ) {
    super(line, col);
  }
}

export class CallExpression extends ASTNode {
  generate(): string {
    return `${this.Id.generate()}(${this.Args.map((n) => n.generate()).join(
      ","
    )})`;
  }
  constructor(
    public Id: Identifier | MemberExpression,
    public Args: ASTNode[],
    line: number,
    col: number
  ) {
    super(line, col);
  }
}

export class Identifier extends ASTNode {
  generate(): string {
    return this.Name;
  }
  constructor(public Name: string, line: number, col: number) {
    super(line, col);
  }
}

export class MemberExpression extends ASTNode {
  generate(): string {
    return `${this.Object.generate()}.${this.Property.generate()}`;
  }
  constructor(
    public Object: Identifier | MemberExpression,
    public Property: Identifier,
    line: number,
    col: number
  ) {
    super(line, col);
  }
}

export class ReturnStatement extends ASTNode {
  generate(): string {
    return `return (\n    ${this.Argument.generate()}\n  )`;
  }
  constructor(public Argument: ASTNode, line: number, col: number) {
    super(line, col);
  }
}

export class StringLiteral extends ASTNode {
  generate(): string {
    return this.Val;
  }
  constructor(public Val: string, line: number, col: number) {
    super(line, col);
  }
}

export class NumberLiteral extends ASTNode {
  generate(): string {
    return this.Val;
  }
  constructor(public Val: string, line: number, col: number) {
    super(line, col);
  }
}

export class BooleanLiteral extends ASTNode {
  generate(): string {
    return this.Val;
  }
  constructor(public Val: string, line: number, col: number) {
    super(line, col);
  }
}
