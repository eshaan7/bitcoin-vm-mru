import { ActionParams, MicroRollupResponse } from "@stackr/sdk";
import { AllowedInputTypes } from "@stackr/sdk/machine";
import { Bridge } from "@stackr/sdk/plugins";
import * as bitcore from "bitcore-lib";
import { AbiCoder, Wallet } from "ethers";

import { MintSatsInputs } from "./types";

const abiCoder = AbiCoder.defaultAbiCoder();
const operator = new Wallet(process.env.PRIVATE_KEY as string);

export function initBridge(mru: MicroRollupResponse) {
  Bridge.init(mru, {
    handlers: {
      BRIDGE_WBTC: async (args) => {
        const [btcAddress, amount] = abiCoder.decode(
          ["string", "uint256"],
          args.data
        );
        const satoshis = bitcore.Unit.fromBTC(amount).toSatoshis();
        console.log(
          `[BRIDGE_WBTC ticket: #${args.ticketNumber}] Received ${amount} WBTC from ${args.submitter} to mint ${satoshis} sats to ${btcAddress}.`
        );

        const name = "mintSats";
        const inputs: MintSatsInputs = {
          ethAddress: args.submitter,
          btcAddress,
          satoshis,
          timestamp: Date.now(),
        };
        const signature = await operator.signTypedData(
          mru.config.domain,
          mru.getStfSchemaMap()[name],
          { name, inputs }
        );
        const actionParams: ActionParams = {
          name,
          inputs: inputs as unknown as AllowedInputTypes,
          signature,
          msgSender: operator.address,
        };

        return {
          actionParams,
        };
      },
    },
  });
  console.log("Listening for BRIDGE_WBTC tickets on the bridge contract...");
}
