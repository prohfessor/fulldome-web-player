/* The FullDomeRenderer code presented here is adapted from:
 *
 *   https://github.com/spite/THREE.CubemapToEquirectangular
 */

const inchesToMeters     = 0.0254;
const feetToMeters       = 0.3048;
const degreesToRadians   = Math.PI / 180;

RendererConfig = {
    camera: {
        /* The cube camera takes in the 360 view of the scene. The
           starting position is at average eye height for a standing
           person. */
        startingPosition:   new THREE.Vector3(0, 5 * feetToMeters, 0),
        /* The cameraRig member carries the camera. Move this around to
        animate the viewpoint */
        rig:        null,
        near:       .1,
        far:        12000,
        cubeMapSize: 3072
    },
    dome: {
        radius:             6, //35.0 * feetToMeters / 2,
        inclination:        0 * degreesToRadians,
        fullSphere:         false
    },
};

// Load defaults from session storage

var val = sessionStorage.getItem('defaultCubeMapResolution');
if(val) {
    console.log("cubeMapSize from session storage", val);
    RendererConfig.camera.cubeMapSize = parseInt(val);
}

/* Trick for inline strings for GLSL code:
     http://stackoverflow.com/questions/805107/creating-multiline-strings-in-javascript
 */
Function.prototype.getComment = function() {
    var startComment = "/*!";
    var endComment = "*/";
    var str = this.toString();

    var start = str.indexOf(startComment);
    var end = str.lastIndexOf(endComment);

    return str.slice(start + startComment.length, -(str.length - end));
};

FullDomeRenderer.vertexShader = function() {/*!
attribute vec3 position;
attribute vec2 uv;
uniform   mat4 projectionMatrix;
uniform   mat4 modelViewMatrix;
varying   vec2 vUv;

#define M_PI 3.1415926535897932384626433832795

void main() {
    vUv         = vec2(uv.x - 0.5, uv.y - 0.5);
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
*/}.getComment();

FullDomeRenderer.fragmentShader = function() {/*!
precision highp       float;
uniform   samplerCube map;
varying   vec2        vUv;

#define M_PI 3.1415926535897932384626433832795

void main()  {
    float l             = length(vUv);
    float latitude      = l * M_PI;
    float sinOfLatitude = sin( latitude );
    float cosOfLatitude = cos( latitude );
    vec3 dir = vec3(
          vUv.x/l * sinOfLatitude,
                    cosOfLatitude,
          vUv.y/l * sinOfLatitude
    );
    gl_FragColor = textureCube( map, dir );
    if(gl_FragColor.r<0.0001 && gl_FragColor.g<0.0001 && gl_FragColor.b<0.0001) gl_FragColor.a = 0.0; //gl_FragColor.r;
}
*/}.getComment();

function getDomeGeometry(radius, fullSphere) {
    var geometry = new THREE.SphereBufferGeometry(
        radius, 64, 64,
        0, Math.PI*2,
        0, fullSphere ? Math.PI : Math.PI/2
    );

    /* If rendering a half sphere, the UV texture coordinates
     * need to be halved in the y direction. */
    if(!fullSphere) {
        var uv = geometry.attributes.uv.array;
        for(var i = 1; i < uv.length; i += 2) {
            uv[i] = uv[i]/2 + 0.5;
        }
    }
    return geometry;
}


function FullDomeRenderer( renderer ) {
    this.renderer = renderer;

    /* For doing the warpping, we use a scene that consists of
     * a quad that covers the entire canvas and paint it with a
     * fragment shader */
    this.material = new THREE.RawShaderMaterial( {
	 transparent: true, opacity: 0.5,
        uniforms: {
            map: { type: 't', value: null }
        },
        vertexShader:   FullDomeRenderer.vertexShader,
        fragmentShader: FullDomeRenderer.fragmentShader,
//        side: THREE.DoubleSide
    } );
    
    this.scene = new THREE.Scene();
    this.quad = new THREE.Mesh(
        new THREE.PlaneBufferGeometry(1, 1),
        this.material
    );

    this.scene.add(this.quad);

    this.camera = new THREE.OrthographicCamera(
        1 / -2, // Camera frustum left  plane
        1 /  2, // Camera frustum right plane
        1 /  2, // Camera frustum top plane
        1 / -2, // Camera frustum bottom plane
        -10000, // Camera frustum near plane
         10000  // Camera frustum far plane
    );

    /* The cube camera snaps a 360 picture of the user's scene into a cube texture */
	var gl = this.renderer.getContext();
	var maxSize = gl.getParameter( gl.MAX_CUBE_MAP_TEXTURE_SIZE );

    var cameraRig = new THREE.Object3D();
    this.cubeCamera = new THREE.CubeCamera(
        RendererConfig.camera.near,
        RendererConfig.camera.far,
        Math.min(maxSize, RendererConfig.camera.cubeMapSize)
    );
    cameraRig.add(this.cubeCamera);
    this.cubeCamera.rotation.x = -RendererConfig.dome.inclination;
    cameraRig.position.copy(RendererConfig.camera.startingPosition);
    RendererConfig.camera.rig = cameraRig;

    /* If we have a half-dome, obstructing the lower half of
     * the cube camera with a hemisphere improves performance on
     * complex scenes. */
    if(!RendererConfig.dome.fullSphere) {
        var domeGeometry = getDomeGeometry(RendererConfig.dome.radius, RendererConfig.dome.fullSphere);

        var shield = new THREE.Mesh(domeGeometry, new THREE.MeshBasicMaterial({
//            color: 0x000000,
            color: 0x111111,
            side: THREE.BackSide
        }));
        shield.rotation.x = Math.PI;
        shield.scale.set(0.10, 0.10, 0.10);
        this.cubeCamera.add(shield);
    }
/*
    var geometry = new THREE.BoxGeometry( 100,100,100);
//    var box = new THREE.Mesh(geometry, this.material);
        var box= new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({  color: 0xff0000, side: THREE.BackSide }));
    box.position.set(0, 20, 40);
    box.scale.set(3,3,1);
    this.scene.add(box);
*/
/*
    var geometry = new THREE.BoxGeometry(1,1,1);
        var shield2 = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({            color: 0xff0000,            side: THREE.BackSide        }));
        shield2.rotation.x = Math.PI;
        shield2.scale.set(1, 1, 1);
        this.cubeCamera.add(shield2);
        shield2.position.y = Math.PI+0.5;
        shield2.position.z = 1;
        shield2.position.x = 0;
*/
}

FullDomeRenderer.prototype.setVideo = function() {
/* РёРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј РІ setVideos
	const video = document.getElementById( 'video' );
	vtexture = new THREE.VideoTexture( video );
	vtexture.minFilter = THREE.NearestFilter
*/
	var radius=RendererConfig.dome.radius;

    var canvas = this.renderer.domElement;
        var width  = 3072; //canvas.clientWidth;  // 2480
        var height = 3072; //canvas.clientHeight; // 2480

	var geometry = new THREE.PlaneGeometry( width, height);
    videoPlane= new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: vtexture, side: THREE.DoubleSide }));
