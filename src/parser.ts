import { GengarLexer } from "./lexer";
import { Token, TokenTypes as tt } from "./token";
import {
  ASTNode,
  BooleanLiteral,
  CallExpression,
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
 * BODY             -> VARDECLARE | CALLEXP | RETURN
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
  constructor(private lexer: GengarLexer) {}

  Parse(): Program {
    const body: ASTNode[] = [];
    let token = this.lexer.GetToken();

    while (token.Type !== tt.EOF) {
      if (token.Type === tt.ID && token.Val === "main") {
        body.push(this.ParseMain());
      }

      if (token.Type === tt.ID && token.Val === "fn") {
        body.push(this.ParseFn());
      }

      token = this.lexer.GetToken();
    }

    return new Program(body, 0, 0);
  }

  ParseMain(): MainDeclare {
    let body: ASTNode[];
    this.lexer.SkipTo([tt.LeftBracket]);
    body = this.ParseBody();

    return new MainDeclare(body, 0, 0);
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
      id = new Identifier(idToken.Val as string, idToken.Line, idToken.Col);
    }

    if (id == null) {
      throw new Error(`unexpected fn identitifer`);
    }

    return new FunctionDeclare(id, params, body, 0, 0);
  }

  ParseBody(): ASTNode[] {
    const body: ASTNode[] = [];
    let token = this.lexer.CurrentToken;

    while (token?.Type !== tt.RightBracket) {
      if (token?.Type === tt.Var) {
        body.push(this.ParseValDeclare());
      }

      if (
        token?.Type === tt.ID &&
        this.lexer.Peek().Type === tt.LeftParenthesis
      ) {
        body.push(this.ParseCallExp());
      }

      if (token?.Type === tt.Return) {
        body.push(this.ParseReturn());
      }

      token = this.lexer.GetToken();
    }
    return body;
  }

  ParseValDeclare(): VarDeclare {
    let token = this.lexer.CurrentToken;
    let kind: "mut" | "const" = "mut";
    let id: Identifier;
    let init: ASTNode;
    let line = 0,
      col = 0;

    while (token?.Type !== tt.Semicolon) {
      if (token?.Type === tt.Var) {
        kind = token.Val as any;
        line = token.Line;
        col = token.Col;
      }

      if (token?.Type === tt.Eq) {
        this.lexer.SkipOf([tt.WhiteSpace]);
        init = this.ParseInit();
        break;
      }

      if (token?.Type === tt.ID && this.lexer.Peek().Type === tt.Colon) {
        id = new Identifier(token.Val as string, token.Line, token.Col);
      }

      token = this.lexer.GetToken();
    }

    return new VarDeclare(kind, id!, init!, line, col);
  }

  ParseInit(): ASTNode {
    let token = this.lexer.CurrentToken;

    while (token?.Type !== tt.Semicolon) {
      //LL(1) for tellling variable name from function name
      if (
        token?.Type === tt.ID &&
        this.lexer.Peek().Type === tt.LeftParenthesis
      ) {
        return this.ParseCallExp();
      } else if (token?.Type === tt.ID && this.lexer.Peek().Type === tt.Dot) {
        this.lexer.Save();
        const initExp = this.ParseMemberExp();
        //@ts-ignore TSFIXME
        if (this.lexer.CurrentToken.Type === tt.LeftParenthesis) {
          this.lexer.BackTracking();
          return this.ParseCallExp();
        }

        return initExp;
      } else if (token?.Type === tt.ID) {
        return new Identifier(token.Val as string, token.Line, token.Col);
      }

      if (token?.Type == tt.StringLiteral) {
        return new StringLiteral(token.Val as string, token.Line, token.Col);
      }

      if (token?.Type == tt.NumberLiteral) {
        return new NumberLiteral(token.Val as string, token.Line, token.Col);
      }

      if (token?.Type == tt.BoolLiteral) {
        return new BooleanLiteral(token.Val as string, token.Line, token.Col);
      }

      token = this.lexer.GetToken();
    }

    throw new Error(`parseInit failed, unexpected token ${token}`);
  }

  ParseCallExp(): CallExpression {
    let token = this.lexer.CurrentToken;
    const line = token?.Line ?? 0;
    const col = token?.Col ?? 0;
    let id: Identifier | MemberExpression;
    let args: Identifier[] = [];

    while (token?.Type !== tt.Semicolon) {
      if (
        token?.Type === tt.ID &&
        this.lexer.Peek().Type === tt.LeftParenthesis
      ) {
        id = new Identifier(token.Val as string, token.Line, token.Col);
      } else if (token?.Type === tt.ID && this.lexer.Peek().Type === tt.Dot) {
        id = this.ParseMemberExp();
      } else if (token?.Type === tt.LeftParenthesis) {
        this.lexer.Skip();
        args = this.ParseArgs();
      }

      token = this.lexer.GetToken();
    }

    if (!id!) {
      throw new Error("unknown function name");
    }

    this.lexer.Skip();
    return new CallExpression(id, args, line, col);
  }

  ParseReturn(): ReturnStatement {
    const token = this.lexer.CurrentToken;
    const arg = this.ParseInit();

    return new ReturnStatement(arg, token?.Line ?? 0, token?.Col ?? 0);
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

    return new TypeAnotation(typeAno as any, token.Line, token.Col);
  }

  ParseMemberExp(): MemberExpression {
    const memberExps: (MemberExpression | Identifier)[] = [];
    let token = this.lexer.CurrentToken;

    while (token?.Type === tt.ID) {
      const obj = memberExps.pop();

      if (obj) {
        memberExps.push(
          new MemberExpression(
            obj,
            new Identifier(token.Val as string, token.Line, token.Col),
            obj.Line,
            obj.Col
          )
        );
      } else {
        memberExps.push(
          new Identifier(token.Val as string, token.Line, token.Col)
        );
      }

      if (this.lexer.Peek().Type === tt.Dot) {
        this.lexer.Skip();
      }

      token = this.lexer.GetToken();
    }

    return memberExps.pop() as MemberExpression;
  }

  ParseArgs(): Identifier[] {
    const args: Identifier[] = [];
    let token = this.lexer.CurrentToken;

    while (token?.Type !== tt.RightParenthesis) {
      if (token?.Type === tt.ID) {
        args.push(new Identifier(token.Val as string, token.Line, token.Col));
      }

      token = this.lexer.GetToken();
    }

    return args;
  }

  ParseParams(): Identifier[] {
    const args: Identifier[] = [];
    let token = this.lexer.CurrentToken;

    while (token?.Type !== tt.RightParenthesis) {
      if (token?.Type === tt.ID) {
        args.push(new Identifier(token.Val as string, token.Line, token.Col));
      }

      token = this.lexer.GetToken();
    }

    return args;
  }
}
