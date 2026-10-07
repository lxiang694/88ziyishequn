-- Run once in Supabase SQL Editor. No modifications to orders or existing transfer data.
BEGIN;
CREATE TABLE IF NOT EXISTS public.myship_label_requests (
  id uuid PRIMARY KEY,
  order_nos text[] NOT NULL CHECK (cardinality(order_nos) BETWEEN 1 AND 500),
  created_by bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.myship_label_receipts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.myship_label_requests(id),
  order_no text NOT NULL CHECK (order_no ~ '^CM[0-9]{13}$'),
  status text NOT NULL CHECK (status IN ('pending','pdf_ready','failed','uploading','uncertain','uploaded')),
  pdf_sha256 text NOT NULL DEFAULT '' CHECK (pdf_sha256 = '' OR pdf_sha256 ~ '^[a-f0-9]{64}$'),
  tracking text NOT NULL DEFAULT '',
  carrier text NOT NULL DEFAULT '',
  progress integer CHECK (progress IS NULL OR progress = 100),
  verification text NOT NULL CHECK (verification IN ('rows','manual')),
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id, order_no),
  CHECK (status <> 'uploaded' OR (pdf_sha256 <> '' AND (verification = 'manual' OR (progress = 100 AND tracking <> '' AND carrier <> ''))))
);
CREATE INDEX IF NOT EXISTS myship_label_receipts_order_idx ON public.myship_label_receipts(order_no);
ALTER TABLE public.myship_label_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.myship_label_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.myship_label_requests, public.myship_label_receipts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.myship_label_requests, public.myship_label_receipts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.myship_label_receipts_id_seq TO service_role;
CREATE OR REPLACE FUNCTION public.myship_label_preserve_success() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'uploaded' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS myship_label_preserve_success ON public.myship_label_receipts;
CREATE TRIGGER myship_label_preserve_success BEFORE UPDATE ON public.myship_label_receipts
FOR EACH ROW EXECUTE FUNCTION public.myship_label_preserve_success();
COMMIT;
