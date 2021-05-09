import { GengarLexer } from "./lexer";
import { Token, TokenTypes as tt } from "./token";
import {
  AssignExpression,
  ASTNode,
  BlockStatement,
  BooleanLiteral,
  CallExpression,
  DebuggerNode,
  Expression,
  ExpressionStatement,
  FunctionDeclare,
  Identifier,
  IfStatement,
  MainDeclare,
  MemberExpression,
  NumberLiteral,
  Program,
  ReturnStatement,
  Statement,
  StringLiteral,
  TypeAnotation,
  VarDeclare,
  WhileStatement,
} from "./ast";
import { UnexpectedTokenError } from "./error";
/**
 * S                -> MAIN | FN
 * MAIN             -> main(): TYPEANNOTATION BLOCKSTATEMENT
 * FN               -> fn IDENTIFIER(PARAMS) BLOCKSTATEMENT
 * BLOCKSTATEMENT   -> { STATEMENT* | EXPRESSION* }
 * STATEMENT        -> VARDECLARE | IF | WHILE | RETURN | DEBUGGER
 * EXPRESSION       -> ASSIGNEXP | CALLEXP | MEMBEREXP | IDENTIFIER | LITERAL
 * VARDECLARE       -> VARKIND IDENTIFIER : TYPEANNOTATION = EXPRESSION;
 * IF               -> if (EXPRESSION) BLOCKSTATEMENT else IF | BLOCKSTATEMENT
 * VARKIND          -> const | mut
 * ASSIGNEXP        -> IDENTIFIER | MEMBEREXP = EXPRESSION
 * CALLEXP          -> IDENTIFIER(EXPRESSION) | MEMBEREXP(EXPRESSION);
 * MEMBEREXP        -> IDENTIFIER.IDENTIFIER | . MEMBEREXP
 * RETURN           -> EXPRESSION
 * LITERAL          -> StringLiteral | NumberLiteral | BooleanLiteral
 * TYPEANNOTATION   -> string | number | boolean
 * PARAMS           -> IDENTIFIER : TYPEANNOTATION | , PARAMS
 * IDENTIFIER       -> non-keywords Alphabets
 */
export class GengarParser {
  constructor(private lexer: GengarLexer, private sourceFile: string) {}

  Parse(): Program {
    const body: ASTNode[] = [];
    this.lexer.GetToken();

    while (this.lexer.CurrentToken?.Type !== tt.EOF) {
      if (
        this.lexer.CurrentToken?.Type === tt.ID &&
        this.lexer.CurrentToken?.Val === "main"
      ) {
        body.push(this.ParseMain());
      }

      if (
        this.lexer.CurrentToken?.Type === tt.ID &&
        this.lexer.CurrentToken?.Val === "fn"
      ) {
        body.push(this.ParseFn());
      }

      this.lexer.GetToken();
    }

    return new Program(body, 1, 0, this.sourceFile);
  }

  ParseMain(): MainDeclare {
    let body: BlockStatement;
    const startToken = this.lexer.CurrentToken;
    this.lexer.SkipTo([tt.LeftBracket]);
    body = this.ParseBlockStatement();

    return new MainDeclare(
      body,
      startToken?.Line!,
      startToken?.Col!,
      this.sourceFile
    );
  }

  ParseFn(): FunctionDeclare {
    let id: Identifier | undefined;
    let params: Identifier[] = [];
    let body: BlockStatement;
    const token = this.lexer.CurrentToken;

    const skippedIdTokens = this.lexer.SkipTo([tt.LeftParenthesis]);
    params = this.ParseParams();
    this.lexer.SkipTo([tt.LeftBracket]);
    body = this.ParseBlockStatement();
    const idToken = skippedIdTokens.find((t) => t.Type === tt.ID);

    if (idToken) {
      id = new Identifier(
        idToken.Val as string,
        idToken.Line,
        idToken.Col,
        this.sourceFile
      );
    }

    if (id == null) {
      throw new Error(`unexpected fn identitifer`);
    }

    return new FunctionDeclare(
      id,
      params,
      body,
      token?.Line!,
      token?.Col!,
      this.sourceFile
    );
  }

