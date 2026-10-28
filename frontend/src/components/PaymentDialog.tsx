import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';

interface PaymentDialogProps {
    rentRecord: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export default function PaymentDialog({ rentRecord, open, onOpenChange, onSuccess }: PaymentDialogProps) {
    const [loading, setLoading] = useState(false);
    const [amount, setAmount] = useState(rentRecord?.balance || 0);
    const [mode, setMode] = useState('UPI');
    const [transactionId, setTransactionId] = useState('');
    const [screenshot, setScreenshot] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post('http://localhost:5000/api/payments/submit', {
                rentRecordId: rentRecord._id,
                amount: Number(amount),
                mode,
                transactionId,
                screenshot
                // screenshot: optional, skipped for now or add file upload if needed
            }, {
                headers: { 'x-auth-token': token }
            });
            toast.success('Payment submitted successfully! Waiting for owner approval.');
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error('Payment error:', error);
            toast.error('Failed to submit payment');
        } finally {
            setLoading(false);
        }
    };

    if (!rentRecord) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Pay Rent - {new Date(rentRecord.month).toLocaleString('default', { month: 'long', year: 'numeric' })}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label>Rent Amount Due</Label>
                        <div className="text-2xl font-bold">₹{rentRecord.balance?.toLocaleString()}</div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount Paying Now</Label>
                        <Input
                            id="amount"
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(Number(e.target.value))}
                            max={rentRecord.balance}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="mode">Payment Mode</Label>
                        <Select value={mode} onValueChange={setMode}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select mode" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="UPI">UPI</SelectItem>
                                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                <SelectItem value="Cash">Cash</SelectItem>
                                <SelectItem value="Cheque">Cheque</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="txnId">Transaction ID (Optional)</Label>
                        <Input
                            id="txnId"
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            placeholder="e.g. UPI Ref Number"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="screenshot">Payment Screenshot (Optional)</Label>
                        <Input
                            id="screenshot"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                        setScreenshot(reader.result as string);
                                    };
                                    reader.readAsDataURL(file);
                                }
                            }}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit Payment'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