//console.log(visiblevideo);
    if(visiblevideo=="videoFulldome") videoPlane.visible=true; else videoPlane.visible=false;
//	var videoPlane= new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({            color: 0xff0000,            side: THREE.DoubleSide        })); // РїСЂРѕСЃС‚Рѕ РєСЂР°СЃРЅС‹Р№ РєРІР°РґСЂР°С‚
//	videoPlane.rotation.z=Math.PI/2; // РµСЃР»Рё РґР»РёРЅР° РЅРµ СЂР°РІРЅР° С€РёСЂРёРЅРµ, РєР°СЂС‚РёРЅРєР° СЃРїР»СЋС‰РёРІР°РµС‚СЃСЏ РїСЂРё РїРѕРІРѕСЂРѕС‚Рµ.
	this.scene.add(videoPlane);
}

FullDomeRenderer.prototype.getScene = function() {return this.scene;}

FullDomeRenderer.prototype.setSize = function( width, height ) {
	this.width = width;
	this.height = height;

	this.quad.scale.set( this.width, this.height, 1 );

	this.camera.left   = this.width / - 2;
	this.camera.right  = this.width / 2;
	this.camera.top    = this.height / 2;
	this.camera.bottom = this.height / - 2;

	this.camera.updateProjectionMatrix();
}

FullDomeRenderer.prototype.render = function( scene ) {
    /* Step 1: Render the user's scene to the CubeCamera's texture */
	var autoClear = this.renderer.autoClear;
	this.renderer.autoClear = true;
	this.cubeCamera.updateCubeMap( this.renderer, scene );
	this.renderer.autoClear = autoClear;
    
    /* Step 2: Assign the CubeCamera's texture to the quad's fragment shader */
    this.quad.material.uniforms.map.value = this.cubeCamera.renderTarget.texture;

    /* Step 3: Paints the quad to the screen using the fragment shader to
     * perform the equirectangular distortion. */
    this.renderer.render(this.scene, this.camera);

}


var visiblevideo=""; // v360, fulldome

var mvideos = new Array();
var playbackStop = 0;

function parsePlaylistLine(line) {
	var content = String(line || "").trim();
	if (!content || content.startsWith("#")) return null;
	var comment = content.indexOf("#");
	if (comment >= 0) content = content.substring(0, comment).trim();
	var fields = content.split(",");
	if (fields.length < 5) return null;
	var pathIndex = fields.length >= 6 ? 5 : 4;
	var url = fields.slice(pathIndex).join(",").trim();
	if (!url) return null;
	return {
		start: Number(fields[0]) || 0,
		stop: Number(fields[1]) || 0,
		x: Number(fields[2]) || 0,
		y: Number(fields[3]) || 0,
		flags: fields.length >= 6 ? fields[4].trim() : "",
		url: url
	};
}

function addVideo(url, start, stop, x, y, params) {
	var pause=false; // РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ, СЃР»РµРґСѓСЋС‰РµРµ РІРёРґРµРѕ РёРіСЂР°РµС‚ Р±РµР· РїР°СѓР·С‹
	var mute=false; // РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ, Р·РІСѓРє РІРєР»СЋС‡РµРЅ
	var startvideo=false; // РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ, РїРµСЂРІРѕРµ РІРёРґРµРѕ Р¶РґРµС‚ РЅР°Р¶Р°С‚РёСЏ РєР»Р°РІРёС€Рё
	var type=url.split("/")[1]; // videofulldome || video360
	var newurl=url;
	if(!type) {console.log("no /"); type=""}  // url РІРёРґРµ РЅРµ РЅР°С‡РёРЅР°РµС‚СЃСЏ СЃ "/" - С‚.Рµ. РѕС€РёР±РєР° РІ РїР»РµР№Р»РёСЃС‚Рµ
	else if(type.indexOf("videoFulldome") < 0 && type.indexOf("video360") < 0) {
		console.log("no videoFulldome"); 
		type="";  // РІРёРґРµРѕ Р»РµР¶Р°С‚ РІ РґСЂСѓРіРёС… РїР°РїРєР°С…, РЅР°РїСЂРёРјРµСЂ /video. РўРѕРіРґР° РІ РїР»РµР№Р»РёСЃС‚Рµ РЅСѓР¶РЅРѕ СѓРєР°Р·С‹РІР°С‚СЊ С‚РёРї ("f", "o")
	}
	var h=0;
	var n=0; // nearer - Р±Р»РёР¶Рµ, РґР°Р»СЊС€Рµ
	if(params!=undefined && params.length>0) {
		if(params.indexOf("s")>=0) startvideo=true; // РЎСЂР°Р·Сѓ РёРіСЂР°РµРј РїРµСЂРІРѕРµ РІРёРґРµРѕ
		if(params.indexOf("p")>=0) pause=true; // РїР°СѓР·Р° РїРµСЂРµРґ СЃР»РµРґСѓСЋС‰РёРј РІРёРґРµРѕ
		if(params.indexOf("m")>=0) mute=true; // РІС‹РєР»СЋС‡РёС‚СЊ Р·РІСѓРє РІРёРґРµРѕ
		if(params.indexOf("f")>=0) type="videoFulldome"; 
		if(params.indexOf("o")>=0) type="video360"; // 
		if(params.indexOf("h")>=0) {h=parseInt(params.substring(params.indexOf("h")+1), 10)}; // 
		if(params.indexOf("n")>=0) {n=parseInt(params.substring(params.indexOf("n")+1), 10)}; // 
	}
	console.log("type: -------", type, "h: ", h, "n: ", n);
	mvideos.push( {
		start: start, 
		stop: stop,
		x: x,
		y: y,
		h: h,
		n: n,
		url: newurl,
		pause: pause,	
		muted: mute,
		type: type,
		startvideo: startvideo
	});

}


