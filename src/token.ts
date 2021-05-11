export enum TokenTypes {
  Keywords,
  Marks,
  ID,
  StringLiteral,
  NumberLiteral,
  BoolLiteral,
  LeftParenthesis,
  RightParenthesis,
  LeftBracket,
  RightBracket,
  Semicolon,
  Comma,
  Dot,
  WhiteSpace,
  CRLF,
  TypeAsset,
  AssignOperator,
  BinaryOperator,
  UnaryOperator,
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
  Keywords: /^(if|else|while|return|debugger|const|mut)/,
  Marks: /^(\?|\:|\.|,|;)/,
  ID: /^(\w+)/,
  Return: /^(return)/,
  StringLiteral: /^("[^"]*")/,
  NumberLiteral: /^(\d+)/,
  BoolLiteral: /^(true|false)/,
  LeftParenthesis: /^(\()/,
  RightParenthesis: /^(\))/,
  LeftBracket: /^(\{)/,
  RightBracket: /^(\})/,
  Semicolon: /^(\;)/,
  Comma: /^(,)/,
  Dot: /^(\.)/,
  WhiteSpace: /^(\s+)/,
  CRLF: /^(\r?\n+)/,
  AssignOperator: /^((?:\+|-|\*|\/)*=)/,
  UnaryOperator: /^(!+|~)/,
  BinaryOperator: /^(\+|-|\*|\/)/,
  TypeAssert: /^(:\s*(?:string|number|boolean))/,
};
