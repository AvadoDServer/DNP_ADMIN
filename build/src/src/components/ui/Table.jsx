import React from "react";
import { cn } from "./cn";

/**
 * Lightweight table primitives styled on the token system. Compose freely:
 *
 *   <Table>
 *     <THead><TR><TH>Name</TH><TH>Status</TH></TR></THead>
 *     <TBody>
 *       <TR><TD>...</TD><TD>...</TD></TR>
 *     </TBody>
 *   </Table>
 *
 * Wrap in a Card with padding="none" for a framed look.
 */
export const Table = ({ className, children, ...props }) => (
  <div className="w-full overflow-x-auto">
    <table
      className={cn("w-full border-collapse text-sm", className)}
      {...props}
    >
      {children}
    </table>
  </div>
);

export const THead = ({ className, children, ...props }) => (
  <thead className={cn("", className)} {...props}>
    {children}
  </thead>
);

export const TBody = ({ className, children, ...props }) => (
  <tbody
    className={cn(
      "[&>tr]:border-t [&>tr]:border-border [&>tr:hover]:bg-fg/[0.025]",
      className
    )}
    {...props}
  >
    {children}
  </tbody>
);

export const TR = ({ className, children, ...props }) => (
  <tr className={cn("transition-colors", className)} {...props}>
    {children}
  </tr>
);

export const TH = ({ className, align = "left", children, ...props }) => (
  <th
    className={cn(
      "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle",
      align === "right" && "text-right",
      align === "center" && "text-center",
      align === "left" && "text-left",
      className
    )}
    {...props}
  >
    {children}
  </th>
);

export const TD = ({ className, align = "left", children, ...props }) => (
  <td
    className={cn(
      "px-4 py-3 align-middle text-fg",
      align === "right" && "text-right",
      align === "center" && "text-center",
      className
    )}
    {...props}
  >
    {children}
  </td>
);

export default Table;
