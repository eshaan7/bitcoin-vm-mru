import { ActionConfirmationStatus, AllowedInputTypes } from "@stackr/sdk";
import * as bitcore from "bitcore-lib";
import { Wallet } from "ethers";
import inquirer from "inquirer";

import { createP2PKHTx, createP2PSHTx } from "./bitcore-utils";
import { CLIAction, CLITransferSatsResponse } from "./cli-types";
import { MintSatsSchema, RunTxSchema } from "./stackr/actions";
import { btcStateMachine } from "./stackr/machine";
import { mru } from "./stackr/mru";
import { MintSatsInputs, RunTxInputs, UTXO } from "./stackr/types";

const sm = mru.stateMachines.getFirst<
  typeof btcStateMachine
>() as typeof btcStateMachine;

const accounts = {
  Admin: new Wallet(process.env.PRIVATE_KEY!),
  "User 1": new Wallet(process.env.PRIVATE_KEY_USER_1!),
  "User 2": new Wallet(process.env.PRIVATE_KEY_USER_2!),
};
const operator = accounts["Admin"];
let selectedWallet: Wallet;

const findSufficientUtxos = (btcAddress: string, sats: number): UTXO[] => {
  const usersUtxos = Object.values(sm.state.utxos)
    .flatMap((utxos) => utxos)
    .filter((utxo) => utxo.address === btcAddress)
    .sort((a, b) => a.satoshis - b.satoshis);
  const sufficientUtxos = [];
  for (const utxo of usersUtxos) {
    if (sufficientUtxos.reduce((acc, u) => acc + u.satoshis, 0) >= sats) {
      break;
    }
    sufficientUtxos.push(utxo);
  }
  return sufficientUtxos;
};

const actions = {
  mintSats: async (btcAddress: string, satoshis: number): Promise<void> => {
    const inputs: MintSatsInputs = {
      ethAddress: selectedWallet.address,
      btcAddress,
      satoshis,
      timestamp: Date.now(),
    };
    const signature = await operator.signTypedData(
      MintSatsSchema.domain,
      MintSatsSchema.EIP712TypedData.types,
      inputs
    );
    const actionToSend = MintSatsSchema.actionFrom({
      inputs: inputs as unknown as AllowedInputTypes,
      signature,
      msgSender: operator.address,
    });
    const ack = await mru.submitAction("mintSats", actionToSend);
    const action = await ack.waitFor(ActionConfirmationStatus.C1);
    console.log("\n----------[output]----------");
    console.log("Action has been submitted.");
    console.log(ack);
    console.log(action);
    console.log("----------[/output]----------\n");
  },
  transferSats: async (to: string, sats: number): Promise<void> => {
    const btcPrivateKey = new bitcore.PrivateKey(
      selectedWallet.privateKey.replace("0x", "")
    );
    const btcAddress = btcPrivateKey.toAddress().toString();
    const sufficientUtxos = findSufficientUtxos(btcAddress, sats);
    if (sufficientUtxos.reduce((acc, u) => acc + u.satoshis, 0) < sats) {
      console.log("\n----------[output]----------");
      console.log("Insufficient balance.");
      console.log("----------[/output]----------\n");
      return;
    }
    const tx = createP2PKHTx({
      to,
      sats,
      utxos: sufficientUtxos,
      changeAddress: btcAddress,
      signers: [btcPrivateKey],
    });
    // tx.lockUntilBlockHeight(10);
    const inputs: RunTxInputs = {
      serializedTx: tx.serialize({
        disableSmallFees: true,
        disableDustOutputs: true,
      }),
    };
    const signature = await operator.signTypedData(
      RunTxSchema.domain,
      RunTxSchema.EIP712TypedData.types,
      inputs
    );
    const actionToSend = RunTxSchema.actionFrom({
      inputs: inputs as unknown as AllowedInputTypes,
      signature,
      msgSender: operator.address,
    });
    const ack = await mru.submitAction("runTx", actionToSend);
    const action = await ack.waitFor(ActionConfirmationStatus.C1);
    console.log("\n----------[output]----------");
    console.log("Action has been submitted.");
    console.log(ack);
    console.log(action);
    console.log("----------[/output]----------\n");
  },
  transferSatsMultiSig: async (to: string, sats: number): Promise<void> => {
    const btcPrivKeys = Object.values(accounts).map(
      (wallet) => new bitcore.PrivateKey(wallet.privateKey.replace("0x", ""))
    );
    const btcPubKeys = btcPrivKeys.map((privKey) => privKey.toPublicKey());
    const threshold = 2;
    const p2shAddress = new bitcore.Address(btcPubKeys, threshold);
    const sufficientUtxos = findSufficientUtxos(p2shAddress.toString(), sats);
    if (sufficientUtxos.reduce((acc, u) => acc + u.satoshis, 0) < sats) {
      console.log("\n----------[output]----------");
      console.log("Insufficient balance.");
      console.log("----------[/output]----------\n");
      return;
    }
    const tx = createP2PSHTx({
      to,
      sats,
      utxos: sufficientUtxos,
      pubKeys: btcPubKeys,
      threshold,
      changeAddress: p2shAddress.toString(),
      signers: btcPrivKeys.slice(0, threshold),
    });
    const inputs: RunTxInputs = {
      serializedTx: tx.serialize({
        disableSmallFees: true,
        disableDustOutputs: true,
      }),
    };
    const signature = await operator.signTypedData(
      RunTxSchema.domain,
      RunTxSchema.EIP712TypedData.types,
      inputs
    );
    const actionToSend = RunTxSchema.actionFrom({
      inputs: inputs as unknown as AllowedInputTypes,
      signature,
      msgSender: operator.address,
    });
    const ack = await mru.submitAction("runTx", actionToSend);
    const action = await ack.waitFor(ActionConfirmationStatus.C1);
    console.log("\n----------[output]----------");
    console.log("Action has been submitted.");
    console.log(ack);
    console.log(action);
    console.log("----------[/output]----------\n");
  },
  viewBalances: async (): Promise<void> => {
    const ethBtcAddressLabelMap = Object.entries(accounts).reduce(
      (acc, [label, wallet]) => {
        const btcAddress = new bitcore.PrivateKey(
          wallet.privateKey.replace("0x", "")
        )
          .toAddress()
          .toString();
        acc[btcAddress] = label;
        return acc;
      },
      {} as Record<string, string>
    );
    const balances = Object.values(sm.state.utxos)
      .flatMap((utxos) => utxos)
      .reduce(
        (acc, utxo) => {
          if (!acc[utxo.address]) {
            acc[utxo.address] = {
              label: ethBtcAddressLabelMap[utxo.address] || "-",
              address: utxo.address,
              sats: 0,
              utxoCount: 0,
            };
          }
          acc[utxo.address].sats += utxo.satoshis;
          acc[utxo.address].utxoCount += 1;
          return acc;
        },
        {} as Record<
          string,
          { label: string; address: string; sats: number; utxoCount: number }
        >
      );
    console.log("\n----------[output]----------");
    console.log("Balances:");
    console.table(Object.values(balances));
    console.log("----------[/output]----------\n");
  },
};

