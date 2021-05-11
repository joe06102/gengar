import { GengarLexer } from "./lexer";
import { Token, TokenTypes as tt } from "./token";
import {
  AssignExpression,
  ASTNode,
  BinaryExpression,
  BlockStatement,
  BooleanLiteral,
  CallExpression,
  ConditionalExpression,
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
  UnaryExpression,
  VarDeclare,
  WhileStatement,
} from "./ast";
import { UnexpectedTokenError } from "./error";

// Left Recursion Removal
// EXPRESSION       -> NONRECURSE BINARYEXP' | NONRECURSE TERNARYEXP'
// NONRECURSE       -> CALLEXP | MEMBEREXP | IDENTIFIER | LITERAL
// BINARYEXP'       -> operator EXPRESSION BINARYEXP' | ε
// TERNARYEXP'      -> ? EXPRESSION TERNARYEXP' : EXPRESSION TERNARYEXP'  | ε

/**
 * S                -> MAIN | FN
 * MAIN             -> main(): TYPEANNOTATION BLOCKSTATEMENT
 * FN               -> fn IDENTIFIER(PARAMS) BLOCKSTATEMENT
 * BLOCKSTATEMENT   -> { STATEMENT* | EXPRESSION* }
 * STATEMENT        -> VARDECLARE | IF | WHILE | RETURN | DEBUGGER
 * EXPRESSION       -> ASSIGNEXP | UNARYEXPRESSION | BINARYEXPRESSION | TERNARYEXPRESSION | CALLEXP | MEMBEREXP | IDENTIFIER | LITERAL
 * UNARYEXPRESSION  -> operator EXPRESSION
 * BINARYEXPRESSION -> EXPRESSION operator EXPRESSION (Left Recursion)
 * TERNARYEXPRESSION-> EXPRESSION ? EXPRESSION : EXPRESSION (Left Recursion)
 * VARDECLARE       -> kind IDENTIFIER : TYPEANNOTATION = EXPRESSION;
 * IF               -> if (EXPRESSION) BLOCKSTATEMENT else IF | BLOCKSTATEMENT
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
    let prevToken = this.lexer.CurrentToken;

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

      if (prevToken !== this.lexer.CurrentToken) {
        prevToken = this.lexer.CurrentToken;
        continue;
      }

      prevToken = this.lexer.GetToken();
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
    // skip }
    this.lexer.Skip();

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
    const nonRecursive = this.ParseNonRecursiveExpression();
    this.lexer.SkipOf([tt.WhiteSpace], true);

    if (this.lexer.CurrentToken?.Type === tt.BinaryOperator) {
      const binary = this.ParseBinaryExpression();

      if (binary) {
        binary.Left = nonRecursive;
        binary.Col = nonRecursive.Col;
        return binary;
      }
    }

    if (
      this.lexer.CurrentToken?.Type === tt.Marks &&
      this.lexer.CurrentToken.Val === "?"
    ) {
      const conditional = this.ParseConditionalExpression();

      if (conditional) {
        conditional.Test = nonRecursive;
        return conditional;
      }
    }

    return nonRecursive;
  }

  ParseNonRecursiveExpression(): Expression {
    const val = this.lexer.CurrentToken?.Val;
    const type = this.lexer.CurrentToken?.Type;
    const nextToken = this.lexer.Peek();

    if ([tt.StringLiteral, tt.NumberLiteral, tt.BoolLiteral].includes(type!)) {
      return this.ParseLiteralExpression();
    }

    if (type == tt.UnaryOperator) {
      return this.ParseUnaryExpression();
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

      if (this.lexer.CurrentToken?.Type === tt.AssignOperator) {
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

  ParseBinaryExpression(): BinaryExpression | null {
    const operator = this.lexer.CurrentToken;

    if (operator?.Type !== tt.BinaryOperator) {
      return null;
    }

    this.lexer.SkipOf([tt.WhiteSpace]);
    const right = this.ParseExpression();
    const nestBinaryExpression = this.ParseBinaryExpression();

    if (nestBinaryExpression) {
      return new BinaryExpression(
        nestBinaryExpression,
        right,
        operator.Val as string,
        nestBinaryExpression.Line,
        nestBinaryExpression.Col,
        this.sourceFile
      );
    }

    return new BinaryExpression(
      null,
      right,
      operator.Val as string,
      right.Line,
      right.Col,
      this.sourceFile
    );
  }

  ParseUnaryExpression(): UnaryExpression {
    const operator = this.lexer.CurrentToken;
    this.lexer.Skip();
    const exp = this.ParseExpression();

    return new UnaryExpression(
      exp,
      operator?.Val as string,
      operator?.Line ?? 0,
      exp.Col,
      this.sourceFile
    );
  }

  ParseConditionalExpression(): ConditionalExpression | null {
    if (this.lexer.CurrentToken?.Val !== "?") {
      return null;
    }

    this.lexer.SkipOf([tt.WhiteSpace]);

    let consequent = this.ParseExpression();
    const nestConsequent = this.ParseConditionalExpression();

    if (this.lexer.CurrentToken.Type === tt.WhiteSpace) {
      this.lexer.SkipOf([tt.WhiteSpace], true);
    }

    if (
      this.lexer.CurrentToken?.Type !== tt.Marks ||
      //@ts-ignore
      this.lexer.CurrentToken?.Val !== ":"
    ) {
      throw new UnexpectedTokenError(
        ":",
        this.lexer.CurrentToken?.Val as string
      );
    }
    this.lexer.SkipOf([tt.WhiteSpace, tt.Marks]);
    let alternate = this.ParseExpression();
    const nestAlternate = this.ParseConditionalExpression();

    if (nestConsequent) {
      nestConsequent.Test = consequent;
      consequent = nestConsequent;
    }

    if (nestAlternate) {
      nestAlternate.Test = alternate;
      alternate = nestAlternate;
    }

    return new ConditionalExpression(
      consequent.Line,
      consequent.Col,
      this.sourceFile,
      null,
      consequent,
      alternate
    );
  }

  ParseValDeclareStatement(): VarDeclare {
    let kind: string;
    let id: Identifier;
    let init: ASTNode;
    let line = 1;
    let col = 0;

    kind = this.lexer.CurrentToken?.Val! as string;
    this.lexer.SkipOf([tt.WhiteSpace]);

    if (this.lexer.CurrentToken?.Type !== tt.ID) {
      throw new UnexpectedTokenError(
        "identifier",
        this.lexer.CurrentToken?.Val as string
      );
    }

    id = new Identifier(
      this.lexer.CurrentToken.Val as string,
      this.lexer.CurrentToken.Line,
      this.lexer.CurrentToken.Col,
      this.sourceFile
    );
    // TODO: Missing TypeAnnotation
    this.lexer.SkipTo([tt.AssignOperator]);
    this.lexer.SkipOf([tt.WhiteSpace]);
    init = this.ParseExpression();

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
    let test: Expression;
    let body: BlockStatement;
    this.lexer.SkipTo([tt.LeftParenthesis]);
    this.lexer.Skip();
    test = this.ParseExpression();
    this.lexer.SkipTo([tt.LeftBracket]);
    body = this.ParseBlockStatement();

    return new WhileStatement(test.Line, test.Col, this.sourceFile, test, body);
  }

  ParseReturnStatement(): ReturnStatement {
    this.lexer.SkipOf([tt.WhiteSpace]);
    debugger;
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
    const token = this.lexer.CurrentToken;
    this.lexer.Skip();
    if (token?.Type == tt.StringLiteral) {
      return new StringLiteral(
        token.Val as string,
        token.Line,
        token.Col,
        this.sourceFile
      );
    }

    if (token?.Type == tt.NumberLiteral) {
      return new NumberLiteral(
        token.Val as string,
        token.Line,
        token.Col,
        this.sourceFile
      );
    }

    if (token?.Type == tt.BoolLiteral) {
      return new BooleanLiteral(
        token.Val as string,
        token.Line,
        token.Col,
        this.sourceFile
      );
    }

    throw new Error(`unknown literal ${this.lexer.CurrentToken}`);
  }

  ParseAssignExpression(): AssignExpression {
    const id = this.lexer.CurrentToken;
    this.lexer.SkipOf([tt.WhiteSpace]);
    const operator = this.lexer.CurrentToken;
    this.lexer.SkipOf([tt.AssignOperator, tt.WhiteSpace], true);
    const init = this.ParseExpression();

    if (operator?.Type !== tt.AssignOperator) {
      throw new UnexpectedTokenError(
        "assign operator",
        operator?.Val as string
      );
    }

    if (id?.Type === tt.ID && init instanceof Expression) {
      return new AssignExpression(
        new Identifier(id.Val as string, id.Line, id.Col, this.sourceFile),
        init,
        operator.Val as string,
        id.Line,
        id.Col,
        this.sourceFile
      );
    }

    throw new Error(`unexpected id or init node, id: ${id}, init: ${init}`);
  }

  ParseIdentifierExpression(): Identifier {
    const token = this.lexer.CurrentToken;
    this.lexer.Skip();
    return new Identifier(
      token?.Val as string,
      token?.Line ?? 0,
      token?.Col ?? 0,
      this.sourceFile
    );
  }

  ParseCallExp(): CallExpression {
    const line = this.lexer.CurrentToken?.Line ?? 1;
    const col = this.lexer.CurrentToken?.Col ?? 0;
    let id: Identifier | MemberExpression;
    let args: Expression[] = [];
    let prevToken = this.lexer.CurrentToken;

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

      if (prevToken !== this.lexer.CurrentToken) {
        prevToken = this.lexer.CurrentToken;
        continue;
      }

      prevToken = this.lexer.GetToken();
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
