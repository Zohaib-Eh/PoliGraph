import * as React from "react";
import { cn } from "@/lib/utils";
const Table = ({ className, ...p }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="relative w-full overflow-x-auto"><table className={cn("w-full caption-bottom text-sm", className)} {...p} /></div>);
const TableHeader = ({ className, ...p }: React.HTMLAttributes<HTMLTableSectionElement>) => <thead className={cn("[&_tr]:border-b", className)} {...p} />;
const TableBody = ({ className, ...p }: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody className={cn("[&_tr:last-child]:border-0", className)} {...p} />;
const TableRow = ({ className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) => <tr className={cn("border-b border-border transition-colors hover:bg-white/[.02]", className)} {...p} />;
const TableHead = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th className={cn("h-11 px-4 text-left align-middle text-xs font-medium text-muted-foreground", className)} {...p} />;
const TableCell = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn("px-4 py-3.5 align-top", className)} {...p} />;
export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
