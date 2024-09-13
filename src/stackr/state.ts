import { State } from "@stackr/sdk/machine";
import { solidityPackedKeccak256 } from "ethers";
import { MerkleTree } from "merkletreejs";

import { BitcoinVMStateType } from "./types";

export class BitcoinVMState extends State<BitcoinVMStateType> {
  constructor(state: BitcoinVMStateType) {
    super(state);
  }

  getRootHash(): string {
    const adminHashes = this.state.admins.map((admin) =>
      solidityPackedKeccak256(["string"], [admin])
    );
    const adminsRoot = new MerkleTree(adminHashes).getHexRoot();
    const utxos = Object.values(this.state.utxos).flatMap((utxos) => utxos);
    const utxoHashes = utxos.map((utxo) =>
      solidityPackedKeccak256(
        ["string", "uint256", "string", "string", "uint256"],
        [
          utxo.txId,
          utxo.outputIndex,
          utxo.address, // bitcoin address so using string
          utxo.script,
          utxo.satoshis,
        ]
      )
    );
    const utxosRoot = new MerkleTree(utxoHashes).getHexRoot();
    const txHashes = this.state.transactions.map((tx) =>
      solidityPackedKeccak256(["string"], [tx])
    );
    const txsRoot = new MerkleTree(txHashes).getHexRoot();
    const finalTree = new MerkleTree([adminsRoot, utxosRoot, txsRoot]);
    return finalTree.getHexRoot();
  }
}
