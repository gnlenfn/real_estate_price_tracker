import {test} from 'node:test';
import assert from 'node:assert/strict';
import {githubIssuePayload,validateSupportInput} from '../lib/support';

test('support validation rejects invalid categories and undersized content',()=>{
 assert.equal(validateSupportInput({category:'other',title:'오류',body:'짧음'}),'문의 유형을 확인해 주세요.');
 assert.equal(validateSupportInput({category:'bug',title:'오',body:'충분히 자세한 문의 내용입니다.'}),'제목은 3자 이상 입력해 주세요.');
 assert.equal(validateSupportInput({category:'bug',title:'로그인 오류',body:'짧음'}),'내용은 10자 이상 입력해 주세요.');
 assert.equal(validateSupportInput({category:'question',title:'가격 기준 문의',body:'가격 기준이 어떻게 계산되는지 궁금합니다.'}),null);
});

test('GitHub issue payload contains support context without account identifiers',()=>{
 const payload=githubIssuePayload({category:'bug',title:'차트가 비어 보여요',body:'가격 기록이 있는데 차트에 선이 나오지 않습니다.',screen:'설정',browser:'Mobile Safari',nickname:'고요한 사막여우'});
 assert.equal(payload.title,'[오류 제보] 차트가 비어 보여요');
 assert.deepEqual(payload.labels,['user-feedback','bug']);
 assert.match(payload.body,/고요한 사막여우/);
 assert.match(payload.body,/Mobile Safari/);
 assert.doesNotMatch(payload.body,/email|user_id|supabase/i);
 assert.equal(Object.hasOwn(payload,'email'),false);
 assert.equal(Object.hasOwn(payload,'userId'),false);
});

test('GitHub issue payload redacts emails and UUIDs pasted into user content',()=>{
 const payload=githubIssuePayload({category:'question',title:'계정 user@example.com 문의',body:'사용자 123e4567-e89b-12d3-a456-426614174000 과 user@example.com을 확인해 주세요.',nickname:'고요한 사막여우'});
 assert.doesNotMatch(`${payload.title}\n${payload.body}`,/user@example\.com|123e4567-e89b-12d3-a456-426614174000/);
 assert.match(payload.body,/\[이메일 가림\]/);
 assert.match(payload.body,/\[식별값 가림\]/);
});
