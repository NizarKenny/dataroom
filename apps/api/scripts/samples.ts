/**
 * Sample documents for the demo room, built rather than committed. A repository
 * is a poor place to keep binaries, and a reviewer who opens a file in the demo
 * should find a real document rather than a placeholder.
 */

const escapeText = (value: string) => value.replace(/([\\()])/g, '\\$1')

/** A one page PDF with a heading and a few lines. No dependency, just the format. */
export function pdf(title: string, body: string[]): Buffer {
  const drawing = ['BT', '/F1 20 Tf', '64 764 Td', `(${escapeText(title)}) Tj`, '/F1 11 Tf', '0 -32 Td']
  for (const line of body) {
    drawing.push(`(${escapeText(line)}) Tj`, '0 -17 Td')
  }
  drawing.push('ET')

  const stream = drawing.join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]

  // The cross reference table is a list of byte offsets, so the file has to be
  // assembled and measured as it goes.
  let file = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((object, index) => {
    offsets.push(file.length)
    file += `${index + 1} 0 obj\n${object}\nendobj\n`
  })

  const startxref = file.length
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) file += `${String(offset).padStart(10, '0')} 00000 n \n`
  file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  file += `startxref\n${startxref}\n%%EOF\n`

  return Buffer.from(file, 'latin1')
}

export function csv(header: string[], rows: (string | number)[][]): Buffer {
  const lines = [header.join(','), ...rows.map((row) => row.join(','))]
  return Buffer.from(`${lines.join('\n')}\n`, 'utf8')
}

export function text(lines: string[]): Buffer {
  return Buffer.from(`${lines.join('\n')}\n`, 'utf8')
}
