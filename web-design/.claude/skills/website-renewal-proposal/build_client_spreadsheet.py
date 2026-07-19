#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
クライアント提出用スプレッドシート(xlsx, 複数タブ)を作るためのテンプレート。

使い方:
1. このファイルを案件フォルダにコピーする
   (例: clients/<client>/<project>/build_spreadsheet.py)
2. 下の BASE / OUT / SHEETS を案件の実際のファイルパス・タブ構成に書き換える
3. `python3 build_spreadsheet.py` を実行して xlsx を生成する
4. 生成したファイルは案件フォルダに保存してgit管理する
   (Google Drive MCPへの直接アップロードは大きいファイルで失敗することがあるため、
    SKILL.mdの「重要な制約」を参照し、ユーザーに手動アップロードを案内する)

トーン&マナー(web-design/CLAUDE.md 標準)は変更しない。変えてよいのは
BASE/OUT/SHEETS の中身と、06のような非CSVセクションの本文だけ。
"""
import csv
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.utils import get_column_letter

# ============================================================
# 1) ここを案件ごとに書き換える
# ============================================================
BASE = "clients/<client>/<project>"          # CSVの置き場
OUT = f"{BASE}/<Client>_<project>_提出用.xlsx"  # 出力先

# 各タブ: (シート名, タイトル, 説明文, CSVパス, 列幅リスト,
#          tag_col_idx, class_col_idx, priority_col_idx)
# tag_col_idx / class_col_idx / priority_col_idx はハイライト対象列(0始まり)。
# 使わないものは None にする。
SHEETS = [
    dict(
        name="03_ディレクトリマップ",
        title="03. ディレクトリマップ",
        subtitle="現行ページ階層の棚卸し＋改修後の構成。第1階層セルの色は既存/新設/レガシーの区分を示す。",
        csv=f"{BASE}/03-directory-map.csv",
        col_widths=[16, 16, 18, 14, 30, 16, 10, 16, 34, 30, 30],
        tag_col_idx=0,
        class_col_idx=None,
        priority_col_idx=None,
    ),
    # 他のタブも同様に追加する
]

# ============================================================
# 2) トーン&マナー（web-design標準。基本ここは変えない）
# ============================================================
HEADER_FILL = PatternFill("solid", fgColor="333333")
HEADER_FONT = Font(color="FFFFFF", bold=True, size=10, name="Meiryo UI")
TITLE_FILL = PatternFill("solid", fgColor="F2F2F2")
TITLE_FONT = Font(color="1A1A1A", bold=True, size=13, name="Meiryo UI")
SUBTITLE_FONT = Font(color="666666", size=9, italic=True, name="Meiryo UI")
BODY_FONT = Font(size=9.5, name="Meiryo UI")
BAND_FILL = PatternFill("solid", fgColor="F7F7F7")
THIN = Side(style="thin", color="D9D9D9")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top", horizontal="left")
WRAP_C = Alignment(wrap_text=True, vertical="center", horizontal="center")

# 区分の色分けは淡いパステルのみ（原色は使わない）
TAG_FILLS = {
    "既存": PatternFill("solid", fgColor="EAF0F6"),
    "新設": PatternFill("solid", fgColor="FBF3DE"),
    "レガシー": PatternFill("solid", fgColor="F7E6E4"),
    "拡張": PatternFill("solid", fgColor="EDF3EA"),
    "刷新": PatternFill("solid", fgColor="FBF3DE"),
}
CLASS_FILLS = {
    "Shopify標準": PatternFill("solid", fgColor="EAF0F6"),
    "Shopifyアプリ": PatternFill("solid", fgColor="FBF3DE"),
    "独自開発": PatternFill("solid", fgColor="F1EAF6"),
}
PRIORITY_FONT = {
    "Must": Font(size=9.5, bold=True, color="1A1A1A", name="Meiryo UI"),
    "Should": Font(size=9.5, color="4D4D4D", name="Meiryo UI"),
    "Could": Font(size=9.5, color="808080", name="Meiryo UI"),
}


def tag_fill_for(value: str):
    if not value:
        return None
    for key, fill in TAG_FILLS.items():
        if key in value:
            return fill
    return None


def read_csv(path):
    with open(path, encoding="utf-8") as f:
        rows = list(csv.reader(f))
    return rows[0], rows[1:]


def setup_sheet(ws, title, subtitle, header, col_widths, freeze="A3"):
    ncols = len(header)
    last_col = get_column_letter(ncols)
    ws.merge_cells(f"A1:{last_col}1")
    ws["A1"] = title
    ws["A1"].font = TITLE_FONT
    ws["A1"].fill = TITLE_FILL
    ws["A1"].alignment = Alignment(vertical="center", horizontal="left", indent=1)
    ws.row_dimensions[1].height = 26

    ws.merge_cells(f"A2:{last_col}2")
    ws["A2"] = subtitle
    ws["A2"].font = SUBTITLE_FONT
    ws["A2"].alignment = Alignment(vertical="center", horizontal="left", indent=1)
    ws.row_dimensions[2].height = 16

    for i, h in enumerate(header, start=1):
        c = ws.cell(row=3, column=i, value=h)
        c.font = HEADER_FONT
        c.fill = HEADER_FILL
        c.border = BORDER
        c.alignment = WRAP_C
    ws.row_dimensions[3].height = 28

    for i, w in enumerate(col_widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    ws.freeze_panes = freeze
    ws.sheet_view.showGridLines = False
    return 4


def write_rows(ws, start_row, rows, tag_col_idx=None, class_col_idx=None,
               priority_col_idx=None, band=True):
    r = start_row
    for row_i, row in enumerate(rows):
        fill = None
        if tag_col_idx is not None:
            fill = tag_fill_for(row[tag_col_idx])
        if class_col_idx is not None and fill is None:
            for key, f in CLASS_FILLS.items():
                if key in row[class_col_idx]:
                    fill = f
                    break
        if fill is None and band and row_i % 2 == 1:
            fill = BAND_FILL

        for ci, val in enumerate(row, start=1):
            cell = ws.cell(row=r, column=ci, value=val)
            cell.border = BORDER
            cell.alignment = WRAP
            font = BODY_FONT
            if priority_col_idx is not None and ci - 1 == priority_col_idx:
                font = PRIORITY_FONT.get(val, BODY_FONT)
                cell.alignment = WRAP_C
            cell.font = font
            if fill:
                cell.fill = fill
        maxlen = max((len(str(v)) for v in row), default=0)
        ws.row_dimensions[r].height = max(16, min(90, 14 + maxlen // 10 * 4))
        r += 1
    return r


def main():
    wb = Workbook()
    wb.remove(wb.active)
    for sheet_cfg in SHEETS:
        header, rows = read_csv(sheet_cfg["csv"])
        ws = wb.create_sheet(sheet_cfg["name"])
        start = setup_sheet(
            ws, sheet_cfg["title"], sheet_cfg["subtitle"], header,
            sheet_cfg["col_widths"],
        )
        write_rows(
            ws, start, rows,
            tag_col_idx=sheet_cfg.get("tag_col_idx"),
            class_col_idx=sheet_cfg.get("class_col_idx"),
            priority_col_idx=sheet_cfg.get("priority_col_idx"),
        )
    wb.save(OUT)
    print("saved:", OUT)


if __name__ == "__main__":
    main()