  ParseBlockStatement(): BlockStatement {
    const body: ASTNode[] = [];
    let prevToken = this.lexer.CurrentToken;

    while (this.lexer.CurrentToken?.Type !== tt.RightBracket) {
      if (this.lexer.CurrentToken?.Type === tt.Keywords) {
        body.push(this.ParseStatement());
      } else if (
        [tt.ID, tt.StringLiteral, tt.NumberLiteral, tt.BoolLiteral].includes(
          this.lexer.CurrentToken?.Type!
        )
      ) {
        body.push(new ExpressionStatement(this.ParseExpression()));
      }

      if (this.lexer.CurrentToken !== prevToken) {
        prevToken = this.lexer.CurrentToken;
        continue;
      }
      prevToken = this.lexer.GetToken();
    }

    return new BlockStatement(body, this.sourceFile);
  }

  ParseStatement(): Statement {
    const val = this.lexer.CurrentToken?.Val;

    switch (val) {
      case "const":
      case "mut": {
        return this.ParseValDeclareStatement();
      }
      case "if": {
        return this.ParseIfStatement();
      }
      case "while": {
        return this.ParseWhileStatement();
      }
      case "debugger": {
        return this.ParseDebuggerStatement();
      }
      case "return": {
        return this.ParseReturnStatement();
      }
      default: {
        throw new Error(`unknown statement val: ${val}`);
      }
    }
  }

  ParseExpression(): Expression {
    const val = this.lexer.CurrentToken?.Val;
    const type = this.lexer.CurrentToken?.Type;
    const nextToken = this.lexer.Peek();

    if ([tt.StringLiteral, tt.NumberLiteral, tt.BoolLiteral].includes(type!)) {
      return this.ParseLiteralExpression();
    }

    if (type === tt.ID && nextToken.Type === tt.Dot) {
      this.lexer.Save();
      const exp = this.ParseMemberExp();

      if (this.lexer.CurrentToken?.Type === tt.LeftParenthesis) {
        this.lexer.BackTracking();
        return this.ParseCallExp();
      }

      return exp;
    }

    if (type === tt.ID && nextToken.Type === tt.LeftParenthesis) {
      return this.ParseCallExp();
    }

    if (type === tt.ID && nextToken.Type === tt.WhiteSpace) {
      this.lexer.Save();
      this.lexer.SkipOf([tt.WhiteSpace]);

      if (this.lexer.CurrentToken?.Type === tt.Eq) {
        this.lexer.BackTracking();
        return this.ParseAssignExpression();
      }

      this.lexer.BackTracking();
    }

    if (type === tt.ID) {
      return this.ParseIdentifierExpression();
    }

    throw new Error(`unknown expression token: ${this.lexer.CurrentToken}`);
  }

  ParseValDeclareStatement(): VarDeclare {
    let kind: "mut" | "const" = "mut";
    let id: Identifier;
    let init: ASTNode;
    let line = 1,
      col = 0;

    while (this.lexer.CurrentToken?.Type !== tt.Semicolon) {
      if (
        this.lexer.CurrentToken?.Type === tt.Keywords &&
        ["const", "mut"].includes(this.lexer.CurrentToken.Val as string)
      ) {
        kind = this.lexer.CurrentToken?.Val as any;
        line = this.lexer.CurrentToken?.Line;
        col = this.lexer.CurrentToken?.Col;
      }

      if (this.lexer.CurrentToken?.Type === tt.Eq) {
        this.lexer.SkipOf([tt.WhiteSpace]);
        init = this.ParseExpression();
        break;
      }

      if (
        this.lexer.CurrentToken?.Type === tt.ID &&
        this.lexer.Peek().Type === tt.Colon
      ) {
        id = new Identifier(
          this.lexer.CurrentToken.Val as string,
          this.lexer.CurrentToken.Line,
          this.lexer.CurrentToken.Col,
          this.sourceFile
        );
      }

      this.lexer.GetToken();
    }

    return new VarDeclare(kind, id!, init!, line, col, this.sourceFile);
  }

