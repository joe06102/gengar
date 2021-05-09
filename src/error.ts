export class UnexpectedTokenError extends Error {
  constructor(expect: string, actual: string) {
    super(`expect token [${expect}], but got [${actual}]`);
  }
}
