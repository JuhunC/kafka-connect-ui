-- ConnectLens demo schema (inventory database).
-- Debezium's PG source connector (pg-inventory-source) does CDC off public.customers.
-- The datagen container periodically INSERT/UPDATEs this table so events keep flowing.

-- Replica identity FULL so UPDATE/DELETE events carry the full "before" image,
-- which makes the CDC stream (and the demo) much nicer to look at.
CREATE TABLE IF NOT EXISTS public.customers (
    id          SERIAL PRIMARY KEY,
    first_name  VARCHAR(100)  NOT NULL,
    last_name   VARCHAR(100)  NOT NULL,
    email       VARCHAR(255)  NOT NULL,
    tier        VARCHAR(20)   NOT NULL DEFAULT 'standard',
    balance     NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE public.customers REPLICA IDENTITY FULL;

-- A little seed data so the very first snapshot is non-empty.
INSERT INTO public.customers (first_name, last_name, email, tier, balance) VALUES
    ('Ada',    'Lovelace',  'ada@example.com',    'gold',     1000.00),
    ('Alan',   'Turing',    'alan@example.com',   'gold',      850.50),
    ('Grace',  'Hopper',    'grace@example.com',  'silver',    420.00),
    ('Linus',  'Torvalds',  'linus@example.com',  'standard',  120.75),
    ('Margaret','Hamilton', 'margaret@example.com','gold',     990.00)
ON CONFLICT DO NOTHING;
