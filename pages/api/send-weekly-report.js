// Vercel Cron Job Configuration (example for vercel.json):
// {
//   "crons": [
//     {
//       "path": "/api/send-weekly-report?secret=YOUR_ACTUAL_SECRET_TOKEN", // Replace YOUR_ACTUAL_SECRET_TOKEN
//       "schedule": "0 12 * * 1" // Monday 08:00 AM UTC-4 (e.g., New York EDT) is 12:00 PM UTC.
//                                // Vercel cron schedules are in UTC.
//     }
//   ]
// }
// Note: The secret should be stored as an environment variable (e.g., AUTOMATED_REPORT_SECRET)
// and compared, not hardcoded in the path in vercel.json if using Authorization header.
// If using query param like above, ensure it's a strong, unique secret.
import { getServerSession } from 'next-auth/next'; // Added for consistency if needed, though cron uses secret
import { authOptions } from './auth/[...nextauth]'; // Corrected path again
import {
  // For fetching data - adapt if specific date ranges are needed for weekly reports
  getTotalLeadsCount,
  getTopQuestions,    // Might need a version for "last week"
  getWeeklyLeadsTrend, // This is already weekly, but might need to specify the exact week
  getMetaAdsSummary,   // Might need a version for "last week"
  getAllMetaAdsCampaignData, // Might need a version for "last week"
} from '../../lib/db'; // Adjust path as needed
import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib'; // Reusing PDF generation elements
import { sendEmailWithAttachment } from '../../lib/email';
import { sendTelegramReport } from '../../lib/telegram';

// TODO: Refactor PDF generation logic from generate-report-pdf.js into a reusable function
// For now, some parts might be duplicated or simplified for this automated report.

// Helper function to get date range for the last week
function getLastWeekDateRange() {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() - today.getDay()); // End of last week (Sunday)
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 6); // Start of last week (Monday)

  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return {
    start: startDate.toLocaleDateString('en-US', options),
    end: endDate.toLocaleDateString('en-US', options),
    startDateISO: startDate.toISOString().split('T')[0],
    endDateISO: endDate.toISOString().split('T')[0],
  };
}


async function generateWeeklyReportPDF(reportData, dateRange) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    let yPosition = height - 50;

    page.drawText(`Weekly Summary Report: ${dateRange.start} - ${dateRange.end}`, { x: 50, y: yPosition, font: boldFont, size: 18 });
    yPosition -= 30;

    // Simplified content for automated report
    page.drawText('Key Metrics (Last Week):', { x: 50, y: yPosition, font: boldFont, size: 14 });
    yPosition -= 20;

    // Note: reportData needs to be data specific to the last week.
    // The functions from lib/db might need to be adapted or new ones created for date-ranged queries.
    // For this example, we'll assume reportData contains appropriately filtered data.

    page.drawText(`- Total Leads: ${reportData.summaryCards?.totalLeads_lastWeek || 'N/A'}`, { x: 60, y: yPosition, font, size: 10 });
    yPosition -= 15;
    page.drawText(`- Meta Ad Spend: $${parseFloat(reportData.metaAdsOverallSummary?.totalSpend_lastWeek || 0).toLocaleString()}`, { x: 60, y: yPosition, font, size: 10 });
    yPosition -= 15;
    page.drawText(`- Meta Ad Leads: ${reportData.metaAdsOverallSummary?.totalLeads_lastWeek || 'N/A'}`, { x: 60, y: yPosition, font, size: 10 });
    yPosition -= 25;

    page.drawText('Top Questions (Last Week):', { x: 50, y: yPosition, font: boldFont, size: 14 });
    yPosition -= 20;
    (reportData.summaryCards?.topQuestions_lastWeek || []).slice(0,3).forEach((q, index) => {
        if (yPosition < 70) { page = pdfDoc.addPage(PageSizes.A4); yPosition = height - 50; }
        page.drawText(`${index + 1}. ${q.question.substring(0,70)}... (${q.count} times)`, { x: 60, y: yPosition, font, size: 9 });
        yPosition -= 15;
    });

    // Add more sections as needed (e.g., simplified tables for campaign data)
    // For brevity, this example PDF is very simple.

    return await pdfDoc.save(); // Returns Uint8Array
}


