import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Select, SelectTrigger, SelectInput, SelectIcon, SelectPortal, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectItem, SelectItemText } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

const screenWidth = Dimensions.get('window').width;

interface ReportsTabProps {
  accessToken?: string;
}

interface ReportData {
  attendance: {
    labels: string[];
    present: number[];
    absent: number[];
  };
  payroll: {
    labels: string[];
    amounts: number[];
  };
  workersBySkill: {
    labels: string[];
    values: number[];
  };
}

export function ReportsTab({ accessToken }: ReportsTabProps) {
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const [reportType, setReportType] = useState<string>('attendance');
  const [dateRange, setDateRange] = useState<string>('week');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchReportData();
    }
  }, [token, reportType, dateRange]);

  const fetchReportData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/reports?type=${reportType}&range=${dateRange}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch report data');
      }

      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error('Error fetching report data:', error);
      // Use mock data for demonstration
      setReportData({
        attendance: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          present: [20, 22, 18, 25, 23, 20, 15],
          absent: [5, 3, 7, 0, 2, 5, 10],
        },
        payroll: {
          labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
          amounts: [50000, 55000, 52000, 58000],
        },
        workersBySkill: {
          labels: ['Unskilled', 'Semi-skilled', 'Skilled', 'Highly Skilled'],
          values: [15, 20, 10, 5],
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#2563eb',
    },
  };

  return (
    <View style={styles.container}>
      <ScrollView>
        <Box className="p-4">
          <VStack space="lg">
            <Text size="lg" bold className="mb-2">Reports & Analytics</Text>

            {/* Report Type Selector */}
            <HStack space="sm">
              <Box className="flex-1">
                <Text size="sm" className="mb-1 text-gray-600" style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>Report Type</Text>
                <Select selectedValue={reportType} onValueChange={setReportType}>
                  <SelectTrigger variant="outline" size="md" style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8 }}>
                    <SelectInput placeholder="Select report type" style={{ fontSize: 16, color: '#111827', paddingHorizontal: 12, paddingVertical: 10 }} />
                    <SelectIcon className="mr-3" />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      <SelectItem label="Attendance" value="attendance">
                        <SelectItemText>Attendance</SelectItemText>
                      </SelectItem>
                      <SelectItem label="Payroll" value="payroll">
                        <SelectItemText>Payroll</SelectItemText>
                      </SelectItem>
                      <SelectItem label="Workers" value="workers">
                        <SelectItemText>Workers</SelectItemText>
                      </SelectItem>
                    </SelectContent>
                  </SelectPortal>
                </Select>
              </Box>
              <Box className="flex-1">
                <Text size="sm" className="mb-1 text-gray-600" style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>Date Range</Text>
                <Select selectedValue={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger variant="outline" size="md" style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8 }}>
                    <SelectInput placeholder="Select date range" style={{ fontSize: 16, color: '#111827', paddingHorizontal: 12, paddingVertical: 10 }} />
                    <SelectIcon className="mr-3" />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      <SelectItem label="Week" value="week">
                        <SelectItemText>Week</SelectItemText>
                      </SelectItem>
                      <SelectItem label="Month" value="month">
                        <SelectItemText>Month</SelectItemText>
                      </SelectItem>
                      <SelectItem label="Quarter" value="quarter">
                        <SelectItemText>Quarter</SelectItemText>
                      </SelectItem>
                      <SelectItem label="Year" value="year">
                        <SelectItemText>Year</SelectItemText>
                      </SelectItem>
                    </SelectContent>
                  </SelectPortal>
                </Select>
              </Box>
            </HStack>

            {reportData && (
              <>
                {reportType === 'attendance' && reportData.attendance && (
                  <Card className="p-4">
                    <Text size="lg" bold className="mb-4">Attendance Trend</Text>
                    <LineChart
                      data={{
                        labels: reportData.attendance.labels,
                        datasets: [
                          {
                            data: reportData.attendance.present,
                            color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
                            strokeWidth: 2,
                          },
                          {
                            data: reportData.attendance.absent,
                            color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                            strokeWidth: 2,
                          },
                        ],
                        legend: ['Present', 'Absent'],
                      }}
                      width={screenWidth - 64}
                      height={220}
                      chartConfig={chartConfig}
                      bezier
                      style={styles.chart}
                    />
                  </Card>
                )}

                {reportType === 'payroll' && reportData.payroll && (
                  <Card className="p-4">
                    <Text size="lg" bold className="mb-4">Payroll Summary</Text>
                    <BarChart
                      data={{
                        labels: reportData.payroll.labels,
                        datasets: [
                          {
                            data: reportData.payroll.amounts,
                          },
                        ],
                      }}
                      width={screenWidth - 64}
                      height={220}
                      yAxisLabel="₹"
                      yAxisSuffix=""
                      chartConfig={chartConfig}
                      style={styles.chart}
                      showValuesOnTopOfBars
                    />
                  </Card>
                )}

                {reportType === 'workers' && reportData.workersBySkill && (
                  <Card className="p-4">
                    <Text size="lg" bold className="mb-4">Workers by Skill Level</Text>
                    <PieChart
                      data={reportData.workersBySkill.labels.map((label, index) => ({
                        name: label,
                        population: reportData.workersBySkill.values[index],
                        color: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'][index],
                        legendFontColor: '#7F7F7F',
                        legendFontSize: 12,
                      }))}
                      width={screenWidth - 64}
                      height={220}
                      chartConfig={chartConfig}
                      accessor="population"
                      backgroundColor="transparent"
                      paddingLeft="15"
                      style={styles.chart}
                    />
                  </Card>
                )}

                {/* Summary Stats */}
                <Card className="p-4">
                  <Text size="lg" bold className="mb-4">Summary</Text>
                  <VStack space="md">
                    {reportType === 'attendance' && (
                      <>
                        <HStack className="justify-between">
                          <Text>Total Present Days</Text>
                          <Text bold>
                            {reportData.attendance.present.reduce((a, b) => a + b, 0)}
                          </Text>
                        </HStack>
                        <HStack className="justify-between">
                          <Text>Total Absent Days</Text>
                          <Text bold>
                            {reportData.attendance.absent.reduce((a, b) => a + b, 0)}
                          </Text>
                        </HStack>
                        <HStack className="justify-between">
                          <Text>Attendance Rate</Text>
                          <Text bold>
                            {(
                              (reportData.attendance.present.reduce((a, b) => a + b, 0) /
                                (reportData.attendance.present.reduce((a, b) => a + b, 0) +
                                  reportData.attendance.absent.reduce((a, b) => a + b, 0))) *
                              100
                            ).toFixed(1)}%
                          </Text>
                        </HStack>
                      </>
                    )}
                    {reportType === 'payroll' && (
                      <>
                        <HStack className="justify-between">
                          <Text>Total Payroll</Text>
                          <Text bold>
                            ₹{reportData.payroll.amounts.reduce((a, b) => a + b, 0).toLocaleString()}
                          </Text>
                        </HStack>
                        <HStack className="justify-between">
                          <Text>Average Weekly</Text>
                          <Text bold>
                            ₹{Math.round(reportData.payroll.amounts.reduce((a, b) => a + b, 0) / reportData.payroll.amounts.length).toLocaleString()}
                          </Text>
                        </HStack>
                      </>
                    )}
                    {reportType === 'workers' && (
                      <>
                        <HStack className="justify-between">
                          <Text>Total Workers</Text>
                          <Text bold>
                            {reportData.workersBySkill.values.reduce((a, b) => a + b, 0)}
                          </Text>
                        </HStack>
                      </>
                    )}
                  </VStack>
                </Card>
              </>
            )}
          </VStack>
        </Box>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
});
