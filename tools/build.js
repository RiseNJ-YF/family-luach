/* Builds the website from src/app.html.
   - index.html: a complete page for GitHub Pages, carrying only the fictional example family.
     Real family data never goes into the repository unencrypted; it lives in family.enc.json,
     which the page itself writes (encrypted) when the owner presses Save.
   Run: node tools/build.js */
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'src','app.html'),'utf8');
const example=JSON.parse(fs.readFileSync(path.join(__dirname,'example.json'),'utf8'));

const DATA_RE=/(<script type="application\/json" id="family-data">)([\s\S]*?)(<\/script>)/;
if(!DATA_RE.test(src)) throw new Error('family-data block not found in src/app.html');
const body=src.replace(DATA_RE,(m,a,b,c)=>a+JSON.stringify(example).replace(/</g,'\\u003c')+c);

// everything before the app container belongs in <head>
const cut=body.indexOf('<div id="app">');
const head=body.slice(0,cut).trim(),rest=body.slice(cut).trim();
const html='<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="robots" content="noindex, nofollow">\n'+head+'\n</head>\n<body>\n'+rest+'\n</body>\n</html>\n';
fs.writeFileSync(path.join(root,'index.html'),html);
fs.writeFileSync(path.join(root,'.nojekyll'),'');

// safety check: the built page must hold only the example family
const built=JSON.parse(html.match(DATA_RE)[2]);
if(!built.meta.example) throw new Error('index.html is not carrying the example data');
console.log('index.html written:',Math.round(html.length/1024)+' KB,',built.people.length,'example people');
