// Local test process only. Do not allow outbound connections.
const net=require("node:net");
const original=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){
 const first=Array.isArray(args[0])?args[0][0]:args[0];
 const host=typeof first==="object"?first.host:typeof args[1]==="string"?args[1]:undefined;
 const path=typeof first==="object"?first.path:typeof first==="string"?first:undefined;
 if(!path&&host&&!["127.0.0.1","::1","localhost"].includes(host))throw new Error("Lab test outbound connection blocked");
 return original.apply(this,args);
};
