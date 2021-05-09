function print(...args) {
  console.log(...args);
}
(function () {
  const text = "hello gengar!";
  ("hello gengar!");
  let num = 123;
  123;
  num = 456;
  456;
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
})();
function toUpperCase(input) {
  return input.toUpperCase();
}
function isValid(input) {
  return input;
  input;
}
//# sourceMappingURL=hello.js.map
