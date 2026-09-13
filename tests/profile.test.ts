import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeNickname,nicknameValidation,profileLabel} from '../lib/profile';

test('nickname normalization collapses whitespace without reading social profile data',()=>{
 assert.equal(normalizeNickname('  고요한   사막여우  '),'고요한 사막여우');
 assert.equal(profileLabel({nickname:'명랑한 설표'},'fallback'),'명랑한 설표');
 assert.equal(profileLabel(null,'fallback'),'집 사용자');
});

test('nickname validation enforces a useful length and allowed display characters',()=>{
 assert.equal(nicknameValidation('가'), '닉네임은 2자 이상 입력해 주세요.');
 assert.equal(nicknameValidation('가'.repeat(31)), '닉네임은 30자 이하로 입력해 주세요.');
 assert.equal(nicknameValidation('고요한<script>'), '한글, 영문, 숫자와 띄어쓰기만 사용할 수 있습니다.');
 assert.equal(nicknameValidation('고요한 사막여우'), null);
});
