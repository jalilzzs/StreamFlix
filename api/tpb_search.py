import sys
import json
import requests

def search_tpb(query):
    try:
        # 1. الاتصال بالـ API الداخلي لـ PirateBay (مستحيل حظره وسريع جداً)
        # نقوم بإضافة cat=201,207 لتصفية البحث لجلب الأفلام والمسلسلات عالية الجودة فقط
        url = f"https://apibay.org/q.php?q={query}&cat=201,207"
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        
        # طلب البيانات مع مهلة 5 ثوانٍ لتفادي تعليق السيرفر
        response = requests.get(url, headers=headers, timeout=5)
        results = response.json()
        
        torrents = []
        
        # التأكد من أن النتيجة تحتوي على ملفات حقيقية وليست فارغة
        if results and isinstance(results, list) and results[0].get('id') != '0':
            for t in results:
                info_hash = t.get('info_hash', '')
                # تركيب الرابط المغناطيسي (Magnet Link) يدوياً وبشكل سليم عبر الـ Hash الخاص بالفيلم
                magnet_link = f"magnet:?xt=urn:btih:{info_hash}&dn={t.get('name','')}&tr=udp://tracker.coppersurfer.tk:6969/announce&tr=udp://://openbittorrent.com"
                
                # حساب حجم الملف وتحويله من Bytes إلى GB ليظهر بشكل أنيق للزائر
                raw_size = int(t.get('size', 0))
                formatted_size = str(round(raw_size / (1024 * 1024 * 1024), 2)) + " GB" if raw_size > 0 else "Unknown Size"
                
                torrents.append({
                    "title": t.get('name', ''),
                    "seeders": int(t.get('seeders', 0)),
                    "leechers": int(t.get('leechers', 0)),
                    "size": formatted_size,
                    "magnet": magnet_link
                })
            
            # ترتيب النتائج من الأعلى للأقل حسب الـ Seeders لضمان استقرار المشغل في موقعك
            torrents.sort(key=lambda x: x['seeders'], reverse=True)
            return json.dumps({"success": True, "results": torrents[:10]})
        else:
            return json.dumps({"success": True, "results": [], "message": "لم يتم العثور على تورنت لهذا الفيلم"})
            
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # استقبال نص البحث القادم من Node.js بشكل سليم
        print(search_tpb(sys.argv[1]))
    else:
        print(json.dumps({"success": False, "error": "No query"}))
