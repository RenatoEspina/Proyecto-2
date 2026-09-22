import zipfile, re, html, os

base = os.path.dirname(os.path.abspath(__file__))


def strip(xml):
    xml = re.sub(r'</w:p>|</a:p>', '\n', xml)
    xml = re.sub(r'<w:tab[^>]*/>', '\t', xml)
    xml = re.sub(r'<a:br[^>]*/>', '\n', xml)
    xml = re.sub(r'<[^>]+>', '', xml)
    return html.unescape(xml)


docx = [f for f in os.listdir(base) if f.endswith('.docx')][0]
z = zipfile.ZipFile(os.path.join(base, docx))
print('########## DOCX ##########')
print(strip(z.read('word/document.xml').decode('utf8')))

pptx = [f for f in os.listdir(base) if f.endswith('.pptx')][0]
z = zipfile.ZipFile(os.path.join(base, pptx))
names = [n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$', n)]
names.sort(key=lambda n: int(re.search(r'(\d+)', n.split('/')[-1]).group(1)))
print('########## PPTX ##########')
for n in names:
    print('=== ' + n + ' ===')
    print(strip(z.read(n).decode('utf8')))
    note = n.replace('slides/slide', 'notesSlides/notesSlide')
    if note in z.namelist():
        print('--- notas ---')
        print(strip(z.read(note).decode('utf8')))
