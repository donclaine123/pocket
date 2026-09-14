import { column, Schema, Table } from "@powersync/react-native";

export const transactionsTable = new Table(
  {
    user_id: column.text,
    type: column.text,
    amount: column.real,
    category: column.text,
    note: column.text,
    date: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      date: ["date"],
      user_date: ["user_id", "date"],
    },
  }
);

export const AppSchema = new Schema({
  transactions: transactionsTable,
});

export type Database = (typeof AppSchema)["types"];
export type TransactionRecord = Database["transactions"];