var setVideos = function (tv) {
	var videoURLs=tv.split("\n");
	var numVideos=videoURLs.length;
console.log("videos: ", numVideos);
/*
for(let url of tv) {
	videoURLs.push(url);
}
*/
//	console.log(videoURLs);

  var videoEL = document.querySelector('.random-video'); // Р‘Р»РѕРє РѕР±С‘СЂС‚РєР° РІСЃРµС… РІРёРґРµРѕ
  var newVideo = 0; // РЅРѕРјРµСЂ С‚РµРєСѓС‰РµРіРѕ РІРёРґРµРѕ
  var oldVideoEl = 0; //Math.floor(Math.random() * videoURLs.length), // Р Р°РЅРґРѕРјРЅРѕ РІС‹Р±РµСЂРµРј СЃС‚Р°СЂРѕРІРѕРµ РІРёРґРµРѕ (РјРѕР¶РЅРѕ РїСЂРѕРїРёСЃР°С‚СЊ РёРЅРґРµРєСЃ Р»СЋР±РѕРіРѕ РІРёРґРµРѕ РёР· СЃРїРёСЃРєР°)
  var videos; // РўСѓС‚ Р±СѓРґРµРј С…СЂР°РЅРёС‚СЊ СЃРїРёСЃРѕРє РІСЃРµС… РІРёРґРµРѕ
  var timerTime = 1000*10; // РљРѕР»-РІРѕ РјСЃ, С‡РµСЂРµР· СЃРєРѕР»СЊРєРѕ Р±СѓРґРµС‚ СЃРјРµРЅР° РІРёРґРµРѕ
  var opacityTime = 1000; // РљРѕР»-РІРѕ РјСЃ, Р·Р° СЃРєРѕР»СЊРєРѕ СЃРјРµРЅРёС‚СЃСЏ РІРёРґРµРѕ ("РїР»Р°РІРЅРѕСЃС‚СЊ" РїРµСЂРµС…РѕРґР°)
// РЎС‚Р°СЂС‚СѓРµРјРЃВ©)

	for(let str of videoURLs) {
		var item = parsePlaylistLine(str);
		if (!item) continue;
		addVideo(item.url, item.start, item.stop, item.x, item.y, item.flags);
	}
//videos = videoEL.querySelectorAll('video'); // Р”Р°Р»РµРµ Р·Р°РїРёСЃС‹РІР°РµРј РІСЃРµ РІРёРґРµРѕ РёР· Р±Р»РѕРєР° РІ РїРµСЂРµРјРµРЅРЅСѓСЋ
//curVideo=videos[curVideoNum];
if (mvideos.length === 0) throw new Error("В плейлисте нет корректных строк");
for (let index = 0; index < 2; index++) {
	const element = document.createElement("video");
	element.id = "video_" + index;
	element.src = mvideos[0].url;
	element.muted = mvideos[0].muted;
	element.crossOrigin = "anonymous";
	element.preload = "none";
	videoEL.appendChild(element);
}

curVideoEl=document.getElementById("video_0");
oldVideoEl=document.getElementById("video_1");

curVideoEl.load();
oldVideoEl.load();

videoEL.style.setProperty('--opacity-time', this.opacityTime); // РЈРєР°Р·С‹РІР°РµРј РІСЂРµРјСЏ РїР»Р°РІРЅРѕСЃС‚Рё РїРµСЂРµС…РѕРґР° РґР»СЏ РІСЃРµС… РІРёРґРµРѕ ("РїРµСЂРµС…РѕРґ РґРµР»Р°РµРј С‡РµСЂРµР· CSS)

vtexture = new THREE.VideoTexture( curVideoEl );
vtexture.minFilter = THREE.NearestFilter
curVideoEl.currentTime=mvideos[0].start;
playbackStop=mvideos[0].stop;
//visiblevideo=mvideo[0].type;
if(visiblevideo=="videoFulldome") {videoPlane.rotation.z=parseInt(mvidoes[0].x, 10)*Math.PI/180;}
if(visiblevideo=="video360")      {video360.rotation.y=parseInt(mvidoes[0].x, 10)*Math.PI/180;}
// curVideoEl.play(); // Р—Р°РїСѓСЃС‚РёРј "РЅРѕРІРѕРµ" РІРёРґРµРѕ // Р·Р°РїСѓСЃРє РІРёРґРµРѕ РїСЂРё Р·Р°РіСЂСѓР·РєРµ. РЎРґРµР»Р°С‚СЊ РїРѕ С„Р»Р°РіСѓ РІ Р±СЂР°СѓР·РµСЂРµ РёР»Рё РїР»РµР№Р»РёСЃС‚Рµ, РёР»Рё РІ С„Р°Р№Р»Рµ РїР°СЂР°РјРµС‚СЂРѕРІ РґР»СЏ РєР°Р¶РґРѕРіРѕ РїР»РµР№Р»РёСЃС‚Р°
//console.log("curVideoEl.play", curVideoEl.src.split("/"));
visiblevideo=curVideoEl.src.split("/")[3];
/*
let timer = setTimeout(function RandomVideo() { // Р—Р°РїСѓСЃРєР°РµРј С„СѓРЅРєС†РёСЋ СЃРјРµРЅС‹ РІРёРґРµРѕ РІ СЂРµРєСѓСЂСЃРёРІРЅРѕРј С‚Р°Р№РјРµСЂРµ

  let newVideo = function NewVideo() {
    let rand = Math.floor(Math.random() * videoURLs.length);
    if(oldVideo === rand) return NewVideo(); else return rand;
  }(); // Р Р°РЅРґРѕРјРЅРѕ Р±РµСЂС‘Рј РІРёРґРµРѕ РёР· СЃРїРёСЃРєР°
  
  let oldVideoEL = videos[oldVideo]; // Р‘РµСЂС‘Рј "СЃС‚Р°СЂРѕРµ" РІРёРґРµРѕ (С‚РѕС‡РЅРµРµ С‚РµРєСѓС‰РµРµ, РєРѕС‚РѕСЂРѕРµ РІРѕСЃРїСЂРѕРёР·РІРѕРґРёС‚СЃСЏ СЃРµР№С‡Р°СЃ)
  oldVideoEL.style.opacity = 0; // РїР»Р°РІРЅРѕ "СЃРїСЂСЏС‡РµРј"
  setTimeout(function() { // РџРѕСЃР»Рµ С‚РѕРіРѕ РєР°Рє Р·Р°РєРѕРЅС‡РёС‚СЃСЏ РїР»Р°РІРЅС‹Р№ РїСЂРѕС…РѕРґ РїСЂРѕР·СЂР°С‡РЅРѕСЃС‚Рё, РІС‹РїРѕР»РЅРёРј СЌС‚Рѕ:
    oldVideoEL.pause(); // РћСЃС‚Р°РЅРѕРІРёРј "СЃС‚Р°СЂРѕРµ" РІРёРґРµРѕ
    oldVideoEL.currentTime = 0; // РџРѕСЃС‚Р°РІРёРј РІСЂРµРјСЏ РЅР° 0, С‡С‚РѕР±С‹ РїРѕС‚РѕРј РѕРЅ РЅР°С‡Р°Р»СЃСЏ СЃРЅР°С‡Р°Р»Р°
  }, opacityTime);

  let newVideoEL = videos[newVideo]; // "РќРѕРІРѕРµ" РІРёРґРµРѕ (РёР»Рё СЃР»РµРґСѓСЋС‰РµРµ СЂР°РЅРґРѕРјРЅРѕРµ)
  curVideoEl=newVideoEL;
  vtexture.image=newVideoEL;
  vtexture.needsUpdate=true;
  newVideoEL.play(); // Р—Р°РїСѓСЃС‚РёРј "РЅРѕРІРѕРµ" РІРёРґРµРѕ
  newVideoEL.style.opacity = 1; // РїР»Р°РІРЅРѕ "РїРѕРєР°Р¶РµРј" РµРіРѕ
  
  oldVideo = newVideo; // РўРµРїРµСЂСЊ "РЅРѕРІРѕРµ" РІРёРґРµРѕ Р±СѓРґРµС‚ "СЃС‚Р°СЂС‹Рј" (С‚РµРєСѓС‰РёРј)
  timer = setTimeout(RandomVideo, timerTime); // Р—Р°РїСѓСЃС‚РёРј С†РёРєР» Р·Р°РЅРѕРіРѕ
}, timerTime);
*/


 this.prev = function() { 
	if(newVideo>0) newVideo-=1; 
	this.setVideo(newVideo);
  }

 this.next = function() { 
	if(newVideo < (videoURLs.length-1)) newVideo++;
	this.setVideo(newVideo);
//	if(newVideo>0) newVideo-=1; 

  }

 this.set = function(num) { 
	if(newVideo < (videoURLs.length-1)) newVideo=num;
	this.setVideo(newVideo);
  }


 this.getNumVideo = function() { 
	return newVideo;
  }

//---- setVideo ----------------------------------
  this.setVideo = function(num) {
      newVideo=num;
//console.log("newVideo: ", num, newVideo);

  if(!(curVideoNum==0 && newVideo==0)) { // РµСЃР»Рё РЅРµ РїСЂРѕРІРµСЂРёРј, РїРµСЂРІРѕРµ РІРёРґРµРѕ СЃС‚Р°РІРёС‚СЃСЏ РЅР° РїР°СѓР·Сѓ
//	  let oldVideoEL =document.getElementById("oldVideo");// Р‘РµСЂС‘Рј "СЃС‚Р°СЂРѕРµ" РІРёРґРµРѕ (С‚РѕС‡РЅРµРµ С‚РµРєСѓС‰РµРµ, РєРѕС‚РѕСЂРѕРµ РІРѕСЃРїСЂРѕРёР·РІРѕРґРёС‚СЃСЏ СЃРµР№С‡Р°СЃ)
	  oldVideoEl.style.opacity = 0; // РїР»Р°РІРЅРѕ "СЃРїСЂСЏС‡РµРј"
	  setTimeout(function() { // РџРѕСЃР»Рµ С‚РѕРіРѕ РєР°Рє Р·Р°РєРѕРЅС‡РёС‚СЃСЏ РїР»Р°РІРЅС‹Р№ РїСЂРѕС…РѕРґ РїСЂРѕР·СЂР°С‡РЅРѕСЃС‚Рё, РІС‹РїРѕР»РЅРёРј СЌС‚Рѕ:
	    oldVideoEl.pause(); // РћСЃС‚Р°РЅРѕРІРёРј "СЃС‚Р°СЂРѕРµ" РІРёРґРµРѕ
	    oldVideoEl.currentTime = 0; // РџРѕСЃС‚Р°РІРёРј РІСЂРµРјСЏ РЅР° 0, С‡С‚РѕР±С‹ РїРѕС‚РѕРј РѕРЅ РЅР°С‡Р°Р»СЃСЏ СЃРЅР°С‡Р°Р»Р°
//	    oldVideoElEL.removeAttribute('src'); // empty source
//	    oldVideoElEL.load();
  	}, opacityTime);
  }
	var nvid=mvideos[newVideo];
	if (nvid) playbackStop=nvid.stop;
	if(!nvid) return; // РІРёРґРµРѕ Р±РѕР»СЊС€Рµ РЅРµС‚

	var v_0=document.getElementById("video_0");
	var v_1=document.getElementById("video_1");
	if(curVideoEl.id=="video_0") 	{ curVideoEl=v_1; oldVideoEl=v_0; }
	else				{ curVideoEl=v_0; oldVideoEl=v_1; }

//	oldVideoEl.src="";
//	oldVideoEl.load();
	curVideoEl.src=nvid.url;
	curVideoEl.load();
//console.log(curVideoEl.src, oldVideoEl.id);
	console.log("newvideo: ", decodeURIComponent(curVideoEl.src));
//	visiblevideo=curVideoEl.src.split("/")[3];
	visiblevideo=mvideos[newVideo].type;
	vtexture.image=curVideoEl;
	vtexture.needsUpdate=true;
	curVideoEl.currentTime=mvideos[newVideo].start;
	curVideoEl.play(); // Р—Р°РїСѓСЃС‚РёРј "РЅРѕРІРѕРµ" РІРёРґРµРѕ
	
	if(visiblevideo=="videoFulldome") {
		videoPlane.rotation.z=parseInt(mvideos[newVideo].x, 10)*Math.PI/180;
console.log("dir type: ", visiblevideo, mvideos[newVideo]);
		videoPlane.rotation.x=0;
		videoPlane.rotation.y=0;
	} else 	if(visiblevideo=="video360")      {
console.log("mvideos: ", mvideos[newVideo].x);
		video360.rotation.y=parseInt(mvideos[newVideo].x, 10)*Math.PI/180;
		video360.rotation.x=0;
		video360.rotation.z=0;
		g360.rotation.x=parseInt(mvideos[newVideo].y, 10)*Math.PI/180;
		g360.position.set(0,parseInt(mvideos[newVideo].h, 10),parseInt(mvideos[newVideo].n));
	} else { 
		videoPlane.rotation.set(0,0,0); video360.rotation.set(0,0,0); 
		visiblevideo="video360"; // !!! РґРµР»Р°РµРј РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ. Р•СЃР»Рё РЅРµ РґРµР»Р°С‚СЊ, С‚Рѕ РЅРµ РїРѕРєР°Р·С‹РІР°РµС‚ РІРёРґРµРѕ РІ РєРѕСЂРЅРµ
	}

	curVideoEl.muted=nvid.muted;
	curVideoEl.style.opacity = 1; // РїР»Р°РІРЅРѕ "РїРѕРєР°Р¶РµРј" РµРіРѕ
  
	curVideoNum= newVideo; // РўРµРїРµСЂСЊ "РЅРѕРІРѕРµ" РІРёРґРµРѕ Р±СѓРґРµС‚ "СЃС‚Р°СЂС‹Рј" (С‚РµРєСѓС‰РёРј)
console.log("nvid: ", nvid);
	if(nvid.type && nvid.type.length>0) visiblevideo=nvid.type;
	if(visiblevideo=="videoFulldome") videoPlane.visible=true; else videoPlane.visible=false;
	if(visiblevideo=="video360") video360.visible=true; else video360.visible=false;
	console.log(visiblevideo);

//	if(newVideo < (videoURLs.length-1)) newVideo++;

}




  this.setVideoOne = function(url) {

  }




 this.seek = function() {
    curVideoEl.currentTime+=10;
 }

} // setVideos; 
// in index.html: 		videos = new setVideos(tvideos); 
// videos - РіР»РѕР±Р°Р»СЊРЅС‹Р№ РѕР±СЉРµРєС‚


