#!/usr/bin/env python3
"""Apply .sql migration files in order over a direct Postgres connection.

Reads DATABASE_URL from the environment (the project's Postgres URI, incl.
password). DDL only needs a one-time run; PostgREST keys cannot do this.

Usage:
    export DATABASE_URL='postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres?sslmode=require'
    python supabase/apply_migrations.py supabase/migrations/0001_init.sql supabase/migrations/0002_seed_skills.sql
"""
import os
import sys

try:
    import psycopg2
except ImportError:
    sys.exit("Missing dependency: pip install psycopg2-binary")

url = os.environ.get("DATABASE_URL")
if not url:
    sys.exit("Set DATABASE_URL (the Postgres connection string).")
files = sys.argv[1:]
if not files:
    sys.exit("Pass one or more .sql files to apply, in order.")

conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()
for f in files:
    sql = open(f).read()
    print(f"applying {f} ({len(sql)} bytes) ...")
    cur.execute(sql)
    print("  ok")
cur.close()
conn.close()
print("all migrations applied")
