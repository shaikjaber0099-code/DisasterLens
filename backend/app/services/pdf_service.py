import io
from datetime import datetime
from fpdf import FPDF
from typing import Dict, Any

class DisasterReportPDF(FPDF):
    def header(self):
        # Header banner
        self.set_fill_color(10, 15, 29)
        self.rect(0, 0, 210, 22, 'F')
        self.set_font('Helvetica', 'B', 11)
        self.set_text_color(255, 255, 255)
        self.set_xy(10, 5)
        self.cell(190, 5, 'MULTIMODAL AI REAL-TIME DISASTER INTELLIGENCE', ln=True, align='L')
        self.set_font('Helvetica', '', 8)
        self.set_text_color(148, 163, 184)
        self.set_x(10)
        self.cell(190, 4, 'HUMAN-IN-THE-LOOP SITUATION & DAMAGE ASSESSMENT REPORT', ln=True, align='L')
        self.set_y(26)

    def footer(self):
        self.set_y(-15)
        self.set_x(10)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(100, 116, 139)
        self.cell(190, 10, f'Page {self.page_no()}/{{nb}} | Antigravity AI Operations Center | Confidential Emergency Report', 0, 0, 'C')

def generate_pdf_report(report_title: str, markdown_content: str, zone_meta: Dict[str, Any]) -> bytes:
    """Generates an executive PDF report using FPDF2."""
    pdf = DisasterReportPDF()
    pdf.alias_nb_pages()
    pdf.set_left_margin(12)
    pdf.set_right_margin(12)
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=18)

    # Title section
    pdf.set_x(12)
    pdf.set_font('Helvetica', 'B', 15)
    pdf.set_text_color(15, 23, 42)
    # Sanitize title to latin-1
    safe_title = report_title.encode('latin-1', 'replace').decode('latin-1')
    pdf.cell(186, 9, safe_title, ln=True, align='L')

    # Metadata bar
    pdf.set_font('Helvetica', 'B', 9)
    pdf.set_text_color(71, 85, 105)
    gen_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    zone_name = zone_meta.get("name", "Monitored Zone")
    disaster_type = str(zone_meta.get("disaster_type", "Disaster")).upper()
    severity = float(zone_meta.get("severity", 0.0))
    confidence = float(zone_meta.get("confidence", 0.0))

    meta_line1 = f"Zone: {zone_name} | Type: {disaster_type} | Severity Index: {severity:.2f} | Confidence: {confidence:.0%}"
    meta_line2 = f"Generated: {gen_time} | Authorized By: Operations Desk Human-in-the-Loop Gate"
    pdf.set_x(12)
    pdf.cell(186, 5, meta_line1.encode('latin-1', 'replace').decode('latin-1'), ln=True)
    pdf.set_x(12)
    pdf.cell(186, 5, meta_line2.encode('latin-1', 'replace').decode('latin-1'), ln=True)

    pdf.set_draw_color(203, 213, 225)
    pdf.set_line_width(0.4)
    curr_y = pdf.get_y() + 2
    pdf.line(12, curr_y, 198, curr_y)
    pdf.set_y(curr_y + 4)

    # Parse and write content lines
    lines = markdown_content.split('\n')
    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            pdf.ln(2)
            continue

        pdf.set_x(12)
        safe_text = line_clean.encode('latin-1', 'replace').decode('latin-1')

        if line_clean.startswith('## '):
            pdf.ln(3)
            pdf.set_font('Helvetica', 'B', 12)
            pdf.set_text_color(30, 41, 59)
            heading = safe_text.replace('## ', '')
            pdf.cell(186, 7, heading, ln=True)
            pdf.set_draw_color(226, 232, 240)
            y_pos = pdf.get_y()
            pdf.line(12, y_pos, 198, y_pos)
            pdf.set_y(y_pos + 2)
        elif line_clean.startswith('### '):
            pdf.ln(2)
            pdf.set_font('Helvetica', 'B', 10)
            pdf.set_text_color(51, 65, 85)
            sub = safe_text.replace('### ', '')
            pdf.cell(186, 6, sub, ln=True)
        elif line_clean.startswith('- '):
            pdf.set_font('Helvetica', '', 9)
            pdf.set_text_color(51, 65, 85)
            text = safe_text.replace('- ', '- ').replace('**', '').replace('`', '')
            pdf.multi_cell(186, 5, text)
        elif line_clean.startswith(('1. ', '2. ', '3. ', '4. ', '5. ')):
            pdf.set_font('Helvetica', '', 9)
            pdf.set_text_color(51, 65, 85)
            text = safe_text.replace('**', '').replace('`', '')
            pdf.multi_cell(186, 5, text)
        else:
            pdf.set_font('Helvetica', '', 9)
            pdf.set_text_color(71, 85, 105)
            text = safe_text.replace('**', '').replace('`', '')
            pdf.multi_cell(186, 5, text)

    return bytes(pdf.output())
