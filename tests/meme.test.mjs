import test from 'node:test';
import assert from 'node:assert/strict';
import { featureWindows, featureOpacity, inkTone, makeFeatureLayer, composeMeme, DEFAULT_ADJUSTMENTS, featureAnchors, MEME_TARGETS, featureOwner } from '../app/meme/processing.ts';

function facePoints() {
  const points = Array.from({length:478},()=>({x:.5,y:.5}));
  const set = (indices,left,right,top,bottom) => indices.forEach((id,index) => { points[id] = {x:index%2 ? left : right,y:index%3 ? top : bottom}; });
  set([33,133,159,145,70,63,105,66,107,55,46],.25,.36,.30,.42);
  set([263,362,386,374,336,296,334,293,300,285,276],.64,.75,.30,.42);
  set([168,6,197,195,5,4,1,19,94,2,98,327],.46,.54,.43,.60);
  set([61,291,0,17,13,14,37,267,84,314],.36,.64,.67,.78);
  return points;
}
function portrait() {
  const data = new Uint8ClampedArray(100*100*4);
  for(let i=0;i<data.length;i+=4) data.set([210,175,145,255],i);
  for(const [x,y] of [[30,36],[70,36],[50,72]]) {
    for(let dy=-2;dy<=2;dy++) for(let dx=-3;dx<=3;dx++) data.set([22,16,12,255],((y+dy)*100+x+dx)*4);
  }
  return {data,width:100,height:100};
}

test('meme extraction keeps only four feature areas and excludes hair, cheeks and background',()=>{
  const regions=featureWindows(facePoints());
  assert.equal(regions.length,4);
  for(const [x,y] of [[0,0],[.5,.05],[.05,.5],[.95,.5],[.5,.95]]) assert.equal(featureOpacity(x,y,regions),0);
  assert.ok(featureOpacity(.30,.36,regions)>.9);
  assert.ok(featureOpacity(.70,.36,regions)>.9);
  assert.ok(featureOpacity(.5,.72,regions)>.9);
});

test('missing landmarks produce a retry message instead of an empty meme',()=>{
  assert.throws(()=>featureWindows([]),/识别到完整五官/);
});

test('ink processing keeps highlights white and increases dark feature contrast',()=>{
  assert.equal(inkTone(240,20,200,1),255);
  assert.equal(inkTone(0,20,200,1),0);
  assert.ok(inkTone(110,20,200,1.7)<inkTone(110,20,200,.7));
  assert.ok(Number.isFinite(inkTone(150,150,150,1)));
});

test('generated face layer has grayscale features, transparent background and preserved facial detail',()=>{
  const {image,bounds}=makeFeatureLayer(portrait(),facePoints(),1.15);
  assert.equal(image.data[3],0);
  assert.equal(image.data[(5*100+50)*4+3],0);
  const eye=(36*100+30)*4;
  assert.ok(image.data[eye]<50);
  assert.equal(image.data[eye+3],255);
  for(let i=0;i<image.data.length;i+=4) {
    assert.equal(image.data[i],image.data[i+1]);
    assert.equal(image.data[i+1],image.data[i+2]);
  }
  assert.ok(bounds.x>0 && bounds.y>0);
  assert.ok(bounds.width<100 && bounds.height<100);
});

test('meme output preserves the supplied template and composites features within the head',()=>{
  const template={naturalWidth:1289,naturalHeight:1271};
  const calls=[];
  let output;
  const outputCtx={
    drawImage(...args){calls.push(['draw',...args]);},
    save(){},restore(){},beginPath(){},
    ellipse(...args){calls.push(['head',...args]);},clip(){calls.push(['clip']);},
  };
  const source={width:100,height:100,getContext:()=>({getImageData:portrait})};
  const previousDocument=globalThis.document;
  let count=0;
  globalThis.document={createElement:()=>++count===1 ? output={getContext:()=>outputCtx} : {getContext:()=>({putImageData(){}})}};
  try {
    const result=composeMeme(template,source,facePoints(),DEFAULT_ADJUSTMENTS);
    assert.equal(result,output);
    assert.equal(result.width,1289);
    assert.equal(result.height,1271);
    assert.deepEqual(calls[0],['draw',template,0,0]);
    assert.equal(outputCtx.globalCompositeOperation,'multiply');
    assert.ok(calls.findIndex(call=>call[0]==='clip')<calls.findLastIndex(call=>call[0]==='draw'));
  } finally {globalThis.document=previousDocument;}
});


test('each captured eye, nose and mouth lands on the exact anchor used by the translucent guide',()=>{
  const points=facePoints();
  const template={naturalWidth:1289,naturalHeight:1271};
  const draws=[];
  const outputCtx={drawImage(...args){draws.push(args);},save(){},restore(){},beginPath(){},ellipse(){},clip(){}};
  const source={width:100,height:100,getContext:()=>({getImageData:portrait})};
  const previousDocument=globalThis.document;
  let count=0;
  globalThis.document={createElement:()=>++count===1 ? {getContext:()=>outputCtx} : {getContext:()=>({putImageData(){}})}};
  try {
    const adjustments={...DEFAULT_ADJUSTMENTS,x:16,y:-11,scale:1.1};
    composeMeme(template,source,points,adjustments);
    const anchors=featureAnchors(points);
    const eyes=[0,1].sort((a,b)=>anchors[a].x-anchors[b].x);
    assert.equal(draws.length,5);
    [eyes[0],eyes[1],2,3].forEach((sourceIndex,index)=>{
      const [,sx,sy,sw,sh,dx,dy,dw,dh]=draws[index+1];
      const mappedX=dx+(anchors[sourceIndex].x*100-sx)*dw/sw;
      const mappedY=dy+(anchors[sourceIndex].y*100-sy)*dh/sh;
      assert.ok(Math.abs(mappedX-(MEME_TARGETS[index].x*1289+16))<.001);
      assert.ok(Math.abs(mappedY-(MEME_TARGETS[index].y*1271-11))<.001);
      assert.ok(Math.abs(dw/sw-dh/sh)<.001,'each feature must keep its proportions');
    });
  } finally {globalThis.document=previousDocument;}
});


test('overlapping feature masks never duplicate an eye into a second opening',()=>{
  const points=facePoints();
  const windows=featureWindows(points);
  const layers=[];
  const ctx={drawImage(){},save(){},restore(){},beginPath(){},ellipse(){},clip(){}};
  const source={width:100,height:100,getContext:()=>({getImageData:portrait})};
  const previousDocument=globalThis.document;
  let count=0;
  globalThis.document={createElement:()=>++count===1 ? {getContext:()=>ctx} : {getContext:()=>({putImageData(image){layers.push(new Uint8ClampedArray(image.data));}})}};
  try {
    composeMeme({naturalWidth:1289,naturalHeight:1271},source,points,DEFAULT_ADJUSTMENTS);
    const separate=layers.slice(-4);
    assert.equal(separate.length,4);
    for(let pixel=0;pixel<10000;pixel++) {
      assert.ok(separate.filter(layer=>layer[pixel*4+3]>0).length<=1,'a source pixel may only appear in one template opening');
    }
    assert.equal(featureOwner(.30,.36,windows),0);
    assert.equal(featureOwner(.70,.36,windows),1);
    assert.equal(separate.filter(layer=>layer[(36*100+30)*4+3]>0).length,1);
  } finally {globalThis.document=previousDocument;}
});
