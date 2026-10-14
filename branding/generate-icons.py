#!/usr/bin/env python3
"""Regenerate GucEdit vector and platform icons: uv run --with pillow==12.3.0 branding/generate-icons.py."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
# A geometric G with a cursor bar. One geometry for vector and raster assets.
POLYGON = [(76,24),(32,24),(20,36),(20,68),(32,80),(76,80),(76,48),(50,48),(50,60),(63,60),(63,67),(38,67),(33,62),(33,42),(38,37),(76,37)]

def svg(color, tile=False):
    background = '<rect x="4" y="4" width="92" height="92" rx="20" fill="#182735"/>' if tile else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024"><title>GucEdit</title>{background}<polygon fill="{color}" points="'+ ' '.join(f'{x},{y}' for x,y in POLYGON)+f'"/><rect x="82" y="24" width="4" height="56" fill="{color}"/></svg>\n'

def icon(size, color, tile=True):
    image = Image.new('RGBA',(1024,1024))
    draw = ImageDraw.Draw(image)
    if tile: draw.rounded_rectangle((41,41,983,983),radius=205,fill='#182735')
    draw.polygon([(round(x*10.24),round(y*10.24)) for x,y in POLYGON],fill=color)
    draw.rectangle((840,246,880,819),fill=color)
    return image.resize(size, Image.Resampling.LANCZOS)

for quality,color in [('stable','#40B6F2'),('insider','#49D7A8')]:
    base=ROOT/'src'/quality
    for path in base.rglob('*'):
        if not path.is_file(): continue
        suffix=path.suffix
        if suffix=='.svg':
            ink = '#424242' if 'dark' in path.name.lower() else '#D4D4D4' if 'light' in path.name.lower() else color
            path.write_text(svg(ink))
        elif suffix in ('.png','.bmp','.ico','.icns','.xpm'):
            with Image.open(path) as old: size=old.size
            if suffix=='.icns': icon((1024,1024),color).save(path)
            elif suffix=='.ico': icon((256,256),color).save(path,sizes=[(n,n) for n in (16,24,32,48,64,128,256)])
            elif suffix=='.xpm':
                # XPM export using a compact fixed palette.
                img=icon((64,64),color).convert('RGB').quantize(colors=16)
                palette=img.getpalette(); chars='0123456789abcdef'
                rows=['/* XPM */','static char *gucedit_icon[] = {','"64 64 16 1",']
                rows += [f'"{chars[i]} c #{palette[i*3]:02x}{palette[i*3+1]:02x}{palette[i*3+2]:02x}",' for i in range(16)]
                rows += ['"'+''.join(chars[img.getpixel((x,y))] for x in range(64))+'"'+(',' if y<63 else '') for y in range(64)]
                path.write_text('\n'.join(rows+['};'])+'\n')
            else:
                # Installer banners retain their canvas size and use a centered mark.
                if suffix=='.bmp':
                    img=Image.new('RGB',size,'white'); n=min(size)*3//4
                    mark=icon((n,n),color); img.paste(mark,((size[0]-n)//2,(size[1]-n)//2),mark); img.save(path)
                else: icon(size,color).save(path)
    for path in (ROOT/'build/windows/msi/resources'/quality).glob('*.bmp'):
        with Image.open(path) as old: size=old.size
        img=Image.new('RGB',size,'white'); n=min(size)*3//4; mark=icon((n,n),color)
        img.paste(mark,((size[0]-n)//2,(size[1]-n)//2),mark); img.save(path)
    # Replace all source SVGs so the legacy generator cannot restore old branding.
    for path in (ROOT/'icons'/quality).glob('*.svg'): path.write_text(svg(color))
    (ROOT/'branding'/f'{quality}.svg').write_text(svg(color,True))
print('Generated stable and insiders GucEdit assets.')
