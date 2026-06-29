-- Migration v273 — Rate-limit anonymous/authenticated error reporting
--
-- Problem: log_app_error is SECURITY DEFINER and executable by anon,
-- so a bad actor could spam the app_errors table.
--
-- Fix:
--   1. Create a small throttle table keyed by hashed IP + 1-minute bucket.
--   2. Rewrite log_app_error to drop reports once the per-IP rate exceeds
--      10 errors/minute.
--   3. Keep EXECUTE grants for anon and authenticated so pre-auth JS errors
--      can still be captured, but only at a sane rate.

-- Throttle table; no policies because it is only touched by the SECURITY DEFINER function.
CREATE TABLE IF NOT EXISTS public.app_error_throttle (
  ip_hash TEXT NOT NULL,
  bucket TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, bucket)
);
ALTER TABLE public.app_error_throttle ENABLE ROW LEVEL SECURITY;

-- Drop stale buckets older than 1 hour whenever a new error arrives.
CREATE OR REPLACE FUNCTION public.log_app_error(payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip TEXT;
  v_hash TEXT;
  v_bucket TIMESTAMPTZ;
  v_count INT;
  v_limit INT := 10;
BEGIN
  -- Extract the caller's IP from the request headers exposed by PostgREST
  BEGIN
    v_ip := COALESCE(
      NULLIF(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
      NULLIF(current_setting('request.headers', true)::json->>'x-real-ip', ''),
      'unknown'
    );
    -- x-forwarded-for can be a comma-separated list; keep the first client IP
    v_ip := split_part(v_ip, ',', 1);
  EXCEPTION WHEN OTHERS THEN
    v_ip := 'unknown';
  END;

  v_hash := md5(v_ip);
  v_bucket := date_trunc('minute', now());

  -- Clean up old throttle rows so the table stays small
  DELETE FROM public.app_error_throttle WHERE bucket < now() - INTERVAL '1 hour';

  -- Check current bucket count
  SELECT count INTO v_count
  FROM public.app_error_throttle
  WHERE ip_hash = v_hash AND bucket = v_bucket;

  IF COALESCE(v_count, 0) >= v_limit THEN
    RETURN; -- rate limit exceeded; silently drop
  END IF;

  -- Insert the error
  INSERT INTO public.app_errors (message, stack, url, user_id, tenant_id, user_agent)
  VALUES (
    payload->>'message',
    payload->>'stack',
    payload->>'url',
    NULLIF(payload->>'user_id', '')::UUID,
    NULLIF(payload->>'tenant_id', '')::UUID,
    payload->>'user_agent'
  );

  -- Increment throttle counter
  INSERT INTO public.app_error_throttle (ip_hash, bucket, count)
  VALUES (v_hash, v_bucket, 1)
  ON CONFLICT (ip_hash, bucket)
  DO UPDATE SET count = public.app_error_throttle.count + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_app_error(JSONB) TO anon, authenticated;
