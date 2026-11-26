import * as THREE from 'three';
import {box, character} from './character.js';
import {furnish} from './furnishings.js';
import {turnListener} from './spatial-audio.js';
import {addMeetingWindow} from './office-meeting-window.js';

const seats = [[-1,-1],[1,-1],[-1,1],[1,1],[5,-1],[7,-1],[5,1],[7,1]];
const colors = [0x89a8ce,0xe4a39e,0x8abdad,0xdfb181,0xab9fc1,0xe6b3a2,0x87b4bb,0xb895ba];
let scene, camera, renderer, boss, latest, canvas, dialog, meetingWindow;
let yaw=0, pitch=0, previousX, previousY, self=-1;
const workers=[];
let participants=[];
let width=0, height=0;
export function setOfficePlayers(players) { participants = players; }

function init() {
  renderer = new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e5da);
  camera = new THREE.PerspectiveCamera(68,1,0.06,45);
  camera.rotation.order='YXZ';
  scene.add(new THREE.HemisphereLight(0xfff4df,0xb7b5c2,2.3));
  const sun=new THREE.DirectionalLight(0xffecd3,1.8);
  sun.position.set(-4,7,4);
  sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-11,right:11,top:7,bottom:-7,far:32});
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.intensity=0.60;
  sun.shadow.normalBias=0.022;
  scene.add(sun);
  box(scene,[18,0.1,12],[2,-0.05,0],0xb1c2bc);
  for (const z of [-5.5,5.5]) {
    box(scene,[18,3.6,0.15],[2,1.8,z],0xe2ddcf).castShadow=false;
  }
  const dressDesk=furnish(scene);
  meetingWindow=addMeetingWindow(scene);
  for (const [i,[x,z]] of seats.entries()) {
    const forward=-Math.sign(z);
    const deskZ=z+0.65*forward;
    box(scene,[1.84,0.085,0.93],[x,0.76,deskZ],0xe1bd9e);
    for(const dx of [-0.79,0.79]) box(scene,[0.09,0.74,0.7],[x+dx,0.37,deskZ],0x789192);
    box(scene,[0.08,0.21,0.1],[x,0.88,deskZ],0x474b4c);
    box(scene,[0.65,0.37,0.05],[x,1.1,deskZ],0x647781);
    box(scene,[0.6,0.32,0.02],[x,1.1,deskZ-forward*0.035],0x9bbec1);
    box(scene,[0.43,0.025,0.15],[x,0.82,deskZ-forward*0.28],0x596566);
    box(scene,[0.52,0.09,0.46],[x,0.43,z],0x89a3a2);
    dressDesk(x,z,i);
    const person=character({topColor:colors[i],skin:[0xf0c5a7,0xe4b098,0xca9278][i%3],hairColor:[0x57434b,0x815a4d,0x473847][i%3],hairId:['short','crop','bun'][i%3],accessoryId:i%3?'none':'glasses'});
    person.root.position.set(x,0,z);
    person.root.rotation.y=forward===1?0:Math.PI;
    workers.push(person);scene.add(person.root);
  }
  boss=character({topId:'jacket',topColor:0x34464d,accessoryId:'glasses'},false);
  scene.add(boss.root);
}

export function updateOffice(context) {
  latest=context;
}

function draw(now) {
  if (!latest) return;
  const {packet, beatStarted, meetingStarts, seatLabels, youLabel} = latest;
  const {step,walking} = packet;
  const meetingStarted = meetingStarts.values().next().value;
  meetingWindow.update(meetingStarted, now);
  const {position,forwardZ}=step.listener;
  self=seats.findIndex(([x,z])=>position.x===x && position.z===z);
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if (w && h && (w!==width || h!==height)) {
    width=w; height=h;
    renderer.setSize(w,h,false);
    camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  camera.position.set(position.x,1.4,position.z);
  camera.rotation.set(pitch,(forwardZ===1?Math.PI:0)+yaw,0,'YXZ');
  // Room membership can shrink after the match begins. Use the original seat order.
  const knowSeats = self >= 0 && youLabel && seatLabels[self] === youLabel;
  workers.forEach((person,i)=>{
    person.root.visible=i!==self && !(knowSeats && meetingStarts.has(seatLabels[i]));
    person.pose(now/1000+i*1.23+(i<participants.length?0:2),false);
  });
  const t=walking?Math.min(1,(now-beatStarted)/2000):1;
  boss.root.position.set(THREE.MathUtils.lerp(step.from.x,step.to.x,t),0,THREE.MathUtils.lerp(step.from.z,step.to.z,t));
  if (walking) boss.root.rotation.y=Math.atan2(step.to.x-step.from.x,step.to.z-step.from.z);
  // Until the server publishes actual boss presence, avoid showing a stationary boss during lunch.
  boss.root.visible=meetingStarted === undefined &&
    (walking || !(packet.lunchStartsInSeconds<=0 && packet.lunchEndsInSeconds>0));
  boss.pose(now/1000,walking && t<1);
  renderer.render(scene,camera);
}

export function openOffice() {
  if (!dialog) setupControls();
  if (!renderer) init();
  yaw=0; pitch=0;
  dialog.showModal();
  renderer.setAnimationLoop(draw);
}

function setupControls() {
  canvas=document.querySelector('#officeCanvas');
  dialog=document.querySelector('#office');
  document.querySelector('#back').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{renderer?.setAnimationLoop(null);turnListener(0);previousX=undefined;});
  canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);previousX=e.clientX;previousY=e.clientY;};
  canvas.onpointermove=e=>{
    if(previousX===undefined)return;
    yaw=THREE.MathUtils.clamp(yaw-(e.clientX-previousX)*0.007,-2.35,2.35);
    pitch=THREE.MathUtils.clamp(pitch-(e.clientY-previousY)*0.006,-0.7,0.65);
    previousX=e.clientX;previousY=e.clientY;turnListener(yaw);
  };
  canvas.onlostpointercapture=()=>{previousX=undefined;};
}
export function closeOffice() {
  renderer?.setAnimationLoop(null);
  if (dialog?.open) dialog.close();
  latest=null;
}
