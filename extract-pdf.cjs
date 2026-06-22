const { PDFParse } = require('./node_modules/pdf-parse/dist/pdf-parse/cjs/index.cjs');
const fs = require('fs');
const buf = fs.readFileSync('C:/Users/pc/Downloads/Sama1090 (2).pdf');
const parser = new PDFParse();
parser.parse(buf).then(data => {
  if (data.text) { process.stdout.write(data.text); }
  else if (data.pages) {
    data.pages.forEach(p => { if (p.text) process.stdout.write(p.text + '\n'); });
  } else {
    console.log(JSON.stringify(Object.keys(data)));
  }
}).catch(err => console.error('ERROR:', err.message, err.stack));
