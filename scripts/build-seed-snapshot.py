"""Builds lib/seed-snapshot.json from supabase/seed.sql (VS-10 Reset demo).

Reads the INSERT statements' tuples and keeps the fields Reset demo restores.
Run: python scripts/build-seed-snapshot.py
"""
import json, re

sql = open("supabase/seed.sql", encoding="utf-8").read()


def tuples(table):
    m = re.search(r"INSERT INTO " + table + r" \((.*?)\) VALUES\n(.*?);\n", sql, re.S)
    cols = [c.strip() for c in m.group(1).split(",")]
    body, rows, i = m.group(2), [], 0
    while i < len(body):
        if body[i] != "(":
            i += 1
            continue
        i += 1
        vals, cur, depth = [], "", 0
        while True:
            c = body[i]
            if c == "'":  # SQL string, '' escapes a quote
                j, s = i + 1, ""
                while True:
                    if body[j] == "'" and body[j + 1 : j + 2] == "'":
                        s += "'"; j += 2
                    elif body[j] == "'":
                        break
                    else:
                        s += body[j]; j += 1
                cur += json.dumps(s); i = j + 1; continue
            if c in "[(":
                depth += 1
            if c in "])":
                if depth == 0:
                    vals.append(cur.strip()); i += 1; break
                depth -= 1
            if c == "," and depth == 0:
                vals.append(cur.strip()); cur = ""; i += 1; continue
            cur += c; i += 1
        rows.append(dict(zip(cols, vals)))
    return rows


def val(v):
    if v.upper() == "NULL":
        return None
    if v.startswith('"'):
        return json.loads(v)
    if v.lower() in ("true", "false"):
        return v.lower() == "true"
    if v.startswith("ARRAY"):
        return [json.loads(x) for x in re.findall(r'"(?:[^"\]|\.)*"', v)]
    try:
        return int(v)
    except ValueError:
        return v


def clean(rows, keep):
    return [{k: val(r[k]) for k in keep} for r in rows]


snap = {
    "reps": clean(tuples("reps"), ["id", "voice_note"]),
    "signals": clean(tuples("signals"), ["id", "status"]),
    "opportunities": clean(
        tuples("opportunities"),
        ["id", "stage", "pushed_at", "sent_at", "email_subject", "email_body"],
    ),
}
json.dump(snap, open("lib/seed-snapshot.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print({k: len(v) for k, v in snap.items()})
