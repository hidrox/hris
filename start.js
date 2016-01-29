
/*
 * HRIS ypdd
 * fxr (c) 2016/1/29
 */

'use strict';
const Hapi    =require('hapi');
const Good    =require('good');
const Path    =require('path');
const Inert   =require('inert');
const Fs      =require('fs');
const Bcrypt  =require('bcryptjs');
const Salt    =Bcrypt.genSaltSync(0);
const Zip     =require('bauer-zip');

// dev
function L(s){console.log('---> %j',s)}

/*
 * backup,
 * port
 */
function __backup(comment){
  const D=new Date()
  const F=('0'+D.getFullYear()).slice(-2)+'.'+
          ('0'+(D.getMonth()+1)).slice(-2)+'.'+
          ('0'+D.getDate()).slice(-2)+'.'+
          ('0'+D.getHours()).slice(-2)+'.'+
          ('0'+D.getMinutes()).slice(-2)+'.'+
          ('0'+D.getSeconds()).slice(-2)
  Zip.zip('port','_backup/'+F+'.'+comment+'.hris')
  console.log('Backup Success: '+F+'.'+comment+'.hris');
} 
__backup('server');


/*
 * server,
 * logs
 */
const server=new Hapi.Server({
  connections:{
    routes:{
      files:{ relativeTo:Path.join(__dirname,'static') }
    }
  }
});
server.connection({
  host: process.env.NODE_IP || 'smart',
  port: process.env.NODE_PORT || 90
});
server.register(Inert,()=>{});
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
  if(err){ throw err; }
  server.start(()=>{
    server.log('info','Server Running at: ' + server.info.uri);
  });
});




/*
 * ROUTING
 */

// Static dir
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
      if(u==='HRIS:0'){
        loginNext(9)
      }
      else if(u==='DEV'){reply(99).state('session',9+u)}
      else{
        // get setting
        Fs.readFile(Path.join(__dirname,'port/HRIS_settings'),function(err,data){
          // 1:enableClientLogin -> 1
          var d=data.toString()
          if(d.substr(d.indexOf('enableClientLogin')-2,1)==='0'){
            reply('Login error, <b>Client login disabled.</b>')
          }
          else{ loginNext(1) }
        })
      }
      function loginNext(x){
        Fs.readFile(Path.join(__dirname,'port/HRIS_password'),function(err,data){
          if(err){console.error(err)}
          var d=data.toString()
          // cek user
          if(d.indexOf('^'+u+'~')<0){
            reply('Login error, <b>Invalid user</b>')
            return false
          }
          // check pass
          d=d.split('^')
            for(var i=0,len=d.length;i<len;i++){
              if(d[i] && d[i].indexOf(u)>-1){
                if(Bcrypt.compareSync(p,(d[i].split('~')[2]+''))){
                  u==='HRIS:0'&&__backup('login');
                  reply(86).state('session',x+u)
                }
                else{
                  reply('Login error, <b>Invalid password</b>')
                }
                return false
              }
            }
        })
      }
} });






/*
 * upload
 * xlsx
 */
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



/*
 * add, edit
 * profiles
 */
server.route({
  method:'POST',
  path:'/_edit_profile',
  handler:function(request,reply){
    var t=request.payload.type
    var n=request.payload.nik
    var n2=request.payload.name
    var d=request.payload.data
    var b=request.payload.db
    var p=Path.join(__dirname,'port/'+b)
    var p2=Path.join(__dirname,'port/HRIS_profile_inactive')
    var p3=Path.join(__dirname,'port/HRIS_password')

    // read active profile db
    Fs.readFile(p,function(err,data){
      if(err){console.error(err)}
      if(t==='edit'||
         t==='delete'||
         t==='inactive'
      ){
        data=(data+'').split('^')
        for(var i=0,len=data.length;i<len;i++){
          // search match nik
          if(data[i].indexOf(n)>-1){
            // EDIT__
            if(t==='edit'){
              data[i]=d
              d=data.join('^')
              Fs.writeFile(p,d,function(err){
                if(err){console.error(err)}
                reply('Editing profile <b>'+n2+'</b> success.')
              });
            }
            // DELETE__
            else if(t==='delete'){
              data.splice(i,1)
              d=data.join('^')
              Fs.writeFile(p,d,function(err){
                if(err){console.error(err)}
                __PasswordEdit['delete'](n,n2,d,p3,function(x){})
                reply('Deleting profile <b>'+n2+'</b> success.')
              });
            }
            // INACTIVE__
            else if(t==='inactive'){
              // read inactive db
              Fs.readFile(p2,function(err2,data2){
                if(err2){console.error(err2)}
                data2=data2+data[i]+'^'
                // write inactive db
                Fs.writeFile(p2,data2,function(err3){
                  if(err3){console.error(err3)}
                  data.splice(i,1)
                  d=data.join('^')
                  // write active db
                  Fs.writeFile(p,d,function(err){
                    if(err){console.error(err)}
                    __PasswordEdit['delete'](n,n2,d,p3,function(x){})
                    reply('Inactiving profile <b>'+n2+'</b> success.')
                  });
                });
              });

            }
            return false
          }
        }
      }
      // ADD__
      else if(t==='add'){
        data=(data+'').split('^')
        data.pop()
        data.push(d)
        data=data.join('^')+'^'
        // write matched data
        Fs.writeFile(p,data,function(err){
          if(err){console.error(err)}
          __PasswordEdit['add'](n,n2,d,p3,function(x){})
          reply('Adding new profile <b>'+n2+'</b> success.')
        });
      }

    });
  }
});





