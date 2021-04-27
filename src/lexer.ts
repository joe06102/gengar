import { Token, TokenTypes as tt, TokenMatcher } from "./token";

export class GengarLexer {
  private line = 0;
  private col = 0;
  private pos = 0;
  private originSource = "";
  private savePoint = {
    source: "",
    line: 0,
    col: 0,
    pos: 0,
    token: undefined,
  } as any;

  constructor(private source: string) {
    this.originSource = source;
  }

  CurrentToken: Token | undefined;

  GetToken(): Token {
    let match: string | undefined;
    let t: Token;

    if (this.source.length === 0) {
      t = new Token(tt.EOF, "", 0, 0);
      this.CurrentToken = t;
      return t;
    }

    if ((match = this.source.match(TokenMatcher.LeftParenthesis)?.[1])) {
      t = new Token(tt.LeftParenthesis, match!, this.line, this.col);
    } else if (
      (match = this.source.match(TokenMatcher.RightParenthesis)?.[1])
    ) {
      t = new Token(tt.RightParenthesis, match!, this.line, this.col);
    } else if ((match = this.source.match(TokenMatcher.LeftBracket)?.[1])) {
      t = new Token(tt.LeftBracket, match!, this.line, this.col);
    } else if ((match = this.source.match(TokenMatcher.RightBracket)?.[1])) {
      t = new Token(tt.RightBracket, match!, this.line, this.col);
    } else if ((match = this.source.match(TokenMatcher.CRLF)?.[1])) {
      t = new Token(tt.CRLF, match!, this.line, this.col);
    } else if ((match = this.source.match(TokenMatcher.Var)?.[1])) {
      t = new Token(tt.Var, match!, this.line, this.col);
    } else if ((match = this.source.match(TokenMatcher.WhiteSpace)?.[1])) {
      t = new Token(tt.WhiteSpace, match!, this.line, this.col);
    } else if ((match = this.source.match(TokenMatcher.Colon)?.[1])) {
      t = new Token(tt.Colon, match!, this.line, this.col);
    } else if ((match = this.source.match(TokenMatcher.TypeAssert)?.[1])) {
      t = new Token(tt.TypeAsset, match!, this.line, this.col);
    } else if ((match = this.source.match(TokenMatcher.Eq)?.[1])) {
      t = new Token(tt.Eq, match!, this.line, this.col);
    } else if ((match = this.source.match(TokenMatcher.StringLiteral)?.[1])) {
      t = new Token(tt.StringLiteral, match!, this.line, this.col);
    } else if ((match = this.source.match(TokenMatcher.NumberLiteral)?.[1])) {
      t = new Token(tt.NumberLiteral, match!, this.line, this.col);
    } else if ((match = this.source.match(TokenMatcher.BoolLiteral)?.[1])) {
      t = new Token(tt.BoolLiteral, match!, this.line, this.col);
    } else if ((match = this.source.match(TokenMatcher.Semicolon)?.[1])) {
      t = new Token(tt.Semicolon, match!, this.line, this.col);
    } else if ((match = this.source.match(TokenMatcher.Comma)?.[1])) {
      t = new Token(tt.Comma, match!, this.line, this.col);
    } else if ((match = this.source.match(TokenMatcher.Return)?.[1])) {
      t = new Token(tt.Return, match!, this.line, this.col);
    } else if ((match = this.source.match(TokenMatcher.Dot)?.[1])) {
      t = new Token(tt.Dot, match!, this.line, this.col);
    } else if ((match = this.source.match(TokenMatcher.ID)?.[1])) {
      t = new Token(tt.ID, match!, this.line, this.col);
    } else {
      throw new Error(
        `unknow token: ${match}, position: ${this.pos}, line: ${this.line}, col: ${this.col}\nsource: ${this.source}`
      );
    }
    // console.log(
    //   "token:",
    //   match.replace("\n", "\\n").replace(/\s/, "whitespace"),
    //   "\n"
    // );
    this.CurrentToken = t;
    this.pos += match?.length ?? 0;
    this.col += match?.length ?? 0;
    this.source = this.source.substring(match?.length ?? 0);

    if (t?.Type === tt.CRLF) {
      this.line++;
      this.col = 0;
    }

    return t;
  }

  Peek() {
    const token = this.CurrentToken;
    const pos = this.pos;
    const line = this.line;
    const source = this.source;
    const col = this.col;

    const t = this.GetToken();
    this.pos = pos;
    this.line = line;
    this.col = col;
    this.source = source;
    this.CurrentToken = token;
    return t;
  }

  Expect(tokenType: tt, move = false) {
    return move
      ? this.GetToken()?.Type === tokenType
      : this.Peek()?.Type === tokenType;
  }

  Skip(offset = 1) {
    let remain = offset;
    while (remain--) {
      this.GetToken();
    }
  }

  SkipOf(tokenTypes: tt[]): Token[] {
    let skippedTokens: Token[] = [];
    let curToken = this.GetToken();

    while (tokenTypes.includes(curToken.Type)) {
      skippedTokens.push(curToken);
      curToken = this.GetToken();
    }

    return skippedTokens;
  }

  SkipTo(tokenTypes: tt[]): Token[] {
    let skippedTokens: Token[] = [];
    let curToken = this.GetToken();

    while (!tokenTypes.includes(curToken.Type)) {
      skippedTokens.push(curToken);
      curToken = this.GetToken();
    }

    return skippedTokens;
  }

  Save() {
    this.savePoint = {
      pos: this.pos,
      line: this.line,
      col: this.col,
      source: this.source,
      token: this.CurrentToken,
    };
  }

  BackTracking() {
    this.line = this.savePoint.line;
    this.col = this.savePoint.col;
    this.pos = this.savePoint.pos;
    this.source = this.savePoint.source;
    this.CurrentToken = this.savePoint.token;
  }
}
