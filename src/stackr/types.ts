export interface UTXO {
  txId: string; // Transaction ID of previous tx where this was output (0x for coinbase)
  outputIndex: number; // Index of the output in the previous tx
  address: string; // Bitcoin address
  script: string; // Locking script (P2PKH, etc.)
  satoshis: number; // Value in satoshis
}

export interface BitcoinVMStateType {
  admins: string[]; // Ethereum addresses of rollup operator/admins
  // TODO: utxos can be retrieved from transactions so don't keep in raw state (implement transformer)
  utxos: Record<string, UTXO[]>; // Transaction ID -> UTXOs
  transactions: Record<string, string>; // (bitcore#Transaction#id) -> (bitcore#Transaction#serialize)
}

export interface MintSatsInputs {
  ethAddress: string;
  btcAddress: string;
  satoshis: number;
  timestamp: number;
}

export interface RunTxInputs {
  serializedTx: string;
}
