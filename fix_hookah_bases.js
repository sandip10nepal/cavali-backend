const fs = require('fs');
const file = 'public/_expo/static/js/web/entry-a494b385a1f3653a3b249422bbb3c30f.js';
let content = fs.readFileSync(file, 'utf8');

// Replace C.DEFAULT_HOOKAH_BASES with _.DEFAULT_HOOKAH_BASES in the file
content = content.replace(/C\.DEFAULT_HOOKAH_BASES/g, '_.DEFAULT_HOOKAH_BASES');

fs.writeFileSync(file, content);
console.log('Fixed C.DEFAULT_HOOKAH_BASES to _.DEFAULT_HOOKAH_BASES');
