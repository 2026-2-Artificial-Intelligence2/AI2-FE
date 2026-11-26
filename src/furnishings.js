import * as THREE from 'three';
import {box, oval} from './character.js';

function painted(width,height,paint) {
  const canvas=document.createElement('canvas');
  canvas.width=width; canvas.height=height;
  paint(canvas.getContext('2d'),width,height);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  return new THREE.MeshBasicMaterial({map:texture});
}

function panel(parent,x,y,z,w,h,material,face=1) {
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);
  mesh.position.set(x,y,z);
  mesh.rotation.y=face===1?0:Math.PI;
  parent.add(mesh);
  return mesh;
}

function officeScreen(chart) {
  return painted(512,288,(c,w,h)=>{
    c.fillStyle='#eff2f1';c.fillRect(0,0,w,h);
    c.fillStyle=chart?'#35425b':'#27675d';c.fillRect(0,0,w,34);
    c.fillStyle='#ffffff';c.font='bold 16px sans-serif';
    c.fillText(chart?'분기 실적 보고':'매출 집계표',15,23);
    c.fillStyle='#cbd7d3';c.fillRect(0,34,w,21);
    if(chart){
      for(let i=0;i<9;i++){const n=[42,52,41,68,73,61,86,101,112][i];c.fillStyle=i%2?'#789ea5':'#456876';c.fillRect(46+i*48,228-n,25,n);}
    }else{
      for(let i=0;i<8;i++)for(let j=0;j<5;j++){
        const x=15+j*100,y=64+i*26;
        c.fillStyle=i%2?'#e1eae6':'#f7f9f8';c.fillRect(x,y,96,23);
        c.fillStyle='#667e79';c.font='12px sans-serif';c.fillText(j===0?'영업 '+(i+1)+'팀':String((i+2)*(j+3)*1750),x+4,y+16);
      }
    }
  });
}

export function furnish(scene) {
  const screens=[officeScreen(false),officeScreen(true)];
  const skyline=painted(1024,320,(c,w,h)=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#bbd8e4');g.addColorStop(1,'#ffddd0');
    c.fillStyle=g;c.fillRect(0,0,w,h);
    for(let layer=0;layer<2;layer++)for(let i=0;i<26;i++){
      const x=i*49-layer*23,y=110+layer*60+Math.sin(i*5.4+layer)*48;
      c.fillStyle=layer?'#b9b5c2':'#d5c6ca';c.fillRect(x,y,36+(i%3)*7,h-y);
      c.fillStyle=layer?'#bcc9c8':'#d1d7d5';
      for(let a=5;a<34;a+=10)for(let b=y+10;b<h;b+=15)c.fillRect(x+a,b,4,7);
    }
  });
  for(const z of [-5.5,5.5]){
    const face=-Math.sign(z);
    for(const x of [-4,0,4,8]){
      box(scene,[3.35,1.82,0.12],[x,2.02,z+face*0.095],0x657777);
      panel(scene,x,2.02,z+face*0.162,3.22,1.69,skyline,face);
      for(const dx of [-0.81,0,0.81])box(scene,[0.034,1.68,0.04],[x+dx,2.02,z+face*0.18],0xe4dfd2);
      box(scene,[3.55,0.065,0.28],[x,1.14,z+face*0.17],0xd1b898);
      for(let i=0;i<3;i++)box(scene,[3.25,0.036,0.07],[x,2.8-i*0.08,z+face*0.2],0xf4ead8);
    }
    box(scene,[17.8,0.11,0.14],[2,0.06,z+face*0.1],0x829492);
  }
  box(scene,[0.14,3.65,11],[10.9,1.82,0],0xd2d9d2).castShadow=false;
  box(scene,[18,0.12,11],[2,3.66,0],0xe8e4d9).castShadow=false;
  for(const x of [-3,1,5,9])for(const z of [-2.6,2.6]){
    box(scene,[2.1,0.05,0.37],[x,3.54,z],0xb6c0b9);
    box(scene,[1.96,0.055,0.29],[x,3.51,z],0xfff6de);
  }
  for(const [x,z] of [[-4,4],[-4,-4],[8,4],[8,-4]]){
    oval(scene,[0.24,0.28,0.24],[x,0.24,z],0xac7960);
    box(scene,[0.035,0.83,0.035],[x,0.74,z],0x73684d);
    for(let i=0;i<9;i++){
      const angle=i*2.4,leaf=oval(scene,[0.115,0.29,0.065],[x+0.17*Math.cos(angle),0.84+i*0.045,z+0.17*Math.sin(angle)],i%2?0x537e67:0x71936a);
      leaf.rotation.set(Math.sin(angle)*0.65,angle,Math.cos(angle)*0.65);
    }
  }
  return function dressDesk(x,z,i){
    const f=-Math.sign(z),dz=z+0.65*f;
    panel(scene,x,1.1,dz-f*0.048,0.596,0.315,screens[i%2],-f);
    for(let j=0;j<4;j++)box(scene,[0.385,0.006,0.014],[x,0.837,dz-f*(0.225+j*0.026)],0x8a9798);
    oval(scene,[0.034,0.018,0.053],[x+0.31,0.825,dz-f*0.28],0x58666b);
    if (i%2===0) {
      // A bear-shaped memo clip sits beside the keyboard, facing the seat.
      const clip=new THREE.Group();
      clip.position.set(x-0.44,0.89,dz-f*0.19);
      clip.rotation.y=f===1?Math.PI:0;
      scene.add(clip);
      oval(clip,[0.076,0.067,0.04],[0,0,0],0xd9a576);
      for (const side of [-1,1]) {
        oval(clip,[0.028,0.028,0.023],[side*0.052,0.047,0],0xd9a576);
        oval(clip,[0.005,0.006,0.004],[side*0.027,0.006,0.038],0x594138);
      }
      oval(clip,[0.024,0.017,0.012],[0,-0.012,0.038],0xf0cfab);
      oval(clip,[0.008,0.006,0.005],[0,-0.008,0.05],0x594138);
    }
    box(scene,[0.37,0.015,0.28],[x-0.56,0.816,dz],0xf1eddd).rotation.y=0.13;
    oval(scene,[0.053,0.069,0.053],[x+0.56,0.864,dz],i%2?0xb6876a:0x688c91);
    oval(scene,[0.044,0.007,0.044],[x+0.56,0.929,dz],0x52423a);
    box(scene,[0.49,0.36,0.067],[x,0.73,z-f*0.2],0x83a4a3);
    box(scene,[0.09,0.32,0.09],[x,0.24,z],0x647479);
    for(const angle of [0,Math.PI/2]){
      box(scene,[0.53,0.046,0.063],[x,0.072,z],0x454f53).rotation.y=angle;
    }
  };
}
