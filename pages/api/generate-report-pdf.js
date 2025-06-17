import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]'; // Corrected path again
import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import {
  getTotalLeadsCount,
  getTopQuestions,
  getWeeklyLeadsTrend,
  getMetaAdsSummary,
  getAllMetaAdsCampaignData,
} from '../../lib/db'; // Adjust path as needed

// Helper function for drawing text (can be expanded)
async function drawText(page, text, x, y, font, size = 10, color = rgb(0, 0, 0)) {
  page.drawText(text, { x, y, font, size, color });
}

// Helper to draw a table (very basic implementation)
async function drawTable(page, data, startX, startY, columnWidths, rowHeight, font, fontSize) {
  let currentY = startY;
  const headerFontColor = rgb(1, 1, 1); // White
  const headerBgColor = rgb(0.2, 0.2, 0.2); // Dark Gray
  const rowEvenColor = rgb(0.95, 0.95, 0.95); // Light Gray for even rows
  const rowOddColor = rgb(1, 1, 1); // White for odd rows
  const borderColor = rgb(0.7, 0.7, 0.7); // Light gray border

  if (!data || data.length === 0) {
    drawText(page, "No data available for this table.", startX, currentY - rowHeight, font, fontSize);
    return currentY - rowHeight * 2;
  }

  const headers = Object.keys(data[0]);

  // Draw header
  let currentX = startX;
  page.drawRectangle({
      x: startX - 2, // A little padding
      y: currentY - rowHeight - 2,
      width: columnWidths.reduce((a, b) => a + b, 0) + 4,
      height: rowHeight + 4,
      color: headerBgColor,
  });
  for (let i = 0; i < headers.length; i++) {
    drawText(page, headers[i], currentX + 5, currentY - rowHeight + 5, font, fontSize, headerFontColor);
    page.drawLine({ start: {x: currentX, y: currentY}, end: {x: currentX, y: currentY - rowHeight * (data.length +1)}, color: borderColor, thickness: 0.5 });
    currentX += columnWidths[i];
  }
  page.drawLine({ start: {x: currentX, y: currentY}, end: {x: currentX, y: currentY - rowHeight * (data.length +1)}, color: borderColor, thickness: 0.5}); // Last vertical line for header
  page.drawLine({ start: {x: startX, y: currentY}, end: {x: currentX, y: currentY}, color: borderColor, thickness: 0.5}); // Top border line of header
  currentY -= rowHeight;

  // Draw rows
  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    currentX = startX;
    const rowBgColor = rowIndex % 2 === 0 ? rowEvenColor : rowOddColor;
    page.drawRectangle({
        x: startX -2,
        y: currentY - rowHeight -2,
        width: columnWidths.reduce((a, b) => a + b, 0) + 4,
        height: rowHeight +4,
        color: rowBgColor,
        // strokeColor: borderColor, // Optional: cell borders
        // borderWidth: 0.5,
    });

    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
      const cellValue = String(row[headers[colIndex]] === null || row[headers[colIndex]] === undefined ? '' : row[headers[colIndex]]);
      drawText(page, cellValue.substring(0, 25), currentX + 5, currentY - rowHeight + 5, font, fontSize -1); // Truncate long text
      currentX += columnWidths[colIndex];
    }
    page.drawLine({ start: {x: startX, y: currentY}, end: {x: currentX, y: currentY}, color: borderColor, thickness: 0.5}); // Bottom border line of row
    currentY -= rowHeight;
  }
   page.drawLine({ start: {x: startX, y: currentY}, end: {x: currentX, y: currentY}, color: borderColor, thickness: 0.5}); // Final bottom line

  return currentY;
}


