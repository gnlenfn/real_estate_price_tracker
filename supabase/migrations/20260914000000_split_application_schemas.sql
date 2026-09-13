-- ============================================================================
-- ZIPUP / Supabase clean reset
-- Generated from the previous JIPGAP schema.
--
-- DANGER:
--   * This destroys ALL application data in public/app/support/admin.
--   * This deletes ALL Supabase Auth users (auth.users).
--   * Supabase system schemas such as auth and storage are NOT dropped.
--   * Before running, delete the `support-attachments` bucket from
--     Storage Dashboard (or empty/delete it through the Storage API).
--
-- Recommended execution order is documented in zipup_supabase_reset_guide.md.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 0. Remove old Storage policies that may depend on legacy public objects.
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS support_attachment_objects_select ON storage.objects;
DROP POLICY IF EXISTS support_attachment_objects_insert ON storage.objects;
DROP POLICY IF EXISTS support_attachment_objects_delete ON storage.objects;

-- --------------------------------------------------------------------------
-- 1. Drop application schemas.
--    public is recreated empty and intentionally contains no app tables.
-- --------------------------------------------------------------------------
DROP SCHEMA IF EXISTS app CASCADE;
DROP SCHEMA IF EXISTS support CASCADE;
DROP SCHEMA IF EXISTS admin CASCADE;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public AUTHORIZATION postgres;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;

-- --------------------------------------------------------------------------
-- 2. Delete all login accounts.
--    This is intentionally destructive because the current data is disposable.
-- --------------------------------------------------------------------------
DELETE FROM auth.users;

-- --------------------------------------------------------------------------
-- 3. Create new application schemas.
-- --------------------------------------------------------------------------
CREATE SCHEMA app AUTHORIZATION postgres;
CREATE SCHEMA support AUTHORIZATION postgres;
CREATE SCHEMA admin AUTHORIZATION postgres;

-- app/support are client-facing API schemas.
GRANT USAGE ON SCHEMA app TO authenticated, service_role;
GRANT USAGE ON SCHEMA support TO authenticated, service_role;

-- admin is server-oriented. authenticated only gets schema USAGE so that
-- explicitly granted helper functions such as admin.is_support_admin() can
-- be called by RLS policies. No admin table privileges are granted.
GRANT USAGE ON SCHEMA admin TO authenticated, service_role;

-- Keep anonymous clients out of all custom schemas.
REVOKE ALL ON SCHEMA app FROM anon;
REVOKE ALL ON SCHEMA support FROM anon;
REVOKE ALL ON SCHEMA admin FROM anon;

-- --------------------------------------------------------------------------
-- 4. app schema
-- --------------------------------------------------------------------------

CREATE TABLE app.properties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    district text NOT NULL CHECK (district ~ '^[0-9]{5}$'),
    dong text NOT NULL CHECK (length(dong) BETWEEN 1 AND 100),
    area numeric NOT NULL CHECK (area > 0 AND area < 1000),
    owned boolean NOT NULL DEFAULT false,
    color text NOT NULL DEFAULT '#285ee8',
    apt_seq text CHECK (apt_seq IS NULL OR length(apt_seq) BETWEEN 1 AND 100),
    kakao_place_id text CHECK (
        kakao_place_id IS NULL OR length(kakao_place_id) BETWEEN 1 AND 40
    ),
    road_address text NOT NULL DEFAULT '' CHECK (length(road_address) <= 200),
    jibun_address text NOT NULL DEFAULT '' CHECK (length(jibun_address) <= 200),
    UNIQUE (id, user_id)
);

CREATE TABLE app.records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id uuid NOT NULL,
    date date NOT NULL CHECK (date <= current_date),
    price numeric NOT NULL CHECK (price > 0 AND price < 100000000),
    kind text NOT NULL CHECK (kind IN ('trade', 'estimate', 'asking')),
    source text NOT NULL,
    note text NOT NULL DEFAULT '',
    FOREIGN KEY (property_id, user_id)
        REFERENCES app.properties(id, user_id)
        ON DELETE CASCADE
);

CREATE INDEX records_history
    ON app.records(user_id, property_id, date);

