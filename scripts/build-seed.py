#!/usr/bin/env python3
"""Génère db/seed.sql : fusion propre des exports SQL hétérogènes du dépôt."""
import re, sys, io

SRC_UPDATED  = "db/legacy-exports/export_database_2iae_updated.sql"
SRC_COMPLETE = "db/legacy-exports/database_export_complete.sql"

def tokenize_values(text):
    """Découpe le bloc VALUES en tuples, en respectant les chaînes '' échappées."""
    tuples, buf, depth, i, in_str = [], [], 0, 0, False
    n = len(text)
    while i < n:
        c = text[i]
        if in_str:
            if c == "'":
                if i + 1 < n and text[i+1] == "'":
                    buf.append("''"); i += 2; continue
                in_str = False
            buf.append(c); i += 1; continue
        if c == "'":
            in_str = True; buf.append(c); i += 1; continue
        if c == "(":
            depth += 1
            if depth == 1:
                buf = []; i += 1; continue
        elif c == ")":
            depth -= 1
            if depth == 0:
                tuples.append("".join(buf)); i += 1; continue
        if depth >= 1:
            buf.append(c)
        i += 1
    return tuples

def split_fields(tup):
    """Découpe un tuple en champs sur les virgules hors chaînes."""
    out, buf, in_str, i, n = [], [], False, 0, len(tup)
    while i < n:
        c = tup[i]
        if in_str:
            if c == "'":
                if i + 1 < n and tup[i+1] == "'":
                    buf.append("''"); i += 2; continue
                in_str = False
            buf.append(c); i += 1; continue
        if c == "'":
            in_str = True; buf.append(c); i += 1; continue
        if c == ",":
            out.append("".join(buf).strip()); buf = []; i += 1; continue
        buf.append(c); i += 1
    out.append("".join(buf).strip())
    return out

def extract(path, table, expected):
    """Extrait les tuples des INSERT visant `table` dans `path`."""
    src = open(path, encoding="utf8").read()
    rows = []
    pat = re.compile(r'INSERT\s+INTO\s+(?:public\.)?"?%s"?\s*(?:\([^)]*\))?\s*VALUES' % table,
                     re.I)
    for m in pat.finditer(src):
        # bloc jusqu'au ';' terminal hors chaîne
        j, in_str, n = m.end(), False, len(src)
        while j < n:
            c = src[j]
            if in_str:
                if c == "'":
                    if j + 1 < n and src[j+1] == "'": j += 2; continue
                    in_str = False
            elif c == "'": in_str = True
            elif c == ";": break
            j += 1
        for t in tokenize_values(src[m.end():j]):
            f = split_fields(t)
            if len(f) != expected:
                sys.exit(f"!! {table} dans {path}: {len(f)} champs au lieu de {expected}\n{t[:200]}")
            rows.append(f)
    return rows

def fix(val, col):
    """Corrige les pièges: '' -> NULL sur les FK, order entier -> texte."""
    v = val.strip()
    if col in ("created_by", "updated_by") and v in ("''", "'"+"'"):
        return "NULL"
    if col == '"order"' and re.fullmatch(r"\d+", v):
        return "'%s'" % v          # la colonne est TEXT dans le schéma Drizzle
    return v

def emit(out, table, cols, rows, note=""):
    if not rows:
        return 0
    out.write(f"\n-- {table} : {len(rows)} ligne(s){note}\n")
    out.write("INSERT INTO %s (%s) VALUES\n" % (table, ", ".join(cols)))
    body = []
    for r in rows:
        vals = [fix(v, c) for v, c in zip(r, cols)]
        body.append("  (" + ", ".join(vals) + ")")
    out.write(",\n".join(body))
    out.write("\nON CONFLICT (id) DO NOTHING;\n")
    return len(rows)

SLIDERS = ["id","title","subtitle","description","image_url","button1_text","button1_link",
           "button2_text","button2_link","is_active",'"order"',"created_at","updated_at","created_by"]
NEWS    = ["id","title","summary","content","image_url","date","category","author","featured",
           "is_active",'"order"',"created_at","updated_at","created_by","slug"]
NEWSIMG = ["id","news_id","image_url","caption",'"order"',"created_at"]
FOUNDER = ["id","title","quote","vision","founder_name","founder_role","founder_organization",
           "founder_image_url","is_active","created_at","updated_at","updated_by"]
INSTIT  = ["id","title","description","link","button_text","bg_color","is_active",'"order"',
           "created_at","updated_at","created_by"]
PROGRAM = ["id","name","category","description","image_url","duration","level","is_active",
           '"order"',"created_at","updated_at","created_by"]
CONTENT = ["id","key","title","value","type","section",'"order"',"updated_at","updated_by"]

out = io.StringIO()
out.write("""-- =====================================================================
-- 2IAE International — seed de contenu consolidé
-- =====================================================================
-- GÉNÉRÉ automatiquement par scripts/build-seed.py à partir des exports
-- historiques du dépôt. Ne pas éditer à la main : régénérer.
--
-- Prérequis : le schéma doit déjà exister (`npm run db:push`), qui fait
-- foi via shared/schema.ts. Ce fichier n'insère QUE des données.
--
-- Idempotent : ON CONFLICT (id) DO NOTHING — rejouable sans risque.
--
-- Corrections appliquées par rapport aux exports d'origine :
--   1. Colonnes nommées explicitement. Les exports utilisaient des INSERT
--      positionnels alors que l'ordre des colonnes de `news` diffère entre
--      les exports et shared/schema.ts (`slug` en dernier vs en 3e) — un
--      INSERT positionnel écrivait le slug dans `summary`.
--   2. created_by / updated_by : '' remplacé par NULL. Ces colonnes sont des
--      clés étrangères vers admin_users(id) ; la chaîne vide violait la
--      contrainte et faisait échouer tout l'import.
--   3. "order" : valeurs entières converties en texte ('1' au lieu de 1),
--      la colonne étant TEXT dans shared/schema.ts.
--
-- Non seedé volontairement :
--   admin_users  -> créé au démarrage par ensureAdminExists() depuis
--                   ADMIN_USERNAME / ADMIN_PASSWORD (server/auth.ts)
--   session, users, contacts, chat_messages -> données d'exécution
--   projects     -> aucune donnée dans aucun export du dépôt
-- =====================================================================

BEGIN;
""")

total = 0
total += emit(out, "sliders",        SLIDERS, extract(SRC_UPDATED,  "sliders", 14),
              "  [source: export_database_2iae_updated.sql — images locales]")
total += emit(out, "institutes",     INSTIT,  extract(SRC_UPDATED,  "institutes", 11),
              "  [source: export_database_2iae_updated.sql]")
total += emit(out, "programs",       PROGRAM, extract(SRC_UPDATED,  "programs", 12),
              "  [source: export_database_2iae_updated.sql]")
total += emit(out, "founder_message",FOUNDER, extract(SRC_UPDATED,  "founder_message", 12),
              "  [source: export_database_2iae_updated.sql]")
total += emit(out, "news",           NEWS,    extract(SRC_UPDATED,  "news", 15),
              "  [source: export_database_2iae_updated.sql]")
total += emit(out, "site_content",   CONTENT, extract(SRC_COMPLETE, "site_content", 9),
              "  [source: database_export_complete.sql]")
total += emit(out, "news_images",    NEWSIMG, extract(SRC_COMPLETE, "news_images", 6),
              "  [source: database_export_complete.sql — après news, FK]")

out.write("\nCOMMIT;\n")
open("db/seed.sql", "w", encoding="utf8").write(out.getvalue())
print(f"db/seed.sql généré — {total} lignes de contenu")