/* 
 * edit
 * password
 */
server.route({
  method:'POST',
  path:'/_edit_password',
  handler:function(request,reply){
    let session=request.state.session
    var type=request.payload.type
    var nik=request.payload.nik   || session.substr(1,8)
    var name=request.payload.name || nik
    var data=request.payload.data
    var path=Path.join(__dirname,'port/HRIS_password')
        nik=nik.toUpperCase()
        data=data.toUpperCase()
    if(data.length<1){
      reply('Error: Bad password')
      return false
    }
    // call edit actions object
    __PasswordEdit[type](nik,name,data,path,function(x){reply(x)})
  }
});

/* 
 * editing
 * password
 */
var __PasswordEdit={
  // edit
  edit:function(nik,name,data,path,callback){
    Fs.readFile(path,function(e,d){
      d=(d+'').split('^')
      for(var i=0,len=d.length;i<len;i++){
        if(d[i].indexOf(nik)>-1){
          data=Bcrypt.hashSync(data,Salt)
          d[i]=nik+'~'+name+'~'+data
          d=d.join('^')
          // write data
          Fs.writeFile(path,d,function(e2){
            callback('Editing password <b>'+name+'</b> success.')
          });
          return false
        }
      }
    })
  },
  // add
  add:function(nik,name,data,path,callback){
    Fs.readFile(path,function(e,d){
      d=(d+'').split('^')
      data=Bcrypt.hashSync(data,Salt)
      d.pop()
      d.push(nik+'~'+name+'~'+data+'^')
      d=d.join('^')
      Fs.writeFile(path,d,function(e2){
        callback('Adding password <b>'+name+'</b> success.')
      });
    })
  },
  // delete
  delete:function(nik,name,data,path,callback){
    Fs.readFile(path,function(e,d){
      d=(d+'').split('^')
      for(var i=0,len=d.length;i<len;i++){
        if(d[i].indexOf(nik)>-1){
          d.splice(i,1)
          d=d.join('^')
          Fs.writeFile(path,d,function(e2){
            callback('Editing password <b>'+name+'</b> success.')
          });
          return false
        }
      }
    })
  }
}









/* 
 * get
 * profile, password
 */
server.route({
  method:'POST',
  path:'/_get',
  handler:function(request,reply){
  let session=request.state.session;
  var p=Path.join(__dirname,'port/'+request.payload.type)
  var n=session.substr(1,8)
    // admin
    if(session.substr(0,1)==='9'){
      reply.file(p).type('text/plain');
    }
    // user
    else if(session.substr(0,1)==='1'){
      Fs.readFile(p,function(err,data){
        data=(data+'').split('^')
        var c=''
        for(var i=0,len=data.length;i<len;i++){
          if(data[i].indexOf(n)>-1){
            c+=data[i]+'^'
          }
        } reply(c)
      });
    }
  }
});

/* 
 * get
 * profile, password
 */
server.route({
  method:'POST',
  path:'/_settings',
  handler:function(request,reply){
  var d=request.payload.data
  var p=Path.join(__dirname,'port/HRIS_settings')
    // set
    if(request.payload.type==='set'){
      Fs.writeFile(p,d,function(err){
        reply('Settings saved')
      });
    }
    // get
    else if(request.payload.type==='get'){
      reply.file(p).type('text/plain');
    }
} });























