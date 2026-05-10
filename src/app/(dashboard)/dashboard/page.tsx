import Link from 'next/link';
import {
  ArrowUpRight,
  Briefcase,
  CreditCard,
  Handshake,
  Store,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { getDashboardStats } from '@/actions/dashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function money(value: number) {
  return `৳${value.toLocaleString()}`;
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const netDuePosition = stats.totalReceivable - stats.totalPayable;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Agency Overview</h1>
          <p className="text-sm text-muted-foreground">
            Track your business performance and financial position
          </p>
        </div>
        <Link href="/services">
          <Button>
            <Briefcase className="mr-2 h-4 w-4" />
            New Service
          </Button>
        </Link>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold">{money(stats.totalBalance)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Customer Due</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-amber-600">{money(stats.totalReceivable)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stats.openReceivableCount} open entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendor Due</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-rose-600">{money(stats.totalPayable)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stats.openPayableCount} open entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-semibold ${netDuePosition >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {money(netDuePosition)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Customer minus vendor due</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Briefcase className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Services</p>
            <p className="text-lg font-semibold">{stats.totalServices}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:bg-emerald-900/20">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">Delivered</p>
            <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">{stats.deliveredServices}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:bg-amber-900/20">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <Briefcase className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-amber-700 dark:text-amber-400">Pending</p>
            <p className="text-lg font-semibold text-amber-700 dark:text-amber-400">{stats.pendingServices}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50/50 p-3 dark:bg-orange-900/20">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
            <Store className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-orange-700 dark:text-orange-400">Unsettled Cost</p>
            <p className="text-lg font-semibold text-orange-700 dark:text-orange-400">{money(stats.unsettledVendorCost)}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/services"
            className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Briefcase className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">Manage Services</p>
                <p className="text-xs text-muted-foreground">View and manage all services</p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>

          <Link
            href="/customers"
            className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">Customer Profiles</p>
                <p className="text-xs text-muted-foreground">View customer ledger and history</p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>

          <Link
            href="/vendors"
            className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                <Store className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">Vendor Profiles</p>
                <p className="text-xs text-muted-foreground">Manage vendors and templates</p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>

          <Link
            href="/receivable"
            className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">Receivables</p>
                <p className="text-xs text-muted-foreground">Collect customer payments</p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>

          <Link
            href="/payable"
            className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                <Handshake className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">Payables</p>
                <p className="text-xs text-muted-foreground">Settle vendor payments</p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>

          <Link
            href="/accounts"
            className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">Accounts</p>
                <p className="text-xs text-muted-foreground">View account balances</p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>

      {/* Service Delivery Ledger */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Deliveries</CardTitle>
            <p className="text-sm text-muted-foreground">Latest service deliveries with amounts</p>
          </div>
          <Link href="/services">
            <Button variant="outline" size="sm">
              View All
              <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {stats.agentLedger.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Briefcase className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">No delivered services yet</p>
              <Link href="/services" className="mt-4">
                <Button variant="outline" size="sm">Create First Service</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.agentLedger.slice(0, 10).map((row) => (
                <div key={row._id} className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/20 hover:shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-base">{row.serviceName}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {row.customerName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Store className="h-3.5 w-3.5" />
                          {row.vendorName}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full sm:w-auto grid-cols-3 sm:flex-row items-center gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/50">
                    <div className="flex-1 sm:flex-none text-left sm:text-right">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Customer</p>
                      <p className="font-semibold text-sm">{money(row.customerAmount)}</p>
                      {row.customerDue > 0 && <p className="text-[10px] text-amber-600 font-medium">Due: {money(row.customerDue)}</p>}
                    </div>
                    
                    <div className="w-px h-8 bg-border/50 hidden sm:block"></div>
                    
                    <div className="flex-1 sm:flex-none text-center sm:text-right">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Vendor</p>
                      <p className="font-semibold text-sm">{money(row.vendorAmount)}</p>
                      {row.vendorDue > 0 && <p className="text-[10px] text-rose-600 font-medium">Due: {money(row.vendorDue)}</p>}
                    </div>

                    <div className="w-px h-8 bg-border/50 hidden sm:block"></div>

                    <div className="flex-1 sm:flex-none text-right">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Profit</p>
                      <p className="font-bold text-sm text-emerald-600">+{money(row.profit)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
