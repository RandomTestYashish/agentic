"""Build the single-page version for claude.ai Artifacts: all CSS and JS inlined, images stay as published files."""
import re, sys, os
root = os.path.dirname(os.path.abspath(__file__)) + '/../'
s = open(root + 'index.html').read()
head = re.search(r'<head>(.*?)</head>', s, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', s, re.S).group(1)
title = re.search(r'<title>.*?</title>', head).group(0)
css = ''.join(open(root + f).read() + '\n' for f in ['fonts.css', 'home-tw.css', 'styles.css'])
js = open(root + 'app.js').read()
body = body.replace('<script src="app.js"></script>', '<script>\n' + js + '\n</script>')
out = f'{title}\n<style>\n{css}</style>\n{body}'
open(sys.argv[1], 'w').write(out)
if len(sys.argv) > 2:  # local preview wrapper
    open(sys.argv[2], 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + out + '</body></html>')
print(len(out))
