

'use strict';

// stack
function L(s){console.log('---> %j',s)}

const Hapi    =require('hapi');
const Good    =require('good');
const Path    =require('path');
const Inert   =require('inert');
const Redis   =require('redis');
const Fs      =require('fs');
const CryptoJS=require('crypto-js');
const Bcrypt  =require('bcryptjs');
const Salt    =Bcrypt.genSaltSync(0);


/*
 * SERVER
 */
const server=new Hapi.Server({
  connections:{
    routes:{
      files:{
        relativeTo:Path.join(__dirname,'static')
      }
    }
  }
});
const server_port=process.env.OPENSHIFT_NODEJS_PORT || 90
const server_host=process.env.OPENSHIFT_NODEJS_IP || 'smart'
  server.connection({
    host:server_host,
    port:server_port
  });

server.register(Inert,()=>{});




/*
 * ROUTING
 */

// Static directory
server.route({
  method:'GET',
  path:'/{path*}',
  handler:{
    directory:{
      path:'.',
      redirectToSlash:true,
      index:false
    }
  }
});

// Session - settings
server.state('session',{
    ttl:null,
    path:'/',
    //isSecure:true,
    isHttpOnly:true,
    clearInvalid:true,
    strictHeader:true,
    encoding:'base64json'
});

// INDEX
server.route({
  method:'GET',
  path:'/',
  handler:function(request,reply){
    var session=request.state.session;
        session=session?session:''
    if(session.substr(0,1)!=='1'&&session.substr(0,1)!=='9'){
      reply.file('./_out.html')
    }
    else if(session.substr(0,1)==='1'){
      reply.file('./_in.html').state('use','fxr')
    }
    else{
      reply.file('./_in.html')
    }
} });

// Logging Out
server.route({
  method:'GET',
  path:'/_destroy',
  handler:function(request,reply){
    reply.redirect('../').state('session','').state('use','')
} });

// Logging In
server.route({
  method:'POST',
  path:'/_login',
  handler:function(request,reply){
    if(!request.payload.pss||request.payload.pss.length<1){
      reply('Invalid login')
      return false
    }
    var u=request.payload.usr.toUpperCase()
    var p=request.payload.pss.toUpperCase()
    var s=0
      // route admin
      if(u!=='HRIS:0'){
        // get setting
        Fs.readFile(Path.join(__dirname,'port/HRIS_settings'),function(err,data){
          // 1:enableClientLogin -> 1
          var d=data.toString()
          if(d.substr(d.indexOf('enableClientLogin')-2,1)==='0'){
            reply('Client login disabled.')
          }
          else{ loginNext(); s=1 }
        })
      }else{
        s=9
        loginNext()
      }
      function loginNext(){
        Fs.readFile(Path.join(__dirname,'port/HRIS_password'),function(err,data){
          if(err){console.error(err)}
          var d=data.toString()
          // cek user
          if(d.indexOf('^'+u+'~')<0){reply('Invalid user');return false}        
          // check pass
          d=d.split('^')
            for(var i=0,len=d.length;i<len;i++){
              if(d[i] && d[i].indexOf(u)>-1){
                if(Bcrypt.compareSync(p,(d[i].split('~')[2]+''))){
                  reply(86).state('session',s+u)
                }
                else{
                  reply('Invalid password')
                }
                return false
              }
            }
        })
      }
} });

// upload xlsx
server.route({
  method:'POST',
  path:'/_uploadXLSX',
  handler:function(request,reply){
    var t=request.payload.type
    var d=request.payload.data
    var n=request.payload.name
    var p=Path.join(__dirname,'port/'+n)
    // check the data
    if(
        t!=='PASSWORD'&&
        t!=='PROFILE'&&
        t!=='PRESENSI'&&
        t!=='GAJI'
      ){
         reply('Error: Invalid data')
         return false
       }
      // Bcrypting..
      if(t==='PASSWORD'){
              d=d.split('^')
          var f='^HRIS:0~HRIS~$2a$10$.T37mAmCmVeb/neWkl9DRu3fK7zKTRFJrAm.CfHUSpT46n3giiCo6^'
          for(var i=0,len=d.length-1;i<len;i++){
            if(!d[i]||d[i].indexOf('~')<0)return false;
            var e=d[i].split('~')
            f+=e[0]+'~'+e[1]+'~'+Bcrypt.hashSync(e[2].toUpperCase(),Salt)+'^'
            L(i)
          } d=f
      }
      Fs.writeFile(p,d,function(err){
        if(err){console.error(err)}
        reply('Uploading <b>'+n.split('/').pop()+'</b> success')
      });
  }
});

