import React from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RentStatusGraphProps {
  data: { name: string; fullDate: string; amount: number; expected?: number; due?: number }[];
  payments: any[];
  title: string;
  role: 'owner' | 'tenant';
}

export function RentStatusGraph({ data, payments, title, role }: RentStatusGraphProps) {
  // Format amount as currency
  const formatCurrency = (value: number) => `₹${value.toLocaleString()}`;

  // Get the latest amount for display in the top right
  const latestAmount = data.length > 0 ? data[data.length - 1].amount : 0;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <div className="flex items-center gap-2 bg-muted/50 px-3 py-1 rounded-md">
           <span className="text-lg font-bold">{formatCurrency(latestAmount)}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#6b7280', fontSize: 12 }} 
                dy={10}
                padding={{ left: 10, right: 10 }}
              />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), role === 'owner' ? 'Collected' : 'Paid']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ color: '#6b7280', marginBottom: '4px' }}
              />
              <Area 
                type="monotone" 
                dataKey="amount" 
                stroke="#f59e0b" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorAmount)" 
                activeDot={{ r: 6, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-8 space-y-4">
          <h4 className="text-sm text-muted-foreground border-b pb-2">Last 3 payments</h4>
          <div className="space-y-4">
            {payments.length === 0 ? (
               <p className="text-sm text-muted-foreground py-2">No recent payments.</p>
            ) : (
                payments.map((payment) => (
                  <div key={payment._id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(payment.date || payment.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                       <p className="text-xs text-muted-foreground">
                        {role === 'owner' 
                          ? (payment.tenant?.name || 'Tenant') 
                          : (payment.rentRecord?.property?.title || 'Rent Payment')}
                       </p>
                    </div>
                    <div className="text-sm font-bold">
                      {formatCurrency(payment.amount)}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
