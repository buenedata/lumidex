const { imageConfigDefault } = require('./node_modules/next/dist/shared/lib/image-config.js');

const allSizesDefault = [...imageConfigDefault.deviceSizes, ...imageConfigDefault.imageSizes].sort((a,b)=>a-b);
const allSizesCustom = [640, 1080, 1920, 64, 128, 256].sort((a,b)=>a-b);

function getWidths(allSizes, width) {
  return [...new Set([width, width*2].map(w => allSizes.find(p => p>=w) || allSizes[allSizes.length-1]))];
}

console.log('=== Default allSizes:', JSON.stringify(allSizesDefault));
console.log('=== Custom  allSizes:', JSON.stringify(allSizesCustom));

const defaultWidths160 = getWidths(allSizesDefault, 160);
const customWidths160  = getWidths(allSizesCustom, 160);
console.log('Logo width=160 → default widths:', defaultWidths160);
console.log('Logo width=160 → custom  widths:', customWidths160);

const customAllowed = [640, 1080, 1920, 64, 128, 256];
console.log('Default 2x (' + defaultWidths160[1] + ') in custom allowed?', customAllowed.includes(Number(defaultWidths160[1])));
console.log('Custom  2x (' + customWidths160[1]  + ') in custom allowed?', customAllowed.includes(Number(customWidths160[1])));