// add, edit profile
server.route({
  method:'POST',
  path:'/_edit_profile',
  handler:function(request,reply){
    var t=request.payload.type
    var n=request.payload.name
    var d=request.payload.data
    var p=Path.join(__dirname,'port/HRIS_profile')
    
      Fs.readFile(p,function(err,data){
        if(err){console.error(err)}
        data=data.toString()
        // search match nik
        if(data.indexOf(n)>-1){
          data=data.split('^')
          for(var i=0,len=data.length;i<len;i++){
            if(data[i].indexOf(n)>-1){
              data[i]=d
              d=data.join('^')
              // write matched data
                Fs.writeFile(p,d,function(err){
                  if(err){console.error(err)}
                  reply('Editing profile <b>'+n+'</b> success.')
                });
              i=999
            }
          }
        }
        // add profile
        else{
          data=data.split('^')
          data.pop()
          data.push(d)
          d=data.join('^')
          // write matched data
            Fs.writeFile(p,d,function(err){
              if(err){console.error(err)}
              reply('Adding new profile <b>'+n+'</b> success.')
            });
        }
      })

  }
});

// edit password
server.route({
  method:'POST',
  path:'/_edit_password',
  handler:function(request,reply){
    let session=request.state.session;
    var n=request.payload.name || session.substr(1,8)
    var n2=request.payload.name2 || ''
    var d=request.payload.data
    var p=Path.join(__dirname,'port/HRIS_password')
        
        d=d.toUpperCase()
        n=n.toUpperCase()
        
      // Bcrypting..
      if(d.length<1){
        reply('Error: Bad password')
        return false
      }
        d=Bcrypt.hashSync(d,Salt)
        
        Fs.readFile(p,function(err,data){
          if(err){console.error(err)}
          data=data.toString()
          // search match nik
          if(data.indexOf(n)>-1){
            data=data.split('^')
            for(var i=0,len=data.length;i<len;i++){
              if(data[i].indexOf(n)>-1){
                data[i]=n+'~'+data[i].split('~')[1]+'~'+d
                d=data.join('^')
                // write matched data
                  Fs.writeFile(p,d,function(err){
                    if(err){console.error(err)}
                    reply('Editing password <b>'+n2+'</b> success.')
                  });
                return false
              }
            }
          }
          else{
           reply('Error: No user found')
          }
        })
  }
});

// get Profile
server.route({
  method:'POST',
  path:'/_get',
  handler:function(request,reply){ 
  let session=request.state.session;
  var p=Path.join(__dirname,'port/'+request.payload.type)
  var n=session.substr(1,8)
    
    if(session.substr(0,1)==='9'){
      reply.file(p).type('text/plain');
    }
    else if(session.substr(0,1)==='1'){
      Fs.readFile(p,function(err,data){
        if(err){
          console.error(err)
          reply('').code(404)
          return false
        }
        data=data+''
        if(data.indexOf(n)>-1){
          data=data.split('^')
          var c=''
          for(var i=0,len=data.length;i<len;i++){
            if(data[i].indexOf(n)>-1){
              c+=data[i]+'^'
            }
          } reply(c)
        }
        else{
          reply('').code(404)
        }
      });
    }
  
} });





// get & set settings
server.route({
  method:'POST',
  path:'/_settings',
  handler:function(request,reply){
  var d=request.payload.data
  var p=Path.join(__dirname,'port/HRIS_settings')
    // set settings
    if(request.payload.type==='set'){
      Fs.writeFile(p,d,function(err){
        if(err){console.error(err)}
        reply('Settings saved')
      });
    }
    else if(request.payload.type==='get'){
      reply.file(p)
           .type('text/plain');
    }
} });











/*
 * SERVER LOGS
 */
server.register({
  register:Good,
  options:{
    reporters:[{
      reporter:require('good-console'),
      events:{
        response:'*',
        log:'*'
      }
    }]
  }
},(err)=>{
  if(err){
    throw err; // something bad happened loading the plugin
  }
  server.start(()=>{
    server.log('info','Server running at:' + server.info.uri);
  });
});











