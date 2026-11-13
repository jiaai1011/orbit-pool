const fs=require('fs'),path=require('path')
const roots=process.argv.slice(2)
if(!roots.length)throw Error('Provide the mini-program project paths as arguments')
for(const root of roots){
 for(const name of ['physics','challenge','levels'])fs.copyFileSync(path.join(__dirname,'../src',name+'.js'),path.join(root,name+'.js'))
 for(const [src,dst] of [['controller','index'],['render','render']])fs.copyFileSync(path.join(__dirname,'../src',src+'.js'),path.join(root,'pages/table',dst+'.js'))
}
