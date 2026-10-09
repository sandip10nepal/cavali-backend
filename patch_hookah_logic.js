const fs = require('fs');
const file = 'public/_expo/static/js/web/entry-a494b385a1f3653a3b249422bbb3c30f.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Ice base and ice hose price 0 when Daku is selected
content = content.replace(
  `const O=F,k=(I?65:l.price)+(O?.price||0)+(y?2:0)+(T?6:0);`,
  `const O=F,k=(I?65:l.price)+(O?.price||0)+(y?(I?0:2):0)+(T?(I?0:6):0);`
);
content = content.replace(
  `y&&t.push({id:"OPT_ICE_BASE",name:"Ice Base",optionName:"Ice Base",price:2}),T&&t.push({id:"OPT_ICE_HOSE",name:"Ice Hose",optionName:"Ice Hose",price:6})`,
  `y&&t.push({id:"OPT_ICE_BASE",name:"Ice Base",optionName:"Ice Base",price:I?0:2}),T&&t.push({id:"OPT_ICE_HOSE",name:"Ice Hose",optionName:"Ice Hose",price:I?0:6})`
);
content = content.replace(
  `y&&o.push("Ice Base (+$2)"),T&&o.push("Ice Hose (+$6)")`,
  `y&&o.push("Ice Base (+$"+(I?0:2)+")"),T&&o.push("Ice Hose (+$"+(I?0:6)+")")`
);
content = content.replace(
  `const Ne=y?"\\u2713 ICE BASE +$2":"+ ICE BASE $2";`,
  `const Ne=y?("\\u2713 ICE BASE +$"+(I?0:2)):("+ ICE BASE $"+(I?0:2));`
);
content = content.replace(
  `const et=T?"\\u2713 ICE HOSE +$6":"+ ICE HOSE $6";`,
  `const et=T?("\\u2713 ICE HOSE +$"+(I?0:6)):("+ ICE HOSE $"+(I?0:6));`
);


// Same for component j (HostHookahCard)
content = content.replace(
  `const O=T,R=(k?65:a.price)+(O?.price||0)+(j?2:0)+(F?6:0);`,
  `const O=T,R=(k?65:a.price)+(O?.price||0)+(j?(k?0:2):0)+(F?(k?0:6):0);`
);
content = content.replace(
  `j&&e.push({id:"OPT_ICE_BASE",name:"Ice Base",optionName:"Ice Base",price:2}),F&&e.push({id:"OPT_ICE_HOSE",name:"Ice Hose",optionName:"Ice Hose",price:6})`,
  `j&&e.push({id:"OPT_ICE_BASE",name:"Ice Base",optionName:"Ice Base",price:k?0:2}),F&&e.push({id:"OPT_ICE_HOSE",name:"Ice Hose",optionName:"Ice Hose",price:k?0:6})`
);
content = content.replace(
  `j&&t.push("Ice Base (+$2)"),F&&t.push("Ice Hose (+$6)")`,
  `j&&t.push("Ice Base (+$"+(k?0:2)+")"),F&&t.push("Ice Hose (+$"+(k?0:6)+")")`
);
content = content.replace(
  `const Le=j?"\\u2713 ICE BASE +$2":"+ ICE BASE $2";`,
  `const Le=j?("\\u2713 ICE BASE +$"+(k?0:2)):("+ ICE BASE $"+(k?0:2));`
);
content = content.replace(
  `const Je=F?"\\u2713 ICE HOSE +$6":"+ ICE HOSE $6";`,
  `const Je=F?("\\u2713 ICE HOSE +$"+(k?0:6)):("+ ICE HOSE $"+(k?0:6));`
);

// 2. Hide "Select Base" for House Mixes in `w` (MenuBrowsing - HouseMixItemCard)
// In w, the item is `l`. The user wants no select base for house mix hookahs.
// The Select Base section is contained in `ke` which is defined as `ke=(0,A.jsxs)(i.default,{style:ye,children:[we,Ie]})`
// We can just set `ke=null` if it's a House Mix!
// Wait, what defines a house mix?
// `l.subcategory === "House Mixes"` or `l.card_type === "house_mix_compact"` or some regex on `l.name`.
content = content.replace(
  `ke=(0,A.jsxs)(i.default,{style:ye,children:[we,Ie]})`,
  `ke=(l.subcategory==="House Mixes"||l.card_type==="house_mix_compact")?null:(0,A.jsxs)(i.default,{style:ye,children:[we,Ie]})`
);

// 3. Hide Ice Base / Ice Hose / Daku options for "Hookah add on like head refill, ice base, ice hose"
// If it's a Hookah add-on, its subcategory is "Refills & Add-ons" or "Hookah Add-ons".
// In `w`, `rt=(0,A.jsxs)(n.default,{style:Ie,children:[$e,ot]})` (which are Ice Base and Ice Hose pills)
// And `be=(0,A.jsxs)(s.default,{activeOpacity:.85,onPress:oe,style:ne,children:[fe,Ce]})` (which is Daku)
// We can conditionally render them.
content = content.replace(
  `rt=(0,A.jsxs)(n.default,{style:Ie,children:[$e,ot]})`,
  `rt=(l.subcategory&&l.subcategory.toLowerCase().includes("refill"))?null:(0,A.jsxs)(n.default,{style:Ie,children:[$e,ot]})`
);
content = content.replace(
  `be=(0,A.jsxs)(s.default,{activeOpacity:.85,onPress:oe,style:ne,children:[fe,Ce]})`,
  `be=(l.subcategory&&l.subcategory.toLowerCase().includes("refill"))?null:(0,A.jsxs)(s.default,{activeOpacity:.85,onPress:oe,style:ne,children:[fe,Ce]})`
);

// Do the same for `j` (HostHookahCard), where item is `a`
content = content.replace(
  `ke=(0,b.jsxs)(i.default,{style:ye,children:[we,Ie]})`,
  `ke=(a.subcategory==="House Mixes"||a.card_type==="house_mix_compact")?null:(0,b.jsxs)(i.default,{style:ye,children:[we,Ie]})`
);
content = content.replace(
  `ot=(0,b.jsxs)(i.default,{style:ze,children:[Me,tt]})`,
  `ot=(a.subcategory&&a.subcategory.toLowerCase().includes("refill"))?null:(0,b.jsxs)(i.default,{style:ze,children:[Me,tt]})`
);
content = content.replace(
  `me=(0,b.jsxs)(d.default,{activeOpacity:.85,onPress:te,style:le,children:[fe,xe]})`,
  `me=(a.subcategory&&a.subcategory.toLowerCase().includes("refill"))?null:(0,b.jsxs)(d.default,{activeOpacity:.85,onPress:te,style:le,children:[fe,xe]})`
);


fs.writeFileSync(file, content);
console.log('Hookah logic patched successfully.');
