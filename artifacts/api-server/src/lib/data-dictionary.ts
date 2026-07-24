import { orderedModules } from "./migration-engine.js";

export type DataDictionaryField = {
  entity: string;
  entityLabel: string;
  field: string;
  label: string;
  type: string;
  required: boolean;
  acceptedValues?: string[];
  aliases: string[];
  examples: string;
  relation?: string;
};

const RELATIONS: Record<string, Record<string, string>> = {
  contacts: { clientName: "clients.name" },
  invoices: { clientName: "clients.name" },
  payments: { invoiceNumber: "invoices.referenceNumber" },
  collaborators: { department: "departments.name" },
  leave_balances: { employeeNumber: "collaborators.employeeNumber", email: "users.email" },
  projects: { clientName: "clients.name" },
  stock_initial: { productCode: "services.code" },
  bank_accounts: { accountCode: "chart_of_accounts.code" },
  opening_balance: { accountCode: "chart_of_accounts.code" },
  budgets: { accountCode: "chart_of_accounts.code", costCenter: "cost_centers.code" },
};

export function buildDataDictionary(): DataDictionaryField[] {
  return orderedModules().flatMap((module) =>
    module.fields.map((field) => ({
      entity: module.id,
      entityLabel: module.label,
      field: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      acceptedValues: field.acceptedValues,
      aliases: field.aliases,
      examples: field.examples,
      relation: RELATIONS[module.id]?.[field.key],
    })),
  );
}
