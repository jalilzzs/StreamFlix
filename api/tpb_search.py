import sys
import json
import requests

def search_tpb(query):
    try:
        # استخدام الـ API الرسمي والمباشر لـ PirateBay (أسرع ولا يُحظر)
        url = f"https://apibay.org/q.php?q={query}&cat=201,207" # تصفية للأفلام والمسلسلات فقط
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        
        response = requests.get(url, headers=headers, timeout=5)
        results = response.json()
        
        torrents = []
        # التحقق من أن النتيجة ليست فارغة
        if results and isinstance(results, list) and results[0].get('id') != '0':
            for t in results:
                # تحويل الـ Info Hash إلى رابط ماغنت شغال
                info_hash = t.get('info_hash', '')
                magnet_link = f"magnet:?xt=urn:btih:{info_hash}&dn={t.get('name','')}"
                
                torrents.append({
                    "title": t.get('name', ''),
                    "seeders": int(t.get('seeders', 0)),
                    "leechers": int(t.get('leechers', 0)),
                    "size": str(round(int(t.get('size', 0)) / (1024*1024*1024), 2)) + " GB",
                    "magnet": magnet_link
                })
            
            # ترتيب النتائج تلقائياً حسب الأعلى Seeders لضمان سرعة البث مستقبلاً
            torrents.sort(key=lambda x: x['seeders'], reverse=True)
            return json.dumps({"success": True, "results": torrents[:10]})
        else:
            return json.dumps({"success": True, "results": [], "message": "No torrents found"})
            
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(search_tpb(sys.argv[1]))
    else:
        print(json.dumps({"success": False, "error": "No query"}))
