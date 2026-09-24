/* Local stand-in for Vercel, for testing: serves index.html, runs the /api functions, and fakes the
   Redis database in memory (lost when the server stops). Run: node tools/dev-server.js  → http://localhost:5393 */
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),port=5393;
const mem=new Map(),expiry=new Map();
function kv(args){
  const [c,k,v,opt]=args,now=Date.now();
  if(expiry.has(k)&&expiry.get(k)<now){mem.delete(k);expiry.delete(k);}
  switch(String(c).toUpperCase()){
    case 'GET':return mem.has(k)?mem.get(k):null;
    case 'SET':if(opt==='NX'&&mem.has(k)) return null;mem.set(k,v);return 'OK';
    case 'DEL':return mem.delete(k)?1:0;
    case 'INCR':{const n=Number(mem.get(k)||0)+1;mem.set(k,String(n));return n;}
    case 'EXPIRE':expiry.set(k,now+Number(v)*1000);return 1;
    default:throw new Error('unsupported '+c);
  }
}
process.env.KV_REST_API_URL='http://localhost:'+port+'/__kv';
process.env.KV_REST_API_TOKEN='dev';
http.createServer((req,res)=>{
  const url=req.url.split('?')[0];
  let raw='';req.on('data',d=>raw+=d);req.on('end',()=>{
    if(url==='/__kv'){res.setHeader('Content-Type','application/json');try{res.end(JSON.stringify({result:kv(JSON.parse(raw))}));}catch(e){res.end(JSON.stringify({error:e.message}));}return;}
    const m=/^\/api\/([a-z]+)$/.exec(url);
    if(m&&fs.existsSync(path.join(root,'api',m[1]+'.js'))){
      try{req.body=raw?JSON.parse(raw):undefined;}catch(e){req.body=raw;}
      return require(path.join(root,'api',m[1]+'.js'))(req,res);
    }
    const file=url==='/'?'index.html':url.replace(/^\/+/,'');
    const p=path.join(root,file);
    if(!p.startsWith(root)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){res.statusCode=404;return res.end('Not found');}
    res.setHeader('Content-Type',/\.html$/.test(p)?'text/html; charset=utf-8':/\.js$/.test(p)?'text/javascript':'application/octet-stream');
    res.end(fs.readFileSync(p));
  });
}).listen(port,()=>console.log('Family Luach dev server: http://localhost:'+port));
