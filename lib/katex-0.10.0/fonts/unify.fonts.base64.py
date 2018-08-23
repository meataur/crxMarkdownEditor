import base64
import os
import sys


fexts = ["woff2", "woff", "ttf"]
fonttypes = {
    "Bold": "font-weight:700;font-style:normal",
    "BoldItalic": "font-weight:700;font-style:italic",
    "Italic": "font-weight:400;font-style:italic",
    "Regular": "font-weight:400;font-style:normal"
}
fontformats = {
    "woff2": "woff2",
    "woff": "woff",
    "ttf": "truetype"
}

fonts = []
for f in os.listdir("."):
    if os.path.isfile(f) and f.split(".")[-1] in fexts:
        fontname = f.split("-")[0]
        if fontname not in fonts:
            fonts.append(fontname)

fpw = open("fonts.b64.min.css", "w")

for font in fonts:
    for fonttype in fonttypes:
        fwrite = False
        output = "@font-face{font-family:" + font + ";src:"
        src = []
        for fext in fexts:
            filename = font + "-" + fonttype + "." + fext
            if os.path.exists(filename):
                fwrite = True
                fp = open(filename, "rb")
                src.append("url(data:application/x-font-" + fext + ";charset=utf-8;base64," + base64.b64encode(fp.read()).decode() + ") format(\"" + fontformats[fext] + "\")")
                fp.close()
        output += ",".join(src) + ";" + fonttypes[fonttype] + "} "
        if fwrite:
            fpw.write(output)
fpw.close()
