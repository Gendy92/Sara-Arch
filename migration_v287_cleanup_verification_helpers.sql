-- Migration v287 — Clean up temporary verification helpers
--
-- The __check_security_advisor function and __verify_results table were
-- created to run automated verification checks. They are removed now that
-- the checks have passed.

DROP FUNCTION IF EXISTS public.__check_security_advisor();
DROP TABLE IF EXISTS public.__verify_results;
