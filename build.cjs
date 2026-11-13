const fs=require('fs'),path=require('path');const root=__dirname
if(!fs.existsSync(path.join(root,'dist')))fs.cpSync(path.join(root,'docs'),path.join(root,'dist'),{recursive:true})
const ids=['physics','rules','audio','levels','challenge','render','controller'];let out="(()=>{\n'use strict';\nconst factories={},cache={};\n"
for(const id of ids){let src=fs.readFileSync(path.join(root,'src',id+'.js'),'utf8').replace(/require\('\.\.\/\.\.\/(physics|rules|audio|challenge)'\)/g,"require('$1')").replace(/require\('\.\/(render|levels)'\)/g,"require('$1')");out+=`factories['${id}']=function(module,exports,require){\n${src}\n};\n`}
out+="function require(id){if(!cache[id]){const m={exports:{}};cache[id]=m;factories[id](m,m.exports,require)}return cache[id].exports}\n"
out+=fs.readFileSync(path.join(root,'src/browser.js'),'utf8')+'\n})();\n';fs.writeFileSync(path.join(root,'dist/game.js'),out)
console.log('Built self-contained browser game: '+Buffer.byteLength(out)+' bytes')
