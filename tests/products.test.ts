import assert from 'node:assert/strict';
import { test } from 'node:test';
import { productCollections, productImages, productSpecs, newestFirst, availabilityRank } from '../src/lib/products';
import { Product } from '../src/types/nova';
// Isolated in-memory records; never written to Firebase or included in the application.
const base = {id:'test-only',title:'test-only',category:'등급카드',price:4300000,currency:'KRW',status:'판매중',images:[],order:0,isSample:false,visibilityState:'published'} as Product;
test('collections omit empty categories and accept PSA 10 GEM MT',()=>{
 const source={...base,grade:'PSA 10 GEM MT'};
 const groups=productCollections([source]);
 assert.deepEqual(groups.map(g=>g.id),['new','psa','premium']);
 assert.ok(groups.every(g=>g.products[0]===source));
 assert.deepEqual(productCollections([]),[]);
});
test('PSA 100 is not PSA 10; metadata never fabricates grades',()=>{
 assert.ok(!productCollections([{...base,grade:'PSA 100'}]).some(g=>g.id==='psa'));
 assert.deepEqual(productSpecs(base),[]);
 assert.deepEqual(productImages({...base,images:['','  ','https://example.test/original']}),['https://example.test/original']);
});
test('newest ordering supports Firestore timestamps and preserves inputs',()=>{
 const older={...base,id:'old',createdAt:{seconds:1}},newer={...base,id:'new',createdAt:{seconds:2}};
 const list=[older,newer];assert.deepEqual([...list].sort(newestFirst).map(p=>p.id),['new','old']);
 assert.equal(list[0].id,'old');
 assert.ok(availabilityRank(base)<availabilityRank({...base,status:'予約中' as never}));
 assert.ok(availabilityRank({...base,status:'예약중'})<availabilityRank({...base,status:'판매완료'}));
});