  ParseIfStatement(): IfStatement {
    let test: Expression;
    let consequent: BlockStatement;
    let alternate: IfStatement | BlockStatement | undefined;

    //skip if
    this.lexer.Skip();
    this.lexer.SkipOf([tt.WhiteSpace]);

    if (this.lexer.CurrentToken?.Type !== tt.LeftParenthesis) {
      throw new UnexpectedTokenError(
        "(",
        this.lexer.CurrentToken?.Val as string
      );
    }
    // skip (
    this.lexer.Skip();

    test = this.ParseExpression();
    this.lexer.SkipTo([tt.LeftBracket]);
    consequent = this.ParseBlockStatement();
    this.lexer.SkipTo([tt.Keywords]);

    if (this.lexer.CurrentToken?.Val === "else") {
      this.lexer.Save();
      this.lexer.SkipOf([tt.WhiteSpace]);

      if (
        //@ts-ignore
        this.lexer.CurrentToken.Type === tt.Keywords &&
        //@ts-ignore
        this.lexer.CurrentToken.Val === "if"
      ) {
        alternate = this.ParseIfStatement();
        //@ts-ignore
      } else if (this.lexer.CurrentToken.Type === tt.LeftBracket) {
        alternate = this.ParseBlockStatement();
      } else {
        this.lexer.BackTracking();
        throw new Error(
          `expect If / BlockStatement after else, but got ${this.lexer.CurrentToken} `
        );
      }
    }

    return new IfStatement(
      test.Line,
      test.Col,
      this.sourceFile,
      test,
      consequent,
      alternate
    );
  }

  ParseWhileStatement(): WhileStatement {
    throw new Error();
  }

  ParseReturnStatement(): ReturnStatement {
    if (this.lexer.CurrentToken?.Val === "return") {
      this.lexer.Skip();
      this.lexer.SkipOf([tt.WhiteSpace]);
    }
    const arg = this.ParseExpression();

    return new ReturnStatement(
      arg,
      this.lexer.CurrentToken?.Line!,
      this.lexer.CurrentToken?.Col!,
      this.sourceFile
    );
  }

  ParseDebuggerStatement(): DebuggerNode {
    return new DebuggerNode(
      this.lexer.CurrentToken?.Val as string,
      this.lexer.CurrentToken?.Line!,
      this.lexer.CurrentToken?.Col!,
      this.sourceFile
    );
  }

  ParseLiteralExpression(): StringLiteral | NumberLiteral | BooleanLiteral {
    if (this.lexer.CurrentToken?.Type == tt.StringLiteral) {
      return new StringLiteral(
        this.lexer.CurrentToken.Val as string,
        this.lexer.CurrentToken.Line,
        this.lexer.CurrentToken.Col,
        this.sourceFile
      );
    }

    if (this.lexer.CurrentToken?.Type == tt.NumberLiteral) {
      return new NumberLiteral(
        this.lexer.CurrentToken.Val as string,
        this.lexer.CurrentToken.Line,
        this.lexer.CurrentToken.Col,
        this.sourceFile
      );
    }

    if (this.lexer.CurrentToken?.Type == tt.BoolLiteral) {
      return new BooleanLiteral(
        this.lexer.CurrentToken.Val as string,
        this.lexer.CurrentToken.Line,
        this.lexer.CurrentToken.Col,
        this.sourceFile
      );
    }

    throw new Error(`unknown literal ${this.lexer.CurrentToken}`);
  }

  ParseAssignExpression(): AssignExpression {
    const id = this.lexer.CurrentToken;
    this.lexer.SkipOf([tt.WhiteSpace, tt.Eq]);
    const init = this.ParseExpression();

    if (id?.Type === tt.ID && init instanceof Expression) {
      return new AssignExpression(
        new Identifier(id.Val as string, id.Line, id.Col, this.sourceFile),
        init,
        id.Line,
        id.Col,
        this.sourceFile
      );
    }

    throw new Error(`unexpected id or init node, id: ${id}, init: ${init}`);
  }