var videos;
var g360; // РіСЂСѓРїРїР° РґР»СЏ video360, РґР»СЏ РІСЂР°С‰РµРЅРёСЏ РїРѕ РіРѕСЂРёР·РѕРЅС‚Р°Р»Рё
var video360; // sphere mesh
var videoPlane; // plane (fulldome) mesh
var meshtext;
var box5; // Р·Р°РєСЂС‹РІР°С€РєР° РґР»СЏ РїСЂРµР·РµРЅС‚Р°С†РёР№ РІРЅРµС€РЅРµРіРѕ РїСЂРѕРµРєС‚РѕСЂР°
var curText="";

/* Main function that kickstarts the animation loop */
function startAnimation() {
    var clock  = new THREE.Clock();
    
    var renderer = new THREE.WebGLRenderer();
    var canvas = renderer.domElement;
    document.body.appendChild(canvas);
    
    panoRender = new FullDomeRenderer(renderer, true);
    
    // Call the user routine to setup the scene
    var scene  = new THREE.Scene();
    setupScene(scene);
    scene.add(RendererConfig.camera.rig);
    
//    videos = new setVideos();
    panoRender.setVideo();


g360 = new THREE.Group(); 
const geometry = new THREE.SphereGeometry( 500, 60, 40 );
geometry.scale( - 1, 1, 1 );
const material = new THREE.MeshBasicMaterial( { map: vtexture } );
video360 = new THREE.Mesh( geometry, material );
g360.add(video360);
scene.add(g360);
video360.visible=false;


    var geometry5 = new THREE.PlaneGeometry( 9,9);
//    var box = new THREE.Mesh(geometry, this.material);
    box5= new THREE.Mesh(geometry5, new THREE.MeshBasicMaterial({  color: 0x333333, side: THREE.BackSide }));
    box5.position.set(0, 20, -30);
    box5.scale.set(-4,3,3);
    box5.rotation.x= 20 * (Math.PI / 180);;
    box5.visible=false;
    scene.add(box5);


g360.position.set(0,0,0);
  meshtext = dcText("____________________________________________ ", 2, 5, 15, 0xffffff, 0x000000); // С‚РµРєСЃС‚ (С€РёСЂРёРЅР° РїРѕ С‚РµРєСЃС‚Сѓ), СЂР°Р·РјРµСЂ, 
/*
    var geometry2 = new THREE.BoxGeometry( 100, 100, 100 );
    var mesh= new THREE.Mesh(geometry2, new THREE.MeshLambertMaterial({color: 0x00ff00}));
  */
    meshtext.position.set(50, 8, 120); // -set(0, 15, -120) // СЂР°СЃРїРѕР»РѕР¶РµРЅРёРµ РЅР° СЌРєСЂР°РЅРµ
    meshtext.rotation.set(0, -2.5, 0);
    meshtext.visible=true;
    scene.add(meshtext);
console.log("curVideoEl", mvideos[curVideoNum]);
    if(mvideos[curVideoNum].startvideo) {videos.setVideo(0); curVideoEl.play();}

    // The animation routine
var oldVideoTime=0;
// -------------------------------------------------------------------------- ANIMATE ----------------------------------------------
    function animate() {

	if(Math.trunc(oldVideoTime*10)<Math.trunc(curVideoEl.currentTime*10) ) sendMessage("cmd:currenttime;"+curVideoEl.currentTime); // 10 СЂР°Р· РІ СЃРµРєСѓРЅРґСѓ
//console.log(curVideoEl.currentTime);
	oldVideoTime=curVideoEl.currentTime;
//	if(curVideoEl.currentTime*10 - Math.trunc(curVideoEl.currentTime*10)==0) console.log(curVideoEl.currentTime);
//	sendMessage("cmd:currenttime;"+curVideoEl.currentTime);
	var sp=decodeURI(curVideoEl.src).split("/");
	var film_name= sp[sp.length-1];
	setText(curText+" "+curVideoEl.currentTime.toFixed(1)+" "+curVideoEl.duration+"  "+(numVideo+1)+"  "+film_name);

	if(curVideoEl.currentTime>=curVideoEl.duration ||
	   (playbackStop >0 && curVideoEl.currentTime>=playbackStop)) {
		if(!flagStopVideo) sendMessage("cmd:videoend;"); // РїРѕСЃС‹Р»Р°РµРј СЃРѕРѕР±С‰РµРЅРёРµ Рѕ РєРѕРЅС†Рµ РІРёРґРµРѕ РѕРґРёРЅ СЂР°Р·
		flagStopVideo = true;
//console.log("----------------------------- stop");
	}

//	if(!mvideos[curVideoNum].pause==true) 
//		if(curVideoEl.currentTime>=curVideoEl.duration || (mvideos[curVideoNum].stop >0 && curVideoEl.currentTime>=mvideos[curVideoNum].stop ) ) videos.next(); // Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РїРµСЂРµС…РѕРґРёС‚СЊ РЅР° РЅРѕРІРѕРµ РІРёРґРµРѕ. 
        var dt = clock.getDelta();
        var t  = clock.getElapsedTime();
//console.log(t);
//setTimes(t);

        if(RendererConfig.animationCallback) {
            RendererConfig.animationCallback(t, dt);
        }
        panoRender.render(scene);
        requestAnimationFrame( animate );
    }
    
    // The resize handler
    function onWindowResize() {
        var width  = canvas.clientWidth;
        var height = canvas.clientHeight;
        canvas.width  = width;
        canvas.height = height;
        panoRender.setSize(width, height);
        renderer.setViewport(0, 0, canvas.clientWidth, canvas.clientHeight);

        // Show canvas size while resizing
        const resizeInfoTime = 3000;
        if(!this.resizeInfo) {
            this.resizeInfo = document.createElement("div");
            this.resizeInfo.style.position = "absolute";
            this.resizeInfo.style.top      = "0px";
            this.resizeInfo.style.left     = "0px";
            this.resizeInfo.style.color    = "white";
            this.resizeInfo.innerText      = width + "x" + height;
            document.body.appendChild(this.resizeInfo);
        }
        function checkStillResizing() {
            if(this.stillResizing) {
                this.stillResizing = false;
                window.setTimeout(checkStillResizing, resizeInfoTime);
            } else {
                this.resizeInfo.style.display = "none";
            }
        }
        if(!this.stillResizing) {
            window.setTimeout(checkStillResizing, resizeInfoTime);
            this.resizeInfo.style.display = "block";
        }
        this.stillResizing            = true;
        this.resizeInfo.innerText     = width + " x " + height;
    }
    window.addEventListener( 'resize', onWindowResize, false );
    
    // Begin the animation
    animate();
    onWindowResize();
}

