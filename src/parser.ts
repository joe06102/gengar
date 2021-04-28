import { GengarLexer } from "./lexer";
import { Token, TokenTypes as tt } from "./token";
import {
  ASTNode,
  BooleanLiteral,
  CallExpression,
  DebuggerNode,
  FunctionDeclare,
  Identifier,
  MainDeclare,
  MemberExpression,
  NumberLiteral,
  Program,
  ReturnStatement,
  StringLiteral,
  TypeAnotation,
  VarDeclare,
} from "./ast";
/**
 * S                -> MAIN | FN
 * MAIN             -> main(): TYPEANNOTATION { BODY }
 * FN               -> fn IDENTIFIER(PARMS) { BODY }
 * BODY             -> VARDECLARE | CALLEXP | RETURN | DEBUGGER
 * VARDECLARE       -> VARKIND IDENTIFIER : TYPEANNOTATION = INIT;
 * VARKIND          -> const | mut
 * INIT             -> LITERAL | CALLEXP | IDENTIFIER | MEMBEREXP;
 * CALLEXP          -> IDENTIFIER(ARGS) | MEMBEREXP(ARGS);
 * MEMBEREXP        -> IDENTIFIER.IDENTIFIER | . MEMBEREXP
 * ARGS             -> IDENTIFIER | , ARGS
 * RETURN           -> INIT
 * LITERAL          -> /("[^"]")/ |  /^(\d+)$/ | /(true|false)/
 * IDENTIFIER       -> /(\w+)/
 * TYPEANNOTATION   -> string | number | boolean
 * PARAMS           -> IDENTIFIER : TYPEANNOTATION | , PARAMS
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
    let body: ASTNode[];
    const startToken = this.lexer.CurrentToken;
    this.lexer.SkipTo([tt.LeftBracket]);
    body = this.ParseBody();

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
    let body: ASTNode[] = [];
    const token = this.lexer.CurrentToken;

    const skippedIdTokens = this.lexer.SkipTo([tt.LeftParenthesis]);
    params = this.ParseParams();
    this.lexer.SkipTo([tt.LeftBracket]);
    body = this.ParseBody();
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

  ParseBody(): ASTNode[] {
    const body: ASTNode[] = [];

    while (this.lexer.CurrentToken?.Type !== tt.RightBracket) {
      if (this.lexer.CurrentToken?.Type === tt.DEBUGGER) {
        body.push(this.ParseDebugger());
      }

      if (this.lexer.CurrentToken?.Type === tt.Var) {
        body.push(this.ParseValDeclare());
      }

      if (
        this.lexer.CurrentToken?.Type === tt.ID &&
        this.lexer.Peek().Type === tt.LeftParenthesis
      ) {
        body.push(this.ParseCallExp());
      }

      if (this.lexer.CurrentToken?.Type === tt.Return) {
        body.push(this.ParseReturn());
      }

      this.lexer.GetToken();
    }
    return body;
  }

  ParseDebugger(): DebuggerNode {
    return new DebuggerNode(
      this.lexer.CurrentToken?.Val as string,
      this.lexer.CurrentToken?.Line!,
      this.lexer.CurrentToken?.Col!,
      this.sourceFile
    );
  }

  ParseValDeclare(): VarDeclare {
    let kind: "mut" | "const" = "mut";
    let id: Identifier;
    let init: ASTNode;
    let line = 1,
      col = 0;

    while (this.lexer.CurrentToken?.Type !== tt.Semicolon) {
      if (this.lexer.CurrentToken?.Type === tt.Var) {
        kind = this.lexer.CurrentToken?.Val as any;
        line = this.lexer.CurrentToken?.Line;
        col = this.lexer.CurrentToken?.Col;
      }

      if (this.lexer.CurrentToken?.Type === tt.Eq) {
        this.lexer.SkipOf([tt.WhiteSpace]);
        init = this.ParseInit();
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

  ParseInit(): ASTNode {
    while (this.lexer.CurrentToken?.Type !== tt.Semicolon) {
      //LL(1) for tellling variable name from function name
      if (
        this.lexer.CurrentToken?.Type === tt.ID &&
        this.lexer.Peek().Type === tt.LeftParenthesis
      ) {
        return this.ParseCallExp();
      } else if (
        this.lexer.CurrentToken?.Type === tt.ID &&
        this.lexer.Peek().Type === tt.Dot
      ) {
        this.lexer.Save();
        const initExp = this.ParseMemberExp();
        //@ts-ignore TSFIXME
        if (this.lexer.CurrentToken.Type === tt.LeftParenthesis) {
          this.lexer.BackTracking();
          return this.ParseCallExp();
        }

        return initExp;
      } else if (this.lexer.CurrentToken?.Type === tt.ID) {
        return new Identifier(
          this.lexer.CurrentToken.Val as string,
          this.lexer.CurrentToken.Line,
          this.lexer.CurrentToken?.Col,
          this.sourceFile
        );
      }

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

      this.lexer.GetToken();
    }

    throw new Error(
      `parseInit failed, unexpected token ${this.lexer.CurrentToken}`
    );
  }

  ParseCallExp(): CallExpression {
    const line = this.lexer.CurrentToken?.Line ?? 1;
    const col = this.lexer.CurrentToken?.Col ?? 0;
    let id: Identifier | MemberExpression;
    let args: Identifier[] = [];

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
      } else if (this.lexer.CurrentToken?.Type === tt.LeftParenthesis) {
        this.lexer.Skip();
        args = this.ParseArgs();
        //@ts-ignore TSFIXME
        if (this.lexer.CurrentToken.Type === tt.RightParenthesis) {
          continue;
        }
      }

      this.lexer.GetToken();
    }

    if (!id!) {
      throw new Error("unknown function name");
    }

    this.lexer.Skip();
    return new CallExpression(id, args, line, col, this.sourceFile);
  }

  ParseReturn(): ReturnStatement {
    const arg = this.ParseInit();

    return new ReturnStatement(
      arg,
      this.lexer.CurrentToken?.Line!,
      this.lexer.CurrentToken?.Col!,
      this.sourceFile
    );
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

  ParseArgs(): Identifier[] {
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
