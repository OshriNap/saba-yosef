import httpx
from datetime import date, timedelta

HEBCAL_BASE = "https://www.hebcal.com/shabbat"
SEFARIA_BASE = "https://www.sefaria.org/api"

MEFARSHIM_MAP = {
    "pshat": [
        "Rashi", "Ramban", "Ibn Ezra", "Sforno", "Rashbam", "Or HaChaim",
        "Chizkuni", "Rabbeinu Bahya", "Bekhor Shor", "Da'at Zekenim",
        "Kli Yakar", "Malbim", "Rav Hirsch", "Haamek Davar",
        "Abarbanel on Torah", "HaKtav VeHaKabalah", "Minchat Shai",
        "Ralbag on Torah", "Siftei Chakhamim", "Tur HaAroch",
        "Alshekh on Torah", "Akeidat Yitzchak",
    ],
    "hasidic": [
        "Sefat Emet", "Mei HaShiloach", "Kedushat Levi",
        "Noam Elimelekh", "Toldot Yaakov Yosef", "Degel Machaneh Ephraim",
        "Maor VaShemesh", "Ohev Yisrael", "Tiferet Shlomo",
        "Bat Ayin", "Likutei Moharan", "Peri Tzadik",
        "Zera Kodesh", "Ohr HaMeir", "Yismach Moshe",
        "Ben Porat Yosef", "Agra DeKala",
    ],
    "mussar": [
        "Akeidat Yitzchak", "Shenei Luchot HaBerit", "Alshekh on Torah",
        "Kav HaYashar", "Reshit Chokhmah", "Rabbeinu Bahya",
        "Recanati on the Torah",
    ],
    "midrash": [
        "Midrash Tanchuma", "Midrash Tanchuma Buber", "Vayikra Rabbah",
        "Shemot Rabbah", "Bamidbar Rabbah", "Midrash Aggadah",
        "Sifra", "Yalkut Shimoni on Torah", "Zohar",
    ],
    "bikoret": [
        "Shadal", "David Zvi Hoffmann", "Reggio",
    ],
}

class ParashaCollector:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=60)

    async def _fetch_hebcal(self, params: dict) -> dict:
        resp = await self.client.get(HEBCAL_BASE, params=params)
        resp.raise_for_status()
        return resp.json()

    async def _fetch_sefaria(self, ref: str, params: dict | None = None) -> dict:
        url = f"{SEFARIA_BASE}/texts/{ref}"
        resp = await self.client.get(url, params=params or {})
        resp.raise_for_status()
        return resp.json()

    async def get_weekly_parasha(self) -> dict:
        params = {
            "cfg": "json",
            "geonameid": "293397",
            "M": "on",
        }
        data = await self._fetch_hebcal(params)
        parasha = None
        holiday_fallback = None
        jewish_events = []
        for item in data.get("items", []):
            if item.get("category") == "parashat" and not parasha:
                parasha = {
                    "name": item.get("hebrew", item["title"]),
                    "name_en": item["title"],
                    "ref": item.get("leyning", {}).get("torah", ""),
                    "date": item.get("date", ""),
                    "hebrew_date": item.get("hdate", ""),
                }
            elif item.get("category") in ("holiday", "roshchodesh", "minor"):
                jewish_events.append({
                    "title": item.get("hebrew", item.get("title", "")),
                    "category": item.get("category", ""),
                    "date": item.get("date", ""),
                })
                # Use a holiday with Torah reading as fallback when no regular parasha
                if not holiday_fallback and item.get("leyning", {}).get("torah"):
                    holiday_fallback = {
                        "name": item.get("hebrew", item["title"]),
                        "name_en": item["title"],
                        "ref": item["leyning"]["torah"].split(";")[0].strip(),
                        "date": item.get("date", ""),
                        "hebrew_date": item.get("hdate", ""),
                    }
        if not parasha:
            if holiday_fallback:
                parasha = holiday_fallback
            else:
                raise ValueError("No parasha found for this week")
        parasha["jewish_events"] = jewish_events
        return parasha

    async def get_upcoming_events(self) -> list[dict]:
        """Get Jewish holidays and special dates for the next 30 days."""
        today = date.today()
        end = today + timedelta(days=30)
        params = {
            "cfg": "json",
            "geonameid": "293397",
            "M": "on",
            "start": today.isoformat(),
            "end": end.isoformat(),
            "maj": "on",
            "min": "on",
            "mod": "on",
            "nx": "on",
            "ss": "on",
            "mf": "on",
        }
        url = "https://www.hebcal.com/hebcal"
        resp = await self.client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        events = []
        for item in data.get("items", []):
            cat = item.get("category", "")
            if cat in ("holiday", "roshchodesh", "minor", "modern", "fast"):
                events.append({
                    "title": item.get("hebrew", item.get("title", "")),
                    "title_en": item.get("title", ""),
                    "category": cat,
                    "date": item.get("date", ""),
                    "memo": item.get("memo", ""),
                })
        return events

    async def get_parasha_text(self, ref: str) -> list[dict]:
        data = await self._fetch_sefaria(ref, {"context": "0", "pad": "0"})
        he_texts = data.get("he", [])
        if isinstance(he_texts, str):
            he_texts = [he_texts]
        flat = []
        def _flatten(lst):
            for item in lst:
                if isinstance(item, list):
                    _flatten(item)
                else:
                    flat.append(item)
        _flatten(he_texts)
        return [{"ref": data.get("ref", ref), "text": t} for t in flat if t]

    async def get_commentary(self, parasha_ref: str, mefaresh: str) -> list[dict]:
        commentary_ref = f"{mefaresh} on {parasha_ref}"
        try:
            data = await self._fetch_sefaria(commentary_ref, {"context": "0", "pad": "0"})
        except httpx.HTTPStatusError:
            return []
        he_texts = data.get("he", [])
        if isinstance(he_texts, str):
            he_texts = [he_texts]
        flat = []
        def _flatten(lst):
            for item in lst:
                if isinstance(item, list):
                    _flatten(item)
                else:
                    flat.append(item)
        _flatten(he_texts)
        return [{"mefaresh": mefaresh, "ref": data.get("ref", commentary_ref), "text": t} for t in flat if t]

    async def collect_mefarshim(self, parasha_ref: str, mefarshim_list: list[str]) -> dict[str, list[dict]]:
        result = {}
        for mefaresh in mefarshim_list:
            try:
                result[mefaresh] = await self.get_commentary(parasha_ref, mefaresh)
            except Exception:
                result[mefaresh] = []
        return result

    async def close(self):
        await self.client.aclose()
