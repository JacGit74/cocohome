import fs from 'node:fs/promises';
const {checkedAt,sources}=JSON.parse(await fs.readFile('output/snapshot.json','utf8'));
const map=new Map();
for(const [key,group] of Object.entries(sources)){for(const p of group.products){const label=key==='whatsnew'?'신상품':key==='SpecialPriceOffers'?'스페셜 할인':'회원 감사 행사';if(map.has(p.code)){const old=map.get(p.code);old.campaigns.push(label);if(key==='whatsnew')old.isNew=true;}else map.set(p.code,{...p,campaigns:[label],isNew:key==='whatsnew',newExclusive:key==='whatsnew'});}}
const date=s=>s?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s)):null;
function category(p){const s=p.url;const keys=(p.addToCartFromPLPCategories||[]).map(c=>c.key);
 if(/Pet-Supplies/.test(s)||keys.some(k=>k.startsWith('cos_10.9')))return '반려동물';
 if(/Beverages|CoffeeTeaDrink|Coffee|TeaDrink/.test(s)||keys.some(k=>/^cos_10\.(2|11)\./.test(k)))return '음료·커피';
 if(s.startsWith('/Foods/')||keys.some(k=>/^cos_10\./.test(k)))return '식품';
 if(keys.some(k=>k.startsWith('cos_12')))return '뷰티·건강';
 if(keys.some(k=>k.startsWith('cos_2.4')))return '홈·가전';
 if(/ClothingBagsAccessories|SportsFitnessCamping/.test(s)||keys.some(k=>k==='cos_6'||k==='cos_7'))return '스포츠·패션';
 if(/HealthSupplement|BeautyPersonal-Care/.test(s)||/\/Beauty\//.test(s))return '뷰티·건강';
 if(/Appliances|ElectronicsComputers|FurnitureBeddingHome|PatioLawnGarden|GrillsAccessories/.test(s))return '홈·가전';
 if(/BabyKidsToysPets/.test(s))return '유아·완구';
 return '생활용품';
}
const rows=[...map.values()].map(p=>{
 const remoteImage=new URL(p.images.find(i=>i.format==='results')?.url||p.images.find(i=>i.format==='results-webp')?.url||p.images[0].url,'https://www.costco.co.kr').href;
 const hidden=p.hidePriceValue,price=hidden?null:p.price?.value??null;
 const discount=hidden?null:p.discountPrice?.value??(p.newExclusive?0:null);
 const original=price!=null&&discount>0?(p.basePrice?.value??price+discount):null;
 if(original!=null&&original-price!==discount)throw Error('Price mismatch '+p.code);
 return {id:'official-'+p.code,sku:p.code,name:p.nameInSelectedLanguage||p.name,englishName:p.englishName||'',size:'상품번호 '+p.code+(p.minOrderQuantity>1?' · 최소구매 '+p.minOrderQuantity:'')+(p.modulusItemQuantity>1?' · '+p.modulusItemQuantity+'개 단위 주문':''),category:category(p),price,original,discount,start:date(p.discountStartDate),end:date(p.discountEndDate),channel:'online',onlineOnly:(p.decalData||[]).some(d=>/OnlineOnly_Decal/i.test(d.value?.url||'')),sourceLabel:'코스트코 공식',source:new URL(p.url,'https://www.costco.co.kr').href,checked:checkedAt.slice(0,10),autoUpdated:true,isNew:p.isNew||false,newExclusive:p.newExclusive||false,remoteImage,image:remoteImage,campaigns:p.campaigns,shippingIncluded:p.shippingIncluded,options:p.isBaseProduct||p.hasOtherOptionsVariants};
});

await fs.mkdir('data',{recursive:true});await fs.writeFile('data/catalog.json',JSON.stringify({schema:1,checkedAt,products:rows}));console.log('Normalized',rows.length);

