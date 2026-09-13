create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
 result public.profiles;
 candidate text;
 adjectives text[] := array['고요한','명랑한','용감한','다정한','기민한','느긋한','든든한','반짝이는','슬기로운','씩씩한','온화한','유쾌한','재빠른','차분한','총명한','친절한','푸근한','활기찬','꾸준한','당당한','부지런한','신중한','산뜻한','따뜻한','정직한','재치있는','호기심많은','자유로운','침착한','상냥한','쾌활한','담대한','포근한','성실한','영리한','평온한','멋진','행복한','밝은','귀여운'];
 animals text[] := array['사막여우','붉은여우','북극여우','회색늑대','붉은늑대','눈표범','구름표범','아무르표범','재규어','퓨마','카라칼','서벌','스라소니','레서판다','자이언트판다','쿼카','웜뱃','코알라','미어캣','카피바라','친칠라','알파카','라마','순록','아이벡스','가젤','오카피','테이퍼','해달','유럽수달','바다수달','오소리','라쿤','너구리','몽구스','페넥여우','황제펭귄','아델리펭귄','왕관펭귄','큰부리새','퍼핀','홍학','두루미','황새','수리부엉이','흰올빼미','검독수리','송골매','물총새','벌새','큰고니','혹고니','바다오리','돌고래','범고래','흰돌고래','듀공','매너티','일각고래','혹등고래','고래상어','만타가오리','해마','문어','앵무조개','바다거북','육지거북','아홀로틀','청개구리','도롱뇽','코모도왕도마뱀','이구아나','카멜레온','비어디드래곤','왕도마뱀','코주부원숭이','황금들창코원숭이','긴팔원숭이','마모셋','타마린','여우원숭이'];
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into result from public.profiles where user_id=auth.uid();
 if found then return result; end if;
 for attempt in 1..100 loop
  candidate := adjectives[(floor(random()*array_length(adjectives,1))+1)::integer] || ' ' || animals[(floor(random()*array_length(animals,1))+1)::integer];
  begin
   insert into public.profiles(user_id,nickname) values(auth.uid(),candidate) returning * into result;
   return result;
  exception when unique_violation then
   null;
  end;
 end loop;
 raise exception 'Unable to allocate nickname';
end;
$$;