if(window.onRendererReady) {
    window.onRendererReady();
}

function keyup(e) {
	firstPress=0;
}

function translitRuEn(str){ var magic = function(lit){ var arrayLits = [ ["Р°","a"], ["Р±","b"], ["РІ","v"], ["Рі","g"], ["Рґ","d"], ["Рµ","e"], ["С‘","yo"], ["Р¶","zh"], ["Р·","z"], ["Рё","i"], ["Р№","j"], ["Рє","k"], ["Р»","l"], ["Рј","m"], ["РЅ","n"], ["Рѕ","o"], ["Рї","p"], ["СЂ","r"], ["СЃ","s"], ["С‚","t"], ["Сѓ","u"], ["С„","f"], ["С…","h"], ["С†","c"], ["С‡","ch"], ["С€","w"], ["С‰","shh"], ["СЉ","''"], ["С‹","y"], ["СЊ","'"], ["СЌ","e"], ["СЋ","yu"], ["СЏ","ya"], ["Рђ","A"], ["Р‘","B"], ["Р’","V"], ["Р“","G"], ["Р”","D"], ["Р•","E"], ["РЃ","YO"], ["Р–","ZH"], ["Р—","Z"], ["Р","I"], ["Р™","J"], ["Рљ","K"], ["Р›","L"], ["Рњ","M"], ["Рќ","N"], ["Рћ","O"], ["Рџ","P"], ["Р ","R"], ["РЎ","S"], ["Рў","T"], ["РЈ","U"], ["Р¤","F"], ["РҐ","H"], ["Р¦","C"], ["Р§","CH"], ["РЁ","W"], ["Р©","SHH"], ["РЄ",""], ["Р«","Y"], ["Р¬",""], ["Р­","E"], ["Р®","YU"], ["РЇ","YA"], ["0","0"], ["1","1"], ["2","2"], ["3","3"], ["4","4"], ["5","5"], ["6","6"], ["7","7"], ["8","8"], ["9","9"], ["a", "a"], ["b", "b"], ["c", "c"], ["d", "d"], ["e", "e"], ["f", "f"], ["g", "g"], ["h", "h"], ["i", "i"], ["j", "j"], ["k", "k"], ["l", "l"], ["m", "m"], ["n", "n"], ["o", "o"], ["p", "p"], ["q", "q"], ["r", "r"], ["s", "s"], ["t", "t"], ["u", "u"], ["v", "v"], ["w", "w"], ["x", "x"], ["y", "y"], ["z", "z"], ["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"], ["E", "E"], ["F", "F"], ["G", "G"], ["H", "H"], ["I", "I"], ["J", "J"], ["K", "K"], ["L", "L"], ["M", "M"], ["N", "N"], ["O", "O"], ["P", "P"], ["Q", "Q"], ["R", "R"], ["S", "S"], ["T", "T"], ["U", "U"], ["V", "V"], ["W", "W"], ["X", "X"], ["Y", "Y"], ["Z", "Z"] ]; var efim360ru = arrayLits.map(i=>{if (i[0]===lit){return i[1]}else{return undefined}}).filter(i=>i!=undefined); if (efim360ru.length>0){return efim360ru[0]} else{return "-"} }; return Array.from(str).map(i=>magic(i)).join("") }

