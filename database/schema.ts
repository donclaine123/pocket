export const AppSchema = {
  types: {
    transactions: {} as any,
  },
};

export type Database = (typeof AppSchema)["types"];
export type TransactionRecord = any;
