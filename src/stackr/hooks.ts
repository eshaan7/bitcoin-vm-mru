import { Hook, Hooks } from "@stackr/sdk/machine";

import { BitcoinVMState } from "./state";

const myHook: Hook<BitcoinVMState> = {
  handler: ({ state }) => state,
};

export const hooks: Hooks<BitcoinVMState> = { myHook };
