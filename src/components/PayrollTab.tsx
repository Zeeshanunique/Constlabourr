import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Calculator, DollarSign, Plus, IndianRupee } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../utils/supabase/info';

interface Site {
  id: string;
  name: string;
}

interface Worker {
  id: string;
  name: string;
}

interface PayrollItem {
  workerId: string;
  workerName: string;
  daysWorked: number;
  totalHours: number;
  overtimeHours: number;
  dailyWage: number;
  dailyWageAmount: number;
  overtimePay: number;
  pieceRateEarnings: number;
  grossPay: number;
  advances: number;
  netPay: number;
  pendingAdvances: string[];
}

interface PayrollTabProps {
  accessToken: string;
}

export function PayrollTab({ accessToken }: PayrollTabProps) {
  const [sites, setSites] = useState<Site[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCalculateDialogOpen, setIsCalculateDialogOpen] = useState(false);
  const [isAdvanceDialogOpen, setIsAdvanceDialogOpen] = useState(false);
  const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([]);
  const [showPayroll, setShowPayroll] = useState(false);

  const [formData, setFormData] = useState({
    siteId: '',
    startDate: '',
    endDate: new Date().toISOString().split('T')[0],
  });

  const [advanceFormData, setAdvanceFormData] = useState({
    workerId: '',
    amount: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchSites();
    fetchWorkers();
  }, []);

  const fetchSites = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      setSites(data.sites || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  const fetchWorkers = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      setWorkers(data.workers || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  };

  const handleCalculatePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/payroll/calculate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            siteId: formData.siteId,
            startDate: formData.startDate,
            endDate: formData.endDate,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to calculate payroll');

      const data = await response.json();
      setPayrollItems(data.payrollItems || []);
      setShowPayroll(true);
      setIsCalculateDialogOpen(false);
      toast.success('Payroll calculated successfully');
    } catch (error) {
      console.error('Error calculating payroll:', error);
      toast.error('Failed to calculate payroll');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPayroll = async () => {
    if (payrollItems.length === 0) {
      toast.error('No payroll items to process');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/payroll`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            siteId: formData.siteId,
            startDate: formData.startDate,
            endDate: formData.endDate,
            items: payrollItems,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to process payroll');

      toast.success('Payroll processed successfully');
      setPayrollItems([]);
      setShowPayroll(false);
    } catch (error) {
      console.error('Error processing payroll:', error);
      toast.error('Failed to process payroll');
    } finally {
      setLoading(false);
    }
  };

  const handleGiveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            workerId: advanceFormData.workerId,
            amount: parseFloat(advanceFormData.amount),
            reason: advanceFormData.reason,
            date: advanceFormData.date,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to give advance');

      toast.success('Advance given successfully');
      setIsAdvanceDialogOpen(false);
      resetAdvanceForm();
    } catch (error) {
      console.error('Error giving advance:', error);
      toast.error('Failed to give advance');
    } finally {
      setLoading(false);
    }
  };

  const resetAdvanceForm = () => {
    setAdvanceFormData({
      workerId: '',
      amount: '',
      reason: '',
      date: new Date().toISOString().split('T')[0],
    });
  };

  const totalGross = payrollItems.reduce((sum, item) => sum + item.grossPay, 0);
  const totalNet = payrollItems.reduce((sum, item) => sum + item.netPay, 0);
  const totalAdvances = payrollItems.reduce((sum, item) => sum + item.advances, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Payroll Management</CardTitle>
              <CardDescription>Calculate and process worker payments</CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={isAdvanceDialogOpen} onOpenChange={(open) => {
                setIsAdvanceDialogOpen(open);
                if (!open) resetAdvanceForm();
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Give Advance
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Give Advance</DialogTitle>
                    <DialogDescription>
                      Provide advance payment to a worker
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleGiveAdvance} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="advance-worker">Worker *</Label>
                      <Select
                        value={advanceFormData.workerId}
                        onValueChange={(value) => setAdvanceFormData({ ...advanceFormData, workerId: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select worker" />
                        </SelectTrigger>
                        <SelectContent>
                          {workers.map(worker => (
                            <SelectItem key={worker.id} value={worker.id}>
                              {worker.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="advance-amount">Amount (₹) *</Label>
                      <Input
                        id="advance-amount"
                        type="number"
                        value={advanceFormData.amount}
                        onChange={(e) => setAdvanceFormData({ ...advanceFormData, amount: e.target.value })}
                        required
                        min="1"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="advance-date">Date *</Label>
                      <Input
                        id="advance-date"
                        type="date"
                        value={advanceFormData.date}
                        onChange={(e) => setAdvanceFormData({ ...advanceFormData, date: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="advance-reason">Reason</Label>
                      <Input
                        id="advance-reason"
                        value={advanceFormData.reason}
                        onChange={(e) => setAdvanceFormData({ ...advanceFormData, reason: e.target.value })}
                        placeholder="Optional reason"
                      />
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsAdvanceDialogOpen(false);
                          resetAdvanceForm();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={loading}>
                        {loading ? 'Processing...' : 'Give Advance'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={isCalculateDialogOpen} onOpenChange={setIsCalculateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Calculator className="w-4 h-4 mr-2" />
                    Calculate Payroll
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Calculate Payroll</DialogTitle>
                    <DialogDescription>
                      Select site and date range to calculate payroll
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCalculatePayroll} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="payroll-site">Site *</Label>
                      <Select
                        value={formData.siteId}
                        onValueChange={(value) => setFormData({ ...formData, siteId: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select site" />
                        </SelectTrigger>
                        <SelectContent>
                          {sites.map(site => (
                            <SelectItem key={site.id} value={site.id}>
                              {site.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="startDate">Start Date *</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endDate">End Date *</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={formData.endDate}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCalculateDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={loading}>
                        {loading ? 'Calculating...' : 'Calculate'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {!showPayroll ? (
            <div className="text-center py-12 text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No payroll calculated</p>
              <p className="text-sm">Calculate payroll to process payments</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Gross Pay</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl flex items-center">
                      <IndianRupee className="w-5 h-5 mr-1" />
                      {totalGross.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Advances</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl flex items-center">
                      <IndianRupee className="w-5 h-5 mr-1" />
                      {totalAdvances.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Net Pay</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl flex items-center text-green-600">
                      <IndianRupee className="w-5 h-5 mr-1" />
                      {totalNet.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Daily Pay</TableHead>
                      <TableHead className="text-right">OT Pay</TableHead>
                      <TableHead className="text-right">Piece Rate</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Advances</TableHead>
                      <TableHead className="text-right">Net Pay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.workerName}</TableCell>
                        <TableCell className="text-right">{item.daysWorked}</TableCell>
                        <TableCell className="text-right">
                          {item.totalHours.toFixed(1)}
                          {item.overtimeHours > 0 && (
                            <Badge variant="secondary" className="ml-1 text-xs">
                              +{item.overtimeHours.toFixed(1)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">₹{item.dailyWageAmount.toFixed(2)}</TableCell>
                        <TableCell className="text-right">₹{item.overtimePay.toFixed(2)}</TableCell>
                        <TableCell className="text-right">₹{item.pieceRateEarnings.toFixed(2)}</TableCell>
                        <TableCell className="text-right">₹{item.grossPay.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-red-600">-₹{item.advances.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-green-600">₹{item.netPay.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPayroll(false);
                    setPayrollItems([]);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleProcessPayroll} disabled={loading}>
                  {loading ? 'Processing...' : 'Process & Pay'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