CREATE TABLE app.profiles (
    user_id uuid PRIMARY KEY
        REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT profiles_nickname_format CHECK (
        nickname = btrim(nickname)
        AND nickname !~ '  +'
        AND char_length(nickname) BETWEEN 2 AND 30
        AND nickname ~ '^[가-힣A-Za-z0-9 ]+$'
    )
);

CREATE UNIQUE INDEX profiles_nickname_unique
    ON app.profiles (lower(btrim(nickname)));

ALTER TABLE app.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_properties
ON app.properties
FOR ALL
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY own_records
ON app.records
FOR ALL
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY own_profile_select
ON app.profiles
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY own_profile_update
ON app.profiles
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE
ON app.properties, app.records
TO authenticated;

GRANT SELECT, UPDATE
ON app.profiles
TO authenticated;

GRANT ALL
ON app.properties, app.records, app.profiles
TO service_role;

-- --------------------------------------------------------------------------
-- 5. support schema
-- --------------------------------------------------------------------------

CREATE TABLE support.tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category text NOT NULL CHECK (category IN ('bug', 'feature', 'question')),
    title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
    body text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 4000),
    screen text NOT NULL DEFAULT '' CHECK (char_length(screen) <= 200),
    browser text NOT NULL DEFAULT '' CHECK (char_length(browser) <= 500),
    status text NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'answered', 'closed')),
    last_activity_at timestamptz NOT NULL DEFAULT now(),
    github_status text NOT NULL DEFAULT 'pending'
        CHECK (github_status IN ('pending', 'sending', 'sent', 'failed', 'unknown')),
    github_issue_number integer,
    github_issue_url text
        CHECK (github_issue_url IS NULL OR char_length(github_issue_url) <= 500),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_tickets_rate_limit
    ON support.tickets(user_id, created_at DESC);

CREATE INDEX support_tickets_activity
    ON support.tickets(user_id, last_activity_at DESC);

CREATE TABLE support.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL
        REFERENCES support.tickets(id) ON DELETE CASCADE,
    author_id uuid NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    author_role text NOT NULL CHECK (author_role IN ('user', 'admin')),
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_messages_ticket_created
    ON support.messages(ticket_id, created_at);

CREATE TABLE support.attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL
        REFERENCES support.tickets(id) ON DELETE CASCADE,
    message_id uuid
        REFERENCES support.messages(id) ON DELETE CASCADE,
    user_id uuid NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_path text NOT NULL UNIQUE
        CHECK (char_length(storage_path) BETWEEN 1 AND 500),
    file_name text NOT NULL
        CHECK (char_length(file_name) BETWEEN 1 AND 200),
    mime_type text NOT NULL
        CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
    byte_size integer NOT NULL
        CHECK (byte_size BETWEEN 1 AND 5242880),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_attachments_ticket
    ON support.attachments(ticket_id, created_at);

CREATE TABLE support.internal_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL
        REFERENCES support.tickets(id) ON DELETE CASCADE,
    author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_internal_notes_ticket
    ON support.internal_notes(ticket_id, created_at, id);

CREATE TABLE support.github_message_exports (
    message_id uuid PRIMARY KEY
        REFERENCES support.messages(id) ON DELETE CASCADE,
    ticket_id uuid NOT NULL
        REFERENCES support.tickets(id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('sending', 'sent', 'failed', 'unknown')),
    github_comment_id bigint,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE support.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE support.internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE support.github_message_exports ENABLE ROW LEVEL SECURITY;

-- Table grants are intentionally minimal.
GRANT SELECT, UPDATE ON support.tickets TO authenticated;
GRANT SELECT, INSERT ON support.messages, support.attachments TO authenticated;

GRANT ALL
ON support.tickets,
   support.messages,
   support.attachments,
   support.internal_notes,
   support.github_message_exports
TO service_role;

REVOKE ALL ON support.internal_notes, support.github_message_exports
FROM anon, authenticated;

-- --------------------------------------------------------------------------
-- 6. admin schema
-- --------------------------------------------------------------------------

CREATE TABLE admin.admins (
    user_id uuid PRIMARY KEY
        REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin.trade_sync_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger text NOT NULL CHECK (trigger IN ('cron', 'manual')),
    status text NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'success', 'partial', 'failed')),
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    property_count integer NOT NULL DEFAULT 0 CHECK (property_count >= 0),
    completed_count integer NOT NULL DEFAULT 0 CHECK (completed_count >= 0),
    saved_records integer NOT NULL DEFAULT 0 CHECK (saved_records >= 0),
    failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
    failures jsonb NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(failures) = 'array'),
    request_id uuid NOT NULL DEFAULT gen_random_uuid(),
    retry_of uuid REFERENCES admin.trade_sync_runs(id) ON DELETE SET NULL,
    actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    skipped_count integer NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
    failure_scope text NOT NULL DEFAULT 'targets'
        CHECK (failure_scope IN ('targets', 'run'))
);

