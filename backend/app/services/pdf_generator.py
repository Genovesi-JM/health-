"""Bounded, paginated internal clinical PDFs. No signature/provider claim."""
from datetime import datetime
from functools import lru_cache
import io
from pathlib import Path
import unicodedata
from xml.sax.saxutils import escape


@lru_cache(maxsize=1)
def _fonts():
    import reportlab
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    folder = Path(reportlab.__file__).resolve().parent / 'fonts'
    pdfmetrics.registerFont(TTFont('KayaDocument', str(folder / 'Vera.ttf')))
    pdfmetrics.registerFont(TTFont('KayaDocumentBold', str(folder / 'VeraBd.ttf')))
    pdfmetrics.registerFontFamily('KayaDocument', normal='KayaDocument', bold='KayaDocumentBold', italic='KayaDocument', boldItalic='KayaDocumentBold')
    return pdfmetrics.getFont('KayaDocument').face.charToGlyph


def _text(value):
    text = unicodedata.normalize('NFC', str(value or '')).replace('\r\n','\n').replace('\r','\n').replace('\t','    ')
    glyphs = _fonts()
    if any(character != '\n' and (ord(character) < 32 or ord(character) not in glyphs) for character in text):
        raise ValueError('Unsupported PDF character; preserve source and request review')
    return escape(text).replace('\n', '<br/>')


def _render(title, patient_name, patient_dob, doctor_name, doctor_license, date, sections):
    # Missing renderer/fonts fail; plain text is never labelled application/pdf.
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import CondPageBreak, KeepTogether, Paragraph, SimpleDocTemplate, Spacer
    _fonts()
    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=48, rightMargin=48,
        topMargin=48, bottomMargin=68, title=title, author='Kaya', pageCompression=1)
    body = ParagraphStyle('body', fontName='KayaDocument', fontSize=10, leading=15, spaceAfter=8,
        textColor=colors.HexColor('#172b39'), splitLongWords=1)
    heading = ParagraphStyle('heading', parent=body, fontName='KayaDocumentBold', fontSize=11, spaceBefore=12, keepWithNext=False)
    title_style = ParagraphStyle('title', parent=heading, fontSize=18, leading=24, spaceBefore=0, spaceAfter=12)
    minor = ParagraphStyle('minor', parent=body, fontSize=8, leading=12, textColor=colors.HexColor('#455d6b'))
    flow = [Paragraph(_text(title), title_style),
        Paragraph(_text('Registo clínico interno. Assinatura e envio externo não validados.'), minor),
        Paragraph(_text('Data: '+(date or datetime.utcnow()).strftime('%d/%m/%Y')), body),
        Paragraph('Paciente', heading), Paragraph(_text(patient_name), body)]
    if patient_dob: flow.append(Paragraph(_text('Data de nascimento: '+patient_dob), body))
    for label, values in sections:
        flow += [CondPageBreak(60), Paragraph(_text(label), heading)]
        for value in values:
            if value is not None and str(value).strip(): flow.append(Paragraph(_text(value), body))
    flow += [Spacer(1, 12), KeepTogether([Paragraph('Profissional responsável', heading),
        Paragraph(_text(doctor_name), body), Paragraph(_text('Cédula: '+(doctor_license or 'Não indicada')), body)])]

    def footer(canvas, document):
        canvas.saveState(); canvas.setStrokeColor(colors.HexColor('#d8e3e7'))
        canvas.line(48, 50, A4[0]-48, 50); canvas.setFont('KayaDocument', 8)
        canvas.setFillColor(colors.HexColor('#455d6b'))
        canvas.drawString(48, 35, 'Kaya | Documento clínico interno')
        canvas.drawRightString(A4[0]-48, 35, f'Página {document.page}')
        canvas.restoreState()
    doc.build(flow, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()


def generate_prescription_pdf(patient_name, patient_dob, doctor_name, doctor_license,
        medications, instructions=None, date=None):
    sections = []
    for index, medication in enumerate(medications, 1):
        values = [medication['name'], 'Dose: '+medication['dosage'], 'Frequência: '+medication['frequency']]
        if medication.get('duration'): values.append('Duração: '+medication['duration'])
        if medication.get('notes'): values.append('Observações: '+medication['notes'])
        sections.append((f'Medicação {index}', values))
    if instructions: sections.append(('Instruções', [instructions]))
    return _render('Prescrição', patient_name, patient_dob, doctor_name, doctor_license, date, sections)


def generate_referral_pdf(patient_name, patient_dob, doctor_name, doctor_license,
        destination, specialty, reason, urgency, date=None):
    sections = [('Destino', [destination])]
    if specialty: sections.append(('Especialidade', [specialty]))
    sections.append(('Urgência registada', [{'routine':'Rotina','urgent':'Urgente','emergency':'Emergência'}.get(urgency, urgency)]))
    if reason: sections.append(('Motivo', [reason]))
    return _render('Guia de referência', patient_name, patient_dob, doctor_name, doctor_license, date, sections)
