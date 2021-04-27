export enum TokenTypes {
  Var,
  ID,
  Return,
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
}

export const TokenMatcher = {
  Var: /^(mut|const)/,
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
