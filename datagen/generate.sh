#!/bin/sh
# ConnectLens datagen — keeps CDC flowing by mutating public.customers.
#
# Every INTERVAL_SECONDS it either INSERTs a new customer or UPDATEs an existing
# one. Uses psql from the postgres:16 image and awk for randomness (POSIX sh /
# dash has no $RANDOM). Connection params come from PG* env vars.
set -eu

INTERVAL="${INTERVAL_SECONDS:-5}"

echo "[datagen] waiting for postgres at ${PGHOST}:${PGPORT} ..."
until psql -c 'SELECT 1' >/dev/null 2>&1; do
    sleep 2
done
echo "[datagen] connected. mutating public.customers every ${INTERVAL}s"

FIRST_NAMES="Sam Jordan Riley Casey Morgan Taylor Jamie Avery Quinn Rowan Skyler Devon"
LAST_NAMES="Ng Patel Kim Silva Nguyen Cohen Rossi Diaz Khan Owens Blum Frost"
TIERS="standard silver gold"

# rand_int MAX -> integer in [0, MAX)   (awk seeded per-call so values vary)
rand_int() {
    awk -v max="$1" -v seed="$(date +%s%N)$$" \
        'BEGIN { srand(seed); printf "%d", int(rand() * max) }'
}

# rand_word "a b c" -> one random element
rand_word() {
    set -- $1
    n=$#
    idx=$(( $(rand_int "$n") + 1 ))
    eval "echo \${$idx}"
}

i=0
while true; do
    i=$(( i + 1 ))
    action=$(rand_int 3)

    if [ "$action" -eq 0 ]; then
        # INSERT a new customer
        fn=$(rand_word "$FIRST_NAMES")
        ln=$(rand_word "$LAST_NAMES")
        tier=$(rand_word "$TIERS")
        bal=$(rand_int 5000)
        email="${fn}.${ln}.${i}@example.com"
        psql -v ON_ERROR_STOP=0 -c \
            "INSERT INTO public.customers (first_name, last_name, email, tier, balance)
             VALUES ('${fn}', '${ln}', '${email}', '${tier}', ${bal});" \
            >/dev/null 2>&1 \
            && echo "[datagen] INSERT ${fn} ${ln} (${tier}, ${bal})"
    else
        # UPDATE a random existing customer
        tier=$(rand_word "$TIERS")
        delta=$(( $(rand_int 400) - 200 ))
        psql -v ON_ERROR_STOP=0 -c \
            "UPDATE public.customers
                SET balance = GREATEST(0, balance + ${delta}),
                    tier = '${tier}',
                    updated_at = now()
              WHERE id = (SELECT id FROM public.customers ORDER BY random() LIMIT 1);" \
            >/dev/null 2>&1 \
            && echo "[datagen] UPDATE random customer (tier=${tier}, delta=${delta})"
    fi

    sleep "$INTERVAL"
done