const askAccount = async (): Promise<"Admin" | "User 1" | "User 2"> => {
  const response = await inquirer.prompt([
    {
      type: "list",
      name: "account",
      message: "Choose an account:",
      choices: ["Admin", "User 1", "User 2"],
    },
  ]);
  return response.account;
};

const askAction = async (): Promise<CLIAction> => {
  const choices = ["Transfer Sats", "Switch account", "Exit"];
  if (selectedWallet === accounts["Admin"]) {
    choices.unshift("Transfer Sats from Multisig");
    choices.unshift("Mint Sats");
    choices.unshift("View Balances");
  }
  const response = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Choose an action:",
      choices,
    },
  ]);
  return response.action as CLIAction;
};

const askTransferSatsInput = async (): Promise<CLITransferSatsResponse> => {
  return inquirer.prompt<CLITransferSatsResponse>([
    {
      type: "input",
      name: "to",
      message: "Enter the receiver's address:",
    },
    {
      type: "input",
      name: "sats",
      message: "Enter the sats amount:",
      validate: (value: string): boolean | string => {
        const valid = !isNaN(parseInt(value)) && parseInt(value) > 0;
        return valid || "Please enter a positive number";
      },
      filter: (value: string): number => parseInt(value),
    },
  ]);
};

const main = async (): Promise<void> => {
  let exit = false;
  let selectedAccount: string = ""; // To store the selected account

  while (!exit) {
    if (!selectedAccount) {
      selectedAccount = await askAccount();
      if (
        selectedAccount === "Admin" ||
        selectedAccount === "User 1" ||
        selectedAccount === "User 2"
      ) {
        selectedWallet = accounts[selectedAccount];
        console.log("\n----------[output]----------");
        console.log(
          `You have selected: ${selectedWallet.address.slice(0, 12)}...`
        );
        console.log("----------[/output]----------\n");
      }
    }

    const action = await askAction();

    switch (action) {
      case "Switch account": {
        selectedAccount = ""; // Reset selected account so the user can choose again
        break;
      }
      case "Mint Sats": {
        const { to, sats } = await askTransferSatsInput();
        await actions.mintSats(to, sats);
        break;
      }
      case "Transfer Sats": {
        const { to, sats } = await askTransferSatsInput();
        await actions.transferSats(to, sats);
        break;
      }
      case "Transfer Sats from Multisig": {
        const { to, sats } = await askTransferSatsInput();
        await actions.transferSatsMultiSig(to, sats);
        break;
      }
      case "View Balances": {
        await actions.viewBalances();
        break;
      }
      case "Exit": {
        exit = true;
        break;
      }
      default: {
        console.log("Invalid action selected.");
        break;
      }
    }
  }

  console.log("Exiting app...");
};

await main();
