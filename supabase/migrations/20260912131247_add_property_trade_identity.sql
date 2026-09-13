alter table public.properties
 add column if not exists apt_seq text check(apt_seq is null or length(apt_seq) between 1 and 100),
 add column if not exists kakao_place_id text check(kakao_place_id is null or length(kakao_place_id) between 1 and 40),
 add column if not exists road_address text not null default '' check(length(road_address) <= 200),
 add column if not exists jibun_address text not null default '' check(length(jibun_address) <= 200);
