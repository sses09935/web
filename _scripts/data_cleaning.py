import os
import json
import re
import pandas as pd
import numpy as np

# 1. 定義 Sheet 與類別映射關係 (與 ignored private resources.json 輸出一致)
SUBCAT_TO_CAT = {
    'C單位': '輔具與交通環境',
    '交通接送': '輔具與交通環境',
    '健康維護': '照顧與專業服務',
    '團體家屋': '失智專責資源',
    '失智共同照護中心': '失智專責資源',
    '失智專責專區機構': '失智專責資源',
    '失智社區服務據點': '失智專責資源',
    '家事服務員': '照顧與專業服務',
    '專業服務': '照顧與專業服務',
    '居家喘息': '喘息與住宿機構',
    '居家服務': '照顧與專業服務',
    '居家醫療整合資源': '照顧與專業服務',
    '機構喘息': '喘息與住宿機構',
    '生活照顧': '照顧與專業服務',
    '社區喘息': '喘息與住宿機構',
    '社區資源': '輔具與交通環境',
    '精神復健機構(康復之家)': '喘息與住宿機構',
    '經濟安全': '輔具與交通環境',
    '老人日照': '照顧與專業服務',
    '護理之家': '喘息與住宿機構',
    '身心障礙福利機構': '喘息與住宿機構',
    '身障日照': '照顧與專業服務',
    '身障資源中心': '輔具與交通環境',
    '輔具特約': '輔具與交通環境',
    '輔具租賃': '輔具與交通環境',
    '送餐單位': '照顧與專業服務',
    '養護、長期照護': '喘息與住宿機構'
}

# 2. 定義 Raw Sheet 到 Geo Sheet 的對應 (解決部分 Sheet 命名的細微出入)
RAW_TO_GEO_SHEET = {
    "C單位": "巷弄長照站",
    "失智共同照護中心": "失智共同照顧中心",
}

# 3. 定義每個 Sheet 的欄位對應規則
FIELD_CONFIGS = {
    "default": {
        "raw_name_cols": ["單位", "名稱", "特約門市名稱", "機構名稱", "服務單位名稱", "服務單位名稱1", "特約門市名稱1", "交通單位"],
        "raw_addr_cols": ["地址", "據點地址", "機構地址", "中心地址", "特約門市地址", "特約門市地址1", "機構(服務)地址"],
        "raw_phone_cols": ["電話", "聯絡電話", "電話/傳真", "預約方式"],
        "geo_name_cols": ["服務單位名稱", "單位", "名稱", "交通單位", "特約門市名稱", "機構名稱", "家事服務員", "送餐單位", "巷弄長照站", "社區資源", "失智共同照顧中心", "失智社區服務據點", "團體家屋", "失智專責專區機構", "身障資源中心", "身心障礙福利機構", "精神復健機構(康復之家)", "養護、長期照護", "護理之家", "居家醫療整合資源", "經濟安全", "健康維護", "生活照顧"],
        "geo_addr_cols": ["機構地址", "地址", "中心地址", "據點地址", "特約門市地址", "地址1", "機構(服務)地址"]
    }
}

# 垃圾欄位名稱列過濾器，用來徹底排除 Excel 中的重複標題行
INVALID_NAME_VALUES = {
    "單位", "名稱", "交通單位", "特約門市名稱", "機構名稱", 
    "服務單位名稱", "特約門市名稱1", "服務單位名稱1", "序號", "序 號", "序  號"
}

def clean_text(val):
    """清理文字雜質：移除 \n、多餘空白，統一台/臺與全半形字元"""
    if pd.isna(val):
        return ""
    val_str = str(val).strip()
    # 移除 \n 與所有多餘的空白/換行
    val_str = re.sub(r'\s+', '', val_str)
    # 統一「台」與「臺」
    val_str = val_str.replace("台", "臺")
    # 統一括號 (全形轉半形，方便匹配)
    val_str = val_str.replace("（", "(").replace("）", ")")
    return val_str

TAIWAN_CITIES = {
    "中正區": "臺北市", "萬華區": "臺北市", "大同區": "臺北市", "中山區": "臺北市", 
    "松山區": "臺北市", "大安區": "臺北市", "信義區": "臺北市", "內湖區": "臺北市", 
    "南港區": "臺北市", "士林區": "臺北市", "北投區": "臺北市", "文山區": "臺北市",
    "板橋區": "新北市", "新莊區": "新北市", "中和區": "新北市", "永和區": "新北市", 
    "土城區": "新北市", "樹林區": "新北市", "三峽區": "新北市", "鶯歌區": "新北市", 
    "三重區": "新北市", "蘆洲區": "新北市", "五股區": "新北市", "泰山區": "新北市", 
    "林口區": "新北市", "八里區": "新北市", "淡水區": "新北市", "三芝區": "新北市", 
    "石門區": "新北市", "金山區": "新北市", "萬里區": "新北市", "汐止區": "新北市", 
    "瑞芳區": "新北市", "貢寮區": "新北市", "平溪區": "新北市", "雙溪區": "新北市", 
    "新店區": "新北市", "深坑區": "新北市", "石碇區": "新北市", "坪林區": "新北市", "烏來區": "新北市"
}

