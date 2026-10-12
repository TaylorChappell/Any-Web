'use strict';
const {app}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
async function run(directory){
 const {NsisUpdater}=require('electron-updater'),yaml=require('js-yaml'),semver=require('semver');
 const release=path.resolve(directory),manifest=yaml.load(fs.readFileSync(path.join(release,'latest.yml'),'utf8'));
 assert.equal(manifest.version,app.getVersion());assert.equal(manifest.path,`ANY-Setup-${app.getVersion()}.exe`);
 const config=yaml.load(fs.readFileSync(path.join(process.resourcesPath,'app-update.yml'),'utf8'));
 assert.equal(config.provider,'github');assert.equal(config.owner,'TaylorChappell');assert.equal(config.repo,'Any-Web');
 const installer=fs.readFileSync(path.join(release,manifest.path));
 assert.equal(crypto.createHash('sha512').update(installer).digest('base64'),manifest.sha512);
 let corrupt=false;
 const server=http.createServer((req,res)=>{if(req.url.startsWith('/latest.yml')){const m=structuredClone(manifest);if(corrupt){m.sha512=Buffer.alloc(64).toString('base64');m.files.forEach(f=>f.sha512=m.sha512);}res.writeHead(200,{'Content-Type':'text/yaml'});res.end(yaml.dump(m));return;}if(req.url.split('?')[0]==='/'+manifest.path){res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':installer.length});res.end(installer);return;}res.writeHead(404);res.end();});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const directoryTemp=fs.mkdtempSync(path.join(app.getPath('temp'),'any-update-test-')),caches=[];
 try{
  function updater(name){const u=new NsisUpdater({provider:'generic',url});const testConfig={...config,provider:'generic',url,updaterCacheDirName:'any-update-test-'+process.pid+'-'+name};delete testConfig.owner;delete testConfig.repo;const configPath=path.join(directoryTemp,name+'.yml');fs.writeFileSync(configPath,yaml.dump(testConfig));u.updateConfigPath=configPath;u.autoDownload=false;u.autoInstallOnAppQuit=false;u.disableDifferentialDownload=true;u.on('error',()=>{});caches.push(path.join(require('electron-updater/out/AppAdapter').getAppCacheDir(),testConfig.updaterCacheDirName));return u;}
  const u=updater('valid');u.currentVersion=new semver.SemVer('0.3.0');let available=false,downloaded=false;u.on('update-available',()=>available=true);u.on('update-downloaded',()=>downloaded=true);await u.checkForUpdates();assert.equal(available,true);const files=await u.downloadUpdate();assert.equal(downloaded,true);assert.equal(crypto.createHash('sha512').update(fs.readFileSync(files[0])).digest('base64'),manifest.sha512);
  u.currentVersion=new semver.SemVer(app.getVersion());let current=false;u.on('update-not-available',()=>current=true);await u.checkForUpdates();assert.equal(current,true);
  corrupt=true;const bad=updater('corrupt');bad.currentVersion=new semver.SemVer('0.3.0');await bad.checkForUpdates();await assert.rejects(bad.downloadUpdate(),/checksum|sha512/i);
  const report={passed:true,version:app.getVersion(),checks:['packaged GitHub update feed','new version detection','real NSIS installer download','SHA512 verification','current version detection','corrupt download rejected']};fs.writeFileSync(path.join(app.getPath('temp'),'ANY-update-test-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await new Promise(r=>server.close(r));fs.rmSync(directoryTemp,{recursive:true,force:true});for(const cache of caches)fs.rmSync(cache,{recursive:true,force:true});}
}
module.exports={run};
