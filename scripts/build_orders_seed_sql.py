#!/usr/bin/env python3
"""ledger_input.tsv → supabase/seed_orders_from_ledger.sql (DO $$ ... uid ... $$)"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "scripts" / "ledger_input.tsv"
OUTPUT = ROOT / "supabase" / "seed_orders_from_ledger.sql"


def parse_date(raw: str) -> str | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    m = re.match(r"^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\s*$", raw)
    if not m:
        return None
    y, mo, d = m.groups()
    return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"


def parse_money(raw: str) -> float | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    # strip currency symbols and thousands separators
    cleaned = re.sub(r"[^\d.\-]", "", raw.replace(",", ""))
    if cleaned in {"", ".", "-", "-."}:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_bool(raw: str) -> bool:
    return str(raw).strip().upper() == "TRUE"


def sql_str(s: str | None) -> str:
    if s is None or s == "":
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def sql_num(v: float | None) -> str:
    if v is None:
        return "NULL"
    return f"{v:.2f}"


def sql_date(d: str | None) -> str:
    if d is None:
        return "NULL"
    return f"{sql_str(d)}::date"


def main() -> None:
    lines = INPUT.read_text(encoding="utf-8").splitlines()
    rows_sql: list[str] = []

    for i, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        parts = line.split("\t")
        while len(parts) < 13:
            parts.append("")
        if len(parts) > 13:
            parts = parts[:12] + ["\t".join(parts[12:]).strip()]

        (
            product_name,
            proc,
            platform,
            method,
            account,
            purchase_raw,
            deposit_raw,
            price_raw,
            dep_amt_raw,
            profit_raw,
            delivered,
            memo,
            notes,
        ) = parts[:13]

        product_name = product_name.strip()
        if not product_name:
            continue

        purchase_date = parse_date(purchase_raw)
        if not purchase_date:
            raise SystemExit(f"line {i}: bad purchase_date {purchase_raw!r} product={product_name!r}")

        deposit_date = parse_date(deposit_raw)
        purchase_price = parse_money(price_raw)
        if purchase_price is None:
            raise SystemExit(f"line {i}: missing purchase price for {product_name!r}")

        deposit_amount = parse_money(dep_amt_raw)
        profit = parse_money(profit_raw)

        platform = platform.strip() or "기타"
        method = method.strip() or None
        account = account.strip() or None
        memo = memo.strip() or None
        notes = notes.strip() or None

        rows_sql.append(
            "    (uid, "
            f"{sql_str(product_name)}, "
            f"{str(parse_bool(proc)).lower()}, "
            f"{sql_str(platform)}, "
            f"{sql_str(method)}, "
            f"{sql_str(account)}, "
            f"{sql_date(purchase_date)}, "
            f"{sql_date(deposit_date)}, "
            f"{sql_num(purchase_price)}, "
            f"{sql_num(deposit_amount)}, "
            f"{sql_num(profit)}, "
            f"{str(parse_bool(delivered)).lower()}, "
            f"{sql_str(memo)}, "
            f"{sql_str(notes)}"
            ")"
        )

    body = ",\n".join(rows_sql)

    out = f"""-- Seed: spreadsheet 장부 → public.orders
-- Usage (Supabase SQL Editor):
-- 1) Authentication → Users 에서 본인 User UID 복사
-- 2) 아래 11111111-1111-1111-1111-111111111111 을 본인 UID로 바꿔 치환 (전체 일괄)
-- 3) Run (auth.users 에 해당 UID가 있어야 FK 통과)
-- 주의: 기존 동일 user_id 행과 중복을 원치 않으면 먼저 DELETE 하거나 다른 계정 사용

do $seed$
declare
  uid uuid := '11111111-1111-1111-1111-111111111111'::uuid;
begin
  insert into public.orders (
    user_id,
    product_name,
    is_processed,
    payment_platform,
    payment_method,
    buyer_account_label,
    purchase_date,
    deposit_date,
    purchase_price_krw,
    deposit_amount_krw,
    profit_krw,
    is_item_delivered,
    deposit_memo,
    notes
  )
  values
{body};
end $seed$;
"""

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(out, encoding="utf-8")
    print(f"Wrote {OUTPUT} ({len(rows_sql)} rows)")


if __name__ == "__main__":
    main()
