from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo
from zoneinfo import ZoneInfoNotFoundError

import astronomy

SIGNS = [
    "ARIES",
    "TAURUS",
    "GEMINI",
    "CANCER",
    "LEO",
    "VIRGO",
    "LIBRA",
    "SCORPIO",
    "SAGITTARIUS",
    "CAPRICORN",
    "AQUARIUS",
    "PISCES",
]

SIGN_TR = {
    "ARIES": "Koç",
    "TAURUS": "Boğa",
    "GEMINI": "İkizler",
    "CANCER": "Yengeç",
    "LEO": "Aslan",
    "VIRGO": "Başak",
    "LIBRA": "Terazi",
    "SCORPIO": "Akrep",
    "SAGITTARIUS": "Yay",
    "CAPRICORN": "Oğlak",
    "AQUARIUS": "Kova",
    "PISCES": "Balık",
}

PLANETS = [
    ("Sun", astronomy.Body.Sun),
    ("Moon", astronomy.Body.Moon),
    ("Mercury", astronomy.Body.Mercury),
    ("Venus", astronomy.Body.Venus),
    ("Mars", astronomy.Body.Mars),
    ("Jupiter", astronomy.Body.Jupiter),
    ("Saturn", astronomy.Body.Saturn),
    ("Uranus", astronomy.Body.Uranus),
    ("Neptune", astronomy.Body.Neptune),
    ("Pluto", astronomy.Body.Pluto),
]

PLANET_TR = {
    "Sun": "Güneş",
    "Moon": "Ay",
    "Mercury": "Merkür",
    "Venus": "Venüs",
    "Mars": "Mars",
    "Jupiter": "Jüpiter",
    "Saturn": "Satürn",
    "Uranus": "Uranüs",
    "Neptune": "Neptün",
    "Pluto": "Plüton",
}

ASPECTS = [
    ("kavuşum", 0.0, 8.0),
    ("sextile", 60.0, 4.0),
    ("kare", 90.0, 6.0),
    ("üçgen", 120.0, 6.0),
    ("karşıt", 180.0, 8.0),
]


def _norm_deg(value: float) -> float:
    return value % 360.0


def _delta_deg(a: float, b: float) -> float:
    d = (a - b) % 360.0
    if d > 180.0:
        d -= 360.0
    return d


