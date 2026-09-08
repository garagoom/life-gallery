import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const PDF_STYLES = `
  .plan-doc {
    width: 760px;
    padding: 36px 40px 28px;
    background: #f7f1e8;
    color: #2c241c;
    font-family: "Palatino Linotype", "Songti SC", "Source Han Serif SC", "Noto Serif SC", "Microsoft YaHei", serif;
  }
  .cover {
    background: linear-gradient(160deg, #5c4d3c 0%, #8b7355 62%, #c4a574 100%);
    color: #fbf6ee;
    border-radius: 18px;
    padding: 28px 28px 24px;
    margin-bottom: 22px;
  }
  .kicker {
    letter-spacing: 0.22em;
    font-size: 11px;
    opacity: 0.82;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  .cover h1 {
    font-size: 30px;
    line-height: 1.25;
    margin: 0 0 16px;
    font-weight: 600;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chips span {
    background: rgba(255,255,255,0.16);
    border: 1px solid rgba(255,255,255,0.22);
    border-radius: 999px;
    padding: 5px 12px;
    font-size: 12px;
  }
  .block { margin-bottom: 22px; }
  .block-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 12px; }
  .block-head h2, .quote h2, .table-title {
    margin: 0;
    font-size: 16px;
    letter-spacing: 0.08em;
    color: #5c4d3c;
  }
  .block-head p { margin: 0; color: #8b7355; font-size: 12px; }
  .quote {
    background: #fffaf3;
    border-left: 4px solid #c4a574;
    border-radius: 0 12px 12px 0;
    padding: 14px 18px;
  }
  .quote p { margin: 8px 0 0; white-space: pre-wrap; line-height: 1.7; font-size: 13px; }
  .timeline { display: flex; flex-direction: column; gap: 10px; }
  .day {
    display: flex;
    gap: 14px;
    background: #fffaf3;
    border-radius: 14px;
    padding: 14px 16px;
  }
  .day-index {
    flex-shrink: 0;
    width: 64px;
    color: #8b7355;
    font-size: 12px;
    letter-spacing: 0.08em;
    font-weight: 700;
    padding-top: 2px;
  }
  .day-body { flex: 1; min-width: 0; }
  .day-top { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
  .day-top h3 { margin: 0; font-size: 15px; color: #2c241c; }
  .day-top time { color: #8b7355; font-size: 12px; white-space: nowrap; }
  .lodging { margin: 6px 0 0; font-size: 12px; color: #6b5c4c; }
  .notes { margin: 6px 0 0; font-size: 13px; line-height: 1.6; white-space: pre-wrap; color: #4a3f34; }
  .empty { color: #8b7355; font-size: 13px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
  .stat {
    background: #fffaf3;
    border-radius: 12px;
    padding: 12px 14px;
  }
  .stat span { display: block; font-size: 11px; color: #8b7355; margin-bottom: 4px; }
  .stat strong { display: block; font-size: 16px; color: #2c241c; }
  .stat small { display: block; margin-top: 4px; color: #8b7355; font-size: 11px; }
  .stat.over strong { color: #c0392b; }
  .note { font-size: 13px; line-height: 1.6; color: #4a3f34; }
  .table-title { margin: 16px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; background: #fffaf3; border-radius: 10px; overflow: hidden; }
  th, td { padding: 8px 10px; text-align: left; vertical-align: top; border-bottom: 1px solid #eadfcf; }
  th { background: #efe4d4; color: #5c4d3c; font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  footer { margin-top: 8px; text-align: center; color: #a09080; font-size: 11px; letter-spacing: 0.08em; }
`;

export async function downloadPdfFromHtml(html, filename) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1;';
  host.innerHTML = `<style>${PDF_STYLES}</style>${html}`;
  document.body.appendChild(host);
  try {
    const canvas = await html2canvas(host.querySelector('.plan-doc, .export-doc'), {
      scale: 2,
      backgroundColor: '#f7f1e8',
      useCORS: true,
    });
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.94);
    let heightLeft = imgHeight;
    let position = margin;
    pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);
    while (heightLeft > 0.5) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);
    }
    pdf.save(filename);
  } finally {
    host.remove();
  }
}
