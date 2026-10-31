"""Convert Figma MCP React+Tailwind output into static HTML (Tailwind classes kept, compiled separately)."""
import re, sys

src = open(sys.argv[1]).read()
start, end = int(sys.argv[2]), int(sys.argv[3])
consts = {n: u.rsplit('.', 1)[1] for n, u in re.findall(r'const (\w+) = "(https://www\.figma\.com/api/mcp/asset/[^"]+)"', src)}
s = '\n'.join(src.split('\n')[start - 1:end])

WEIGHT = {'bold': 'font-bold', '700': 'font-bold', 'semibold': 'font-semibold', 'semi_bold': 'font-semibold', '600': 'font-semibold',
          'medium': 'font-medium', '500': 'font-medium', 'regular': 'font-normal', '400': 'font-normal',
          'bold_italic': 'font-bold italic', 'medium_italic': 'font-medium italic'}

def fix_classes(c):
    c = c.replace('\\/', '/')
    def fam(m):
        style = m.group(1).lower().replace(' ', '_')
        return 'font-[Inter] ' + WEIGHT.get(style, '')
    c = re.sub(r"font-\[family-name:var\(--typography/font/family,'Inter:([^']+)'\)\]", fam, c)
    c = re.sub(r"font-\['Inter:([^']+)'\]", fam, c)
    c = re.sub(r"font-\[var\(--typography/(?:weight|style)/[^\]]*\)\]", '', c)
    # Figma token vars have '/' in their names (invalid CSS); keep only their fallback values
    for _ in range(3):
        c = re.sub(r'var\(--[^,()]+,((?:[^()]|\([^()]*\))*)\)', r'\1', c)
    return re.sub(r'\s+', ' ', c).strip()

s = re.sub(r'\s*data-(?:node-id|name|annotations)="[^"]*"', '', s)
s = re.sub(r'className="([^"]*)"', lambda m: f'class="{fix_classes(m.group(1))}"', s)
s = re.sub(r'src=\{(\w+)\}', lambda m: f'src="assets/home/{m.group(1)}.{consts[m.group(1)]}"', s)
s = re.sub(r'style=\{\{ maskImage: `url\("\$\{(\w+)\}"\)` \}\}',
           lambda m: f'style="-webkit-mask-image:url(assets/home/{m.group(1)}.{consts[m.group(1)]});mask-image:url(assets/home/{m.group(1)}.{consts[m.group(1)]})"', s)
s = s.replace("""style={{ fontFeatureSettings: '"liga" 0' }}""", "style=\"font-feature-settings:'liga' 0\"")
s = re.sub(r'style=\{\{ backgroundImage: "([^"]+)" \}\}', r'style="background-image:\1"', s)
s = s.replace('style={{ containerType: "size" }}', 'style="container-type:size"')
s = re.sub(r'\{`([^`]*)`\}', r'\1', s)
s = s.replace('<br aria-hidden />', '<br>')
s = re.sub(r'<img([^>]*?)\s*/>', r'<img\1>', s)
s = re.sub(r'<(\w+)([^<>]*?)\s*/>', r'<\1\2></\1>', s)
leftover = re.findall(r'\{[^}]*\}', s)
if leftover:
    print('LEFTOVER JSX:', leftover[:5], file=sys.stderr)
print(s)