//var stepMove=0.05;
var stepMove=0.005;
var firstPress=0;

function validateFile(file) {

    var video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = function() {
        window.URL.revokeObjectURL(video.src);
        if (video.duration < 1) {
            console.log("Invalid Video! video is less than 1 second");
            return;
        }
	sendMessage("cmd:validateFile; "+video.duration); 
    }
    video.src = file;
}

function videoInfo(str) { 
console.log(str);

//		if(str.trim().length==0) continue;
		var beginUrl=str.indexOf("/"); 			// beginUrl СѓРєР°Р·С‹РІР°РµС‚ РЅР° РїСѓС‚СЊ РґРѕ РІРёРґРµРѕ
		var url=str.substring(beginUrl); 		// /videoFulldome/otob/helix_3d__.webm"
/*
	var vd=document.getElementById("video_1");
	vd.src=url;
	vd.load();
	console.log("newvideo: ", decodeURIComponent(vd.src));
	vtexture.image=vd;
	vtexture.needsUpdate=true;
	vd.play(); // Р—Р°РїСѓСЃС‚РёРј "РЅРѕРІРѕРµ" РІРёРґРµРѕ
*/
 validateFile(url);
} 


async function playVideo(url, type, mute, start) {
  try {
	var vd=document.getElementById("video_0");
	vd.src=url;
	vd.muted=mute;
	vd.load();
	if (vd.readyState < 1) {
		await new Promise(function(resolve, reject) {
			vd.addEventListener("loadedmetadata", resolve, {once: true});
			vd.addEventListener("error", reject, {once: true});
		});
	}
	vd.currentTime = Number(start) || 0;

	console.log("playVideo(), url: ", decodeURIComponent(vd.src));
	vtexture.image=vd;
	vtexture.needsUpdate=true;
	curVideoEl=vd;
    await vd.play();
  
	vd.style.opacity = 1; 
	var visiblevideo="";
	if(type && type.length>0) visiblevideo=type;
	if(visiblevideo=="videoFulldome") videoPlane.visible=true; else videoPlane.visible=false;
	if(visiblevideo=="video360")      video360.visible=true; else video360.visible=false;
	console.log("playVideo(), type: "+visiblevideo);
	sendMessage("cmd:videoinfo;"+curVideoEl.duration); 

  } catch (err) {
	console.log("error playVideo");
  }
}

// РґР»СЏ СѓРґР°Р»РµРЅРЅРѕРіРѕ СѓРїСЂР°РІР»РµРЅРёСЏ
function videoNext(str) { 
console.log("videoNext: "+str);

videoPlane.visible=false;
video360.visible=false;    

		var item = parsePlaylistLine(str);
		if (!item) {
			console.error("Некорректная строка плейлиста:", str);
			sendMessage("cmd:error;Некорректная строка плейлиста");
			return;
		}
		var url=item.url;
		var ts=[item.start, item.stop, item.x, item.y, item.flags];
		playbackStop = item.stop;

	var mute=false; // РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ, Р·РІСѓРє РІРєР»СЋС‡РµРЅ
	var type=url.split("/")[1]; // videofulldome || video360
	var newurl=url;
	if(!type) {console.log("no /"); type=""}  // url РІРёРґРµ РЅРµ РЅР°С‡РёРЅР°РµС‚СЃСЏ СЃ "/" - С‚.Рµ. РѕС€РёР±РєР° РІ РїР»РµР№Р»РёСЃС‚Рµ
	else if(type.indexOf("videoFulldome") < 0 && type.indexOf("video360") < 0) {
		console.log("no videoFulldome"); 
		type="";  // РІРёРґРµРѕ Р»РµР¶Р°С‚ РІ РґСЂСѓРіРёС… РїР°РїРєР°С…, РЅР°РїСЂРёРјРµСЂ /video. РўРѕРіРґР° РІ РїР»РµР№Р»РёСЃС‚Рµ РЅСѓР¶РЅРѕ СѓРєР°Р·С‹РІР°С‚СЊ С‚РёРї ("f", "o")
	}
	var h=0;
	var n=0; // nearer - Р±Р»РёР¶Рµ, РґР°Р»СЊС€Рµ
	params=ts[4];
	if(params!=undefined && params.length>0) {
		if(params.indexOf("m")>=0) mute=true; // РІС‹РєР»СЋС‡РёС‚СЊ Р·РІСѓРє РІРёРґРµРѕ
		if(params.indexOf("f")>=0) type="videoFulldome"; 
		if(params.indexOf("o")>=0) type="video360"; // 
		if(params.indexOf("h")>=0) {h=parseInt(params.substring(params.indexOf("h")+1), 10)}; // 
		if(params.indexOf("n")>=0) {n=parseInt(params.substring(params.indexOf("n")+1), 10)}; // 
	}
	console.log("type: ", type, "h: ", h, "n: ", n);

	
	var x=ts[2];
	var y=ts[3];
	if(type=="videoFulldome") {
		videoPlane.rotation.z=parseInt(x, 10)*Math.PI/180;
		videoPlane.rotation.x=0;
		videoPlane.rotation.y=0;
	} else 	if(type=="video360")      {
		video360.rotation.y=parseInt(x, 10)*Math.PI/180;
		video360.rotation.x=0;
		video360.rotation.z=0;
		g360.rotation.x=parseInt(y, 10)*Math.PI/180;
		g360.position.set(0,parseInt(h, 10),parseInt(n));
	} else { 
		videoPlane.rotation.set(0,0,0); video360.rotation.set(0,0,0); 
		type="video360"; // !!! РґРµР»Р°РµРј РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ. Р•СЃР»Рё РЅРµ РґРµР»Р°С‚СЊ, С‚Рѕ РЅРµ РїРѕРєР°Р·С‹РІР°РµС‚ РІРёРґРµРѕ РІ РєРѕСЂРЅРµ
	}

	playVideo(url, type, mute, item.start);

	flagStopVideo = false;

} 