def normalize_address(addr):
    """從地址中精準萃取縣市與行政區，並產生去除雜訊的導航專用地址"""
    if not addr or pd.isna(addr):
        return "未分類", ""
        
    addr_str = str(addr).strip().replace("巿", "市")
    
    # 移除括號
    addr_str = re.sub(r'\(.*?\)|（.*?）', '', addr_str).strip()
    
    # 剔除樓層資訊
    nav_addr = re.sub(r'\d+[Ff樓].*$', '', addr_str).strip()
    # 特殊處理一些殘留字，如只剩下 "號" 之後的 "之X" 或 "號1" 這種錯誤格式
    nav_addr = re.sub(r'(號)\s*\d+$', r'\1', nav_addr).strip()
    nav_addr = re.sub(r'(號).*之\d+$', r'\1', nav_addr).strip()
    
    district = "未分類"
    
    # 規則1: 完整包含縣市
    match = re.search(r'(臺北市|台北市|新北市|基隆市|桃園市|新竹市|新竹縣|苗栗縣|臺中市|台中市|彰化縣|南投縣|雲林縣|嘉義市|嘉義縣|臺南市|台南市|高雄市|屏東縣|宜蘭縣|花蓮縣|臺東縣|台東縣|澎湖縣|金門縣|連江縣)\s*(.{1,3}?(?:區|鄉|鎮|市))', nav_addr)
    if match:
        city = match.group(1).replace('台北', '臺北').replace('台中', '臺中').replace('台南', '臺南').replace('台東', '臺東')
        dist = match.group(2).strip()
        if len(dist) >= 2:
            district = f"{city}{dist}"
    else:
        # 規則2: 透過 mapping 補齊縣市
        match_fallback = re.search(r'^(.{2,3}?(?:區|鄉|鎮|市))', nav_addr)
        if match_fallback:
            dist = match_fallback.group(1).strip()
            if dist in TAIWAN_CITIES:
                city = TAIWAN_CITIES[dist]
                district = f"{city}{dist}"
                nav_addr = f"{city}{nav_addr}"
                
    # 無效地址判定 (如果字串太短，或者缺乏基本的道路指示)
    if len(nav_addr) < 5 or not re.search(r'(區|鄉|鎮|市|路|街|道|巷)', nav_addr):
        nav_addr = ""
                
    return district, nav_addr

def simplify_text(text, max_len=45):
    """清除換行與連續空白，並套用長度限制"""
    if not text or pd.isna(text): return ""
    t = re.sub(r'\s+', ' ', str(text)).strip()
    if len(t) > max_len:
        t = t[:max_len] + "..."
    return t

def simplify_referral(text):
    """轉介條件式簡化 (CRITICAL)"""
    if not text or pd.isna(text): return ""
    t = re.sub(r'\s+', ' ', str(text)).strip()
    
    # 包含實體聯絡資訊：絕對不可替換，保留原文
    if re.search(r'(LINE|http|www|電話：|@)', t, re.IGNORECASE):
        return simplify_text(t, 45)
        
    # 若僅包含「轉介」或類似字眼，替換為「需單位轉介」
    if t in ["轉介"] or "提供各單位轉介過去" in t or "長照中心轉介" in t or "照專轉介" in t:
        return "需單位轉介"
        
    # 若為線上登記表、申請等
    if re.search(r'(線上|民眾|自行|登記表|申請)', t):
        # 簡化為「可自行申請」，並保留原有的表單名稱
        # 避免文字太長，先截斷 t 再組合
        short_t = simplify_text(t, 35)
        return f"可自行申請 ({short_t})"
        
    return simplify_text(t, 45)