def _sign_from_lon(lon: float) -> str:
    return SIGNS[int(_norm_deg(lon) // 30.0)]


def _deg_in_sign(lon: float) -> float:
    return _norm_deg(lon) % 30.0


def _to_time(iso_utc: str) -> astronomy.Time:
    return astronomy.Time(iso_utc)


def _format_iso_z(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _as_utc_dt(time_obj: astronomy.Time) -> datetime:
    return datetime.fromisoformat(str(time_obj).replace("Z", "+00:00")).astimezone(timezone.utc)


def _ecliptic_lon(body: astronomy.Body, time_obj: astronomy.Time) -> float:
    # Astronomy Engine's direct EclipticLongitude excludes some bodies (e.g., Sun).
    # GeoVector -> Ecliptic is valid for all planets and keeps a single path.
    vec = astronomy.GeoVector(body, time_obj, True)
    ecl = astronomy.Ecliptic(vec)
    return ecl.elon


def _planet_positions(time_obj: astronomy.Time) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for name, body in PLANETS:
        lon = _ecliptic_lon(body, time_obj)
        prev_lon = _ecliptic_lon(body, astronomy.Time(time_obj.ut - 0.5))
        next_lon = _ecliptic_lon(body, astronomy.Time(time_obj.ut + 0.5))
        speed = _delta_deg(next_lon, prev_lon)
        out.append(
            {
                "planet": name,
                "planetLabel": PLANET_TR[name],
                "longitude": round(_norm_deg(lon), 6),
                "sign": _sign_from_lon(lon),
                "signLabel": SIGN_TR[_sign_from_lon(lon)],
                "degreeInSign": round(_deg_in_sign(lon), 4),
                "speedDegPerDay": round(speed, 6),
                "retrograde": speed < 0.0,
            }
        )
    return out


def _major_aspects(positions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for i in range(len(positions)):
        for j in range(i + 1, len(positions)):
            p1 = positions[i]
            p2 = positions[j]
            sep = abs(_delta_deg(p1["longitude"], p2["longitude"]))
            for label, target, orb in ASPECTS:
                diff = abs(sep - target)
                if diff <= orb:
                    out.append(
                        {
                            "planet1": p1["planet"],
                            "planet1Label": p1["planetLabel"],
                            "planet2": p2["planet"],
                            "planet2Label": p2["planetLabel"],
                            "aspect": label,
                            "separation": round(sep, 4),
                            "orb": round(diff, 4),
                        }
                    )
                    break
    out.sort(key=lambda x: x["orb"])
    return out[:20]


def _moon_events(time_obj: astronomy.Time) -> dict[str, Any]:
    new_moon = astronomy.SearchMoonPhase(0.0, time_obj, 40.0)
    full_moon = astronomy.SearchMoonPhase(180.0, time_obj, 40.0)
    lunar = astronomy.NextLunarEclipse(time_obj)
    solar = astronomy.NextGlobalSolarEclipse(time_obj)
    return {
        "nextNewMoonUtc": str(new_moon) if new_moon else None,
        "nextFullMoonUtc": str(full_moon) if full_moon else None,
        "nextLunarEclipsePeakUtc": str(lunar.peak) if lunar else None,
        "nextSolarEclipsePeakUtc": str(solar.peak) if solar else None,
    }


def _sun_moon_signs(positions: list[dict[str, Any]]) -> dict[str, str]:
    sun = next((p for p in positions if p["planet"] == "Sun"), None)
    moon = next((p for p in positions if p["planet"] == "Moon"), None)
    return {
        "sunSign": sun["sign"] if sun else "PISCES",
        "sunSignLabel": sun["signLabel"] if sun else "Balık",
        "moonSign": moon["sign"] if moon else "PISCES",
        "moonSignLabel": moon["signLabel"] if moon else "Balık",
    }


def _obliquity_deg(time_obj: astronomy.Time) -> float:
    # Meeus low-order approximation (good enough for ascendant sign classification).
    t = time_obj.ut / 36525.0
    return 23.439291 - 0.0130042 * t


def _ascendant_longitude(time_obj: astronomy.Time, latitude: float, longitude: float) -> float:
    import math

    eps = math.radians(_obliquity_deg(time_obj))
    phi = math.radians(latitude)
    theta = math.radians((astronomy.SiderealTime(time_obj) * 15.0) + longitude)
    y = -math.cos(theta)
    x = (math.sin(theta) * math.cos(eps)) + (math.tan(phi) * math.sin(eps))
    lam = math.degrees(math.atan2(y, x))
    return _norm_deg(lam)


def _build_general_text(sign: str, positions: list[dict[str, Any]], aspects: list[dict[str, Any]], events: dict[str, Any]) -> str:
    sign_label = SIGN_TR.get(sign, "Balık")
    sun = next((p for p in positions if p["planet"] == "Sun"), None)
    moon = next((p for p in positions if p["planet"] == "Moon"), None)
    mercury = next((p for p in positions if p["planet"] == "Mercury"), None)
    top_aspects = aspects[:3]

    lines = [f"{sign_label} için astronomi tabanlı astro veri özeti:"]
    if sun and moon:
        lines.append(
            f"Güneş {sun['signLabel']} {sun['degreeInSign']:.1f}° konumunda, Ay ise {moon['signLabel']} {moon['degreeInSign']:.1f}° düzleminde ilerliyor."
        )
    if mercury:
        motion = "retro" if mercury["retrograde"] else "doğrudan"
        lines.append(f"Merkür şu anda {motion} hareket içinde görünüyor ve hız değeri {mercury['speedDegPerDay']:.3f}°/gün.")
    if top_aspects:
        joined = "; ".join(
            f"{a['planet1Label']}-{a['planet2Label']} {a['aspect']} (orb {a['orb']:.2f}°)" for a in top_aspects
        )
        lines.append(f"Öne çıkan açılar: {joined}.")
    if events.get("nextLunarEclipsePeakUtc"):
        lines.append(f"Bir sonraki Ay tutulması tepe zamanı (UTC): {events['nextLunarEclipsePeakUtc']}.")
    return " ".join(lines)


def build_general_payload(period: str, target_date: str, sign: str) -> dict[str, Any]:
    _ = period  # period is used by caller for cache/grouping; base astronomy snapshot is date-driven.
    day = datetime.fromisoformat(target_date).date()
    center = datetime(day.year, day.month, day.day, 12, 0, tzinfo=timezone.utc)
    t = _to_time(_format_iso_z(center))
    positions = _planet_positions(t)
    aspects = _major_aspects(positions)
    events = _moon_events(t)
    summary = _sun_moon_signs(positions)
    return {
        "ok": True,
        "source": "astronomy-engine-mit",
        "period": period,
        "targetDate": target_date,
        "sign": sign,
        "text": _build_general_text(sign, positions, aspects, events),
        "data": {
            "positions": positions,
            "aspects": aspects,
            "events": events,
            **summary,
        },
    }


def build_personal_payload(
    birth_date: str,
    birth_time: str | None,
    timezone_name: str,
    latitude: float,
    longitude: float,
    target_date: str,
) -> dict[str, Any]:
    try:
        tz = ZoneInfo(timezone_name) if timezone_name else ZoneInfo("UTC")
    except ZoneInfoNotFoundError:
        if timezone_name == "Europe/Istanbul":
            tz = timezone(timedelta(hours=3))
        else:
            tz = timezone.utc
    local_birth_dt = datetime.fromisoformat(f"{birth_date}T{birth_time or '12:00'}:00").replace(tzinfo=tz)
    birth_utc = local_birth_dt.astimezone(timezone.utc)
    target_day = datetime.fromisoformat(target_date).date()
    transit_utc = datetime(target_day.year, target_day.month, target_day.day, 12, 0, tzinfo=timezone.utc)

    birth_t = _to_time(_format_iso_z(birth_utc))
    transit_t = _to_time(_format_iso_z(transit_utc))

    natal_positions = _planet_positions(birth_t)
    transit_positions = _planet_positions(transit_t)
    transit_aspects = _major_aspects(transit_positions)
    events = _moon_events(transit_t)

    asc_lon = _ascendant_longitude(birth_t, latitude, longitude)
    asc_sign = _sign_from_lon(asc_lon)
    sunmoon = _sun_moon_signs(natal_positions)

    # Transit-to-natal major aspects (focused set)
    trans_natal: list[dict[str, Any]] = []
    focus_transit = {"Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"}
    focus_natal = {"Sun", "Moon", "Mercury", "Venus", "Mars"}
    natal_by_name = {p["planet"]: p for p in natal_positions}
    for tr in transit_positions:
        if tr["planet"] not in focus_transit:
            continue
        for natal_name in focus_natal:
            na = natal_by_name[natal_name]
            sep = abs(_delta_deg(tr["longitude"], na["longitude"]))
            for label, target, orb in ASPECTS:
                diff = abs(sep - target)
                if diff <= orb:
                    trans_natal.append(
                        {
                            "transitPlanet": tr["planet"],
                            "transitPlanetLabel": tr["planetLabel"],
                            "natalPlanet": na["planet"],
                            "natalPlanetLabel": na["planetLabel"],
                            "aspect": label,
                            "orb": round(diff, 4),
                        }
                    )
                    break
    trans_natal.sort(key=lambda x: x["orb"])
    trans_natal = trans_natal[:24]

    text = (
        f"Kişisel astro veri özeti: Güneş {sunmoon['sunSignLabel']}, Ay {sunmoon['moonSignLabel']}, "
        f"Yükselen {SIGN_TR[asc_sign]}. Transitlerde {len(trans_natal)} önemli temas ve "
        f"{sum(1 for p in transit_positions if p['retrograde'])} retro gezegen işareti görüldü."
    )

    return {
        "ok": True,
        "source": "astronomy-engine-mit",
        "targetDate": target_date,
        "text": text,
        "data": {
            "natal": {
                "sunSign": sunmoon["sunSign"],
                "sunSignLabel": sunmoon["sunSignLabel"],
                "moonSign": sunmoon["moonSign"],
                "moonSignLabel": sunmoon["moonSignLabel"],
                "risingSign": asc_sign,
                "risingSignLabel": SIGN_TR[asc_sign],
                "ascendantLongitude": round(asc_lon, 6),
                "positions": natal_positions,
            },
            "transit": {
                "positions": transit_positions,
                "aspects": transit_aspects,
                "toNatalAspects": trans_natal,
                "events": events,
            },
        },
    }
