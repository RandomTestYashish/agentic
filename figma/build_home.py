"""Rebuild the home screen in index.html from the Figma-converted parts, then compile Tailwind utilities."""
import re, subprocess, os
fig = os.path.dirname(os.path.abspath(__file__)) + '/'
root = fig + '../'
subprocess.run(['python3', fig + 'convert.py', os.path.expanduser('~/agentic-ref/home.tsx'), '158', '737'], stdout=open(fig + 'sections.html', 'w'), check=True)
sections = open(fig + 'sections.html').read()
# The poster mask (imgImage.svg) clips the cards in the browser; Figma renders them unclipped
sections = re.sub(r' style="-webkit-mask-image:url\(assets/home/imgImage\.svg\)[^"]*"', '', sections)
sections = re.sub(r'\s?mask-[\w-]+(?:-\[[^\]]*\])?', '', sections)
parts = open(fig + 'parts.html').read()
header, rest = parts.split('<!-- NEXT BEST ACTION')
rest = '<!-- NEXT BEST ACTION' + rest
rest = None  # set below after pull() is defined
bottom = open(fig + 'bottomnav.html').read()
sections = re.sub(r'^(      <div class="-translate-x-1/2 absolute [^"]*top-\[\d+px\][^"]*)"', r'\1 rv"', sections, flags=re.M)
# Drop "You might like" (Growth inventory_Old, top 1591) and pull everything below it up by its height + gap (296px)
lines = sections.split('\n')
i0 = next(i for i, l in enumerate(lines) if l.startswith('      <div') and 'top-[1591px]' in l)
i1 = next(i for i in range(i0 + 1, len(lines)) if lines[i].startswith('      <div'))
sections = '\n'.join(lines[:i0] + lines[i1:])
SHIFT = 296
def pull(t):
    return re.sub(r'top-\[(\d+)px\]', lambda m: f'top-[{int(m.group(1)) - SHIFT}px]' if int(m.group(1)) >= 1887 else m.group(0), t)
sections = pull(sections)
rest = pull('<!-- NEXT BEST ACTION' + parts.split('<!-- NEXT BEST ACTION')[1])
home = f'''  <!-- ================= HOME (generated from Figma "Manage Landing" 81538:20209 by figma/build_home.py) ================= -->
  <section class="screen home active" id="home">
    <div class="home-scroll" id="homeScroll">
      <div class="fh" id="figmaHome">
{sections}
{rest}
      </div>
    </div>
{header}
{bottom}
  </section>

'''
p = root + 'index.html'
s = open(p).read()
a = s.index('  <!-- ================= HOME'); b = s.index('<div class="fly-orb"')
open(p, 'w').write(s[:a] + home + '  ' + s[b:])
open(fig + 'home_final.html', 'w').write(home)  # Tailwind scans the final markup (after edits like pull())
sp = '/private/tmp/claude-501/-Users-panda/7f47efd8-7c2e-4104-b6a0-2b4138700717/scratchpad/pt/node_modules'
subprocess.run([sp + '/.bin/tailwindcss', '-i', 'tw.css', '-o', '../home-tw.css', '--minify'], cwd=fig, check=True, env={**os.environ, 'NODE_PATH': sp})