CREATE INDEX trade_sync_runs_started_at
    ON admin.trade_sync_runs(started_at DESC);

CREATE UNIQUE INDEX trade_sync_runs_single_running
    ON admin.trade_sync_runs((true))
    WHERE status = 'running';

CREATE TABLE admin.audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action text NOT NULL CHECK (
        action IN (
            'support.reply',
            'support.note',
            'support.status',
            'github.transfer',
            'sync.start',
            'sync.finish'
        )
    ),
    target_id text NOT NULL CHECK (char_length(target_id) BETWEEN 1 AND 200),
    request_id uuid NOT NULL,
    outcome text NOT NULL CHECK (outcome IN ('success', 'failed', 'unknown')),
    before_status text,
    after_status text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_events_created_at
    ON admin.audit_events(created_at DESC, id DESC);

CREATE INDEX admin_audit_events_target
    ON admin.audit_events(target_id, created_at DESC);

CREATE TABLE admin.user_activity_summary (
    user_id uuid PRIMARY KEY
        REFERENCES auth.users(id) ON DELETE CASCADE,
    last_activity_at timestamptz NOT NULL
);

CREATE TABLE admin.integration_checks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service text NOT NULL
        CHECK (service IN ('supabase', 'molit', 'kakao', 'github')),
    status text NOT NULL
        CHECK (status IN ('success', 'failed', 'unconfigured')),
    request_id uuid NOT NULL,
    checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX integration_checks_service_time
    ON admin.integration_checks(service, checked_at DESC);

ALTER TABLE admin.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin.trade_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin.user_activity_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin.integration_checks ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON admin.admins,
   admin.trade_sync_runs,
   admin.audit_events,
   admin.user_activity_summary,
   admin.integration_checks
FROM PUBLIC, anon, authenticated;

GRANT ALL
ON admin.admins,
   admin.trade_sync_runs,
   admin.audit_events,
   admin.user_activity_summary,
   admin.integration_checks
TO service_role;

-- --------------------------------------------------------------------------
-- 7. Helper/admin functions
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION admin.is_support_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = admin, pg_temp
AS $$
    SELECT auth.uid() IS NOT NULL
       AND EXISTS (
            SELECT 1
            FROM admin.admins
            WHERE user_id = auth.uid()
       );
$$;

REVOKE ALL ON FUNCTION admin.is_support_admin()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION admin.is_support_admin()
TO authenticated, service_role;

-- RLS policies that depend on admin.is_support_admin().
CREATE POLICY support_tickets_select
ON support.tickets
FOR SELECT
TO authenticated
USING (
    user_id = (SELECT auth.uid())
    OR (SELECT admin.is_support_admin())
);

CREATE POLICY support_tickets_admin_update
ON support.tickets
FOR UPDATE
TO authenticated
USING ((SELECT admin.is_support_admin()))
WITH CHECK ((SELECT admin.is_support_admin()));

CREATE POLICY support_messages_select
ON support.messages
FOR SELECT
TO authenticated
USING (
    (SELECT admin.is_support_admin())
    OR EXISTS (
        SELECT 1
        FROM support.tickets ticket
        WHERE ticket.id = ticket_id
          AND ticket.user_id = (SELECT auth.uid())
    )
);

