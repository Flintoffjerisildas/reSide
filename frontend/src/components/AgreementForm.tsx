import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';
import axios from 'axios';
import { toast } from 'sonner';

interface AgreementFormProps {
    agreement: any;
    onSuccess: () => void;
    onCancel: () => void;
}

export default function AgreementForm({ agreement, onSuccess, onCancel }: AgreementFormProps) {
    const [loading, setLoading] = useState(false);
    const { register, handleSubmit, formState: { errors } } = useForm({
        defaultValues: {
            startDate: format(new Date(), 'yyyy-MM-dd'),
            durationMonths: 11,
            terms: agreement.terms || 'Standard rental agreement terms and conditions apply.'
        }
    });

    const onSubmit = async (data: any) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put(
                `/api/agreements/${agreement._id}/fill`,
                data,
                { headers: { 'x-auth-token': token } }
            );
            toast.success('Agreement signed and activated!');
            onSuccess();
        } catch (error) {
            console.error('Error signing agreement:', error);
            toast.error('Failed to sign agreement');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="startDate">Lease Start Date</Label>
                    <Input
                        id="startDate"
                        type="date"
                        {...register('startDate', { required: 'Start date is required' })}
                    />
                    {errors.startDate && <p className="text-red-500 text-xs">{errors.startDate.message as string}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="durationMonths">Duration (Months)</Label>
                    <Input
                        id="durationMonths"
                        type="number"
                        min="1"
                        {...register('durationMonths', { required: 'Duration is required', min: 1 })}
                    />
                    {errors.durationMonths && <p className="text-red-500 text-xs">{errors.durationMonths.message as string}</p>}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="terms">Terms & Conditions</Label>
                <Textarea
                    id="terms"
                    className="min-h-[150px]"
                    {...register('terms')}
                />
                <p className="text-xs text-muted-foreground">Review and modify terms if necessary.</p>
            </div>

            <div className="rounded-md bg-muted p-4">
                <h4 className="flex items-center font-medium">Monthly Rent: ₹{agreement.rentAmount?.toLocaleString()}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                    By clicking "Sign & Activate", you agree to the terms above and the monthly rent obligation.
                </p>
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={loading}>
                    {loading ? 'Processing...' : 'Sign & Activate Agreement'}
                </Button>
            </DialogFooter>
        </form>
    );
}
