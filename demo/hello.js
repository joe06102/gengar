function print(...args) {
  console.log(...args);
}
(function () {
  const text = "hello gengar!";
  let num = 123;
  num = 456 + 789 + num;
  print(num);
  debugger;
  let megaText = toUpperCase(text);
  print(text, "evolves to", megaText);
  if (isValid(num)) {
    print("if");
    if (isValid(num)) {
      print("if");
    } else if (text) {
      print("else if");
    } else {
      print("else");
    }
  }
  if (isValid(num)) {
    print("if");
  } else if (text) {
    print("else if");
  }
  if (isValid(num)) {
    print("if");
  } else if (text) {
    print("else if");
  } else {
    print("else");
  }
  let i = 10;
  while (i) {
    i -= 1;
    print(i);
  }
  return 0;
})();
function toUpperCase(input) {
  return input.toUpperCase();
}
function isValid(input) {
  return input;
}
//# sourceMappingURL=hello.js.map
