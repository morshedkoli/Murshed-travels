import { jsPDF } from 'jspdf';

export type LedgerEntry = {
    date: string;
    description: string;
    reference?: string;
    debit: number;
    credit: number;
    balance: number;
};

export type CustomerLedgerData = {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    entries: LedgerEntry[];
    openingBalance: number;
    closingBalance: number;
    totalDebits: number;
    totalCredits: number;
    generatedDate: string;
};

export type VendorLedgerData = {
    vendorName: string;
    vendorPhone?: string;
    vendorEmail?: string;
    entries: LedgerEntry[];
    openingBalance: number;
    closingBalance: number;
    totalDebits: number;
    totalCredits: number;
    generatedDate: string;
};

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function formatNumber(amount: number): string {
    // Format number with commas but no currency symbol
    return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateLedgerPDF(
    doc: jsPDF,
    title: string,
    entityName: string,
    entityPhone: string,
    entityEmail: string | undefined,
    data: { entries: LedgerEntry[]; openingBalance: number; closingBalance: number; totalDebits: number; totalCredits: number; generatedDate: string }
): void {
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    let y = margin;

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(title, pageWidth / 2, y, { align: 'center' });
    
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Murshed Travels', pageWidth / 2, y, { align: 'center' });

    y += 15;
    
    // Entity Info Box
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, pageWidth - margin * 2, 30, 'F');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title.includes('VENDOR') ? 'Vendor:' : 'Customer:', margin + 5, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(entityName, margin + 35, y + 8);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Phone:', margin + 5, y + 16);
    doc.setFont('helvetica', 'normal');
    doc.text(entityPhone || '-', margin + 35, y + 16);
    
    if (entityEmail) {
        doc.setFont('helvetica', 'bold');
        doc.text('Email:', margin + 5, y + 24);
        doc.setFont('helvetica', 'normal');
        doc.text(entityEmail, margin + 35, y + 24);
    }
    
    doc.setFont('helvetica', 'bold');
    doc.text('Generated:', pageWidth - margin - 60, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(data.generatedDate), pageWidth - margin - 25, y + 8);
    
    y += 40;

    // Opening Balance
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Opening Balance: ${formatNumber(data.openingBalance)}`, margin, y);
    y += 10;

    // Table Header
    const colX = {
        date: margin,
        description: margin + 25,
        reference: margin + 85,
        debit: pageWidth - margin - 70,
        credit: pageWidth - margin - 35,
        balance: pageWidth - margin,
    };

    doc.setFillColor(50, 50, 50);
    doc.rect(margin, y - 5, pageWidth - margin * 2, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    
    doc.text('Date', colX.date + 2, y);
    doc.text('Description', colX.description + 2, y);
    doc.text('Ref', colX.reference + 2, y);
    doc.text('Debit', colX.debit, y, { align: 'right' });
    doc.text('Credit', colX.credit, y, { align: 'right' });
    doc.text('Balance', colX.balance, y, { align: 'right' });

    y += 8;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    // Table Rows
    let alternate = false;
    for (const entry of data.entries) {
        // Check for page break
        if (y > pageHeight - margin - 20) {
            doc.addPage();
            y = margin + 10;
            
            // Repeat header on new page
            doc.setFillColor(50, 50, 50);
            doc.rect(margin, y - 5, pageWidth - margin * 2, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text('Date', colX.date + 2, y);
            doc.text('Description', colX.description + 2, y);
            doc.text('Ref', colX.reference + 2, y);
            doc.text('Debit', colX.debit, y, { align: 'right' });
            doc.text('Credit', colX.credit, y, { align: 'right' });
            doc.text('Balance', colX.balance, y, { align: 'right' });
            y += 8;
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
        }

        // Alternate row background
        if (alternate) {
            doc.setFillColor(245, 245, 245);
            doc.rect(margin, y - 4, pageWidth - margin * 2, 6, 'F');
        }
        alternate = !alternate;

        doc.setFontSize(8);
        doc.text(formatDate(entry.date), colX.date + 2, y);
        
        // Truncate description if too long
        const desc = entry.description.length > 35 
            ? entry.description.substring(0, 32) + '...' 
            : entry.description;
        doc.text(desc, colX.description + 2, y);
        
        if (entry.reference) {
            doc.text(entry.reference, colX.reference + 2, y);
        }
        
        if (entry.debit > 0) {
            doc.text(formatNumber(entry.debit), colX.debit, y, { align: 'right' });
        }
        
        if (entry.credit > 0) {
            doc.text(formatNumber(entry.credit), colX.credit, y, { align: 'right' });
        }
        
        doc.setFont('helvetica', 'bold');
        doc.text(formatNumber(entry.balance), colX.balance, y, { align: 'right' });
        doc.setFont('helvetica', 'normal');

        y += 6;
    }

    y += 5;

    // Summary Box
    const summaryY = Math.min(y, pageHeight - margin - 35);
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, summaryY, pageWidth - margin * 2, 30, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    
    doc.text('SUMMARY:', margin + 5, summaryY + 8);
    doc.setFont('helvetica', 'normal');
    
    doc.text(`Total Debits:`, margin + 5, summaryY + 16);
    doc.text(formatNumber(data.totalDebits), margin + 50, summaryY + 16);
    
    doc.text(`Total Credits:`, margin + 5, summaryY + 24);
    doc.text(formatNumber(data.totalCredits), margin + 50, summaryY + 24);
    
    // Closing Balance (highlighted)
    doc.setFillColor(200, 230, 200);
    doc.rect(pageWidth - margin - 90, summaryY + 5, 85, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('CLOSING BALANCE:', pageWidth - margin - 85, summaryY + 16);
    doc.setFontSize(12);
    doc.text(formatNumber(data.closingBalance), pageWidth - margin - 85, summaryY + 22);

    // Footer
    const footerY = pageHeight - margin;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated by Murshed Travels on ${new Date().toLocaleString()}`, margin, footerY);
    doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - margin, footerY, { align: 'right' });
}

export function generateCustomerLedgerPDF(data: CustomerLedgerData): void {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    generateLedgerPDF(
        doc,
        'CUSTOMER LEDGER',
        data.customerName,
        data.customerPhone,
        data.customerEmail,
        data
    );

    // Save PDF
    const fileName = `ledger-${data.customerName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
}

export function generateVendorLedgerPDF(data: VendorLedgerData): void {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    generateLedgerPDF(
        doc,
        'VENDOR LEDGER',
        data.vendorName,
        data.vendorPhone || '',
        data.vendorEmail,
        data
    );

    // Save PDF
    const fileName = `vendor-ledger-${data.vendorName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
}