def parse_geo_helper(df_geo, geo_sheet):
    """從 Geo Sheet 中解析出正規化後的 (名稱, 經緯度) 對照字典"""
    geo_dict = {}
    
    # 找出名稱與經緯度欄位
    name_col = None
    lat_col = None
    lng_col = None
    
    # 特殊處理：輔具特約 (並排多欄位)
    if geo_sheet == "輔具特約":
        triplets = [
            ("特約門市名稱1", "Latitude", "Longitude"),
            ("特約門市名稱2", "Latitude.1", "Longitude.1"),
            ("特約門市名稱3", "Latitude.2", "Longitude.2")
        ]
        for n_col, lt_col, lg_col in triplets:
            if n_col in df_geo.columns and lt_col in df_geo.columns and lg_col in df_geo.columns:
                for _, row in df_geo.iterrows():
                    n_val = row[n_col]
                    lt_val = row[lt_col]
                    lg_val = row[lg_col]
                    if pd.notna(n_val) and pd.notna(lt_val) and pd.notna(lg_val):
                        clean_n = clean_text(n_val)
                        try:
                            geo_dict[clean_n] = (float(lt_val), float(lg_val))
                        except ValueError:
                            pass
        return geo_dict

    # 尋找名稱欄位
    for col in FIELD_CONFIGS["default"]["geo_name_cols"]:
        if col in df_geo.columns:
            name_col = col
            break
    
    # 尋找經緯度欄位
    for col in df_geo.columns:
        if "lat" in col.lower():
            lat_col = col
        elif "long" in col.lower() or "lng" in col.lower():
            lng_col = col

    # 如果沒找到，嘗試用 index 查找
    if not name_col:
        name_col = df_geo.columns[0]
    if not lat_col and len(df_geo.columns) >= 3:
        lat_col = df_geo.columns[2]
    if not lng_col and len(df_geo.columns) >= 4:
        lng_col = df_geo.columns[3]

    # 建立對照
    if name_col and lat_col and lng_col:
        for _, row in df_geo.iterrows():
            n_val = row[name_col]
            lt_val = row[lat_col]
            lg_val = row[lng_col]
            if pd.notna(n_val) and pd.notna(lt_val) and pd.notna(lg_val):
                clean_n = clean_text(n_val)
                try:
                    geo_dict[clean_n] = (float(lt_val), float(lg_val))
                except ValueError:
                    pass
    return geo_dict

