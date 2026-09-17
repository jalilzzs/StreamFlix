import sys
import json
from thepiratebay_api import TorrentClient

def search_tpb(query):
    try:
        with TorrentClient() as client:
            results = client.search(query)
            torrents = []
            
            for t in results.torrents:
                torrents.append({
                    "title": getattr(t, 'title', ''),
                    "seeders": getattr(t, 'seeders', 0),
                    "leechers": getattr(t, 'leechers', 0),
                    "size": getattr(t, 'size', ''),
                    "magnet": getattr(t, 'magnet_link', getattr(t, 'magnet', ''))
                })
            
            return json.dumps({"success": True, "results": torrents[:10]})
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(search_tpb(sys.argv[1]))
    else:
        print(json.dumps({"success": False, "error": "No query"}))