  ParseIdentifierExpression(): Identifier {
    return new Identifier(
      this.lexer.CurrentToken?.Val as string,
      this.lexer.CurrentToken?.Line ?? 0,
      this.lexer.CurrentToken?.Col ?? 0,
      this.sourceFile
    );
  }

  ParseCallExp(): CallExpression {
    const line = this.lexer.CurrentToken?.Line ?? 1;
    const col = this.lexer.CurrentToken?.Col ?? 0;
    let id: Identifier | MemberExpression;
    let args: Expression[] = [];

    while (this.lexer.CurrentToken?.Type !== tt.RightParenthesis) {
      if (
        this.lexer.CurrentToken?.Type === tt.ID &&
        this.lexer.Peek().Type === tt.LeftParenthesis
      ) {
        id = new Identifier(
          this.lexer.CurrentToken.Val as string,
          this.lexer.CurrentToken.Line,
          this.lexer.CurrentToken.Col,
          this.sourceFile
        );
      } else if (
        this.lexer.CurrentToken?.Type === tt.ID &&
        this.lexer.Peek().Type === tt.Dot
      ) {
        id = this.ParseMemberExp();
      } else if (
        [tt.ID, tt.StringLiteral, tt.NumberLiteral, tt.BoolLiteral].includes(
          this.lexer.CurrentToken?.Type!
        ) &&
        [tt.Comma, tt.RightParenthesis].includes(this.lexer.Peek().Type)
      ) {
        args.push(this.ParseExpression());
      }

      this.lexer.GetToken();
    }

    if (!id!) {
      throw new Error("unknown function name");
    }

    this.lexer.Skip();
    return new CallExpression(id, args, line, col, this.sourceFile);
  }

  ParseTypeAnnotation(): TypeAnotation {
    let token = this.lexer.CurrentToken;
    let typeAno = "unknownTypeAnotation";

    if (
      token?.Val === "string" ||
      token?.Val === "number" ||
      token?.Val === "boolean"
    ) {
      typeAno = token.Val;
    } else {
      throw new Error(`unexpect TypeAnotation ${token?.Val}`);
    }

    return new TypeAnotation(
      typeAno as any,
      token.Line,
      token.Col,
      this.sourceFile
    );
  }

  ParseMemberExp(): MemberExpression {
    const memberExps: (MemberExpression | Identifier)[] = [];

    while (this.lexer.CurrentToken?.Type === tt.ID) {
      const obj = memberExps.pop();

      if (obj) {
        memberExps.push(
          new MemberExpression(
            obj,
            new Identifier(
              this.lexer.CurrentToken.Val as string,
              this.lexer.CurrentToken.Line,
              this.lexer.CurrentToken.Col,
              this.sourceFile
            ),
            obj.Line,
            obj.Col,
            this.sourceFile
          )
        );
      } else {
        memberExps.push(
          new Identifier(
            this.lexer.CurrentToken.Val as string,
            this.lexer.CurrentToken.Line,
            this.lexer.CurrentToken.Col,
            this.sourceFile
          )
        );
      }

      if (this.lexer.Peek().Type === tt.Dot) {
        this.lexer.Skip();
      }

      this.lexer.GetToken();
    }

    return memberExps.pop() as MemberExpression;
  }

  ParseParams(): Identifier[] {
    const args: Identifier[] = [];

    while (this.lexer.CurrentToken?.Type !== tt.RightParenthesis) {
      if (this.lexer.CurrentToken?.Type === tt.ID) {
        args.push(
          new Identifier(
            this.lexer.CurrentToken.Val as string,
            this.lexer.CurrentToken.Line,
            this.lexer.CurrentToken.Col,
            this.sourceFile
          )
        );
      }

      this.lexer.GetToken();
    }

    return args;
  }
}
