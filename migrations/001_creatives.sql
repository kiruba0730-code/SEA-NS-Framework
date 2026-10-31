CREATE TABLE creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  offer text,
  audience text NOT NULL,
  platform text NOT NULL,
  tone text NOT NULL,
  goal text NOT NULL,
  brief text NOT NULL,
  status text NOT NULL DEFAULT 'generated',
  concepts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
)