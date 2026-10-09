const fs = require('fs');
const file = 'public/_expo/static/js/web/entry-a494b385a1f3653a3b249422bbb3c30f.js';
let content = fs.readFileSync(file, 'utf8');

const bases = `([{id:"base_water",name:"Water",price:0},{id:"base_milk",name:"Milk",price:4},{id:"base_redbull",name:"Redbull",price:6},{id:"base_juice",name:"Fresh Juice",price:5}])`;

content = content.replace(/_\.DEFAULT_HOOKAH_BASES/g, bases);
content = content.replace(/C\.DEFAULT_HOOKAH_BASES/g, bases); // just in case

fs.writeFileSync(file, content);
console.log('Fixed DEFAULT_HOOKAH_BASES');
