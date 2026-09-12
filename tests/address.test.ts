import {test} from 'node:test';
import assert from 'node:assert/strict';
import {propertyAddress,AddressResult} from '../lib/address';
const address:AddressResult={bcode:'1144010100',bname:'아현동',bname1:'',sido:'서울',sigungu:'마포구',buildingName:'마포래미안푸르지오',roadAddress:'',jibunAddress:''};
test('legal address resolves API district and keeps same-name neighborhoods distinct',()=>{
 assert.deepEqual(propertyAddress(address),{district:'11440',dong:'아현동',label:'서울 마포구 아현동',name:'마포래미안푸르지오'});
 assert.notEqual(propertyAddress({...address,bcode:'1111010100'}).district,propertyAddress(address).district);
});
test('rural addresses use eup/myeon for transaction matching and incomplete results are rejected',()=>{
 assert.equal(propertyAddress({...address,bname:'송담리',bname1:'안중읍'}).dong,'안중읍');
 assert.throws(()=>propertyAddress({...address,bcode:''}));
 assert.throws(()=>propertyAddress({...address,bname:''}));
});
