import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar, 
  Download, 
  IndianRupee,
  ChevronDown,
  ChevronUp 
} from 'lucide-react';
import { projectId } from '../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface ReportsTabProps {
  accessToken: string;
}

interface AttendanceDetail {
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  regularHours: number;
  overtimeHours: number;
  breakHours: number;
  dailyPayment: number;
  overtimePayment: number;
  totalPayment: number;
  messCharge: number;
}

interface WorkerDetail {
  workerId: string;
  workerName: string;
  workerPhone: string;
  dailyWage: number;
  messCharge: number;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  totalAttendanceDays: number;
  totalRegularHours: string;
  totalOvertimeHours: string;
  totalBreakHours: string;
  totalDailyPayment: string;
  totalOvertimePayment: string;
  totalGrossPayment: string;
  totalMessCharges: string;
  totalAdvances: string;
  pendingAdvances: string;
  netPayment: string;
  totalPayrollPaid: string;
  attendanceDetails: AttendanceDetail[];
}

interface ReportData {
  attendanceReport: {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    halfDays: number;
    attendanceRate: number;
  };
  payrollReport: {
    totalPaid: number;
    totalAdvances: number;
    pendingAdvances: number;
    netPayments: number;
    totalMessCharges: number;
  };
  workerStats: {
    totalWorkers: number;
    activeWorkers: number;
    inactiveWorkers: number;
  };
  siteStats: {
    totalSites: number;
    activeSites: number;
  };
  workerDetails: WorkerDetail[];
  rawAttendance: any[];
  rawPayroll: any[];
}

