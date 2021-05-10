import { SourceNode } from "source-map";
import { UnexpectedTokenError } from "./error";
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

export abstract class Statement extends ASTNode {}

export abstract class Expression extends Statement {}

export class ExpressionStatement extends Statement {
  Generate(): SourceNode {
    return this.CreateSourceNode().add(this.Expression.Generate()).add(";");
  }
  constructor(public Expression: Expression) {
    super(
      Expression.Line,
      Expression.Col,
      NodeType.ExpressionStatement,
      Expression.File!
    );
  }
}

export class BlockStatement extends Statement {
  Generate(): SourceNode {
    return this.CreateSourceNode()
      .add("{\n")
      .add(this.Body.map((n) => n.Generate()))
      .add("\n}");
  }
  constructor(public Body: Statement[], file: string) {
    super(1, 0, NodeType.BlockStatement, file!);
  }
}

export enum NodeType {
  Unknown,
  Program,
  MainDeclare,
  FunctionDeclare,
  TypeAnotation,
  VarDeclare,
  IfStatement,
  WhileStatement,
  ReturnStatement,
  DebuggerStatement,
  ExpressionStatement,
  BlockStatement,
  AssignExpression,
  CallExpression,
  Identifier,
  MemberExpression,
  StringLiteral,
  NumberLiteral,
  BoolLiteral,
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
      .add(";(function()")
      .add(this.Body.Generate())
      .add(")();\n");
  }
  constructor(
    public Body: BlockStatement,
    line: number,
    col: number,
    file: string
  ) {
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
      .add(") ")
      .add(this.Body.Generate());
  }
  constructor(
    public Id: Identifier,
    public Params: Identifier[],
    public Body: BlockStatement,
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

export class VarDeclare extends Statement {
  Generate(): SourceNode {
    return this.CreateSourceNode()
      .add(this.Kind === "mut" ? "let " : "const ")
      .add(this.Id.Generate())
      .add("=")
      .add(this.Init.Generate())
      .add(";");
  }
  constructor(
    public Kind: string,
    public Id: Identifier,
    public Init: ASTNode,
    line: number,
    col: number,
    file: string
  ) {
    super(line, col, NodeType.VarDeclare, file);
  }
}

export class IfStatement extends Statement {
  Generate(): SourceNode {
    let ret = this.CreateSourceNode()
      .add("\nif(")
      .add(this.Test.Generate())
      .add(")")
      .add(this.Consequent.Generate());

    if (this.Alternate) {
      ret.add("else ").add(this.Alternate.Generate());
    }

    return ret;
  }
  constructor(
    line: number,
    col: number,
    file: string,
    public Test: Expression,
    public Consequent: BlockStatement,
    public Alternate?: IfStatement | BlockStatement
  ) {
    super(line, col, NodeType.VarDeclare, file);
  }
}

export class WhileStatement extends Statement {
  Generate(): SourceNode {
    return this.CreateSourceNode()
      .add("while(")
      .add(this.Test.Generate())
      .add(")")
      .add(this.Body.Generate());
  }

  constructor(
    line: number,
    col: number,
    file: string,
    public Test: Expression,
    public Body: BlockStatement
  ) {
    super(line, col, NodeType.WhileStatement, file);
  }
}

export class AssignExpression extends Expression {
  Generate(): SourceNode {
    return this.CreateSourceNode()
      .add(this.Id.Generate())
      .add(` ${this.Operator} `)
      .add(this.Init.Generate());
  }
  constructor(
    public Id: Identifier | MemberExpression,
    public Init: Expression,
    public Operator: string,
    line: number,
    col: number,
    file: string
  ) {
    super(line, col, NodeType.CallExpression, file);
  }
}

export class BinaryExpression extends Expression {
  Generate(): SourceNode {
    if (this.Left == null) {
      throw new UnexpectedTokenError(
        `Literal | MemberExpression | CallExpression | Identifier`,
        `${this.Left}`
      );
    }

    return this.CreateSourceNode()
      .add(this.Left.Generate())
      .add(` ${this.Operator} `)
      .add(this.Right.Generate());
  }
  constructor(
    public Left: Expression | null,
    public Right: Expression,
    public Operator: string,
    line: number,
    col: number,
    file: string
  ) {
    super(line, col, NodeType.CallExpression, file);
  }
}

export class CallExpression extends Expression {
  Generate(): SourceNode {
    return this.CreateSourceNode()
      .add(this.Id.Generate())
      .add("(")
      .add(
        this.Args.reduce((args, n, index) => {
          args.push(n.Generate());

          if (index !== this.Args.length - 1) {
            args.push(",");
          }
          return args;
        }, [] as any[])
      )
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

export class Identifier extends Expression {
  Generate(): SourceNode {
    return this.CreateSourceNode().add(this.Name);
  }
  constructor(public Name: string, line: number, col: number, file: string) {
    super(line, col, NodeType.Identifier, file);
  }
}

export class MemberExpression extends Expression {
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

export class ReturnStatement extends Statement {
  Generate(): SourceNode {
    return this.CreateSourceNode()
      .add("\nreturn (")
      .add(this.Argument.Generate())
      .add(");");
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

export class StringLiteral extends Expression {
  Generate(): SourceNode {
    return this.CreateSourceNode().add(this.Val);
  }
  constructor(public Val: string, line: number, col: number, file: string) {
    super(line, col, NodeType.StringLiteral, file);
  }
}

export class NumberLiteral extends Expression {
  Generate(): SourceNode {
    return this.CreateSourceNode().add(this.Val);
  }
  constructor(public Val: string, line: number, col: number, file: string) {
    super(line, col, NodeType.NumberLiteral, file);
  }
}

export class BooleanLiteral extends Expression {
  Generate(): SourceNode {
    return this.CreateSourceNode().add(this.Val);
  }
  constructor(public Val: string, line: number, col: number, file: string) {
    super(line, col, NodeType.BoolLiteral, file);
  }
}

export class DebuggerNode extends Statement {
  Generate(): SourceNode {
    return this.CreateSourceNode().add("\n").add(this.Val).add(";");
  }
  constructor(public Val: string, line: number, col: number, file: string) {
    super(line, col, NodeType.DebuggerStatement, file);
  }
}
