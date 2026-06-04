import re

file_path = "mobile/src/data/divinationData.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update AngelCard interface
if "symbolSvg?: string;" not in content:
    content = content.replace(
        "export type AngelCard = {\n  name: string;\n  guide?: string;\n  message: string;\n  action: string;\n};",
        "export type AngelCard = {\n  name: string;\n  guide?: string;\n  message: string;\n  action: string;\n  symbolSvg?: string;\n};"
    )

paths = {
    'Şifa': 'M50,80 C20,50 20,20 50,20 C80,20 80,50 50,80 Z M50,40 L50,60 M40,50 L60,50', # Kalp ve haç (healing)
    'Korunma': 'M50,10 L80,30 L80,60 C80,80 50,95 50,95 C50,95 20,80 20,60 L20,30 Z M50,25 L50,80', # Kalkan ve kılıç
    'Netlik': 'M50,20 C25,20 10,50 10,50 C10,50 25,80 50,80 C75,80 90,50 90,50 C90,50 75,20 50,20 Z M50,35 A15,15 0 1,0 50,65 A15,15 0 1,0 50,35 Z', # Göz
    'Sabır': 'M30,20 L70,20 L60,50 L70,80 L30,80 L40,50 Z M45,35 L55,35 M45,65 L55,65', # Kum saati
    'Bereket': 'M50,90 C30,90 20,70 20,50 C20,30 40,20 50,10 C60,20 80,30 80,50 C80,70 70,90 50,90 Z M40,50 A10,10 0 1,0 60,50 A10,10 0 1,0 40,50 Z', # Damla/Tohum
    'Cesaret': 'M50,10 L60,40 L90,50 L60,60 L50,90 L40,60 L10,50 L40,40 Z', # Yıldız / Ateş
    'Arınma': 'M20,50 Q50,20 80,50 Q50,80 20,50 M30,50 Q50,35 70,50 Q50,65 30,50', # Su dalgası / Göz
    'Uyum': 'M50,10 A40,40 0 1,0 50,90 A40,40 0 1,0 50,10 Z M50,10 A20,20 0 0,1 50,50 A20,20 0 0,0 50,90 M50,30 A5,5 0 1,1 50,30.1 M50,70 A5,5 0 1,1 50,70.1', # Yin Yang varyasyonu
    'Mucize': 'M50,10 L55,45 L90,50 L55,55 L50,90 L45,55 L10,50 L45,45 Z M20,20 L30,30 M80,20 L70,30 M20,80 L30,70 M80,80 L70,70', # Büyük yıldız ve kıvılcımlar
    'Şükran': 'M35,60 C35,60 50,80 65,60 C80,40 60,20 50,40 C40,20 20,40 35,60 M20,80 L80,80', # Dua eden eller / Kalp kaide üstünde
    'Kabulleniş': 'M20,30 Q50,70 80,30 M30,50 Q50,80 70,50', # Açık kollar / Dalgalar
    'Teslimiyet': 'M50,20 A30,30 0 1,1 49.9,20 M50,20 L50,50 M50,50 L70,70 M50,50 L30,70', # Barış işareti veya serbest düşüş
    'İnanç': 'M50,10 L50,90 M30,30 L70,30 M20,90 L80,90', # Işık hüzmesi, haç kaidesi
    'Sevgi': 'M50,80 C20,50 20,20 50,20 C80,20 80,50 50,80 Z', # Kalp
    'Neşe': 'M50,50 A30,30 0 1,0 50,49.9 M35,40 A5,5 0 1,0 35,40.1 M65,40 A5,5 0 1,0 65,40.1 M35,60 Q50,80 65,60', # Gülen yüz
    'Rehberlik': 'M50,90 L50,10 M50,10 L30,30 M50,10 L70,30 M20,50 L80,50', # Pusula Oku
    'İlham': 'M50,20 C30,20 30,50 50,50 C70,50 70,80 50,80 M50,10 L50,20 M50,80 L50,90 M30,50 L20,50 M80,50 L70,50', # Ampul / Işık titreşimi
    'Farkındalık': 'M50,20 A30,30 0 1,0 50,80 A30,30 0 1,0 50,20 M50,35 A15,15 0 1,0 50,65 A15,15 0 1,0 50,35 M50,50 A2,2 0 1,0 50,50.1', # İç içe daireler / Merkez
    'Şefkat': 'M50,20 C30,20 30,50 50,50 C70,50 70,80 50,80 M20,50 A30,30 0 0,0 80,50', # Sarılan kollar
    'Bağışlama': 'M30,30 L70,70 M30,70 L70,30 M20,50 L80,50 M50,20 L50,80', # Çözülen düğüm / Denge
    'Güven': 'M30,80 L30,20 L70,20 L70,80 M20,20 L80,20 M20,80 L80,80', # Sağlam sütun
    'Yenilenme': 'M50,10 A40,40 0 1,1 10,50 M10,50 L30,50 M10,50 L10,30', # Yenilenme oku / Döngü
    'Sadelik': 'M50,10 L50,90 M10,50 L90,50', # Minimal kesişim
    'Özgürlük': 'M20,80 C20,80 20,20 50,20 C80,20 80,80 80,80 M35,50 C35,50 35,30 50,30 C65,30 65,50 65,50', # Kanatlı kapı
    'Bilgelik': 'M20,30 L80,30 L50,80 Z M30,30 L50,10 L70,30', # Piramit / Kitap
    'Dürüstlük': 'M50,10 L90,50 L50,90 L10,50 Z M50,30 L50,70 M30,50 L70,50', # Tam elmas
    'Alçakgönüllülük': 'M50,80 A30,30 0 0,1 20,50 L80,50 A30,30 0 0,1 50,80 Z M50,50 L50,20', # Aşağı bakan hilal / Kök
    'Kararlılık': 'M20,80 L50,10 L80,80 M40,80 L50,50 L60,80', # Dağ zirvesi
    'Esneklik': 'M30,20 Q70,50 30,80 M50,20 Q90,50 50,80', # Dalgalanan su / kamış
    'Yaratıcılık': 'M50,50 M50,10 L60,40 L90,50 L60,60 L50,90 L40,60 L10,50 L40,40 Z M20,20 A5,5 0 1,1 20,20.1 M80,80 A5,5 0 1,1 80,80.1', # Yıldız patlaması ve noktalar
    'Coşku': 'M50,50 L20,20 M50,50 L50,10 M50,50 L80,20 M50,50 L80,50 M50,50 L80,80 M50,50 L50,90 M50,50 L20,80 M50,50 L10,50', # Güneş ışınları
    'Sükunet': 'M10,60 Q30,40 50,60 T90,60 M10,80 Q30,60 50,80 T90,80', # Yatay sakin dalgalar
    'Paylaşım': 'M30,50 A20,20 0 1,1 50,70 A20,20 0 1,1 70,50', # İç içe geçen halkalar / VENN şeması
    'Bütünlük': 'M50,20 A30,30 0 1,0 50,80 A30,30 0 1,0 50,20 M50,20 L50,80 M20,50 L80,50', # Çember içinde haç / Bütünlük
    'Dönüşüm': 'M30,50 C30,20 70,20 70,50 C70,80 30,80 30,50 M50,20 L50,80 M20,50 L80,50', # Kelebek basitleştirilmiş
    'Işık': 'M50,30 A20,20 0 1,0 50,70 A20,20 0 1,0 50,30 M50,10 L50,20 M50,80 L50,90 M10,50 L20,50 M80,50 L90,50 M25,25 L32,32 M75,75 L68,68 M25,75 L32,68 M75,25 L68,32', # Parlayan lamba/Güneş
    'Umut': 'M20,80 Q50,10 80,80 M40,80 Q50,40 60,80', # Filiz / Güneşin doğuşu
    'Birlik': 'M40,50 A20,20 0 1,1 40,49.9 M60,50 A20,20 0 1,1 60,49.9', # Sonsuzluk / Kesisen cemberler
    'Adalet': 'M50,20 L50,80 M30,40 L70,40 M30,40 L30,60 L20,60 L40,60 L30,60 M70,40 L70,60 L60,60 L80,60 L70,60', # Terazi
    'Erdem': 'M30,80 L50,20 L70,80 L30,80 Z M45,60 L55,60 M50,35 L50,60', # Taç / Kılıç
    'Nezaket': 'M30,40 A10,10 0 1,1 50,40 A10,10 0 1,1 70,40 C70,60 50,80 50,80 C50,80 30,60 30,40 Z', # Kalp
    'Denge': 'M20,50 L80,50 M50,20 L50,80 M20,20 L80,80 M20,80 L80,20', # Yıldız / Denge
    'Uyanış': 'M50,50 A10,10 0 1,0 50,50.1 M50,50 A25,25 0 1,0 50,50.1 M50,50 A40,40 0 1,0 50,50.1', # Genişleyen halkalar
    'Huzur': 'M20,60 Q50,30 80,60 M30,70 Q50,50 70,70', # Yükselen kırlangıç
}

# Apply to file
def replace_func(match):
    name = match.group(1)
    if name in paths:
        path_str = paths[name]
        return f"{{ name: '{name}', symbolSvg: '{path_str}', guide:"
    return match.group(0)

new_content = re.sub(r"\{\s*name:\s*'([^']+)',\s*guide:", replace_func, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Added symbolSvg to ANGEL_CARDS successfully.")
