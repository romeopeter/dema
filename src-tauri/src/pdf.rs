//! A very small PDF 1.4 writer: enough for a tabular report, with no dependencies.
//!
//! Text uses the two standard Type1 fonts every reader ships with (Helvetica and
//! Helvetica-Bold), so nothing has to be embedded. That also means the encoding is
//! WinAnsi — callers should spell currency out (`NGN 1,200.00`) rather than pass a
//! symbol like the naira sign, which has no WinAnsi code point.

const PAGE_WIDTH: f32 = 595.28; // A4 portrait, in points
const PAGE_HEIGHT: f32 = 841.89;
const MARGIN: f32 = 48.0;
pub const CONTENT_WIDTH: f32 = PAGE_WIDTH - MARGIN * 2.0;

#[derive(Clone, Copy, PartialEq)]
pub enum Font {
    Regular,
    Bold,
}

impl Font {
    fn resource(self) -> &'static str {
        match self {
            Font::Regular => "/F1",
            Font::Bold => "/F2",
        }
    }
}

#[derive(Clone, Copy)]
pub enum Align {
    Left,
    Right,
}

/// A page under construction. `y` walks down from the top margin.
pub struct Pdf {
    pages: Vec<String>,
    current: String,
    y: f32,
}

impl Pdf {
    pub fn new() -> Self {
        Self {
            pages: Vec::new(),
            current: String::new(),
            y: PAGE_HEIGHT - MARGIN,
        }
    }

    pub fn advance(&mut self, points: f32) {
        self.y -= points;
    }

    /// True while there is room for another row above the bottom margin.
    pub fn fits(&self, needed: f32) -> bool {
        self.y - needed >= MARGIN
    }

    /// Breaks to a fresh page. Callers repeat their table header afterwards.
    pub fn new_page(&mut self) {
        self.end_page();
    }

    fn end_page(&mut self) {
        if !self.current.is_empty() {
            self.pages.push(std::mem::take(&mut self.current));
        }
        self.y = PAGE_HEIGHT - MARGIN;
    }

    /// Draws one line of text. `x` is measured from the left margin.
    pub fn text(&mut self, x: f32, text: &str, size: f32, font: Font, align: Align) {
        let width = text_width(text, size, font);
        let left = match align {
            Align::Left => MARGIN + x,
            Align::Right => MARGIN + x - width,
        };
        self.current.push_str(&format!(
            "BT {} {size} Tf 1 0 0 1 {left:.2} {:.2} Tm ({}) Tj ET\n",
            font.resource(),
            self.y,
            escape(text)
        ));
    }

    pub fn rule(&mut self, thickness: f32, gray: f32) {
        self.current.push_str(&format!(
            "{gray:.2} G {thickness} w {:.2} {:.2} m {:.2} {:.2} l S\n",
            MARGIN,
            self.y,
            PAGE_WIDTH - MARGIN,
            self.y
        ));
    }

    /// Serialises the document. Offsets are tracked as they are written so the xref
    /// table points at real byte positions.
    pub fn finish(mut self) -> Vec<u8> {
        self.end_page();
        if self.pages.is_empty() {
            self.pages.push(String::new());
        }

        let page_count = self.pages.len();
        let first_page_obj = 5;
        let kids: Vec<String> = (0..page_count)
            .map(|i| format!("{} 0 R", first_page_obj + i * 2))
            .collect();

        let mut objects: Vec<String> = vec![
            "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
            format!(
                "<< /Type /Pages /Kids [{}] /Count {} >>",
                kids.join(" "),
                page_count
            ),
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
                .to_string(),
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
                .to_string(),
        ];

        for (i, content) in self.pages.iter().enumerate() {
            let content_obj = first_page_obj + i * 2 + 1;
            objects.push(format!(
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH:.2} {PAGE_HEIGHT:.2}] \
                 /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {content_obj} 0 R >>"
            ));
            objects.push(format!(
                "<< /Length {} >>\nstream\n{content}endstream",
                content.len()
            ));
        }

        let mut out = Vec::new();
        out.extend_from_slice(b"%PDF-1.4\n");
        let mut offsets = Vec::with_capacity(objects.len());
        for (i, body) in objects.iter().enumerate() {
            offsets.push(out.len());
            out.extend_from_slice(format!("{} 0 obj\n{body}\nendobj\n", i + 1).as_bytes());
        }

        let xref_at = out.len();
        out.extend_from_slice(format!("xref\n0 {}\n", objects.len() + 1).as_bytes());
        out.extend_from_slice(b"0000000000 65535 f \n");
        for offset in &offsets {
            out.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
        }
        out.extend_from_slice(
            format!(
                "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF\n",
                objects.len() + 1
            )
            .as_bytes(),
        );
        out
    }
}

/// Escapes the three characters that are structural inside a PDF string literal, and
/// drops anything outside WinAnsi rather than emitting bytes the reader would misread.
fn escape(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for ch in text.chars() {
        match ch {
            '(' => out.push_str("\\("),
            ')' => out.push_str("\\)"),
            '\\' => out.push_str("\\\\"),
            c if (32..256).contains(&(c as u32)) => out.push(c),
            _ => out.push('?'),
        }
    }
    out
}

/// Helvetica advance widths (per 1000 units) for the printable ASCII range, so columns
/// can be right-aligned without a font library.
fn char_width(ch: char, bold: bool) -> f32 {
    let c = ch as usize;
    if !(32..127).contains(&c) {
        return 500.0;
    }
    const REGULAR: [u16; 95] = [
        278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556,
        556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722,
        722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722,
        667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
        556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
        500, 334, 260, 334, 584,
    ];
    const BOLD: [u16; 95] = [
        278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556,
        556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722,
        722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722,
        667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611,
        611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556,
        500, 389, 280, 389, 584,
    ];
    let table = if bold { &BOLD } else { &REGULAR };
    table[c - 32] as f32
}

pub fn text_width(text: &str, size: f32, font: Font) -> f32 {
    let bold = matches!(font, Font::Bold);
    text.chars().map(|c| char_width(c, bold)).sum::<f32>() / 1000.0 * size
}

/// Cuts a string to fit a column, adding an ellipsis when it does not.
pub fn truncate(text: &str, max_width: f32, size: f32, font: Font) -> String {
    if text_width(text, size, font) <= max_width {
        return text.to_string();
    }
    let mut out = String::new();
    for ch in text.chars() {
        let mut candidate = out.clone();
        candidate.push(ch);
        if text_width(&format!("{candidate}..."), size, font) > max_width {
            break;
        }
        out = candidate;
    }
    format!("{out}...")
}
