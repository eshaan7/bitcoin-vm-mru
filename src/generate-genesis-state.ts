import { hex } from "@scure/base";
import {
  Transaction as BTCTransaction,
  TEST_NETWORK as BTC_TEST_NETWORK,
} from "@scure/btc-signer";

const addressesToFund = [
  {
    address: "tb1pfuf0t4a6z3qervynu642te0ny55vpwu8yvlh620z0sxmvzuymd5qu54xj7", // Admin
    sats: 500,
  },
  {
    address: "tb1pl786eu96xjdgjk6s8564tc3tz3pt55zxm37yhn0jyyjqatnmhmqsamavhx", // User 1
    sats: 400,
  },
  {
    address: "tb1p5zzsrj56hhy4x40w52xgsnw0gqawaqnvgwupzxh82hsqyql9c9hq2kf4sl", // User 2
    sats: 300,
  },
  {
    address: "2NEz2bwtZvirKotGu87YJN72Zfe5kz364dR", // MultiSig
    sats: 200,
  },
  {
    address: "2MszYYFSBUoVn6Dk3h2GawgCvQSbnZdHYRk", // xverse
    sats: 10000,
  },
  {
    address: "tb1qgr92l82qecgskcjm6c3mmvg0mcwlykm68gz4xf", // leather
    sats: 5000,
  },
  {
    address: "mkCXGu68FeXVxXnEi1S5BmZouSAhkAo7zR", // unisat (P2PKH)
    sats: 5000,
  },
  {
    address: "tb1pxfr4qt2ga6slpww2vgxhthnzxrwvkcr48maf8pnundhjadkeejds0frzvx", // unisat (P2TR)
    sats: 1000,
  },
];

const generateGenesisState = () => {
  const tx = new BTCTransaction();
  for (const { address, sats } of addressesToFund) {
    tx.addOutputAddress(address, BigInt(sats), BTC_TEST_NETWORK);
  }
  console.log(
    JSON.stringify({
      utxos: {
        [tx.id]: Array.from({ length: tx.outputsLength }, (_, idx) =>
          tx.getOutput(idx)
        ).map((output, idx) => ({
          txId: tx.id,
          outputIndex: idx,
          address: tx.getOutputAddress(idx)!,
          script: hex.encode(output.script!),
          satoshis: Number(output.amount!),
        })),
      },
      transactions: {
        [tx.id]: tx.hex,
      },
    })
  );
};

// const generateGenesisState2 = () => {
//   const tx = new bitcore.Transaction().fee(0);
//   for (const { address, sats } of addressesToFund) {
//     tx.to(address, sats);
//   }
//   console.log(
//     JSON.stringify({
//       utxos: {
//         [tx.id]: tx.outputs.map((output, idx) => ({
//           txId: tx.id,
//           outputIndex: idx,
//           address: output.script.toAddress().toString(),
//           script: output.script.toHex(),
//           satoshis: output.satoshis,
//         })),
//       },
//       transactions: {
//         [tx.id]: tx.serialize({ disableAll: true }),
//       },
//     })
//   );
// };

generateGenesisState();
