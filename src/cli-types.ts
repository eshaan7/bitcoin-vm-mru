export type CLIAction =
  | "Transfer Sats"
  | "Transfer Sats from Multisig"
  | "Mint Sats"
  | "View Balances"
  | "Switch account"
  | "Exit";

export interface CLITransferSatsResponse {
  to: string;
  sats: number;
}