export function ReportsTab({ accessToken }: ReportsTabProps) {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<'attendance' | 'payroll' | 'summary'>('summary');
  const [startDate, setStartDate] = useState(
    new Date(new Date().setDate(1)).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate, reportType]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/reports?type=${reportType}&startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch report data');
      
      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkerExpansion = (workerId: string) => {
    const newExpanded = new Set(expandedWorkers);
    if (newExpanded.has(workerId)) {
      newExpanded.delete(workerId);
    } else {
      newExpanded.add(workerId);
    }
    setExpandedWorkers(newExpanded);
  };

  const downloadSummaryCSV = () => {
    if (!reportData) return;

    const csvRows = [];
    
    // Header
    csvRows.push('ConstLabour Summary Report');
    csvRows.push(`Period: ${startDate} to ${endDate}`);
    csvRows.push('');
    
    // Attendance Summary
    csvRows.push('ATTENDANCE SUMMARY');
    csvRows.push('Metric,Value');
    csvRows.push(`Total Days,${reportData.attendanceReport.totalDays}`);
    csvRows.push(`Present Days,${reportData.attendanceReport.presentDays}`);
    csvRows.push(`Half Days,${reportData.attendanceReport.halfDays}`);
    csvRows.push(`Absent Days,${reportData.attendanceReport.absentDays}`);
    csvRows.push(`Attendance Rate,${reportData.attendanceReport.attendanceRate}%`);
    csvRows.push('');
    
    // Payroll Summary
    csvRows.push('PAYROLL SUMMARY');
    csvRows.push('Metric,Amount (₹)');
    csvRows.push(`Total Payments,${reportData.payrollReport.totalPaid.toFixed(2)}`);
    csvRows.push(`Total Advances,${reportData.payrollReport.totalAdvances.toFixed(2)}`);
    csvRows.push(`Pending Advances,${reportData.payrollReport.pendingAdvances.toFixed(2)}`);
    csvRows.push(`Total Mess Charges,${reportData.payrollReport.totalMessCharges.toFixed(2)}`);
    csvRows.push(`Net Payments,${reportData.payrollReport.netPayments.toFixed(2)}`);
    csvRows.push('');
    
    // Worker Statistics
    csvRows.push('WORKER STATISTICS');
    csvRows.push('Metric,Count');
    csvRows.push(`Total Workers,${reportData.workerStats.totalWorkers}`);
    csvRows.push(`Active Workers,${reportData.workerStats.activeWorkers}`);
    csvRows.push(`Inactive Workers,${reportData.workerStats.inactiveWorkers}`);
    
    downloadCSV(csvRows.join('\n'), `summary_report_${startDate}_to_${endDate}.csv`);
    toast.success('Summary report downloaded');
  };

  const downloadAttendanceCSV = () => {
    if (!reportData || !reportData.rawAttendance) return;

    const csvRows = [];
    
    // Header
    csvRows.push('ConstLabour Attendance Report');
    csvRows.push(`Period: ${startDate} to ${endDate}`);
    csvRows.push('');
    csvRows.push('Date,Worker Name,Status,Check In,Check Out,Break Hours,Regular Hours,Overtime Hours,Net Work Hours,Daily Payment,Overtime Payment,Total Payment,Mess Charge');
    
    // Data rows
    reportData.rawAttendance.forEach((record: any) => {
      csvRows.push([
        record.date,
        record.workerName || 'N/A',
        record.status,
        record.checkIn || 'N/A',
        record.checkOut || 'N/A',
        (record.breakHours || 0).toFixed(2),
        (record.regularHours || 0).toFixed(2),
        (record.overtimeHours || 0).toFixed(2),
        (record.netWorkHours || 0).toFixed(2),
        (record.dailyPayment || 0).toFixed(2),
        (record.overtimePayment || 0).toFixed(2),
        (record.totalPayment || 0).toFixed(2),
        '0' // Mess charge per day would need to be calculated
      ].join(','));
    });
    
    downloadCSV(csvRows.join('\n'), `attendance_report_${startDate}_to_${endDate}.csv`);
    toast.success('Attendance report downloaded');
  };

  const downloadPayrollCSV = () => {
    if (!reportData || !reportData.workerDetails) return;

    const csvRows = [];
    
    // Header
    csvRows.push('ConstLabour Payroll Report');
    csvRows.push(`Period: ${startDate} to ${endDate}`);
    csvRows.push('');
    csvRows.push('Worker Name,Phone,Daily Wage,Mess Charge/Day,Present Days,Half Days,Absent Days,Regular Hours,Overtime Hours,Break Hours,Daily Payment,Overtime Payment,Gross Payment,Mess Charges,Advances,Pending Advances,Net Payment,Payroll Paid');
    
    // Data rows
    reportData.workerDetails.forEach((worker: WorkerDetail) => {
      csvRows.push([
        worker.workerName,
        worker.workerPhone,
        worker.dailyWage.toFixed(2),
        worker.messCharge.toFixed(2),
        worker.presentDays,
        worker.halfDays,
        worker.absentDays,
        worker.totalRegularHours,
        worker.totalOvertimeHours,
        worker.totalBreakHours,
        worker.totalDailyPayment,
        worker.totalOvertimePayment,
        worker.totalGrossPayment,
        worker.totalMessCharges,
        worker.totalAdvances,
        worker.pendingAdvances,
        worker.netPayment,
        worker.totalPayrollPaid
      ].join(','));
    });
    
    // Total row
    const totals = reportData.workerDetails.reduce((acc, w) => ({
      grossPayment: acc.grossPayment + parseFloat(w.totalGrossPayment),
      messCharges: acc.messCharges + parseFloat(w.totalMessCharges),
      advances: acc.advances + parseFloat(w.totalAdvances),
      netPayment: acc.netPayment + parseFloat(w.netPayment),
    }), { grossPayment: 0, messCharges: 0, advances: 0, netPayment: 0 });
    
    csvRows.push('');
    csvRows.push(`TOTALS,,,,,,,,,,,${totals.grossPayment.toFixed(2)},${totals.messCharges.toFixed(2)},${totals.advances.toFixed(2)},,${totals.netPayment.toFixed(2)},`);
    
    downloadCSV(csvRows.join('\n'), `payroll_report_${startDate}_to_${endDate}.csv`);
    toast.success('Payroll report downloaded');
  };

  const downloadDetailedPayrollCSV = () => {
    if (!reportData || !reportData.workerDetails) return;

    const csvRows = [];
    
    // Header
    csvRows.push('ConstLabour Detailed Payroll Report with Attendance');
    csvRows.push(`Period: ${startDate} to ${endDate}`);
    csvRows.push('');
    
    // For each worker, add their details and attendance
    reportData.workerDetails.forEach((worker: WorkerDetail) => {
      csvRows.push('');
      csvRows.push(`WORKER: ${worker.workerName}`);
      csvRows.push(`Phone: ${worker.workerPhone}`);
      csvRows.push(`Daily Wage: ₹${worker.dailyWage.toFixed(2)}`);
      csvRows.push(`Daily Mess Charge: ₹${worker.messCharge.toFixed(2)}`);
      csvRows.push('');
      csvRows.push('Date,Status,Check In,Check Out,Break Hours,Regular Hours,Overtime Hours,Daily Payment,Overtime Payment,Total Payment,Mess Charge');
      
      worker.attendanceDetails.forEach((att: AttendanceDetail) => {
        csvRows.push([
          att.date,
          att.status,
          att.checkIn || 'N/A',
          att.checkOut || 'N/A',
          att.breakHours.toFixed(2),
          att.regularHours.toFixed(2),
          att.overtimeHours.toFixed(2),
          att.dailyPayment.toFixed(2),
          att.overtimePayment.toFixed(2),
          att.totalPayment.toFixed(2),
          att.messCharge.toFixed(2)
        ].join(','));
      });
      
      csvRows.push('');
      csvRows.push('SUMMARY');
      csvRows.push(`Present Days,${worker.presentDays}`);
      csvRows.push(`Half Days,${worker.halfDays}`);
      csvRows.push(`Absent Days,${worker.absentDays}`);
      csvRows.push(`Total Regular Hours,${worker.totalRegularHours}`);
      csvRows.push(`Total Overtime Hours,${worker.totalOvertimeHours}`);
      csvRows.push(`Total Break Hours,${worker.totalBreakHours}`);
      csvRows.push(`Total Daily Payment,₹${worker.totalDailyPayment}`);
      csvRows.push(`Total Overtime Payment,₹${worker.totalOvertimePayment}`);
      csvRows.push(`Gross Payment,₹${worker.totalGrossPayment}`);
      csvRows.push(`Total Mess Charges,₹${worker.totalMessCharges}`);
      csvRows.push(`Total Advances,₹${worker.totalAdvances}`);
      csvRows.push(`Pending Advances,₹${worker.pendingAdvances}`);
      csvRows.push(`Net Payment,₹${worker.netPayment}`);
      csvRows.push('================');
    });
    
    downloadCSV(csvRows.join('\n'), `detailed_payroll_report_${startDate}_to_${endDate}.csv`);
    toast.success('Detailed payroll report downloaded');
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadReport = () => {
    if (reportType === 'summary') {
      downloadSummaryCSV();
    } else if (reportType === 'attendance') {
      downloadAttendanceCSV();
    } else if (reportType === 'payroll') {
      downloadPayrollCSV();
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label htmlFor="reportType">Report Type</Label>
            <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">Summary Report</SelectItem>
                <SelectItem value="attendance">Attendance Report</SelectItem>
                <SelectItem value="payroll">Payroll Report</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={downloadReport}
              variant="outline"
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </Button>
            {reportType === 'payroll' && (
              <Button
                onClick={downloadDetailedPayrollCSV}
                variant="outline"
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Detailed CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Loading report data...
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Total Workers</p>
                    <p className="text-xl text-gray-900">
                      {reportData?.workerStats.totalWorkers || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Attendance Rate</p>
                    <p className="text-xl text-gray-900">
                      {reportData?.attendanceReport.attendanceRate || 0}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Total Paid</p>
                    <p className="text-xl text-gray-900 flex items-center">
                      <IndianRupee className="w-4 h-4" />
                      {reportData?.payrollReport.totalPaid?.toLocaleString('en-IN') || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Pending Advances</p>
                    <p className="text-xl text-gray-900 flex items-center">
                      <IndianRupee className="w-4 h-4" />
                      {reportData?.payrollReport.pendingAdvances?.toLocaleString('en-IN') || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Attendance Breakdown */}
          {(reportType === 'attendance' || reportType === 'summary') && (
            <Card>
              <CardHeader>
                <CardTitle>Attendance Breakdown</CardTitle>
                <CardDescription>
                  {startDate} to {endDate}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm text-gray-700">Present Days</span>
                  <span className="text-gray-900">
                    {reportData?.attendanceReport.presentDays || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <span className="text-sm text-gray-700">Half Days</span>
                  <span className="text-gray-900">
                    {reportData?.attendanceReport.halfDays || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <span className="text-sm text-gray-700">Absent Days</span>
                  <span className="text-gray-900">
                    {reportData?.attendanceReport.absentDays || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-gray-700">Total Days</span>
                  <span className="text-gray-900">
                    {reportData?.attendanceReport.totalDays || 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payroll Summary */}
          {(reportType === 'payroll' || reportType === 'summary') && (
            <Card>
              <CardHeader>
                <CardTitle>Payroll Summary</CardTitle>
                <CardDescription>
                  Financial overview for selected period
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm text-gray-700">Total Payments</span>
                  <span className="text-gray-900 flex items-center">
                    <IndianRupee className="w-4 h-4 mr-1" />
                    {reportData?.payrollReport.totalPaid?.toLocaleString('en-IN') || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <span className="text-sm text-gray-700">Total Advances</span>
                  <span className="text-gray-900 flex items-center">
                    <IndianRupee className="w-4 h-4 mr-1" />
                    {reportData?.payrollReport.totalAdvances?.toLocaleString('en-IN') || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <span className="text-sm text-gray-700">Total Mess Charges</span>
                  <span className="text-gray-900 flex items-center">
                    <IndianRupee className="w-4 h-4 mr-1" />
                    {reportData?.payrollReport.totalMessCharges?.toLocaleString('en-IN') || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-gray-700">Net Payments</span>
                  <span className="text-gray-900 flex items-center">
                    <IndianRupee className="w-4 h-4 mr-1" />
                    {reportData?.payrollReport.netPayments?.toLocaleString('en-IN') || 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Worker-wise Payroll Details */}
          {reportType === 'payroll' && reportData?.workerDetails && reportData.workerDetails.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Worker-wise Payroll Details</CardTitle>
                <CardDescription>
                  Click on a worker to see detailed attendance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {reportData.workerDetails.map((worker: WorkerDetail) => (
                  <div key={worker.workerId} className="border rounded-lg overflow-hidden">
                    {/* Worker Summary */}
                    <button
                      onClick={() => toggleWorkerExpansion(worker.workerId)}
                      className="w-full p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{worker.workerName}</h3>
                          <p className="text-sm text-gray-600">{worker.workerPhone}</p>
                        </div>
                        <div className="text-right mr-2">
                          <p className="text-sm text-gray-600">Net Payment</p>
                          <p className="font-medium text-green-600 flex items-center justify-end">
                            <IndianRupee className="w-4 h-4" />
                            {parseFloat(worker.netPayment).toLocaleString('en-IN')}
                          </p>
                        </div>
                        {expandedWorkers.has(worker.workerId) ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                        <div className="bg-green-50 p-2 rounded">
                          <p className="text-gray-600">Present: {worker.presentDays}</p>
                        </div>
                        <div className="bg-orange-50 p-2 rounded">
                          <p className="text-gray-600">Half: {worker.halfDays}</p>
                        </div>
                        <div className="bg-red-50 p-2 rounded">
                          <p className="text-gray-600">Absent: {worker.absentDays}</p>
                        </div>
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {expandedWorkers.has(worker.workerId) && (
                      <div className="p-4 space-y-3 bg-white border-t">
                        {/* Payment Breakdown */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm text-gray-700">Payment Breakdown</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between p-2 bg-gray-50 rounded">
                              <span className="text-gray-600">Daily Wage:</span>
                              <span className="flex items-center">
                                <IndianRupee className="w-3 h-3" />
                                {worker.dailyWage.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between p-2 bg-gray-50 rounded">
                              <span className="text-gray-600">Mess/Day:</span>
                              <span className="flex items-center">
                                <IndianRupee className="w-3 h-3" />
                                {worker.messCharge.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between p-2 bg-blue-50 rounded">
                              <span className="text-gray-600">Regular Hrs:</span>
                              <span>{worker.totalRegularHours}h</span>
                            </div>
                            <div className="flex justify-between p-2 bg-purple-50 rounded">
                              <span className="text-gray-600">OT Hrs:</span>
                              <span>{worker.totalOvertimeHours}h</span>
                            </div>
                            <div className="flex justify-between p-2 bg-green-50 rounded">
                              <span className="text-gray-600">Daily Pay:</span>
                              <span className="flex items-center">
                                <IndianRupee className="w-3 h-3" />
                                {parseFloat(worker.totalDailyPayment).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between p-2 bg-green-50 rounded">
                              <span className="text-gray-600">OT Pay:</span>
                              <span className="flex items-center">
                                <IndianRupee className="w-3 h-3" />
                                {parseFloat(worker.totalOvertimePayment).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between p-2 bg-green-100 rounded font-medium">
                              <span className="text-gray-700">Gross Pay:</span>
                              <span className="flex items-center">
                                <IndianRupee className="w-3 h-3" />
                                {parseFloat(worker.totalGrossPayment).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between p-2 bg-red-50 rounded">
                              <span className="text-gray-600">Mess Charges:</span>
                              <span className="flex items-center">
                                <IndianRupee className="w-3 h-3" />
                                {parseFloat(worker.totalMessCharges).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between p-2 bg-orange-50 rounded">
                              <span className="text-gray-600">Advances:</span>
                              <span className="flex items-center">
                                <IndianRupee className="w-3 h-3" />
                                {parseFloat(worker.totalAdvances).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between p-2 bg-green-100 rounded font-medium">
                              <span className="text-gray-700">Net Pay:</span>
                              <span className="flex items-center text-green-600">
                                <IndianRupee className="w-3 h-3" />
                                {parseFloat(worker.netPayment).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Attendance Details */}
                        {worker.attendanceDetails && worker.attendanceDetails.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm text-gray-700">Daily Attendance</h4>
                            <div className="space-y-1 max-h-64 overflow-y-auto">
                              {worker.attendanceDetails.map((att: AttendanceDetail, idx: number) => (
                                <div key={idx} className="p-2 bg-gray-50 rounded text-xs">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium">{att.date}</span>
                                    <span className={`px-2 py-0.5 rounded ${
                                      att.status === 'present' ? 'bg-green-100 text-green-700' :
                                      att.status === 'half-day' ? 'bg-orange-100 text-orange-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {att.status}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1 text-gray-600">
                                    <div>In: {att.checkIn || 'N/A'}</div>
                                    <div>Out: {att.checkOut || 'N/A'}</div>
                                    <div>Reg: {att.regularHours.toFixed(1)}h</div>
                                    <div>OT: {att.overtimeHours.toFixed(1)}h</div>
                                    <div className="flex items-center">
                                      Pay: <IndianRupee className="w-3 h-3 ml-1" />{att.totalPayment.toFixed(2)}
                                    </div>
                                    <div className="flex items-center">
                                      Mess: <IndianRupee className="w-3 h-3 ml-1" />{att.messCharge.toFixed(2)}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Worker Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Worker Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <span className="text-sm text-gray-700">Total Workers</span>
                <span className="text-gray-900">
                  {reportData?.workerStats.totalWorkers || 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <span className="text-sm text-gray-700">Active Workers</span>
                <span className="text-gray-900">
                  {reportData?.workerStats.activeWorkers || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