function setBeginTime(time) {
	var value = Number(time);
	if (!Number.isFinite(value) || value < 0) return;
	if (mvideos[curVideoNum]) mvideos[curVideoNum].start = value;
	curVideoEl.currentTime = value;
}
function setEndTime(time) {
	var value = Number(time);
	if (!Number.isFinite(value) || value < 0) return;
	playbackStop = value;
	if (mvideos[curVideoNum]) mvideos[curVideoNum].stop = value;
}
function setCurTime(time) {
	var value = Number(time);
	if (Number.isFinite(value) && value >= 0) curVideoEl.currentTime=value;
}
function setRotate360(deg) {	
console.log(visiblevideo+" "+deg);
 var rad=deg* Math.PI / 180.0;
		if(visiblevideo=="videoFulldome") {videoPlane.rotation.z=rad; curText=" "+(videoPlane.rotation.z/Math.PI*180).toFixed(2); console.log(deg)} 
		if(visiblevideo=="video360") {video360.rotation.y=-rad; curText=" "+(video360.rotation.y/Math.PI*180).toFixed(2)+" "+(g360.rotation.x/Math.PI*180).toFixed(2);;}
}
function setRotateTangage(tangage) {	
 var rad=tangage* Math.PI / 180.0;
	 if(visiblevideo=="video360") {g360.rotation.x=rad; curText= " "+(video360.rotation.y/Math.PI*180).toFixed(1)+" "+(g360.rotation.x/Math.PI*180).toFixed(2);}
}

function setRotateUp(y) {	
	g360.position.y=y;
}

function setRotateFB(z) {	
	g360.position.z=z;
}

function setVideo360(flag_360) {
	if(flag_360 === true || flag_360 === "true")  	{visiblevideo="video360"; 	video360.visible=true;	videoPlane.visible=false; }
	else 	 		{visiblevideo="videoFulldome"; 	video360.visible=false;	videoPlane.visible=true; }
}

function play() {   curVideoEl.play(); }
function pause() {   curVideoEl.pause(); }
function stop() {   curVideoEl.pause(); curVideoEl.currentTime=0;}

function nextSlide(e) {
   if(!e.shiftKey && e.code.indexOf("Digit")==0) {stepMove=parseInt(e.code.substring(5, 6), 10)/1000*2+0.001; console.log(stepMove)}

   if(e.code=="Space") {if(!curVideoEl.paused) curVideoEl.pause(); else curVideoEl.play(); sendMessage("cmd:videoend;"); } // !!! С‚РµСЃС‚РѕРІРѕРµ sendMessage
   if(e.code=="PageDown") { videos.next(); curVideoEl.play(); numVideo++;}
   if(e.code=="PageUp")   {  videos.prev(); curVideoEl.play();if(numVideo>0) numVideo--;}
   if(e.code=="KeyS") {  if(meshtext.visible==false) {meshtext.visible=true; } else {  meshtext.visible=false;}}
   if(e.code=="KeyB") {  if(box5.visible==false) {box5.visible=true; } else {  box5.visible=false;}}
   if(e.code=='KeyH') {
	if(video360.visible) {video360.visible=false;	videoPlane.visible=true; }
	else  {video360.visible=true;	videoPlane.visible=false; }
  }
   if(e.shiftKey) {
	if(e.code.indexOf("Digit")==0) {
//console.log(parseInt(e.code.substring(5, 6), 10));
		videos.setVideo(parseInt(e.code.substring(5, 6), 10));
		curVideoEl.play();
	}
	if(e.code=='ArrowLeft') { if(firstPress>0)  {
		if(visiblevideo=="videoFulldome") {videoPlane.rotation.z+=stepMove; curText=" "+(videoPlane.rotation.z/Math.PI*180).toFixed(2);} 
		if(visiblevideo=="video360") {video360.rotation.y-=stepMove; curText=" "+(video360.rotation.y/Math.PI*180).toFixed(2)+" "+(g360.rotation.x/Math.PI*180).toFixed(2);;}
	  } 
	  firstPress=1;
	}
	if(e.code=='ArrowRight') { if(firstPress>0) {
		if(visiblevideo=="videoFulldome") {videoPlane.rotation.z-=stepMove;curText= " "+(videoPlane.rotation.z/Math.PI*180).toFixed(2);} 
		if(visiblevideo=="video360") {video360.rotation.y+=stepMove; curText=" "+(video360.rotation.y/Math.PI*180).toFixed(2)+" "+(g360.rotation.x/Math.PI*180).toFixed(2);;}
	  }
	  firstPress=1;
	}
	   if(e.code=='ArrowUp')    { if(visiblevideo=="video360") {g360.rotation.x-=stepMove; curText= " "+(video360.rotation.y/Math.PI*180).toFixed(1)+" "+(g360.rotation.x/Math.PI*180).toFixed(2);}}
	   if(e.code=='ArrowDown')  { if(visiblevideo=="video360") {g360.rotation.x+=stepMove;} curText=" "+ (video360.rotation.y/Math.PI*180).toFixed(1)+" "+(g360.rotation.x/Math.PI*180).toFixed(1);}
	   if(e.code=='KeyN') g360.position.z-=10; // Р±Р»РёР¶Рµ 
   } else {
	   if(e.code=='ArrowLeft') { if(curVideoEl.currentTime>5) curVideoEl.currentTime-=5; }
	   if(e.code=='ArrowRight') { if((curVideoEl.currentTime+5)<curVideoEl.duration) curVideoEl.currentTime+=5;}
	   if(e.code=='KeyN') g360.position.z+=10; // РґР°Р»СЊС€Рµ
   }
   if(e.code=="KeyC") copyToClipboard(curText+" "+curVideoEl.currentTime.toFixed(1));
   if(e.code=="KeyW") copyToClipboard(getHTML(curText, curVideoEl.currentTime.toFixed(1)), curVideoEl.url);
   if(e.code=="NumpadAdd") g360.position.y+=10; // +
   if(e.code=="NumpadSubtract") g360.position.y-=10; // -


//console.log(e.code);   
}
//  7.3 , time; undefined -102.86 , time; 60.00  -5.7 , time; -2.86
function getHTML(txt, time) {
console.log(curText);
	var params=txt.split(" ");
	var rotx=params[1];
	var roty=params[2];
	var sout="";
	var url=curVideoEl.src.substring(curVideoEl.src.lastIndexOf("/")+1);
//	console.log("РІРёРґРµРѕ! "+url);
	url=url.substring(0, url.lastIndexOf("."));
	url=translitRuEn(url);
//	console.log(url);
	sout+="\t<a-entity rotation='"+rotx+" 0 0'>\n";
	sout+="\t\t<a-videosphere id='av360_"+url+"' src='#v360_"+url+"' rotation='0 "+roty+" 0' video360 mixin='videomix' autoplay='false'></a-videosphere>\n";
	sout+="\t</a-entity>\n";
	return sout;
}


