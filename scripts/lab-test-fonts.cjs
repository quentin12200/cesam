// Next's font loader test hook: avoid a remote Google Fonts request.
module.exports=new Proxy({}, {get:(_,key)=>typeof key==="string"?"@font-face { font-family: 'Geist'; font-style: normal; font-weight: 100 900; src: local('Arial'); }":undefined});
