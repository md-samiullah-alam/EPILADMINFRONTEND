// Temporary validation helper: Babel se JSX files parse karke syntax check karta hai.
const babel = require("@babel/core");
const fs = require("fs");
const files = process.argv.slice(2);
let bad = 0;
for (const f of files) {
  try {
    babel.transformFileSync(f, {
      presets: [require.resolve("babel-preset-react-app")],
      babelrc: false,
      configFile: false,
    });
    console.log("OK  " + f);
  } catch (e) {
    bad++;
    console.log("ERR " + f + " :: " + e.message.split("\n").slice(0, 4).join(" | "));
  }
}
console.log("RESULT " + (bad === 0 ? "ALL_OK" : "FAILED"));
process.exit(bad === 0 ? 0 : 1);
