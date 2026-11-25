// Preloaded only in the isolated Next test process and inherited by child processes.
const net=require("node:net");
const original=net.Socket.prototype.connect;
const loopback=new Set(["127.0.0.1","::1","localhost","::ffff:127.0.0.1"]);
net.Socket.prototype.connect=function(...args){
 const a=Array.isArray(args[0])?args[0]:args;
 const first=a[0];
 if(typeof first==="string"||(first&&typeof first==="object"&&first.path)) throw new Error("Lab test Unix socket blocked");
 const host=first&&typeof first==="object"?(first.host??"localhost"):(typeof a[1]==="string"?a[1]:"localhost");
 if(!loopback.has(host)) throw new Error("Lab test outbound connection blocked");
 return original.apply(this,args);
};
