import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collect, collectOnce, getPage, main } from './collect.mjs';
const page = (codes, currentPage=0, totalResults=codes.length, totalPages=1) => ({products: codes.map(code=>({code,name:code})),pagination:{currentPage,totalResults,totalPages}});
const noWait = async()=>{};
test('duplicate pages trigger a fresh complete attempt with another ordering', async()=>{
 const calls=[];
 const result=await collect('test',{wait:noWait,warn(){},pageReader:async(c,p,s)=>{
  calls.push([p,s]);return page(s==='name-asc'?['a','a']:['a','b']);
 }});
 assert.equal(result.total,2);assert.deepEqual(result.products.map(p=>p.code),['a','b']);
 assert.deepEqual(calls,[[0,'name-asc'],[0,'name-desc']]);
});
test('changed totals and incomplete unique sets are rejected',async()=>{
 await assert.rejects(collectOnce('test','name-asc',{pageReader:async(c,p)=>page(['a'],p,p===0?2:3,2)}),/Source changed/);
 await assert.rejects(collectOnce('test','name-asc',{pageReader:async()=>page(['a'],0,2)}),/Incomplete/);
});
test('exhausted retries preserve old data and checkedAt',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'costco-test-'));const previous='{"checkedAt":"old","sources":{}}';
 try {
  await writeFile(join(dir,'snapshot.json'),previous);let attempts=0;
  await assert.rejects(main({outputDir:dir,collector:c=>collect(c,{wait:noWait,warn(){},pageReader:async()=>{attempts++;return page(['a','a']);}})}),/previous snapshot retained/);
  assert.equal(attempts,4);assert.equal(await readFile(join(dir,'snapshot.json'),'utf8'),previous);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('transient HTTP failure retries without weakening validation',async()=>{
 let n=0;const result=await getPage('test',0,'name-asc',{wait:noWait,fetchPage:async()=>++n===1?{ok:false,status:503}:{ok:true,json:async()=>page(['a'])}});
 assert.equal(n,2);assert.equal(result.products[0].code,'a');
});
test('ended seasonal campaign may be empty, main catalog may not',async()=>{
 const pageReader=async()=>page([],0,0,0);
 assert.equal((await collectOnce('FY-ended','name-asc',{pageReader})).total,0);
 await assert.rejects(collectOnce('SpecialPriceOffers','name-asc',{pageReader}),/Empty/);
});
