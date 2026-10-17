export const generateReceipt = (payment: any, rentRecord: any) => {
    const printWindow = window.open('', 'PRINT', 'height=600,width=800');

    if (printWindow) {
        printWindow.document.write('<html><head><title>Rent Receipt</title>');
        printWindow.document.write(`
            <style>
                body { font-family: 'Arial', sans-serif; padding: 40px; color: #333; }
                .receipt-container { border: 2px solid #000; padding: 30px; max-width: 700px; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
                .header h1 { margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 2px; }
                .header p { margin: 5px 0 0; font-size: 14px; color: #666; }
                .row { display: flex; justify-content: space-between; margin-bottom: 15px; }
                .label { font-weight: bold; width: 150px; }
                .value { flex-grow: 1; border-bottom: 1px dotted #999; padding-bottom: 2px; }
                .amount-box { border: 2px solid #000; padding: 10px 20px; font-size: 20px; font-weight: bold; margin-top: 20px; display: inline-block; }
                .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
                .signature { text-align: center; }
                .signature-line { border-top: 1px solid #000; width: 200px; margin-top: 40px; }
                @media print {
                    body { padding: 0; }
                    .receipt-container { border: none; }
                }
            </style>
        `);
        printWindow.document.write('</head><body>');

        printWindow.document.write(`
            <div class="receipt-container">
                <div class="header">
                    <h1>Rent Receipt</h1>
                    <p>Receipt No: ${payment.receiptNumber || 'PENDING'}</p>
                    <p>Date: ${new Date(payment.approvedDate || payment.date).toLocaleDateString()}</p>
                </div>

                <div class="content">
                    <div class="row">
                        <span class="label">Received From:</span>
                        <span class="value">${rentRecord.tenant?.name || 'Tenant'}</span>
                    </div>
                    <div class="row">
                        <span class="label">The Sum of:</span>
                        <span class="value">₹${payment.amount.toLocaleString()}</span>
                    </div>
                    <div class="row">
                        <span class="label">Towards Rent for:</span>
                        <span class="value">${new Date(rentRecord.month).toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div class="row">
                        <span class="label">Property:</span>
                        <span class="value">${rentRecord.property?.title || 'Property Address'}</span>
                    </div>
                    <div class="row">
                        <span class="label">Payment Mode:</span>
                        <span class="value">${payment.mode}</span>
                    </div>
                     <div class="row">
                        <span class="label">Transaction ID:</span>
                        <span class="value">${payment.transactionId || 'N/A'}</span>
                    </div>

                    <div style="text-align: right; margin-top: 20px;">
                        <div class="amount-box">Example Amount: ₹${payment.amount.toLocaleString()}</div>
                    </div>
                </div>

                <div class="footer">
                    <div class="signature">
                        <div class="signature-line"></div>
                        <p>Landlord Signature</p>
                        <p>(${rentRecord.owner?.name || 'Owner'})</p>
                    </div>
                </div>
            </div>
        `);

        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    }
};
