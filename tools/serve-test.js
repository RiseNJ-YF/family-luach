/* Local test server for the website copy in .test/ (git-ignored). Run: node tools/serve-test.js */
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','.test'),port=5392;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json'};
http.createServer((req,res)=>{
  const p=path.join(root,decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'')||'index.html');
  if(!p.startsWith(root)){res.writeHead(403);return res.end();}
  fs.readFile(p,(err,buf)=>{
    if(err){res.writeHead(404);return res.end('Not found');}
    res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(buf);
  });
}).listen(port,()=>console.log('Serving '+root+' at http://localhost:'+port));
