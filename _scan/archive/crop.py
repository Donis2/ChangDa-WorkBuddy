from PIL import Image
import os

OUT = r'D:/Code/MyProject/常大真题项目/public/images/questions'
os.makedirs(OUT, exist_ok=True)
B = r'D:/Code/MyProject/常大真题项目/_scan/'

# (questionId.png, source page, y0, y1)  x is full width minus margins
jobs = [
    ('2024-计算-01', 'paper2024_p2.png', 50, 588),
    ('2024-计算-02', 'paper2024_p2.png', 735, 1095),
    ('2024-计算-03', 'paper2024_p3.png', 0, 492),
    ('2024-计算-04', 'paper2024_p4.png', 225, 1235),
    ('2024-计算-05', 'paper2024_p5.png', 530, 1312),
    ('2024-计算-07', 'paper2024_p7.png', 275, 1125),
    ('2025-综合-01', 'paper2025_p4.png', 55, 1085),
    ('2025-综合-02', 'paper2025_p5.png', 175, 1115),
    ('2025-计算-01', 'paper2025_p6.png', 520, 1318),
    ('2025-计算-02', 'paper2025_p8.png', 105, 1125),
    ('2025-计算-03', 'paper2025_p10.png', 185, 1015),
    ('2025-计算-04', 'paper2025_p11.png', 5, 1225),
    ('2024-计算-03-ans', 'ans2024_p2.png', 1130, 1490),
    ('2024-计算-05-ans', 'ans2024_p3.png', 560, 1260),
    ('2025-综合-01-ans', 'ans2025_p2.png', 175, 1080),
    ('2025-综合-02-ans', 'ans2025_p3.png', 400, 1140),
    ('2025-计算-01-ans', 'ans2025_p4.png', 470, 1090),
    ('2025-计算-03-ans', 'ans2025_p8.png', 480, 1300),
    ('2025-计算-04-ans', 'ans2025_p10.png', 150, 1000),
]

for name, page, y0, y1 in jobs:
    im = Image.open(B + page)
    w, h = im.size
    y0 = max(0, y0); y1 = min(h, y1)
    x0 = int(w * 0.02); x1 = int(w * 0.98)
    crop = im.crop((x0, y0, x1, y1)).convert('L')
    # upscale small crops a bit for readability
    if crop.width < 1100:
        r = 1100 / crop.width
        crop = crop.resize((int(crop.width * r), int(crop.height * r)), Image.LANCZOS)
    crop.save(os.path.join(OUT, name + '.png'))
    print(name, page, crop.size)
