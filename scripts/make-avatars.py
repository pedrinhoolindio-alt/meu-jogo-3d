"""Transforma as fotos em avatares ilustrados mantendo os traços do rosto (sem IA/API).

Técnica (OpenCV):
  1. Suavização que preserva bordas (filtro bilateral em várias passadas) → pele "pintada"
  2. Quantização de cores (k-means) → sombreado em faixas, estilo cel-shading
  3. Contornos a partir das bordas da imagem original → traço de ilustração
  4. Realce de cor, luz de recorte na cor do personagem e vinheta

Uso: python3 scripts/make-avatars.py <pasta_com_fotos_originais> <saida> [estilo]
"""
import sys
import os
import cv2
import numpy as np

SRC, OUT = sys.argv[1], sys.argv[2]
STYLE = sys.argv[3] if len(sys.argv) > 3 else 'comic'

# arquivo original, recorte (x0, y0, x1, y1), cor de destaque (BGR)
PEOPLE = {
    'roberta': ('roberta.png', (110, 30, 550, 558), (255, 179, 79)),
    'alan': ('alan.png', (10, 0, 140, 156), (138, 255, 157)),
    'ivone': ('ivone.png', (80, 0, 580, 600), (71, 179, 255)),
    'janiele': ('janiele.png', (110, 20, 550, 548), (217, 122, 255)),
    'pedro': ('pedro.png', (230, 230, 970, 1118), (74, 216, 255)),
}
W, H = 600, 720
KEEP_BG = {'roberta', 'alan'}


def quantize(img, k):
    data = img.reshape(-1, 3).astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, centers = cv2.kmeans(data, k, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    return centers.astype(np.uint8)[labels.flatten()].reshape(img.shape)


def prep(img):
    # Contraste local (CLAHE no canal de luminância) e redução de ruído
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    lab[..., 0] = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(6, 6)).apply(lab[..., 0])
    img = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    return cv2.fastNlMeansDenoisingColored(img, None, 6, 6, 7, 21)


def person_mask(img):
    # Separa pessoa × fundo com GrabCut, começando por um retângulo centrado no rosto
    h, w = img.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    rect = (int(w * 0.08), int(h * 0.03), int(w * 0.84), int(h * 0.97))
    bg, fg = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(img, mask, rect, bg, fg, 6, cv2.GC_INIT_WITH_RECT)
    m = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 1.0, 0.0).astype(np.float32)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    return cv2.GaussianBlur(m, (21, 21), 0)


def backdrop(h, w, accent):
    # Fundo escuro com brilho na cor do personagem e linhas de painel
    y = np.linspace(0, 1, h)[:, None, None]
    x = np.linspace(0, 1, w)[None, :, None]
    base = np.array([28, 14, 6], np.float32)
    glow = np.array(accent, np.float32) * 0.45 * np.clip(1 - np.sqrt((x - 0.5) ** 2 + (y - 0.35) ** 2) * 1.6, 0, 1)
    bg = base + glow
    bg = np.broadcast_to(bg, (h, w, 3)).copy()
    for yy in range(0, h, 6):
        bg[yy] *= 0.85
    return bg


def comic(img, accent):
    small = img
    for _ in range(6):
        small = cv2.bilateralFilter(small, 9, 40, 9)
    flat = quantize(small, 14)
    flat = cv2.bilateralFilter(flat, 7, 30, 7)
    # Contornos: bordas adaptativas sobre a luminância suavizada
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.medianBlur(gray, 5)
    edges = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 13, 7)
    edges = cv2.medianBlur(edges, 5)
    line = cv2.GaussianBlur(edges, (3, 3), 0).astype(np.float32) / 255.0
    out = (flat.astype(np.float32) * (0.25 + 0.75 * line[..., None])).clip(0, 255).astype(np.uint8)
    return out


def painted(img, accent):
    p = cv2.stylization(img, sigma_s=60, sigma_r=0.35)
    p = cv2.detailEnhance(p, sigma_s=8, sigma_r=0.15)
    return p


def grade(img, accent):
    # Realce de cor e contraste (HSV)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * 1.25, 0, 255)
    img = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    img = cv2.convertScaleAbs(img, alpha=1.08, beta=-6)
    h, w = img.shape[:2]
    # Luz de recorte colorida vindo da direita e de baixo
    x = np.linspace(0, 1, w)[None, :]
    y = np.linspace(0, 1, h)[:, None]
    rim = np.clip((x - 0.55) * 2.2, 0, 1) * 0.35 + np.clip((y - 0.7) * 2.5, 0, 1) * 0.3
    tint = np.array(accent, np.float32)[None, None, :]
    img = img.astype(np.float32)
    img = img + (255 - img) * 0 + tint * rim[..., None] * 0.55
    # Vinheta
    cx, cy = w / 2, h * 0.42
    d = np.sqrt(((np.arange(w)[None, :] - cx) / (w * 0.62)) ** 2 + ((np.arange(h)[:, None] - cy) / (h * 0.66)) ** 2)
    vig = np.clip(1.15 - d, 0.15, 1)
    img = img * vig[..., None] + np.array([12, 6, 4], np.float32) * (1 - vig[..., None])
    return img.clip(0, 255).astype(np.uint8)


os.makedirs(OUT, exist_ok=True)
for name, (f, box, accent) in PEOPLE.items():
    img = cv2.imread(os.path.join(SRC, f))
    x0, y0, x1, y1 = box
    img = cv2.resize(img[y0:y1, x0:x1], (W, H), interpolation=cv2.INTER_CUBIC if (x1 - x0) < W else cv2.INTER_AREA)
    if name == 'roberta':
        img = cv2.cvtColor(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)  # foto original já é P&B
    img = prep(img)
    # Fotos em que o cabelo/roupa se confunde com o fundo mantêm o cenário original (só escurecido)
    mask = np.ones((H, W, 1), np.float32) if name in KEEP_BG else person_mask(img)[..., None]
    art = comic(img, accent) if STYLE == 'comic' else painted(img, accent)
    art = (art.astype(np.float32) * mask + backdrop(H, W, accent) * (1 - mask)).clip(0, 255).astype(np.uint8)
    art = grade(art, accent)
    art = cv2.resize(art, (300, 360), interpolation=cv2.INTER_AREA)
    cv2.imwrite(os.path.join(OUT, f'{name}.jpg'), art, [cv2.IMWRITE_JPEG_QUALITY, 88])
    print('ok', name)