export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') { // Allow GET for easy testing, POST for actual use
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Forbidden: Access denied.' });
  }

  try {
    // 1. Fetch Data (reusing lib/db.js functions)
    const [
      totalLeadsResult,
      topQuestionsResult,
      weeklyLeadsTrendResult,
      metaAdsSummaryResult,
      metaAdsCampaignDataResult,
    ] = await Promise.all([
      getTotalLeadsCount(),
      getTopQuestions(5),
      getWeeklyLeadsTrend(12),
      getMetaAdsSummary(),
      getAllMetaAdsCampaignData(),
    ]);

    // 2. Create PDF Document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    let yPosition = height - 50; // Start from top

    // Title
    page.drawText('Comprehensive Report', { x: 50, y: yPosition, font: boldFont, size: 24 });
    yPosition -= 40;

    // Summary Section
    page.drawText('Summary Statistics', { x: 50, y: yPosition, font: boldFont, size: 18 });
    yPosition -= 25;
    drawText(page, `Total Leads: ${totalLeadsResult.count || 0}`, 60, yPosition, font, 12);
    yPosition -= 20;
    drawText(page, `Total Meta Ad Spend: $${parseFloat(metaAdsSummaryResult.data?.totalSpend || 0).toLocaleString()}`, 60, yPosition, font, 12);
    yPosition -= 20;
    drawText(page, `Total Meta Ad Leads: ${metaAdsSummaryResult.data?.totalLeads || 0}`, 60, yPosition, font, 12);
    yPosition -= 30;

    // Top Questions
    page.drawText('Top Questions:', { x: 50, y: yPosition, font: boldFont, size: 16 });
    yPosition -= 20;
    (topQuestionsResult.data || []).forEach((q, index) => {
      if (yPosition < 70) { // Add new page if space is running out
          page = pdfDoc.addPage(PageSizes.A4); yPosition = height - 50;
      }
      drawText(page, `${index + 1}. ${q.question.substring(0,80)}${q.question.length > 80 ? '...' : ''} (${q.count} times)`, 60, yPosition, font, 10);
      yPosition -= 15;
    });
    yPosition -= 20;

    // Weekly Leads Trend (Textual/Table Representation)
    if (yPosition < 150) { page = pdfDoc.addPage(PageSizes.A4); yPosition = height - 50; }
    page.drawText('Weekly Leads Trend (Last 12 Weeks)', { x: 50, y: yPosition, font: boldFont, size: 16 });
    yPosition -= 20;
    const weeklyLeadsTableData = (weeklyLeadsTrendResult.data || []).map(item => ({
        'Week Start': new Date(item.week_start_date).toLocaleDateString(),
        'Leads': item.count
    }));
    yPosition = await drawTable(page, weeklyLeadsTableData, 50, yPosition, [150, 100], 20, font, 10);
    yPosition -= 20;


    // Meta Ads Campaign Data Table
    if (yPosition < 200) { page = pdfDoc.addPage(PageSizes.A4); yPosition = height - 50; }
    page.drawText('Meta Ads Campaign Details', { x: 50, y: yPosition, font: boldFont, size: 16 });
    yPosition -= 20;
    const campaignTableData = (metaAdsCampaignDataResult.data || []).map(ad => ({
      Campaign: ad.campaign_name,
      AdSet: ad.ad_set_name,
      // Ad: ad.ad_name, // Can make table too wide
      Date: new Date(ad.date).toLocaleDateString(),
      Spend: `$${parseFloat(ad.spend || 0).toFixed(2)}`,
      Leads: ad.leads || 0,
      CTR: `${(ad.ctr * 100).toFixed(2)}%`,
      CPL: `$${parseFloat(ad.cpl || 0).toFixed(2)}`,
    })).slice(0, 15); // Limit rows for PDF space for now
    yPosition = await drawTable(page, campaignTableData, 50, yPosition, [100, 100, 60, 60, 50, 50, 60], 20, font, 8);
    yPosition -= 20;

    // Meta Ads Performance Chart (Textual Summary)
     if (yPosition < 100) { page = pdfDoc.addPage(PageSizes.A4); yPosition = height - 50; }
    page.drawText('Meta Ads Performance Summary (Aggregated by Campaign)', { x: 50, y: yPosition, font: boldFont, size: 16 });
    yPosition -= 20;
    const aggregatedAdsData = (metaAdsCampaignDataResult.data || []).reduce((acc, item) => {
        const campaign = item.campaign_name || 'Unknown Campaign';
        if (!acc[campaign]) acc[campaign] = { name: campaign, spend: 0, leads: 0 };
        acc[campaign].spend += item.spend || 0;
        acc[campaign].leads += item.leads || 0;
        return acc;
    }, {});
    const adsPerformanceTableData = Object.values(aggregatedAdsData).map(item => ({
        Campaign: item.name,
        Spend: `$${item.spend.toFixed(2)}`,
        Leads: item.leads
    }));
    yPosition = await drawTable(page, adsPerformanceTableData, 50, yPosition, [200, 100, 100], 20, font, 10);


    // 3. Serialize PDF and Send Response
    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report_${new Date().toISOString().split('T')[0]}.pdf"`);
    res.status(200).send(Buffer.from(pdfBytes)); // Send as Buffer

  } catch (error) {
    console.error('Failed to generate PDF report:', error);
    res.status(500).json({ error: 'Failed to generate PDF report', details: error.message });
  }
}