// ffmpeg -i in.mov  -c:a libvorbis -ac 1 -b:a 96k -ar 48000 -b:v 1100k -maxrate 1100k -bufsize 1835k -threads 8 -vf scale=-1:2048 out.webm
// ffmpeg -i xxx.mp4 -c:v libvpx   -quality good -cpu-used 0 -b:v 7000k -qmin 10 -qmax 42 -maxrate 500k -bufsize 1500k -threads 8 -vf scale=-1:1080 -c:a libvorbis -b:a 192k -f webm xxx.webm

function copyToClipboard(txt) {
//	txt=txt.replaceAll(" ", ",");
	var params=txt.split(" ");
	txt=params[3]+", 0, "+params[1]+", "+params[2]+",";
//console.log(txt);
      // create hidden text element, if it doesn't already exist
    var targetId = "_hiddenCopyText_";
        // must use a temporary form element for the selection and copy
    target = document.getElementById(targetId);
    if (!target) {
            var target = document.createElement("textarea");
            target.style.position = "absolute";
            target.style.left = "-9999px";
            target.style.top = "0";
            target.id = targetId;
            document.body.appendChild(target);
    }
    target.textContent = txt;
    
    // select the content
    var currentFocus = document.activeElement;
    target.focus();
    target.setSelectionRange(0, target.value.length);

    // copy the selection
    var succeed;
    try {
          succeed = document.execCommand("copy");
    } catch(e) {
        succeed = false;
    }

    // restore original focus
    if (currentFocus && typeof currentFocus.focus === "function") {
        currentFocus.focus();
    }
     
    target.remove(); 
//  -2.86 9.2 -2.86 0.00 -2.86 0.00 -2.9 -2.86 -2.9 -2.86

    return succeed;
}

function dcText(txt, hWorldTxt, hWorldAll, hPxTxt, fgcolor, bgcolor) { // the routine
  // txt is the text.
  // hWorldTxt is world height of text in the plane.
  // hWorldAll is world height of whole rectangle containing the text.
  // hPxTxt is px height of text in the texture canvas; larger gives sharper text.
  // The plane and texture canvas are created wide enough to hold the text.
  // And wider if hWorldAll/hWorldTxt > 1 which indicates padding is desired.
  var kPxToWorld = hWorldTxt/hPxTxt;                // Px to World multplication factor
  // hWorldTxt, hWorldAll, and hPxTxt are given; get hPxAll
  var hPxAll = Math.ceil(hWorldAll/kPxToWorld);     // hPxAll: height of the whole texture canvas
  // create the canvas for the texture

  var txtcanvas = document.createElement("canvas"); // create the canvas for the texture
  var ctx = txtcanvas.getContext("2d");
  ctx.font = hPxTxt + "px sans-serif";        
  // now get the widths
  var wPxTxt = ctx.measureText(txt).width;         // wPxTxt: width of the text in the texture canvas
  var wWorldTxt = wPxTxt*kPxToWorld;               // wWorldTxt: world width of text in the plane
  var wWorldAll = wWorldTxt+(hWorldAll-hWorldTxt); // wWorldAll: world width of the whole plane
  var wPxAll = Math.ceil(wWorldAll/kPxToWorld);    // wPxAll: width of the whole texture canvas
  // next, resize the texture canvas and fill the text
  txtcanvas.width =  wPxAll;
  txtcanvas.height = hPxAll;
  if (bgcolor != undefined) { // fill background if desired (transparent if none)
    ctx.fillStyle = "#" + bgcolor.toString(16).padStart(6, '0');
    ctx.fillRect( 0,0, wPxAll,hPxAll);
  } 
  ctx.textAlign = "left";
  ctx.textBaseline = "middle"; 
  ctx.fillStyle = "#" + fgcolor.toString(16).padStart(6, '0'); // fgcolor
  ctx.font = hPxTxt + "px sans-serif";   // needed after resize
  ctx.fillText(txt, wPxAll/2, hPxAll/2); // the deed is done
  // next, make the texture
  var texture = new THREE.Texture(txtcanvas); // now make texture

  texture.minFilter = THREE.LinearFilter;     // eliminate console message
  texture.needsUpdate = true;                 // duh
  // and make the world plane with the texture
  geometry = new THREE.PlaneGeometry(wWorldAll, hWorldAll);
  var material = new THREE.MeshBasicMaterial( 
    { side:THREE.DoubleSide, map:texture, transparent:true, opacity:1.0 } );
  // and finally, the mesh
  var mesh = new THREE.Mesh(geometry, material);

  mesh.wWorldTxt = wWorldTxt; // return the width of the text in the plane
  mesh.wWorldAll = wWorldAll; //    and the width of the whole plane
  mesh.wPxTxt = wPxTxt;       //    and the width of the text in the texture canvas
                              // (the heights of the above items are known)
  mesh.wPxAll = wPxAll;       //    and the width of the whole texture canvas
  mesh.hPxAll = hPxAll;       //    and the height of the whole texture canvas
  mesh.ctx = ctx;             //    and the 2d texture context, for any glitter
  // console.log(wPxTxt, hPxTxt, wPxAll, hPxAll);
  // console.log(wWorldTxt, hWorldTxt, wWorldAll, hWorldAll);


  return mesh;

}

function setText(txt) {
  var mesh=meshtext;
  mesh.ctx.fillStyle = "#000000"; 
//  mesh.ctx.fillRect(mesh.wPxAll*.7, mesh.hPxAll*.1, mesh.wPxAll*.2, mesh.hPxAll*.8);
  mesh.ctx.fillRect(0,0,800,200);
  mesh.ctx.fillStyle = "#ffffff"; 
  mesh.material.map.needsUpdate = true;
  mesh.ctx.fillText(txt,5,10); // СЂР°СЃРїРѕР»РѕР¶РµРЅРёРµ С‚РµРєСЃС‚Р° РЅР° С„РѕРЅРµ
}