def main():
    print("=" * 80)
    print("臺大醫院北護分院長照資源協作平台 - 資料清洗與匯出作業啟動")
    print("=" * 80)

    raw_path = "_raw_data/1.正式及非正式資源單位(1150323更新).xlsx"
    geo_path = "_raw_data/資源經緯度.xlsx"
    out_dir = "_cleaned_data"
    os.makedirs(out_dir, exist_ok=True)

    if not os.path.exists(raw_path) or not os.path.exists(geo_path):
        print("錯誤：原始資料或經緯度對照 Excel 不存在！")
        return

    raw_xls = pd.ExcelFile(raw_path)
    geo_xls = pd.ExcelFile(geo_path)

    all_cleaned_records = []
    report_stats = {}
    total_raw_count = 0
    total_cleaned_count = 0
    global_id_counter = 1

    # 逐一處理 27 個長照子類別
    for sub_cat, cat in SUBCAT_TO_CAT.items():
        geo_sheet_name = RAW_TO_GEO_SHEET.get(sub_cat, sub_cat)
        
        if sub_cat not in raw_xls.sheet_names:
            print(f"警告：原始資料中找不到 Sheet '{sub_cat}'，跳過。")
            continue

        print(f"正在清洗資源種類：[{cat}] -> {sub_cat} ...")

        # 1. 讀取原始資料與經緯度 (部分 Sheet 標題列在不同列)
        if sub_cat == "輔具特約":
            df_raw = pd.read_excel(raw_path, sheet_name=sub_cat, skiprows=2)
        else:
            df_raw = pd.read_excel(raw_path, sheet_name=sub_cat, skiprows=1)
        
        # 載入 Geo 經緯度資料 (如果 Geo Excel 中找不到對應的 Sheet，則設為空，允許 null 經緯度)
        geo_lookup = {}
        if geo_sheet_name in geo_xls.sheet_names:
            if geo_sheet_name == "專業服務":
                df_geo = pd.read_excel(geo_path, sheet_name=geo_sheet_name)
                df_geo.columns = ["服務單位名稱", "機構地址", "Latitude", "Longitude"]
            elif geo_sheet_name == "輔具特約":
                df_geo = pd.read_excel(geo_path, sheet_name=geo_sheet_name, skiprows=1)
            else:
                df_geo = pd.read_excel(geo_path, sheet_name=geo_sheet_name, skiprows=1)
            # 解析經緯度對照表
            geo_lookup = parse_geo_helper(df_geo, geo_sheet_name)
        else:
            print(f"  [提示] 經緯度 Excel 中無 Sheet '{geo_sheet_name}'，經緯度將設為 null")

        # 2. 找出原始資料的欄位
        name_col = None
        addr_col = None
        phone_col = None

        for col in FIELD_CONFIGS["default"]["raw_name_cols"]:
            if col in df_raw.columns:
                name_col = col
                break
        for col in FIELD_CONFIGS["default"]["raw_addr_cols"]:
            if col in df_raw.columns:
                addr_col = col
                break
        for col in FIELD_CONFIGS["default"]["raw_phone_cols"]:
            if col in df_raw.columns:
                phone_col = col
                break

        # 兜底欄位判定
        if not name_col:
            name_col = df_raw.columns[1] if len(df_raw.columns) > 1 else df_raw.columns[0]
        if not addr_col:
            addr_col = df_raw.columns[2] if len(df_raw.columns) > 2 else df_raw.columns[0]
        if not phone_col:
            phone_col = df_raw.columns[3] if len(df_raw.columns) > 3 else df_raw.columns[0]

        # 3. 清洗與過濾原始資料
        sheet_records = []
        raw_rows_in_sheet = 0
        match_count = 0
        unmatched_names = []

        for idx, row in df_raw.iterrows():
            name_raw = row[name_col]
            
            # 過濾無效行：空值、資料來源行、或是序號非數值等
            if pd.isna(name_raw):
                continue
            name_str = str(name_raw).strip()
            
            # 徹底排除「資料來源」註記行與重複出現的「欄位名稱」行
            if "資料來源" in name_str or name_str == "" or name_str.startswith("*") or name_str in INVALID_NAME_VALUES:
                continue

            raw_rows_in_sheet += 1
            total_raw_count += 1

            # 提取與清洗基本資料
            cleaned_name = name_str.replace("\n", " ").strip()
            
            addr_raw = row[addr_col] if addr_col in df_raw.columns else ""
            cleaned_addr = str(addr_raw).replace("\n", " ").strip() if pd.notna(addr_raw) else ""
            
            # 解析行政區 (District) 與導航專用地址 (navAddress)
            extracted_district, nav_address = normalize_address(cleaned_addr)
            
            # 處理電話
            phone_raw = row[phone_col] if phone_col in df_raw.columns else ""
            cleaned_phone = ""
            if pd.notna(phone_raw):
                phone_str = str(phone_raw).strip()
                # 如果是交通接送，提取裡面的電話號碼
                if sub_cat == "交通接送" and "電話：" in phone_str:
                    phone_match = re.search(r'電話：([0-9\-#分機\s,，]+)', phone_str)
                    if phone_match:
                        cleaned_phone = phone_match.group(1).replace("\n", " ").strip()
                    else:
                        cleaned_phone = phone_str.replace("\n", " ").strip()
                else:
                    cleaned_phone = phone_str.replace("\n", " ").strip()
                    if cleaned_phone.endswith(".0"):
                        cleaned_phone = cleaned_phone[:-2]

            # 4. 進行經緯度匹配 (Join)
            lat, lng = None, None
            if geo_lookup:
                lookup_key = clean_text(cleaned_name)
                if lookup_key in geo_lookup:
                    lat, lng = geo_lookup[lookup_key]
                    match_count += 1
                else:
                    # 模糊匹配二：如果名稱太長，或是帶有分院/附設/門市名稱等差異，嘗試部分匹配
                    found = False
                    for g_key, (g_lat, g_lng) in geo_lookup.items():
                        if g_key in lookup_key or lookup_key in g_key:
                            lat, lng = g_lat, g_lng
                            match_count += 1
                            found = True
                            break
                    if not found:
                        # 模糊匹配三：如果名稱依然匹配不上，且該 Sheet 的原始資料順序與經緯度表順序一致，則嘗試以 index 作為後備方案
                        geo_items = list(geo_lookup.items())
                        current_clean_idx = len(sheet_records)
                        if current_clean_idx < len(geo_items):
                            _, (g_lat, g_lng) = geo_items[current_clean_idx]
                            lat, lng = g_lat, g_lng
                            match_count += 1
                        else:
                            unmatched_names.append(cleaned_name)

            # 5. 智慧特定欄位拼接 (target, notes, booking, resources)
            target_parts = []
            notes_parts = []
            booking_parts = []
            resources_parts = []

            for col in df_raw.columns:
                col_str = str(col).strip()
                val = row[col]
                if pd.isna(val):
                    continue
                val_str = str(val).replace("\n", " ").strip()
                if val_str == "":
                    continue
                    
                # 排除基本欄位與序號
                if col_str in [name_col, addr_col, phone_col, "序號", "序 號", "序  號"]:
                    continue
                    
                # 語意智慧分類拼接
                # targetAudience (對象)
                if "對象" in col_str or "收容" in col_str:
                    target_parts.append(val_str)
                # providedResources (資源)
                elif any(k in col_str for k in ["資源", "服務", "課程", "輔具", "製氧機", "價錢", "注意事項", "計費"]):
                    # 資源類保留表頭以利辨識
                    resources_parts.append(f"{col_str}：{val_str}")
                # referralMethod (轉介)
                elif any(k in col_str for k in ["轉介", "預約", "申請"]):
                    booking_parts.append(val_str)
                else:
                    notes_parts.append(f"{col_str}：{val_str}")

            # 進行文字簡化與長度限制
            raw_target = " | ".join(target_parts)
            raw_resources = " | ".join(resources_parts)
            raw_booking = " | ".join(booking_parts)
            
            targetAudience = simplify_text(raw_target, 45)
            providedResources = simplify_text(raw_resources, 45)
            referralMethod = simplify_referral(raw_booking)
            
            cleaned_notes = " | ".join(notes_parts)

            # 產生符合 resources.json 格式的物件
            record = {
                "id": f"res_{global_id_counter}",
                "category": cat,
                "subCategory": sub_cat,
                "name": cleaned_name,
                "phone": cleaned_phone,
                "address": cleaned_addr,
                "navAddress": nav_address,
                "district": extracted_district,
                "latitude": lat,
                "longitude": lng,
                "targetAudience": targetAudience,
                "providedResources": providedResources,
                "referralMethod": referralMethod,
                "notes": cleaned_notes
            }
            sheet_records.append(record)
            all_cleaned_records.append(record)
            global_id_counter += 1
            total_cleaned_count += 1

        # 記錄單個 Sheet 的清洗品質報告
        report_stats[sub_cat] = {
            "category": cat,
            "raw_rows_detected": raw_rows_in_sheet,
            "cleaned_rows": len(sheet_records),
            "matched_geo_count": match_count,
            "match_rate": f"{(match_count / len(sheet_records) * 100):.2f}%" if len(sheet_records) > 0 and geo_lookup else "N/A (Geo Null)",
            "district_classified_count": sum(1 for r in sheet_records if r["district"] != "未分類"),
            "unmatched_samples": unmatched_names[:5]
        }
        print(f"  -> 清洗完成: {len(sheet_records)} 筆, 經緯度匹配數: {match_count}")

    # 6. 輸出 JSON 與 CSV
    json_out_path = os.path.join(out_dir, "cleaned_resources.json")
    csv_out_path = os.path.join(out_dir, "cleaned_resources.csv")
    report_out_path = os.path.join(out_dir, "cleaning_report.json")

    # 輸出 JSON
    with open(json_out_path, "w", encoding="utf-8") as f:
        json.dump(all_cleaned_records, f, ensure_ascii=False, indent=2)
        
    # 同步輸出至 ignored private data；前端建置前由 prepare:data 產生 resources.build.json
    src_json_path = "src/data/resources.json"
    with open(src_json_path, "w", encoding="utf-8") as f:
        json.dump(all_cleaned_records, f, ensure_ascii=False, indent=2)

    # 輸出 CSV
    df_all = pd.DataFrame(all_cleaned_records)
    df_all.to_csv(csv_out_path, index=False, encoding="utf-8-sig")

    # 輸出清洗品質報告
    export_denominator = total_raw_count or total_cleaned_count
    quality_summary = {
        "total_subcategories": len(report_stats),
        "total_raw_rows_detected": total_raw_count,
        "total_cleaned_rows_exported": total_cleaned_count,
        "total_district_classified": sum(1 for r in all_cleaned_records if r["district"] != "未分類"),
        "overall_export_match_rate": f"{(total_cleaned_count / export_denominator * 100):.2f}%" if export_denominator > 0 else "0.00%",
        "details": report_stats
    }
    with open(report_out_path, "w", encoding="utf-8") as f:
        json.dump(quality_summary, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 80)
    print("資料清洗作業圓滿完成！")
    print("-" * 80)
    print(f"  - 輸出 JSON 路徑: {json_out_path} ({total_cleaned_count} 筆)")
    print(f"  - 輸出 CSV  路徑: {csv_out_path}")
    print(f"  - 清洗品質報告  : {report_out_path}")
    print(f"  - 總目標比對率  : {quality_summary['overall_export_match_rate']} (以偵測 raw rows 為分母)")
    print("=" * 80)

if __name__ == "__main__":
    main()