export default async function handler(req, res) {
  // 1. Security Check
  const providedSecret = req.query.secret || req.headers.authorization?.split(' ')[1];
  if (providedSecret !== process.env.AUTOMATED_REPORT_SECRET) {
    console.warn('Unauthorized attempt to access send-weekly-report API.');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log("Starting weekly report generation...");
    const dateRange = getLastWeekDateRange();

    // 2. Fetch Report Data (for the last week - functions might need adjustment)
    // This is a placeholder; actual data fetching needs to be specific to the date range.
    // For now, we'll fetch general data and just use the date range in the title.
    // TODO: Adapt DB functions to accept date ranges for more accurate weekly reports. (Done for some)
    const reportDateOptions = {
        startDateISO: dateRange.startDateISO,
        endDateISO: dateRange.endDateISO
    };

    const [
      totalLeadsLastWeekResult,
      topQuestionsLastWeekResult,
      // weeklyLeadsTrendResult, // For a single week PDF, this specific trend might be less relevant than a summary.
                               // Or, fetch for a longer period to show context. For now, simplifying.
      metaAdsSummaryLastWeekResult,
      // metaAdsCampaignDataResult, // Full campaign data might be too verbose for a summary email PDF.
                                 // A summary or top N campaigns might be better.
    ] = await Promise.all([
      getTotalLeadsCount(reportDateOptions),
      getTopQuestions(3, reportDateOptions), // Top 3 questions from last week
      // getWeeklyLeadsTrend(12), // Example: show 12 weeks trend for context in report
      getMetaAdsSummary(reportDateOptions),
    ]);

    const reportDataForPDF = {
        summaryCards: {
            totalLeads_lastWeek: totalLeadsLastWeekResult.count,
            topQuestions_lastWeek: topQuestionsLastWeekResult.data,
        },
        metaAdsOverallSummary: { // This now correctly reflects last week's summary
            totalSpend_lastWeek: metaAdsSummaryLastWeekResult.data?.totalSpend,
            totalLeads_lastWeek: metaAdsSummaryLastWeekResult.data?.totalLeads,
            avgCPL_lastWeek: metaAdsSummaryLastWeekResult.data?.avgCPL,
            avgCTR_lastWeek: metaAdsSummaryLastWeekResult.data?.avgCTR,
        },
        // weeklyLeadsTrendForChart: weeklyLeadsTrendResult.data, // If we decide to include a trend chart
    };


    // 3. Generate PDF
    console.log("Generating PDF report...");
    const pdfBytes = await generateWeeklyReportPDF(reportDataForPDF, dateRange);
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64'); // For SendGrid attachment

    const emailSubject = `Weekly Performance Report: ${dateRange.start} - ${dateRange.end}`;
    const emailHtmlBody = `
      <p>Please find attached the Weekly Performance Report for ${dateRange.start} - ${dateRange.end}.</p>
      <p>Key Metrics for Last Week (${dateRange.start} - ${dateRange.end}):</p>
      <ul>
        <li>Total Leads Generated: ${reportDataForPDF.summaryCards.totalLeads_lastWeek || 0}</li>
        <li>Meta Ad Spend: $${parseFloat(reportDataForPDF.metaAdsOverallSummary.totalSpend_lastWeek || 0).toLocaleString()}</li>
        <li>Meta Ad Leads: ${reportDataForPDF.metaAdsOverallSummary.totalLeads_lastWeek || 0}</li>
        <li>Meta Ad Avg CPL: $${parseFloat(reportDataForPDF.metaAdsOverallSummary.avgCPL_lastWeek || 0).toFixed(2)}</li>
      </ul>
      <p>Further details, including top questions from the period, are in the attached PDF.</p>
    `;
    const reportRecipientEmail = process.env.REPORT_RECIPIENT_EMAIL;
    const telegramChatId = process.env.TELEGRAM_REPORT_CHAT_ID;

    // 4. Send Email via SendGrid
    if (reportRecipientEmail && process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
      try {
        console.log(`Sending email report to ${reportRecipientEmail}...`);
        await sendEmailWithAttachment({
          to: reportRecipientEmail,
          subject: emailSubject,
          html: emailHtmlBody,
          attachments: [{
            content: pdfBase64,
            filename: `weekly_report_${dateRange.startDateISO}_to_${dateRange.endDateISO}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment',
          }],
        });
        console.log("Email report sent successfully.");
      } catch (emailError) {
        console.error("Failed to send email report:", emailError);
        // Continue to Telegram, don't let email failure stop Telegram
      }
    } else {
      console.warn("SendGrid (API Key, From Email, or Recipient Email) not fully configured. Skipping email report.");
    }

    // 5. Send Report via Telegram
    if (telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
      try {
        console.log(`Sending Telegram report to chat ID ${telegramChatId}...`);
        const caption = `Weekly Report: ${dateRange.start} - ${dateRange.end}\nTotal Leads (last week): ${reportDataForPDF.summaryCards.totalLeads_lastWeek || 0}\nMeta Ad Spend (last week): $${parseFloat(reportDataForPDF.metaAdsOverallSummary.totalSpend_lastWeek || 0).toLocaleString()}`;
        await sendTelegramReport(telegramChatId, Buffer.from(pdfBytes), caption, `weekly_report_${dateRange.startDateISO}_to_${dateRange.endDateISO}.pdf`);
        console.log("Telegram report sent successfully.");
      } catch (telegramError) {
        console.error("Failed to send Telegram report:", telegramError);
      }
    } else {
      console.warn("Telegram Bot Token or Chat ID not configured. Skipping Telegram report.");
    }

    console.log("Weekly report process completed.");
    return res.status(200).json({
        message: 'Weekly report generation and delivery process completed (check logs for individual successes/failures).',
        dateRange,
        dataSummary: reportDataForPDF // For quick check during development
    });

  } catch (error) {
    console.error('Failed to generate or send weekly report:', error);
    return res.status(500).json({ error: 'Failed to process weekly report', details: error.message });
  }
}
