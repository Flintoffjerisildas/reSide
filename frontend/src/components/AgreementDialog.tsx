import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import AgreementForm from './AgreementForm';

export default function AgreementDialog({ agreement, open, onOpenChange, onUpdate }: { agreement: any, open: boolean, onOpenChange: (open: boolean) => void, onUpdate?: () => void }) {
    if (!agreement) return null;

    const isPendingTenant = agreement.status === 'pending_tenant';
    // Check if current user is tenant? For now assume dashboard logic handles who sees what, or add check if needed.
    // Actually, simpler to just check status. If owner views pending, they should just see "Waiting for tenant".

    const handlePrint = () => {
        const printContent = document.getElementById('printable-agreement');
        const windowUrl = 'about:blank';
        const uniqueName = new Date();
        const windowName = 'Print' + uniqueName.getTime();
        const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=0,height=0');

        if (printWindow) {
            printWindow.document.write('<html><head><title>Rental Agreement</title>');
            printWindow.document.write('<style>');
            printWindow.document.write(`
                @page { size: A4; margin: 20mm; }
                body { font-family: "Times New Roman", Times, serif; padding: 40px; line-height: 1.6; color: black; }
                h1 { text-align: center; text-decoration: underline; margin-bottom: 30px; font-size: 24px; font-weight: bold; }
                h3 { font-size: 16px; font-weight: bold; text-decoration: underline; margin-top: 20px; margin-bottom: 10px; }
                p { margin-bottom: 8px; }
                .section { margin-bottom: 20px; }
                .border-b { border-bottom: 1px solid #000; padding: 0 5px; display: inline-block; min-width: 50px; }
                .checkbox { font-family: sans-serif; }
                .row { display: flex; justify-content: space-between; }
                .col { width: 48%; }
                @media print {
                    body { padding: 20px; }
                    button { display: none; }
                }
            `);
            printWindow.document.write('</style></head><body>');
            printWindow.document.write(printContent?.innerHTML || '');
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    // Helper for date display
    const today = new Date();
    const start = new Date(agreement.startDate);

    const [scale, setScale] = useState(1);
    useEffect(() => {
        const updateScale = () => {
            const A4_W = 794;
            const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0) - 48;
            const s = Math.min(vw / A4_W, 1);
            setScale(s);
        };
        updateScale();
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full max-w-[95vw] sm:max-w-[90vw] lg:max-w-[85vw] max-h-[90vh] overflow-auto p-4">
                <DialogHeader>
                    <DialogTitle className="flex justify-between items-center">
                        <span>{isPendingTenant ? 'Finalize Rental Agreement' : 'Rental Agreement'}</span>
                        {!isPendingTenant && (
                            <Button onClick={handlePrint} size="sm" variant="outline">
                                <Printer className="h-4 w-4 mr-2" />
                                Print / Download PDF
                            </Button>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {isPendingTenant ? (
                    <AgreementForm
                        agreement={agreement}
                        onSuccess={() => {
                            if (onUpdate) onUpdate();
                            onOpenChange(false);
                        }}
                        onCancel={() => onOpenChange(false)}
                    />
                ) : (
                    <div className="flex justify-center">
                        <div
                          style={{
                            transform: `scale(${scale})`,
                            transformOrigin: 'top center'
                          }}
                        >
                          <div id="printable-agreement" className="flex flex-col gap-8">
                            <div className="w-[794px] h-[1123px] p-8 border rounded-md bg-white text-black font-serif text-sm leading-relaxed">
                              <h1 className="text-2xl font-bold text-center underline mb-8">RENTAL AGREEMENT</h1>
                              <p className="mb-6">
                                This Rental Agreement is made and executed on this <strong className="border-b">{(agreement.todayDay ?? 14)}</strong> day of <strong className="border-b">{(agreement.todayMonthName ?? 'February')}</strong>, <strong className="border-b">{(agreement.todayYear ?? 2026)}</strong>
                              </p>
                              <div className="mb-6">
                                <p><strong>Between:</strong></p>
                                <div className="ml-4 mt-2">
                                  <p><strong>Owner / Landlord:</strong></p>
                                  <p>Name: <span className="border-b min-w-[200px]">{agreement.owner?.name ?? 'Moushami'}</span></p>
                                  <p>Address: <span className="border-b min-w-[300px]">{agreement.owner?.address ?? ''}</span></p>
                                  <p>Phone: <span className="border-b min-w-[200px]">{agreement.owner?.phone ?? ''}</span></p>
                                </div>
                                <div className="ml-4 mt-4">
                                  <p><strong>AND</strong></p>
                                </div>
                                <div className="ml-4 mt-2">
                                  <p><strong>Tenant:</strong></p>
                                  <p>Name: <span className="border-b min-w-[200px]">{agreement.tenant?.name ?? ''}</span></p>
                                  <p>Address: <span className="border-b min-w-[300px]">{agreement.tenant?.address ?? ''}</span></p>
                                  <p>Phone: <span className="border-b min-w-[200px]">{agreement.tenant?.phone ?? ''}</span></p>
                                </div>
                              </div>
                              <div className="mb-6">
                                <h3 className="font-bold underline mb-2">1. Property Details</h3>
                                <p>The Landlord hereby agrees to rent the residential property located at:</p>
                                <p>Address: <span className="border-b w-full inline-block">{agreement.property?.location ?? 'Coimbatore'}</span></p>
                                <p className="mt-2">The property includes:</p>
                                <p className="checkbox">☐ House &nbsp; ☐ Apartment &nbsp; ☐ Portion &nbsp; ☐ Other: ___________________</p>
                              </div>
                              <div className="mb-6">
                                <h3 className="font-bold underline mb-2">2. Rental Period</h3>
                                <p>
                                  The rental agreement shall commence from <strong className="border-b">{(agreement.startDay ?? 14)}</strong> / <strong className="border-b">{(agreement.startMonth ?? 2)}</strong> / <strong className="border-b">{(agreement.startYear ?? 2026)}</strong> <br />
                                  and shall be valid for a period of <strong className="border-b">{agreement.durationMonths ?? 11}</strong> months.
                                </p>
                              </div>
                              <div className="mb-6">
                                <h3 className="font-bold underline mb-2">3. Monthly Rent</h3>
                                <p>
                                  The Tenant agrees to pay a monthly rent of ₹<strong className="border-b">{(agreement.rentAmount ?? 30000).toLocaleString()}</strong><br />
                                  (Rupees <span className="border-b min-w-[300px]">__________________________________</span> only)
                                </p>
                                <p className="mt-2">
                                  The rent shall be paid on or before the <strong className="border-b">5th</strong> day of every month.
                                </p>
                                <p>Mode of Payment:</p>
                                <p className="checkbox">☐ Bank Transfer ☐ Cash ☐ UPI ☐ Cheque</p>
                              </div>
                              <div className="mb-6">
                                <h3 className="font-bold underline mb-2">4. Security Deposit</h3>
                                <p>
                                  The Tenant has paid a refundable security deposit of:<br />
                                  ₹<strong className="border-b">{(agreement.securityDeposit ?? 300000).toLocaleString()}</strong> (Rupees <span className="border-b min-w-[300px]">__________________________</span> only)<br />
                                </p>
                                <p className="mt-1">The deposit shall be refunded at the time of vacating the premises, subject to deductions (if any) for damages or unpaid dues.</p>
                              </div>
                              <div className="mb-6">
                                <h3 className="font-bold underline mb-2">5. Maintenance & Utilities</h3>
                                <p className="checkbox">Electricity charges: Paid by ☑ Tenant ☐ Owner</p>
                                <p className="checkbox">Water charges: Paid by ☐ Tenant ☑ Owner</p>
                                <p className="checkbox">Maintenance charges: Paid by ☑ Tenant ☐ Owner</p>
                              </div>
                            </div>
                            <div className="w-[794px] h-[1123px] p-8 border rounded-md bg-white text-black font-serif text-sm leading-relaxed">
                              <div className="mb-6">
                                <h3 className="font-bold underline mb-2">6. Use of Property</h3>
                                <p>The property shall be used only for residential purposes.</p>
                                <p>The Tenant shall not sublet the premises without written consent from the Landlord.</p>
                              </div>
                              <div className="mb-6">
                                <h3 className="font-bold underline mb-2">7. Repairs & Damages</h3>
                                <p>Minor repairs shall be handled by the Tenant.</p>
                                <p>Major structural repairs shall be handled by the Landlord.</p>
                                <p>Any damage caused by the Tenant shall be repaired at Tenant’s cost.</p>
                              </div>
                              <div className="mb-6">
                                <h3 className="font-bold underline mb-2">8. Termination</h3>
                                <p>Either party may terminate this agreement by giving <strong className="border-b">30</strong> days' written notice.</p>
                              </div>
                              <div className="mb-6">
                                <h3 className="font-bold underline mb-2">9. General Terms</h3>
                                <p>The Tenant shall maintain cleanliness and proper use of the property.</p>
                                <p>No illegal activities shall be conducted on the premises.</p>
                                <p>The Tenant shall return the property in good condition at the time of vacating.</p>
                              </div>
                              <div className="mt-12 flex justify-between">
                                <div className="w-1/2 pr-4">
                                  <p className="mb-8">Landlord Signature: _________________________</p>
                                  <p>Name: <strong className="border-b min-w-[150px] inline-block">{agreement.owner?.name ?? 'Moushami'}</strong></p>
                                  <p>Date: _________________________</p>
                                </div>
                                <div className="w-1/2 pl-4">
                                  <p className="mb-8">Tenant Signature: _________________________</p>
                                  <p>Name: <strong className="border-b min-w-[150px] inline-block">{agreement.tenant?.name ?? ''}</strong></p>
                                  <p>Date: _________________________</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