CREATE POLICY support_messages_owner_insert
ON support.messages
FOR INSERT
TO authenticated
WITH CHECK (
    author_id = (SELECT auth.uid())
    AND author_role = 'user'
    AND EXISTS (
        SELECT 1
        FROM support.tickets ticket
        WHERE ticket.id = ticket_id
          AND ticket.user_id = (SELECT auth.uid())
          AND ticket.status <> 'closed'
    )
);

CREATE POLICY support_messages_admin_insert
ON support.messages
FOR INSERT
TO authenticated
WITH CHECK (
    author_id = (SELECT auth.uid())
    AND author_role = 'admin'
    AND (SELECT admin.is_support_admin())
);

CREATE POLICY support_attachments_select
ON support.attachments
FOR SELECT
TO authenticated
USING (
    (SELECT admin.is_support_admin())
    OR EXISTS (
        SELECT 1
        FROM support.tickets ticket
        WHERE ticket.id = ticket_id
          AND ticket.user_id = (SELECT auth.uid())
    )
);

CREATE POLICY support_attachments_owner_insert
ON support.attachments
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM support.tickets ticket
        WHERE ticket.id = ticket_id
          AND ticket.user_id = (SELECT auth.uid())
          AND ticket.status <> 'closed'
    )
);

CREATE POLICY support_attachments_admin_insert
ON support.attachments
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (SELECT admin.is_support_admin())
);

