
var pupTimeout=0
var D=new Date()
var fullDay=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
var fullMonth=['January','February','March','April','May','June','July','August','September','October','November','December']

// jsStack
function DBG(s){$('#DBG').html(s);console.log(s)}
function LOG(s){console.log(s)}
function byID(s){    return document.getElementById(s)}
function byClass(s){ return document.getElementsByClassName(s)}
function POS(e){
  e=e.getBoundingClientRect()
  return{
    left:e.left+window.scrollX,
     top:e.top +window.scrollY
  }
}
function SPIN(x){
  if(x>  1){$('#SPIN').show();setTimeout(function(){$('#SPIN').hide()},x)}
  if(x===1){$('#SPIN').show()}
  if(x===0){$('#SPIN').hide()}
}
function PUP(x,y){
  clearTimeout(pupTimeout)
  pupTimeout=setTimeout(function(){$('#PUP').fadeOut(300)},5000)
  $('#PUP').show().html(x)
  y===1&&LOG(x)
}



/* Fullsreen */
function Fullscreen(){
  !document.webkitIsFullScreen?
    $('html').get(0).webkitRequestFullscreen():
    document.webkitCancelFullScreen()
}
$(document).keypress(function(e){
  if(e.which===32)$('input,textarea').is(':focus')?0:Fullscreen()
})




/* Ajax setup */

$(document)
.ajaxStart(function(){SPIN(1)})
.ajaxComplete(function(){SPIN(0)})
$.include=function(url,options){
  options=$.extend(options||{},{
    dataType:'script',
    cache:false,
    url:url
}); return $.ajax(options) }
$.includeCss=function(url){
  $('head').append($('<link rel=stylesheet></link>').attr('href',url))
}
$('#PANEL').on('click',function(){
  $('.PANEL_').hide()
  $('html').removeClass('noscroll')  
})



/* SIDEBAR
 * navigation
 */
$('.SD-menu-d').on('click',function(){
  if(!$(this).is('.on')){
    var name=$(this).attr('class').split(' ')[1]
    var page=$('.PG-'+name)
    $(this).addClass('on')
           .siblings('.SD-menu-d').removeClass('on')
           .siblings('e').slideUp(300)
    $('#SIDE').children('e.'+name).slideDown(300)
    if(document.cookie.indexOf('fxr')>-1&&name==='settings'){name='settings-user'}
    page.is(':empty')&&page.load('p-'+name+'.html')
    setTimeout(function(){
      page.siblings('.PAGE').hide()
      page.fadeIn()
    },1000)
  }
})





/* MAIN
 * start
 */
function MAIN_start(){
  $('.SD-menu-d.profile').click()
} MAIN_start()

// logout
$('.SD-profile-logout').on('click',function(){
  window.location.href=window.location.href+'_destroy'
})






if(document.cookie.indexOf('fxr')>-1){
  $('body').append('\
  <style>\
    #PPF,.SD-menu-e,#PPA-tAdd,.PPP-edit{\
      display:none!important;opacity:0;visibility:hidden;\
    }\
  <style>\
  ')
}









