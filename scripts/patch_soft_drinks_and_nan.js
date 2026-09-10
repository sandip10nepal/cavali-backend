const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dir = path.join(__dirname, '../public/_expo/static/js/web');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

console.log(`Starting patch on ${files.length} web bundles...`);

const replacements = [
  {
    name: 'S(e,o) price calculation',
    target: 'function S(e,o){return e+o.price}',
    replacement: 'function S(e,o){return e+(Number(o?.price)||Number(o?.price_adjustment)||0)}'
  },
  {
    name: 'Default modifier initial price',
    target: 'price:t.price})}}),R(e)}}',
    replacement: 'price:Number(t.price!=null?t.price:(t.price_adjustment!=null?t.price_adjustment:0))})}}),R(e)}}'
  },
  {
    name: 'Toggle modifier handler G',
    target: 'G=(e,o,t,l)=>{R(n=>{if(l){return[...n.filter(o=>o.groupId!==e),{groupId:e,groupName:o,optionId:t.id,optionName:t.name,price:t.price}]}return n.some(o=>o.groupId===e&&o.optionId===t.id)?n.filter(o=>!(o.groupId===e&&o.optionId===t.id)):[...n,{groupId:e,groupName:o,optionId:t.id,optionName:t.name,price:t.price}]})}',
    replacement: 'G=(e,o,t,l)=>{const p=Number(t.price!=null?t.price:(t.price_adjustment!=null?t.price_adjustment:0));R(n=>{if(l){return[...n.filter(o=>o.groupId!==e),{groupId:e,groupName:o,optionId:t.id,optionName:t.name,price:p}]}return n.some(o=>o.groupId===e&&o.optionId===t.id)?n.filter(o=>!(o.groupId===e&&o.optionId===t.id)):[...n,{groupId:e,groupName:o,optionId:t.id,optionName:t.name,price:p}]})}'
  },
  {
    name: 'Allow multi-select on soft drinks',
    target: 'const t=e.required||1===e.maxSelect;',
    replacement: 'const isSD=Boolean(j&&j.name&&(j.name.toLowerCase().includes("soft drink")||j.name.toLowerCase().includes("soda")));const t=!isSD&&(e.required||1===e.maxSelect);'
  },
  {
    name: 'Item total price in modal with multi-drink support',
    target: 'const H=G,V=k.reduce(S,0),$=(j.price+V)*z;',
    replacement: 'const H=G,V=k.reduce(S,0),isSDItem=Boolean(j&&j.name&&(j.name.toLowerCase().includes("soft drink")||j.name.toLowerCase().includes("soda"))),dMult=(isSDItem&&k.length>1)?k.length:1,$=((Number(j.price)||0)*dMult+V)*(Number(z)||1);'
  },
  {
    name: 'Add to order with named drink items',
    target: 's[7]!==j||s[8]!==B||s[9]!==w||s[10]!==z||s[11]!==k||s[12]!==N?(L=()=>{B(j,z,k,N),w()},s[7]=j,s[8]=B,s[9]=w,s[10]=z,s[11]=k,s[12]=N,s[13]=L):L=s[13];',
    replacement: 's[7]!==j||s[8]!==B||s[9]!==w||s[10]!==z||s[11]!==k||s[12]!==N?(L=()=>{const isSD=Boolean(j&&j.name&&(j.name.toLowerCase().includes("soft drink")||j.name.toLowerCase().includes("soda")));const activeMods=k.length>0?k:(j.modifierGroups?.[0]?.options?.[0]?[{groupId:j.modifierGroups[0].id,groupName:j.modifierGroups[0].name,optionId:j.modifierGroups[0].options[0].id,optionName:j.modifierGroups[0].options[0].name,price:Number(j.modifierGroups[0].options[0].price||0)}]:[]);if(isSD&&activeMods.length>1){activeMods.forEach(m=>{B({...j,id:j.id+"_"+m.optionId,name:m.optionName,description:"Chilled "+m.optionName+" served with ice.",price:Number(j.price)||4},z,[m],N);});}else if(isSD&&activeMods.length===1){B({...j,id:j.id+"_"+activeMods[0].optionId,name:activeMods[0].optionName,description:"Chilled "+activeMods[0].optionName+" served with ice.",price:Number(j.price)||4},z,activeMods,N);}else{B(j,z,k,N);}w()},s[7]=j,s[8]=B,s[9]=w,s[10]=z,s[11]=k,s[12]=N,s[13]=L):L=s[13];'
  },
  {
    name: 'useBenzinState addToCart with NaN protection',
    target: 'Y=(0,t.useCallback)((e,t=1,a=[],i="")=>{const n=a.reduce((e,t)=>e+t.price,0),o=(e.price+n)*t,s={cartItemId:`${e.id}-${Date.now()}-${Math.random().toString(36).substr(2,4)}`,item:e,quantity:t,selectedModifiers:a,specialInstructions:i,itemTotal:o};c(e=>[...e,s])},[])',
    replacement: 'Y=(0,t.useCallback)((e,t=1,a=[],i="")=>{const n=a.reduce((e,t)=>e+(Number(t.price)||Number(t.price_adjustment)||0),0),bp=Number(e.price)||0,q=Number(t)||1,o=(bp+n)*q,s={cartItemId:`${e.id}-${Date.now()}-${Math.random().toString(36).substr(2,4)}`,item:{...e,price:bp},quantity:q,selectedModifiers:a,specialInstructions:i,itemTotal:o};c(e=>[...e,s])},[])'
  },
  {
    name: 'useBenzinState updateQuantity with NaN protection',
    target: 'H=(0,t.useCallback)((e,t)=>{t<=0?x(e):c(a=>a.map(a=>{if(a.cartItemId===e){const e=a.itemTotal/a.quantity;return{...a,quantity:t,itemTotal:e*t}}return a}))},[x])',
    replacement: 'H=(0,t.useCallback)((e,t)=>{t<=0?x(e):c(a=>a.map(a=>{if(a.cartItemId===e){const u=(Number(a.itemTotal)||0)/(Number(a.quantity)||1),qt=Number(t)||1;return{...a,quantity:qt,itemTotal:u*qt}}return a}))},[x])'
  },
  {
    name: 'useBenzinState cartSubtotal / tax / total with NaN protection',
    target: 'Q=(0,t.useMemo)(()=>l.reduce((e,t)=>e+t.itemTotal,0),[l]),V=(0,t.useMemo)(()=>.0825*Q,[Q]),W=(0,t.useMemo)(()=>Q+V,[Q,V])',
    replacement: 'Q=(0,t.useMemo)(()=>l.reduce((e,t)=>e+(Number(t.itemTotal)||0),0),[l]),V=(0,t.useMemo)(()=>.0825*(Number(Q)||0),[Q]),W=(0,t.useMemo)(()=>(Number(Q)||0)+(Number(V)||0),[Q,V])'
  },
  {
    name: 'useBenzinState drinks mapping in placeOrder',
    target: "i=l.filter(e=>'drinks'===e.item.category).map(e=>({item:{name:e.item.name,price:e.item.price,emoji:e.item.emoji||'\\ud83e\\udd64'},qty:e.quantity,note:e.specialInstructions}))",
    replacement: "i=l.filter(e=>'drinks'===e.item.category).map(e=>{const fn=(e.selectedModifiers||[]).map(e=>e.optionName).filter(Boolean),cn=[e.specialInstructions,...fn].filter(Boolean).join(' · ');let dn=e.item.name;if((dn.toLowerCase().includes('soft drink')||dn.toLowerCase().includes('soda'))&&fn.length>0){dn=fn.join(', ')}return{item:{name:dn,price:Number(e.item.price)||0,emoji:e.item.emoji||'\\ud83e\\udd64'},qty:Number(e.quantity)||1,note:cn,notes:cn,modifiers:e.selectedModifiers}})"
  },
  {
    name: 'useBenzinState items mapping in placeOrder',
    target: "const e=l.map(e=>{const t=e.item.emoji||('hookah'===e.item.category?'\\ud83d\\udca8':'drinks'===e.item.category?'\\ud83e\\udd64':'\\ud83c\\udf54');return{id:e.item.id,name:e.item.name,price:e.item.price,emoji:t,qty:e.quantity,modifiers:e.selectedModifiers,notes:e.specialInstructions}})",
    replacement: "const e=l.map(e=>{const t=e.item.emoji||('hookah'===e.item.category?'\\ud83d\\udca8':'drinks'===e.item.category?'\\ud83e\\udd64':'\\ud83c\\udf54');const fn=(e.selectedModifiers||[]).map(e=>e.optionName).filter(Boolean);let iname=e.item.name;if((iname.toLowerCase().includes('soft drink')||iname.toLowerCase().includes('soda'))&&fn.length>0){iname=fn.join(', ');}return{id:e.item.id,name:iname,price:Number(e.item.price)||0,emoji:t,qty:Number(e.quantity)||1,modifiers:e.selectedModifiers,notes:[e.specialInstructions,...fn].filter(Boolean).join(' · ')}})"
  }
];

let totalPatched = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let fileChanged = false;
  let fileMatches = 0;

  for (const r of replacements) {
    if (content.includes(r.target)) {
      content = content.replaceAll(r.target, r.replacement);
      fileChanged = true;
      fileMatches++;
    }
  }

  if (fileChanged) {
    fs.writeFileSync(filePath, content, 'utf8');
    try {
      execSync(`node --check "${filePath}"`);
      console.log(`✅ [${file}] Successfully patched (${fileMatches} replacements) and syntax verified.`);
      totalPatched++;
    } catch (err) {
      console.error(`❌ [${file}] Syntax check failed:`, err.message);
      process.exit(1);
    }
  } else {
    console.log(`ℹ️ [${file}] No matching targets found (already updated or different chunk).`);
  }
}

console.log(`\n🎉 Patch complete! Updated ${totalPatched} bundle files without syntax errors.`);