-- --------------------------------------------------------------------------
-- 8. app RPC functions
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.replace_molit_month(
    p_id uuid,
    p_month text,
    p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = app, pg_temp
AS $$
BEGIN
    IF p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
        RAISE EXCEPTION 'Invalid month';
    END IF;

    PERFORM 1
    FROM app.properties
    WHERE id = p_id
      AND user_id = auth.uid()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Property not found';
    END IF;

    DELETE FROM app.records
    WHERE property_id = p_id
      AND user_id = auth.uid()
      AND source = '국토교통부 API'
      AND to_char(date, 'YYYY-MM') = p_month;

    INSERT INTO app.records (
        property_id,
        date,
        price,
        kind,
        source,
        note
    )
    SELECT
        p_id,
        (r->>'date')::date,
        (r->>'price')::numeric,
        'trade',
        '국토교통부 API',
        coalesce(r->>'note', '')
    FROM jsonb_array_elements(p_rows) r
    WHERE left(r->>'date', 7) = p_month;
END;
$$;

REVOKE ALL ON FUNCTION app.replace_molit_month(uuid, text, jsonb)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION app.replace_molit_month(uuid, text, jsonb)
TO authenticated;


CREATE OR REPLACE FUNCTION app.replace_molit_month_scheduled(
    p_id uuid,
    p_user_id uuid,
    p_month text,
    p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = app, pg_temp
AS $$
BEGIN
    IF p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
        RAISE EXCEPTION 'Invalid month';
    END IF;

    PERFORM 1
    FROM app.properties
    WHERE id = p_id
      AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Property not found';
    END IF;

    DELETE FROM app.records
    WHERE property_id = p_id
      AND user_id = p_user_id
      AND source = '국토교통부 API'
      AND to_char(date, 'YYYY-MM') = p_month;

    INSERT INTO app.records (
        user_id,
        property_id,
        date,
        price,
        kind,
        source,
        note
    )
    SELECT
        p_user_id,
        p_id,
        (r->>'date')::date,
        (r->>'price')::numeric,
        'trade',
        '국토교통부 API',
        coalesce(r->>'note', '')
    FROM jsonb_array_elements(p_rows) r
    WHERE left(r->>'date', 7) = p_month;
END;
$$;

REVOKE ALL ON FUNCTION app.replace_molit_month_scheduled(uuid, uuid, text, jsonb)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION app.replace_molit_month_scheduled(uuid, uuid, text, jsonb)
TO service_role;


CREATE OR REPLACE FUNCTION app.ensure_profile()
RETURNS app.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, pg_temp
AS $$
DECLARE
    result app.profiles;
    candidate text;
    attempt integer;
    adjectives text[] := ARRAY[
        '고요한','명랑한','용감한','다정한','기민한','느긋한','든든한','반짝이는',
        '슬기로운','씩씩한','온화한','유쾌한','재빠른','차분한','총명한','친절한',
        '푸근한','활기찬','꾸준한','당당한','부지런한','신중한','산뜻한','따뜻한',
        '정직한','재치있는','호기심많은','자유로운','침착한','상냥한','쾌활한','담대한',
        '포근한','성실한','영리한','평온한','멋진','행복한','밝은','귀여운'
    ];
    animals text[] := ARRAY[
        '사막여우','붉은여우','북극여우','회색늑대','붉은늑대','눈표범','구름표범',
        '아무르표범','재규어','퓨마','카라칼','서벌','스라소니','레서판다',
        '자이언트판다','쿼카','웜뱃','코알라','미어캣','카피바라','친칠라','알파카',
        '라마','순록','아이벡스','가젤','오카피','테이퍼','해달','유럽수달',
        '바다수달','오소리','라쿤','너구리','몽구스','페넥여우','황제펭귄',
        '아델리펭귄','왕관펭귄','큰부리새','퍼핀','홍학','두루미','황새',
        '수리부엉이','흰올빼미','검독수리','송골매','물총새','벌새','큰고니',
        '혹고니','바다오리','돌고래','범고래','흰돌고래','듀공','매너티',
        '일각고래','혹등고래','고래상어','만타가오리','해마','문어','앵무조개',
        '바다거북','육지거북','아홀로틀','청개구리','도롱뇽','코모도왕도마뱀',
        '이구아나','카멜레온','비어디드래곤','왕도마뱀','코주부원숭이',
        '황금들창코원숭이','긴팔원숭이','마모셋','타마린','여우원숭이'
    ];
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT *
    INTO result
    FROM app.profiles
    WHERE user_id = auth.uid();

    IF FOUND THEN
        RETURN result;
    END IF;

    FOR attempt IN 1..100 LOOP
        candidate :=
            adjectives[(floor(random() * array_length(adjectives, 1)) + 1)::integer]
            || ' ' ||
            animals[(floor(random() * array_length(animals, 1)) + 1)::integer];

        BEGIN
            INSERT INTO app.profiles(user_id, nickname)
            VALUES (auth.uid(), candidate)
            RETURNING * INTO result;

            RETURN result;
        EXCEPTION
            WHEN unique_violation THEN
                NULL;
        END;
    END LOOP;

    RAISE EXCEPTION 'Unable to allocate nickname';
END;
$$;

REVOKE ALL ON FUNCTION app.ensure_profile()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION app.ensure_profile()
TO authenticated;

-- --------------------------------------------------------------------------
-- 9. Server/admin RPC functions
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION admin.add_support_internal_note(
    p_ticket_id uuid,
    p_author_id uuid,
    p_body text,
    p_request_id uuid
)
RETURNS TABLE(id uuid, created_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = admin, support, pg_temp
AS $$
DECLARE
    v_id uuid;
    v_created_at timestamptz;
BEGIN
    IF char_length(btrim(p_body)) NOT BETWEEN 1 AND 4000 THEN
        RAISE EXCEPTION 'Invalid note';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM support.tickets
        WHERE tickets.id = p_ticket_id
    ) THEN
        RAISE EXCEPTION 'Ticket not found';
    END IF;

    INSERT INTO support.internal_notes(ticket_id, author_id, body)
    VALUES (p_ticket_id, p_author_id, btrim(p_body))
    RETURNING internal_notes.id, internal_notes.created_at
    INTO v_id, v_created_at;

    INSERT INTO admin.audit_events(
        actor_id,
        action,
        target_id,
        request_id,
        outcome
    )
    VALUES (
        p_author_id,
        'support.note',
        p_ticket_id::text,
        p_request_id,
        'success'
    );

    RETURN QUERY SELECT v_id, v_created_at;
END;
$$;

REVOKE ALL
ON FUNCTION admin.add_support_internal_note(uuid, uuid, text, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION admin.add_support_internal_note(uuid, uuid, text, uuid)
TO service_role;


CREATE OR REPLACE FUNCTION admin.list_users(
    p_search text DEFAULT '',
    p_before_joined_at timestamptz DEFAULT NULL,
    p_before_id uuid DEFAULT NULL,
    p_limit integer DEFAULT 50
)
RETURNS TABLE(
    id uuid,
    nickname text,
    joined_at timestamptz,
    property_count bigint,
    ticket_count bigint,
    last_activity_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = admin, app, support, auth, pg_temp
AS $$
    SELECT
        u.id,
        coalesce(p.nickname, '집 사용자'),
        u.created_at,
        (
            SELECT count(*)
            FROM app.properties x
            WHERE x.user_id = u.id
        ),
        (
            SELECT count(*)
            FROM support.tickets t
            WHERE t.user_id = u.id
        ),
        a.last_activity_at
    FROM auth.users u
    LEFT JOIN app.profiles p
        ON p.user_id = u.id
    LEFT JOIN admin.user_activity_summary a
        ON a.user_id = u.id
    WHERE (
        btrim(p_search) = ''
        OR p.nickname ILIKE
            '%' || replace(replace(btrim(p_search), '%', '\%'), '_', '\_') || '%'
            ESCAPE '\'
    )
    AND (
        p_before_joined_at IS NULL
        OR (u.created_at, u.id) < (p_before_joined_at, p_before_id)
    )
    ORDER BY u.created_at DESC, u.id DESC
    LIMIT least(greatest(p_limit, 1), 50);
$$;

REVOKE ALL
ON FUNCTION admin.list_users(text, timestamptz, uuid, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION admin.list_users(text, timestamptz, uuid, integer)
TO service_role;


CREATE OR REPLACE FUNCTION admin.list_support_tickets(
    p_status text DEFAULT '',
    p_category text DEFAULT '',
    p_github text DEFAULT '',
    p_search text DEFAULT '',
    p_before_activity timestamptz DEFAULT NULL,
    p_before_id uuid DEFAULT NULL,
    p_limit integer DEFAULT 50
)
RETURNS TABLE(
    id uuid,
    user_id uuid,
    category text,
    title text,
    body text,
    status text,
    created_at timestamptz,
    last_activity_at timestamptz,
    github_status text,
    github_issue_number integer,
    github_issue_url text,
    nickname text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = admin, support, app, pg_temp
AS $$
    SELECT
        t.id,
        t.user_id,
        t.category,
        t.title,
        t.body,
        t.status,
        t.created_at,
        t.last_activity_at,
        t.github_status,
        t.github_issue_number,
        t.github_issue_url,
        coalesce(p.nickname, '집 사용자')
    FROM support.tickets t
    LEFT JOIN app.profiles p
        ON p.user_id = t.user_id
    WHERE (p_status = '' OR t.status = p_status)
      AND (p_category = '' OR t.category = p_category)
      AND (
          p_github = ''
          OR (p_github = 'sent' AND t.github_issue_number IS NOT NULL)
          OR (p_github = 'pending' AND t.github_issue_number IS NULL)
      )
      AND (
          btrim(p_search) = ''
          OR t.title ILIKE
              '%' || replace(replace(btrim(p_search), '%', '\%'), '_', '\_') || '%'
              ESCAPE '\'
          OR p.nickname ILIKE
              '%' || replace(replace(btrim(p_search), '%', '\%'), '_', '\_') || '%'
              ESCAPE '\'
      )
      AND (
          p_before_activity IS NULL
          OR (t.last_activity_at, t.id) < (p_before_activity, p_before_id)
      )
    ORDER BY t.last_activity_at DESC, t.id DESC
    LIMIT least(greatest(p_limit, 1), 50);
$$;

REVOKE ALL
ON FUNCTION admin.list_support_tickets(
    text, text, text, text, timestamptz, uuid, integer
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION admin.list_support_tickets(
    text, text, text, text, timestamptz, uuid, integer
)
TO service_role;

-- --------------------------------------------------------------------------
-- 10. Activity trigger functions
--
-- Split deliberately:
--   * touch_user_activity_from_user_id() only touches NEW.user_id
--   * touch_user_activity_from_support_message() only touches
--     NEW.author_id / NEW.author_role
--
-- This avoids the old generic trigger referencing columns that do not exist
-- on every triggering table.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION admin.touch_user_activity_from_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = admin, pg_temp
AS $$
BEGIN
    INSERT INTO admin.user_activity_summary(user_id, last_activity_at)
    VALUES (NEW.user_id, now())
    ON CONFLICT (user_id)
    DO UPDATE
    SET last_activity_at = EXCLUDED.last_activity_at;

    RETURN NEW;
END;
$$;

REVOKE ALL
ON FUNCTION admin.touch_user_activity_from_user_id()
FROM PUBLIC, anon, authenticated;


CREATE OR REPLACE FUNCTION admin.touch_user_activity_from_support_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = admin, pg_temp
AS $$
BEGIN
    IF NEW.author_role <> 'user' THEN
        RETURN NEW;
    END IF;

    INSERT INTO admin.user_activity_summary(user_id, last_activity_at)
    VALUES (NEW.author_id, now())
    ON CONFLICT (user_id)
    DO UPDATE
    SET last_activity_at = EXCLUDED.last_activity_at;

    RETURN NEW;
END;
$$;

REVOKE ALL
ON FUNCTION admin.touch_user_activity_from_support_message()
FROM PUBLIC, anon, authenticated;


CREATE TRIGGER properties_touch_activity
AFTER INSERT OR UPDATE ON app.properties
FOR EACH ROW
EXECUTE FUNCTION admin.touch_user_activity_from_user_id();

CREATE TRIGGER records_touch_activity
AFTER INSERT OR UPDATE ON app.records
FOR EACH ROW
EXECUTE FUNCTION admin.touch_user_activity_from_user_id();

CREATE TRIGGER support_tickets_touch_activity
AFTER INSERT ON support.tickets
FOR EACH ROW
EXECUTE FUNCTION admin.touch_user_activity_from_user_id();

CREATE TRIGGER support_messages_touch_activity
AFTER INSERT ON support.messages
FOR EACH ROW
EXECUTE FUNCTION admin.touch_user_activity_from_support_message();

-- --------------------------------------------------------------------------
-- 11. Storage bucket metadata + policies.
--
-- The physical bucket must be empty/deleted before this reset if old files
-- still exist. We only recreate bucket metadata/policies here.
-- --------------------------------------------------------------------------

INSERT INTO storage.buckets(
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
VALUES (
    'support-attachments',
    'support-attachments',
    false,
    5242880,
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id)
DO UPDATE SET
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

CREATE POLICY support_attachment_objects_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'support-attachments'
    AND (
        (SELECT admin.is_support_admin())
        OR owner_id = (SELECT auth.uid()::text)
    )
);

CREATE POLICY support_attachment_objects_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'support-attachments'
    AND owner_id = (SELECT auth.uid()::text)
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    AND EXISTS (
        SELECT 1
        FROM support.tickets ticket
        WHERE ticket.id::text = (storage.foldername(name))[2]
          AND ticket.user_id = (SELECT auth.uid())
          AND ticket.status <> 'closed'
    )
);

CREATE POLICY support_attachment_objects_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'support-attachments'
    AND (
        (SELECT admin.is_support_admin())
        OR owner_id = (SELECT auth.uid()::text)
    )
);

-- --------------------------------------------------------------------------
-- 12. Default privileges.
--
-- New objects should NOT accidentally become client-accessible.
-- service_role gets server access; authenticated remains explicit opt-in.
-- --------------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app
REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA support
REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA admin
REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app
REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA support
REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA admin
REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app
GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA support
GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA admin
GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app
GRANT USAGE, SELECT ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA support
GRANT USAGE, SELECT ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA admin
GRANT USAGE, SELECT ON SEQUENCES TO service_role;

COMMIT;

-- Ask PostgREST to reread database metadata.
NOTIFY pgrst, 'reload schema';

-- --------------------------------------------------------------------------
-- 13. Verification queries (read-only)
-- --------------------------------------------------------------------------

SELECT
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_schema IN ('public', 'app', 'support', 'admin')
  AND table_type = 'BASE TABLE'
ORDER BY table_schema, table_name;

SELECT
    n.nspname AS function_schema,
    p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('app', 'support', 'admin')
ORDER BY n.nspname, p.proname;
