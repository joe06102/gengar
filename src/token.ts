export enum TokenTypes {
  Keywords,
  ID,
  StringLiteral,
  NumberLiteral,
  BoolLiteral,
  LeftParenthesis,
  RightParenthesis,
  LeftBracket,
  RightBracket,
  Colon,
  Semicolon,
  Comma,
  Dot,
  WhiteSpace,
  CRLF,
  TypeAsset,
  Eq,
  EOF,
}

export class Token {
  constructor(
    public Type: TokenTypes,
    public Val: string | number | boolean,
    public Line: number,
    public Col: number
  ) {}

  toString() {
    return JSON.stringify(this, null, 2);
  }
}

export const TokenMatcher = {
  Keywords: /^(if|while|return|debugger|const|mut)/,
  ID: /^(\w+)/,
  Return: /^(return)/,
  StringLiteral: /^("[^"]*")/,
  NumberLiteral: /^(\d+)$/,
  BoolLiteral: /^(true|false)/,
  LeftParenthesis: /^(\()/,
  RightParenthesis: /^(\))/,
  LeftBracket: /^(\{)/,
  RightBracket: /^(\})/,
  Colon: /^(\:)/,
  Semicolon: /^(\;)/,
  Comma: /^(,)/,
  Dot: /^(\.)/,
  WhiteSpace: /^(\s+)/,
  CRLF: /^(\r?\n+)/,
  Eq: /^(=)/,
  TypeAssert: /^(string|number|boolean)/,
};
